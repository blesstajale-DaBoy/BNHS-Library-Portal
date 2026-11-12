import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import * as dotenv from 'dotenv';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import {
  getOrCreateUser,
  getLibraryOverviewData,
  createBookRecord,
  updateBookRecord,
  deleteBookRecord,
  issueBookBorrow,
  returnBorrowedBook,
  markBorrowOverdue,
  createDigitalResourceRecord,
  updateDigitalResourceRecord,
  deleteDigitalResourceRecord,
  incrementDigitalDownload,
  createCategoryRecord,
  updateCategoryRecord,
  deleteCategoryRecord,
  updateUserRoleRecord,
  updateUserRecord,
  deleteUserRecord,
  createLibraryMemberRecord,
  getPortalSyncStateRecord,
  upsertPortalSyncStateRecord,
} from './src/db/queries.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default Portal Banner & Settings State (persisted in Cloud SQL + fallback memory)
let fallbackPortalSettings = {
  portalTitle:
    'Barobo National High School (BNHS) Library Portal developed by: Bless T. Tajale',
  welcomeHeading: 'Welcome to the BNHS Library Portal',
  welcomeSubtext:
    'Centralized online library management system where students, teachers, librarians, and administrators search catalog holdings, track book loans, and access DepEd digital learning materials.',
  scheduleBannerText: 'Academic Year 2026–2027 · Open Mon–Fri, 7:30 AM – 5:00 PM',
  heroImageUrl: '/assets/images/bnhs_library_hero_1794464935499.jpg',
  logoImageUrl: '/assets/images/bnhs_1978_official_logo_animated.gif',
};

interface BookWaitlistRequest {
  id: number;
  bookId: number;
  bookTitle: string;
  studentName: string;
  studentIdNumber: string;
  requestedAt: string;
  fulfilled: boolean;
  returnedAt?: string;
}

let fallbackWaitlistRequests: BookWaitlistRequest[] = [
  {
    id: 1,
    bookId: 4,
    bookTitle:
      'Practical Research 2: Quantitative Inquiry and Statistical Analysis',
    studentName: 'Althea Mae C. Villaruel',
    studentIdNumber: 'LRN-132604180021',
    requestedAt: '2026-10-25',
    fulfilled: true,
    returnedAt: '2026-10-27',
  },
];

// Built-in fallback store if Cloud SQL is temporarily unreachable in a published preview container
let fallbackCategories = [
  {
    id: 1,
    name: 'Filipiñana & History',
    code: 'FIL-100',
    shelfZone: 'Wing A · Shelves 1–4',
    description:
      'Philippine history, Caraga & Surigao del Sur heritage, Noli Me Tangere, El Filibusterismo, and national governance.',
  },
  {
    id: 2,
    name: 'Science & Technology',
    code: 'SCI-200',
    shelfZone: 'Wing B · Shelves 1–6',
    description:
      'Earth and Life Sciences, Biology, Chemistry, Physics, and ICT programming references for JHS and SHS STEM.',
  },
  {
    id: 3,
    name: 'Mathematics & Analytics',
    code: 'MAT-300',
    shelfZone: 'Wing B · Shelves 7–10',
    description:
      'Algebra, Geometry, Trigonometry, Pre-Calculus, Basic Calculus, and Statistics & Probability.',
  },
  {
    id: 4,
    name: 'Literature & Humanities',
    code: 'LIT-400',
    shelfZone: 'Wing C · Shelves 1–5',
    description:
      '21st Century Literature from the Philippines and the World, Anglo-American Literature, and Creative Writing.',
  },
  {
    id: 5,
    name: 'General Reference & Research',
    code: 'REF-000',
    shelfZone: 'Central Reading Hall',
    description:
      'Encyclopedias, dictionaries, atlases, Practical Research 1 & 2 guides, and capstone methodology handbooks.',
  },
  {
    id: 6,
    name: 'Senior High School Core',
    code: 'SHS-500',
    shelfZone: 'Wing D · Shelves 1–8',
    description:
      'DepEd K-12 Senior High School textbooks across STEM, ABM, HUMSS, and TVL tracks.',
  },
];

