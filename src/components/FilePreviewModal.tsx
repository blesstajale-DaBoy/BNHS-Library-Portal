import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Download,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  AlertTriangle,
  Eye,
} from 'lucide-react';
import { DigitalResource } from '../types.ts';
import {
  dataUrlToBlobUrl,
  detectPreviewKind,
  normalizeGoogleDrivePreviewUrl,
} from '../lib/filePreview.ts';

interface InlineFilePreviewProps {
  title: string;
  externalUrl?: string;
  fileSize?: string;
  contentPreview?: string;
  summary?: string;
  compact?: boolean;
  onDownload?: () => void;
}

export const InlineFilePreview: React.FC<InlineFilePreviewProps> = ({
  title,
  externalUrl,
  fileSize,
  contentPreview,
  summary,
  compact = false,
  onDownload,
}) => {
  const [imgError, setImgError] = useState(false);
  const kind = useMemo(
    () => detectPreviewKind(externalUrl, fileSize, contentPreview),
    [externalUrl, fileSize, contentPreview]
  );

  const [{ blobUrl, decodedText }, setConverted] = useState<{
    blobUrl: string | null;
    decodedText: string | null;
  }>({ blobUrl: null, decodedText: null });

  useEffect(() => {
    setImgError(false);
    if (externalUrl && externalUrl.startsWith('data:')) {
      const res = dataUrlToBlobUrl(externalUrl);
      setConverted({ blobUrl: res.blobUrl, decodedText: res.decodedText });
      return () => {
        if (res.blobUrl) {
          URL.revokeObjectURL(res.blobUrl);
        }
      };
    }
    setConverted({ blobUrl: null, decodedText: null });
    return undefined;
  }, [externalUrl]);

  const heightClass = compact ? 'h-48' : 'h-[58vh] min-h-[320px]';

  if (kind === 'image') {
    const imgSrc = blobUrl || externalUrl || '';
    if (!imgError && imgSrc) {
      return (
        <div
          className={`w-full ${
            compact ? 'max-h-56' : 'max-h-[60vh]'
          } rounded-lg border border-neutral-200 bg-neutral-100 overflow-hidden flex items-center justify-center p-2`}
        >
          <img
            src={imgSrc}
            alt={title || 'Uploaded image preview'}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className={`max-w-full ${
              compact ? 'max-h-52' : 'max-h-[56vh]'
            } object-contain rounded`}
          />
        </div>
      );
    }
  }

  if (kind === 'pdf') {
    const pdfSrc = blobUrl || externalUrl || '';
    if (pdfSrc) {
      return (
        <div className="space-y-2">
          <div
            className={`w-full ${heightClass} rounded-lg border border-neutral-300 bg-neutral-100 overflow-hidden`}
          >
            <iframe
              src={pdfSrc}
              title={`PDF Preview - ${title}`}
              className="w-full h-full border-0"
            />
          </div>
          {contentPreview && contentPreview.trim().length > 0 && !compact && (
            <details className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs">
              <summary className="cursor-pointer font-semibold text-[#641526]">
                View Attached Notes & Summary Text
              </summary>
              <div className="mt-2 whitespace-pre-line text-neutral-700 leading-relaxed">
                {contentPreview}
              </div>
            </details>
          )}
        </div>
      );
    }
  }

  if (kind === 'gdrive') {
    const embedUrl = normalizeGoogleDrivePreviewUrl(externalUrl || '');
    return (
      <div className="space-y-2">
        <div
          className={`w-full ${heightClass} rounded-lg border border-neutral-300 bg-neutral-100 overflow-hidden`}
        >
          <iframe
            src={embedUrl}
            title={`Google Drive Preview - ${title}`}
            allow="autoplay"
            className="w-full h-full border-0"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-500">
          <span>
            If Google Drive preview asks for permission, make sure the link is shared as "Anyone with the link".
          </span>
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-[#641526] hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Open Link
          </a>
        </div>
      </div>
    );
  }

  if (kind === 'web' && externalUrl) {
    return (
      <div className="space-y-2">
        <div
          className={`w-full ${heightClass} rounded-lg border border-neutral-300 bg-neutral-100 overflow-hidden`}
        >
          <iframe
            src={externalUrl}
            title={`Preview - ${title}`}
            className="w-full h-full border-0"
          />
        </div>
        {contentPreview && contentPreview.trim().length > 0 && !compact && (
          <div className="rounded-lg bg-neutral-50 p-3 border border-neutral-200 text-xs text-neutral-800 whitespace-pre-line">
            {contentPreview}
          </div>
        )}
      </div>
    );
  }

  if (kind === 'data-binary' && externalUrl) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-[#D4AF37]/50 bg-[#fdfbf5] p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-lg bg-[#641526] text-[#D4AF37] flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-neutral-900 truncate">
                {title || 'Uploaded Document File'}
              </div>
              <div className="text-[11px] text-neutral-600 font-mono">
                {fileSize || 'Attached File'} · Saved in Cloud Sync
              </div>
            </div>
          </div>
          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#641526] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#4d0f1d]"
            >
              <Download className="h-3.5 w-3.5 text-[#D4AF37]" />
              Download File
            </button>
          )}
        </div>
        {(contentPreview || summary) && (
          <div className="max-h-60 overflow-y-auto rounded-lg bg-neutral-50 p-4 border border-neutral-200 text-xs text-neutral-800 whitespace-pre-line leading-relaxed">
            {contentPreview || summary}
          </div>
        )}
      </div>
    );
  }

  const displayText = decodedText || contentPreview || summary || '';
  if (displayText.trim().length > 0) {
    return (
      <div
        className={`${
          compact ? 'max-h-40' : 'max-h-80'
        } overflow-y-auto rounded-lg bg-neutral-50 p-4 border border-neutral-200 text-xs text-neutral-800 whitespace-pre-line leading-relaxed font-sans`}
      >
        {displayText}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-xs text-neutral-500 flex flex-col items-center gap-2">
      <AlertTriangle className="h-5 w-5 text-amber-500" />
      <span>
        No preview content attached yet. Upload a PDF, image, text file, or enter text content.
      </span>
    </div>
  );
};

