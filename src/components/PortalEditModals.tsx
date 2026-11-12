import React, { useEffect, useState } from 'react';
import { X, Upload, Image as ImageIcon, Link2, Check, LogIn, ShieldCheck } from 'lucide-react';
import {
  BookItem,
  BookCategory,
  DigitalResource,
  LibraryUser,
  PortalSettings,
  UserRole,
} from '../types.ts';
import { BUNDLED_ASSETS, INITIAL_USERS } from '../data/bnhsInitialData.ts';

interface AdminPortalSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PortalSettings;
  onSave: (updated: PortalSettings) => Promise<void>;
}

function normalizeGoogleImageLink(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  // Match Google Drive /file/d/<FILE_ID>/...
  const fileDMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch && fileDMatch[1]) {
    return `https://drive.google.com/thumbnail?id=${fileDMatch[1]}&sz=w1920`;
  }

  // Match Google Drive ?id=<FILE_ID> or &id=<FILE_ID>
  if (trimmed.includes('drive.google.com')) {
    const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idParamMatch && idParamMatch[1]) {
      return `https://drive.google.com/thumbnail?id=${idParamMatch[1]}&sz=w1920`;
    }
  }

  return trimmed;
}

export const AdminPortalSettingsModal: React.FC<
  AdminPortalSettingsModalProps