let fallbackBooks = [
  {
    id: 1,
    title: 'Philippine History and Heritage: Evolution of Nationhood',
    author: 'Dr. Teodoro A. Agoncillo & Prof. Maria C. Santos',
    isbn: '978-971-542-812-4',
    subject: 'Philippine History',
    category: 'Filipiñana & History',
    publisher: 'University of the Philippines Press',
    publicationYear: 2024,
    shelfLocation: 'Wing A · Shelf 1A',
    totalCopies: 18,
    availableCopies: 14,
    description:
      'Comprehensive chronicle of Philippine pre-colonial societies, Spanish and American periods, Commonwealth, and contemporary Surigao del Sur regional history.',
    coverKey: 'history',
  },
  {
    id: 2,
    title: 'Earth and Applied Sciences for Senior High School STEM',
    author: 'Dr. Eliza M. Reed & Prof. James R. Kline',
    isbn: '978-971-063-945-8',
    subject: 'Earth & Life Science',
    category: 'Science & Technology',
    publisher: 'Rex Book Store Academic',
    publicationYear: 2025,
    shelfLocation: 'Wing B · Shelf 2B',
    totalCopies: 25,
    availableCopies: 19,
    description:
      'Aligned with the DepEd K-12 STEM curriculum covering plate tectonics, Philippine fault systems, coastal marine ecosystems of Hinatuan and Barobo, and atmospheric science.',
    coverKey: 'science',
  },
  {
    id: 3,
    title: 'Noli Me Tangere & El Filibusterismo: Critical Annotated Edition',
    author: 'Dr. José P. Rizal (Trans. Virgilio S. Almario)',
    isbn: '978-971-508-391-1',
    subject: 'Filipino Literature',
    category: 'Filipiñana & History',
    publisher: 'Adarna House & Komisyon sa Wikang Filipino',
    publicationYear: 2023,
    shelfLocation: 'Wing A · Shelf 3C',
    totalCopies: 30,
    availableCopies: 22,
    description:
      'Bilingual critical edition for Grade 9 and Grade 10 Filipino classes with historical footnotes, chapter vocabulary, and socio-political essays.',
    coverKey: 'history',
  },
  {
    id: 4,
    title: 'Practical Research 2: Quantitative Inquiry and Statistical Analysis',
    author: 'Dr. Esther L. Baraceros',
    isbn: '978-971-238-071-6',
    subject: 'Research Methodology',
    category: 'General Reference & Research',
    publisher: 'Vibal Group Publishing',
    publicationYear: 2025,
    shelfLocation: 'Central Hall · Shelf 1R',
    totalCopies: 20,
    availableCopies: 15,
    description:
      'Step-by-step handbook for BNHS Senior High School student researchers covering sampling design, instrument validation, SPSS/R data processing, and APA 7th citation.',
    coverKey: 'science',
  },
  {
    id: 5,
    title: 'Pre-Calculus and Analytic Geometry for STEM Learners',
    author: 'Prof. Fernando B. Orines & Dr. Zenaida E. Diaz',
    isbn: '978-971-960-442-0',
    subject: 'Mathematics',
    category: 'Mathematics & Analytics',
    publisher: 'Phoenix Publishing House',
    publicationYear: 2024,
    shelfLocation: 'Wing B · Shelf 7A',
    totalCopies: 22,
    availableCopies: 18,
    description:
      'Rigorous treatment of conic sections, systems of nonlinear equations, series and mathematical induction, and circular trigonometric functions.',
    coverKey: 'science',
  },
  {
    id: 6,
    title: '21st Century Literature from the Philippines and the World',
    author: 'Dr. Marikit Tara A. Uychoco',
    isbn: '978-971-237-819-5',
    subject: 'World & Philippine Literature',
    category: 'Literature & Humanities',
    publisher: 'Rex Book Store',
    publicationYear: 2024,
    shelfLocation: 'Wing C · Shelf 2A',
    totalCopies: 24,
    availableCopies: 20,
    description:
      'Anthology of contemporary Mindanaoan, Visayan, and Luzon literary voices alongside global speculative fiction, poetry, and digital essays.',
    coverKey: 'history',
  },
  {
    id: 7,
    title: 'General Biology 1: Cellular Energetics and Genetics',
    author: 'Dr. Anna Cherylle M. Ramos & John Donnie A. Ramos',
    isbn: '978-971-064-112-3',
    subject: 'General Biology',
    category: 'Science & Technology',
    publisher: 'C & E Publishing',
    publicationYear: 2025,
    shelfLocation: 'Wing B · Shelf 4A',
    totalCopies: 16,
    availableCopies: 12,
    description:
      'Laboratory-integrated textbook exploring cell ultrastructure, mitosis and meiosis, Mendelian inheritance, and biodiversity conservation.',
    coverKey: 'science',
  },
  {
    id: 8,
    title: 'Fundamentals of Accountancy, Business, and Management 1',
    author: 'Prof. Flocerlao C. Ong',
    isbn: '978-971-980-611-4',
    subject: 'Accountancy & Business',
    category: 'Senior High School Core',
    publisher: 'C & E Publishing',
    publicationYear: 2024,
    shelfLocation: 'Wing D · Shelf 3B',
    totalCopies: 15,
    availableCopies: 15,
    description:
      'Complete introduction to double-entry bookkeeping, journalizing, ledger posting, trial balance preparation, and Philippine merchandising operations.',
    coverKey: 'history',
  },
  {
    id: 9,
    title: 'Web Systems with HTML5, CSS3, Bootstrap, PHP & MySQL',
    author: 'Engr. Roberto D. Villanueva',
    isbn: '978-971-889-304-9',
    subject: 'Information & Communications Technology',
    category: 'Science & Technology',
    publisher: 'Mindshapers Co., Inc.',
    publicationYear: 2025,
    shelfLocation: 'Wing B · Shelf 6C',
    totalCopies: 12,
    availableCopies: 9,
    description:
      'Hands-on guide for TVL-ICT students building school portals, XAMPP local server deployments, relational database design, and responsive web interfaces.',
    coverKey: 'science',
  },
  {
    id: 10,
    title: 'Caraga Region Cultural History & Surigao del Sur Chronicles',
    author: 'Barobo Historical & Cultural Society',
    isbn: '978-971-954-201-7',
    subject: 'Local History',
    category: 'Filipiñana & History',
    publisher: 'Mindanao State Academic Press',
    publicationYear: 2023,
    shelfLocation: 'Wing A · Shelf 1B',
    totalCopies: 10,
    availableCopies: 8,
    description:
      'Archival compilation of municipal histories across Barobo, Lianga, Hinatuan, Bislig, and Tandag with oral histories and primary photographs.',
    coverKey: 'history',
  },
];

