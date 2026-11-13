import React, { useEffect, useState } from 'react';
import {
  X,
  Upload,
  Image as ImageIcon,
  Link2,
  Check,
  LogIn,
  ShieldCheck,
  Eye,
  FileText,
} from 'lucide-react';
import {
  BookItem,
  BookCategory,
  DigitalResource,
  LibraryUser,
  PortalSettings,
  UserRole,
} from '../types.ts';
import { BUNDLED_ASSETS, INITIAL_USERS } from '../data/bnhsInitialData.ts';
import {
  normalizeGoogleDriveImageUrl,
  readFileAsResourcePayload,
} from '../lib/filePreview.ts';
import {
  ImageLightboxPreviewModal,
  InlineFilePreview,
} from './FilePreviewModal.tsx';

interface AdminPortalSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PortalSettings;
  onSave: (updated: PortalSettings, silentAutoSave?: boolean) => Promise<void>;
}

function normalizeGoogleImageLink(rawUrl: string): string {
  return normalizeGoogleDriveImageUrl(rawUrl);
}

export const AdminPortalSettingsModal: React.FC<
  AdminPortalSettingsModalProps
> = ({ isOpen, onClose, settings, onSave }) => {
  const [form, setForm] = useState<PortalSettings>(settings);
  const [heroGoogleLink, setHeroGoogleLink] = useState('');
  const [logoGoogleLink, setLogoGoogleLink] = useState('');
  const [saving, setSaving] = useState(false);
  const [autoSaveNote, setAutoSaveNote] = useState('');
  const [lightboxPreview, setLightboxPreview] = useState<{
    url: string;
    title: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setForm(settings);
      setHeroGoogleLink(
        settings.heroImageUrl.startsWith('http') ? settings.heroImageUrl : ''
      );
      setLogoGoogleLink(
        settings.logoImageUrl.startsWith('http') ? settings.logoImageUrl : ''
      );
      setAutoSaveNote('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const triggerAutoCloudSave = async (
    nextSettings: PortalSettings,
    label: string
  ) => {
    setAutoSaveNote(`Auto-saving ${label} to Cloud Sync...`);
    try {
      await onSave(nextSettings, true);
      setAutoSaveNote(`${label} saved automatically to Cloud Sync.`);
    } catch {
      setAutoSaveNote(`${label} saved locally (queued for Cloud Sync).`);
    }
  };

  const handleImageFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'heroImageUrl' | 'logoImageUrl'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const dataUrl = reader.result as string;
        const nextSettings: PortalSettings = { ...form, [field]: dataUrl };
        setForm(nextSettings);
        void triggerAutoCloudSave(
          nextSettings,
          field === 'heroImageUrl' ? 'Hero Banner Image' : 'School Logo Image'
        );
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApplyGoogleLink = (
    rawLink: string,
    field: 'heroImageUrl' | 'logoImageUrl',
    autoSave = false
  ) => {
    const normalized = normalizeGoogleImageLink(rawLink);
    if (!normalized) return;
    const nextSettings: PortalSettings = { ...form, [field]: normalized };
    setForm(nextSettings);
    if (autoSave) {
      void triggerAutoCloudSave(
        nextSettings,
        field === 'heroImageUrl' ? 'Hero Banner Link' : 'School Logo Link'
      );
    }
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
      await onSave(nextSettings, false);
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
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setLightboxPreview({
                      url: form.heroImageUrl || BUNDLED_ASSETS.heroBanner,
                      title: 'Portal Hero Banner Image Preview',
                    })
                  }
                  className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-neutral-800 hover:bg-neutral-100"
                >
                  <Eye className="h-3.5 w-3.5 text-[#641526]" />
                  Preview
                </button>
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
            </div>

            <div className="h-28 w-full rounded-lg overflow-hidden border border-neutral-200 bg-neutral-200 relative">
              <img
                src={form.heroImageUrl || BUNDLED_ASSETS.heroBanner}
                alt="Hero banner preview"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
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
                    handleApplyGoogleLink(heroGoogleLink, 'heroImageUrl', true)
                  }
                  className="inline-flex items-center gap-1 rounded-lg bg-[#D4AF37] px-3 py-1.5 text-[11px] font-bold text-[#3A0A14] hover:bg-[#e5c247] shrink-0"
                >
                  <Check className="h-3.5 w-3.5" />
                  Apply Link
                </button>
              </div>
              <p className="text-[10px] text-neutral-500">
                Supports Google Drive share links (anyone with link), Google Photos links, or direct image URLs. Files auto-save immediately on upload.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[11px] text-neutral-500">Presets:</span>
              <button
                type="button"
                onClick={() => {
                  setHeroGoogleLink('');
                  const next = {
                    ...form,
                    heroImageUrl: BUNDLED_ASSETS.heroBanner,
                  };
                  setForm(next);
                  void triggerAutoCloudSave(next, 'Hero Preset');
                }}
                className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-[11px] hover:border-[#641526]"
              >
                BNHS Reading Hall
              </button>
              <button
                type="button"
                onClick={() => {
                  setHeroGoogleLink('');
                  const next = {
                    ...form,
                    heroImageUrl: BUNDLED_ASSETS.coverHistory,
                  };
                  setForm(next);
                  void triggerAutoCloudSave(next, 'Hero Preset');
                }}
                className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-[11px] hover:border-[#641526]"
              >
                Filipiñana Archive
              </button>
              <button
                type="button"
                onClick={() => {
                  setHeroGoogleLink('');
                  const next = {
                    ...form,
                    heroImageUrl: BUNDLED_ASSETS.coverScience,
                  };
                  setForm(next);
                  void triggerAutoCloudSave(next, 'Hero Preset');
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
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setLightboxPreview({
                      url: form.logoImageUrl || BUNDLED_ASSETS.logoAnimatedGif,
                      title: 'BNHS School Logo Preview',
                    })
                  }
                  className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-neutral-800 hover:bg-neutral-100"
                >
                  <Eye className="h-3.5 w-3.5 text-[#641526]" />
                  Preview
                </button>
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
            </div>

            <div className="flex items-center gap-3">
              <div className="h-16 w-16 rounded-full overflow-hidden border-2 border-[#D4AF37] bg-white p-0.5 shrink-0 flex items-center justify-center">
                <img
                  src={form.logoImageUrl || BUNDLED_ASSETS.logoAnimatedGif}
                  alt="School Logo preview"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-contain rounded-full"
                />
              </div>
              <div className="text-[11px] text-neutral-600">
                Live School Seal Preview (auto-saves immediately when a file is selected).
              </div>
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
                    handleApplyGoogleLink(logoGoogleLink, 'logoImageUrl', true)
                  }
                  className="inline-flex items-center gap-1 rounded-lg bg-[#D4AF37] px-3 py-1.5 text-[11px] font-bold text-[#3A0A14] hover:bg-[#e5c247] shrink-0"
                >
                  <Check className="h-3.5 w-3.5" />
                  Apply Link
                </button>
              </div>
            </div>
          </div>

          {autoSaveNote && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-[11px] font-semibold text-emerald-800 flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>{autoSaveNote}</span>
            </div>
          )}

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
      <ImageLightboxPreviewModal
        imageUrl={lightboxPreview?.url || null}
        title={lightboxPreview?.title || 'Image Preview'}
        onClose={() => setLightboxPreview(null)}
      />
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
  }, [book?.id]);

  if (!book) return null;

  const handleBookCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const nextCover = reader.result as string;
        const nextForm = { ...form, coverKey: nextCover };
        setForm(nextForm);
        void onSave(book.id, nextForm);
      }
    };
    reader.readAsDataURL(file);
  };

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

          <div className="rounded-lg bg-neutral-50 p-3 border border-neutral-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-12 w-9 rounded overflow-hidden border border-neutral-300 bg-white shrink-0">
                <img
                  src={
                    form.coverKey.startsWith('data:') ||
                    form.coverKey.startsWith('http') ||
                    form.coverKey.startsWith('/')
                      ? form.coverKey
                      : form.coverKey === 'science'
                      ? BUNDLED_ASSETS.coverScience
                      : BUNDLED_ASSETS.coverHistory
                  }
                  alt="Book Cover Preview"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="text-[11px] text-neutral-600">
                <div className="font-semibold text-neutral-800">
                  Book Cover Image
                </div>
                <div>Auto-saves when you upload an image file</div>
              </div>
            </div>
            <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-md bg-[#641526] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#4d0f1d]">
              <Upload className="h-3.5 w-3.5 text-[#D4AF37]" />
              Upload Cover File
              <input
                type="file"
                accept="image/*"
                onChange={handleBookCoverUpload}
                className="hidden"
              />
            </label>
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
    externalUrl: '',
  });
  const [saving, setSaving] = useState(false);
  const [attachedFileName, setAttachedFileName] = useState('');
  const [fileError, setFileError] = useState('');
  const [showInlinePreview, setShowInlinePreview] = useState(false);

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
        externalUrl: resource.externalUrl || '',
      });
      setAttachedFileName('');
      setFileError('');
      setShowInlinePreview(false);
    }
  }, [resource?.id]);

  if (!resource) return null;

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError('');
    try {
      const parsed = await readFileAsResourcePayload(file);
      const nextForm = {
        ...form,
        fileSize: parsed.fileSizeLabel,
        pageCount: parsed.suggestedPageCount || form.pageCount,
        externalUrl: parsed.dataUrl,
        contentPreview:
          parsed.extractedText ||
          form.contentPreview ||
          `Uploaded file: ${parsed.fileName} (${parsed.fileSizeLabel})`,
      };
      setForm(nextForm);
      setAttachedFileName(parsed.fileName);
      setShowInlinePreview(true);
      await onSave(resource.id, nextForm);
    } catch (err: any) {
      setFileError(err?.message || 'Failed to read uploaded file.');
    }
  };

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
      <div className="w-full max-w-2xl rounded-xl bg-white text-[#1E1B18] shadow-2xl border border-[#D4AF37]/40 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between bg-[#420B17] px-6 py-4 text-white shrink-0">
          <h3 className="font-display text-base font-bold">
            Edit Digital Library Resource
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-white/70 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-3.5 text-xs overflow-y-auto flex-1"
        >
          {/* File Upload & Preview Box */}
          <div className="rounded-lg bg-neutral-50 border border-neutral-200 p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold text-[#641526]">
                <FileText className="h-4 w-4 text-[#D4AF37]" />
                <span>Attach / Replace Learning File (PDF, Doc, Image, Text)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowInlinePreview((prev) => !prev)}
                  className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-neutral-800 hover:bg-neutral-100"
                >
                  <Eye className="h-3.5 w-3.5 text-[#641526]" />
                  {showInlinePreview ? 'Hide Preview' : 'Preview File'}
                </button>
                <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-md bg-[#641526] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#4d0f1d]">
                  <Upload className="h-3.5 w-3.5 text-[#D4AF37]" />
                  Upload File
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv,.epub,.html,.jpg,.jpeg,.png,.gif,.webp"
                    onChange={handleFilePicked}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {attachedFileName && (
              <div className="rounded bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800 flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>
                  Attached "{attachedFileName}" ({form.fileSize}) — Auto-saved to Cloud Sync!
                </span>
              </div>
            )}

            {fileError && (
              <div className="rounded bg-red-50 border border-red-200 px-2.5 py-1.5 text-[11px] font-medium text-red-700">
                {fileError}
              </div>
            )}

            <div>
              <label className="block text-[11px] font-medium text-neutral-600 mb-1">
                Or Google Drive / File URL
              </label>
              <input
                type="text"
                value={
                  form.externalUrl.startsWith('data:')
                    ? `[Uploaded File Saved · ${form.fileSize}]`
                    : form.externalUrl
                }
                onChange={(e) => {
                  if (!e.target.value.startsWith('[Uploaded File Saved')) {
                    setForm({ ...form, externalUrl: e.target.value });
                  }
                }}
                placeholder="https://drive.google.com/file/d/... or direct file URL"
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-1.5 font-mono text-[11px] text-neutral-800"
              />
            </div>

            {showInlinePreview && (
              <div className="pt-1">
                <InlineFilePreview
                  title={form.title}
                  externalUrl={form.externalUrl}
                  fileSize={form.fileSize}
                  contentPreview={form.contentPreview}
                  summary={form.summary}
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
  }, [category?.id]);

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
