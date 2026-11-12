import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  fullName: text('full_name').notNull(),
  role: text('role').notNull().default('Administrator'), // Administrator | Librarian | Teacher | Student
  idNumber: text('id_number').notNull(),
  gradeOrDepartment: text('grade_or_department').notNull(),
  status: text('status').notNull().default('Active'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  code: text('code').notNull(),
  shelfZone: text('shelf_zone').notNull(),
  description: text('description').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const books = pgTable('books', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  author: text('author').notNull(),
  isbn: text('isbn').notNull().unique(),
  subject: text('subject').notNull(),
  category: text('category').notNull(),
  publisher: text('publisher').notNull(),
  publicationYear: integer('publication_year').notNull(),
  shelfLocation: text('shelf_location').notNull(),
  totalCopies: integer('total_copies').notNull().default(1),
  availableCopies: integer('available_copies').notNull().default(1),
  description: text('description').notNull(),
  coverKey: text('cover_key').notNull().default('history'),
  addedAt: timestamp('added_at').defaultNow(),
});

export const borrowRecords = pgTable('borrow_records', {
  id: serial('id').primaryKey(),
  transactionCode: text('transaction_code').notNull().unique(),
  bookId: integer('book_id')
    .references(() => books.id)
    .notNull(),
  borrowerUid: text('borrower_uid').notNull(),
  borrowerName: text('borrower_name').notNull(),
  borrowerRole: text('borrower_role').notNull(),
  borrowerIdNumber: text('borrower_id_number').notNull(),
  issueDate: text('issue_date').notNull(), // YYYY-MM-DD
  dueDate: text('due_date').notNull(), // YYYY-MM-DD
  returnDate: text('return_date'), // YYYY-MM-DD or null
  status: text('status').notNull().default('Borrowed'), // Borrowed | Returned | Overdue
  remarks: text('remarks').notNull().default('Standard circulation'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const digitalResources = pgTable('digital_resources', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  author: text('author').notNull(),
  resourceType: text('resource_type').notNull(), // E-Book | PDF Learning Material | Module | Journal | Reference
  subject: text('subject').notNull(),
  gradeLevel: text('grade_level').notNull(),
  fileSize: text('file_size').notNull(),
  pageCount: integer('page_count').notNull().default(32),
  downloadCount: integer('download_count').notNull().default(0),
  summary: text('summary').notNull(),
  contentPreview: text('content_preview').notNull(),
  externalUrl: text('external_url').notNull().default(''),
  uploadedBy: text('uploaded_by').notNull(),
  uploadedAt: timestamp('uploaded_at').defaultNow(),
});

export const portalSyncState = pgTable('portal_sync_state', {
  id: serial('id').primaryKey(),
  stateKey: text('state_key').notNull().unique(),
  stateJson: text('state_json').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const booksRelations = relations(books, ({ many }) => ({
  borrowRecords: many(borrowRecords),
}));

export const borrowRecordsRelations = relations(borrowRecords, ({ one }) => ({
  book: one(books, {
    fields: [borrowRecords.bookId],
    references: [books.id],
  }),
}));
