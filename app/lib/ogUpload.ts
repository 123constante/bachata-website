// Presign a PUT (storage-sign-upload edge fn) then upload the bytes. This is a
// SERVER caller: it authenticates with the service-role key (the edge function
// treats a bearer equal to its own SUPABASE_SERVICE_ROLE_KEY as a trusted
// caller). Browser callers use proxy mode instead (src/lib/uploadToR2.ts).
const OG_CONTENT_TYPE = "image/jpeg";

export async function uploadJpeg(
  path: string, bytes: Buffer,
  { supabaseUrl, serviceKey, fetchImpl = fetch }: { supabaseUrl: string; serviceKey: string; fetchImpl?: typeof fetch },
): Promise<string | null> {
  // Never fall back to the anon key: it is refused by the function and would hide the misconfiguration.
  if (!serviceKey) {
    console.error(`[og-bake] SUPABASE_SERVICE_ROLE_KEY is not set; cannot sign the upload. path=${path}`);
    return null;
  }
  const sign = await fetchImpl(`${supabaseUrl}/functions/v1/storage-sign-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({ bucket: "events", path, contentType: OG_CONTENT_TYPE }),
  });
  if (!sign.ok) {
    const detail = (await sign.json().catch(() => null)) as { reason?: string } | null;
    console.error(`[og-bake] storage-sign-upload refused: status=${sign.status} reason=${detail?.reason ?? "unknown"} path=${path}`);
    return null;
  }
  const signed = (await sign.json()) as { ok?: boolean; uploadUrl?: string; publicUrl?: string };
  if (!signed?.ok || !signed.uploadUrl || !signed.publicUrl) {
    console.error(`[og-bake] storage-sign-upload returned no uploadUrl/publicUrl. path=${path}`);
    return null;
  }
  // R2 rejects a PUT whose Content-Type differs from the signed one: send exactly what was requested.
  const put = await fetchImpl(signed.uploadUrl, { method: "PUT", headers: { "Content-Type": OG_CONTENT_TYPE }, body: bytes });
  if (!put.ok) console.error(`[og-bake] R2 PUT failed: status=${put.status} path=${path}`);
  return put.ok ? signed.publicUrl : null;
}
