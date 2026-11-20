import React, { useMemo, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  BookOpen,
  FileText,
  FolderPlus,
  Users,
  ArrowLeftRight,
  Image as ImageIcon,
  Search,
  Upload,
  Eye,
  Check,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import {
  BookCategory,
  BookItem,
  DigitalResource,
  LibraryUser,
  PortalSettings,
  UserRole,
  USER_ROLE_OPTIONS,
} from '../types.ts';
import { InlineFilePreview } from './FilePreviewModal.tsx';
import {
  BUNDLED_ASSETS,
  resolvePortalAssetUrl,
} from '../data/bnhsInitialData.ts';

interface ConsolidatedCrudHubProps {
  mode: 'create' | 'edit' | 'delete';
  books: BookItem[];
  categories: BookCategory[];
  digitalResources: DigitalResource[];
  users: LibraryUser[];
  portalSettings: PortalSettings;
  isCloudSyncing: boolean;
  lastSyncedAt: string;
  // Create Forms & Handlers
  newBookForm: {
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
    coverKey: string;
  };
  setNewBookForm: React.Dispatch<
    React.SetStateAction<{
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
      coverKey: string;
    }>
  >;
  onAddBookSubmit: (e: React.FormEvent) => Promise<void>;
  digitalForm: {
    title: string;
    author: string;
    resourceType: string;
    subject: string;
    gradeLevel: string;
    fileSize: string;
    pageCount: number;
    summary: string;
    contentPreview: string;
    externalUrl: string;
  };
  setDigitalForm: React.Dispatch<
    React.SetStateAction<{
      title: string;
      author: string;
      resourceType: string;
      subject: string;
      gradeLevel: string;
      fileSize: string;
      pageCount: number;
      summary: string;
      contentPreview: string;
      externalUrl: string;
    }>
  >;
  attachedUploadFileName: string;
  onUploadDigitalFilePick: (
    e: React.ChangeEvent<HTMLInputElement>
  ) => Promise<void>;
  onUploadDigitalSubmit: (e: React.FormEvent) => Promise<void>;
  categoryForm: {
    name: string;
    code: string;
    shelfZone: string;
    description: string;
  };
  setCategoryForm: React.Dispatch<
    React.SetStateAction<{
      name: string;
      code: string;
      shelfZone: string;
      description: string;
    }>
  >;
  onCreateCategory: (e: React.FormEvent) => Promise<void>;
  memberForm: {
    editingExistingId: number;
    fullName: string;
    email: string;
    role: string;
    idNumber: string;
    gradeOrDepartment: string;
  };
  setMemberForm: React.Dispatch<
    React.SetStateAction<{
      editingExistingId: number;
      fullName: string;
      email: string;
      role: string;
      idNumber: string;
      gradeOrDepartment: string;
    }>
  >;
  onCreateMember: (e: React.FormEvent) => Promise<void>;
  onOpenBorrowModal: (book?: BookItem) => void;
  submitting: boolean;
  // Edit Handlers
  onOpenPortalSettings: () => void;
  onEditBook: (book: BookItem) => void;
  onEditDigital: (item: DigitalResource) => void;
  onEditCategory: (cat: BookCategory) => void;
  onEditUser: (user: LibraryUser) => void;
  onChangeMemberRole: (user: LibraryUser, role: UserRole) => Promise<void>;
  // Delete Handlers
  onDeleteBook: (book: BookItem) => Promise<void>;
  onDeleteDigital: (item: DigitalResource) => Promise<void>;
  onDeleteCategory: (cat: BookCategory) => Promise<void>;
  onDeleteUser: (user: LibraryUser) => Promise<void>;
}

type CreateTab = 'book' | 'digital' | 'category' | 'member' | 'loan';
type EditTab = 'portal' | 'book' | 'digital' | 'category' | 'member';
type DeleteTab = 'book' | 'digital' | 'category' | 'member';

export const ConsolidatedCrudHub: React.FC<ConsolidatedCrudHubProps> = ({
  mode,
  books,
  categories,
  digitalResources,
  users,
  portalSettings,
  isCloudSyncing,
  lastSyncedAt,
  newBookForm,
  setNewBookForm,
  onAddBookSubmit,
  digitalForm,
  setDigitalForm,
  attachedUploadFileName,
  onUploadDigitalFilePick,
  onUploadDigitalSubmit,
  categoryForm,
  setCategoryForm,
  onCreateCategory,
  memberForm,
  setMemberForm,
  onCreateMember,
  onOpenBorrowModal,
  submitting,
  onOpenPortalSettings,
  onEditBook,
  onEditDigital,
  onEditCategory,
  onEditUser,
  onChangeMemberRole,
  onDeleteBook,
  onDeleteDigital,
  onDeleteCategory,
  onDeleteUser,
}) => {
  const [createTab, setCreateTab] = useState<CreateTab>('book');
  const [editTab, setEditTab] = useState<EditTab>('portal');
  const [deleteTab, setDeleteTab] = useState<DeleteTab>('book');

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'All' | UserRole>('All');
  const [previewDigitalUpload, setPreviewDigitalUpload] = useState(false);

  // Two-step inline delete confirmation key (e.g. "book-4", "user-2") — never uses window.confirm
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);

  const filteredBooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return books;
    return books.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.isbn.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q)
    );
  }, [books, searchQuery]);

  const filteredDigital = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return digitalResources;
    return digitalResources.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.author.toLowerCase().includes(q) ||
        r.subject.toLowerCase().includes(q) ||
        r.resourceType.toLowerCase().includes(q)
    );
  }, [digitalResources, searchQuery]);

  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.shelfZone.toLowerCase().includes(q)
    );
  }, [categories, searchQuery]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'All' && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.idNumber.toLowerCase().includes(q) ||
        u.gradeOrDepartment.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      );
    });
  }, [users, roleFilter, searchQuery]);

  const headerMeta = {
    create: {
      title: 'Add or Create Center',
      subtitle:
        'All system creation tools unified in one place — books, digital learning materials, shelf categories, member accounts, and book loans. Automatically Cloud Synced.',
      icon: Plus,
    },
    edit: {
      title: 'Edit Center',
      subtitle:
        'All system editing tools unified in one place — portal banner image & schedule, books, digital materials, shelf categories, and member accounts. Changes auto-save live.',
      icon: Pencil,
    },
    delete: {
      title: 'Delete Center',
      subtitle:
        'All system deletion controls unified in one protected place — books, digital materials, shelf categories, and member accounts with inline confirmation.',
      icon: Trash2,
    },
  }[mode];

  const HeaderIcon = headerMeta.icon;

  return (
    <section className="space-y-6">
      {/* Unified Hub Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div
              className={`h-9 w-9 rounded-lg flex items-center justify-center border ${
                mode === 'delete'
                  ? 'bg-red-950/90 border-red-400/50 text-red-300'
                  : 'bg-[#3A0A14] border-[#D4AF37]/50 text-[#D4AF37]'
              }`}
            >
              <HeaderIcon className="h-4.5 w-4.5" />
            </div>
            <h1 className="font-display text-2xl font-bold text-white">
              {headerMeta.title}
            </h1>
          </div>
          <p className="text-xs text-white/80 max-w-3xl">
            {headerMeta.subtitle}
          </p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/40 bg-[#3A0A14] px-3 py-1.5 text-xs font-semibold text-emerald-300 whitespace-nowrap shrink-0">
          {isCloudSyncing ? (
            <RefreshCw className="h-3.5 w-3.5 text-[#D4AF37] animate-spin" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          )}
          <span>
            {isCloudSyncing
              ? 'Auto-Syncing Changes...'
              : `Auto-Sync Active${lastSyncedAt ? ` · ${lastSyncedAt}` : ''}`}
          </span>
        </div>
      </div>

      {/* ====================================================================
          MODE 1: ADD OR CREATE (ALL SYSTEM CREATE TOOLS IN ONE PLACE)
         ==================================================================== */}
      {mode === 'create' && (
        <div className="space-y-5">
          {/* Sub-Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-[#3A0A14] rounded-xl border border-[#D4AF37]/30">
            {(
              [
                { id: 'book', label: 'Add Book to Catalog', icon: BookOpen },
                {
                  id: 'digital',
                  label: 'Upload Digital Material',
                  icon: FileText,
                },
                {
                  id: 'category',
                  label: 'Create Shelf Category',
                  icon: FolderPlus,
                },
                { id: 'member', label: 'Register Member Account', icon: Users },
                {
                  id: 'loan',
                  label: 'Record New Book Loan',
                  icon: ArrowLeftRight,
                },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCreateTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    createTab === tab.id
                      ? 'bg-[#D4AF37] text-[#3A0A14] shadow-sm'
                      : 'text-white/80 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* CREATE TAB 1: Register Book */}
          {createTab === 'book' && (
            <form
              onSubmit={onAddBookSubmit}
              className="rounded-xl bg-white p-6 text-[#1E1B18] border border-neutral-200 shadow-sm space-y-4 text-xs"
            >
              <div className="border-b border-neutral-200 pb-3">
                <h2 className="font-display text-lg font-bold text-[#641526]">
                  Register New Book in BNHS Catalog
                </h2>
                <p className="text-neutral-500">
                  Saved books automatically sync to Cloud SQL & Live Published
                  Firestore immediately.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 focus:border-[#641526] focus:outline-none"
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
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 focus:border-[#641526] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-neutral-900 focus:border-[#641526] focus:outline-none"
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
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 focus:border-[#641526] focus:outline-none"
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
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 focus:border-[#641526] focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 focus:border-[#641526] focus:outline-none"
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
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-neutral-900 focus:border-[#641526] focus:outline-none"
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
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 focus:border-[#641526] focus:outline-none"
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
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-neutral-900 focus:border-[#641526] focus:outline-none"
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
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 focus:border-[#641526] focus:outline-none"
                />
              </div>

              <div className="rounded-lg bg-neutral-50 p-3.5 border border-neutral-200 flex flex-wrap items-center justify-between gap-3">
                <div className="text-[11px] text-neutral-600">
                  <div className="font-semibold text-neutral-800">
                    Optional Book Cover Image
                  </div>
                  <div>
                    {newBookForm.coverKey.startsWith('data:')
                      ? 'Custom cover image loaded and ready to auto-sync.'
                      : 'Uses BNHS catalog cover unless you upload a custom image.'}
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

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#641526] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#4d0f1d] disabled:opacity-50 cursor-pointer"
                >
                  <Plus className="h-4 w-4 text-[#D4AF37]" />
                  {submitting
                    ? 'Saving & Syncing...'
                    : 'Save Book & Auto-Sync to Cloud'}
                </button>
              </div>
            </form>
          )}

          {/* CREATE TAB 2: Upload Digital Material */}
          {createTab === 'digital' && (
            <form
              onSubmit={onUploadDigitalSubmit}
              className="rounded-xl bg-white p-6 text-[#1E1B18] border border-neutral-200 shadow-sm space-y-4 text-xs"
            >
              <div className="border-b border-neutral-200 pb-3">
                <h2 className="font-display text-lg font-bold text-[#641526]">
                  Upload Digital Learning Material
                </h2>
                <p className="text-neutral-500">
                  Attach PDFs, DepEd modules, presentations, or documents —
                  drafts and uploads auto-sync to cloud storage.
                </p>
              </div>

              <div className="rounded-lg bg-neutral-50 border border-neutral-200 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-semibold text-[#641526]">
                    <FileText className="h-4 w-4 text-[#D4AF37]" />
                    <span>Upload File (PDF, Doc, PPT, Image, Text)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewDigitalUpload((p) => !p)}
                      className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-neutral-800 hover:bg-neutral-100"
                    >
                      <Eye className="h-3.5 w-3.5 text-[#641526]" />
                      {previewDigitalUpload ? 'Hide Preview' : 'Preview'}
                    </button>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-md bg-[#641526] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#4d0f1d]">
                      <Upload className="h-3.5 w-3.5 text-[#D4AF37]" />
                      Choose File
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv,.epub,.html,.jpg,.jpeg,.png,.gif,.webp"
                        onChange={onUploadDigitalFilePick}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {(attachedUploadFileName ||
                  digitalForm.externalUrl?.startsWith('data:')) && (
                  <div className="rounded bg-emerald-50 border border-emerald-200 px-3 py-2 text-[11px] font-semibold text-emerald-800 flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>
                      {attachedUploadFileName
                        ? `File "${attachedUploadFileName}" (${digitalForm.fileSize}) loaded & auto-saved.`
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
                    placeholder="https://drive.google.com/file/d/... or direct document link"
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-1.5 font-mono text-[11px] text-neutral-900"
                  />
                </div>

                {previewDigitalUpload && (
                  <InlineFilePreview
                    title={digitalForm.title || attachedUploadFileName}
                    externalUrl={digitalForm.externalUrl}
                    fileSize={digitalForm.fileSize}
                    contentPreview={digitalForm.contentPreview}
                    summary={digitalForm.summary}
                    compact
                  />
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                  Full Module / Study Material Content (Optional if File
                  Attached)
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
                  placeholder="Paste learning material text, formulas, or study guide sections..."
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#641526] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#4d0f1d] disabled:opacity-50 cursor-pointer"
                >
                  <Upload className="h-4 w-4 text-[#D4AF37]" />
                  {submitting
                    ? 'Uploading & Cloud Syncing...'
                    : 'Publish Material & Auto-Sync to Cloud'}
                </button>
              </div>
            </form>
          )}

          {/* CREATE TAB 3: Shelf Category */}
          {createTab === 'category' && (
            <form
              onSubmit={onCreateCategory}
              className="rounded-xl bg-white p-6 text-[#1E1B18] border border-neutral-200 shadow-sm space-y-4 text-xs max-w-2xl"
            >
              <div className="border-b border-neutral-200 pb-3">
                <h2 className="font-display text-lg font-bold text-[#641526]">
                  Create Library Shelf Category
                </h2>
                <p className="text-neutral-500">
                  Organize BNHS book holdings by classification code and library
                  wing.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Category Name
                </label>
                <input
                  type="text"
                  required
                  value={categoryForm.name}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, name: e.target.value })
                  }
                  placeholder="e.g. Agriculture & Fisheries (TVL)"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Classification Code
                  </label>
                  <input
                    type="text"
                    required
                    value={categoryForm.code}
                    onChange={(e) =>
                      setCategoryForm({ ...categoryForm, code: e.target.value })
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

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#641526] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#4d0f1d] cursor-pointer"
                >
                  <FolderPlus className="h-4 w-4 text-[#D4AF37]" />
                  Create Shelf Category & Auto-Sync
                </button>
              </div>
            </form>
          )}

          {/* CREATE TAB 4: Register Member Account */}
          {createTab === 'member' && (
            <form
              onSubmit={(e) => {
                // Ensure create mode always creates a new account
                if (memberForm.editingExistingId !== 0) {
                  setMemberForm((prev) => ({ ...prev, editingExistingId: 0 }));
                }
                return onCreateMember(e);
              }}
              className="rounded-xl bg-white p-6 text-[#1E1B18] border border-neutral-200 shadow-sm space-y-4 text-xs max-w-2xl"
            >
              <div className="border-b border-neutral-200 pb-3">
                <h2 className="font-display text-lg font-bold text-[#641526]">
                  Register New BNHS Library Member Account
                </h2>
                <p className="text-neutral-500">
                  Registered members automatically appear in the Interactive
                  Fluorescent Bulb Login member list for their chosen role.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    User Role
                  </label>
                  <select
                    value={memberForm.role}
                    onChange={(e) =>
                      setMemberForm({
                        ...memberForm,
                        editingExistingId: 0,
                        role: e.target.value as UserRole,
                      })
                    }
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 font-semibold"
                  >
                    {USER_ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
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
                        editingExistingId: 0,
                        idNumber: e.target.value,
                      })
                    }
                    placeholder="e.g. LRN-132604... or LIB-2026-..."
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-neutral-900"
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
                      editingExistingId: 0,
                      fullName: e.target.value,
                    })
                  }
                  placeholder="e.g. Ms. Grace M. Bautista, RL"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                        editingExistingId: 0,
                        email: e.target.value,
                      })
                    }
                    placeholder="member@bnhs.edu.ph"
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
                        editingExistingId: 0,
                        gradeOrDepartment: e.target.value,
                      })
                    }
                    placeholder="e.g. Grade 12 - STEM A / Cataloging Desk"
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#641526] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#4d0f1d] cursor-pointer"
                >
                  <Users className="h-4 w-4 text-[#D4AF37]" />
                  Save Member Account & Auto-Sync
                </button>
              </div>
            </form>
          )}

          {/* CREATE TAB 5: Record Book Loan */}
          {createTab === 'loan' && (
            <div className="rounded-xl bg-white p-6 text-[#1E1B18] border border-neutral-200 shadow-sm space-y-4 text-xs max-w-2xl">
              <div className="border-b border-neutral-200 pb-3">
                <h2 className="font-display text-lg font-bold text-[#641526]">
                  Record New Book Loan Transaction
                </h2>
                <p className="text-neutral-500">
                  Issue any available catalog book to a student, teacher, or
                  library staff member with automatic due-date tracking.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {books
                  .filter((b) => b.availableCopies > 0)
                  .slice(0, 6)
                  .map((b) => (
                    <div
                      key={b.id}
                      className="rounded-lg border border-neutral-200 p-3 flex items-center justify-between gap-3 hover:bg-neutral-50"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-neutral-900 truncate">
                          {b.title}
                        </div>
                        <div className="text-[11px] text-neutral-500 font-mono">
                          {b.availableCopies}/{b.totalCopies} avail. ·{' '}
                          {b.shelfLocation}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenBorrowModal(b)}
                        className="rounded-md bg-[#641526] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#4d0f1d] whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Issue Loan
                      </button>
                    </div>
                  ))}
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onOpenBorrowModal()}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#D4AF37] px-5 py-2.5 text-xs font-bold text-[#3A0A14] hover:bg-[#e5c247] cursor-pointer"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                  Open Full Book Loan Issuance Form
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ====================================================================
          MODE 2: EDIT (ALL SYSTEM EDIT TOOLS IN ONE PLACE)
         ==================================================================== */}
      {mode === 'edit' && (
        <div className="space-y-5">
          {/* Sub-Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-[#3A0A14] rounded-xl border border-[#D4AF37]/30">
            {(
              [
                {
                  id: 'portal',
                  label: 'Portal Image & Schedule',
                  icon: ImageIcon,
                },
                { id: 'book', label: `Books (${books.length})`, icon: BookOpen },
                {
                  id: 'digital',
                  label: `Digital Materials (${digitalResources.length})`,
                  icon: FileText,
                },
                {
                  id: 'category',
                  label: `Shelf Categories (${categories.length})`,
                  icon: FolderPlus,
                },
                {
                  id: 'member',
                  label: `Member Accounts (${users.length})`,
                  icon: Users,
                },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setEditTab(tab.id);
                    setSearchQuery('');
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    editTab === tab.id
                      ? 'bg-[#D4AF37] text-[#3A0A14] shadow-sm'
                      : 'text-white/80 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* EDIT TAB 1: Portal Banner Image, Logo & Schedule */}
          {editTab === 'portal' && (
            <div className="rounded-xl bg-white p-6 text-[#1E1B18] border border-neutral-200 shadow-sm space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-4">
                <div>
                  <h2 className="font-display text-lg font-bold text-[#641526]">
                    Edit Portal Banner Image, School Logo & Academic Schedule
                  </h2>
                  <p className="text-xs text-neutral-500">
                    Upload a new banner photo, update the school logo GIF, or
                    revise operating hours — every edit auto-saves to Cloud SQL
                    and Live Firestore.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onOpenPortalSettings}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#641526] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#4d0f1d] cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Pencil className="h-3.5 w-3.5 text-[#D4AF37]" />
                  Open Portal Image & Schedule Editor
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                <div className="space-y-3">
                  <div>
                    <div className="font-semibold text-neutral-600 mb-1">
                      Welcome Heading
                    </div>
                    <div className="rounded-lg bg-neutral-50 border border-neutral-200 p-3 font-semibold text-neutral-900">
                      {portalSettings.welcomeHeading}
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-neutral-600 mb-1">
                      Academic Year & Operating Hours Schedule
                    </div>
                    <div className="rounded-lg bg-neutral-50 border border-neutral-200 p-3 font-semibold text-[#641526]">
                      {portalSettings.scheduleBannerText}
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-neutral-600 mb-1">
                      School Crest / Logo
                    </div>
                    <div className="flex items-center gap-3 rounded-lg bg-neutral-50 border border-neutral-200 p-3">
                      <img
                        src={resolvePortalAssetUrl(
                          portalSettings.logoImageUrl,
                          BUNDLED_ASSETS.logoAnimatedGif
                        )}
                        alt="BNHS School Logo"
                        className="h-12 w-12 rounded-full object-contain border border-[#D4AF37] bg-white p-0.5"
                      />
                      <span className="text-neutral-600">
                        Active official crest synced across Preview & Live
                        Published
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="font-semibold text-neutral-600">
                    Active Hero Banner Image
                  </div>
                  <div className="h-52 rounded-lg overflow-hidden border border-neutral-200 bg-neutral-100">
                    <img
                      src={resolvePortalAssetUrl(
                        portalSettings.heroImageUrl,
                        BUNDLED_ASSETS.heroBanner
                      )}
                      alt="BNHS Hero Banner"
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Shared Search Bar for Edit Lists */}
          {editTab !== 'portal' && (
            <div className="rounded-xl bg-white p-4 text-[#1E1B18] border border-neutral-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="h-4 w-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search records to edit..."
                  className="w-full rounded-lg border border-neutral-300 pl-9 pr-3 py-2 text-xs text-neutral-900 focus:border-[#641526] focus:outline-none"
                />
              </div>

              {editTab === 'member' && (
                <select
                  value={roleFilter}
                  onChange={(e) =>
                    setRoleFilter(e.target.value as 'All' | UserRole)
                  }
                  className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 focus:border-[#641526] focus:outline-none"
                >
                  <option value="All">All Roles ({users.length})</option>
                  {USER_ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.shortLabel}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* EDIT TAB 2: Books */}
          {editTab === 'book' && (
            <div className="rounded-xl bg-white text-[#1E1B18] border border-neutral-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50 font-semibold text-neutral-600">
                      <th className="py-3 px-5">Book Title & Author</th>
                      <th className="py-3 px-4">ISBN</th>
                      <th className="py-3 px-4">Category & Shelf</th>
                      <th className="py-3 px-4 text-right">Copies</th>
                      <th className="py-3 px-5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {filteredBooks.map((book) => (
                      <tr key={book.id} className="hover:bg-neutral-50">
                        <td className="py-3.5 px-5">
                          <div className="font-semibold text-neutral-900">
                            {book.title}
                          </div>
                          <div className="text-neutral-500">{book.author}</div>
                        </td>
                        <td className="py-3.5 px-4 font-mono tabular-nums">
                          {book.isbn}
                        </td>
                        <td className="py-3.5 px-4">
                          <div>{book.category}</div>
                          <div className="text-neutral-500">
                            {book.shelfLocation}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                          {book.availableCopies}/{book.totalCopies}
                        </td>
                        <td className="py-3.5 px-5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onEditBook(book)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#641526] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4d0f1d] cursor-pointer"
                          >
                            <Pencil className="h-3 w-3 text-[#D4AF37]" />
                            Edit Book
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* EDIT TAB 3: Digital Resources */}
          {editTab === 'digital' && (
            <div className="rounded-xl bg-white text-[#1E1B18] border border-neutral-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50 font-semibold text-neutral-600">
                      <th className="py-3 px-5">Title & Author</th>
                      <th className="py-3 px-4">Type & Subject</th>
                      <th className="py-3 px-4">Grade Level</th>
                      <th className="py-3 px-5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {filteredDigital.map((res) => (
                      <tr key={res.id} className="hover:bg-neutral-50">
                        <td className="py-3.5 px-5">
                          <div className="font-semibold text-neutral-900">
                            {res.title}
                          </div>
                          <div className="text-neutral-500">{res.author}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-[#641526]">
                            {res.resourceType}
                          </div>
                          <div className="text-neutral-500">{res.subject}</div>
                        </td>
                        <td className="py-3.5 px-4">{res.gradeLevel}</td>
                        <td className="py-3.5 px-5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onEditDigital(res)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#641526] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4d0f1d] cursor-pointer"
                          >
                            <Pencil className="h-3 w-3 text-[#D4AF37]" />
                            Edit Material
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* EDIT TAB 4: Shelf Categories */}
          {editTab === 'category' && (
            <div className="rounded-xl bg-white text-[#1E1B18] border border-neutral-200 overflow-hidden shadow-sm divide-y divide-neutral-200">
              {filteredCategories.map((cat) => (
                <div
                  key={cat.id}
                  className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-neutral-50"
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
                  <button
                    type="button"
                    onClick={() => onEditCategory(cat)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#641526] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#4d0f1d] cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Pencil className="h-3 w-3 text-[#D4AF37]" />
                    Edit Category
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* EDIT TAB 5: Member Accounts & Roles */}
          {editTab === 'member' && (
            <div className="rounded-xl bg-white text-[#1E1B18] border border-neutral-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50 font-semibold text-neutral-600">
                      <th className="py-3 px-5">Member Name & Email</th>
                      <th className="py-3 px-4">ID / LRN</th>
                      <th className="py-3 px-4">Department / Grade</th>
                      <th className="py-3 px-4">Role Permission</th>
                      <th className="py-3 px-5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-neutral-50">
                        <td className="py-3.5 px-5">
                          <div className="font-semibold text-neutral-900">
                            {u.fullName}
                          </div>
                          <div className="text-neutral-500">{u.email}</div>
                        </td>
                        <td className="py-3.5 px-4 font-mono tabular-nums">
                          {u.idNumber}
                        </td>
                        <td className="py-3.5 px-4">{u.gradeOrDepartment}</td>
                        <td className="py-3.5 px-4">
                          <select
                            value={u.role}
                            onChange={(e) =>
                              void onChangeMemberRole(
                                u,
                                e.target.value as UserRole
                              )
                            }
                            className="rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#641526] focus:border-[#641526] focus:outline-none"
                          >
                            {USER_ROLE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3.5 px-5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onEditUser(u)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#641526] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4d0f1d] cursor-pointer"
                          >
                            <Pencil className="h-3 w-3 text-[#D4AF37]" />
                            Edit Account
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ====================================================================
          MODE 3: DELETE (ALL SYSTEM DELETE CONTROLS IN ONE PROTECTED PLACE)
         ==================================================================== */}
      {mode === 'delete' && (
        <div className="space-y-5">
          {/* Sub-Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-[#3A0A14] rounded-xl border border-red-400/35">
            {(
              [
                { id: 'book', label: `Books (${books.length})`, icon: BookOpen },
                {
                  id: 'digital',
                  label: `Digital Materials (${digitalResources.length})`,
                  icon: FileText,
                },
                {
                  id: 'category',
                  label: `Shelf Categories (${categories.length})`,
                  icon: FolderPlus,
                },
                {
                  id: 'member',
                  label: `Member Accounts (${users.length})`,
                  icon: Users,
                },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setDeleteTab(tab.id);
                    setSearchQuery('');
                    setConfirmDeleteKey(null);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    deleteTab === tab.id
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-white/80 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search & Protection Banner */}
          <div className="rounded-xl bg-white p-4 text-[#1E1B18] border border-neutral-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="h-4 w-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search records to delete..."
                className="w-full rounded-lg border border-neutral-300 pl-9 pr-3 py-2 text-xs text-neutral-900 focus:border-red-600 focus:outline-none"
              />
            </div>

            {deleteTab === 'member' && (
              <select
                value={roleFilter}
                onChange={(e) =>
                  setRoleFilter(e.target.value as 'All' | UserRole)
                }
                className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800"
              >
                <option value="All">All Roles ({users.length})</option>
                {USER_ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.shortLabel}
                  </option>
                ))}
              </select>
            )}

            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>Deletions auto-sync immediately to Cloud & Live</span>
            </div>
          </div>

          {/* DELETE TAB 1: Books */}
          {deleteTab === 'book' && (
            <div className="rounded-xl bg-white text-[#1E1B18] border border-neutral-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50 font-semibold text-neutral-600">
                      <th className="py-3 px-5">Book Title & Author</th>
                      <th className="py-3 px-4">ISBN</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-5 text-right">Delete Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {filteredBooks.map((book) => {
                      const key = `book-${book.id}`;
                      const confirming = confirmDeleteKey === key;
                      return (
                        <tr key={book.id} className="hover:bg-neutral-50">
                          <td className="py-3.5 px-5">
                            <div className="font-semibold text-neutral-900">
                              {book.title}
                            </div>
                            <div className="text-neutral-500">{book.author}</div>
                          </td>
                          <td className="py-3.5 px-4 font-mono tabular-nums">
                            {book.isbn}
                          </td>
                          <td className="py-3.5 px-4">{book.category}</td>
                          <td className="py-3.5 px-5 text-right whitespace-nowrap">
                            {confirming ? (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteKey(null)}
                                  className="rounded border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setConfirmDeleteKey(null);
                                    await onDeleteBook(book);
                                  }}
                                  className="rounded bg-red-600 px-3 py-1 text-xs font-bold text-white hover:bg-red-700 cursor-pointer"
                                >
                                  Confirm Delete
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteKey(key)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-600 hover:text-white transition-colors cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete Book
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* DELETE TAB 2: Digital Resources */}
          {deleteTab === 'digital' && (
            <div className="rounded-xl bg-white text-[#1E1B18] border border-neutral-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50 font-semibold text-neutral-600">
                      <th className="py-3 px-5">Material Title & Author</th>
                      <th className="py-3 px-4">Type & Subject</th>
                      <th className="py-3 px-5 text-right">Delete Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {filteredDigital.map((res) => {
                      const key = `digital-${res.id}`;
                      const confirming = confirmDeleteKey === key;
                      return (
                        <tr key={res.id} className="hover:bg-neutral-50">
                          <td className="py-3.5 px-5">
                            <div className="font-semibold text-neutral-900">
                              {res.title}
                            </div>
                            <div className="text-neutral-500">{res.author}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div>{res.resourceType}</div>
                            <div className="text-neutral-500">
                              {res.subject}
                            </div>
                          </td>
                          <td className="py-3.5 px-5 text-right whitespace-nowrap">
                            {confirming ? (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteKey(null)}
                                  className="rounded border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setConfirmDeleteKey(null);
                                    await onDeleteDigital(res);
                                  }}
                                  className="rounded bg-red-600 px-3 py-1 text-xs font-bold text-white hover:bg-red-700 cursor-pointer"
                                >
                                  Confirm Delete
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteKey(key)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-600 hover:text-white transition-colors cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete Material
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* DELETE TAB 3: Shelf Categories */}
          {deleteTab === 'category' && (
            <div className="rounded-xl bg-white text-[#1E1B18] border border-neutral-200 overflow-hidden shadow-sm divide-y divide-neutral-200">
              {filteredCategories.map((cat) => {
                const key = `cat-${cat.id}`;
                const confirming = confirmDeleteKey === key;
                return (
                  <div
                    key={cat.id}
                    className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-neutral-50"
                  >
                    <div>
                      <div className="font-semibold text-sm text-neutral-900">
                        {cat.name}
                      </div>
                      <div className="font-mono text-xs text-[#641526]">
                        {cat.code} · {cat.shelfZone}
                      </div>
                    </div>
                    {confirming ? (
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteKey(null)}
                          className="rounded border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            setConfirmDeleteKey(null);
                            await onDeleteCategory(cat);
                          }}
                          className="rounded bg-red-600 px-3 py-1 text-xs font-bold text-white hover:bg-red-700 cursor-pointer"
                        >
                          Confirm Delete
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteKey(key)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-600 hover:text-white transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete Category
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* DELETE TAB 4: Member Accounts */}
          {deleteTab === 'member' && (
            <div className="rounded-xl bg-white text-[#1E1B18] border border-neutral-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50 font-semibold text-neutral-600">
                      <th className="py-3 px-5">Member Name & Email</th>
                      <th className="py-3 px-4">ID / LRN</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-5 text-right">Delete Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {filteredUsers.map((u) => {
                      const key = `user-${u.id}`;
                      const confirming = confirmDeleteKey === key;
                      return (
                        <tr key={u.id} className="hover:bg-neutral-50">
                          <td className="py-3.5 px-5">
                            <div className="font-semibold text-neutral-900">
                              {u.fullName}
                            </div>
                            <div className="text-neutral-500">{u.email}</div>
                          </td>
                          <td className="py-3.5 px-4 font-mono tabular-nums">
                            {u.idNumber}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-[#641526]">
                            {u.role}
                          </td>
                          <td className="py-3.5 px-5 text-right whitespace-nowrap">
                            {confirming ? (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteKey(null)}
                                  className="rounded border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setConfirmDeleteKey(null);
                                    await onDeleteUser(u);
                                  }}
                                  className="rounded bg-red-600 px-3 py-1 text-xs font-bold text-white hover:bg-red-700 cursor-pointer"
                                >
                                  Confirm Delete
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteKey(key)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-600 hover:text-white transition-colors cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete Account
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
