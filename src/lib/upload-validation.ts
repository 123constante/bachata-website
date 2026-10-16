const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

const ALLOWED_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'avif',
]);

export type UploadValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export const SVG_REJECTED_MESSAGE =
  'SVG images can\'t be uploaded. Please choose a JPG, PNG or WebP photo instead.';

export function validateImageFile(file: File): UploadValidationResult {
  const fileExt = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (file.type === 'image/svg+xml' || fileExt === 'svg') {
    return { ok: false, message: SVG_REJECTED_MESSAGE };
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return { ok: false, message: `Only image files are allowed (JPG, PNG, WebP, GIF). Got "${file.type || ext}".` };
    }
  }

  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return { ok: false, message: `File is too large (${sizeMB} MB). Maximum is 5 MB.` };
  }

  return { ok: true };
}

export const UPLOAD_NETWORK_MESSAGE =
  'Photo upload failed. Check your connection and try again. If it keeps failing, you can add your photo later.';

const NETWORK_FAILURE = /failed to fetch|networkerror|network request failed|^load failed|failed to send a request/i;

/** Network-level failures (offline, TypeError from fetch) get a friendly line; real server messages pass through. */
export function uploadErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const name = (error as { name?: string } | null)?.name ?? '';
  if (offline || error instanceof TypeError || name === 'FunctionsFetchError' || NETWORK_FAILURE.test(message)) {
    return UPLOAD_NETWORK_MESSAGE;
  }
  return message || 'Upload failed. Please try again.';
}