interface DigitalResourcePreviewModalProps {
  resource: DigitalResource | null;
  onClose: () => void;
  onDownload: (resource: DigitalResource) => void;
}

export const DigitalResourcePreviewModal: React.FC<
  DigitalResourcePreviewModalProps
> = ({ resource, onClose, onDownload }) => {
  if (!resource) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-3 sm:p-4">
      <div className="w-full max-w-3xl rounded-xl bg-white text-[#1E1B18] shadow-2xl border border-[#D4AF37]/50 overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between bg-[#420B17] px-5 sm:px-6 py-4 text-white shrink-0">
          <div className="min-w-0 pr-3">
            <div className="flex items-center gap-1.5 text-[11px] text-[#D4AF37] font-semibold">
              <Eye className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                File Preview · {resource.resourceType} · {resource.subject} ·{' '}
                {resource.gradeLevel}
              </span>
            </div>
            <h3 className="font-display text-base font-bold truncate">
              {resource.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/80 hover:text-white hover:bg-white/10 shrink-0"
            aria-label="Close preview"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          <div className="text-xs text-neutral-600 flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-3">
            <span>Author / Source: {resource.author}</span>
            <span className="font-mono tabular-nums">
              {resource.fileSize} · {resource.pageCount} pages
            </span>
          </div>

          {resource.summary && (
            <div className="rounded-lg bg-[#420B17]/5 border border-[#641526]/15 px-3.5 py-2.5 text-xs text-neutral-700">
              <span className="font-semibold text-[#641526]">Summary: </span>
              {resource.summary}
            </div>
          )}

          <InlineFilePreview
            title={resource.title}
            externalUrl={resource.externalUrl}
            fileSize={resource.fileSize}
            contentPreview={resource.contentPreview}
            summary={resource.summary}
            onDownload={() => onDownload(resource)}
          />
        </div>

        <div className="px-5 sm:px-6 py-3.5 border-t border-neutral-200 bg-neutral-50 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <span className="text-xs text-neutral-500">
            Uploaded by {resource.uploadedBy}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Close Preview
            </button>
            <button
              type="button"
              onClick={() => onDownload(resource)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#641526] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4d0f1d]"
            >
              <Download className="h-3.5 w-3.5 text-[#D4AF37]" />
              Download File
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ImageLightboxPreviewModalProps {
  imageUrl: string | null;
  title: string;
  onClose: () => void;
}

export const ImageLightboxPreviewModal: React.FC<
  ImageLightboxPreviewModalProps
> = ({ imageUrl, title, onClose }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [imageUrl]);

  if (!imageUrl) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-white text-[#1E1B18] shadow-2xl border border-[#D4AF37]/60 overflow-hidden">
        <div className="flex items-center justify-between bg-[#420B17] px-5 py-3.5 text-white">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-[#D4AF37]" />
            <h3 className="font-display text-sm sm:text-base font-bold">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-white/80 hover:text-white"
            aria-label="Close image preview"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 bg-neutral-900 flex items-center justify-center min-h-[280px] max-h-[75vh] overflow-hidden">
          {!failed ? (
            <img
              src={imageUrl}
              alt={title}
              referrerPolicy="no-referrer"
              onError={() => setFailed(true)}
              className="max-w-full max-h-[68vh] object-contain rounded-lg shadow-lg"
            />
          ) : (
            <div className="text-center text-white/80 text-xs space-y-2 p-6">
              <AlertTriangle className="h-8 w-8 text-[#D4AF37] mx-auto" />
              <p>
                Unable to load image preview from the specified link. Check that the Google Drive link is shared publicly or upload the file directly.
              </p>
            </div>
          )}
        </div>

        <div className="px-5 py-3 bg-neutral-50 border-t border-neutral-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#641526] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4d0f1d]"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};
