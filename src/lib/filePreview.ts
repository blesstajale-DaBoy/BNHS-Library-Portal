export type FilePreviewKind =
  | 'pdf'
  | 'image'
  | 'gdrive'
  | 'web'
  | 'data-text'
  | 'data-binary'
  | 'text'
  | 'empty';

export interface ParsedFileUpload {
  dataUrl: string;
  fileName: string;
  fileSizeLabel: string;
  mimeType: string;
  extractedText: string;
  suggestedResourceType:
    | 'E-Book'
    | 'PDF Learning Material'
    | 'Module'
    | 'Journal'
    | 'Reference';
  suggestedPageCount: number;
}

export function formatBytesCompact(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '1 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function inferExtensionFromFile(file: File): string {
  const nameExt = file.name.split('.').pop()?.toUpperCase() || '';
  if (nameExt && nameExt.length <= 5) return nameExt;
  if (file.type.includes('pdf')) return 'PDF';
  if (file.type.startsWith('image/')) {
    return file.type.replace('image/', '').toUpperCase();
  }
  return 'FILE';
}

export async function readFileAsResourcePayload(
  file: File,
  maxBytes = 12 * 1024 * 1024
): Promise<ParsedFileUpload> {
  if (file.size > maxBytes) {
    throw new Error(
      `File "${file.name}" (${formatBytesCompact(file.size)}) exceeds the ${formatBytesCompact(maxBytes)} Cloud Sync upload limit.`
    );
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Could not read file contents.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read selected file.'));
    reader.readAsDataURL(file);
  });

  const ext = inferExtensionFromFile(file);
  const fileSizeLabel = `${formatBytesCompact(file.size)} ${ext}`;
  const lowerName = file.name.toLowerCase();

  let extractedText = '';
  const isTextReadable =
    file.type.startsWith('text/') ||
    file.type === 'application/json' ||
    /\.(txt|md|csv|json|xml|html|htm|sql|js|ts|css)$/i.test(lowerName);

  if (isTextReadable) {
    try {
      extractedText = (await file.text()).slice(0, 120000);
    } catch {
      extractedText = '';
    }
  }

  let suggestedResourceType: ParsedFileUpload['suggestedResourceType'] =
    'PDF Learning Material';
  if (lowerName.includes('module') || lowerName.includes('slm')) {
    suggestedResourceType = 'Module';
  } else if (lowerName.includes('journal') || lowerName.includes('research')) {
    suggestedResourceType = 'Journal';
  } else if (lowerName.endsWith('.epub') || lowerName.includes('ebook')) {
    suggestedResourceType = 'E-Book';
  } else if (
    file.type.startsWith('image/') ||
    /\.(png|jpg|jpeg|gif|webp|txt|md|csv|doc|docx)$/i.test(lowerName)
  ) {
    suggestedResourceType = 'Reference';
  }

  const suggestedPageCount =
    ext === 'PDF'
      ? Math.max(1, Math.min(250, Math.round(file.size / 45000)))
      : extractedText
      ? Math.max(1, Math.ceil(extractedText.split(/\n/).length / 35))
      : 1;

  return {
    dataUrl,
    fileName: file.name,
    fileSizeLabel,
    mimeType: file.type || 'application/octet-stream',
    extractedText,
    suggestedResourceType,
    suggestedPageCount,
  };
}

export function normalizeGoogleDrivePreviewUrl(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';
  const fileDMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch?.[1]) {
    return `https://drive.google.com/file/d/${fileDMatch[1]}/preview`;
  }
  if (trimmed.includes('drive.google.com')) {
    const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idParamMatch?.[1]) {
      return `https://drive.google.com/file/d/${idParamMatch[1]}/preview`;
    }
  }
  return trimmed;
}

