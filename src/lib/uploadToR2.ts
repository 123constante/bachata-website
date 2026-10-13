import { supabase } from '@/integrations/supabase/client';
import { reencodeFlyer, type ReencodeDeps, type ReencodeLimits } from '@/modules/organiser/shared/flyerModel';

/** Proxy-mode caps enforced by `storage-sign-upload` (413 `file_too_large`). */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

const IMAGE_DOWNSCALE_LIMITS: ReencodeLimits = {
  maxEdge: 2400,
  minEdge: 1000,
  targetBytes: 4 * 1024 * 1024,
  limitBytes: MAX_IMAGE_BYTES,
};

/** Plain-English message for a storage-sign-upload failure status. */
export function signUploadMessage(status: number | undefined, reason?: string): string {
  if (status === 401) return 'Your session has expired. Please sign in again, then retry the upload.';
  if (status === 403) return "You don't have permission to upload here. Sign in with the right account and try again.";
  if (status === 413) return 'That file is too large to upload. Photos can be up to 10 MB and videos up to 50 MB.';
  if (status === 422 && reason === 'presign_not_allowed') {
    return 'Uploads need a quick refresh. Please reload the page and try again.';
  }
  if (status === 422) return "That file type can't be uploaded. Please choose a JPG, PNG or WebP photo.";
  return reason || 'Could not prepare upload';
}

export function tooLargeMessage(sizeBytes: number, isVideo: boolean): string {
  const mb = (sizeBytes / (1024 * 1024)).toFixed(1);
  return isVideo
    ? `That video is ${mb} MB. The limit is 50 MB. Please choose a shorter or smaller video.`
    : `That photo is ${mb} MB. The limit is 10 MB. Please choose a smaller photo.`;
}

async function readReason(error: unknown): Promise<string | undefined> {
  try {
    const res = (error as { context?: Response }).context;
    const body = (await res?.clone().json()) as { reason?: string } | undefined;
    return typeof body?.reason === 'string' ? body.reason : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Uploads a file to Cloudflare R2 through the `storage-sign-upload` edge
 * function in PROXY mode: multipart `FormData{bucket, contentType, file}`; the
 * function PUTs to R2 server-side (the browser never touches R2) and returns the
 * `publicUrl` to store. Non-admin callers cannot use JSON presign any more
 * (422 `presign_not_allowed`), and old and new function versions both accept this.
 *
 * Files over the proxy cap (10 MB images, 50 MB videos) are refused here before
 * any network call; an oversized non-GIF image is first downscaled with the
 * repo's existing re-encoder (`reencodeFlyer`).
 *
 * @param file   the file to upload (caller is responsible for type validation)
 * @param bucket logical bucket: "images" | "events" | "venues" | "avatars" | "teachers"
 * @param _path  ignored; kept so existing callers compile. The server chooses
 *               the key (`<bucket>/u/<uid>/YYYY/MM/<uuid>.<ext>`). Never derive a URL from it.
 * @returns the public R2 URL the server returned (the only valid URL to store)
 * @throws on size, auth or upload failure (callers already wrap uploads in try/catch)
 */
export async function uploadToR2(
  file: File | Blob,
  bucket: string,
  _path?: string,
  opts: { deps?: ReencodeDeps } = {},
): Promise<string> {
  let body: File | Blob = file;
  let contentType = (file as File).type || 'application/octet-stream';
  const isVideo = contentType.startsWith('video/');
  const cap = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;

  if (body.size > cap) {
    const canResize = !isVideo && contentType.startsWith('image/') && contentType !== 'image/gif';
    if (!canResize) throw new Error(tooLargeMessage(body.size, isVideo));
    try {
      const encoded = await reencodeFlyer(body, opts.deps, IMAGE_DOWNSCALE_LIMITS);
      body = encoded.blob;
      contentType = encoded.mime;
    } catch {
      throw new Error(tooLargeMessage(file.size, false));
    }
    if (body.size > cap) throw new Error(tooLargeMessage(file.size, false));
  }

  const form = new FormData();
  form.append('bucket', bucket);
  form.append('contentType', contentType);
  form.append('file', body);

  const { data, error } = await supabase.functions.invoke<{
    ok: boolean;
    publicUrl?: string;
    key?: string;
    reason?: string;
  }>('storage-sign-upload', { body: form });

  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 401 || status === 403 || status === 413 || status === 422) {
      throw new Error(signUploadMessage(status, status === 422 ? await readReason(error) : undefined));
    }
    throw error;
  }
  if (!data?.ok || !data.publicUrl) {
    throw new Error(data?.reason || 'Could not prepare upload');
  }
  return data.publicUrl;
}