let fallbackBorrows = [
  {
    id: 1,
    transactionCode: 'TRX-2026-1081',
    bookId: 1,
    borrowerUid: 'student-bnhs-01',
    borrowerName: 'Althea Mae C. Villaruel',
    borrowerRole: 'Student',
    borrowerIdNumber: 'LRN-132604180021',
    issueDate: '2026-10-30',
    dueDate: '2026-11-13',
    returnDate: null as string | null,
    status: 'Borrowed',
    remarks: 'Grade 12 STEM Research Reference',
  },
  {
    id: 2,
    transactionCode: 'TRX-2026-1082',
    bookId: 2,
    borrowerUid: 'teacher-bnhs-01',
    borrowerName: 'Mr. Ronald P. Mercader',
    borrowerRole: 'Teacher',
    borrowerIdNumber: 'EMP-2019-0442',
    issueDate: '2026-10-20',
    dueDate: '2026-11-05',
    returnDate: null as string | null,
    status: 'Borrowed',
    remarks: 'Science Department Faculty Loan',
  },
  {
    id: 3,
    transactionCode: 'TRX-2026-1083',
    bookId: 4,
    borrowerUid: 'student-bnhs-02',
    borrowerName: 'Christian Jay B. Montes',
    borrowerRole: 'Student',
    borrowerIdNumber: 'LRN-132604180089',
    issueDate: '2026-10-02',
    dueDate: '2026-10-16',
    returnDate: null as string | null,
    status: 'Overdue',
    remarks: 'Reminder notice sent via adviser',
  },
  {
    id: 4,
    transactionCode: 'TRX-2026-1084',
    bookId: 3,
    borrowerUid: 'student-bnhs-03',
    borrowerName: 'Princess Joy D. Lumantas',
    borrowerRole: 'Student',
    borrowerIdNumber: 'LRN-132604190114',
    issueDate: '2026-10-10',
    dueDate: '2026-10-24',
    returnDate: '2026-10-22',
    status: 'Returned',
    remarks: 'Returned in good condition',
  },
  {
    id: 5,
    transactionCode: 'TRX-2026-1085',
    bookId: 9,
    borrowerUid: 'student-bnhs-04',
    borrowerName: 'Kenneth Carl R. Balinton',
    borrowerRole: 'Student',
    borrowerIdNumber: 'LRN-132604180205',
    issueDate: '2026-10-31',
    dueDate: '2026-11-14',
    returnDate: null as string | null,
    status: 'Borrowed',
    remarks: 'TVL-ICT Capstone Project Reference',
  },
  {
    id: 6,
    transactionCode: 'TRX-2026-1086',
    bookId: 5,
    borrowerUid: 'student-bnhs-05',
    borrowerName: 'Jessa Mae L. Urbiztondo',
    borrowerRole: 'Student',
    borrowerIdNumber: 'LRN-132604180312',
    issueDate: '2026-09-28',
    dueDate: '2026-10-12',
    returnDate: null as string | null,
    status: 'Overdue',
    remarks: 'Follow-up with Grade 11 STEM adviser',
  },
];