> = ({ isOpen, onClose, settings, onSave }) => {
  const [form, setForm] = useState<PortalSettings>(settings);
  const [heroGoogleLink, setHeroGoogleLink] = useState('');
  const [logoGoogleLink, setLogoGoogleLink] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(settings);
    setHeroGoogleLink(
      settings.heroImageUrl.startsWith('http') ? settings.heroImageUrl : ''
    );
    setLogoGoogleLink(
      settings.logoImageUrl.startsWith('http') ? settings.logoImageUrl : ''
    );
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handleImageFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'heroImageUrl' | 'logoImageUrl'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setForm((prev) => ({ ...prev, [field]: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApplyGoogleLink = (
    rawLink: string,
    field: 'heroImageUrl' | 'logoImageUrl'
  ) => {
    const normalized = normalizeGoogleImageLink(rawLink);
    if (!normalized) return;
    setForm((prev) => ({ ...prev, [field]: normalized }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const nextSettings: PortalSettings = {
        ...form,
        heroImageUrl: heroGoogleLink.trim()
          ? normalizeGoogleImageLink(heroGoogleLink)
          : form.heroImageUrl,
        logoImageUrl: logoGoogleLink.trim()
          ? normalizeGoogleImageLink(logoGoogleLink)
          : form.logoImageUrl,
      };
      await onSave(nextSettings);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-xl rounded-xl bg-white text-[#1E1B18] shadow-2xl border border-[#D4AF37]/40 overflow-hidden">
        <div className="flex items-center justify-between bg-[#420B17] px-6 py-4 text-white">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-[#D4AF37]" />
            <h3 className="font-display text-base font-bold">
              Edit BNHS Portal Banner, Image & Schedule
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-white/70 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs max-h-[82vh] overflow-y-auto">
          {/* Official Portal Title & Developer Credit is intentionally hidden per request */}
          <input type="hidden" value={form.portalTitle} readOnly />

          <div>
            <label className="block font-semibold text-neutral-700 mb-1">
              Academic Year & Operating Hours Banner Text
            </label>
            <input
              type="text"
              required
              value={form.scheduleBannerText}
              onChange={(e) =>
                setForm({ ...form, scheduleBannerText: e.target.value })
              }
              placeholder="Academic Year 2026–2027 · Open Mon–Fri, 7:30 AM – 5:00 PM"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 font-medium"
            />
          </div>

          <div>
            <label className="block font-semibold text-neutral-700 mb-1">
              Welcome Banner Heading
            </label>
            <input
              type="text"
              required
              value={form.welcomeHeading}
              onChange={(e) =>
                setForm({ ...form, welcomeHeading: e.target.value })
              }
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
            />
          </div>

          {/* Portal Hero Image Uploader / Google Link */}
          <div className="space-y-2.5 rounded-lg bg-neutral-50 p-3.5 border border-neutral-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="font-semibold text-neutral-800">
                Portal Hero Banner Image
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-md bg-[#641526] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#4d0f1d]">
                <Upload className="h-3.5 w-3.5 text-[#D4AF37]" />
                Upload Image File
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    setHeroGoogleLink('');
                    handleImageFileUpload(e, 'heroImageUrl');
                  }}
                  className="hidden"
                />
              </label>
            </div>

            {/* Option 2: Upload through Google Link */}
            <div className="rounded-lg bg-white p-2.5 border border-neutral-200 space-y-1.5">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#641526]">
                <Link2 className="h-3.5 w-3.5 text-[#D4AF37]" />
                Upload through Google Link (Google Drive / Google Photos / Image URL)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={heroGoogleLink}
                  onChange={(e) => {
                    const val = e.target.value;
                    setHeroGoogleLink(val);
                    if (val.trim()) {
                      handleApplyGoogleLink(val, 'heroImageUrl');
                    }
                  }}
                  placeholder="https://drive.google.com/file/d/... or Google image link"
                  className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-neutral-900 font-mono text-[11px]"
                />
                <button
                  type="button"
                  onClick={() =>
                    handleApplyGoogleLink(heroGoogleLink, 'heroImageUrl')
                  }
                  className="inline-flex items-center gap-1 rounded-lg bg-[#D4AF37] px-3 py-1.5 text-[11px] font-bold text-[#3A0A14] hover:bg-[#e5c247] shrink-0"
                >
                  <Check className="h-3.5 w-3.5" />
                  Apply Link
                </button>
              </div>
              <p className="text-[10px] text-neutral-500">
                Supports Google Drive share links (anyone with link), Google Photos links, or direct image URLs.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[11px] text-neutral-500">Presets:</span>
              <button
                type="button"
                onClick={() => {
                  setHeroGoogleLink('');
                  setForm({
                    ...form,
                    heroImageUrl: BUNDLED_ASSETS.heroBanner,
                  });
                }}
                className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-[11px] hover:border-[#641526]"
              >
                BNHS Reading Hall
              </button>
              <button
                type="button"
                onClick={() => {
                  setHeroGoogleLink('');
                  setForm({
                    ...form,
                    heroImageUrl: BUNDLED_ASSETS.coverHistory,
                  });
                }}
                className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-[11px] hover:border-[#641526]"
              >
                Filipiñana Archive
              </button>
              <button
                type="button"
                onClick={() => {
                  setHeroGoogleLink('');
                  setForm({
                    ...form,
                    heroImageUrl: BUNDLED_ASSETS.coverScience,
                  });
                }}
                className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-[11px] hover:border-[#641526]"
              >
                STEM Collection
              </button>
            </div>
          </div>

          {/* School Seal Logo Image Uploader / Google Link */}
          <div className="space-y-2.5 rounded-lg bg-neutral-50 p-3.5 border border-neutral-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="font-semibold text-neutral-800">
                BNHS School Logo Image (GIF / PNG / JPG)
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-md bg-[#641526] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#4d0f1d]">
                <Upload className="h-3.5 w-3.5 text-[#D4AF37]" />
                Upload Logo File
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    setLogoGoogleLink('');
                    handleImageFileUpload(e, 'logoImageUrl');
                  }}
                  className="hidden"
                />
              </label>
            </div>

            {/* Option 2: Upload Logo through Google Link */}
            <div className="rounded-lg bg-white p-2.5 border border-neutral-200 space-y-1.5">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#641526]">
                <Link2 className="h-3.5 w-3.5 text-[#D4AF37]" />
                Upload Logo through Google Link (Google Drive / Google Image URL)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={logoGoogleLink}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLogoGoogleLink(val);
                    if (val.trim()) {
                      handleApplyGoogleLink(val, 'logoImageUrl');
                    }
                  }}
                  placeholder="https://drive.google.com/file/d/... or Google logo link"
                  className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-neutral-900 font-mono text-[11px]"
                />
                <button
                  type="button"
                  onClick={() =>
                    handleApplyGoogleLink(logoGoogleLink, 'logoImageUrl')
                  }
                  className="inline-flex items-center gap-1 rounded-lg bg-[#D4AF37] px-3 py-1.5 text-[11px] font-bold text-[#3A0A14] hover:bg-[#e5c247] shrink-0"
                >
                  <Check className="h-3.5 w-3.5" />
                  Apply Link
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-neutral-300 px-4 py-2 font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#641526] px-5 py-2 font-semibold text-white hover:bg-[#4d0f1d] disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Portal Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface EditBookModalProps {
  book: BookItem | null;
  categories: BookCategory[];
  onClose: () => void;
  onSave: (bookId: number, updated: Partial<BookItem>) => Promise<void>;
}

export const EditBookModal: React.FC<EditBookModalProps> = ({
  book,
  categories,
  onClose,
  onSave,
}) => {
  const [form, setForm] = useState({
    title: '',
    author: '',
    isbn: '',
    subject: '',
    category: '',
    publisher: '',
    publicationYear: 2025,
    shelfLocation: '',
    totalCopies: 1,
    availableCopies: 1,
    description: '',
    coverKey: 'history',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (book) {
      setForm({
        title: book.title,
        author: book.author,
        isbn: book.isbn,
        subject: book.subject,
        category: book.category,
        publisher: book.publisher,
        publicationYear: book.publicationYear,
        shelfLocation: book.shelfLocation,
        totalCopies: book.totalCopies,
        availableCopies: book.availableCopies,
        description: book.description,
        coverKey: book.coverKey || 'history',
      });
    }
  }, [book]);

  if (!book) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(book.id, form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-xl rounded-xl bg-white text-[#1E1B18] shadow-2xl border border-[#D4AF37]/40 overflow-hidden">
        <div className="flex items-center justify-between bg-[#420B17] px-6 py-4 text-white">
          <h3 className="font-display text-base font-bold">
            Edit Catalog Book Record
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-white/70 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-3.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">
                Book Title
              </label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
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
                value={form.author}
                onChange={(e) => setForm({ ...form, author: e.target.value })}
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
                value={form.isbn}
                onChange={(e) => setForm({ ...form, isbn: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-neutral-900"
              />
            </div>
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">
                Subject
              </label>
              <input
                type="text"
                required
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
              />
            </div>
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">
                Category
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
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
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">
                Publisher
              </label>
              <input
                type="text"
                required
                value={form.publisher}
                onChange={(e) =>
                  setForm({ ...form, publisher: e.target.value })
                }
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
              />
            </div>
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">
                Shelf Location
              </label>
              <input
                type="text"
                required
                value={form.shelfLocation}
                onChange={(e) =>
                  setForm({ ...form, shelfLocation: e.target.value })
                }
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
              />
            </div>
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">
                Total Copies
              </label>
              <input
                type="number"
                min={1}
                required
                value={form.totalCopies}
                onChange={(e) =>
                  setForm({ ...form, totalCopies: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-neutral-900"
              />
            </div>
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">
                Available Copies
              </label>
              <input
                type="number"
                min={0}
                required
                value={form.availableCopies}
                onChange={(e) =>
                  setForm({
                    ...form,
                    availableCopies: Number(e.target.value),
                  })
                }
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-neutral-900"
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
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-neutral-300 px-4 py-2 font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#641526] px-5 py-2 font-semibold text-white hover:bg-[#4d0f1d] disabled:opacity-50"
            >
              {saving ? 'Updating...' : 'Save Book Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface EditDigitalResourceModalProps {
  resource: DigitalResource | null;
  onClose: () => void;
  onSave: (
    resourceId: number,
    updated: Partial<DigitalResource>
  ) => Promise<void>;
}

export const EditDigitalResourceModal: React.FC<
  EditDigitalResourceModalProps
> = ({ resource, onClose, onSave }) => {
  const [form, setForm] = useState({
    title: '',
    author: '',
    resourceType: 'PDF Learning Material' as DigitalResource['resourceType'],
    subject: '',
    gradeLevel: '',
    fileSize: '',
    pageCount: 32,
    summary: '',
    contentPreview: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (resource) {
      setForm({
        title: resource.title,
        author: resource.author,
        resourceType: resource.resourceType,
        subject: resource.subject,
        gradeLevel: resource.gradeLevel,
        fileSize: resource.fileSize,
        pageCount: resource.pageCount,
        summary: resource.summary,
        contentPreview: resource.contentPreview,
      });
    }
  }, [resource]);

  if (!resource) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(resource.id, form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-xl rounded-xl bg-white text-[#1E1B18] shadow-2xl border border-[#D4AF37]/40 overflow-hidden">
        <div className="flex items-center justify-between bg-[#420B17] px-6 py-4 text-white">
          <h3 className="font-display text-base font-bold">
            Edit Digital Library Resource
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-white/70 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-neutral-700 mb-1">
              Resource Title
            </label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">
                Author / Source
              </label>
              <input
                type="text"
                required
                value={form.author}
                onChange={(e) => setForm({ ...form, author: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
              />
            </div>
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">
                Resource Type
              </label>
              <select
                value={form.resourceType}
                onChange={(e) =>
                  setForm({
                    ...form,
                    resourceType: e.target
                      .value as DigitalResource['resourceType'],
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
                value={form.gradeLevel}
                onChange={(e) =>
                  setForm({ ...form, gradeLevel: e.target.value })
                }
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">
                Subject
              </label>
              <input
                type="text"
                required
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
              />
            </div>
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">
                File Size
              </label>
              <input
                type="text"
                required
                value={form.fileSize}
                onChange={(e) => setForm({ ...form, fileSize: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-neutral-900"
              />
            </div>
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">
                Page Count
              </label>
              <input
                type="number"
                min={1}
                required
                value={form.pageCount}
                onChange={(e) =>
                  setForm({ ...form, pageCount: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-neutral-900"
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
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
            />
          </div>

          <div>
            <label className="block font-semibold text-neutral-700 mb-1">
              Full Content / Preview Text
            </label>
            <textarea
              rows={4}
              required
              value={form.contentPreview}
              onChange={(e) =>
                setForm({ ...form, contentPreview: e.target.value })
              }
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-neutral-300 px-4 py-2 font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#641526] px-5 py-2 font-semibold text-white hover:bg-[#4d0f1d] disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Update Digital Resource'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface EditUserModalProps {
  user: LibraryUser | null;
  allUsers?: LibraryUser[];
  onClose: () => void;
  onSave: (userId: number, updated: Partial<LibraryUser>) => Promise<void>;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({
  user,
  allUsers = [],
  onClose,
  onSave,
}) => {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    role: 'Student' as LibraryUser['role'],
    idNumber: '',
    gradeOrDepartment: '',
    status: 'Active',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        fullName: user.fullName || '',
        email: user.email || '',
        role: user.role || 'Student',
        idNumber: user.idNumber || '',
        gradeOrDepartment: user.gradeOrDepartment || '',
        status: user.status || 'Active',
      });
    }
  }, [user?.id]);

  if (!user) return null;

  const handleRoleChangeInModal = (nextRole: LibraryUser['role']) => {
    const matchedRoleUser =
      allUsers.find((u) => u.role === nextRole && u.id !== user.id) ||
      allUsers.find((u) => u.role === nextRole) ||
      INITIAL_USERS.find((u) => u.role === nextRole);

    if (nextRole === 'Librarian' && matchedRoleUser) {
      setForm((prev) => ({
        ...prev,
        role: nextRole,
        fullName:
          prev.fullName.trim() && prev.fullName !== user.fullName
            ? prev.fullName
            : matchedRoleUser.fullName,
        gradeOrDepartment:
          prev.gradeOrDepartment.startsWith('Grade') || !prev.gradeOrDepartment
            ? matchedRoleUser.gradeOrDepartment || 'Head School Librarian'
            : prev.gradeOrDepartment,
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      role: nextRole,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim()) return;
    setSaving(true);
    try {
      await onSave(user.id, {
        ...form,
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        idNumber: form.idNumber.trim(),
        gradeOrDepartment: form.gradeOrDepartment.trim(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-md rounded-xl bg-white text-[#1E1B18] shadow-2xl border border-[#D4AF37]/40 overflow-hidden">
        <div className="flex items-center justify-between bg-[#420B17] px-6 py-4 text-white">
          <h3 className="font-display text-base font-bold">
            Edit Library Member Account
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-white/70 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-neutral-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              autoFocus
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              placeholder="Enter full name..."
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 font-semibold focus:border-[#641526] focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-semibold text-neutral-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 focus:border-[#641526] focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">
                Role Permission
              </label>
              <select
                value={form.role}
                onChange={(e) =>
                  handleRoleChangeInModal(
                    e.target.value as LibraryUser['role']
                  )
                }
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 font-semibold focus:border-[#641526] focus:outline-none"
              >
                <option value="Administrator">Administrator</option>
                <option value="Librarian">Librarian</option>
                <option value="Teacher">Teacher</option>
                <option value="Student">Student</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">
                LRN / Employee ID
              </label>
              <input
                type="text"
                required
                value={form.idNumber}
                onChange={(e) => setForm({ ...form, idNumber: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-neutral-900 focus:border-[#641526] focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block font-semibold text-neutral-700 mb-1">
              Grade & Section / Department
            </label>
            <input
              type="text"
              required
              value={form.gradeOrDepartment}
              onChange={(e) =>
                setForm({ ...form, gradeOrDepartment: e.target.value })
              }
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 focus:border-[#641526] focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-neutral-300 px-4 py-2 font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#641526] px-5 py-2 font-semibold text-white hover:bg-[#4d0f1d] disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Update Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface EditCategoryModalProps {
  category: BookCategory | null;
  onClose: () => void;
  onSave: (
    categoryId: number,
    updated: Partial<BookCategory>
  ) => Promise<void>;
}

export const EditCategoryModal: React.FC<EditCategoryModalProps> = ({
  category,
  onClose,
  onSave,
}) => {
  const [form, setForm] = useState({
    name: '',
    code: '',
    shelfZone: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (category) {
      setForm({
        name: category.name,
        code: category.code,
        shelfZone: category.shelfZone,
        description: category.description,
      });
    }
  }, [category]);

  if (!category) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(category.id, form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-md rounded-xl bg-white text-[#1E1B18] shadow-2xl border border-[#D4AF37]/40 overflow-hidden">
        <div className="flex items-center justify-between bg-[#420B17] px-6 py-4 text-white">
          <h3 className="font-display text-base font-bold">
            Edit Shelf Category
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-white/70 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-neutral-700 mb-1">
              Category Name
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">
                Code
              </label>
              <input
                type="text"
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
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
                value={form.shelfZone}
                onChange={(e) =>
                  setForm({ ...form, shelfZone: e.target.value })
                }
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
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-neutral-300 px-4 py-2 font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#641526] px-5 py-2 font-semibold text-white hover:bg-[#4d0f1d] disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Update Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface GoogleSignInModalProps {
  isOpen: boolean;
  users?: LibraryUser[];
  onClose: () => void;
  onSelectAccount: (account: {
    fullName: string;
    email: string;
    role: UserRole;
    idNumber: string;
    gradeOrDepartment: string;
  }) => Promise<void>;
}

export const GoogleSignInModal: React.FC<GoogleSignInModalProps> = ({
  isOpen,
  users = [],
  onClose,
  onSelectAccount,
}) => {
  const activeUsersList = users.length > 0 ? users : INITIAL_USERS;
  const [fullName, setFullName] = useState('Bless T. Tajale');
  const [email, setEmail] = useState('blesstajale@gmail.com');
  const [role, setRole] = useState<UserRole>('Administrator');
  const [idNumber, setIdNumber] = useState('ADM-2026-0001');
  const [gradeOrDepartment, setGradeOrDepartment] = useState(
    'Portal Developer & System Administration'
  );
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleRoleSelectChange = (selectedRole: UserRole) => {
    setRole(selectedRole);
    const matchingUser =
      activeUsersList.find((u) => u.role === selectedRole) ||
      INITIAL_USERS.find((u) => u.role === selectedRole);
    if (matchingUser) {
      setFullName(matchingUser.fullName);
      setEmail(matchingUser.email);
      setIdNumber(matchingUser.idNumber);
      setGradeOrDepartment(matchingUser.gradeOrDepartment);
    }
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSelectAccount({
        fullName,
        email,
        role,
        idNumber,
        gradeOrDepartment,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-md rounded-xl bg-white text-[#1E1B18] shadow-2xl border border-[#D4AF37]/50 overflow-hidden">
        <div className="flex items-center justify-between bg-[#420B17] px-6 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-[#D4AF37]" />
            <div>
              <h3 className="font-display text-base font-bold">
                Google & BNHS Account Sign-In
              </h3>
              <p className="text-[11px] text-white/75">
                Barobo National High School Library Portal
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-white/70 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs max-h-[82vh] overflow-y-auto">
          <div>
            <div className="font-semibold text-neutral-700 mb-2">
              Quick Sign-In with Google / BNHS Account:
            </div>
            <div className="space-y-2">
              {activeUsersList.slice(0, 5).map((acct) => (
                <button
                  key={`${acct.id}-${acct.uid}`}
                  type="button"
                  onClick={() =>
                    onSelectAccount({
                      fullName: acct.fullName,
                      email: acct.email,
                      role: acct.role,
                      idNumber: acct.idNumber,
                      gradeOrDepartment: acct.gradeOrDepartment,
                    })
                  }
                  className="w-full flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50 hover:bg-[#641526]/5 hover:border-[#641526] p-3 text-left transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-[#641526] text-[#D4AF37] font-bold flex items-center justify-center shrink-0">
                      {acct.fullName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-neutral-900 truncate">
                        {acct.fullName}
                      </div>
                      <div className="text-[11px] text-neutral-500 truncate">
                        {acct.email}
                      </div>
                    </div>
                  </div>
                  <span className="rounded bg-[#641526]/10 px-2 py-0.5 text-[10px] font-bold text-[#641526] shrink-0">
                    {acct.role}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <form
            onSubmit={handleCustomSubmit}
            className="pt-3 border-t border-neutral-200 space-y-3"
          >
            <div className="font-semibold text-neutral-700">
              Or Sign In with Your Google Email:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-neutral-600 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-neutral-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-neutral-600 mb-1">
                  Google Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-neutral-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-neutral-600 mb-1">
                  Portal Role
                </label>
                <select
                  value={role}
                  onChange={(e) =>
                    handleRoleSelectChange(e.target.value as UserRole)
                  }
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-neutral-900"
                >
                  <option value="Administrator">Administrator</option>
                  <option value="Librarian">Librarian</option>
                  <option value="Teacher">Teacher</option>
                  <option value="Student">Student</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-neutral-600 mb-1">
                  ID / LRN Number
                </label>
                <input
                  type="text"
                  required
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 font-mono text-neutral-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-neutral-300 px-4 py-2 font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#641526] px-4 py-2 font-semibold text-white hover:bg-[#4d0f1d] disabled:opacity-50"
              >
                <LogIn className="h-3.5 w-3.5 text-[#D4AF37]" />
                {submitting ? 'Signing In...' : 'Sign In with Google'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
