import { db } from './index.ts';
import {
  users,
  categories,
  books,
  borrowRecords,
  digitalResources,
  portalSyncState,
} from './schema.ts';
import { eq, desc, sql } from 'drizzle-orm';

const MAX_PG_INT32 = 2147483647;
function isPgInt32(id: number): boolean {
  return Number.isInteger(id) && id > 0 && id <= MAX_PG_INT32;
}

export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName?: string
) {
  try {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.uid, uid));

    if (existing.length > 0) {
      return existing[0];
    }

    const deletedUids = await getPortalSyncStateRecord<string[]>(
      'deleted_user_uids',
      []
    );
    if (deletedUids.includes(uid)) {
      return {
        id: 0,
        uid,
        email,
        fullName:
          displayName && displayName.trim().length > 0
            ? displayName
            : 'Bless T. Tajale',
        role: 'Administrator',
        idNumber: 'ADM-2026-0001',
        gradeOrDepartment: 'Library & Information Services',
        status: 'Active',
      };
    }

    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const idNumber = `BNHS-2026-${randomNum}`;
    const fullName =
      displayName && displayName.trim().length > 0
        ? displayName
        : email.split('@')[0].replace(/[._]/g, ' ');

    const inserted = await db
      .insert(users)
      .values({
        uid,
        email,
        fullName,
        role: 'Administrator',
        idNumber,
        gradeOrDepartment: 'Library & Information Services',
        status: 'Active',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: { email },
      })
      .returning();

    return inserted[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user profile.', { cause: error });
  }
}

