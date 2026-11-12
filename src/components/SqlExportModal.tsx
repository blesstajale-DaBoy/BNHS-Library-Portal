import React, { useState } from 'react';
import { X, Copy, Check, Download, Database } from 'lucide-react';
import { BookItem, BookCategory, DigitalResource } from '../types.ts';

interface SqlExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  books: BookItem[];
  categories: BookCategory[];
  digitalResources: DigitalResource[];
}

export const SqlExportModal: React.FC<SqlExportModalProps> = ({
  isOpen,
  onClose,
  books,
  categories,
  digitalResources,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const escapeSql = (str: string) => str.replace(/'/g, "''");

  const sqlScript = `-- ============================================================================
-- BAROBO NATIONAL HIGH SCHOOL (BNHS) LIBRARY PORTAL
-- Shared Database Schema & Live Records Export (MySQL / MariaDB / XAMPP & SQL)
-- ============================================================================

CREATE DATABASE IF NOT EXISTS bnhs_library_portal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bnhs_library_portal;

-- 1. User Accounts & Permissions (Administrator, Librarian, Teacher, Student)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uid VARCHAR(128) NOT NULL UNIQUE,
  email VARCHAR(150) NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  role ENUM('Administrator', 'Librarian', 'Teacher', 'Student') NOT NULL DEFAULT 'Student',
  id_number VARCHAR(64) NOT NULL,
  grade_or_department VARCHAR(120) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Library Shelf Categories
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  code VARCHAR(32) NOT NULL,
  shelf_zone VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Book Catalog Inventory
CREATE TABLE IF NOT EXISTS books (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  author VARCHAR(200) NOT NULL,
  isbn VARCHAR(64) NOT NULL UNIQUE,
  subject VARCHAR(120) NOT NULL,
  category VARCHAR(120) NOT NULL,
  publisher VARCHAR(150) NOT NULL,
  publication_year INT NOT NULL,
  shelf_location VARCHAR(100) NOT NULL,
  total_copies INT NOT NULL DEFAULT 1,
  available_copies INT NOT NULL DEFAULT 1,
  description TEXT NOT NULL,
  cover_key VARCHAR(32) NOT NULL DEFAULT 'history',
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Borrowing & Returning Transactions
CREATE TABLE IF NOT EXISTS borrow_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_code VARCHAR(64) NOT NULL UNIQUE,
  book_id INT NOT NULL,
  borrower_uid VARCHAR(128) NOT NULL,
  borrower_name VARCHAR(150) NOT NULL,
  borrower_role VARCHAR(40) NOT NULL,
  borrower_id_number VARCHAR(64) NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  return_date DATE DEFAULT NULL,
  status ENUM('Borrowed', 'Returned', 'Overdue') NOT NULL DEFAULT 'Borrowed',
  remarks TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

-- 5. Digital Library (E-Books, PDF Learning Materials, DepEd Modules, Journals)
CREATE TABLE IF NOT EXISTS digital_resources (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  author VARCHAR(200) NOT NULL,
  resource_type VARCHAR(64) NOT NULL,
  subject VARCHAR(120) NOT NULL,
  grade_level VARCHAR(80) NOT NULL,
  file_size VARCHAR(40) NOT NULL,
  page_count INT NOT NULL DEFAULT 32,
  download_count INT NOT NULL DEFAULT 0,
  summary TEXT NOT NULL,
  content_preview TEXT NOT NULL,
  uploaded_by VARCHAR(150) NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Current Categories Snapshot (${categories.length} records)
${categories
  .map(
    (c) =>
      `INSERT INTO categories (name, code, shelf_zone, description) VALUES ('${escapeSql(
        c.name
      )}', '${escapeSql(c.code)}', '${escapeSql(c.shelfZone)}', '${escapeSql(
        c.description
      )}');`
  )
  .join('\n')}

-- Current Book Catalog Snapshot (${books.length} titles)
${books
  .map(
    (b) =>
      `INSERT INTO books (title, author, isbn, subject, category, publisher, publication_year, shelf_location, total_copies, available_copies, description) VALUES ('${escapeSql(
        b.title
      )}', '${escapeSql(b.author)}', '${escapeSql(b.isbn)}', '${escapeSql(
        b.subject
      )}', '${escapeSql(b.category)}', '${escapeSql(b.publisher)}', ${
        b.publicationYear
      }, '${escapeSql(b.shelfLocation)}', ${b.totalCopies}, ${
        b.availableCopies
      }, '${escapeSql(b.description)}');`
  )
  .join('\n')}

-- Current Digital Library Snapshot (${digitalResources.length} items)
${digitalResources
  .map(
    (d) =>
      `INSERT INTO digital_resources (title, author, resource_type, subject, grade_level, file_size, page_count, download_count, summary, content_preview, uploaded_by) VALUES ('${escapeSql(
        d.title
      )}', '${escapeSql(d.author)}', '${escapeSql(
        d.resourceType
      )}', '${escapeSql(d.subject)}', '${escapeSql(
        d.gradeLevel
      )}', '${escapeSql(d.fileSize)}', ${d.pageCount}, ${
        d.downloadCount
      }, '${escapeSql(d.summary)}', '${escapeSql(
        d.contentPreview
      )}', '${escapeSql(d.uploadedBy)}');`
  )
  .join('\n')}
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(sqlScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([sqlScript], { type: 'application/sql;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bnhs_library_portal_database.sql';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-white text-[#1E1B18] shadow-2xl border border-[#D4AF37]/40 overflow-hidden">
        <div className="flex items-center justify-between bg-[#420B17] px-6 py-4 text-white border-b border-[#D4AF37]/30">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-[#D4AF37]" />
            <div>
              <h3 className="text-base font-semibold">
                BNHS Library SQL Schema & XAMPP Database Export
              </h3>
              <p className="text-xs text-white/75">
                Live Cloud SQL records formatted for phpMyAdmin / MySQL / MariaDB import
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-neutral-600">
              All additions and transactions are automatically stored in the shared Cloud SQL database. You can also export this live snapshot as a <span className="font-mono font-medium">.sql</span> file for local XAMPP backups.
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-xs font-medium text-neutral-800 hover:bg-neutral-50 transition-colors whitespace-nowrap shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    Copied SQL
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy SQL Script
                  </>
                )}
              </button>
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#641526] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4d0f1d] transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="h-3.5 w-3.5 text-[#D4AF37]" />
                Download .SQL File
              </button>
            </div>
          </div>

          <pre className="max-h-96 overflow-y-auto rounded-lg bg-neutral-900 p-4 font-mono text-xs text-amber-100 leading-relaxed">
            {sqlScript}
          </pre>
        </div>
      </div>
    </div>
  );
};
