import {
  BookItem,
  BorrowRecord,
  DigitalResource,
  BookCategory,
  LibraryUser,
  LibraryStats,
  BookWaitlistRequest,
  PortalSettings,
} from '../types.ts';

import heroBannerAsset from '../assets/images/bnhs_library_hero_1794464935499.jpg';
import logoAnimatedGifAsset from '../assets/images/bnhs_1978_official_logo_animated.gif';
import logoStaticJpgAsset from '../assets/images/bnhs_1978_official_logo_1794467717794.jpg';
import coverHistoryAsset from '../assets/images/cover_philippine_history_1794464937629.jpg';
import coverScienceAsset from '../assets/images/cover_applied_sciences_1794464940290.jpg';
import crestEmblemAsset from '../assets/images/bnhs_crest_emblem_1794464936109.jpg';

export const BUNDLED_ASSETS = {
  heroBanner: heroBannerAsset,
  logoAnimatedGif: logoAnimatedGifAsset,
  logoStaticJpg: logoStaticJpgAsset,
  coverHistory: coverHistoryAsset,
  coverScience: coverScienceAsset,
  crestEmblem: crestEmblemAsset,
};

/**
 * Resolves any stored `/src/assets/images/...` path to the Vite-bundled asset URL
 * so images and animated GIF logos always render in both development and published live builds.
 */
export function resolvePortalAssetUrl(rawUrl: string | undefined | null, fallbackUrl: string): string {
  if (!rawUrl || !rawUrl.trim()) return fallbackUrl;
  const trimmed = rawUrl.trim();
  if (trimmed.includes('bnhs_1978_official_logo_animated.gif') || trimmed.includes('BNHS_LOGO_animated.gif')) {
    return logoAnimatedGifAsset;
  }
  if (trimmed.includes('bnhs_1978_official_logo_1794467717794.jpg') || trimmed.includes('BNHS_LOGO_29bb7e4c.jpg')) {
    return logoStaticJpgAsset;
  }
  if (trimmed.includes('bnhs_library_hero_1794464935499.jpg')) {
    return heroBannerAsset;
  }
  if (trimmed.includes('cover_philippine_history_1794464937629.jpg')) {
    return coverHistoryAsset;
  }
  if (trimmed.includes('cover_applied_sciences_1794464940290.jpg')) {
    return coverScienceAsset;
  }
  if (trimmed.includes('bnhs_crest_emblem_1794464936109.jpg')) {
    return crestEmblemAsset;
  }
  return trimmed;
}

export const INITIAL_PORTAL_SETTINGS: PortalSettings = {
  portalTitle:
    'Barobo National High School (BNHS) Library Portal developed by: Bless T. Tajale',
  welcomeHeading: 'Welcome to the BNHS Library Portal',
  welcomeSubtext:
    'Centralized online library management system where students, teachers, librarians, and administrators search catalog holdings, track book loans, and access DepEd digital learning materials.',
  scheduleBannerText: 'Academic Year 2026–2027 · Open Mon–Fri, 7:30 AM – 5:00 PM',
  heroImageUrl: heroBannerAsset,
  logoImageUrl: logoAnimatedGifAsset,
};