export async function ensureInitialLibrarySeed() {
  try {
    const existingBooks = await db.select().from(books);
    if (existingBooks.length > 0) {
      return;
    }

    await db
      .insert(categories)
      .values([
        {
          name: 'Filipiñana & History',
          code: 'FIL-100',
          shelfZone: 'Wing A · Shelves 1–4',
          description:
            'Philippine history, Caraga & Surigao del Sur heritage, Noli Me Tangere, El Filibusterismo, and national governance.',
        },
        {
          name: 'Science & Technology',
          code: 'SCI-200',
          shelfZone: 'Wing B · Shelves 1–6',
          description:
            'Earth and Life Sciences, Biology, Chemistry, Physics, and ICT programming references for JHS and SHS STEM.',
        },
        {
          name: 'Mathematics & Analytics',
          code: 'MAT-300',
          shelfZone: 'Wing B · Shelves 7–10',
          description:
            'Algebra, Geometry, Trigonometry, Pre-Calculus, Basic Calculus, and Statistics & Probability.',
        },
        {
          name: 'Literature & Humanities',
          code: 'LIT-400',
          shelfZone: 'Wing C · Shelves 1–5',
          description:
            '21st Century Literature from the Philippines and the World, Anglo-American Literature, and Creative Writing.',
        },
        {
          name: 'General Reference & Research',
          code: 'REF-000',
          shelfZone: 'Central Reading Hall',
          description:
            'Encyclopedias, dictionaries, atlases, Practical Research 1 & 2 guides, and capstone methodology handbooks.',
        },
        {
          name: 'Senior High School Core',
          code: 'SHS-500',
          shelfZone: 'Wing D · Shelves 1–8',
          description:
            'DepEd K-12 Senior High School textbooks across STEM, ABM, HUMSS, and TVL tracks.',
        },
      ])
      .onConflictDoNothing();

    const insertedBooks = await db
      .insert(books)
      .values([
        {
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
          title: 'Kasaysayan ng Caraga at Surigao del Sur: Archival Compendium',
          author: 'Surigao Historical Society & BNHS Faculty',
          isbn: '978-971-991-024-7',
          subject: 'Local History & Culture',
          category: 'Filipiñana & History',
          publisher: 'Mindanao State University Press',
          publicationYear: 2023,
          shelfLocation: 'Wing A · Shelf 4D',
          totalCopies: 10,
          availableCopies: 9,
          description:
            'Primary source compilation on the municipalities of Surigao del Sur, indigenous Kamayo and Manobo heritage, and the founding history of Barobo National High School.',
          coverKey: 'history',
        },
      ])
      .returning();

    await db
      .insert(users)
      .values([
        {
          uid: 'bnhs-staff-librarian-01',
          email: 'm.delacruz.librarian@bnhs.edu.ph',
          fullName: 'Mrs. Marites R. Dela Cruz, RL',
          role: 'Librarian',
          idNumber: 'BNHS-LIB-0102',
          gradeOrDepartment: 'Head School Librarian',
          status: 'Active',
        },
        {
          uid: 'bnhs-faculty-teacher-01',
          email: 'r.mendoza.stem@bnhs.edu.ph',
          fullName: 'Mr. Ricardo S. Mendoza',
          role: 'Teacher',
          idNumber: 'BNHS-FAC-0418',
          gradeOrDepartment: 'SHS Science & Research Dept.',
          status: 'Active',
        },
        {
          uid: 'bnhs-student-12stem-01',
          email: 'a.villaruel@student.bnhs.edu.ph',
          fullName: 'Althea Mae C. Villaruel',
          role: 'Student',
          idNumber: 'LRN-132604180021',
          gradeOrDepartment: 'Grade 12 - STEM A',
          status: 'Active',
        },
        {
          uid: 'bnhs-student-10rizal-02',
          email: 'k.balili@student.bnhs.edu.ph',
          fullName: 'Kenneth J. Balili',
          role: 'Student',
          idNumber: 'LRN-132604190084',
          gradeOrDepartment: 'Grade 10 - Sec. Rizal',
          status: 'Active',
        },
        {
          uid: 'bnhs-student-11humss-03',
          email: 'j.montes@student.bnhs.edu.ph',
          fullName: 'Jessa Marie P. Montes',
          role: 'Student',
          idNumber: 'LRN-132604180159',
          gradeOrDepartment: 'Grade 11 - HUMSS B',
          status: 'Active',
        },
      ])
      .onConflictDoNothing();

    if (insertedBooks.length >= 6) {
      await db.insert(borrowRecords).values([
        {
          transactionCode: 'TRX-2026-1081',
          bookId: insertedBooks[0].id,
          borrowerUid: 'bnhs-student-12stem-01',
          borrowerName: 'Althea Mae C. Villaruel',
          borrowerRole: 'Student',
          borrowerIdNumber: 'LRN-132604180021',
          issueDate: '2026-10-30',
          dueDate: '2026-11-13',
          returnDate: null,
          status: 'Borrowed',
          remarks: 'Borrowed for SHS Capstone Historical Background review',
        },
        {
          transactionCode: 'TRX-2026-1082',
          bookId: insertedBooks[1].id,
          borrowerUid: 'bnhs-faculty-teacher-01',
          borrowerName: 'Mr. Ricardo S. Mendoza',
          borrowerRole: 'Teacher',
          borrowerIdNumber: 'BNHS-FAC-0418',
          issueDate: '2026-11-01',
          dueDate: '2026-11-25',
          returnDate: null,
          status: 'Borrowed',
          remarks: 'Faculty desk copy for Quarter 2 STEM Laboratory',
        },
        {
          transactionCode: 'TRX-2026-1074',
          bookId: insertedBooks[2].id,
          borrowerUid: 'bnhs-student-10rizal-02',
          borrowerName: 'Kenneth J. Balili',
          borrowerRole: 'Student',
          borrowerIdNumber: 'LRN-132604190084',
          issueDate: '2026-10-20',
          dueDate: '2026-11-03',
          returnDate: null,
          status: 'Overdue',
          remarks: 'Overdue notice sent via Grade 10 adviser',
        },
        {
          transactionCode: 'TRX-2026-1076',
          bookId: insertedBooks[8].id,
          borrowerUid: 'bnhs-student-11humss-03',
          borrowerName: 'Jessa Marie P. Montes',
          borrowerRole: 'Student',
          borrowerIdNumber: 'LRN-132604180159',
          issueDate: '2026-10-22',
          dueDate: '2026-11-05',
          returnDate: null,
          status: 'Overdue',
          remarks: 'Pending return after ICT Web Portal project defense',
        },
        {
          transactionCode: 'TRX-2026-1069',
          bookId: insertedBooks[3].id,
          borrowerUid: 'bnhs-student-12stem-01',
          borrowerName: 'Althea Mae C. Villaruel',
          borrowerRole: 'Student',
          borrowerIdNumber: 'LRN-132604180021',
          issueDate: '2026-10-14',
          dueDate: '2026-10-28',
          returnDate: '2026-10-27',
          status: 'Returned',
          remarks: 'Returned in good condition; cleared by librarian',
        },
        {
          transactionCode: 'TRX-2026-1085',
          bookId: insertedBooks[4].id,
          borrowerUid: 'bnhs-student-10rizal-02',
          borrowerName: 'Kenneth J. Balili',
          borrowerRole: 'Student',
          borrowerIdNumber: 'LRN-132604190084',
          issueDate: '2026-10-31',
          dueDate: '2026-11-14',
          returnDate: null,
          status: 'Borrowed',
          remarks: 'Issued for Division Mathematics Olympiad training',
        },
      ]);
    }
  } catch (error) {
    console.error('Failed to seed initial library records:', error);
  }

  try {
    const existingDigital = await db.select().from(digitalResources);
    if (existingDigital.length === 0) {
      const flagRows = await db
        .select()
        .from(portalSyncState)
        .where(eq(portalSyncState.stateKey, 'seeded_digital_v1'));

      if (flagRows.length === 0) {
        await db.insert(digitalResources).values([
          {
            title:
              'DepEd Senior High School Practical Research 2 Self-Learning Module (Quarters 1–2)',
            author:
              'DepEd Caraga Regional Office — Curriculum & Learning Management Division',
            resourceType: 'Module',
            subject: 'Practical Research 2',
            gradeLevel: 'Grade 12 (All Tracks)',
            fileSize: '4.8 MB PDF',
            pageCount: 64,
            downloadCount: 342,
            summary:
              'Official DepEd self-learning module covering nature of quantitative inquiry, identifying variables, formulating conceptual frameworks, and hypothesis testing.',
            contentPreview:
              'MODULE 1: NATURE OF INQUIRY AND RESEARCH\n\nQuantitative research uses scientifically collected and statistically analyzed data to investigate observable phenomena at Barobo National High School and the broader Caraga community.\n\nLesson 1: Characteristics, Strengths, Weaknesses & Kinds of Quantitative Research\nLesson 2: Importance of Quantitative Research Across Fields (STEM, ABM, HUMSS, TVL)\nLesson 3: Nature of Variables — Independent, Dependent, Extraneous, and Confounding Variables',
            externalUrl: '#module-pr2',
            uploadedBy: 'Mrs. Elena G. Cañete (Head Librarian)',
          },
          {
            title:
              'Barobo National High School Student Research Compendium (Vol. 8, AY 2025–2026)',
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
              'BAROBO NATIONAL HIGH SCHOOL RESEARCH COMPENDIUM — VOLUME 8\n\nFeatured Studies:\n• Automated Library Cataloging & Circulation Tracking for Public Secondary Schools in Surigao del Sur\n• Coastal Water Quality and Mangrove Biodiversity Assessment along Barobo Bay\n• Financial Literacy and Budgeting Practices among Grade 12 ABM Learners',
            externalUrl: '#journal-bnhs-v8',
            uploadedBy: 'Dr. Noel V. Salazar (Research Coordinator)',
          },
          {
            title:
              'General Mathematics & Statistics Formula Handbook for JHS and SHS',
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
              'BNHS MATHEMATICS DEPARTMENT REFERENCE GUIDE\n\nSection 1: Rational, Exponential & Logarithmic Functions\nSection 2: Simple & Compound Interest, Annuities, Stocks & Bonds\nSection 3: Standard Normal Distribution z-Table & One-Sample / Independent Samples t-Test Formulas',
            externalUrl: '#math-handbook',
            uploadedBy: 'Mrs. Elena G. Cañete (Head Librarian)',
          },
          {
            title:
              'Philippine Literature & Caraga Folk Narratives E-Book Anthology',
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
              'PART I: ORAL TRADITIONS OF SURIGAO DEL SUR & CARAGA\n\nThis e-book preserves local narratives from Barobo, Hinatuan, Lianga, and Tagbina, annotated for 21st Century Literature learners with reading comprehension prompts.',
            externalUrl: '#caraga-ebook',
            uploadedBy: 'Ms. Marissa T. Ocampo (Filipino Dept.)',
          },
          {
            title:
              'Full-Stack Web Development with PHP, MySQL & XAMPP Laboratory Manual',
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
              'LABORATORY MANUAL: DATABASE-DRIVEN WEB SYSTEMS (PHP & MySQL)\n\nLab 1: Starting Apache & MySQL Services in XAMPP Control Panel\nLab 2: Importing Library SQL Schemas in phpMyAdmin\nLab 3: Building Responsive Library Catalog Search with Bootstrap & PDO',
            externalUrl: '#ict-lab-manual',
            uploadedBy: 'Engr. Dennis A. Cortez (ICT Coordinator)',
          },
          {
            title:
              'APA 7th Edition Citation, Bibliography & Academic Integrity Style Guide',
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
              'BNHS OFFICIAL APA 7TH EDITION STYLE GUIDE\n\n1. In-Text Citations (Author-Date System)\n2. Reference List Formatting Rules for Printed Books, E-Books, and Peer-Reviewed Journals\n3. Ethical AI & Plagiarism Prevention Checklist for BNHS Student Researchers',
            externalUrl: '#apa7-guide',
            uploadedBy: 'Mrs. Elena G. Cañete (Head Librarian)',
          },
        ]);
        await db
          .insert(portalSyncState)
          .values({ stateKey: 'seeded_digital_v1', stateJson: 'true' })
          .onConflictDoNothing();
      }
    }
  } catch (error) {
    console.error('Failed to seed initial digital resources:', error);
  }
}