let fallbackDigitalResources = [
  {
    id: 1,
    title: 'DepEd Senior High School Practical Research 2 Self-Learning Module (Quarters 1–2)',
    author: 'DepEd Caraga Regional Office — Curriculum & Learning Management Division',
    resourceType: 'Module',
    subject: 'Practical Research 2',
    gradeLevel: 'Grade 12 (All Tracks)',
    fileSize: '4.8 MB PDF',
    pageCount: 64,
    downloadCount: 342,
    summary:
      'Official DepEd self-learning module covering nature of quantitative inquiry, identifying variables, formulating conceptual frameworks, and hypothesis testing.',
    contentPreview:
      'MODULE 1: NATURE OF INQUIRY AND RESEARCH\n\nQuantitative research uses scientifically collected and statistically analyzed data to investigate observable phenomena at Barobo National High School and the broader Caraga community.',
    externalUrl: '#module-pr2',
    uploadedBy: 'Mrs. Elena G. Cañete (Head Librarian)',
  },
  {
    id: 2,
    title: 'Barobo National High School Student Research Compendium (Vol. 8, AY 2025–2026)',
    author: 'BNHS Senior High School Research Committee',
    resourceType: 'Journal',
    subject: 'Multidisciplinary Research',
    gradeLevel: 'Grade 11–12',
    fileSize: '6.2 MB PDF',
    pageCount: 92,
    downloadCount: 218,
    summary:
      'Peer-reviewed compilation of best student capstone and quantitative studies from STEM, ABM, HUMSS, and TVL strands at BNHS.',
    contentPreview:
      'BAROBO NATIONAL HIGH SCHOOL RESEARCH COMPENDIUM — VOLUME 8\n\nFeatured Studies:\n• Automated Library Cataloging & Circulation Tracking for Public Secondary Schools in Surigao del Sur',
    externalUrl: '#journal-bnhs-v8',
    uploadedBy: 'Dr. Noel V. Salazar (Research Coordinator)',
  },
  {
    id: 3,
    title: 'General Mathematics & Statistics Formula Handbook for JHS and SHS',
    author: 'BNHS Mathematics Department',
    resourceType: 'PDF Learning Material',
    subject: 'Mathematics',
    gradeLevel: 'Grades 9–12',
    fileSize: '2.4 MB PDF',
    pageCount: 38,
    downloadCount: 419,
    summary:
      'Quick-reference compilation of functions, business mathematics, annuities, normal distribution tables, t-test, ANOVA, and Pearson r formulas.',
    contentPreview:
      'BNHS MATHEMATICS DEPARTMENT REFERENCE GUIDE\n\nSection 1: Rational, Exponential & Logarithmic Functions\nSection 2: Simple & Compound Interest, Annuities, Stocks & Bonds',
    externalUrl: '#math-handbook',
    uploadedBy: 'Mrs. Elena G. Cañete (Head Librarian)',
  },
  {
    id: 4,
    title: 'Philippine Literature & Caraga Folk Narratives E-Book Anthology',
    author: 'Komisyon sa Wikang Filipino & DepEd Surigao del Sur',
    resourceType: 'E-Book',
    subject: 'Literature & Humanities',
    gradeLevel: 'Grades 7–12',
    fileSize: '5.1 MB EPUB/PDF',
    pageCount: 110,
    downloadCount: 187,
    summary:
      'Digital anthology featuring Kamayo, Surigaonon, and Manobo oral epics, contemporary Mindanaoan short stories, and critical annotations.',
    contentPreview:
      'PART I: ORAL TRADITIONS OF SURIGAO DEL SUR & CARAGA\n\nThis e-book preserves local narratives from Barobo, Hinatuan, Lianga, and Tagbina.',
    externalUrl: '#caraga-ebook',
    uploadedBy: 'Ms. Marissa T. Ocampo (Filipino Dept.)',
  },
  {
    id: 5,
    title: 'Full-Stack Web Development with PHP, MySQL & XAMPP Laboratory Manual',
    author: 'BNHS TVL-ICT Track Faculty',
    resourceType: 'PDF Learning Material',
    subject: 'ICT & Computer Programming',
    gradeLevel: 'Grades 11–12 TVL-ICT',
    fileSize: '3.9 MB PDF',
    pageCount: 54,
    downloadCount: 276,
    summary:
      'Step-by-step laboratory exercises on configuring Apache and MySQL in XAMPP, designing normalized relational tables, and writing secure PDO CRUD queries.',
    contentPreview:
      'LABORATORY MANUAL: DATABASE-DRIVEN WEB SYSTEMS (PHP & MySQL)\n\nLab 1: Starting Apache & MySQL Services in XAMPP Control Panel',
    externalUrl: '#ict-lab-manual',
    uploadedBy: 'Engr. Dennis A. Cortez (ICT Coordinator)',
  },
  {
    id: 6,
    title: 'APA 7th Edition Citation, Bibliography & Academic Integrity Style Guide',
    author: 'BNHS Library & Information Services',
    resourceType: 'Reference',
    subject: 'Research & Academic Writing',
    gradeLevel: 'All Grade Levels',
    fileSize: '1.6 MB PDF',
    pageCount: 24,
    downloadCount: 512,
    summary:
      'Official BNHS citation manual with examples for books, journal articles, DepEd orders, government statutes, and online digital repositories.',
    contentPreview:
      'BNHS OFFICIAL APA 7TH EDITION STYLE GUIDE\n\n1. In-Text Citations (Author-Date System)\n2. Reference List Formatting Rules',
    externalUrl: '#apa7-guide',
    uploadedBy: 'Mrs. Elena G. Cañete (Head Librarian)',
  },
];