export const INITIAL_CATEGORIES: BookCategory[] = [
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

export const INITIAL_BOOKS: BookItem[] = [
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

export const INITIAL_BORROW_RECORDS: BorrowRecord[] = [
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
    returnDate: null,
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
    returnDate: null,
    status: 'Borrowed',
    remarks: 'Science Department Faculty Loan',
  },
  {
    id: 3,
    transactionCode: 'TRX-2026-1083',
    bookId: 4,
    borrowerUid: 'student-bnhs-02',
    borrowerName: 'Christian Jay B.Montes',
    borrowerRole: 'Student',
    borrowerIdNumber: 'LRN-132604180089',
    issueDate: '2026-10-02',
    dueDate: '2026-10-16',
    returnDate: null,
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
    returnDate: null,
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
    returnDate: null,
    status: 'Overdue',
    remarks: 'Follow-up with Grade 11 STEM adviser',
  },
];

export const INITIAL_DIGITAL_RESOURCES: DigitalResource[] = [
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
      'MODULE 1: NATURE OF INQUIRY AND RESEARCH\n\nQuantitative research uses scientifically collected and statistically analyzed data to investigate observable phenomena at Barobo National High School and the broader Caraga community.\n\nKey Competencies:\n1. Describes characteristics, strengths, weaknesses, and kinds of quantitative research (CS_RS12-Ia-c-1).\n2. Illustrates the importance of quantitative research across fields (CS_RS12-Ia-c-2).\n3. Differentiates kinds of variables and their uses (CS_RS12-Ia-c-3).\n\nChapter Summary & Assessment Rubric included on pages 48–64.',
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
      'BAROBO NATIONAL HIGH SCHOOL RESEARCH COMPENDIUM — VOLUME 8\n\nFeatured Studies:\n• Automated Library Cataloging & Circulation Tracking for Public Secondary Schools in Surigao del Sur\n• Water Quality Assessment and Mangrove Biodiversity Index in Barobo Coastal Barangays\n• Financial Literacy and Digital Payment Adoption Among Micro-Enterprises in Barobo Public Market\n• Reading Comprehension Interventions for Junior High School Learners.',
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
      'BNHS MATHEMATICS DEPARTMENT REFERENCE GUIDE\n\nSection 1: Rational, Exponential & Logarithmic Functions\nSection 2: Simple & Compound Interest, Annuities, Stocks & Bonds\nSection 3: Descriptive & Inferential Statistics\n  - Sample Mean & Standard Deviation\n  - Pearson Product-Moment Correlation (r)\n  - Independent & Paired Samples t-Test\n  - One-Way Analysis of Variance (ANOVA)',
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
      'PART I: ORAL TRADITIONS OF SURIGAO DEL SUR & CARAGA\n\nThis e-book preserves local narratives from Barobo, Hinatuan, Lianga, and Tagbina alongside canonical Filipino poetry and essays for Junior and Senior High School classes.',
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
      'LABORATORY MANUAL: DATABASE-DRIVEN WEB SYSTEMS (PHP & MySQL)\n\nLab 1: Starting Apache & MySQL Services in XAMPP Control Panel\nLab 2: Designing ER Diagrams & Primary/Foreign Keys in phpMyAdmin\nLab 3: Building the BNHS Library & Research Portal Authentication System\nLab 4: Responsive Maroon-Themed UI Layout with Bootstrap 5 & CSS Grid.',
    externalUrl: '#ict-lab-manual',
    uploadedBy: 'Engr. Dennis A.Cortez (ICT Coordinator)',
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
      'BNHS OFFICIAL APA 7TH EDITION STYLE GUIDE\n\n1. In-Text Citations (Author-Date System)\n2. Reference List Formatting Rules (Hanging Indent, Alphabetical Order)\n3. Citing DepEd Memoranda, Republic Acts, and Local Archival Sources.',
    externalUrl: '#apa7-guide',
    uploadedBy: 'Mrs. Elena G. Cañete (Head Librarian)',
  },
];

export const INITIAL_USERS: LibraryUser[] = [
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

export const INITIAL_WAITLIST_REQUESTS: BookWaitlistRequest[] = [
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

export function computeStatsFromLibraryData(
  booksList: BookItem[],
  borrowsList: BorrowRecord[],
  digitalList: DigitalResource[],
  usersList: LibraryUser[]
): LibraryStats {
  const totalRegisteredCopies = booksList.reduce(
    (sum, b) => sum + Number(b.totalCopies || 0),
    0
  );
  const availableCopiesCount = booksList.reduce(
    (sum, b) => sum + Number(b.availableCopies || 0),
    0
  );
  const activeBorrowedCount = borrowsList.filter(
    (r) => r.status === 'Borrowed' || r.status === 'Overdue'
  ).length;
  const overdueCount = borrowsList.filter((r) => r.status === 'Overdue').length;

  return {
    totalTitles: booksList.length,
    totalRegisteredCopies,
    availableCopiesCount,
    activeBorrowedCount,
    overdueCount,
    digitalResourcesCount: digitalList.length,
    totalUsersCount: usersList.length,
  };
}

export const INITIAL_STATS: LibraryStats = computeStatsFromLibraryData(
  INITIAL_BOOKS,
  INITIAL_BORROW_RECORDS,
  INITIAL_DIGITAL_RESOURCES,
  INITIAL_USERS
);
