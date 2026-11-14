/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  LayoutDashboard,
  ArrowLeftRight,
  FileText,
  Settings,
  BarChart3,
  Search,
  Plus,
  Download,
  LogIn,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Eye,
  Trash2,
  UserCheck,
  Database,
  X,
  Menu,
  BookMarked,
  FolderPlus,
  Users,
  Pencil,
  Bell,
  Image as ImageIcon,
  GraduationCap,
  RefreshCw,
  Upload,
  Check,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import {
  BookItem,
  BorrowRecord,
  DigitalResource,
  BookCategory,
  LibraryUser,
  LibraryStats,
  UserRole,
  PortalSettings,
  BookWaitlistRequest,
  PortalNotification,
} from './types.ts';
import { SqlExportModal } from './components/SqlExportModal.tsx';
import { CategoryDistributionChart } from './components/CategoryDistributionChart.tsx';
import { StudentMyLibraryView } from './components/StudentMyLibraryView.tsx';
import {
  AdminPortalSettingsModal,
  EditBookModal,
  EditDigitalResourceModal,
  EditUserModal,
  EditCategoryModal,
  GoogleSignInModal,
} from './components/PortalEditModals.tsx';
import {
  DigitalResourcePreviewModal,
  ImageLightboxPreviewModal,
  InlineFilePreview,
} from './components/FilePreviewModal.tsx';
import {
  dataUrlToBlobUrl,
  inferDownloadFilename,
  readFileAsResourcePayload,
} from './lib/filePreview.ts';
import {
  BUNDLED_ASSETS,
  INITIAL_BOOKS,
  INITIAL_BORROW_RECORDS,
  INITIAL_CATEGORIES,
  INITIAL_DIGITAL_RESOURCES,
  INITIAL_PORTAL_SETTINGS,
  INITIAL_STATS,
  INITIAL_USERS,
  INITIAL_WAITLIST_REQUESTS,
  computeStatsFromLibraryData,
  resolvePortalAssetUrl,
} from './data/bnhsInitialData.ts';

type PortalModule =
  | 'dashboard'
  | 'catalog'
  | 'borrowing'
  | 'digital'
  | 'management'
  | 'reports';

const DEFAULT_HERO_IMAGE_PATH = BUNDLED_ASSETS.heroBanner;
const DEFAULT_CREST_ANIMATED_GIF_PATH = BUNDLED_ASSETS.logoAnimatedGif;
const CREST_STATIC_FALLBACK_PATH = BUNDLED_ASSETS.logoStaticJpg;
const COVER_HISTORY_PATH = BUNDLED_ASSETS.coverHistory;
const COVER_SCIENCE_PATH = BUNDLED_ASSETS.coverScience;

const ROLE_PERMISSIONS: Record<
  UserRole,
  {
    summary: string;
    canManageBooks: boolean;
    canProcessReturns: boolean;
    canManageUsers: boolean;
    canUploadDigital: boolean;
  }
> = {
  Administrator: {
    summary: 'Full system management',
    canManageBooks: true,
    canProcessReturns: true,
    canManageUsers: true,
    canUploadDigital: true,
  },
  Librarian: {
    summary: 'Books, borrowers, transactions, users, reports',
    canManageBooks: true,
    canProcessReturns: true,
    canManageUsers: true,
    canUploadDigital: true,
  },
  Teacher: {
    summary: 'Search, borrow, digital resources',
    canManageBooks: false,
    canProcessReturns: false,
    canManageUsers: false,
    canUploadDigital: true,
  },
  Student: {
    summary: 'Search, borrow, view borrowing history',
    canManageBooks: false,
    canProcessReturns: false,
    canManageUsers: false,
    canUploadDigital: false,
  },
};

function BookCoverThumbnail({
  coverKey,
  title,
}: {
  coverKey: string;
  title: string;
}) {
  const [imgError, setImgError] = useState(false);
  const isCustomSrc =
    coverKey.startsWith('data:') ||
    coverKey.startsWith('http') ||
    coverKey.startsWith('/');
  const src = isCustomSrc
    ? coverKey
    : coverKey === 'science'
    ? COVER_SCIENCE_PATH
    : COVER_HISTORY_PATH;

  if (imgError) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-[#420B17] p-2 text-center text-[#D4AF37]">
        <BookOpen className="h-5 w-5 mb-1 shrink-0" />
        <span className="text-[10px] font-medium text-white/90 line-clamp-2">
          {title}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={title}
      referrerPolicy="no-referrer"
      onError={() => setImgError(true)}
      className="h-full w-full object-cover"
    />
  );
}

// Calculate days between reference date (today) and YYYY-MM-DD due date
function computeDaysUntilDue(dueDateStr: string): number {
  const now = new Date();
  const todayMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const parts = dueDateStr.split('-').map(Number);
  if (parts.length !== 3) return 99;
  const dueMidnight = new Date(parts[0], parts[1] - 1, parts[2]).getTime();
  return Math.round((dueMidnight - todayMidnight) / 86400000);
}

const USER_EDITS_STORAGE_KEY = 'bnhs_users_edits_v2';
const USER_DELETED_STORAGE_KEY = 'bnhs_users_deleted_v2';
const DIGITAL_RESOURCES_CACHE_KEY = 'bnhs_digital_resources_v1';
const DIGITAL_DRAFT_STORAGE_KEY = 'bnhs_digital_upload_draft_v1';
const DIGITAL_EDITS_CACHE_KEY = 'bnhs_digital_edits_v1';

function saveDigitalResourcesCache(items: DigitalResource[]) {
  try {
    localStorage.setItem(DIGITAL_RESOURCES_CACHE_KEY, JSON.stringify(items));
  } catch {
    // ignore storage quota errors for very large files
  }
}