export function normalizeGoogleDriveImageUrl(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';
  const fileDMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch?.[1]) {
    return `https://drive.google.com/thumbnail?id=${fileDMatch[1]}&sz=w1920`;
  }
  if (trimmed.includes('drive.google.com')) {
    const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idParamMatch?.[1]) {
      return `https://drive.google.com/thumbnail?id=${idParamMatch[1]}&sz=w1920`;
    }
  }
  return trimmed;
}

export function detectPreviewKind(
  externalUrl?: string,
  fileSize?: string,
  contentPreview?: string
): FilePreviewKind {
  const url = (externalUrl || '').trim();
  const sizeUpper = (fileSize || '').toUpperCase();

  if (url) {
    if (url.startsWith('data:application/pdf')) return 'pdf';
    if (url.startsWith('data:image/')) return 'image';
    if (url.startsWith('data:text/')) return 'data-text';
    if (url.startsWith('data:')) {
      if (sizeUpper.includes('PDF')) return 'pdf';
      return 'data-binary';
    }
    if (!url.startsWith('#')) {
      const lower = url.toLowerCase().split('?')[0];
      if (lower.endsWith('.pdf')) return 'pdf';
      if (
        /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(lower) ||
        url.includes('drive.google.com/thumbnail')
      ) {
        return 'image';
      }
      if (
        url.includes('drive.google.com') ||
        url.includes('docs.google.com')
      ) {
        return 'gdrive';
      }
      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) {
        return 'web';
      }
    }
  }

  if (contentPreview && contentPreview.trim().length > 0) {
    return 'text';
  }
  return 'empty';
}

export function dataUrlToBlobUrl(dataUrl: string): {
  blobUrl: string | null;
  mimeType: string;
  decodedText: string | null;
} {
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    return { blobUrl: null, mimeType: '', decodedText: null };
  }
  try {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) {
      return { blobUrl: null, mimeType: '', decodedText: null };
    }
    const header = dataUrl.slice(5, commaIdx);
    const body = dataUrl.slice(commaIdx + 1);
    const isBase64 = header.includes(';base64');
    const mimeType = header.split(';')[0] || 'application/octet-stream';

    let bytes: Uint8Array;
    if (isBase64) {
      const binaryString = atob(body);
      const len = binaryString.length;
      bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
    } else {
      const decoded = decodeURIComponent(body);
      bytes = new TextEncoder().encode(decoded);
    }

    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);

    let decodedText: string | null = null;
    if (mimeType.startsWith('text/') || mimeType === 'application/json') {
      try {
        decodedText = new TextDecoder().decode(bytes);
      } catch {
        decodedText = null;
      }
    }

    return { blobUrl, mimeType, decodedText };
  } catch {
    return { blobUrl: null, mimeType: '', decodedText: null };
  }
}

export function inferDownloadFilename(
  title: string,
  externalUrl?: string,
  fileSize?: string
): string {
  const safeBase =
    (title || 'bnhs_digital_resource')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'bnhs_resource';

  if (externalUrl?.startsWith('data:application/pdf')) return `${safeBase}.pdf`;
  if (externalUrl?.startsWith('data:image/png')) return `${safeBase}.png`;
  if (externalUrl?.startsWith('data:image/jpeg')) return `${safeBase}.jpg`;
  if (externalUrl?.startsWith('data:image/gif')) return `${safeBase}.gif`;
  if (externalUrl?.startsWith('data:image/webp')) return `${safeBase}.webp`;
  if (externalUrl?.startsWith('data:text/csv')) return `${safeBase}.csv`;
  if (externalUrl?.startsWith('data:text/html')) return `${safeBase}.html`;

  const sizeTokens = (fileSize || '').trim().split(/\s+/);
  const maybeExt = sizeTokens[sizeTokens.length - 1]?.toLowerCase() || '';
  if (
    externalUrl?.startsWith('data:') &&
    /^[a-z0-9]{2,5}$/.test(maybeExt)
  ) {
    return `${safeBase}.${maybeExt}`;
  }
  return `${safeBase}.txt`;
}
