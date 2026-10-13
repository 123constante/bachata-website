// Presign a PUT (storage-sign-upload edge fn) then upload the bytes — the
// path the Website uses for cover uploads (src/lib/uploadToR2.ts).
export async function uploadJpeg(
  path: string, bytes: Buffer,
  { supabaseUrl, anonKey, fetchImpl = fetch }: { supabaseUrl: string; anonKey: string; fetchImpl?: typeof fetch },
): Promise<string | null> {
  const sign = await fetchImpl(`${supabaseUrl}/functions/v1/storage-sign-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    body: JSON.stringify({ bucket: "events", path, contentType: "image/jpeg" }),
  });
  if (!sign.ok) {
    const detail = (await sign.json().catch(() => null)) as { reason?: string } | null;
    console.error(`[og-bake] storage-sign-upload refused: status=${sign.status} reason=${detail?.reason ?? "unknown"} path=${path}`);
    return null;
  }
  const signed = (await sign.json()) as { ok?: boolean; uploadUrl?: string; publicUrl?: string };
  if (!signed?.ok || !signed.uploadUrl || !signed.publicUrl) return null;
  const put = await fetchImpl(signed.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: bytes });
  return put.ok ? signed.publicUrl : null;
}
