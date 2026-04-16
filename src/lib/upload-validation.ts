const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

const ALLOWED_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'svg',
]);

export type UploadValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export function validateImageFile(file: File): UploadValidationResult {
  if (!ALLOWED_TYPES.has(file.type)) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return { ok: false, message: `Only image files are allowed (JPEG, PNG, WebP, GIF). Got "${file.type || ext}".` };
    }
  }

  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return { ok: false, message: `File is too large (${sizeMB} MB). Maximum is 5 MB.` };
  }

  return { ok: true };
}