let fallbackUsers = [
  {
    id: 1,
    uid: 'bnhs-admin-bless',
    email: 'blesstajale@gmail.com',
    fullName: 'Bless T. Tajale',
    role: 'Administrator',
    idNumber: 'ADM-2026-0001',
    gradeOrDepartment: 'Portal Developer & System Administration',
    status: 'Active',
  },
  {
    id: 2,
    uid: 'seed-librarian-1',
    email: 'elena.canete@bnhs.edu.ph',
    fullName: 'Mrs. Elena G. Cañete',
    role: 'Librarian',
    idNumber: 'LIB-2018-0012',
    gradeOrDepartment: 'Library & Information Services',
    status: 'Active',
  },
  {
    id: 3,
    uid: 'seed-teacher-1',
    email: 'ronald.mercader@bnhs.edu.ph',
    fullName: 'Mr. Ronald P. Mercader',
    role: 'Teacher',
    idNumber: 'EMP-2019-0442',
    gradeOrDepartment: 'SHS STEM Science Department',
    status: 'Active',
  },
  {
    id: 4,
    uid: 'seed-student-1',
    email: 'althea.villaruel@student.bnhs.edu.ph',
    fullName: 'Althea Mae C. Villaruel',
    role: 'Student',
    idNumber: 'LRN-132604180021',
    gradeOrDepartment: 'Grade 12 - STEM A',
    status: 'Active',
  },
  {
    id: 5,
    uid: 'seed-student-2',
    email: 'christian.montes@student.bnhs.edu.ph',
    fullName: 'Christian Jay B. Montes',
    role: 'Student',
    idNumber: 'LRN-132604180089',
    gradeOrDepartment: 'Grade 12 - ABM B',
    status: 'Active',
  },
  {
    id: 6,
    uid: 'seed-student-3',
    email: 'kenneth.balinton@student.bnhs.edu.ph',
    fullName: 'Kenneth Carl R. Balinton',
    role: 'Student',
    idNumber: 'LRN-132604180205',
    gradeOrDepartment: 'Grade 12 - TVL-ICT',
    status: 'Active',
  },
];

function buildFallbackOverview() {
  const totalRegisteredCopies = fallbackBooks.reduce(
    (sum, b) => sum + Number(b.totalCopies || 0),
    0
  );
  const availableCopiesCount = fallbackBooks.reduce(
    (sum, b) => sum + Number(b.availableCopies || 0),
    0
  );
  const activeBorrowedCount = fallbackBorrows.filter(
    (r) => r.status === 'Borrowed' || r.status === 'Overdue'
  ).length;
  const overdueCount = fallbackBorrows.filter(
    (r) => r.status === 'Overdue'
  ).length;

  return {
    stats: {
      totalTitles: fallbackBooks.length,
      totalRegisteredCopies,
      availableCopiesCount,
      activeBorrowedCount,
      overdueCount,
      digitalResourcesCount: fallbackDigitalResources.length,
      totalUsersCount: fallbackUsers.length,
    },
    books: fallbackBooks,
    borrowRecords: fallbackBorrows,
    digitalResources: fallbackDigitalResources,
    categories: fallbackCategories,
    users: fallbackUsers,
  };
}

