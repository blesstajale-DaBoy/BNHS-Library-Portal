export type UserRole =
  | 'Administrator'
  | 'School Librarian'
  | 'Assistant School Librarian'
  | 'Librarian Support Staff'
  | 'Teacher'
  | 'Student';

export const USER_ROLE_OPTIONS: {
  value: UserRole;
  label: string;
  shortLabel: string;
}[] = [
  {
    value: 'Administrator',
    label: 'Administrator (Full Access)',
    shortLabel: 'Administrator',
  },
  {
    value: 'School Librarian',
    label: 'School Librarian (full Access, Circulations & Books)',
    shortLabel: 'School Librarian',
  },
  {
    value: 'Assistant School Librarian',
    label: 'Assistant School Librarian (full Access, Circulations & Books)',
    shortLabel: 'Assistant School Librarian',
  },
  {
    value: 'Librarian Support Staff',
    label: 'Librarian Support Staff (full Access, Circulations & Books)',
    shortLabel: 'Librarian Support Staff',
  },
  {
    value: 'Teacher',
    label: 'Teacher (Faculty Access)',
    shortLabel: 'Teacher',
  },
  {
    value: 'Student',
    label: "Student ('My Library' View)",
    shortLabel: 'Student',
  },
];

export function normalizeUserRole(raw: unknown): UserRole {
  const val = typeof raw === 'string' ? raw.trim() : '';
  if (val === 'Administrator') return 'Administrator';
  if (val === 'School Librarian' || val === 'Librarian') {
    return 'School Librarian';
  }
  if (val === 'Assistant School Librarian') {
    return 'Assistant School Librarian';
  }
  if (val === 'Librarian Support Staff') {
    return 'Librarian Support Staff';
  }
  if (val === 'Teacher') return 'Teacher';
  return 'Student';
}

export interface LibraryUser {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  role: UserRole;
  idNumber: string;
  gradeOrDepartment: string;
  status: string;
  createdAt?: string;
}

export interface BookCategory {
  id: number;
  name: string;
  code: string;
  shelfZone: string;
  description: string;
}

export interface BookItem {
  id: number;
  title: string;
  author: string;
  isbn: string;
  subject: string;
  category: string;
  publisher: string;
  publicationYear: number;
  shelfLocation: string;
  totalCopies: number;
  availableCopies: number;
  description: string;
  coverKey: string;
  addedAt?: string;
}

export interface BorrowRecord {
  id: number;
  transactionCode: string;
  bookId: number;
  borrowerUid: string;
  borrowerName: string;
  borrowerRole: string;
  borrowerIdNumber: string;
  issueDate: string;
  dueDate: string;
  returnDate: string | null;
  status: 'Borrowed' | 'Returned' | 'Overdue';
  remarks: string;
  createdAt?: string;
}

export interface DigitalResource {
  id: number;
  title: string;
  author: string;
  resourceType:
    | 'E-Book'
    | 'PDF Learning Material'
    | 'Module'
    | 'Journal'
    | 'Reference';
  subject: string;
  gradeLevel: string;
  fileSize: string;
  pageCount: number;
  downloadCount: number;
  summary: string;
  contentPreview: string;
  externalUrl: string;
  uploadedBy: string;
  uploadedAt?: string;
}

export interface LibraryStats {
  totalTitles: number;
  totalRegisteredCopies: number;
  availableCopiesCount: number;
  activeBorrowedCount: number;
  overdueCount: number;
  digitalResourcesCount: number;
  totalUsersCount: number;
}

export interface PortalSettings {
  portalTitle: string;
  welcomeHeading: string;
  welcomeSubtext: string;
  scheduleBannerText: string;
  heroImageUrl: string;
  logoImageUrl: string;
}

export interface BookWaitlistRequest {
  id: number;
  bookId: number;
  bookTitle: string;
  studentName: string;
  studentIdNumber: string;
  requestedAt: string;
  fulfilled: boolean;
  returnedAt?: string;
}

export interface PortalNotification {
  id: string;
  type: 'due_soon' | 'book_returned' | 'overdue';
  title: string;
  message: string;
  dateLabel: string;
  studentName: string;
  bookId?: number;
}
