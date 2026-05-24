import { supabase } from '@/integrations/supabase/client';

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
 * @param path   object path within the bucket, no leading slash (e.g. "covers/123.jpg")
 * @returns the public R2 URL
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

  if (error) throw error;
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