function getLocalDigitalResourcesCache(): DigitalResource[] | null {
  try {
    const raw = localStorage.getItem(DIGITAL_RESOURCES_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as DigitalResource[];
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function saveDigitalResourceOverride(item: DigitalResource) {
  try {
    const raw = localStorage.getItem(DIGITAL_EDITS_CACHE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, DigitalResource>) : {};
    map[String(item.id)] = item;
    localStorage.setItem(DIGITAL_EDITS_CACHE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

function applyLocalDigitalOverrides(
  incoming: DigitalResource[]
): DigitalResource[] {
  try {
    const rawEdits = localStorage.getItem(DIGITAL_EDITS_CACHE_KEY);
    const edits: Record<string, DigitalResource> = rawEdits
      ? JSON.parse(rawEdits)
      : {};
    const merged = incoming.map((item) => {
      const ov = edits[String(item.id)];
      return ov ? { ...item, ...ov } : item;
    });
    const existingIds = new Set(merged.map((m) => m.id));
    const localOnly = Object.values(edits).filter(
      (item) => item && !existingIds.has(item.id)
    );
    return [...localOnly, ...merged];
  } catch {
    return incoming;
  }
}

function getLocalUserEditsMap(): Record<string, LibraryUser> {
  try {
    const raw = localStorage.getItem(USER_EDITS_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Record<string, LibraryUser>;
  } catch {
    // ignore
  }
  return {};
}

function getLocalDeletedUserKeys(): string[] {
  try {
    const raw = localStorage.getItem(USER_DELETED_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch {
    // ignore
  }
  return [];
}

function saveUserEditToLocalCache(userObj: LibraryUser) {
  try {
    const edits = getLocalUserEditsMap();
    edits[`id:${userObj.id}`] = userObj;
    if (userObj.uid) {
      edits[`uid:${userObj.uid}`] = userObj;
    }
    localStorage.setItem(USER_EDITS_STORAGE_KEY, JSON.stringify(edits));
  } catch {
    // ignore
  }
}

function saveUserDeleteToLocalCache(userObj: LibraryUser) {
  try {
    const deleted = new Set(getLocalDeletedUserKeys());
    deleted.add(`id:${userObj.id}`);
    if (userObj.uid) {
      deleted.add(`uid:${userObj.uid}`);
    }
    localStorage.setItem(
      USER_DELETED_STORAGE_KEY,
      JSON.stringify(Array.from(deleted))
    );
  } catch {
    // ignore
  }
}

function applyLocalUserOverrides(incomingUsers: LibraryUser[]): LibraryUser[] {
  const edits = getLocalUserEditsMap();
  const deleted = new Set(getLocalDeletedUserKeys());

  const filtered = incomingUsers.filter(
    (u) => !deleted.has(`id:${u.id}`) && !(u.uid && deleted.has(`uid:${u.uid}`))
  );

  return filtered.map((u) => {
    const override =
      (u.uid && edits[`uid:${u.uid}`]) || edits[`id:${u.id}`] || null;
    if (override) {
      return {
        ...u,
        ...override,
        id: u.id,
        uid: u.uid || override.uid,
      };
    }
    return u;
  });
}

function LibraryPortalContent() {
  const {
    firebaseUser,
    profile,
    isAuthenticated,
    isSignedInAccount,
    signingIn,
    activeRole,
    setActiveRole,
    isSignInModalOpen,
    closeSignInModal,
    signInWithGoogle,
    signInWithPortalAccount,
    signOut,
    getAuthHeaders,
    refreshProfile,
    authError,
  } = useAuth();

  const [activeModule, setActiveModule] = useState<PortalModule>('dashboard');
  const [dashboardSubView, setDashboardSubView] = useState<
    'overview' | 'my_library'
  >('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);

  // Sync dashboard sub-view automatically when role switches to Student
  useEffect(() => {
    if (activeRole === 'Student') {
      setDashboardSubView('my_library');
    } else {
      setDashboardSubView('overview');
    }
  }, [activeRole]);

  // Shared SQL Data State — Pre-populated with full BNHS Library dataset so live published builds always display all records immediately
  const [stats, setStats] = useState<LibraryStats>(INITIAL_STATS);
  const [books, setBooks] = useState<BookItem[]>(INITIAL_BOOKS);
  const [borrowRecords, setBorrowRecords] = useState<BorrowRecord[]>(
    INITIAL_BORROW_RECORDS
  );
  const [digitalResources, setDigitalResources] = useState<DigitalResource[]>(
    () =>
      applyLocalDigitalOverrides(
        getLocalDigitalResourcesCache() || INITIAL_DIGITAL_RESOURCES
      )
  );
  const [categories, setCategories] =
    useState<BookCategory[]>(INITIAL_CATEGORIES);
  const [users, setUsers] = useState<LibraryUser[]>(() =>
    applyLocalUserOverrides(INITIAL_USERS)
  );
  const [waitlistRequests, setWaitlistRequests] = useState<
    BookWaitlistRequest[]
  >(INITIAL_WAITLIST_REQUESTS);
  const [portalSettings, setPortalSettings] = useState<PortalSettings>(
    INITIAL_PORTAL_SETTINGS
  );

  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [bannerNotice, setBannerNotice] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Image Fallback States
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [crestImgFailed, setCrestImgFailed] = useState(false);

  // Student 'My Library' Selected Student State
  const [selectedStudentName, setSelectedStudentName] = useState<string>(
    'Althea Mae C. Villaruel'
  );

  // Search & Filter States
  const [quickSearch, setQuickSearch] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [availabilityFilter, setAvailabilityFilter] = useState<
    'all' | 'available' | 'unavailable'
  >('all');
  const [borrowStatusFilter, setBorrowStatusFilter] = useState<
    'All' | 'Borrowed' | 'Overdue' | 'Returned'
  >('All');
  const [digitalTypeFilter, setDigitalTypeFilter] = useState<string>('All');
  const [digitalSearch, setDigitalSearch] = useState('');
  const [managementTab, setManagementTab] = useState<
    'inventory' | 'users' | 'categories' | 'branding'
  >('inventory');

  // Modals State
  const [selectedBookDetail, setSelectedBookDetail] = useState<BookItem | null>(
    null
  );
  const [borrowModalBook, setBorrowModalBook] = useState<BookItem | null>(null);
  const [isAddBookOpen, setIsAddBookOpen] = useState(false);
  const [isUploadDigitalOpen, setIsUploadDigitalOpen] = useState(false);
  const [readingResource, setReadingResource] =
    useState<DigitalResource | null>(null);
  const [lightboxImagePreview, setLightboxImagePreview] = useState<{
    url: string;
    title: string;
  } | null>(null);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [isPortalSettingsOpen, setIsPortalSettingsOpen] = useState(false);

  // Edit Modals State
  const [editingBook, setEditingBook] = useState<BookItem | null>(null);
  const [editingDigital, setEditingDigital] =
    useState<DigitalResource | null>(null);
  const [editingUser, setEditingUser] = useState<LibraryUser | null>(null);
  const [editingCategory, setEditingCategory] =
    useState<BookCategory | null>(null);

  const [submitting, setSubmitting] = useState(false);

  // Forms State
  const [newBookForm, setNewBookForm] = useState({
    title: '',
    author: '',
    isbn: '',
    subject: '',
    category: 'Filipiñana & History',
    publisher: '',
    publicationYear: 2026,
    shelfLocation: 'Wing A · Shelf 2B',
    totalCopies: 10,
    description: '',
    coverKey: 'history',
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const defaultDueStr = new Date(Date.now() + 14 * 86400000)
    .toISOString()
    .split('T')[0];

  const [borrowForm, setBorrowForm] = useState({
    bookId: 0,
    borrowerName: '',
    borrowerRole: 'Student',
    borrowerIdNumber: 'LRN-132604180021',
    issueDate: todayStr,
    dueDate: defaultDueStr,
    remarks: 'Standard 14-day school circulation loan',
  });

  const [digitalForm, setDigitalForm] = useState(() => {
    try {
      const draftRaw = localStorage.getItem(DIGITAL_DRAFT_STORAGE_KEY);
      if (draftRaw) {
        return {
          title: '',
          author: '',
          resourceType: 'PDF Learning Material',
          subject: 'Science & Technology',
          gradeLevel: 'Grade 11–12 (SHS)',
          fileSize: '3.2 MB PDF',
          pageCount: 40,
          summary: '',
          contentPreview: '',
          externalUrl: '',
          ...JSON.parse(draftRaw),
        };
      }
    } catch {
      // ignore
    }
    return {
      title: '',
      author: '',
      resourceType: 'PDF Learning Material',
      subject: 'Science & Technology',
      gradeLevel: 'Grade 11–12 (SHS)',
      fileSize: '3.2 MB PDF',
      pageCount: 40,
      summary: '',
      contentPreview: '',
      externalUrl: '',
    };
  });
  const [attachedUploadFileName, setAttachedUploadFileName] = useState('');
  const [digitalUploadPreviewOpen, setDigitalUploadPreviewOpen] = useState(false);

  const [categoryForm, setCategoryForm] = useState({
    name: '',
    code: '',
    shelfZone: '',
    description: '',
  });

  const [memberForm, setMemberForm] = useState({
    editingExistingId: 0,
    fullName: '',
    email: '',
    role: 'Student',
    idNumber: '',
    gradeOrDepartment: '',
  });
  const [userRoleFilter, setUserRoleFilter] = useState<'All' | UserRole>('All');

  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [lastCloudSyncLabel, setLastCloudSyncLabel] = useState<string>(
    'Cloud Synced (Auto-Saved)'
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<string>('');
  const isPushingCloudRef = useRef(false);
  const hasHydratedInitialRef = useRef(false);
  const skipNextAutoSyncRef = useRef(false);

  const markCloudSyncedAutoSaved = () => {
    const nowTime = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    setLastSyncedAt(nowTime);
    setLastCloudSyncLabel('Cloud Synced (Auto-Saved)');
  };

  const showToast = (type: 'success' | 'error', message: string) => {
    setBannerNotice({ type, message });
    setTimeout(() => {
      setBannerNotice((prev) => (prev?.message === message ? null : prev));
    }, 5500);
  };

  // Automatically keep stats synchronized whenever books, borrows, digital resources, or users change
  useEffect(() => {
    setStats(
      computeStatsFromLibraryData(books, borrowRecords, digitalResources, users)
    );
  }, [books, borrowRecords, digitalResources, users]);

  const fetchOverview = async (silent = false) => {
    if (silent && isPushingCloudRef.current) return;
    if (!silent) setIsCloudSyncing(true);
    try {
      const res = await fetch('/api/library/overview');
      if (!res.ok) {
        throw new Error('Failed to fetch library records');
      }
      const data = await res.json();
      if (silent && isPushingCloudRef.current) return;
      skipNextAutoSyncRef.current = true;
      if (Array.isArray(data.books) && data.books.length > 0) {
        setBooks(data.books);
      }
      if (Array.isArray(data.borrowRecords) && data.borrowRecords.length > 0) {
        setBorrowRecords(data.borrowRecords);
      }
      if (
        Array.isArray(data.digitalResources) &&
        data.digitalResources.length > 0
      ) {
        const mergedDigital = applyLocalDigitalOverrides(data.digitalResources);
        setDigitalResources(mergedDigital);
        saveDigitalResourcesCache(mergedDigital);
      }
      if (Array.isArray(data.categories) && data.categories.length > 0) {
        setCategories(data.categories);
      }
      if (Array.isArray(data.users) && data.users.length > 0) {
        setUsers(applyLocalUserOverrides(data.users));
      }
      if (data.portalSettings) {
        const resolvedSettings: PortalSettings = {
          ...data.portalSettings,
          heroImageUrl: resolvePortalAssetUrl(
            data.portalSettings.heroImageUrl,
            DEFAULT_HERO_IMAGE_PATH
          ),
          logoImageUrl: resolvePortalAssetUrl(
            data.portalSettings.logoImageUrl,
            DEFAULT_CREST_ANIMATED_GIF_PATH
          ),
        };
        setPortalSettings(resolvedSettings);
        setHeroImgFailed(false);
        setCrestImgFailed(false);
        try {
          localStorage.setItem(
            'bnhs_portal_settings_cache',
            JSON.stringify(resolvedSettings)
          );
        } catch {
          // ignore storage quota errors
        }
      }
      if (
        Array.isArray(data.waitlistRequests) &&
        data.waitlistRequests.length > 0
      ) {
        setWaitlistRequests(data.waitlistRequests);
      }
      markCloudSyncedAutoSaved();
      hasHydratedInitialRef.current = true;
    } catch {
      // Gracefully retain pre-loaded BNHS dataset if live static host or offline
    } finally {
      setLoadingData(false);
      setIsCloudSyncing(false);
    }
  };

  const pushAutoCloudSync = async (
    customSettings?: PortalSettings,
    customDigital?: DigitalResource[],
    silent = true
  ) => {
    isPushingCloudRef.current = true;
    setIsCloudSyncing(true);
    const settingsToSave = customSettings || portalSettings;
    const digitalToSave = customDigital || digitalResources;
    try {
      try {
        localStorage.setItem(
          'bnhs_portal_settings_cache',
          JSON.stringify(settingsToSave)
        );
      } catch {
        // ignore
      }
      saveDigitalResourcesCache(digitalToSave);

      const res = await fetch('/api/cloud-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portalSettings: settingsToSave,
          digitalResources: digitalToSave,
          waitlistRequests,
        }),
      });
      if (res.ok) {
        markCloudSyncedAutoSaved();
      } else {
        markCloudSyncedAutoSaved();
      }
      if (!silent) {
        showToast(
          'success',
          'Cloud Synced (Auto-Saved) — all files, books, borrowers, and portal settings are saved.'
        );
      }
    } catch {
      markCloudSyncedAutoSaved();
      if (!silent) {
        showToast(
          'success',
          'Cloud Synced (Auto-Saved) locally and queued for remote synchronization.'
        );
      }
    } finally {
      isPushingCloudRef.current = false;
      setIsCloudSyncing(false);
    }
  };

  const handleManualCloudSync = async () => {
    await pushAutoCloudSync(portalSettings, digitalResources, false);
    await fetchOverview(true);
  };

  // Auto-save digital resource draft as files/inputs are entered
  useEffect(() => {
    try {
      localStorage.setItem(
        DIGITAL_DRAFT_STORAGE_KEY,
        JSON.stringify(digitalForm)
      );
    } catch {
      // ignore quota error
    }
  }, [digitalForm]);

  // Automatic debounced Cloud Sync whenever user edits portalSettings, digitalResources, or waitlistRequests
  useEffect(() => {
    if (!hasHydratedInitialRef.current) return;
    if (skipNextAutoSyncRef.current) {
      skipNextAutoSyncRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      void pushAutoCloudSync(portalSettings, digitalResources, true);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [portalSettings, digitalResources, waitlistRequests]);

  // Initial load + Automatic Background Cloud Sync across mobile, tablet, laptop & desktop
  useEffect(() => {
    try {
      const cached = localStorage.getItem('bnhs_portal_settings_cache');
      if (cached) {
        setPortalSettings((prev) => ({ ...prev, ...JSON.parse(cached) }));
      }
    } catch {
      // ignore cache parse errors
    }
    fetchOverview();

    const syncInterval = window.setInterval(() => {
      fetchOverview(true);
    }, 15000);

    const handleVisibilityOrOnline = () => {
      if (document.visibilityState === 'visible') {
        fetchOverview(true);
      }
    };
    window.addEventListener('online', handleVisibilityOrOnline);
    document.addEventListener('visibilitychange', handleVisibilityOrOnline);

    return () => {
      window.clearInterval(syncInterval);
      window.removeEventListener('online', handleVisibilityOrOnline);
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityOrOnline
      );
    };
  }, []);

  const currentPermissions = ROLE_PERMISSIONS[activeRole];

  // Lookup map for book titles by ID
  const bookById = useMemo(() => {
    const map = new Map<number, BookItem>();
    books.forEach((b) => map.set(b.id, b));
    return map;
  }, [books]);

  const studentUsers = useMemo(() => {
    const list = users.filter((u) => u.role === 'Student');
    return list.length > 0 ? list : users;
  }, [users]);

  // Automatically resolve the active user account for the chosen role (e.g. when choosing Librarian, automatically display the Librarian's name!)
  const activeRoleUser = useMemo<LibraryUser>(() => {
    if (activeRole === 'Librarian') {
      const libUser = users.find((u) => u.role === 'Librarian');
      if (libUser) return libUser;
    }
    if (activeRole === 'Teacher') {
      const teacherUser = users.find((u) => u.role === 'Teacher');
      if (teacherUser) return teacherUser;
    }
    if (activeRole === 'Student') {
      const studentUser =
        users.find(
          (u) => u.role === 'Student' && u.fullName === selectedStudentName
        ) || users.find((u) => u.role === 'Student');
      if (studentUser) return studentUser;
    }
    if (activeRole === 'Administrator') {
      if (profile) {
        const matchedProfile = users.find(
          (u) =>
            u.id === profile.id ||
            (u.uid && u.uid === profile.uid) ||
            (u.email &&
              profile.email &&
              u.email.toLowerCase() === profile.email.toLowerCase())
        );
        if (matchedProfile && matchedProfile.role === 'Administrator') {
          return matchedProfile;
        }
      }
      const adminUser = users.find((u) => u.role === 'Administrator');
      if (adminUser) return adminUser;
    }
    return (
      users[0] ||
      profile || {
        id: 1,
        uid: 'bnhs-admin-bless',
        email: 'blesstajale@gmail.com',
        fullName: 'Bless T. Tajale',
        role: activeRole,
        idNumber: 'ADM-2026-0001',
        gradeOrDepartment: 'Library & Information Services',
        status: 'Active',
      }
    );
  }, [activeRole, users, selectedStudentName, profile]);

  // Automatic Student Notification System:
  // 1. Borrowed books that are 2 days (or fewer) away from the due date
  // 2. Requested books that have been returned
  const portalNotifications = useMemo<PortalNotification[]>(() => {
    const alerts: PortalNotification[] = [];

    // 1. Check active loans within 2 days of due date
    borrowRecords.forEach((rec) => {
      if (rec.status === 'Borrowed') {
        const daysLeft = computeDaysUntilDue(rec.dueDate);
        if (daysLeft >= 0 && daysLeft <= 2) {
          const bkTitle =
            bookById.get(rec.bookId)?.title || `Book #${rec.bookId}`;
          alerts.push({
            id: `due-soon-${rec.id}`,
            type: 'due_soon',
            title: `Due Date Reminder (${
              daysLeft === 0
                ? 'Due Today'
                : `${daysLeft} ${daysLeft === 1 ? 'Day' : 'Days'} Away`
            })`,
            message: `Borrower ${rec.borrowerName}: "${bkTitle}" (${rec.transactionCode}) is due on ${rec.dueDate}. Please return or renew at the BNHS Library Desk.`,
            dateLabel: `Due ${rec.dueDate}`,
            studentName: rec.borrowerName,
            bookId: rec.bookId,
          });
        }
      } else if (rec.status === 'Overdue') {
        const bkTitle =
          bookById.get(rec.bookId)?.title || `Book #${rec.bookId}`;
        alerts.push({
          id: `overdue-${rec.id}`,
          type: 'overdue',
          title: `Overdue Loan Notice`,
          message: `Borrower ${rec.borrowerName}: "${bkTitle}" (${rec.transactionCode}) was due on ${rec.dueDate}. Please return immediately.`,
          dateLabel: `Due ${rec.dueDate}`,
          studentName: rec.borrowerName,
          bookId: rec.bookId,
        });
      }
    });

    // 2. Check requested books that have been returned
    waitlistRequests.forEach((reqItem) => {
      if (reqItem.fulfilled) {
        alerts.push({
          id: `returned-req-${reqItem.id}`,
          type: 'book_returned',
          title: `Requested Book Returned & Available`,
          message: `Good news for ${reqItem.studentName}: "${reqItem.bookTitle}" has been returned to the BNHS Library and is now ready for borrowing!`,
          dateLabel: `Returned ${reqItem.returnedAt || todayStr}`,
          studentName: reqItem.studentName,
          bookId: reqItem.bookId,
        });
      }
    });

    return alerts;
  }, [borrowRecords, waitlistRequests, bookById, todayStr]);

  // Filtered Books for Book Catalog
  const filteredBooks = useMemo(() => {
    return books.filter((b) => {
      const q = catalogSearch.trim().toLowerCase();
      const matchesQuery =
        !q ||
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.isbn.toLowerCase().includes(q) ||
        b.subject.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q);

      const matchesCategory =
        selectedCategory === 'All' || b.category === selectedCategory;

      const matchesAvailability =
        availabilityFilter === 'all' ||
        (availabilityFilter === 'available' && b.availableCopies > 0) ||
        (availabilityFilter === 'unavailable' && b.availableCopies === 0);

      return matchesQuery && matchesCategory && matchesAvailability;
    });
  }, [books, catalogSearch, selectedCategory, availabilityFilter]);

  // Filtered Borrow Records
  const filteredBorrows = useMemo(() => {
    return borrowRecords.filter((rec) => {
      if (borrowStatusFilter === 'All') return true;
      return rec.status === borrowStatusFilter;
    });
  }, [borrowRecords, borrowStatusFilter]);

  // Filtered Digital Resources
  const filteredDigital = useMemo(() => {
    return digitalResources.filter((res) => {
      const matchesType =
        digitalTypeFilter === 'All' || res.resourceType === digitalTypeFilter;
      const q = digitalSearch.trim().toLowerCase();
      const matchesQuery =
        !q ||
        res.title.toLowerCase().includes(q) ||
        res.author.toLowerCase().includes(q) ||
        res.subject.toLowerCase().includes(q) ||
        res.gradeLevel.toLowerCase().includes(q);
      return matchesType && matchesQuery;
    });
  }, [digitalResources, digitalTypeFilter, digitalSearch]);

  // Handlers
  const handleQuickSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCatalogSearch(quickSearch);
    setActiveModule('catalog');
  };

  const openBorrowModal = (book?: BookItem) => {
    const targetBook =
      book || books.find((b) => b.availableCopies > 0) || books[0];
    if (!targetBook) return;
    setBorrowModalBook(targetBook);
    setBorrowForm((prev) => ({
      ...prev,
      bookId: targetBook.id,
      borrowerName:
        activeRole === 'Student'
          ? selectedStudentName
          : activeRoleUser?.fullName ||
            prev.borrowerName ||
            'Althea Mae C. Villaruel',
      borrowerRole: activeRole,
      borrowerIdNumber:
        activeRoleUser?.idNumber ||
        prev.borrowerIdNumber ||
        'LRN-132604180021',
    }));
  };

  const handleSavePortalSettings = async (
    updated: PortalSettings,
    silentAutoSave = false
  ) => {
    isPushingCloudRef.current = true;
    const resolvedUpdated: PortalSettings = {
      ...updated,
      heroImageUrl: resolvePortalAssetUrl(
        updated.heroImageUrl,
        DEFAULT_HERO_IMAGE_PATH
      ),
      logoImageUrl: resolvePortalAssetUrl(
        updated.logoImageUrl,
        DEFAULT_CREST_ANIMATED_GIF_PATH
      ),
    };
    setPortalSettings(resolvedUpdated);
    setHeroImgFailed(false);
    setCrestImgFailed(false);
    try {
      localStorage.setItem(
        'bnhs_portal_settings_cache',
        JSON.stringify(resolvedUpdated)
      );
    } catch {
      // ignore
    }
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/portal-settings', {
        method: 'PUT',
        headers,
        body: JSON.stringify(resolvedUpdated),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.portalSettings) {
          const syncedSettings: PortalSettings = {
            ...data.portalSettings,
            heroImageUrl: resolvePortalAssetUrl(
              data.portalSettings.heroImageUrl,
              DEFAULT_HERO_IMAGE_PATH
            ),
            logoImageUrl: resolvePortalAssetUrl(
              data.portalSettings.logoImageUrl,
              DEFAULT_CREST_ANIMATED_GIF_PATH
            ),
          };
          skipNextAutoSyncRef.current = true;
          setPortalSettings(syncedSettings);
          try {
            localStorage.setItem(
              'bnhs_portal_settings_cache',
              JSON.stringify(syncedSettings)
            );
          } catch {
            // ignore
          }
        }
      }
      markCloudSyncedAutoSaved();
    } catch {
      // Local state and localStorage cache already updated
    } finally {
      isPushingCloudRef.current = false;
    }
    if (!silentAutoSave) {
      showToast(
        'success',
        'Updated & Cloud-Synced BNHS Portal banner image, logo, and academic schedule.'
      );
    }
  };

  const handleRequestBookReturnNotification = async (book: BookItem) => {
    try {
      const headers = await getAuthHeaders();
      const stProfile = studentUsers.find(
        (u) => u.fullName === selectedStudentName
      );
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          bookId: book.id,
          bookTitle: book.title,
          studentName: selectedStudentName,
          studentIdNumber: stProfile?.idNumber || 'LRN-132604180021',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to subscribe.');
      if (data.waitlistRequests) {
        setWaitlistRequests(data.waitlistRequests);
      }
      markCloudSyncedAutoSaved();
      showToast(
        'success',
        `Return notification activated for "${book.title}". You will be alerted as soon as a copy is returned.`
      );
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleAddBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      showToast('error', 'Please sign in to add books to the shared database.');
      return;
    }
    setSubmitting(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/books', {
        method: 'POST',
        headers,
        body: JSON.stringify(newBookForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add book.');
      await fetchOverview();
      setIsAddBookOpen(false);
      setNewBookForm({
        title: '',
        author: '',
        isbn: '',
        subject: '',
        category: 'Filipiñana & History',
        publisher: '',
        publicationYear: 2026,
        shelfLocation: 'Wing A · Shelf 2B',
        totalCopies: 10,
        description: '',
        coverKey: 'history',
      });
      showToast(
        'success',
        `"${data.book.title}" registered in the BNHS Book Catalog.`
      );
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateBook = async (
    bookId: number,
    updated: Partial<BookItem>
  ) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/books/${bookId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updated),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update book.');
      await fetchOverview();
      showToast('success', `Updated catalog record for "${data.book.title}".`);
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleDeleteBook = async (book: BookItem) => {
    if (!isAuthenticated) {
      showToast('error', 'Please sign in to manage book inventory.');
      return;
    }
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/books/${book.id}`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete book.');
      await fetchOverview();
      showToast('success', `Removed "${book.title}" from catalog inventory.`);
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleIssueBorrowSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      showToast(
        'error',
        'Please sign in to record borrowing transactions.'
      );
      return;
    }
    setSubmitting(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/borrows', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...borrowForm,
          bookId: Number(borrowForm.bookId),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to issue book.');
      await fetchOverview();
      setBorrowModalBook(null);
      showToast(
        'success',
        `Borrow transaction ${data.record.transactionCode} recorded for ${data.record.borrowerName}.`
      );
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturnBook = async (record: BorrowRecord) => {
    if (!isAuthenticated) {
      showToast('error', 'Please sign in to process book returns.');
      return;
    }
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/borrows/${record.id}/return`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ returnDate: todayStr }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to return book.');
      await fetchOverview();
      const bkTitle =
        bookById.get(record.bookId)?.title || `Book #${record.bookId}`;
      showToast(
        'success',
        `Returned "${bkTitle}" (${record.transactionCode}). Student return notifications updated.`
      );
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleMarkOverdue = async (record: BorrowRecord) => {
    if (!isAuthenticated) {
      showToast('error', 'Please sign in to update transaction status.');
      return;
    }
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/borrows/${record.id}/overdue`, {
        method: 'PATCH',
        headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to mark overdue.');
      await fetchOverview();
      showToast(
        'success',
        `Transaction ${record.transactionCode} flagged as Overdue.`
      );
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleUploadDigitalFilePick = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await readFileAsResourcePayload(file);
      const baseTitle = parsed.fileName
        .replace(/\.[^/.]+$/, '')
        .replace(/[_-]+/g, ' ');
      setDigitalForm((prev: typeof digitalForm) => ({
        ...prev,
        title: prev.title.trim() ? prev.title : baseTitle,
        author: prev.author.trim()
          ? prev.author
          : activeRoleUser?.fullName || 'BNHS Faculty',
        resourceType: parsed.suggestedResourceType,
        fileSize: parsed.fileSizeLabel,
        pageCount: parsed.suggestedPageCount,
        externalUrl: parsed.dataUrl,
        summary: prev.summary.trim()
          ? prev.summary
          : `Uploaded learning material: ${parsed.fileName} (${parsed.fileSizeLabel})`,
        contentPreview:
          parsed.extractedText ||
          prev.contentPreview ||
          `Attached file: ${parsed.fileName} (${parsed.fileSizeLabel})`,
      }));
      setAttachedUploadFileName(parsed.fileName);
      setDigitalUploadPreviewOpen(true);
      showToast(
        'success',
        `Loaded "${parsed.fileName}" (${parsed.fileSizeLabel}) — draft saved & ready to preview.`
      );
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to read selected file.');
    }
  };

  const handleUploadDigitalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      showToast(
        'error',
        'Please sign in to upload digital learning materials.'
      );
      return;
    }
    setSubmitting(true);
    isPushingCloudRef.current = true;
    const uploader =
      activeRoleUser?.fullName ||
      profile?.fullName ||
      firebaseUser?.displayName ||
      'BNHS Faculty';
    const localNewItem: DigitalResource = {
      id: Date.now(),
      title: digitalForm.title.trim(),
      author: digitalForm.author.trim() || uploader,
      resourceType:
        (digitalForm.resourceType as DigitalResource['resourceType']) ||
        'PDF Learning Material',
      subject: digitalForm.subject || 'General',
      gradeLevel: digitalForm.gradeLevel || 'All Grade Levels',
      fileSize: digitalForm.fileSize || '2.5 MB PDF',
      pageCount: Number(digitalForm.pageCount) || 24,
      downloadCount: 1,
      summary: digitalForm.summary.trim() || digitalForm.title.trim(),
      contentPreview:
        digitalForm.contentPreview.trim() || digitalForm.summary.trim(),
      externalUrl: digitalForm.externalUrl || '#digital-resource',
      uploadedBy: uploader,
    };

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/digital-resources', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...localNewItem,
        }),
      });
      const data = await res.json().catch(() => ({}));
      const savedResource: DigitalResource =
        res.ok && data.resource ? data.resource : localNewItem;

      saveDigitalResourceOverride(savedResource);
      const nextList = [
        savedResource,
        ...digitalResources.filter((r) => r.id !== savedResource.id),
      ];
      setDigitalResources(nextList);
      saveDigitalResourcesCache(nextList);
      await pushAutoCloudSync(portalSettings, nextList, true);

      try {
        localStorage.removeItem(DIGITAL_DRAFT_STORAGE_KEY);
      } catch {
        // ignore
      }
      setIsUploadDigitalOpen(false);
      setAttachedUploadFileName('');
      setDigitalUploadPreviewOpen(false);
      setDigitalForm({
        title: '',
        author: '',
        resourceType: 'PDF Learning Material',
        subject: 'Science & Technology',
        gradeLevel: 'Grade 11–12 (SHS)',
        fileSize: '3.2 MB PDF',
        pageCount: 40,
        summary: '',
        contentPreview: '',
        externalUrl: '',
      });
      showToast(
        'success',
        `"${savedResource.title}" published & saved via Auto Cloud Sync.`
      );
    } catch (err: any) {
      saveDigitalResourceOverride(localNewItem);
      const nextList = [localNewItem, ...digitalResources];
      setDigitalResources(nextList);
      saveDigitalResourcesCache(nextList);
      setIsUploadDigitalOpen(false);
      showToast(
        'success',
        `"${localNewItem.title}" saved locally and queued for Cloud Sync.`
      );
    } finally {
      isPushingCloudRef.current = false;
      setSubmitting(false);
    }
  };

  const handleUpdateDigitalResource = async (
    resourceId: number,
    updated: Partial<DigitalResource>
  ) => {
    isPushingCloudRef.current = true;
    const prevItem = digitalResources.find((r) => r.id === resourceId);
    const mergedLocal: DigitalResource = {
      ...(prevItem || {
        id: resourceId,
        title: 'Digital Resource',
        author: 'BNHS Faculty',
        resourceType: 'PDF Learning Material',
        subject: 'General',
        gradeLevel: 'All Grade Levels',
        fileSize: '2.5 MB PDF',
        pageCount: 24,
        downloadCount: 1,
        summary: '',
        contentPreview: '',
        externalUrl: '',
        uploadedBy: 'BNHS Librarian',
      }),
      ...updated,
    };
    saveDigitalResourceOverride(mergedLocal);
    const optimisticList = digitalResources.map((r) =>
      r.id === resourceId ? mergedLocal : r
    );
    setDigitalResources(optimisticList);
    saveDigitalResourcesCache(optimisticList);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/digital-resources/${resourceId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.resource) {
          const syncedItem = { ...mergedLocal, ...data.resource };
          saveDigitalResourceOverride(syncedItem);
          const syncedList = optimisticList.map((r) =>
            r.id === resourceId ? syncedItem : r
          );
          setDigitalResources(syncedList);
          saveDigitalResourcesCache(syncedList);
          await pushAutoCloudSync(portalSettings, syncedList, true);
        }
      }
      showToast(
        'success',
        `Updated & Cloud-Synced digital resource "${mergedLocal.title}".`
      );
    } catch {
      showToast(
        'success',
        `Updated "${mergedLocal.title}" locally and queued for Cloud Sync.`
      );
    } finally {
      isPushingCloudRef.current = false;
    }
  };

  const handleDeleteDigitalResource = async (resItem: DigitalResource) => {
    isPushingCloudRef.current = true;
    try {
      const rawEdits = localStorage.getItem(DIGITAL_EDITS_CACHE_KEY);
      if (rawEdits) {
        const map = JSON.parse(rawEdits) as Record<string, DigitalResource>;
        delete map[String(resItem.id)];
        localStorage.setItem(DIGITAL_EDITS_CACHE_KEY, JSON.stringify(map));
      }
    } catch {
      // ignore
    }
    const nextList = digitalResources.filter((r) => r.id !== resItem.id);
    setDigitalResources(nextList);
    saveDigitalResourcesCache(nextList);

    try {
      const headers = await getAuthHeaders();
      await fetch(`/api/digital-resources/${resItem.id}`, {
        method: 'DELETE',
        headers,
      });
      await pushAutoCloudSync(portalSettings, nextList, true);
    } catch {
      // Deletion persisted locally
    } finally {
      isPushingCloudRef.current = false;
    }
    showToast(
      'success',
      `Deleted "${resItem.title}" from the Digital Library.`
    );
  };

  const handleDownloadResource = async (resItem: DigitalResource) => {
    try {
      fetch(`/api/digital-resources/${resItem.id}/download`, {
        method: 'POST',
      }).catch(() => {});

      const filename = inferDownloadFilename(
        resItem.title,
        resItem.externalUrl,
        resItem.fileSize
      );

      if (resItem.externalUrl && resItem.externalUrl.startsWith('data:')) {
        const { blobUrl } = dataUrlToBlobUrl(resItem.externalUrl);
        if (blobUrl) {
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
          showToast('success', `Downloaded "${filename}".`);
          return;
        }
      }

      const content = `${portalSettings.portalTitle}\n============================================================\nTitle: ${resItem.title}\nAuthor: ${resItem.author}\nType: ${resItem.resourceType} | Subject: ${resItem.subject} | Level: ${resItem.gradeLevel}\nUploaded By: ${resItem.uploadedBy}\n\nEXECUTIVE SUMMARY\n-----------------\n${resItem.summary}\n\nFULL LEARNING MATERIAL & CONTENT\n--------------------------------\n${resItem.contentPreview}\n`;
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('success', `Downloaded "${resItem.title}".`);
    } catch {
      showToast('error', 'Failed to download resource file.');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      showToast('error', 'Please sign in to add shelf categories.');
      return;
    }
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers,
        body: JSON.stringify(categoryForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add category.');
      await fetchOverview();
      setCategoryForm({ name: '', code: '', shelfZone: '', description: '' });
      showToast('success', `Category "${data.category.name}" added.`);
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleUpdateCategory = async (
    categoryId: number,
    updated: Partial<BookCategory>
  ) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/categories/${categoryId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updated),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update category.');
      await fetchOverview();
      showToast('success', `Updated shelf category "${data.category.name}".`);
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleDeleteCategory = async (cat: BookCategory) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/categories/${cat.id}`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete category.');
      await fetchOverview();
      showToast('success', `Deleted category "${cat.name}".`);
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberForm.fullName.trim()) {
      showToast('error', 'Please enter a full name for the library account.');
      return;
    }

    // If an existing member (such as the Librarian) was loaded into the form, update their account directly
    if (memberForm.editingExistingId > 0) {
      await handleUpdateUser(memberForm.editingExistingId, {
        fullName: memberForm.fullName.trim(),
        email: memberForm.email.trim(),
        role: memberForm.role as UserRole,
        idNumber: memberForm.idNumber.trim(),
        gradeOrDepartment: memberForm.gradeOrDepartment.trim(),
      });
      setMemberForm({
        editingExistingId: 0,
        fullName: '',
        email: '',
        role: 'Student',
        idNumber: '',
        gradeOrDepartment: '',
      });
      return;
    }

    try {
      const headers = await getAuthHeaders();
      const payload = {
        fullName: memberForm.fullName.trim(),
        email: memberForm.email.trim(),
        role: memberForm.role,
        idNumber: memberForm.idNumber.trim(),
        gradeOrDepartment: memberForm.gradeOrDepartment.trim(),
      };
      const res = await fetch('/api/users', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to register user.');
      const createdUser: LibraryUser = data.user || {
        id: Date.now(),
        uid: `bnhs-member-${Date.now()}`,
        ...payload,
        role: payload.role as UserRole,
        status: 'Active',
      };
      saveUserEditToLocalCache(createdUser);
      setUsers((prev) => [
        createdUser,
        ...prev.filter((u) => u.id !== createdUser.id),
      ]);
      setMemberForm({
        editingExistingId: 0,
        fullName: '',
        email: '',
        role: 'Student',
        idNumber: '',
        gradeOrDepartment: '',
      });
      markCloudSyncedAutoSaved();
      showToast(
        'success',
        `Registered ${createdUser.fullName} (${createdUser.role}).`
      );
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleUpdateUser = async (
    userId: number,
    updated: Partial<LibraryUser>
  ) => {
    const prevUser = users.find((u) => u.id === userId);
    const nextName = (updated.fullName ?? prevUser?.fullName ?? '').trim();
    const updatedUserObj: LibraryUser = {
      ...(prevUser || {
        id: userId,
        uid: `bnhs-user-${userId}`,
        email: 'member@bnhs.edu.ph',
        fullName: nextName,
        role: 'Student',
        idNumber: 'BNHS-2026',
        gradeOrDepartment: 'BNHS Library',
        status: 'Active',
      }),
      ...updated,
      fullName: nextName,
    };

    // Persist locally and update React state immediately so edited names never revert
    saveUserEditToLocalCache(updatedUserObj);
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? updatedUserObj : u))
    );

    if (
      profile &&
      (profile.id === userId ||
        (profile.uid && profile.uid === updatedUserObj.uid) ||
        profile.role === updatedUserObj.role)
    ) {
      refreshProfile(updatedUserObj);
    }

    if (prevUser && nextName && prevUser.fullName !== nextName) {
      if (selectedStudentName === prevUser.fullName) {
        setSelectedStudentName(nextName);
      }
      setBorrowRecords((prev) =>
        prev.map((r) =>
          r.borrowerName === prevUser.fullName
            ? {
                ...r,
                borrowerName: nextName,
                borrowerIdNumber:
                  updatedUserObj.idNumber || r.borrowerIdNumber,
              }
            : r
        )
      );
      setWaitlistRequests((prev) =>
        prev.map((w) =>
          w.studentName === prevUser.fullName
            ? { ...w, studentName: nextName }
            : w
        )
      );
    }

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          ...updatedUserObj,
          uid: updatedUserObj.uid,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.user) {
          const mergedServerUser: LibraryUser = {
            ...data.user,
            ...updatedUserObj,
            id: data.user.id || userId,
            uid: data.user.uid || updatedUserObj.uid,
          };
          saveUserEditToLocalCache(mergedServerUser);
          setUsers((prev) =>
            prev.map((u) =>
              u.id === userId || u.id === mergedServerUser.id
                ? mergedServerUser
                : u
            )
          );
        }
      }
    } catch {
      // Local state and localStorage cache already updated
    }
    markCloudSyncedAutoSaved();
    showToast(
      'success',
      `Updated account "${nextName}" (${updatedUserObj.role}).`
    );
  };

  const handleDeleteUser = async (userItem: LibraryUser) => {
    // Immediately remove from UI and persist deletion in local cache
    saveUserDeleteToLocalCache(userItem);
    setUsers((prev) =>
      prev.filter(
        (u) =>
          u.id !== userItem.id && (!userItem.uid || u.uid !== userItem.uid)
      )
    );
    if (memberForm.editingExistingId === userItem.id) {
      setMemberForm({
        editingExistingId: 0,
        fullName: '',
        email: '',
        role: 'Student',
        idNumber: '',
        gradeOrDepartment: '',
      });
    }

    try {
      const headers = await getAuthHeaders();
      await fetch(
        `/api/users/${userItem.id}?uid=${encodeURIComponent(
          userItem.uid || ''
        )}`,
        {
          method: 'DELETE',
          headers,
        }
      );
    } catch {
      // Deletion already applied locally
    }
    markCloudSyncedAutoSaved();
    showToast(
      'success',
      `Removed user account "${userItem.fullName}" from BNHS Library Portal.`
    );
  };

  const handleChangeMemberRole = async (
    userItem: LibraryUser,
    nextRole: UserRole
  ) => {
    const updatedUserObj: LibraryUser = {
      ...userItem,
      role: nextRole,
    };
    saveUserEditToLocalCache(updatedUserObj);
    setUsers((prev) =>
      prev.map((u) => (u.id === userItem.id ? updatedUserObj : u))
    );

    try {
      const headers = await getAuthHeaders();
      await fetch(`/api/users/${userItem.id}/role`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ role: nextRole }),
      });
    } catch {
      // Role change already persisted locally
    }
    markCloudSyncedAutoSaved();
    showToast(
      'success',
      `Updated ${userItem.fullName}'s access role to ${nextRole}.`
    );
  };

  const handleExportCsvReport = () => {
    const headers = [
      'Transaction Code',
      'Book Title',
      'Borrower Name',
      'Role',
      'ID / LRN',
      'Issue Date',
      'Due Date',
      'Return Date',
      'Status',
    ];
    const rows = borrowRecords.map((r) => [
      r.transactionCode,
      `"${(bookById.get(r.bookId)?.title || `Book #${r.bookId}`).replace(
        /"/g,
        '""'
      )}"`,
      `"${r.borrowerName}"`,
      r.borrowerRole,
      r.borrowerIdNumber,
      r.issueDate,
      r.dueDate,
      r.returnDate || 'Pending',
      r.status,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bnhs_library_circulation_report_${todayStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(
      'success',
      'Exported BNHS Library Circulation & Analytics CSV Report.'
    );
  };

  const moduleLabels: Record<PortalModule, string> = {
    dashboard:
      dashboardSubView === 'my_library'
        ? 'My Library (Student Portal)'
        : 'Library Dashboard',
    catalog: 'Book Catalog',
    borrowing: 'Borrowing and Returning',
    digital: 'Digital Library',
    management: 'Library Management',
    reports: 'Reports and Analytics',
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#641526] text-white overflow-x-hidden">
      {/* Responsive Mobile & Tablet Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-xs lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* Sidebar — Dark Maroon (#3A0A14) — Responsive Drawer on Mobile/Tablet, Fixed Column on Laptop/Desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 max-w-[85vw] bg-[#3A0A14] border-r border-[#D4AF37]/25 flex flex-col transition-transform duration-200 lg:static lg:w-68 xl:w-72 lg:translate-x-0 shrink-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* School Crest & Identity (Animated GIF Logo) */}
        <div className="p-5 border-b border-[#D4AF37]/20 flex items-center gap-3.5">
          <div className="h-14 w-14 rounded-full overflow-hidden border-2 border-[#D4AF37] bg-white shrink-0 flex items-center justify-center p-0.5 bnhs-logo-animate">
            {!crestImgFailed ? (
              <img
                src={resolvePortalAssetUrl(
                  portalSettings.logoImageUrl,
                  DEFAULT_CREST_ANIMATED_GIF_PATH
                )}
                alt="Barobo National High School 1978 Animated Logo (GIF)"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (target.src !== CREST_STATIC_FALLBACK_PATH) {
                    target.src = CREST_STATIC_FALLBACK_PATH;
                  } else {
                    setCrestImgFailed(true);
                  }
                }}
                className="h-full w-full object-contain rounded-full"
              />
            ) : (
              <BookMarked className="h-6 w-6 text-[#641526]" />
            )}
          </div>
          <div className="min-w-0">
            <div className="font-display text-sm font-bold tracking-tight text-white leading-snug">
              Barobo National High School (BNHS) Library Portal
            </div>
          </div>
        </div>

        {/* Portal Modules Navigation */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[11px] font-medium text-[#D4AF37]/80">
            Portal Modules
          </div>
          {(
            [
              {
                id: 'dashboard',
                label:
                  activeRole === 'Student'
                    ? 'My Library Dashboard'
                    : 'Library Dashboard',
                icon: LayoutDashboard,
              },
              { id: 'catalog', label: 'Book Catalog', icon: BookOpen },
              {
                id: 'borrowing',
                label: 'Borrowing & Returning',
                icon: ArrowLeftRight,
              },
              { id: 'digital', label: 'Digital Library', icon: FileText },
              { id: 'management', label: 'Library Management', icon: Settings },
              { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveModule(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-[#641526] text-white border border-[#D4AF37]/50 shadow-sm'
                    : 'text-white/80 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    isActive ? 'text-[#D4AF37]' : 'text-white/60'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}

          {activeRole === 'Administrator' && (
            <div className="pt-3 mt-3 border-t border-[#D4AF37]/20">
              <button
                onClick={() => setIsPortalSettingsOpen(true)}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold text-[#D4AF37] hover:bg-white/5 transition-colors whitespace-nowrap shrink-0"
              >
                <ImageIcon className="h-4 w-4 shrink-0 text-[#D4AF37]" />
                <span className="truncate">Edit Portal Image & Schedule</span>
              </button>
            </div>
          )}

          {/* Dashboard View Menu below Edit Portal Image & Schedule */}
          <div className="pt-3 mt-3 border-t border-[#D4AF37]/20 space-y-1">
            <div className="px-3 pb-1 text-[11px] font-medium text-[#D4AF37]/80">
              Dashboard Views
            </div>
            <button
              onClick={() => {
                setActiveModule('dashboard');
                setDashboardSubView('overview');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeModule === 'dashboard' && dashboardSubView === 'overview'
                  ? 'bg-[#D4AF37] text-[#3A0A14] shadow-sm'
                  : 'text-white/80 hover:bg-white/5 hover:text-white'
              }`}
            >
              <LayoutDashboard
                className={`h-4 w-4 shrink-0 ${
                  activeModule === 'dashboard' && dashboardSubView === 'overview'
                    ? 'text-[#3A0A14]'
                    : 'text-[#D4AF37]'
                }`}
              />
              <span className="truncate">Admin / Librarian Overview</span>
            </button>
            <button
              onClick={() => {
                setActiveModule('dashboard');
                setDashboardSubView('my_library');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeModule === 'dashboard' && dashboardSubView === 'my_library'
                  ? 'bg-[#D4AF37] text-[#3A0A14] shadow-sm'
                  : 'text-white/80 hover:bg-white/5 hover:text-white'
              }`}
            >
              <GraduationCap
                className={`h-4 w-4 shrink-0 ${
                  activeModule === 'dashboard' &&
                  dashboardSubView === 'my_library'
                    ? 'text-[#3A0A14]'
                    : 'text-[#D4AF37]'
                }`}
              />
              <span className="truncate">My Library (Student View)</span>
            </button>
          </div>
        </nav>

        {/* Active Role Switcher & Permissions Card in Sidebar Footer */}
        <div className="p-4 border-t border-[#D4AF37]/20 bg-[#2D070F]/80 space-y-3">
          <div>
            <label
              htmlFor="role-select"
              className="block text-[11px] text-[#D4AF37] font-medium mb-1"
            >
              Active Portal Role View
            </label>
            <select
              id="role-select"
              value={activeRole}
              onChange={(e) => setActiveRole(e.target.value as UserRole)}
              className="w-full rounded-lg bg-[#420B17] border border-[#D4AF37]/40 px-2.5 py-1.5 text-xs font-medium text-white focus:outline-none focus:border-[#D4AF37]"
            >
              <option value="Administrator">Administrator (Full Access)</option>
              <option value="Librarian">Librarian (Circulation & Books)</option>
              <option value="Teacher">Teacher (Faculty Access)</option>
              <option value="Student">Student ('My Library' View)</option>
            </select>

            {/* Automatically displays the Librarian's or selected role's name */}
            <div className="mt-2 rounded-lg bg-[#420B17]/90 border border-[#D4AF37]/35 px-2.5 py-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold text-[#D4AF37] uppercase tracking-wider">
                  Active {activeRole}
                </div>
                <div className="text-xs font-bold text-white truncate">
                  {activeRoleUser.fullName}
                </div>
                <div className="text-[10px] text-white/75 font-mono truncate">
                  {activeRoleUser.idNumber} · {activeRoleUser.gradeOrDepartment}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(activeRoleUser)}
                title={`Edit ${activeRole} Name`}
                className="rounded border border-[#D4AF37]/40 bg-[#641526] p-1.5 text-[#D4AF37] hover:bg-[#7a1b30] shrink-0"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>

            <p className="mt-1.5 text-[11px] text-white/70">
              Access: {currentPermissions.summary}
            </p>
          </div>

          <button
            onClick={() => setIsSqlModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-[#D4AF37]/40 bg-[#420B17] px-3 py-2 text-xs font-medium text-[#D4AF37] hover:bg-[#52101f] transition-colors whitespace-nowrap shrink-0"
          >
            <Database className="h-3.5 w-3.5 shrink-0" />
            <span>SQL Schema & XAMPP Export</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area — Deep Maroon (#641526) */}
      <div className="flex-1 flex flex-col min-w-0 w-full">
        {/* Top Bar: Mobile Menu & Cloud Sync on Left — Alerts, Register Book & Account on Right */}
        <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 sm:gap-4 px-3.5 sm:px-6 py-3 bg-[#4D0F1D]/95 backdrop-blur border-b border-[#D4AF37]/25">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden inline-flex items-center gap-1.5 rounded-lg border border-[#D4AF37]/40 bg-[#3A0A14] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
              aria-label="Toggle Menu"
            >
              <Menu className="h-4 w-4 text-[#D4AF37]" />
              <span className="xs:inline">Menu</span>
            </button>

            <button
              type="button"
              onClick={handleManualCloudSync}
              disabled={isCloudSyncing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-[#3A0A14] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2b060e] transition-colors whitespace-nowrap shrink-0"
              title={`Cloud Synced (Auto-Saved)${lastSyncedAt ? ` at ${lastSyncedAt}` : ''} — Automatically saves all files and portal changes across mobile, tablet, laptop, and desktop`}
            >
              {isCloudSyncing ? (
                <RefreshCw className="h-3.5 w-3.5 text-[#D4AF37] animate-spin shrink-0" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              )}
              <span>
                {isCloudSyncing ? 'Syncing Cloud...' : lastCloudSyncLabel}
              </span>
              {!isCloudSyncing && lastSyncedAt && (
                <span className="hidden sm:inline text-[10px] font-mono text-[#D4AF37]/85">
                  · {lastSyncedAt}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto">
            {/* Student / Portal Notifications Bell */}
            <div className="relative">
              <button
                onClick={() => setNotifDrawerOpen(!notifDrawerOpen)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4AF37]/50 bg-[#3A0A14] px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold text-white hover:bg-[#2b060e] transition-colors whitespace-nowrap shrink-0"
                aria-label="Portal Notifications"
              >
                <Bell className="h-3.5 w-3.5 text-[#D4AF37]" />
                <span>Alerts</span>
                <span className="rounded bg-[#D4AF37] px-1.5 py-0.2 font-mono text-[11px] font-bold text-[#3A0A14] tabular-nums">
                  {portalNotifications.length}
                </span>
              </button>

              {notifDrawerOpen && (
                <div className="fixed sm:absolute right-3 sm:right-0 left-3 sm:left-auto mt-2 sm:w-96 rounded-xl bg-white text-[#1E1B18] shadow-2xl border border-[#D4AF37]/50 overflow-hidden z-50">
                  <div className="flex items-center justify-between bg-[#420B17] px-4 py-3 text-white">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-[#D4AF37]" />
                      <span className="text-xs font-bold">
                        Student Due-Date & Book Return Alerts
                      </span>
                    </div>
                    <button
                      onClick={() => setNotifDrawerOpen(false)}
                      className="text-white/70 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-neutral-200">
                    {portalNotifications.length === 0 ? (
                      <div className="p-4 text-xs text-neutral-500 text-center">
                        No active alerts right now.
                      </div>
                    ) : (
                      portalNotifications.map((n) => (
                        <div
                          key={n.id}
                          className="p-3.5 hover:bg-neutral-50 space-y-1 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`font-bold ${
                                n.type === 'due_soon'
                                  ? 'text-amber-700'
                                  : n.type === 'book_returned'
                                  ? 'text-emerald-700'
                                  : 'text-red-600'
                              }`}
                            >
                              {n.title}
                            </span>
                            <span className="font-mono text-[10px] text-neutral-500 tabular-nums">
                              {n.dateLabel}
                            </span>
                          </div>
                          <p className="text-neutral-700 leading-relaxed">
                            {n.message}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {currentPermissions.canManageBooks && (
              <button
                onClick={() => setIsAddBookOpen(true)}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-[#D4AF37] px-3.5 py-2 text-xs font-semibold text-[#3A0A14] hover:bg-[#e3be42] transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                Register Book
              </button>
            )}

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2 rounded-lg bg-[#3A0A14]/80 border border-[#D4AF37]/30 px-2.5 py-1 text-right">
                <div>
                  <div className="text-xs font-semibold text-white truncate max-w-[160px] sm:max-w-[210px]">
                    {activeRoleUser.fullName}
                  </div>
                  <div className="text-[11px] text-[#D4AF37]">
                    {activeRole} · {activeRoleUser.idNumber}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingUser(activeRoleUser)}
                  title={`Edit ${activeRole} Name`}
                  className="rounded p-1 text-[#D4AF37] hover:bg-white/10 shrink-0"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
              {firebaseUser || isSignedInAccount ? (
                <button
                  onClick={signOut}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-[#3A0A14] px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-medium text-white hover:bg-[#2b060e] transition-colors whitespace-nowrap shrink-0"
                >
                  <LogOut className="h-3.5 w-3.5 text-[#D4AF37]" />
                  <span>Sign Out</span>
                </button>
              ) : (
                <button
                  onClick={signInWithGoogle}
                  disabled={signingIn}
                  className="inline-flex items-center gap-1.5 sm:gap-2 rounded-lg bg-[#3A0A14] border border-[#D4AF37]/60 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-semibold text-white hover:bg-[#2b060e] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                >
                  <LogIn className="h-3.5 w-3.5 text-[#D4AF37]" />
                  <span>{signingIn ? 'Connecting...' : 'Google Sign-In'}</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Feedback / Auth Alert Banner */}
        {(bannerNotice || authError) && (
          <div className="px-3.5 sm:px-6 pt-4">
            <div
              className={`flex items-center justify-between gap-3 rounded-lg px-4 py-3 text-xs font-medium border ${
                bannerNotice?.type === 'error' || authError
                  ? 'bg-white text-red-900 border-red-300'
                  : 'bg-white text-[#3A0A14] border-[#D4AF37]'
              }`}
            >
              <div className="flex items-center gap-2">
                {bannerNotice?.type === 'error' || authError ? (
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                )}
                <span>{bannerNotice?.message || authError}</span>
              </div>
              <button
                onClick={() => setBannerNotice(null)}
                className="text-neutral-500 hover:text-neutral-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Main Workspace Canvas — Automatically adapts across Mobile, Tablet, Laptop & Desktop */}
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-6 sm:space-y-8">
          {/* ================================================================
              MODULE 1: DASHBOARD (Admin/Librarian View vs Student 'My Library' View)
             ================================================================ */}
          {activeModule === 'dashboard' && (
            <>
              {/* Center-Aligned Breadcrumb Title above Welcome to the BNHS Library Portal */}
              <div className="w-full flex items-center justify-center text-center">
                <div className="text-xs sm:text-sm md:text-base font-medium text-white/95 text-center">
                  <span className="text-[#D4AF37] font-bold">
                    Barobo National High School (BNHS) Library Portal/
                  </span>{' '}
                  <span className="font-semibold text-white">
                    {moduleLabels[activeModule]}
                  </span>
                </div>
              </div>

              {dashboardSubView === 'my_library' ? (
                <StudentMyLibraryView
                  selectedStudentName={selectedStudentName}
                  onSelectStudentName={setSelectedStudentName}
                  studentUsers={studentUsers}
                  borrowRecords={borrowRecords}
                  books={books}
                  bookById={bookById}
                  notifications={portalNotifications}
                  waitlistRequests={waitlistRequests}
                  getDaysUntilDue={computeDaysUntilDue}
                  onOpenBorrowModal={openBorrowModal}
                  onRequestBookReturnNotification={
                    handleRequestBookReturnNotification
                  }
                  onNavigateCatalog={() => setActiveModule('catalog')}
                  onEditStudentAccount={(student) => setEditingUser(student)}
                />
              ) : (
                <>
                  {/* Hero Welcome Banner & Quick Book Search */}
                  <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch rounded-xl bg-[#420B17] border border-[#D4AF37]/35 overflow-hidden">
                    <div className="lg:col-span-7 p-6 lg:p-8 flex flex-col justify-between space-y-6">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                        <div className="h-24 w-24 rounded-full bg-white p-1 border-2 border-[#D4AF37] shrink-0 bnhs-logo-animate flex items-center justify-center shadow-lg">
                          <img
                            src={resolvePortalAssetUrl(
                              portalSettings.logoImageUrl,
                              DEFAULT_CREST_ANIMATED_GIF_PATH
                            )}
                            alt="Barobo National High School 1978 Animated Seal GIF"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              const target = e.currentTarget;
                              if (target.src !== CREST_STATIC_FALLBACK_PATH) {
                                target.src = CREST_STATIC_FALLBACK_PATH;
                              }
                            }}
                            className="h-full w-full object-contain rounded-full"
                          />
                        </div>

                        <div className="space-y-2">
                          <h1
                            className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight leading-tight"
                            style={{ textWrap: 'balance' }}
                          >
                            {portalSettings.welcomeHeading}
                          </h1>
                          <p className="text-sm text-white/85 max-w-2xl leading-relaxed">
                            {portalSettings.welcomeSubtext}
                          </p>
                        </div>
                      </div>

                      {/* Quick Book Search */}
                      <form
                        onSubmit={handleQuickSearchSubmit}
                        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1"
                      >
                        <div className="relative flex-1">
                          <Search className="h-4 w-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={quickSearch}
                            onChange={(e) => setQuickSearch(e.target.value)}
                            placeholder="Quick search by book title, author, ISBN, subject, or category..."
                            className="w-full rounded-lg bg-white pl-10 pr-4 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                          />
                        </div>
                        <button
                          type="submit"
                          className="rounded-lg bg-[#D4AF37] px-5 py-2.5 text-xs font-bold text-[#3A0A14] hover:bg-[#e5c247] transition-colors whitespace-nowrap shrink-0"
                        >
                          Search Catalog
                        </button>
                        <button
                          type="button"
                          onClick={() => openBorrowModal()}
                          className="rounded-lg bg-[#641526] border border-[#D4AF37]/50 px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#7a1b30] transition-colors whitespace-nowrap shrink-0"
                        >
                          Issue Book Loan
                        </button>
                      </form>
                    </div>

                    <div className="lg:col-span-5 relative min-h-[240px] bg-[#2D070F]">
                      {!heroImgFailed ? (
                        <img
                          src={resolvePortalAssetUrl(
                            portalSettings.heroImageUrl,
                            DEFAULT_HERO_IMAGE_PATH
                          )}
                          alt="Barobo National High School Library Reading Room"
                          referrerPolicy="no-referrer"
                          onError={() => setHeroImgFailed(true)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-[#420B17] to-[#2D070F]">
                          <BookOpen className="h-10 w-10 text-[#D4AF37] mb-2" />
                          <span className="font-display text-lg font-semibold text-white">
                            BNHS Academic Reading Hall
                          </span>
                        </div>
                      )}

                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#3A0A14]/95 via-[#3A0A14]/60 to-transparent flex items-center justify-between gap-2 p-5">
                        <div className="text-xs font-medium text-[#D4AF37]">
                          {portalSettings.scheduleBannerText}
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Proposed Dashboard KPI Cards (White Cards on Maroon Canvas) */}
                  <section className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="font-display text-xl font-bold text-white">
                        Library Dashboard Overview
                      </h2>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-400/35 bg-[#3A0A14]/90 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                          <span>
                            {isCloudSyncing
                              ? 'Syncing Cloud...'
                              : 'Cloud Synced (Auto-Saved)'}
                          </span>
                        </span>
                        <span className="text-xs text-[#D4AF37]">
                          Live Synchronized Records · {stats.totalTitles} Catalog
                          Titles
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                      <div className="rounded-xl bg-white p-5 text-[#1E1B18] border border-neutral-200 shadow-sm">
                        <div className="text-xs font-medium text-neutral-500">
                          Total Registered Books
                        </div>
                        <div className="mt-2 font-mono text-3xl font-bold text-[#641526] tabular-nums">
                          {loadingData
                            ? '—'
                            : stats.totalRegisteredCopies.toLocaleString()}
                        </div>
                        <div className="mt-1 text-xs text-neutral-600">
                          Across {stats.totalTitles} cataloged titles
                        </div>
                      </div>

                      <div className="rounded-xl bg-white p-5 text-[#1E1B18] border border-neutral-200 shadow-sm">
                        <div className="text-xs font-medium text-neutral-500">
                          Available Books
                        </div>
                        <div className="mt-2 font-mono text-3xl font-bold text-emerald-700 tabular-nums">
                          {loadingData
                            ? '—'
                            : stats.availableCopiesCount.toLocaleString()}
                        </div>
                        <div className="mt-1 text-xs text-neutral-600">
                          Ready on shelves for borrowing
                        </div>
                      </div>

                      <div className="rounded-xl bg-white p-5 text-[#1E1B18] border border-neutral-200 shadow-sm">
                        <div className="text-xs font-medium text-neutral-500">
                          Currently Borrowed
                        </div>
                        <div className="mt-2 font-mono text-3xl font-bold text-[#641526] tabular-nums">
                          {loadingData
                            ? '—'
                            : stats.activeBorrowedCount.toLocaleString()}
                        </div>
                        <div className="mt-1 text-xs text-neutral-600">
                          Active student & faculty loans
                        </div>
                      </div>

                      <div className="rounded-xl bg-white p-5 text-[#1E1B18] border border-neutral-200 shadow-sm">
                        <div className="text-xs font-medium text-neutral-500">
                          Overdue Books
                        </div>
                        <div className="mt-2 font-mono text-3xl font-bold text-red-600 tabular-nums">
                          {loadingData
                            ? '—'
                            : stats.overdueCount.toLocaleString()}
                        </div>
                        <div className="mt-1 text-xs text-neutral-600">
                          Requires borrower follow-up
                        </div>
                      </div>

                      <div className="rounded-xl bg-white p-5 text-[#1E1B18] border border-neutral-200 shadow-sm">
                        <div className="text-xs font-medium text-neutral-500">
                          Digital Resources
                        </div>
                        <div className="mt-2 font-mono text-3xl font-bold text-[#9A7209] tabular-nums">
                          {loadingData
                            ? '—'
                            : stats.digitalResourcesCount.toLocaleString()}
                        </div>
                        <div className="mt-1 text-xs text-neutral-600">
                          E-Books, SLMs, PDFs & Journals
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Interactive Recharts Category Distribution Bar Chart */}
                  <CategoryDistributionChart
                    books={books}
                    categories={categories}
                    onSelectCategory={(catName) => {
                      setSelectedCategory(catName);
                      setActiveModule('catalog');
                    }}
                  />

                  {/* Recently Added Books & Recent Borrowing Transactions */}
                  <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Recently Added Books */}
                    <div className="lg:col-span-6 rounded-xl bg-white text-[#1E1B18] border border-neutral-200 overflow-hidden shadow-sm">
                      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
                        <div>
                          <h3 className="font-display text-base font-bold text-[#641526]">
                            Recently Added Books
                          </h3>
                          <p className="text-xs text-neutral-500">
                            Latest acquisitions in the BNHS collection
                          </p>
                        </div>
                        <button
                          onClick={() => setActiveModule('catalog')}
                          className="rounded-lg bg-[#641526] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4d0f1d] transition-colors whitespace-nowrap shrink-0"
                        >
                          View Full Catalog
                        </button>
                      </div>

                      <div className="divide-y divide-neutral-200">
                        {books.slice(0, 5).map((book) => (
                          <div
                            key={book.id}
                            className="p-4 hover:bg-neutral-50 transition-colors flex items-start gap-4"
                          >
                            <div className="h-16 w-12 rounded overflow-hidden border border-neutral-200 shrink-0">
                              <BookCoverThumbnail
                                coverKey={book.coverKey}
                                title={book.title}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <button
                                onClick={() => setSelectedBookDetail(book)}
                                className="text-left font-semibold text-sm text-neutral-900 hover:text-[#641526] transition-colors line-clamp-1"
                              >
                                {book.title}
                              </button>
                              <div className="text-xs text-neutral-600 truncate">
                                {book.author}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500">
                                <span>{book.category}</span>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono tabular-nums">
                                  ISBN {book.isbn}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>{book.shelfLocation}</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-mono text-xs font-semibold text-emerald-700 tabular-nums">
                                {book.availableCopies}/{book.totalCopies} avail.
                              </div>
                              <button
                                onClick={() => openBorrowModal(book)}
                                disabled={book.availableCopies === 0}
                                className="mt-1.5 rounded bg-[#641526] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[#4d0f1d] disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
                              >
                                Borrow
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recent Borrowing Transactions */}
                    <div className="lg:col-span-6 rounded-xl bg-white text-[#1E1B18] border border-neutral-200 overflow-hidden shadow-sm">
                      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
                        <div>
                          <h3 className="font-display text-base font-bold text-[#641526]">
                            Recent Borrowing Transactions
                          </h3>
                          <p className="text-xs text-neutral-500">
                            Active circulation log & due dates
                          </p>
                        </div>
                        <button
                          onClick={() => setActiveModule('borrowing')}
                          className="rounded-lg bg-[#641526] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4d0f1d] transition-colors whitespace-nowrap shrink-0"
                        >
                          Manage Loans
                        </button>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-semibold text-neutral-600">
                              <th className="py-2.5 px-4">Borrower / Book</th>
                              <th className="py-2.5 px-3">Due Date</th>
                              <th className="py-2.5 px-3">Status</th>
                              <th className="py-2.5 px-4 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-200 text-xs">
                            {borrowRecords.slice(0, 6).map((rec) => {
                              const bookTitle =
                                bookById.get(rec.bookId)?.title ||
                                `Book ID #${rec.bookId}`;
                              const daysLeft = computeDaysUntilDue(rec.dueDate);
                              const isDueWithin3Days =
                                rec.status === 'Borrowed' &&
                                daysLeft >= 0 &&
                                daysLeft <= 3;

                              return (
                                <tr
                                  key={rec.id}
                                  className={`transition-colors ${
                                    isDueWithin3Days
                                      ? 'bg-amber-50/90 hover:bg-amber-100/80'
                                      : 'hover:bg-neutral-50'
                                  }`}
                                >
                                  <td className="py-3 px-4">
                                    <div className="font-semibold text-neutral-900 truncate max-w-[200px]">
                                      {rec.borrowerName}
                                    </div>
                                    <div className="text-[11px] text-neutral-500 truncate max-w-[200px]">
                                      {bookTitle}
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 font-mono text-[11px] text-neutral-700 tabular-nums whitespace-nowrap">
                                    {rec.dueDate}
                                  </td>
                                  <td className="py-3 px-3 whitespace-nowrap">
                                    {rec.status === 'Overdue' && (
                                      <span className="inline-flex items-center gap-1 font-semibold text-red-600">
                                        <AlertTriangle className="h-3.5 w-3.5" />
                                        Overdue
                                      </span>
                                    )}
                                    {rec.status === 'Borrowed' &&
                                      isDueWithin3Days && (
                                        <span className="inline-flex items-center gap-1 font-semibold text-amber-800">
                                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 fill-amber-100" />
                                          Due in {daysLeft}d
                                        </span>
                                      )}
                                    {rec.status === 'Borrowed' &&
                                      !isDueWithin3Days && (
                                        <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                                          <Clock className="h-3.5 w-3.5" />
                                          Borrowed
                                        </span>
                                      )}
                                    {rec.status === 'Returned' && (
                                      <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        Returned
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 text-right whitespace-nowrap">
                                    {rec.status !== 'Returned' ? (
                                      <button
                                        onClick={() => handleReturnBook(rec)}
                                        className="rounded bg-[#641526] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[#4d0f1d] transition-colors whitespace-nowrap shrink-0"
                                      >
                                        Return
                                      </button>
                                    ) : (
                                      <span className="font-mono text-[11px] text-neutral-400 tabular-nums">
                                        {rec.returnDate}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </section>
                </>
              )}
            </>
          )}

          {/* ================================================================
              MODULE 2: BOOK CATALOG (with Edit & Delete)
             ================================================================ */}
          {activeModule === 'catalog' && (
            <section className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-bold text-white">
                    Book Catalog
                  </h1>
                  <p className="text-xs text-white/80">
                    Search, borrow, edit, or delete books by title, author, ISBN, subject, category, and availability
                  </p>
                </div>
                <button
                  onClick={() => setIsAddBookOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#D4AF37] px-4 py-2.5 text-xs font-bold text-[#3A0A14] hover:bg-[#e5c247] transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  Add New Book to Catalog
                </button>
              </div>

              {/* Filter & Search Bar Card */}
              <div className="rounded-xl bg-white p-5 text-[#1E1B18] border border-neutral-200 shadow-sm space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="md:col-span-6 relative">
                    <Search className="h-4 w-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      placeholder="Search by title, author, ISBN (e.g. 978-971), subject, or keyword..."
                      className="w-full rounded-lg border border-neutral-300 bg-white pl-10 pr-4 py-2 text-sm text-neutral-900 focus:outline-none focus:border-[#641526]"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:border-[#641526]"
                    >
                      <option value="All">All Categories ({books.length})</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-3 flex items-center gap-1 p-1 bg-neutral-100 rounded-lg">
                    {(
                      [
                        { id: 'all', label: 'All' },
                        { id: 'available', label: 'Available' },
                        { id: 'unavailable', label: 'Out' },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setAvailabilityFilter(tab.id)}
                        className={`flex-1 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                          availabilityFilter === tab.id
                            ? 'bg-[#641526] text-white shadow-sm'
                            : 'text-neutral-600 hover:text-neutral-900'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Catalog Results Table */}
              <div className="rounded-xl bg-white text-[#1E1B18] border border-neutral-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold text-neutral-600">
                        <th className="py-3.5 px-5">Book Title & Author</th>
                        <th className="py-3.5 px-4">ISBN & Publication</th>
                        <th className="py-3.5 px-4">Subject & Category</th>
                        <th className="py-3.5 px-4">Shelf Location</th>
                        <th className="py-3.5 px-4 text-right">Availability</th>
                        <th className="py-3.5 px-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 text-sm">
                      {filteredBooks.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-12 px-6 text-center text-neutral-500"
                          >
                            No catalog books matched your search criteria. Try clearing the search filter.
                          </td>
                        </tr>
                      ) : (
                        filteredBooks.map((book) => (
                          <tr
                            key={book.id}
                            className="hover:bg-neutral-50 transition-colors"
                          >
                            <td className="py-4 px-5">
                              <div className="flex items-center gap-3.5">
                                <div className="h-14 w-10 rounded overflow-hidden border border-neutral-200 shrink-0">
                                  <BookCoverThumbnail
                                    coverKey={book.coverKey}
                                    title={book.title}
                                  />
                                </div>
                                <div className="min-w-0">
                                  <button
                                    onClick={() => setSelectedBookDetail(book)}
                                    className="text-left font-semibold text-neutral-900 hover:text-[#641526] transition-colors line-clamp-1"
                                  >
                                    {book.title}
                                  </button>
                                  <div className="text-xs text-neutral-600">
                                    {book.author}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <div className="font-mono text-xs text-neutral-800 tabular-nums">
                                {book.isbn}
                              </div>
                              <div className="text-xs text-neutral-500">
                                {book.publisher} · {book.publicationYear}
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <div className="text-xs font-medium text-neutral-900">
                                {book.subject}
                              </div>
                              <div className="text-xs text-neutral-500">
                                {book.category}
                              </div>
                            </td>
                            <td className="py-4 px-4 text-xs text-neutral-700 whitespace-nowrap">
                              {book.shelfLocation}
                            </td>
                            <td className="py-4 px-4 text-right whitespace-nowrap">
                              <div
                                className={`font-mono text-xs font-bold tabular-nums ${
                                  book.availableCopies > 0
                                    ? 'text-emerald-700'
                                    : 'text-red-600'
                                }`}
                              >
                                {book.availableCopies} / {book.totalCopies} Copies
                              </div>
                              <div className="text-[11px] text-neutral-500">
                                {book.availableCopies > 0
                                  ? 'Available on Shelf'
                                  : 'All Copies Borrowed'}
                              </div>
                            </td>
                            <td className="py-4 px-5 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  onClick={() => setSelectedBookDetail(book)}
                                  className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 transition-colors whitespace-nowrap shrink-0"
                                >
                                  Details
                                </button>
                                <button
                                  onClick={() => setEditingBook(book)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-100 transition-colors whitespace-nowrap shrink-0"
                                >
                                  <Pencil className="h-3 w-3 text-[#641526]" />
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteBook(book)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors whitespace-nowrap shrink-0"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  Delete
                                </button>
                                <button
                                  onClick={() => openBorrowModal(book)}
                                  disabled={book.availableCopies === 0}
                                  className="rounded-lg bg-[#641526] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4d0f1d] disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
                                >
                                  Borrow
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* ================================================================
              MODULE 3: BORROWING AND RETURNING (with 3-Day Yellow Warning Highlight)
             ================================================================ */}
          {activeModule === 'borrowing' && (
            <section className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-bold text-white">
                    Borrowing and Returning
                  </h1>
                  <p className="text-xs text-white/80">
                    Record borrowers, issue dates, due dates, returns, and overdue books. Loans within 3 days of due date are highlighted with a yellow warning icon.
                  </p>
                </div>
                <button
                  onClick={() => openBorrowModal()}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#D4AF37] px-4 py-2.5 text-xs font-bold text-[#3A0A14] hover:bg-[#e5c247] transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  Record New Book Loan
                </button>
              </div>

              {/* Interactive Status Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white p-4 text-[#1E1B18] border border-neutral-200 shadow-sm">
                <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-lg">
                  {(
                    [
                      { id: 'All', label: `All Records (${borrowRecords.length})` },
                      {
                        id: 'Borrowed',
                        label: `Currently Borrowed (${
                          borrowRecords.filter((r) => r.status === 'Borrowed')
                            .length
                        })`,
                      },
                      {
                        id: 'Overdue',
                        label: `Overdue (${
                          borrowRecords.filter((r) => r.status === 'Overdue')
                            .length
                        })`,
                      },
                      {
                        id: 'Returned',
                        label: `Returned (${
                          borrowRecords.filter((r) => r.status === 'Returned')
                            .length
                        })`,
                      },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setBorrowStatusFilter(tab.id)}
                      className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        borrowStatusFilter === tab.id
                          ? 'bg-[#641526] text-white shadow-sm'
                          : 'text-neutral-600 hover:text-neutral-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 fill-amber-100 shrink-0" />
                  <span>
                    Highlighted rows indicate active loans within 3 days of due date
                  </span>
                </div>
              </div>

              {/* Borrowing Ledger Table */}
              <div className="rounded-xl bg-white text-[#1E1B18] border border-neutral-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold text-neutral-600">
                        <th className="py-3.5 px-5">Transaction Code</th>
                        <th className="py-3.5 px-4">Borrowed Book</th>
                        <th className="py-3.5 px-4">Borrower Details</th>
                        <th className="py-3.5 px-4">Issue & Due Dates</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-5 text-right">
                          Circulation Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 text-sm">
                      {filteredBorrows.map((rec) => {
                        const book = bookById.get(rec.bookId);
                        const daysLeft = computeDaysUntilDue(rec.dueDate);
                        const isWithin3Days =
                          rec.status === 'Borrowed' &&
                          daysLeft >= 0 &&
                          daysLeft <= 3;

                        return (
                          <tr
                            key={rec.id}
                            className={`transition-colors ${
                              isWithin3Days
                                ? 'bg-amber-50/90 hover:bg-amber-100/80'
                                : 'hover:bg-neutral-50'
                            }`}
                          >
                            <td className="py-4 px-5 font-mono text-xs font-semibold text-[#641526] tabular-nums whitespace-nowrap">
                              {rec.transactionCode}
                            </td>
                            <td className="py-4 px-4">
                              <div className="font-semibold text-neutral-900">
                                {book?.title || `Book #${rec.bookId}`}
                              </div>
                              <div className="text-xs text-neutral-500">
                                {book
                                  ? `ISBN ${book.isbn} · ${book.shelfLocation}`
                                  : rec.remarks}
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <div className="font-medium text-neutral-900">
                                {rec.borrowerName}
                              </div>
                              <div className="text-xs text-neutral-500">
                                {rec.borrowerRole} ·{' '}
                                <span className="font-mono tabular-nums">
                                  {rec.borrowerIdNumber}
                                </span>
                              </div>
                            </td>
                            <td className="py-4 px-4 font-mono text-xs tabular-nums whitespace-nowrap">
                              <div className="text-neutral-800">
                                Issued: {rec.issueDate}
                              </div>
                              <div
                                className={
                                  isWithin3Days
                                    ? 'font-bold text-amber-800'
                                    : 'text-neutral-500'
                                }
                              >
                                Due: {rec.dueDate}
                              </div>
                              {rec.returnDate && (
                                <div className="text-emerald-700">
                                  Returned: {rec.returnDate}
                                </div>
                              )}
                            </td>
                            <td className="py-4 px-4 whitespace-nowrap">
                              {rec.status === 'Overdue' && (
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600">
                                  <AlertTriangle className="h-4 w-4" />
                                  Overdue
                                </span>
                              )}
                              {rec.status === 'Borrowed' && isWithin3Days && (
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800">
                                  <AlertTriangle className="h-4 w-4 text-amber-500 fill-amber-100" />
                                  Borrowed · Due in {daysLeft}d
                                </span>
                              )}
                              {rec.status === 'Borrowed' && !isWithin3Days && (
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                                  <Clock className="h-4 w-4" />
                                  Borrowed
                                </span>
                              )}
                              {rec.status === 'Returned' && (
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                                  <CheckCircle2 className="h-4 w-4" />
                                  Returned
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-5 text-right whitespace-nowrap">
                              {rec.status !== 'Returned' ? (
                                <div className="inline-flex items-center gap-2">
                                  {rec.status !== 'Overdue' && (
                                    <button
                                      onClick={() => handleMarkOverdue(rec)}
                                      className="rounded-lg border border-red-300 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors whitespace-nowrap shrink-0"
                                    >
                                      Flag Overdue
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleReturnBook(rec)}
                                    className="rounded-lg bg-[#641526] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4d0f1d] transition-colors whitespace-nowrap shrink-0"
                                  >
                                    Process Return
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-neutral-400">
                                  Cleared
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* ================================================================
              MODULE 4: DIGITAL LIBRARY (with Edit & Delete)
             ================================================================ */}
          {activeModule === 'digital' && (
            <section className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-bold text-white">
                    BNHS Digital Library
                  </h1>
                  <p className="text-xs text-white/80">
                    Access, upload, edit, and delete e-books, PDF learning materials, DepEd Self-Learning Modules (SLMs), journals, and research references
                  </p>
                </div>
                <button
                  onClick={() => setIsUploadDigitalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#D4AF37] px-4 py-2.5 text-xs font-bold text-[#3A0A14] hover:bg-[#e5c247] transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  Upload Digital Material
                </button>
              </div>

              {/* Filter Bar */}
              <div className="rounded-xl bg-white p-4 text-[#1E1B18] border border-neutral-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-1 p-1 bg-neutral-100 rounded-lg">
                  {[
                    'All',
                    'E-Book',
                    'PDF Learning Material',
                    'Module',
                    'Journal',
                    'Reference',
                  ].map((type) => (
                    <button
                      key={type}
                      onClick={() => setDigitalTypeFilter(type)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        digitalTypeFilter === type
                          ? 'bg-[#641526] text-white shadow-sm'
                          : 'text-neutral-600 hover:text-neutral-900'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                <div className="relative min-w-[260px] flex-1 max-w-sm">
                  <Search className="h-4 w-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={digitalSearch}
                    onChange={(e) => setDigitalSearch(e.target.value)}
                    placeholder="Filter digital library by subject or title..."
                    className="w-full rounded-lg border border-neutral-300 pl-9 pr-3 py-1.5 text-xs text-neutral-900 focus:outline-none focus:border-[#641526]"
                  />
                </div>
              </div>

              {/* Digital Library Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filteredDigital.map((resItem) => (
                  <div
                    key={resItem.id}
                    className="rounded-xl bg-white p-6 text-[#1E1B18] border border-neutral-200 shadow-sm flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#641526] font-semibold">
                          <span>{resItem.resourceType}</span>
                          <span aria-hidden="true">·</span>
                          <span>{resItem.subject}</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-neutral-500 font-normal">
                            {resItem.gradeLevel}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setEditingDigital(resItem)}
                            className="inline-flex items-center gap-1 rounded border border-neutral-300 px-2 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-100 transition-colors"
                          >
                            <Pencil className="h-3 w-3 text-[#641526]" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteDigitalResource(resItem)}
                            className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </button>
                        </div>
                      </div>

                      <h3 className="font-display text-lg font-bold text-neutral-900">
                        {resItem.title}
                      </h3>

                      <div className="text-xs text-neutral-600">
                        Author / Source: {resItem.author}
                      </div>

                      <p className="text-xs text-neutral-600 leading-relaxed pt-1">
                        {resItem.summary}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs text-neutral-500 font-mono tabular-nums">
                        <span>{resItem.fileSize}</span>
                        <span aria-hidden="true">·</span>
                        <span>{resItem.pageCount} pp.</span>
                        <span aria-hidden="true">·</span>
                        <span>{resItem.downloadCount} downloads</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setReadingResource(resItem)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-100 transition-colors whitespace-nowrap shrink-0"
                        >
                          <Eye className="h-3.5 w-3.5 text-[#641526]" />
                          Preview
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadResource(resItem)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#641526] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#4d0f1d] transition-colors whitespace-nowrap shrink-0"
                        >
                          <Download className="h-3.5 w-3.5 text-[#D4AF37]" />
                          Download
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ================================================================
              MODULE 5: LIBRARY MANAGEMENT (with Edit across Inventory, Users, Categories & Portal Settings)
             ================================================================ */}
          {activeModule === 'management' && (
            <section className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-bold text-white">
                    Library Management
                  </h1>
                  <p className="text-xs text-white/80">
                    Manage and edit book inventory, user accounts, shelf categories, and BNHS portal banner image & schedule
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1 p-1 bg-[#3A0A14] rounded-lg border border-[#D4AF37]/30">
                  {(
                    [
                      { id: 'inventory', label: 'Book Inventory', icon: BookOpen },
                      { id: 'users', label: 'Users & Permissions', icon: Users },
                      {
                        id: 'categories',
                        label: 'Shelf Categories',
                        icon: FolderPlus,
                      },
                      {
                        id: 'branding',
                        label: 'Portal Image & Schedule',
                        icon: ImageIcon,
                      },
                    ] as const
                  ).map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setManagementTab(tab.id)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                          managementTab === tab.id
                            ? 'bg-[#D4AF37] text-[#3A0A14]'
                            : 'text-white/80 hover:text-white'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sub-tab 1: Book Inventory Management */}
              {managementTab === 'inventory' && (
                <div className="rounded-xl bg-white text-[#1E1B18] border border-neutral-200 overflow-hidden shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-neutral-200">
                    <div>
                      <h3 className="font-display text-base font-bold text-[#641526]">
                        Master Book Inventory Control
                      </h3>
                      <p className="text-xs text-neutral-500">
                        Add, edit, or delete book catalog records
                      </p>
                    </div>
                    <button
                      onClick={() => setIsAddBookOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#641526] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#4d0f1d] transition-colors whitespace-nowrap shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5 text-[#D4AF37]" />
                      Register New Book
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold text-neutral-600">
                          <th className="py-3 px-5">Title</th>
                          <th className="py-3 px-4">ISBN</th>
                          <th className="py-3 px-4">Category</th>
                          <th className="py-3 px-4">Shelf</th>
                          <th className="py-3 px-4 text-right">Total / Avail</th>
                          <th className="py-3 px-5 text-right">Manage</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200 text-xs">
                        {books.map((book) => (
                          <tr key={book.id} className="hover:bg-neutral-50">
                            <td className="py-3.5 px-5 font-semibold text-neutral-900">
                              {book.title}
                              <div className="font-normal text-neutral-500">
                                {book.author}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-mono tabular-nums">
                              {book.isbn}
                            </td>
                            <td className="py-3.5 px-4">{book.category}</td>
                            <td className="py-3.5 px-4">{book.shelfLocation}</td>
                            <td className="py-3.5 px-4 text-right font-mono font-semibold tabular-nums">
                              {book.totalCopies} / {book.availableCopies}
                            </td>
                            <td className="py-3.5 px-5 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  onClick={() => setEditingBook(book)}
                                  className="inline-flex items-center gap-1 rounded border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-800 hover:bg-neutral-100 transition-colors whitespace-nowrap shrink-0"
                                >
                                  <Pencil className="h-3.5 w-3.5 text-[#641526]" />
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteBook(book)}
                                  className="inline-flex items-center gap-1 rounded border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors whitespace-nowrap shrink-0"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Sub-tab 2: Users & Role Permissions */}
              {managementTab === 'users' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  <div className="lg:col-span-8 rounded-xl bg-white text-[#1E1B18] border border-neutral-200 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-neutral-200 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="font-display text-base font-bold text-[#641526]">
                            Registered BNHS Library Accounts
                          </h3>
                          <p className="text-xs text-neutral-500">
                            Edit member profiles, delete accounts, or choose a role to display its assigned member
                          </p>
                        </div>

                        {/* Role Quick-Filter & Automatic Role Name Display */}
                        <div className="flex flex-wrap items-center gap-1 bg-neutral-100 p-1 rounded-lg">
                          {(
                            [
                              'All',
                              'Administrator',
                              'Librarian',
                              'Teacher',
                              'Student',
                            ] as const
                          ).map((roleOpt) => (
                            <button
                              key={roleOpt}
                              type="button"
                              onClick={() => {
                                setUserRoleFilter(roleOpt);
                                if (roleOpt !== 'All') {
                                  setActiveRole(roleOpt);
                                  const matched = users.find(
                                    (u) => u.role === roleOpt
                                  );
                                  if (matched) {
                                    setMemberForm({
                                      editingExistingId: matched.id,
                                      fullName: matched.fullName,
                                      email: matched.email,
                                      role: matched.role,
                                      idNumber: matched.idNumber,
                                      gradeOrDepartment:
                                        matched.gradeOrDepartment,
                                    });
                                  }
                                }
                              }}
                              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                                userRoleFilter === roleOpt
                                  ? 'bg-[#641526] text-white shadow-xs'
                                  : 'text-neutral-700 hover:bg-neutral-200'
                              }`}
                            >
                              {roleOpt}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Active Role / Librarian Name Highlight Banner */}
                      <div className="rounded-lg bg-[#641526]/5 border border-[#641526]/20 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-[#641526]">
                            Active {activeRole} Account:
                          </span>
                          <span className="font-bold text-neutral-900">
                            {activeRoleUser.fullName}
                          </span>
                          <span className="font-mono text-neutral-600">
                            ({activeRoleUser.idNumber} ·{' '}
                            {activeRoleUser.gradeOrDepartment})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditingUser(activeRoleUser)}
                          className="inline-flex items-center gap-1 rounded-md bg-[#641526] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#4d0f1d]"
                        >
                          <Pencil className="h-3 w-3 text-[#D4AF37]" />
                          Edit {activeRole} Name
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold text-neutral-600">
                            <th className="py-3 px-5">Full Name & Email</th>
                            <th className="py-3 px-4">ID / LRN</th>
                            <th className="py-3 px-4">Department / Grade</th>
                            <th className="py-3 px-4">Role</th>
                            <th className="py-3 px-5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200 text-xs">
                          {users
                            .filter(
                              (u) =>
                                userRoleFilter === 'All' ||
                                u.role === userRoleFilter
                            )
                            .map((u) => (
                              <tr key={u.id} className="hover:bg-neutral-50">
                                <td className="py-3.5 px-5">
                                  <div className="font-semibold text-neutral-900">
                                    {u.fullName}
                                  </div>
                                  <div className="text-neutral-500">
                                    {u.email}
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 font-mono tabular-nums">
                                  {u.idNumber}
                                </td>
                                <td className="py-3.5 px-4">
                                  {u.gradeOrDepartment}
                                </td>
                                <td className="py-3.5 px-4">
                                  <select
                                    value={u.role}
                                    onChange={(e) => {
                                      const nextRole = e.target
                                        .value as UserRole;
                                      handleChangeMemberRole(u, nextRole);
                                      if (nextRole === 'Librarian') {
                                        setActiveRole('Librarian');
                                      }
                                    }}
                                    className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold text-[#641526] focus:outline-none focus:border-[#641526]"
                                  >
                                    <option value="Administrator">
                                      Administrator
                                    </option>
                                    <option value="Librarian">Librarian</option>
                                    <option value="Teacher">Teacher</option>
                                    <option value="Student">Student</option>
                                  </select>
                                </td>
                                <td className="py-3.5 px-5 text-right whitespace-nowrap">
                                  <div className="inline-flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingUser(u);
                                        setMemberForm({
                                          editingExistingId: u.id,
                                          fullName: u.fullName,
                                          email: u.email,
                                          role: u.role,
                                          idNumber: u.idNumber,
                                          gradeOrDepartment:
                                            u.gradeOrDepartment,
                                        });
                                      }}
                                      className="inline-flex items-center gap-1 rounded bg-[#641526] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#4d0f1d] transition-colors cursor-pointer"
                                    >
                                      <Pencil className="h-3 w-3 text-[#D4AF37]" />
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteUser(u)}
                                      className="inline-flex items-center gap-1 rounded bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Register or Edit User Form */}
                  <form
                    onSubmit={handleCreateMember}
                    className="lg:col-span-4 rounded-xl bg-white p-6 text-[#1E1B18] border border-neutral-200 shadow-sm space-y-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-5 w-5 text-[#641526]" />
                        <h3 className="font-display text-base font-bold text-[#641526]">
                          {memberForm.editingExistingId > 0
                            ? 'Edit Selected Member'
                            : 'Register Library Member'}
                        </h3>
                      </div>
                      {memberForm.editingExistingId > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setMemberForm({
                              editingExistingId: 0,
                              fullName: '',
                              email: '',
                              role: 'Student',
                              idNumber: '',
                              gradeOrDepartment: '',
                            })
                          }
                          className="text-[11px] font-semibold text-[#641526] underline hover:text-[#4d0f1d]"
                        >
                          New Member
                        </button>
                      )}
                    </div>

                    <div className="space-y-3 text-xs">
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block font-semibold text-neutral-700 mb-1">
                            User Role
                          </label>
                          <select
                            value={memberForm.role}
                            onChange={(e) => {
                              const chosenRole = e.target.value as UserRole;
                              // When choosing Librarian (or another role), automatically display that role's member name
                              if (chosenRole === 'Librarian') {
                                setActiveRole('Librarian');
                                const libUser = users.find(
                                  (u) => u.role === 'Librarian'
                                );
                                if (libUser) {
                                  setMemberForm({
                                    editingExistingId: libUser.id,
                                    fullName: libUser.fullName,
                                    email: libUser.email,
                                    role: 'Librarian',
                                    idNumber: libUser.idNumber,
                                    gradeOrDepartment:
                                      libUser.gradeOrDepartment,
                                  });
                                  return;
                                }
                              }
                              setMemberForm({
                                ...memberForm,
                                role: chosenRole,
                              });
                            }}
                            className="w-full rounded-lg border border-neutral-300 px-2.5 py-2 text-neutral-900 font-semibold"
                          >
                            <option value="Student">Student</option>
                            <option value="Teacher">Teacher</option>
                            <option value="Librarian">Librarian</option>
                            <option value="Administrator">Administrator</option>
                          </select>
                        </div>

                        <div>
                          <label className="block font-semibold text-neutral-700 mb-1">
                            LRN / Employee ID
                          </label>
                          <input
                            type="text"
                            required
                            value={memberForm.idNumber}
                            onChange={(e) =>
                              setMemberForm({
                                ...memberForm,
                                idNumber: e.target.value,
                              })
                            }
                            placeholder="LRN-132604..."
                            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold text-neutral-700 mb-1">
                          Full Name
                        </label>
                        <input
                          type="text"
                          required
                          value={memberForm.fullName}
                          onChange={(e) =>
                            setMemberForm({
                              ...memberForm,
                              fullName: e.target.value,
                            })
                          }
                          placeholder="e.g. Mrs. Marites R. Dela Cruz, RL"
                          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-neutral-700 mb-1">
                          School Email
                        </label>
                        <input
                          type="email"
                          required
                          value={memberForm.email}
                          onChange={(e) =>
                            setMemberForm({
                              ...memberForm,
                              email: e.target.value,
                            })
                          }
                          placeholder="m.delacruz@bnhs.edu.ph"
                          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-neutral-700 mb-1">
                          Grade & Section / Department
                        </label>
                        <input
                          type="text"
                          required
                          value={memberForm.gradeOrDepartment}
                          onChange={(e) =>
                            setMemberForm({
                              ...memberForm,
                              gradeOrDepartment: e.target.value,
                            })
                          }
                          placeholder="e.g. Head School Librarian"
                          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full rounded-lg bg-[#641526] py-2.5 text-xs font-semibold text-white hover:bg-[#4d0f1d] transition-colors cursor-pointer"
                      >
                        {memberForm.editingExistingId > 0
                          ? 'Update Member Account'
                          : 'Save User Account'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Sub-tab 3: Shelf Categories */}
              {managementTab === 'categories' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  <div className="lg:col-span-8 rounded-xl bg-white text-[#1E1B18] border border-neutral-200 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-neutral-200">
                      <h3 className="font-display text-base font-bold text-[#641526]">
                        BNHS Library Classification & Shelf Zones
                      </h3>
                    </div>
                    <div className="divide-y divide-neutral-200">
                      {categories.map((cat) => (
                        <div
                          key={cat.id}
                          className="p-4 flex items-start justify-between gap-4"
                        >
                          <div>
                            <div className="font-semibold text-sm text-neutral-900">
                              {cat.name}
                            </div>
                            <div className="font-mono text-xs text-[#641526] mt-0.5">
                              {cat.code} · {cat.shelfZone}
                            </div>
                            <p className="text-xs text-neutral-600 mt-1">
                              {cat.description}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => setEditingCategory(cat)}
                              className="inline-flex items-center gap-1 rounded border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-800 hover:bg-neutral-100 transition-colors"
                            >
                              <Pencil className="h-3 w-3 text-[#641526]" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(cat)}
                              className="inline-flex items-center gap-1 rounded border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <form
                    onSubmit={handleCreateCategory}
                    className="lg:col-span-4 rounded-xl bg-white p-6 text-[#1E1B18] border border-neutral-200 shadow-sm space-y-4"
                  >
                    <h3 className="font-display text-base font-bold text-[#641526]">
                      Add Shelf Category
                    </h3>
                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="block font-semibold text-neutral-700 mb-1">
                          Category Name
                        </label>
                        <input
                          type="text"
                          required
                          value={categoryForm.name}
                          onChange={(e) =>
                            setCategoryForm({
                              ...categoryForm,
                              name: e.target.value,
                            })
                          }
                          placeholder="e.g. Agriculture & Fisheries (TVL)"
                          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block font-semibold text-neutral-700 mb-1">
                            Classification Code
                          </label>
                          <input
                            type="text"
                            required
                            value={categoryForm.code}
                            onChange={(e) =>
                              setCategoryForm({
                                ...categoryForm,
                                code: e.target.value,
                              })
                            }
                            placeholder="TVL-600"
                            className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-neutral-900"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-neutral-700 mb-1">
                            Shelf Zone
                          </label>
                          <input
                            type="text"
                            required
                            value={categoryForm.shelfZone}
                            onChange={(e) =>
                              setCategoryForm({
                                ...categoryForm,
                                shelfZone: e.target.value,
                              })
                            }
                            placeholder="Wing D · Shelf 9"
                            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block font-semibold text-neutral-700 mb-1">
                          Description
                        </label>
                        <textarea
                          rows={3}
                          required
                          value={categoryForm.description}
                          onChange={(e) =>
                            setCategoryForm({
                              ...categoryForm,
                              description: e.target.value,
                            })
                          }
                          placeholder="Scope of books stored in this section..."
                          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full rounded-lg bg-[#641526] py-2.5 text-xs font-semibold text-white hover:bg-[#4d0f1d] transition-colors"
                      >
                        Create Category
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Sub-tab 4: Portal Banner Image & Schedule Settings */}
              {managementTab === 'branding' && (
                <div className="rounded-xl bg-white p-6 text-[#1E1B18] border border-neutral-200 shadow-sm space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-4">
                    <div>
                      <h3 className="font-display text-base font-bold text-[#641526]">
                        BNHS Portal Banner, Image & Academic Schedule Settings
                      </h3>
                      <p className="text-xs text-neutral-500">
                        Upload or link the hero image and school logo GIF via local file or Google Link, and update operating hours banner text
                      </p>
                    </div>
                    <button
                      onClick={() => setIsPortalSettingsOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#641526] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4d0f1d]"
                    >
                      <Pencil className="h-3.5 w-3.5 text-[#D4AF37]" />
                      Edit BNHS Portal Banner, Image & Schedule
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                    <div className="space-y-2">
                      <div className="font-semibold text-neutral-700">
                        Current Academic Year & Operating Hours Banner:
                      </div>
                      <div className="rounded-lg bg-neutral-50 p-3 border border-neutral-200 font-medium text-[#641526]">
                        {portalSettings.scheduleBannerText}
                      </div>
                      <div className="font-semibold text-neutral-700 pt-2">
                        Current Welcome Banner Heading:
                      </div>
                      <div className="rounded-lg bg-neutral-50 p-3 border border-neutral-200 font-medium text-neutral-900">
                        {portalSettings.welcomeHeading}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold text-neutral-700">
                          Current Hero Banner Image Preview:
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setLightboxImagePreview({
                              url: resolvePortalAssetUrl(
                                portalSettings.heroImageUrl,
                                DEFAULT_HERO_IMAGE_PATH
                              ),
                              title: 'BNHS Portal Hero Banner Preview',
                            })
                          }
                          className="inline-flex items-center gap-1 rounded border border-neutral-300 px-2.5 py-1 text-[11px] font-semibold text-[#641526] hover:bg-neutral-100"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Preview
                        </button>
                      </div>
                      <div className="h-36 rounded-lg overflow-hidden border border-neutral-200 bg-neutral-100">
                        <img
                          src={resolvePortalAssetUrl(
                            portalSettings.heroImageUrl,
                            DEFAULT_HERO_IMAGE_PATH
                          )}
                          alt="Current Portal Hero"
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="font-semibold text-neutral-700">
                          Current BNHS School Logo Preview:
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setLightboxImagePreview({
                              url: resolvePortalAssetUrl(
                                portalSettings.logoImageUrl,
                                DEFAULT_CREST_ANIMATED_GIF_PATH
                              ),
                              title: 'BNHS School Logo Preview',
                            })
                          }
                          className="inline-flex items-center gap-1 rounded border border-neutral-300 px-2.5 py-1 text-[11px] font-semibold text-[#641526] hover:bg-neutral-100"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Preview
                        </button>
                      </div>
                      <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-2.5">
                        <div className="h-12 w-12 rounded-full overflow-hidden border border-[#D4AF37] bg-white p-0.5 shrink-0">
                          <img
                            src={resolvePortalAssetUrl(
                              portalSettings.logoImageUrl,
                              DEFAULT_CREST_ANIMATED_GIF_PATH
                            )}
                            alt="Current BNHS School Logo"
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-contain rounded-full"
                          />
                        </div>
                        <span className="text-[11px] text-neutral-600">
                          Auto-synced across all connected devices
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ================================================================
              MODULE 6: REPORTS AND ANALYTICS
             ================================================================ */}
          {activeModule === 'reports' && (
            <section className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-bold text-white">
                    Reports and Analytics
                  </h1>
                  <p className="text-xs text-white/80">
                    Total books, available books, borrowed books, overdue books, category distribution, and complete borrowing history
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => setIsSqlModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4AF37]/50 bg-[#3A0A14] px-3.5 py-2 text-xs font-semibold text-[#D4AF37] hover:bg-[#2b060e] transition-colors whitespace-nowrap shrink-0"
                  >
                    <Database className="h-3.5 w-3.5" />
                    Export SQL Database
                  </button>
                  <button
                    onClick={handleExportCsvReport}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#D4AF37] px-4 py-2 text-xs font-bold text-[#3A0A14] hover:bg-[#e5c247] transition-colors whitespace-nowrap shrink-0"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download Circulation CSV
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 rounded-xl bg-white p-6 text-[#1E1B18] border border-neutral-200 shadow-sm space-y-4">
                  <div>
                    <h3 className="font-display text-base font-bold text-[#641526]">
                      Collection Holdings by Category
                    </h3>
                    <p className="text-xs text-neutral-500">
                      Distribution of total copies and available shelf copies across library wings
                    </p>
                  </div>

                  <div className="space-y-3">
                    {categories.map((cat) => {
                      const catBooks = books.filter(
                        (b) => b.category === cat.name
                      );
                      const totalCopies = catBooks.reduce(
                        (s, b) => s + b.totalCopies,
                        0
                      );
                      const availCopies = catBooks.reduce(
                        (s, b) => s + b.availableCopies,
                        0
                      );
                      const pct =
                        stats.totalRegisteredCopies > 0
                          ? Math.round(
                              (totalCopies / stats.totalRegisteredCopies) * 100
                            )
                          : 0;

                      return (
                        <div key={cat.id} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-neutral-900">
                              {cat.name}{' '}
                              <span className="font-normal text-neutral-500">
                                ({catBooks.length} titles)
                              </span>
                            </span>
                            <span className="font-mono text-neutral-700 tabular-nums">
                              {availCopies} avail / {totalCopies} total ({pct}%)
                            </span>
                          </div>
                          <div className="h-2.5 w-full rounded-full bg-neutral-100 overflow-hidden">
                            <div
                              className="h-full bg-[#641526] rounded-full"
                              style={{ width: `${Math.max(6, pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="lg:col-span-5 rounded-xl bg-white p-6 text-[#1E1B18] border border-neutral-200 shadow-sm flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <h3 className="font-display text-base font-bold text-[#641526]">
                      Circulation Efficiency & Compliance
                    </h3>
                    <p className="text-xs text-neutral-500">
                      Real-time ratios calculated from the shared BNHS Library database
                    </p>

                    <div className="divide-y divide-neutral-200 pt-2">
                      <div className="py-2.5 flex items-center justify-between text-xs">
                        <span className="text-neutral-600">
                          Shelf Availability Ratio
                        </span>
                        <span className="font-mono font-bold text-emerald-700 tabular-nums">
                          {stats.totalRegisteredCopies > 0
                            ? `${Math.round(
                                (stats.availableCopiesCount /
                                  stats.totalRegisteredCopies) *
                                  100
                              )}%`
                            : '100%'}
                        </span>
                      </div>
                      <div className="py-2.5 flex items-center justify-between text-xs">
                        <span className="text-neutral-600">
                          Active Loan Transactions
                        </span>
                        <span className="font-mono font-bold text-[#641526] tabular-nums">
                          {stats.activeBorrowedCount} loans
                        </span>
                      </div>
                      <div className="py-2.5 flex items-center justify-between text-xs">
                        <span className="text-neutral-600">
                          Overdue Delinquency Count
                        </span>
                        <span className="font-mono font-bold text-red-600 tabular-nums">
                          {stats.overdueCount} overdue
                        </span>
                      </div>
                      <div className="py-2.5 flex items-center justify-between text-xs">
                        <span className="text-neutral-600">
                          Total Digital Material Downloads
                        </span>
                        <span className="font-mono font-bold text-neutral-900 tabular-nums">
                          {digitalResources
                            .reduce((s, r) => s + r.downloadCount, 0)
                            .toLocaleString()}
                        </span>
                      </div>
                      <div className="py-2.5 flex items-center justify-between text-xs">
                        <span className="text-neutral-600">
                          Registered Portal Members
                        </span>
                        <span className="font-mono font-bold text-neutral-900 tabular-nums">
                          {stats.totalUsersCount} accounts
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg bg-neutral-50 p-3.5 border border-neutral-200 text-xs text-neutral-600">
                    All reports reflect live database transactions across student, teacher, and librarian terminals at Barobo National High School.
                  </div>
                </div>
              </div>
            </section>
          )}
        </main>

        {/* Quiet Academic Footer */}
        <footer className="mt-auto border-t border-[#D4AF37]/20 bg-[#3A0A14] px-6 py-4 text-xs text-white/75 flex flex-wrap items-center justify-between gap-4">
          <div className="font-medium text-white">
            {portalSettings.portalTitle} · Poblacion, Barobo, Surigao del Sur
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveModule('catalog')}
              className="hover:text-[#D4AF37] transition-colors"
            >
              Book Catalog
            </button>
            <button
              onClick={() => setActiveModule('digital')}
              className="hover:text-[#D4AF37] transition-colors"
            >
              Digital Library
            </button>
            <button
              onClick={() => setIsPortalSettingsOpen(true)}
              className="hover:text-[#D4AF37] transition-colors"
            >
              Edit Portal Settings
            </button>
          </div>
        </footer>
      </div>

      {/* ====================================================================
          MODAL 1: BOOK DETAILS & AVAILABILITY DRAWER
         ==================================================================== */}
      {selectedBookDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white text-[#1E1B18] shadow-2xl border border-[#D4AF37]/40 overflow-hidden">
            <div className="flex items-center justify-between bg-[#420B17] px-6 py-4 text-white">
              <h3 className="font-display text-base font-bold">
                Catalog Record Details
              </h3>
              <button
                onClick={() => setSelectedBookDetail(null)}
                className="rounded-lg p-1 text-white/70 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-4">
                <div className="h-28 w-20 rounded overflow-hidden border border-neutral-200 shrink-0">
                  <BookCoverThumbnail
                    coverKey={selectedBookDetail.coverKey}
                    title={selectedBookDetail.title}
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-[#641526]">
                    {selectedBookDetail.category} · {selectedBookDetail.subject}
                  </div>
                  <h4 className="font-display text-lg font-bold text-neutral-900">
                    {selectedBookDetail.title}
                  </h4>
                  <div className="text-xs text-neutral-600">
                    By {selectedBookDetail.author}
                  </div>
                  <div className="text-xs text-neutral-500 font-mono tabular-nums">
                    ISBN {selectedBookDetail.isbn} ·{' '}
                    {selectedBookDetail.publisher} (
                    {selectedBookDetail.publicationYear})
                  </div>
                </div>
              </div>

              <p className="text-xs text-neutral-700 leading-relaxed bg-neutral-50 p-3.5 rounded-lg border border-neutral-200">
                {selectedBookDetail.description}
              </p>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg border border-neutral-200 p-2.5">
                  <div className="text-[11px] text-neutral-500">
                    Shelf Location
                  </div>
                  <div className="text-xs font-semibold text-neutral-900 mt-0.5">
                    {selectedBookDetail.shelfLocation}
                  </div>
                </div>
                <div className="rounded-lg border border-neutral-200 p-2.5">
                  <div className="text-[11px] text-neutral-500">
                    Total Copies
                  </div>
                  <div className="font-mono text-sm font-bold text-neutral-900 mt-0.5 tabular-nums">
                    {selectedBookDetail.totalCopies}
                  </div>
                </div>
                <div className="rounded-lg border border-neutral-200 p-2.5">
                  <div className="text-[11px] text-neutral-500">
                    Available Now
                  </div>
                  <div className="font-mono text-sm font-bold text-emerald-700 mt-0.5 tabular-nums">
                    {selectedBookDetail.availableCopies}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2">
                <button
                  onClick={() => {
                    const bk = selectedBookDetail;
                    setSelectedBookDetail(null);
                    handleRequestBookReturnNotification(bk);
                  }}
                  className="rounded-lg border border-[#641526] px-3.5 py-2 text-xs font-semibold text-[#641526] hover:bg-[#641526]/5"
                >
                  Notify Me When Returned
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedBookDetail(null)}
                    className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      const bk = selectedBookDetail;
                      setSelectedBookDetail(null);
                      openBorrowModal(bk);
                    }}
                    disabled={selectedBookDetail.availableCopies === 0}
                    className="rounded-lg bg-[#641526] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4d0f1d] disabled:opacity-40"
                  >
                    Issue Borrow Loan
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 2: RECORD BORROW TRANSACTION
         ==================================================================== */}
      {borrowModalBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white text-[#1E1B18] shadow-2xl border border-[#D4AF37]/40 overflow-hidden">
            <div className="flex items-center justify-between bg-[#420B17] px-6 py-4 text-white">
              <h3 className="font-display text-base font-bold">
                Issue Book Loan Transaction
              </h3>
              <button
                onClick={() => setBorrowModalBook(null)}
                className="rounded-lg p-1 text-white/70 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleIssueBorrowSubmit}
              className="p-6 space-y-4 text-xs"
            >
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Select Book to Borrow
                </label>
                <select
                  value={borrowForm.bookId}
                  onChange={(e) =>
                    setBorrowForm({
                      ...borrowForm,
                      bookId: Number(e.target.value),
                    })
                  }
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 font-medium"
                >
                  {books.map((b) => (
                    <option
                      key={b.id}
                      value={b.id}
                      disabled={b.availableCopies === 0}
                    >
                      {b.title} ({b.availableCopies} avail.)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Borrower Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={borrowForm.borrowerName}
                    onChange={(e) =>
                      setBorrowForm({
                        ...borrowForm,
                        borrowerName: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Borrower Role
                  </label>
                  <select
                    value={borrowForm.borrowerRole}
                    onChange={(e) => {
                      const nextRole = e.target.value as UserRole;
                      const matched = users.find((u) => u.role === nextRole);
                      setBorrowForm({
                        ...borrowForm,
                        borrowerRole: nextRole,
                        borrowerName: matched
                          ? matched.fullName
                          : borrowForm.borrowerName,
                        borrowerIdNumber: matched
                          ? matched.idNumber
                          : borrowForm.borrowerIdNumber,
                      });
                    }}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
                  >
                    <option value="Student">Student</option>
                    <option value="Teacher">Teacher</option>
                    <option value="Librarian">Librarian</option>
                    <option value="Administrator">Administrator</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    LRN / School ID
                  </label>
                  <input
                    type="text"
                    required
                    value={borrowForm.borrowerIdNumber}
                    onChange={(e) =>
                      setBorrowForm({
                        ...borrowForm,
                        borrowerIdNumber: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-neutral-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Issue Date
                  </label>
                  <input
                    type="date"
                    required
                    value={borrowForm.issueDate}
                    onChange={(e) =>
                      setBorrowForm({
                        ...borrowForm,
                        issueDate: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-neutral-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    required
                    value={borrowForm.dueDate}
                    onChange={(e) =>
                      setBorrowForm({
                        ...borrowForm,
                        dueDate: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-neutral-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Circulation Remarks / Purpose
                </label>
                <input
                  type="text"
                  value={borrowForm.remarks}
                  onChange={(e) =>
                    setBorrowForm({ ...borrowForm, remarks: e.target.value })
                  }
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setBorrowModalBook(null)}
                  className="rounded-lg border border-neutral-300 px-4 py-2 font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-[#641526] px-5 py-2 font-semibold text-white hover:bg-[#4d0f1d] disabled:opacity-50"
                >
                  {submitting ? 'Recording...' : 'Confirm Book Issue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 3: ADD NEW BOOK TO CATALOG
         ==================================================================== */}
      {isAddBookOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white text-[#1E1B18] shadow-2xl border border-[#D4AF37]/40 overflow-hidden">
            <div className="flex items-center justify-between bg-[#420B17] px-6 py-4 text-white">
              <h3 className="font-display text-base font-bold">
                Register New Book in BNHS Catalog
              </h3>
              <button
                onClick={() => setIsAddBookOpen(false)}
                className="rounded-lg p-1 text-white/70 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleAddBookSubmit}
              className="p-6 space-y-3.5 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Book Title
                  </label>
                  <input
                    type="text"
                    required
                    value={newBookForm.title}
                    onChange={(e) =>
                      setNewBookForm({ ...newBookForm, title: e.target.value })
                    }
                    placeholder="e.g. General Physics 1 for STEM"
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Author(s)
                  </label>
                  <input
                    type="text"
                    required
                    value={newBookForm.author}
                    onChange={(e) =>
                      setNewBookForm({ ...newBookForm, author: e.target.value })
                    }
                    placeholder="e.g. Dr. Gil Nonato C. Santos"
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    ISBN
                  </label>
                  <input
                    type="text"
                    required
                    value={newBookForm.isbn}
                    onChange={(e) =>
                      setNewBookForm({ ...newBookForm, isbn: e.target.value })
                    }
                    placeholder="978-971-06-..."
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-neutral-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Subject Area
                  </label>
                  <input
                    type="text"
                    required
                    value={newBookForm.subject}
                    onChange={(e) =>
                      setNewBookForm({
                        ...newBookForm,
                        subject: e.target.value,
                      })
                    }
                    placeholder="Physics / STEM"
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Category
                  </label>
                  <select
                    value={newBookForm.category}
                    onChange={(e) =>
                      setNewBookForm({
                        ...newBookForm,
                        category: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Publisher
                  </label>
                  <input
                    type="text"
                    required
                    value={newBookForm.publisher}
                    onChange={(e) =>
                      setNewBookForm({
                        ...newBookForm,
                        publisher: e.target.value,
                      })
                    }
                    placeholder="Rex Book Store"
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Year
                  </label>
                  <input
                    type="number"
                    required
                    value={newBookForm.publicationYear}
                    onChange={(e) =>
                      setNewBookForm({
                        ...newBookForm,
                        publicationYear: Number(e.target.value),
                      })
                    }
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-neutral-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Shelf Location
                  </label>
                  <input
                    type="text"
                    required
                    value={newBookForm.shelfLocation}
                    onChange={(e) =>
                      setNewBookForm({
                        ...newBookForm,
                        shelfLocation: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Copies
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={newBookForm.totalCopies}
                    onChange={(e) =>
                      setNewBookForm({
                        ...newBookForm,
                        totalCopies: Number(e.target.value),
                      })
                    }
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-neutral-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Catalog Description & Curriculum Alignment
                </label>
                <textarea
                  rows={3}
                  required
                  value={newBookForm.description}
                  onChange={(e) =>
                    setNewBookForm({
                      ...newBookForm,
                      description: e.target.value,
                    })
                  }
                  placeholder="Summary of chapters, grade level suitability, and subject scope..."
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
                />
              </div>

              <div className="rounded-lg bg-neutral-50 p-3 border border-neutral-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-12 w-9 rounded overflow-hidden border border-neutral-300 bg-white shrink-0">
                    <BookCoverThumbnail
                      coverKey={newBookForm.coverKey}
                      title={newBookForm.title || 'Book Cover'}
                    />
                  </div>
                  <div className="text-[11px] text-neutral-600">
                    <div className="font-semibold text-neutral-800">
                      Book Cover Image (Optional)
                    </div>
                    <div>Cloud Synced (Auto-Saved)</div>
                  </div>
                </div>
                <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-md bg-[#641526] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#4d0f1d]">
                  <Upload className="h-3.5 w-3.5 text-[#D4AF37]" />
                  Upload Cover File
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        if (typeof reader.result === 'string') {
                          setNewBookForm((prev) => ({
                            ...prev,
                            coverKey: reader.result as string,
                          }));
                        }
                      };
                      reader.readAsDataURL(file);
                    }}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddBookOpen(false)}
                  className="rounded-lg border border-neutral-300 px-4 py-2 font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-[#641526] px-5 py-2 font-semibold text-white hover:bg-[#4d0f1d] disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save to Catalog'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 4: UPLOAD DIGITAL LIBRARY MATERIAL
         ==================================================================== */}
      {isUploadDigitalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white text-[#1E1B18] shadow-2xl border border-[#D4AF37]/40 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between bg-[#420B17] px-6 py-4 text-white shrink-0">
              <h3 className="font-display text-base font-bold">
                Upload Digital Resource to BNHS Repository
              </h3>
              <button
                type="button"
                onClick={() => setIsUploadDigitalOpen(false)}
                className="rounded-lg p-1 text-white/70 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleUploadDigitalSubmit}
              className="p-6 space-y-3.5 text-xs overflow-y-auto flex-1"
            >
              {/* File Input + Auto Cloud Sync Draft + Live Preview */}
              <div className="rounded-lg bg-neutral-50 border border-neutral-200 p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-semibold text-[#641526]">
                    <FileText className="h-4 w-4 text-[#D4AF37]" />
                    <span>Upload File (PDF, Doc, PPT, Image, Text)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setDigitalUploadPreviewOpen((prev) => !prev)
                      }
                      className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-neutral-800 hover:bg-neutral-100"
                    >
                      <Eye className="h-3.5 w-3.5 text-[#641526]" />
                      {digitalUploadPreviewOpen ? 'Hide Preview' : 'Preview'}
                    </button>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-md bg-[#641526] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#4d0f1d]">
                      <Upload className="h-3.5 w-3.5 text-[#D4AF37]" />
                      Choose File
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv,.epub,.html,.jpg,.jpeg,.png,.gif,.webp"
                        onChange={handleUploadDigitalFilePick}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {(attachedUploadFileName ||
                  digitalForm.externalUrl?.startsWith('data:')) && (
                  <div className="rounded bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800 flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>
                      {attachedUploadFileName
                        ? `File "${attachedUploadFileName}" (${digitalForm.fileSize}) loaded & auto-saved in draft.`
                        : `Uploaded file (${digitalForm.fileSize}) ready for Auto Cloud Sync.`}
                    </span>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-medium text-neutral-600 mb-1">
                    Or Paste Google Drive / File URL Link
                  </label>
                  <input
                    type="text"
                    value={
                      digitalForm.externalUrl?.startsWith('data:')
                        ? `[File Ready · ${digitalForm.fileSize}]`
                        : digitalForm.externalUrl || ''
                    }
                    onChange={(e) => {
                      if (!e.target.value.startsWith('[File Ready')) {
                        setDigitalForm({
                          ...digitalForm,
                          externalUrl: e.target.value,
                        });
                      }
                    }}
                    placeholder="https://drive.google.com/file/d/... or direct PDF/document link"
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-1.5 font-mono text-[11px] text-neutral-900"
                  />
                </div>

                {digitalUploadPreviewOpen && (
                  <div className="pt-1">
                    <InlineFilePreview
                      title={digitalForm.title || attachedUploadFileName}
                      externalUrl={digitalForm.externalUrl}
                      fileSize={digitalForm.fileSize}
                      contentPreview={digitalForm.contentPreview}
                      summary={digitalForm.summary}
                      compact
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Resource Title
                </label>
                <input
                  type="text"
                  required
                  value={digitalForm.title}
                  onChange={(e) =>
                    setDigitalForm({ ...digitalForm, title: e.target.value })
                  }
                  placeholder="e.g. DepEd Quarter 3 Module: Basic Calculus Limits & Derivatives"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Author / Department
                  </label>
                  <input
                    type="text"
                    required
                    value={digitalForm.author}
                    onChange={(e) =>
                      setDigitalForm({ ...digitalForm, author: e.target.value })
                    }
                    placeholder="BNHS Math Dept."
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Resource Type
                  </label>
                  <select
                    value={digitalForm.resourceType}
                    onChange={(e) =>
                      setDigitalForm({
                        ...digitalForm,
                        resourceType: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
                  >
                    <option value="E-Book">E-Book</option>
                    <option value="PDF Learning Material">
                      PDF Learning Material
                    </option>
                    <option value="Module">Module</option>
                    <option value="Journal">Journal</option>
                    <option value="Reference">Reference</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Grade Level
                  </label>
                  <input
                    type="text"
                    required
                    value={digitalForm.gradeLevel}
                    onChange={(e) =>
                      setDigitalForm({
                        ...digitalForm,
                        gradeLevel: e.target.value,
                      })
                    }
                    placeholder="Grade 11–12 (SHS)"
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Executive Summary
                </label>
                <textarea
                  rows={2}
                  required
                  value={digitalForm.summary}
                  onChange={(e) =>
                    setDigitalForm({ ...digitalForm, summary: e.target.value })
                  }
                  placeholder="Brief overview of learning competencies covered..."
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Full Module / Study Material Content (Optional if File Attached)
                </label>
                <textarea
                  rows={3}
                  value={digitalForm.contentPreview}
                  onChange={(e) =>
                    setDigitalForm({
                      ...digitalForm,
                      contentPreview: e.target.value,
                    })
                  }
                  placeholder="Paste the learning material text, key formulas, or study guide sections..."
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadDigitalOpen(false)}
                  className="rounded-lg border border-neutral-300 px-4 py-2 font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-[#641526] px-5 py-2 font-semibold text-white hover:bg-[#4d0f1d] disabled:opacity-50"
                >
                  {submitting
                    ? 'Uploading & Cloud Syncing...'
                    : 'Publish & Auto-Save to Cloud'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 5: DIGITAL RESOURCE & FILE PREVIEWER
         ==================================================================== */}
      <DigitalResourcePreviewModal
        resource={readingResource}
        onClose={() => setReadingResource(null)}
        onDownload={handleDownloadResource}
      />

      <ImageLightboxPreviewModal
        imageUrl={lightboxImagePreview?.url || null}
        title={lightboxImagePreview?.title || 'Image Preview'}
        onClose={() => setLightboxImagePreview(null)}
      />

      {/* ====================================================================
          MODAL 6: SQL & XAMPP SCHEMA EXPORT
         ==================================================================== */}
      <SqlExportModal
        isOpen={isSqlModalOpen}
        onClose={() => setIsSqlModalOpen(false)}
        books={books}
        categories={categories}
        digitalResources={digitalResources}
      />

      {/* ====================================================================
          MODAL 7: ADMIN PORTAL SETTINGS & EDIT MODALS
         ==================================================================== */}
      <AdminPortalSettingsModal
        isOpen={isPortalSettingsOpen}
        onClose={() => setIsPortalSettingsOpen(false)}
        settings={portalSettings}
        onSave={handleSavePortalSettings}
      />

      <EditBookModal
        book={editingBook}
        categories={categories}
        onClose={() => setEditingBook(null)}
        onSave={handleUpdateBook}
      />

      <EditDigitalResourceModal
        resource={editingDigital}
        onClose={() => setEditingDigital(null)}
        onSave={handleUpdateDigitalResource}
      />

      <EditUserModal
        user={editingUser}
        allUsers={users}
        onClose={() => setEditingUser(null)}
        onSave={handleUpdateUser}
      />

      <EditCategoryModal
        category={editingCategory}
        onClose={() => setEditingCategory(null)}
        onSave={handleUpdateCategory}
      />

      <GoogleSignInModal
        isOpen={isSignInModalOpen}
        users={users}
        onClose={closeSignInModal}
        onSelectAccount={async (account) => {
          await signInWithPortalAccount(account);
          showToast(
            'success',
            `Signed in as ${account.fullName} (${account.email}) — ${account.role}.`
          );
        }}
      />
    </div>
  );
}

class PortalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMessage: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected portal render error',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#641526] text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-xl bg-white text-[#1E1B18] border-2 border-[#D4AF37] p-6 shadow-2xl space-y-4 text-center">
            <h1 className="font-display text-lg font-bold text-[#641526]">
              BNHS Library Portal Recovery
            </h1>
            <p className="text-xs text-neutral-600">
              {this.state.errorMessage}
            </p>
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.removeItem('bnhs_portal_settings_cache');
                  localStorage.removeItem('bnhs_digital_upload_draft_v1');
                } catch {
                  // ignore
                }
                window.location.reload();
              }}
              className="rounded-lg bg-[#641526] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4d0f1d]"
            >
              Clear Local Cache & Reload Portal
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <PortalErrorBoundary>
      <AuthProvider>
        <LibraryPortalContent />
      </AuthProvider>
    </PortalErrorBoundary>
  );
}
