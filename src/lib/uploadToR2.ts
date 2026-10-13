import { supabase } from '@/integrations/supabase/client';

/** Plain-English message for a storage-sign-upload failure status. */
export function signUploadMessage(status: number | undefined, reason?: string): string {
  if (status === 401) return 'Your session has expired. Please sign in again, then retry the upload.';
  if (status === 403) return "You don't have permission to upload here. Sign in with the right account and try again.";
  if (status === 422) return "That file type can't be uploaded. Please choose a JPG, PNG or WebP photo.";
  return reason || 'Could not prepare upload';
}

/**
 * Uploads a file to Cloudflare R2 via a presigned PUT URL minted by the
 * `storage-sign-upload` edge function.
 *
 * Images live in one R2 bucket keyed `<bucket>/<path>`, mirroring the old
 * Supabase Storage layout. R2 credentials never reach the browser — the function
 * signs the URL server-side, the browser PUTs the file straight to R2, and the
 * returned `publicUrl` (served from the R2 public domain, zero egress fees) is
 * what gets stored in the database.
 *
 * @param file   the file to upload (caller is responsible for validation)
 * @param bucket logical bucket: "images" | "events" | "venues" | "avatars" | "teachers"
 * @param path   a HINT only: non-admin callers get a server-chosen key
 *               (`<bucket>/u/<uid>/YYYY/MM/<uuid>.<ext>`). Never derive a URL from it.
 * @returns the public R2 URL the server returned (the only valid URL to store)
 * @throws on presign or upload failure (callers already wrap uploads in try/catch)
 */
export async function uploadToR2(
  file: File | Blob,
  bucket: string,
  path: string,
): Promise<string> {
  const contentType = (file as File).type || 'application/octet-stream';

  const { data, error } = await supabase.functions.invoke<{
    ok: boolean;
    uploadUrl?: string;
    publicUrl?: string;
    key?: string;
    reason?: string;
  }>('storage-sign-upload', {
    body: { bucket, path, contentType },
  });

  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 401 || status === 403 || status === 422) {
      throw new Error(signUploadMessage(status));
    }
    throw error;
  }
  if (!data?.ok || !data.uploadUrl || !data.publicUrl) {
    throw new Error(data?.reason || 'Could not prepare upload');
  }

  const put = await fetch(data.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });
  if (!put.ok) {
    throw new Error(`Upload failed: ${put.status} ${put.statusText}`);
  }

  return data.publicUrl;
}