export async function getLibraryOverviewData() {
  try {
    await ensureInitialLibrarySeed();

    const [allBooks, allBorrows, allDigital, allCategories, allUsers] =
      await Promise.all([
        db.select().from(books).orderBy(desc(books.addedAt)),
        db.select().from(borrowRecords).orderBy(desc(borrowRecords.id)),
        db.select().from(digitalResources).orderBy(desc(digitalResources.id)),
        db.select().from(categories).orderBy(categories.name),
        db.select().from(users).orderBy(desc(users.id)),
      ]);

    const totalTitles = allBooks.length;
    const totalRegisteredCopies = allBooks.reduce(
      (sum, b) => sum + (b.totalCopies || 0),
      0
    );
    const availableCopiesCount = allBooks.reduce(
      (sum, b) => sum + (b.availableCopies || 0),
      0
    );
    const activeBorrowedCount = allBorrows.filter(
      (r) => r.status === 'Borrowed' || r.status === 'Overdue'
    ).length;
    const overdueCount = allBorrows.filter((r) => r.status === 'Overdue').length;

    return {
      stats: {
        totalTitles,
        totalRegisteredCopies,
        availableCopiesCount,
        activeBorrowedCount,
        overdueCount,
        digitalResourcesCount: allDigital.length,
        totalUsersCount: allUsers.length,
      },
      books: allBooks,
      borrowRecords: allBorrows,
      digitalResources: allDigital,
      categories: allCategories,
      users: allUsers,
    };
  } catch (error) {
    console.error('Database query failed in getLibraryOverviewData:', error);
    throw new Error('Failed to load library catalog and records.', {
      cause: error,
    });
  }
}

