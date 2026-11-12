import React from 'react';
import {
  BookOpen,
  Bell,
  Clock,
  CheckCircle2,
  AlertTriangle,
  History,
  BookmarkPlus,
  User,
} from 'lucide-react';
import {
  BookItem,
  BorrowRecord,
  LibraryUser,
  PortalNotification,
  BookWaitlistRequest,
} from '../types.ts';

interface StudentMyLibraryViewProps {
  selectedStudentName: string;
  onSelectStudentName: (name: string) => void;
  studentUsers: LibraryUser[];
  borrowRecords: BorrowRecord[];
  books: BookItem[];
  bookById: Map<number, BookItem>;
  notifications: PortalNotification[];
  waitlistRequests: BookWaitlistRequest[];
  getDaysUntilDue: (dueDate: string) => number;
  onOpenBorrowModal: (book?: BookItem) => void;
  onRequestBookReturnNotification: (book: BookItem) => void;
  onNavigateCatalog: () => void;
}

export const StudentMyLibraryView: React.FC<StudentMyLibraryViewProps> = ({
  selectedStudentName,
  onSelectStudentName,
  studentUsers,
  borrowRecords,
  books,
  bookById,
  notifications,
  waitlistRequests,
  getDaysUntilDue,
  onOpenBorrowModal,
  onRequestBookReturnNotification,
  onNavigateCatalog,
}) => {
  const currentStudentProfile = studentUsers.find(
    (u) => u.fullName === selectedStudentName
  );

  const studentLoans = borrowRecords.filter(
    (r) =>
      r.borrowerName.toLowerCase() === selectedStudentName.toLowerCase() ||
      (currentStudentProfile &&
        r.borrowerIdNumber === currentStudentProfile.idNumber)
  );

  const activeLoans = studentLoans.filter(
    (r) => r.status === 'Borrowed' || r.status === 'Overdue'
  );
  const returnedHistory = studentLoans.filter((r) => r.status === 'Returned');

  const studentNotifications = notifications.filter(
    (n) =>
      n.studentName.toLowerCase() === selectedStudentName.toLowerCase() ||
      n.studentName === 'All Students'
  );

  const studentWaitlist = waitlistRequests.filter(
    (w) => w.studentName.toLowerCase() === selectedStudentName.toLowerCase()
  );

  return (
    <div className="space-y-6">
      {/* My Library Header & Student Account Switcher */}
      <section className="rounded-xl bg-[#420B17] border border-[#D4AF37]/40 p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-medium text-[#D4AF37]">
            Student Personal Library Workspace · Barobo National High School
          </div>
          <h2 className="font-display text-2xl font-bold text-white">
            My Library — {selectedStudentName}
          </h2>
          <p className="text-xs text-white/80">
            {currentStudentProfile
              ? `${currentStudentProfile.gradeOrDepartment} · ID: ${currentStudentProfile.idNumber} · ${currentStudentProfile.email}`
              : 'Personal active loans, due date alerts, requested book return notifications, and borrowing history.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-[#2D070F] border border-[#D4AF37]/40 rounded-lg px-3 py-1.5">
            <User className="h-3.5 w-3.5 text-[#D4AF37]" />
            <label
              htmlFor="student-picker"
              className="text-xs text-white/80 whitespace-nowrap"
            >
              Student Account:
            </label>
            <select
              id="student-picker"
              value={selectedStudentName}
              onChange={(e) => onSelectStudentName(e.target.value)}
              className="bg-transparent text-xs font-semibold text-[#D4AF37] focus:outline-none"
            >
              {studentUsers.map((st) => (
                <option
                  key={st.id}
                  value={st.fullName}
                  className="bg-[#3A0A14] text-white"
                >
                  {st.fullName} ({st.gradeOrDepartment})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => onOpenBorrowModal()}
            className="rounded-lg bg-[#D4AF37] px-4 py-2 text-xs font-bold text-[#3A0A14] hover:bg-[#e5c247] transition-colors whitespace-nowrap shrink-0"
          >
            Borrow a Book
          </button>
        </div>
      </section>

      {/* Student Personal Summary KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white p-5 text-[#1E1B18] border border-neutral-200 shadow-sm">
          <div className="text-xs font-medium text-neutral-500">
            My Active Loans
          </div>
          <div className="mt-2 font-mono text-3xl font-bold text-[#641526] tabular-nums">
            {activeLoans.length}
          </div>
          <div className="mt-1 text-xs text-neutral-600">
            Currently checked out to you
          </div>
        </div>

        <div className="rounded-xl bg-white p-5 text-[#1E1B18] border border-neutral-200 shadow-sm">
          <div className="text-xs font-medium text-neutral-500">
            Due Within 2–3 Days
          </div>
          <div className="mt-2 font-mono text-3xl font-bold text-amber-600 tabular-nums">
            {
              activeLoans.filter((r) => {
                const days = getDaysUntilDue(r.dueDate);
                return r.status === 'Borrowed' && days >= 0 && days <= 3;
              }).length
            }
          </div>
          <div className="mt-1 text-xs text-neutral-600">
            Upcoming return deadlines
          </div>
        </div>

        <div className="rounded-xl bg-white p-5 text-[#1E1B18] border border-neutral-200 shadow-sm">
          <div className="text-xs font-medium text-neutral-500">
            Borrowed History
          </div>
          <div className="mt-2 font-mono text-3xl font-bold text-emerald-700 tabular-nums">
            {returnedHistory.length}
          </div>
          <div className="mt-1 text-xs text-neutral-600">
            Completed & returned materials
          </div>
        </div>

        <div className="rounded-xl bg-white p-5 text-[#1E1B18] border border-neutral-200 shadow-sm">
          <div className="text-xs font-medium text-neutral-500">
            My Portal Alerts
          </div>
          <div className="mt-2 font-mono text-3xl font-bold text-[#641526] tabular-nums">
            {studentNotifications.length}
          </div>
          <div className="mt-1 text-xs text-neutral-600">
            2-day due reminders & return alerts
          </div>
        </div>
      </section>

      {/* Automatic Student Notifications System (2-Day Due Alerts & Returned Book Alerts) */}
      <section className="rounded-xl bg-white text-[#1E1B18] border border-neutral-200 overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-neutral-50">
          <div className="flex items-center gap-2.5">
            <Bell className="h-5 w-5 text-[#641526]" />
            <div>
              <h3 className="font-display text-base font-bold text-[#641526]">
                Automated Student Notification Alerts
              </h3>
              <p className="text-xs text-neutral-500">
                Real-time alerts when your borrowed books are 2 days away from their due date or when a requested book has been returned
              </p>
            </div>
          </div>
          <span className="font-mono text-xs font-semibold text-[#641526] tabular-nums">
            {studentNotifications.length} active alert(s)
          </span>
        </div>

        <div className="divide-y divide-neutral-200">
          {studentNotifications.length === 0 ? (
            <div className="p-6 text-center text-xs text-neutral-500">
              No urgent due-date or book-return notifications for {selectedStudentName} right now.
            </div>
          ) : (
            studentNotifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-4 flex items-start justify-between gap-4 ${
                  notif.type === 'due_soon'
                    ? 'bg-amber-50/70'
                    : notif.type === 'book_returned'
                    ? 'bg-emerald-50/70'
                    : 'bg-red-50/70'
                }`}
              >
                <div className="flex items-start gap-3">
                  {notif.type === 'due_soon' && (
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  {notif.type === 'book_returned' && (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  )}
                  {notif.type === 'overdue' && (
                    <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-neutral-900">
                      {notif.title}
                    </div>
                    <p className="text-xs text-neutral-700 leading-relaxed">
                      {notif.message}
                    </p>
                  </div>
                </div>
                <span className="font-mono text-[11px] text-neutral-500 tabular-nums whitespace-nowrap shrink-0">
                  {notif.dateLabel}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Active Loans & Due Dates */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 rounded-xl bg-white text-[#1E1B18] border border-neutral-200 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-[#641526]" />
              <div>
                <h3 className="font-display text-base font-bold text-[#641526]">
                  My Active Loans & Due Dates
                </h3>
                <p className="text-xs text-neutral-500">
                  Current books checked out under your student account
                </p>
              </div>
            </div>
            <button
              onClick={onNavigateCatalog}
              className="rounded-lg bg-[#641526] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4d0f1d] transition-colors whitespace-nowrap shrink-0"
            >
              Browse Catalog
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold text-neutral-600">
                  <th className="py-3 px-4">Book Title & Code</th>
                  <th className="py-3 px-3">Issue Date</th>
                  <th className="py-3 px-3">Due Date</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 text-xs">
                {activeLoans.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-8 px-4 text-center text-neutral-500"
                    >
                      You have no active book loans at the moment.
                    </td>
                  </tr>
                ) : (
                  activeLoans.map((loan) => {
                    const book = bookById.get(loan.bookId);
                    const daysLeft = getDaysUntilDue(loan.dueDate);
                    const isWithin3Days =
                      loan.status === 'Borrowed' &&
                      daysLeft >= 0 &&
                      daysLeft <= 3;

                    return (
                      <tr
                        key={loan.id}
                        className={`transition-colors ${
                          isWithin3Days
                            ? 'bg-amber-50/90 hover:bg-amber-100/80'
                            : 'hover:bg-neutral-50'
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-neutral-900">
                            {book?.title || `Book #${loan.bookId}`}
                          </div>
                          <div className="text-[11px] text-neutral-500 font-mono tabular-nums">
                            {loan.transactionCode} · {book?.shelfLocation || 'Main Shelf'}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 font-mono tabular-nums text-neutral-700 whitespace-nowrap">
                          {loan.issueDate}
                        </td>
                        <td className="py-3.5 px-3 font-mono tabular-nums font-semibold text-neutral-900 whitespace-nowrap">
                          {loan.dueDate}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {loan.status === 'Overdue' ? (
                            <span className="inline-flex items-center gap-1 font-bold text-red-600">
                              <AlertTriangle className="h-4 w-4 text-red-600" />
                              Overdue
                            </span>
                          ) : isWithin3Days ? (
                            <span className="inline-flex items-center gap-1.5 font-semibold text-amber-800">
                              <AlertTriangle className="h-4 w-4 text-amber-500 fill-amber-100" />
                              Due in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                              <Clock className="h-3.5 w-3.5" />
                              Borrowed ({daysLeft}d left)
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* History of Borrowed Materials & Return Waitlist Requests */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-xl bg-white text-[#1E1B18] border border-neutral-200 overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-neutral-200">
              <History className="h-4 w-4 text-[#641526]" />
              <div>
                <h3 className="font-display text-base font-bold text-[#641526]">
                  My History of Borrowed Materials
                </h3>
                <p className="text-xs text-neutral-500">
                  Previously borrowed and returned library books
                </p>
              </div>
            </div>

            <div className="divide-y divide-neutral-200">
              {returnedHistory.length === 0 ? (
                <div className="p-6 text-center text-xs text-neutral-500">
                  No returned book history recorded yet for {selectedStudentName}.
                </div>
              ) : (
                returnedHistory.map((rec) => {
                  const book = bookById.get(rec.bookId);
                  return (
                    <div key={rec.id} className="p-4 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-xs text-neutral-900">
                          {book?.title || `Book #${rec.bookId}`}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Returned {rec.returnDate}
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-500 font-mono tabular-nums">
                        {rec.transactionCode} · Issued {rec.issueDate} · Due {rec.dueDate}
                      </div>
                      <div className="text-[11px] text-neutral-600">
                        {rec.remarks}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Request Notification When a Book Is Returned */}
          <div className="rounded-xl bg-white text-[#1E1B18] border border-neutral-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <BookmarkPlus className="h-4 w-4 text-[#641526]" />
              <h3 className="font-display text-sm font-bold text-[#641526]">
                Book Return Alert Subscriptions
              </h3>
            </div>
            <p className="text-xs text-neutral-600">
              Subscribe to any borrowed title below to receive an automatic portal notification the moment a copy is returned.
            </p>
            <div className="space-y-2 pt-1">
              {books.slice(0, 3).map((b) => {
                const alreadyRequested = studentWaitlist.some(
                  (w) => w.bookId === b.id && !w.fulfilled
                );
                return (
                  <div
                    key={b.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 p-2.5 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-neutral-900 truncate">
                        {b.title}
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        {b.availableCopies}/{b.totalCopies} available
                      </div>
                    </div>
                    <button
                      onClick={() => onRequestBookReturnNotification(b)}
                      disabled={alreadyRequested}
                      className="rounded bg-[#641526] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#4d0f1d] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                    >
                      {alreadyRequested ? 'Alert Active' : 'Notify on Return'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
