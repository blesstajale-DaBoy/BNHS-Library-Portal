import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from './firebase.ts';
import {
  BookCategory,
  BookItem,
  BookWaitlistRequest,
  BorrowRecord,
  DigitalResource,
  LibraryUser,
  PortalSettings,
  UserRole,
} from '../types.ts';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const CHUNK_PREFIX = 'fs-chunk://';
const ASSET_CHUNK_SIZE = 300000;
const INLINE_THRESHOLD = 220000;
const TEXT_INLINE_THRESHOLD = 120000;

const ownerUidCache = new Map<string, string>();
const chunkResolutionCache = new Map<string, string>();

function getVerifiedUid(): string | null {
  const u = auth.currentUser;
  if (!u || !u.emailVerified) return null;
  return u.uid;
}

function getEffectiveOwnerUid(docKey: string, fallbackUid: string): string {
  return ownerUidCache.get(docKey) || fallbackUid;
}

function sanitizeId(raw: string | number): string {
  const cleaned = String(raw).replace(/[^a-zA-Z0-9_\-]/g, '_');
  return cleaned.slice(0, 128) || 'item_0';
}

function clampString(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.length > maxLen ? val.slice(0, maxLen) : val;
}

async function resolveLocalApiAssetToDataUrl(url: string): Promise<string> {
  if (!url || !url.startsWith('/api/portal-assets/')) {
    return url;
  }
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return url;
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string' && reader.result.startsWith('data:')) {
          resolve(reader.result);
        } else {
          resolve(url);
        }
      };
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

async function encodePossiblyLargeString(
  rawValue: string,
  assetKeyBase: string,
  ownerUid: string,
  inlineLimit: number
): Promise<string> {
  let value = rawValue || '';
  if (value.startsWith('/api/portal-assets/')) {
    value = await resolveLocalApiAssetToDataUrl(value);
  }
  if (value.length <= inlineLimit) {
    return value;
  }
  const uniqueSuffix = Date.now().toString(36);
  const safeKey = `${sanitizeId(assetKeyBase).slice(0, 80)}_${uniqueSuffix}`;
  const total = Math.ceil(value.length / ASSET_CHUNK_SIZE);
  const nowIso = new Date().toISOString();
  const writes: Promise<void>[] = [];
  for (let i = 0; i < total; i++) {
    const slice = value.slice(i * ASSET_CHUNK_SIZE, (i + 1) * ASSET_CHUNK_SIZE);
    const chunkId = sanitizeId(`${safeKey}_${i}`);
    const chunkPath = `asset_chunks/${chunkId}`;
    const chunkOwner = getEffectiveOwnerUid(chunkPath, ownerUid);
    writes.push(
      setDoc(doc(db, 'asset_chunks', chunkId), {
        assetKey: safeKey,
        index: i,
        total,
        data: slice,
        ownerUid: chunkOwner,
        updatedAt: nowIso,
      }).catch((err) => handleFirestoreError(err, OperationType.WRITE, chunkPath))
    );
  }
  await Promise.all(writes);
  const pointer = `${CHUNK_PREFIX}${safeKey}:${total}`;
  chunkResolutionCache.set(pointer, value);
  return pointer;
}

async function decodePossiblyChunkedString(value: unknown): Promise<string> {
  if (typeof value !== 'string') return '';
  if (!value.startsWith(CHUNK_PREFIX)) return value;
  const cached = chunkResolutionCache.get(value);
  if (cached) return cached;

  const rest = value.slice(CHUNK_PREFIX.length);
  const colonIdx = rest.lastIndexOf(':');
  if (colonIdx <= 0) return '';
  const assetKey = rest.slice(0, colonIdx);
  const total = Number(rest.slice(colonIdx + 1));
  if (!Number.isFinite(total) || total <= 0 || total > 100) return '';

  const parts: string[] = [];
  for (let i = 0; i < total; i++) {
    const chunkId = sanitizeId(`${assetKey}_${i}`);
    const chunkPath = `asset_chunks/${chunkId}`;
    try {
      const snap = await getDoc(doc(db, 'asset_chunks', chunkId));
      if (!snap.exists()) return '';
      const d = snap.data();
      parts.push(typeof d.data === 'string' ? d.data : '');
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, chunkPath);
    }
  }
  const assembled = parts.join('');
  chunkResolutionCache.set(value, assembled);
  return assembled;
}

export function isVerifiedFirebaseSyncReady(): boolean {
  return Boolean(getVerifiedUid());
}