export async function createBookRecord(data: {
  title: string;
  author: string;
  isbn: string;
  subject: string;
  category: string;
  publisher: string;
  publicationYear: number;
  shelfLocation: string;
  totalCopies: number;
  description: string;
  coverKey?: string;
}) {
  try {
    const inserted = await db
      .insert(books)
      .values({
        title: data.title,
        author: data.author,
        isbn: data.isbn,
        subject: data.subject,
        category: data.category,
        publisher: data.publisher,
        publicationYear: Number(data.publicationYear) || 2026,
        shelfLocation: data.shelfLocation,
        totalCopies: Number(data.totalCopies) || 1,
        availableCopies: Number(data.totalCopies) || 1,
        description: data.description,
        coverKey: data.coverKey || 'history',
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed in createBookRecord:', error);
    throw new Error('Failed to add new book to catalog. Check if ISBN is unique.', {
      cause: error,
    });
  }
}

export async function updateBookRecord(
  bookId: number,
  data: Partial<{
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
    coverKey?: string;
  }>
) {
  try {
    if (!isPgInt32(bookId)) {
      throw new Error('Invalid book ID for update.');
    }
    const existingRows = await db.select().from(books).where(eq(books.id, bookId));
    const prev = existingRows[0];
    if (!prev) {
      throw new Error('Book record not found in Cloud SQL.');
    }
    const total = Math.max(1, Number(data.totalCopies ?? prev.totalCopies) || 1);
    const avail = Math.min(
      total,
      Math.max(0, Number(data.availableCopies ?? prev.availableCopies ?? total))
    );
    const updated = await db
      .update(books)
      .set({
        title: (data.title ?? prev.title).trim(),
        author: (data.author ?? prev.author).trim(),
        isbn: (data.isbn ?? prev.isbn).trim(),
        subject: (data.subject ?? prev.subject).trim(),
        category: (data.category ?? prev.category).trim(),
        publisher: (data.publisher ?? prev.publisher).trim(),
        publicationYear: Number(data.publicationYear ?? prev.publicationYear) || 2026,
        shelfLocation: (data.shelfLocation ?? prev.shelfLocation).trim(),
        totalCopies: total,
        availableCopies: avail,
        description: data.description ?? prev.description,
        coverKey: data.coverKey ?? prev.coverKey ?? 'history',
      })
      .where(eq(books.id, bookId))
      .returning();
    return updated[0];
  } catch (error) {
    console.error('Database query failed in updateBookRecord:', error);
    throw new Error('Failed to update book record.', { cause: error });
  }
}

export async function deleteBookRecord(bookId: number) {
  try {
    if (!isPgInt32(bookId)) {
      return undefined;
    }
    await db.delete(borrowRecords).where(eq(borrowRecords.bookId, bookId));
    const deleted = await db
      .delete(books)
      .where(eq(books.id, bookId))
      .returning();
    return deleted[0];
  } catch (error) {
    console.error('Database query failed in deleteBookRecord:', error);
    throw new Error('Failed to delete book from catalog.', { cause: error });
  }
}

export async function issueBookBorrow(data: {
  bookId: number;
  borrowerUid: string;
  borrowerName: string;
  borrowerRole: string;
  borrowerIdNumber: string;
  issueDate: string;
  dueDate: string;
  remarks: string;
}) {
  try {
    const existingBooks = await db
      .select()
      .from(books)
      .where(eq(books.id, data.bookId));

    if (existingBooks.length === 0) {
      throw new Error('Selected book was not found.');
    }

    const targetBook = existingBooks[0];
    if (targetBook.availableCopies <= 0) {
      throw new Error('No available copies left for borrowing.');
    }

    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const transactionCode = `TRX-2026-${randomCode}`;

    await db
      .update(books)
      .set({
        availableCopies: Math.max(0, targetBook.availableCopies - 1),
      })
      .where(eq(books.id, targetBook.id));

    const inserted = await db
      .insert(borrowRecords)
      .values({
        transactionCode,
        bookId: data.bookId,
        borrowerUid: data.borrowerUid,
        borrowerName: data.borrowerName,
        borrowerRole: data.borrowerRole,
        borrowerIdNumber: data.borrowerIdNumber,
        issueDate: data.issueDate,
        dueDate: data.dueDate,
        returnDate: null,
        status: 'Borrowed',
        remarks: data.remarks || 'Standard circulation issue',
      })
      .returning();

    return inserted[0];
  } catch (error: any) {
    console.error('Database query failed in issueBookBorrow:', error);
    throw new Error(error.message || 'Failed to record borrowing transaction.', {
      cause: error,
    });
  }
}

export async function returnBorrowedBook(recordId: number, returnDate: string) {
  try {
    const existing = await db
      .select()
      .from(borrowRecords)
      .where(eq(borrowRecords.id, recordId));

    if (existing.length === 0) {
      throw new Error('Borrowing transaction not found.');
    }

    const record = existing[0];
    if (record.status === 'Returned') {
      return record;
    }

    const updated = await db
      .update(borrowRecords)
      .set({
        status: 'Returned',
        returnDate,
        remarks: `${record.remarks} · Returned on ${returnDate}`,
      })
      .where(eq(borrowRecords.id, recordId))
      .returning();

    await db
      .update(books)
      .set({
        availableCopies: sql`LEAST(${books.totalCopies}, ${books.availableCopies} + 1)`,
      })
      .where(eq(books.id, record.bookId));

    return updated[0];
  } catch (error) {
    console.error('Database query failed in returnBorrowedBook:', error);
    throw new Error('Failed to process book return.', { cause: error });
  }
}

export async function markBorrowOverdue(recordId: number) {
  try {
    const updated = await db
      .update(borrowRecords)
      .set({ status: 'Overdue' })
      .where(eq(borrowRecords.id, recordId))
      .returning();
    return updated[0];
  } catch (error) {
    console.error('Database query failed in markBorrowOverdue:', error);
    throw new Error('Failed to update overdue status.', { cause: error });
  }
}

export async function createDigitalResourceRecord(data: {
  title: string;
  author: string;
  resourceType: string;
  subject: string;
  gradeLevel: string;
  fileSize: string;
  pageCount: number;
  summary: string;
  contentPreview: string;
  externalUrl?: string;
  uploadedBy: string;
}) {
  try {
    const inserted = await db
      .insert(digitalResources)
      .values({
        title: data.title,
        author: data.author,
        resourceType: data.resourceType,
        subject: data.subject,
        gradeLevel: data.gradeLevel,
        fileSize: data.fileSize || '2.5 MB PDF',
        pageCount: Number(data.pageCount) || 24,
        downloadCount: 1,
        summary: data.summary,
        contentPreview: data.contentPreview,
        externalUrl: data.externalUrl || '',
        uploadedBy: data.uploadedBy,
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed in createDigitalResourceRecord:', error);
    throw new Error('Failed to upload digital library resource.', {
      cause: error,
    });
  }
}

export async function updateDigitalResourceRecord(
  resourceId: number,
  data: Partial<{
    title: string;
    author: string;
    resourceType: string;
    subject: string;
    gradeLevel: string;
    fileSize: string;
    pageCount: number;
    summary: string;
    contentPreview: string;
    externalUrl?: string;
    uploadedBy?: string;
  }>
) {
  try {
    const existingRows = isPgInt32(resourceId)
      ? await db
          .select()
          .from(digitalResources)
          .where(eq(digitalResources.id, resourceId))
      : [];
    const prev = existingRows[0];

    if (!prev) {
      const inserted = await db
        .insert(digitalResources)
        .values({
          title: (data.title || 'Digital Resource').trim(),
          author: (data.author || 'BNHS Faculty').trim(),
          resourceType: data.resourceType || 'PDF Learning Material',
          subject: data.subject || 'General',
          gradeLevel: data.gradeLevel || 'All Grade Levels',
          fileSize: data.fileSize || '2.5 MB PDF',
          pageCount: Number(data.pageCount) || 24,
          downloadCount: 1,
          summary: data.summary || '',
          contentPreview: data.contentPreview || '',
          externalUrl: data.externalUrl || '',
          uploadedBy: data.uploadedBy || 'BNHS Librarian',
        })
        .returning();
      return inserted[0];
    }

    const updated = await db
      .update(digitalResources)
      .set({
        title: (data.title ?? prev.title).trim(),
        author: (data.author ?? prev.author).trim(),
        resourceType: data.resourceType ?? prev.resourceType,
        subject: data.subject ?? prev.subject,
        gradeLevel: data.gradeLevel ?? prev.gradeLevel,
        fileSize: data.fileSize ?? prev.fileSize ?? '2.5 MB PDF',
        pageCount: Number(data.pageCount ?? prev.pageCount) || 24,
        summary: data.summary ?? prev.summary,
        contentPreview: data.contentPreview ?? prev.contentPreview,
        externalUrl:
          data.externalUrl !== undefined ? data.externalUrl : prev.externalUrl,
      })
      .where(eq(digitalResources.id, prev.id))
      .returning();
    return updated[0];
  } catch (error) {
    console.error('Database query failed in updateDigitalResourceRecord:', error);
    throw new Error('Failed to update digital library resource.', {
      cause: error,
    });
  }
}

export async function deleteDigitalResourceRecord(resourceId: number) {
  try {
    if (!isPgInt32(resourceId)) {
      return undefined;
    }
    const deleted = await db
      .delete(digitalResources)
      .where(eq(digitalResources.id, resourceId))
      .returning();
    return deleted[0];
  } catch (error) {
    console.error('Database query failed in deleteDigitalResourceRecord:', error);
    throw new Error('Failed to delete digital library resource.', {
      cause: error,
    });
  }
}

export async function incrementDigitalDownload(resourceId: number) {
  try {
    const updated = await db
      .update(digitalResources)
      .set({
        downloadCount: sql`${digitalResources.downloadCount} + 1`,
      })
      .where(eq(digitalResources.id, resourceId))
      .returning();
    return updated[0];
  } catch (error) {
    console.error('Database query failed in incrementDigitalDownload:', error);
    throw new Error('Failed to increment resource access counter.', {
      cause: error,
    });
  }
}

export async function createCategoryRecord(data: {
  name: string;
  code: string;
  shelfZone: string;
  description: string;
}) {
  try {
    const inserted = await db
      .insert(categories)
      .values(data)
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed in createCategoryRecord:', error);
    throw new Error('Failed to create library category.', { cause: error });
  }
}

export async function updateCategoryRecord(
  categoryId: number,
  data: Partial<{
    name: string;
    code: string;
    shelfZone: string;
    description: string;
  }>
) {
  try {
    if (!isPgInt32(categoryId)) {
      throw new Error('Invalid category ID.');
    }
    const existingRows = await db
      .select()
      .from(categories)
      .where(eq(categories.id, categoryId));
    const prev = existingRows[0];
    if (!prev) {
      throw new Error('Category not found.');
    }
    const updated = await db
      .update(categories)
      .set({
        name: (data.name ?? prev.name).trim(),
        code: (data.code ?? prev.code).trim(),
        shelfZone: (data.shelfZone ?? prev.shelfZone).trim(),
        description: data.description ?? prev.description,
      })
      .where(eq(categories.id, categoryId))
      .returning();
    return updated[0];
  } catch (error) {
    console.error('Database query failed in updateCategoryRecord:', error);
    throw new Error('Failed to update library category.', { cause: error });
  }
}

export async function deleteCategoryRecord(categoryId: number) {
  try {
    if (!isPgInt32(categoryId)) {
      return undefined;
    }
    const deleted = await db
      .delete(categories)
      .where(eq(categories.id, categoryId))
      .returning();
    return deleted[0];
  } catch (error) {
    console.error('Database query failed in deleteCategoryRecord:', error);
    throw new Error('Failed to delete library category.', { cause: error });
  }
}

export async function updateUserRoleRecord(
  targetUserId: number,
  newRole: string,
  gradeOrDepartment?: string
) {
  try {
    const updatePayload: Record<string, string> = { role: newRole };
    if (gradeOrDepartment) {
      updatePayload.gradeOrDepartment = gradeOrDepartment;
    }
    const updated = await db
      .update(users)
      .set(updatePayload)
      .where(eq(users.id, targetUserId))
      .returning();
    return updated[0];
  } catch (error) {
    console.error('Database query failed in updateUserRoleRecord:', error);
    throw new Error('Failed to update user role and permissions.', {
      cause: error,
    });
  }
}

export async function updateUserRecord(
  userId: number,
  data: Partial<{
    uid?: string;
    fullName: string;
    email: string;
    role: string;
    idNumber: string;
    gradeOrDepartment: string;
    status?: string;
  }>
) {
  try {
    let existingRows = isPgInt32(userId)
      ? await db.select().from(users).where(eq(users.id, userId))
      : [];

    if (existingRows.length === 0 && data.uid) {
      existingRows = await db
        .select()
        .from(users)
        .where(eq(users.uid, data.uid));
    }

    if (existingRows.length === 0 && data.idNumber) {
      existingRows = await db
        .select()
        .from(users)
        .where(eq(users.idNumber, data.idNumber));
    }

    const prevUser = existingRows[0];
    const targetId = prevUser ? prevUser.id : userId;

    const resolvedFullName = (
      data.fullName ??
      prevUser?.fullName ??
      'BNHS Member'
    ).trim();
    const resolvedEmail = (
      data.email ??
      prevUser?.email ??
      'member@bnhs.edu.ph'
    ).trim();
    const resolvedRole = data.role ?? prevUser?.role ?? 'Student';
    const resolvedIdNumber = (
      data.idNumber ??
      prevUser?.idNumber ??
      'BNHS-2026'
    ).trim();
    const resolvedDept = (
      data.gradeOrDepartment ??
      prevUser?.gradeOrDepartment ??
      'BNHS Library'
    ).trim();
    const resolvedStatus = data.status ?? prevUser?.status ?? 'Active';

    let resultUser;
    if (prevUser) {
      const updated = await db
        .update(users)
        .set({
          fullName: resolvedFullName,
          email: resolvedEmail,
          role: resolvedRole,
          idNumber: resolvedIdNumber,
          gradeOrDepartment: resolvedDept,
          status: resolvedStatus,
        })
        .where(eq(users.id, targetId))
        .returning();
      resultUser = updated[0];
    } else {
      const uid = data.uid || `bnhs-member-${Date.now()}`;
      const inserted = await db
        .insert(users)
        .values({
          uid,
          fullName: resolvedFullName,
          email: resolvedEmail,
          role: resolvedRole,
          idNumber: resolvedIdNumber,
          gradeOrDepartment: resolvedDept,
          status: resolvedStatus,
        })
        .onConflictDoUpdate({
          target: users.uid,
          set: {
            fullName: resolvedFullName,
            email: resolvedEmail,
            role: resolvedRole,
            idNumber: resolvedIdNumber,
            gradeOrDepartment: resolvedDept,
            status: resolvedStatus,
          },
        })
        .returning();
      resultUser = inserted[0];
    }

    if (prevUser && prevUser.fullName !== resolvedFullName) {
      await db
        .update(borrowRecords)
        .set({
          borrowerName: resolvedFullName,
          borrowerIdNumber: resolvedIdNumber,
        })
        .where(eq(borrowRecords.borrowerName, prevUser.fullName));
    }

    return resultUser;
  } catch (error) {
    console.error('Database query failed in updateUserRecord:', error);
    throw new Error('Failed to update library user account.', {
      cause: error,
    });
  }
}

export async function deleteUserRecord(userId: number, uid?: string) {
  try {
    let existingRows = isPgInt32(userId)
      ? await db.select().from(users).where(eq(users.id, userId))
      : [];

    if (existingRows.length === 0 && uid) {
      existingRows = await db
        .select()
        .from(users)
        .where(eq(users.uid, uid));
    }

    const target = existingRows[0];
    if (target?.uid) {
      const deletedUids = await getPortalSyncStateRecord<string[]>(
        'deleted_user_uids',
        []
      );
      if (!deletedUids.includes(target.uid)) {
        await upsertPortalSyncStateRecord('deleted_user_uids', [
          ...deletedUids,
          target.uid,
        ]);
      }
    }

    if (!target && !isPgInt32(userId)) {
      return undefined;
    }

    const deleted = await db
      .delete(users)
      .where(eq(users.id, target ? target.id : userId))
      .returning();
    return deleted[0] || target;
  } catch (error) {
    console.error('Database query failed in deleteUserRecord:', error);
    throw new Error('Failed to delete library user account.', {
      cause: error,
    });
  }
}

export async function createLibraryMemberRecord(data: {
  fullName: string;
  email: string;
  role: string;
  idNumber: string;
  gradeOrDepartment: string;
}) {
  try {
    const uid = `bnhs-member-${Date.now()}`;
    const inserted = await db
      .insert(users)
      .values({
        uid,
        email: data.email,
        fullName: data.fullName,
        role: data.role,
        idNumber: data.idNumber,
        gradeOrDepartment: data.gradeOrDepartment,
        status: 'Active',
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed in createLibraryMemberRecord:', error);
    throw new Error('Failed to register library user account.', {
      cause: error,
    });
  }
}

export async function getPortalSyncStateRecord<T>(
  stateKey: string,
  fallbackValue: T
): Promise<T> {
  try {
    const rows = await db
      .select()
      .from(portalSyncState)
      .where(eq(portalSyncState.stateKey, stateKey));

    if (rows.length > 0 && rows[0].stateJson) {
      return JSON.parse(rows[0].stateJson) as T;
    }

    await db
      .insert(portalSyncState)
      .values({
        stateKey,
        stateJson: JSON.stringify(fallbackValue),
      })
      .onConflictDoNothing();

    return fallbackValue;
  } catch (error) {
    console.error('Database query failed in getPortalSyncStateRecord:', error);
    return fallbackValue;
  }
}

export async function upsertPortalSyncStateRecord<T>(
  stateKey: string,
  value: T
): Promise<T> {
  try {
    const serialized = JSON.stringify(value);
    await db
      .insert(portalSyncState)
      .values({
        stateKey,
        stateJson: serialized,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: portalSyncState.stateKey,
        set: {
          stateJson: serialized,
          updatedAt: new Date(),
        },
      });
    return value;
  } catch (error) {
    console.error('Database query failed in upsertPortalSyncStateRecord:', error);
    throw new Error('Failed to sync portal state to Cloud SQL.', {
      cause: error,
    });
  }
}