async function safeGetOverviewPayload() {
  try {
    const [data, portalSettings, waitlistRequests] = await Promise.all([
      getLibraryOverviewData(),
      getPortalSyncStateRecord('portal_settings', fallbackPortalSettings),
      getPortalSyncStateRecord('waitlist_requests', fallbackWaitlistRequests),
    ]);
    fallbackPortalSettings = portalSettings;
    fallbackWaitlistRequests = waitlistRequests;
    if (Array.isArray(data.users) && data.users.length > 0) {
      fallbackUsers = data.users;
    }
    if (Array.isArray(data.books) && data.books.length > 0) {
      fallbackBooks = data.books;
    }
    if (Array.isArray(data.categories) && data.categories.length > 0) {
      fallbackCategories = data.categories;
    }
    if (Array.isArray(data.borrowRecords) && data.borrowRecords.length > 0) {
      fallbackBorrows = data.borrowRecords;
    }
    if (Array.isArray(data.digitalResources) && data.digitalResources.length > 0) {
      fallbackDigitalResources = data.digitalResources;
    }
    return {
      ...data,
      portalSettings,
      waitlistRequests,
      syncedAt: new Date().toISOString(),
    };
  } catch (_err) {
    return {
      ...buildFallbackOverview(),
      portalSettings: fallbackPortalSettings,
      waitlistRequests: fallbackWaitlistRequests,
      syncedAt: new Date().toISOString(),
    };
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));

  // Serve images & animated GIFs from both /src/assets and /assets in all environments (dev + published live)
  app.use('/src/assets', express.static(path.join(__dirname, 'src/assets')));
  app.use('/assets', express.static(path.join(__dirname, 'public/assets')));

  app.get('/api/library/overview', async (_req, res) => {
    const payload = await safeGetOverviewPayload();
    res.json(payload);
  });

  // Update Portal Settings (Hero Image, Logo, Schedule Text, Title) — Auto-saved to Cloud SQL + memory
  app.put('/api/portal-settings', requireAuth, async (req: AuthRequest, res) => {
    fallbackPortalSettings = {
      ...fallbackPortalSettings,
      ...req.body,
    };
    try {
      await upsertPortalSyncStateRecord(
        'portal_settings',
        fallbackPortalSettings
      );
    } catch (_err) {
      // Fallback memory updated
    }
    res.json({
      portalSettings: fallbackPortalSettings,
      syncedAt: new Date().toISOString(),
    });
  });

  // Request notification when a borrowed book is returned — Auto-saved to Cloud SQL + memory
  app.post('/api/waitlist', requireAuth, async (req: AuthRequest, res) => {
    const { bookId, bookTitle, studentName, studentIdNumber } = req.body;
    const newReq: BookWaitlistRequest = {
      id: Date.now(),
      bookId: Number(bookId),
      bookTitle,
      studentName: studentName || 'Althea Mae C. Villaruel',
      studentIdNumber: studentIdNumber || 'LRN-132604180021',
      requestedAt: new Date().toISOString().split('T')[0],
      fulfilled: false,
    };
    fallbackWaitlistRequests = [newReq, ...fallbackWaitlistRequests];
    try {
      await upsertPortalSyncStateRecord(
        'waitlist_requests',
        fallbackWaitlistRequests
      );
    } catch (_err) {
      // Fallback memory updated
    }
    res.status(201).json({
      request: newReq,
      waitlistRequests: fallbackWaitlistRequests,
      syncedAt: new Date().toISOString(),
    });
  });

  // Explicit Cloud Sync endpoint for manual or background auto-sync
  app.post('/api/cloud-sync', async (req, res) => {
    if (req.body?.portalSettings) {
      fallbackPortalSettings = {
        ...fallbackPortalSettings,
        ...req.body.portalSettings,
      };
      try {
        await upsertPortalSyncStateRecord(
          'portal_settings',
          fallbackPortalSettings
        );
      } catch (_err) {
        // Fallback memory updated
      }
    }
    const payload = await safeGetOverviewPayload();
    res.json(payload);
  });

  app.post('/api/auth/sync', requireAuth, async (req: AuthRequest, res) => {
    const uid = req.user!.uid;
    const email = req.user!.email || 'blesstajale@gmail.com';
    const name = req.user!.name || req.body?.displayName || 'Bless T. Tajale';
    try {
      const dbUser = await getOrCreateUser(uid, email, name);
      res.json({ user: dbUser });
    } catch (_error) {
      let existing = fallbackUsers.find(
        (u) => u.uid === uid || u.email.toLowerCase() === email.toLowerCase()
      );
      if (!existing) {
        existing = {
          id: Date.now(),
          uid,
          email,
          fullName: name,
          role: 'Administrator',
          idNumber: `BNHS-2026-${Math.floor(1000 + Math.random() * 9000)}`,
          gradeOrDepartment: 'Library & Information Services',
          status: 'Active',
        };
        fallbackUsers = [existing, ...fallbackUsers];
      }
      res.json({ user: existing });
    }
  });

  app.post('/api/books', requireAuth, async (req: AuthRequest, res) => {
    try {
      const book = await createBookRecord(req.body);
      res.status(201).json({ book });
    } catch (_error) {
      const newBook = {
        id: Date.now(),
        title: req.body.title,
        author: req.body.author,
        isbn: req.body.isbn || `978-971-${Date.now().toString().slice(-6)}`,
        subject: req.body.subject || 'General',
        category: req.body.category || 'Filipiñana & History',
        publisher: req.body.publisher || 'BNHS Academic Press',
        publicationYear: Number(req.body.publicationYear) || 2026,
        shelfLocation: req.body.shelfLocation || 'Wing A · Shelf 1A',
        totalCopies: Number(req.body.totalCopies) || 1,
        availableCopies: Number(req.body.totalCopies) || 1,
        description: req.body.description || '',
        coverKey: req.body.coverKey || 'history',
      };
      fallbackBooks = [newBook, ...fallbackBooks];
      res.status(201).json({ book: newBook });
    }
  });

  app.put('/api/books/:id', requireAuth, async (req: AuthRequest, res) => {
    const bookId = Number(req.params.id);
    try {
      const book = await updateBookRecord(bookId, req.body);
      res.json({ book });
    } catch (_error) {
      fallbackBooks = fallbackBooks.map((b) =>
        b.id === bookId ? { ...b, ...req.body } : b
      );
      const updated = fallbackBooks.find((b) => b.id === bookId);
      res.json({ book: updated });
    }
  });

  app.delete('/api/books/:id', requireAuth, async (req: AuthRequest, res) => {
    const bookId = Number(req.params.id);
    try {
      const deleted = await deleteBookRecord(bookId);
      res.json({ deleted });
    } catch (_error) {
      const deleted = fallbackBooks.find((b) => b.id === bookId);
      fallbackBooks = fallbackBooks.filter((b) => b.id !== bookId);
      fallbackBorrows = fallbackBorrows.filter((r) => r.bookId !== bookId);
      res.json({ deleted });
    }
  });

  app.post('/api/borrows', requireAuth, async (req: AuthRequest, res) => {
    try {
      const record = await issueBookBorrow({
        ...req.body,
        borrowerUid: req.body.borrowerUid || req.user!.uid,
      });
      res.status(201).json({ record });
    } catch (_error) {
      const bookId = Number(req.body.bookId);
      fallbackBooks = fallbackBooks.map((b) =>
        b.id === bookId
          ? { ...b, availableCopies: Math.max(0, b.availableCopies - 1) }
          : b
      );
      const newRec = {
        id: Date.now(),
        transactionCode: `TRX-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        bookId,
        borrowerUid: req.body.borrowerUid || req.user!.uid,
        borrowerName: req.body.borrowerName,
        borrowerRole: req.body.borrowerRole || 'Student',
        borrowerIdNumber: req.body.borrowerIdNumber || 'LRN-132604180021',
        issueDate: req.body.issueDate,
        dueDate: req.body.dueDate,
        returnDate: null,
        status: 'Borrowed',
        remarks: req.body.remarks || 'Standard circulation',
      };
      fallbackBorrows = [newRec, ...fallbackBorrows];
      res.status(201).json({ record: newRec });
    }
  });

  app.patch('/api/borrows/:id/return', requireAuth, async (req: AuthRequest, res) => {
    const recordId = Number(req.params.id);
    const returnDate =
      req.body?.returnDate || new Date().toISOString().split('T')[0];
    try {
      const record = await returnBorrowedBook(recordId, returnDate);
      fallbackWaitlistRequests = fallbackWaitlistRequests.map((w) =>
        w.bookId === record.bookId && !w.fulfilled
          ? { ...w, fulfilled: true, returnedAt: returnDate }
          : w
      );
      try {
        await upsertPortalSyncStateRecord(
          'waitlist_requests',
          fallbackWaitlistRequests
        );
      } catch (_e) {
        // ignore
      }
      res.json({ record, waitlistRequests: fallbackWaitlistRequests });
    } catch (_error) {
      let returnedBookId = 0;
      fallbackBorrows = fallbackBorrows.map((r) => {
        if (r.id === recordId) {
          returnedBookId = r.bookId;
          return { ...r, status: 'Returned', returnDate };
        }
        return r;
      });
      if (returnedBookId) {
        fallbackBooks = fallbackBooks.map((b) =>
          b.id === returnedBookId
            ? { ...b, availableCopies: Math.min(b.totalCopies, b.availableCopies + 1) }
            : b
        );
        fallbackWaitlistRequests = fallbackWaitlistRequests.map((w) =>
          w.bookId === returnedBookId && !w.fulfilled
            ? { ...w, fulfilled: true, returnedAt: returnDate }
            : w
        );
      }
      const updated = fallbackBorrows.find((r) => r.id === recordId);
      res.json({ record: updated, waitlistRequests: fallbackWaitlistRequests });
    }
  });

  app.patch('/api/borrows/:id/overdue', requireAuth, async (req: AuthRequest, res) => {
    const recordId = Number(req.params.id);
    try {
      const record = await markBorrowOverdue(recordId);
      res.json({ record });
    } catch (_error) {
      fallbackBorrows = fallbackBorrows.map((r) =>
        r.id === recordId ? { ...r, status: 'Overdue' } : r
      );
      res.json({ record: fallbackBorrows.find((r) => r.id === recordId) });
    }
  });

  app.post('/api/digital-resources', requireAuth, async (req: AuthRequest, res) => {
    try {
      const resource = await createDigitalResourceRecord(req.body);
      res.status(201).json({ resource });
    } catch (_error) {
      const newRes = {
        id: Date.now(),
        title: req.body.title,
        author: req.body.author,
        resourceType: req.body.resourceType || 'PDF Learning Material',
        subject: req.body.subject || 'General',
        gradeLevel: req.body.gradeLevel || 'All Grade Levels',
        fileSize: req.body.fileSize || '2.5 MB PDF',
        pageCount: Number(req.body.pageCount) || 32,
        downloadCount: 1,
        summary: req.body.summary || '',
        contentPreview: req.body.contentPreview || '',
        externalUrl: req.body.externalUrl || '#digital-resource',
        uploadedBy: req.body.uploadedBy || 'BNHS Librarian',
      };
      fallbackDigitalResources = [newRes, ...fallbackDigitalResources];
      res.status(201).json({ resource: newRes });
    }
  });

  app.put('/api/digital-resources/:id', requireAuth, async (req: AuthRequest, res) => {
    const resourceId = Number(req.params.id);
    try {
      const resource = await updateDigitalResourceRecord(resourceId, req.body);
      res.json({ resource });
    } catch (_error) {
      fallbackDigitalResources = fallbackDigitalResources.map((r) =>
        r.id === resourceId ? { ...r, ...req.body } : r
      );
      res.json({
        resource: fallbackDigitalResources.find((r) => r.id === resourceId),
      });
    }
  });

  app.delete('/api/digital-resources/:id', requireAuth, async (req: AuthRequest, res) => {
    const resourceId = Number(req.params.id);
    try {
      const deleted = await deleteDigitalResourceRecord(resourceId);
      res.json({ deleted });
    } catch (_error) {
      const deleted = fallbackDigitalResources.find((r) => r.id === resourceId);
      fallbackDigitalResources = fallbackDigitalResources.filter(
        (r) => r.id !== resourceId
      );
      res.json({ deleted });
    }
  });

  app.post('/api/digital-resources/:id/download', async (req, res) => {
    const resourceId = Number(req.params.id);
    try {
      const resource = await incrementDigitalDownload(resourceId);
      res.json({ resource });
    } catch (_error) {
      fallbackDigitalResources = fallbackDigitalResources.map((r) =>
        r.id === resourceId ? { ...r, downloadCount: r.downloadCount + 1 } : r
      );
      res.json({
        resource: fallbackDigitalResources.find((r) => r.id === resourceId),
      });
    }
  });

  app.post('/api/categories', requireAuth, async (req: AuthRequest, res) => {
    try {
      const category = await createCategoryRecord(req.body);
      res.status(201).json({ category });
    } catch (_error) {
      const newCat = {
        id: Date.now(),
        name: req.body.name,
        code: req.body.code,
        shelfZone: req.body.shelfZone,
        description: req.body.description,
      };
      fallbackCategories = [...fallbackCategories, newCat];
      res.status(201).json({ category: newCat });
    }
  });

  app.put('/api/categories/:id', requireAuth, async (req: AuthRequest, res) => {
    const categoryId = Number(req.params.id);
    try {
      const category = await updateCategoryRecord(categoryId, req.body);
      res.json({ category });
    } catch (_error) {
      fallbackCategories = fallbackCategories.map((c) =>
        c.id === categoryId ? { ...c, ...req.body } : c
      );
      res.json({
        category: fallbackCategories.find((c) => c.id === categoryId),
      });
    }
  });

  app.delete('/api/categories/:id', requireAuth, async (req: AuthRequest, res) => {
    const categoryId = Number(req.params.id);
    try {
      const deleted = await deleteCategoryRecord(categoryId);
      res.json({ deleted });
    } catch (_error) {
      const deleted = fallbackCategories.find((c) => c.id === categoryId);
      fallbackCategories = fallbackCategories.filter((c) => c.id !== categoryId);
      res.json({ deleted });
    }
  });

  app.patch('/api/users/:id/role', requireAuth, async (req: AuthRequest, res) => {
    const userId = Number(req.params.id);
    const { role, gradeOrDepartment } = req.body;
    fallbackUsers = fallbackUsers.map((u) =>
      u.id === userId
        ? { ...u, role, ...(gradeOrDepartment ? { gradeOrDepartment } : {}) }
        : u
    );
    try {
      const updated = await updateUserRoleRecord(userId, role, gradeOrDepartment);
      if (updated) {
        fallbackUsers = fallbackUsers.map((u) =>
          u.id === userId ? { ...u, ...updated } : u
        );
      }
      res.json({ user: updated || fallbackUsers.find((u) => u.id === userId) });
    } catch (_error) {
      res.json({ user: fallbackUsers.find((u) => u.id === userId) });
    }
  });

  app.put('/api/users/:id', requireAuth, async (req: AuthRequest, res) => {
    const userId = Number(req.params.id);
    const prevFallback = fallbackUsers.find(
      (u) => u.id === userId || (req.body.uid && u.uid === req.body.uid)
    );
    fallbackUsers = fallbackUsers.map((u) =>
      u.id === userId || (req.body.uid && u.uid === req.body.uid)
        ? { ...u, ...req.body }
        : u
    );
    if (
      prevFallback &&
      req.body.fullName &&
      prevFallback.fullName !== req.body.fullName
    ) {
      fallbackBorrows = fallbackBorrows.map((r) =>
        r.borrowerName === prevFallback.fullName
          ? {
              ...r,
              borrowerName: req.body.fullName,
              borrowerIdNumber: req.body.idNumber || r.borrowerIdNumber,
            }
          : r
      );
    }
    try {
      const updated = await updateUserRecord(userId, req.body);
      if (updated) {
        fallbackUsers = fallbackUsers.map((u) =>
          u.id === userId || u.id === updated.id || u.uid === updated.uid
            ? { ...u, ...updated }
            : u
        );
      }
      res.json({
        user:
          updated ||
          fallbackUsers.find(
            (u) => u.id === userId || (req.body.uid && u.uid === req.body.uid)
          ),
      });
    } catch (_error) {
      res.json({
        user: fallbackUsers.find(
          (u) => u.id === userId || (req.body.uid && u.uid === req.body.uid)
        ),
      });
    }
  });

  app.delete('/api/users/:id', requireAuth, async (req: AuthRequest, res) => {
    const userId = Number(req.params.id);
    const targetUid =
      (req.query.uid as string | undefined) ||
      req.body?.uid ||
      fallbackUsers.find((u) => u.id === userId)?.uid;
    const deletedFallback = fallbackUsers.find(
      (u) => u.id === userId || (targetUid && u.uid === targetUid)
    );
    fallbackUsers = fallbackUsers.filter(
      (u) => u.id !== userId && (!targetUid || u.uid !== targetUid)
    );
    try {
      const deleted = await deleteUserRecord(userId, targetUid);
      res.json({ deleted: deleted || deletedFallback });
    } catch (_error) {
      res.json({ deleted: deletedFallback });
    }
  });

  app.post('/api/users', requireAuth, async (req: AuthRequest, res) => {
    try {
      const newUser = await createLibraryMemberRecord(req.body);
      fallbackUsers = [newUser, ...fallbackUsers];
      res.status(201).json({ user: newUser });
    } catch (_error) {
      const newUser = {
        id: Date.now(),
        uid: `bnhs-member-${Date.now()}`,
        email: req.body.email,
        fullName: req.body.fullName,
        role: req.body.role || 'Student',
        idNumber: req.body.idNumber,
        gradeOrDepartment: req.body.gradeOrDepartment,
        status: 'Active',
      };
      fallbackUsers = [newUser, ...fallbackUsers];
      res.status(201).json({ user: newUser });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    process.env.DISABLE_HMR = 'true';
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, watch: null },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BNHS Library Portal Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