export async function syncPortalSettingsToFirestore(
  settings: PortalSettings
): Promise<boolean> {
  const uid = getVerifiedUid();
  if (!uid) return false;
  const path = 'portal_settings/main';
  const ownerUid = getEffectiveOwnerUid(path, uid);
  const heroEncoded = await encodePossiblyLargeString(
    settings.heroImageUrl || '',
    'portal_hero_banner',
    ownerUid,
    INLINE_THRESHOLD
  );
  const logoEncoded = await encodePossiblyLargeString(
    settings.logoImageUrl || '',
    'portal_school_logo',
    ownerUid,
    INLINE_THRESHOLD
  );
  const payload = {
    portalTitle: clampString(
      settings.portalTitle ||
        'Barobo National High School (BNHS) Library Portal developed by: Bless T. Tajale',
      300
    ),
    welcomeHeading: clampString(
      settings.welcomeHeading || 'Welcome to the BNHS Library Portal',
      300
    ),
    welcomeSubtext: clampString(settings.welcomeSubtext || '', 2000),
    scheduleBannerText: clampString(
      settings.scheduleBannerText ||
        'Academic Year 2026–2027 · Open Mon–Fri, 7:30 AM – 5:00 PM',
      500
    ),
    heroImageUrl: clampString(heroEncoded, 500000),
    logoImageUrl: clampString(logoEncoded, 500000),
    ownerUid,
    updatedAt: new Date().toISOString(),
  };
  try {
    await setDoc(doc(db, 'portal_settings', 'main'), payload);
    ownerUidCache.set(path, ownerUid);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function syncBookToFirestore(book: BookItem): Promise<boolean> {
  const uid = getVerifiedUid();
  if (!uid) return false;
  const docId = sanitizeId(book.id);
  const path = `books/${docId}`;
  const ownerUid = getEffectiveOwnerUid(path, uid);
  const coverEncoded = await encodePossiblyLargeString(
    book.coverKey || 'history',
    `book_cover_${docId}`,
    ownerUid,
    INLINE_THRESHOLD
  );
  const payload = {
    id: Number(book.id),
    title: clampString(book.title || 'Untitled Book', 500),
    author: clampString(book.author || 'BNHS Faculty', 500),
    isbn: clampString(book.isbn || `ISBN-${docId}`, 128),
    subject: clampString(book.subject || '', 200),
    category: clampString(book.category || 'General', 200),
    publisher: clampString(book.publisher || '', 300),
    publicationYear: Number(book.publicationYear) || 2025,
    shelfLocation: clampString(book.shelfLocation || '', 200),
    totalCopies: Math.max(1, Number(book.totalCopies) || 1),
    availableCopies: Math.max(0, Number(book.availableCopies) || 0),
    description: clampString(book.description || '', 5000),
    coverKey: clampString(coverEncoded, 500000),
    ownerUid,
    updatedAt: new Date().toISOString(),
  };
  try {
    await setDoc(doc(db, 'books', docId), payload);
    ownerUidCache.set(path, ownerUid);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteBookFromFirestore(bookId: number): Promise<boolean> {
  const uid = getVerifiedUid();
  if (!uid) return false;
  const docId = sanitizeId(bookId);
  const path = `books/${docId}`;
  try {
    await deleteDoc(doc(db, 'books', docId));
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function syncCategoryToFirestore(
  cat: BookCategory
): Promise<boolean> {
  const uid = getVerifiedUid();
  if (!uid) return false;
  const docId = sanitizeId(cat.id);
  const path = `categories/${docId}`;
  const ownerUid = getEffectiveOwnerUid(path, uid);
  const payload = {
    id: Number(cat.id),
    name: clampString(cat.name || 'Category', 200),
    code: clampString(cat.code || 'GEN', 64),
    shelfZone: clampString(cat.shelfZone || 'Main Wing', 200),
    description: clampString(cat.description || '', 2000),
    ownerUid,
    updatedAt: new Date().toISOString(),
  };
  try {
    await setDoc(doc(db, 'categories', docId), payload);
    ownerUidCache.set(path, ownerUid);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteCategoryFromFirestore(
  categoryId: number
): Promise<boolean> {
  const uid = getVerifiedUid();
  if (!uid) return false;
  const docId = sanitizeId(categoryId);
  const path = `categories/${docId}`;
  try {
    await deleteDoc(doc(db, 'categories', docId));
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function syncDigitalResourceToFirestore(
  resItem: DigitalResource
): Promise<boolean> {
  const uid = getVerifiedUid();
  if (!uid) return false;
  const docId = sanitizeId(resItem.id);
  const path = `digital_resources/${docId}`;
  const ownerUid = getEffectiveOwnerUid(path, uid);
  const urlEncoded = await encodePossiblyLargeString(
    resItem.externalUrl || '',
    `digital_file_${docId}`,
    ownerUid,
    INLINE_THRESHOLD
  );
  const previewEncoded = await encodePossiblyLargeString(
    resItem.contentPreview || '',
    `digital_preview_${docId}`,
    ownerUid,
    TEXT_INLINE_THRESHOLD
  );
  const payload = {
    id: Number(resItem.id),
    title: clampString(resItem.title || 'Digital Resource', 500),
    author: clampString(resItem.author || 'BNHS Faculty', 300),
    resourceType: clampString(resItem.resourceType || 'PDF Learning Material', 100),
    subject: clampString(resItem.subject || 'General', 200),
    gradeLevel: clampString(resItem.gradeLevel || '', 200),
    fileSize: clampString(resItem.fileSize || '', 100),
    pageCount: Math.max(0, Number(resItem.pageCount) || 0),
    downloadCount: Math.max(0, Number(resItem.downloadCount) || 0),
    summary: clampString(resItem.summary || '', 5000),
    contentPreview: clampString(previewEncoded, 200000),
    externalUrl: clampString(urlEncoded, 600000),
    uploadedBy: clampString(resItem.uploadedBy || '', 200),
    ownerUid,
    updatedAt: new Date().toISOString(),
  };
  try {
    await setDoc(doc(db, 'digital_resources', docId), payload);
    ownerUidCache.set(path, ownerUid);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteDigitalResourceFromFirestore(
  resourceId: number
): Promise<boolean> {
  const uid = getVerifiedUid();
  if (!uid) return false;
  const docId = sanitizeId(resourceId);
  const path = `digital_resources/${docId}`;
  try {
    await deleteDoc(doc(db, 'digital_resources', docId));
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function syncBorrowRecordToFirestore(
  rec: BorrowRecord
): Promise<boolean> {
  const uid = getVerifiedUid();
  if (!uid) return false;
  const docId = sanitizeId(rec.id);
  const path = `borrow_records/${docId}`;
  const ownerUid = getEffectiveOwnerUid(path, uid);
  const payload = {
    id: Number(rec.id),
    transactionCode: clampString(rec.transactionCode || `TXN-${docId}`, 100),
    bookId: Number(rec.bookId),
    borrowerUid: clampString(rec.borrowerUid || '', 128),
    borrowerName: clampString(rec.borrowerName || 'Borrower', 200),
    borrowerRole: clampString(rec.borrowerRole || 'Student', 64),
    borrowerIdNumber: clampString(rec.borrowerIdNumber || '', 100),
    issueDate: clampString(rec.issueDate || '', 64),
    dueDate: clampString(rec.dueDate || '', 64),
    returnDate: rec.returnDate ? clampString(rec.returnDate, 64) : null,
    status: clampString(rec.status || 'Borrowed', 32),
    remarks: clampString(rec.remarks || '', 1000),
    ownerUid,
    updatedAt: new Date().toISOString(),
  };
  try {
    await setDoc(doc(db, 'borrow_records', docId), payload);
    ownerUidCache.set(path, ownerUid);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function syncWaitlistRequestToFirestore(
  item: BookWaitlistRequest
): Promise<boolean> {
  const uid = getVerifiedUid();
  if (!uid) return false;
  const docId = sanitizeId(item.id);
  const path = `waitlist_requests/${docId}`;
  const ownerUid = getEffectiveOwnerUid(path, uid);
  const payload = {
    id: Number(item.id),
    bookId: Number(item.bookId),
    bookTitle: clampString(item.bookTitle || 'Book Title', 500),
    studentName: clampString(item.studentName || 'Student', 200),
    studentIdNumber: clampString(item.studentIdNumber || '', 100),
    requestedAt: clampString(item.requestedAt || '', 64),
    fulfilled: Boolean(item.fulfilled),
    returnedAt: clampString(item.returnedAt || '', 64),
    ownerUid,
  };
  try {
    await setDoc(doc(db, 'waitlist_requests', docId), payload);
    ownerUidCache.set(path, ownerUid);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function syncUserToFirestore(user: LibraryUser): Promise<boolean> {
  const uid = getVerifiedUid();
  if (!uid) return false;
  const docId = sanitizeId(user.id);
  const publicPath = `members_public/${docId}`;
  const privatePath = `members_private/${docId}`;
  const publicOwner = getEffectiveOwnerUid(publicPath, uid);
  const privateOwner = getEffectiveOwnerUid(privatePath, uid);
  const nowIso = new Date().toISOString();

  const publicPayload = {
    id: Number(user.id),
    uid: clampString(user.uid || `bnhs-member-${docId}`, 128),
    fullName: clampString(user.fullName || 'BNHS Member', 200),
    role: clampString(user.role || 'Student', 64),
    idNumber: clampString(user.idNumber || '', 100),
    gradeOrDepartment: clampString(user.gradeOrDepartment || '', 200),
    status: clampString(user.status || 'Active', 32),
    ownerUid: publicOwner,
    updatedAt: nowIso,
  };

  const privatePayload = {
    uid: publicPayload.uid,
    email: clampString(user.email || 'member@bnhs.edu.ph', 254),
    ownerUid: privateOwner,
    updatedAt: nowIso,
  };

  try {
    await setDoc(doc(db, 'members_public', docId), publicPayload);
    ownerUidCache.set(publicPath, publicOwner);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, publicPath);
  }

  try {
    await setDoc(doc(db, 'members_private', docId), privatePayload);
    ownerUidCache.set(privatePath, privateOwner);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, privatePath);
  }
  return true;
}

export async function deleteUserFromFirestore(userId: number): Promise<boolean> {
  const uid = getVerifiedUid();
  if (!uid) return false;
  const docId = sanitizeId(userId);
  try {
    await deleteDoc(doc(db, 'members_public', docId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `members_public/${docId}`);
  }
  try {
    await deleteDoc(doc(db, 'members_private', docId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `members_private/${docId}`);
  }
  return true;
}

export async function seedOrPushAllToFirestore(state: {
  portalSettings: PortalSettings;
  books: BookItem[];
  categories: BookCategory[];
  digitalResources: DigitalResource[];
  borrowRecords: BorrowRecord[];
  waitlistRequests: BookWaitlistRequest[];
  users: LibraryUser[];
}, forceOverwriteAll = false): Promise<boolean> {
  const uid = getVerifiedUid();
  if (!uid) return false;

  if (!forceOverwriteAll) {
    try {
      const existingSettings = await getDoc(doc(db, 'portal_settings', 'main'));
      if (existingSettings.exists()) {
        // Already seeded in Firestore — do not blindly overwrite newer remote data unless explicitly syncing a local change
        return false;
      }
    } catch {
      // Proceed to seed if missing
    }
  }

  await syncPortalSettingsToFirestore(state.portalSettings);
  await Promise.all([
    ...state.books.map((b) => syncBookToFirestore(b)),
    ...state.categories.map((c) => syncCategoryToFirestore(c)),
    ...state.digitalResources.map((r) => syncDigitalResourceToFirestore(r)),
    ...state.borrowRecords.map((br) => syncBorrowRecordToFirestore(br)),
    ...state.waitlistRequests.map((w) => syncWaitlistRequestToFirestore(w)),
    ...state.users.map((u) => syncUserToFirestore(u)),
  ]);
  return true;
}

export interface SharedPortalSubscriptionCallbacks {
  onPortalSettings: (settings: PortalSettings) => void;
  onBooks: (books: BookItem[]) => void;
  onCategories: (categories: BookCategory[]) => void;
  onDigitalResources: (resources: DigitalResource[]) => void;
  onBorrowRecords: (records: BorrowRecord[]) => void;
  onWaitlistRequests: (requests: BookWaitlistRequest[]) => void;
  onUsers: (users: LibraryUser[]) => void;
  onRemoteSyncActivity?: () => void;
}

export function subscribeToSharedPortalFirestore(
  callbacks: SharedPortalSubscriptionCallbacks
): () => void {
  const unsubscribers: Unsubscribe[] = [];
  let publicMembersCache: LibraryUser[] = [];
  const privateEmailById = new Map<string, string>();
  let authUnsub: Unsubscribe | null = null;
  let privateUnsub: Unsubscribe | null = null;

  const emitMergedUsers = () => {
    if (publicMembersCache.length === 0) return;
    const merged = publicMembersCache.map((u) => {
      const privEmail = privateEmailById.get(String(u.id));
      return privEmail ? { ...u, email: privEmail } : u;
    });
    callbacks.onUsers(merged);
  };

  // 1. Portal Settings (hero image, school logo, schedule banner, welcome heading)
  unsubscribers.push(
    onSnapshot(
      doc(db, 'portal_settings', 'main'),
      async (snap) => {
        if (!snap.exists()) return;
        const d = snap.data();
        if (typeof d.ownerUid === 'string') {
          ownerUidCache.set('portal_settings/main', d.ownerUid);
        }
        const [heroUrl, logoUrl] = await Promise.all([
          decodePossiblyChunkedString(d.heroImageUrl),
          decodePossiblyChunkedString(d.logoImageUrl),
        ]);
        callbacks.onPortalSettings({
          portalTitle: d.portalTitle || '',
          welcomeHeading: d.welcomeHeading || '',
          welcomeSubtext: d.welcomeSubtext || '',
          scheduleBannerText: d.scheduleBannerText || '',
          heroImageUrl: heroUrl,
          logoImageUrl: logoUrl,
        });
        callbacks.onRemoteSyncActivity?.();
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'portal_settings/main');
      }
    )
  );

  // 2. Books catalog
  unsubscribers.push(
    onSnapshot(
      collection(db, 'books'),
      async (snap) => {
        if (snap.empty) return;
        const list = await Promise.all(
          snap.docs.map(async (docSnap) => {
            const d = docSnap.data();
            if (typeof d.ownerUid === 'string') {
              ownerUidCache.set(`books/${docSnap.id}`, d.ownerUid);
            }
            const cover = await decodePossiblyChunkedString(d.coverKey);
            return {
              id: Number(d.id),
              title: String(d.title || ''),
              author: String(d.author || ''),
              isbn: String(d.isbn || ''),
              subject: String(d.subject || ''),
              category: String(d.category || ''),
              publisher: String(d.publisher || ''),
              publicationYear: Number(d.publicationYear) || 2025,
              shelfLocation: String(d.shelfLocation || ''),
              totalCopies: Number(d.totalCopies) || 1,
              availableCopies: Number(d.availableCopies) || 0,
              description: String(d.description || ''),
              coverKey: cover || 'history',
            } satisfies BookItem;
          })
        );
        list.sort((a, b) => b.id - a.id);
        callbacks.onBooks(list);
        callbacks.onRemoteSyncActivity?.();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'books');
      }
    )
  );

  // 3. Categories
  unsubscribers.push(
    onSnapshot(
      collection(db, 'categories'),
      (snap) => {
        if (snap.empty) return;
        const list = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          if (typeof d.ownerUid === 'string') {
            ownerUidCache.set(`categories/${docSnap.id}`, d.ownerUid);
          }
          return {
            id: Number(d.id),
            name: String(d.name || ''),
            code: String(d.code || ''),
            shelfZone: String(d.shelfZone || ''),
            description: String(d.description || ''),
          } satisfies BookCategory;
        });
        list.sort((a, b) => a.id - b.id);
        callbacks.onCategories(list);
        callbacks.onRemoteSyncActivity?.();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'categories');
      }
    )
  );

  // 4. Digital Resources
  unsubscribers.push(
    onSnapshot(
      collection(db, 'digital_resources'),
      async (snap) => {
        if (snap.empty) return;
        const list = await Promise.all(
          snap.docs.map(async (docSnap) => {
            const d = docSnap.data();
            if (typeof d.ownerUid === 'string') {
              ownerUidCache.set(`digital_resources/${docSnap.id}`, d.ownerUid);
            }
            const [resolvedUrl, resolvedPreview] = await Promise.all([
              decodePossiblyChunkedString(d.externalUrl),
              decodePossiblyChunkedString(d.contentPreview),
            ]);
            return {
              id: Number(d.id),
              title: String(d.title || ''),
              author: String(d.author || ''),
              resourceType: (d.resourceType ||
                'PDF Learning Material') as DigitalResource['resourceType'],
              subject: String(d.subject || ''),
              gradeLevel: String(d.gradeLevel || ''),
              fileSize: String(d.fileSize || ''),
              pageCount: Number(d.pageCount) || 0,
              downloadCount: Number(d.downloadCount) || 0,
              summary: String(d.summary || ''),
              contentPreview: resolvedPreview,
              externalUrl: resolvedUrl,
              uploadedBy: String(d.uploadedBy || ''),
            } satisfies DigitalResource;
          })
        );
        list.sort((a, b) => b.id - a.id);
        callbacks.onDigitalResources(list);
        callbacks.onRemoteSyncActivity?.();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'digital_resources');
      }
    )
  );

  // 5. Borrow Records
  unsubscribers.push(
    onSnapshot(
      collection(db, 'borrow_records'),
      (snap) => {
        if (snap.empty) return;
        const list = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          if (typeof d.ownerUid === 'string') {
            ownerUidCache.set(`borrow_records/${docSnap.id}`, d.ownerUid);
          }
          return {
            id: Number(d.id),
            transactionCode: String(d.transactionCode || ''),
            bookId: Number(d.bookId),
            borrowerUid: String(d.borrowerUid || ''),
            borrowerName: String(d.borrowerName || ''),
            borrowerRole: String(d.borrowerRole || 'Student'),
            borrowerIdNumber: String(d.borrowerIdNumber || ''),
            issueDate: String(d.issueDate || ''),
            dueDate: String(d.dueDate || ''),
            returnDate: d.returnDate ? String(d.returnDate) : null,
            status: (d.status || 'Borrowed') as BorrowRecord['status'],
            remarks: String(d.remarks || ''),
          } satisfies BorrowRecord;
        });
        list.sort((a, b) => b.id - a.id);
        callbacks.onBorrowRecords(list);
        callbacks.onRemoteSyncActivity?.();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'borrow_records');
      }
    )
  );

  // 6. Waitlist Requests
  unsubscribers.push(
    onSnapshot(
      collection(db, 'waitlist_requests'),
      (snap) => {
        if (snap.empty) return;
        const list = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          if (typeof d.ownerUid === 'string') {
            ownerUidCache.set(`waitlist_requests/${docSnap.id}`, d.ownerUid);
          }
          return {
            id: Number(d.id),
            bookId: Number(d.bookId),
            bookTitle: String(d.bookTitle || ''),
            studentName: String(d.studentName || ''),
            studentIdNumber: String(d.studentIdNumber || ''),
            requestedAt: String(d.requestedAt || ''),
            fulfilled: Boolean(d.fulfilled),
            returnedAt: d.returnedAt ? String(d.returnedAt) : undefined,
          } satisfies BookWaitlistRequest;
        });
        list.sort((a, b) => b.id - a.id);
        callbacks.onWaitlistRequests(list);
        callbacks.onRemoteSyncActivity?.();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'waitlist_requests');
      }
    )
  );

  // 7. Public Members Directory (no PII)
  unsubscribers.push(
    onSnapshot(
      collection(db, 'members_public'),
      (snap) => {
        if (snap.empty) return;
        publicMembersCache = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          if (typeof d.ownerUid === 'string') {
            ownerUidCache.set(`members_public/${docSnap.id}`, d.ownerUid);
          }
          return {
            id: Number(d.id),
            uid: String(d.uid || ''),
            email: privateEmailById.get(docSnap.id) || 'member@bnhs.edu.ph',
            fullName: String(d.fullName || ''),
            role: (d.role || 'Student') as UserRole,
            idNumber: String(d.idNumber || ''),
            gradeOrDepartment: String(d.gradeOrDepartment || ''),
            status: String(d.status || 'Active'),
          } satisfies LibraryUser;
        });
        publicMembersCache.sort((a, b) => a.id - b.id);
        emitMergedUsers();
        callbacks.onRemoteSyncActivity?.();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'members_public');
      }
    )
  );

  // 8. Private Member Emails (only subscribed when verified admin is authenticated)
  authUnsub = auth.onAuthStateChanged((user) => {
    if (privateUnsub) {
      privateUnsub();
      privateUnsub = null;
    }
    if (
      user &&
      user.emailVerified &&
      user.email?.toLowerCase() === 'blesstajale@gmail.com'
    ) {
      privateUnsub = onSnapshot(
        collection(db, 'members_private'),
        (snap) => {
          snap.docs.forEach((docSnap) => {
            const d = docSnap.data();
            if (typeof d.ownerUid === 'string') {
              ownerUidCache.set(`members_private/${docSnap.id}`, d.ownerUid);
            }
            if (typeof d.email === 'string') {
              privateEmailById.set(docSnap.id, d.email);
            }
          });
          emitMergedUsers();
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, 'members_private');
        }
      );
    }
  });

  // Ensure asset chunks listener isn't leaked if needed; chunks are fetched on-demand by decodePossiblyChunkedString
  // Return cleanup
  return () => {
    unsubscribers.forEach((fn) => fn());
    if (authUnsub) authUnsub();
    if (privateUnsub) privateUnsub();
  };
}

export async function checkFirestoreSeeded(): Promise<boolean> {
  try {
    const snap = await getDocs(collection(db, 'portal_settings'));
    return !snap.empty;
  } catch {
    return false;
  }
}
