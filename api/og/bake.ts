// /api/og/bake — render an event/festival OG card ONCE and store it in R2 as an
// immutable URL, then record it via set_og_image_v1. Invoked by a DB trigger when
// a cover changes (and by the pg_cron retry sweep + the backfill script). The
// middleware then serves the stored R2 URL instead of rendering live.
//
// Auth: Bearer OG_BAKE_SECRET (shared with the DB trigger via Vault). Render is
// shared with api/og/card.ts via ogRender.ts so baked == live-fallback output.
//
// POST body: { entity_type: 'event'|'festival', entity_id: uuid, occurrence_id?: uuid|null }
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'node:crypto';
import {
  buildFallbackCard, buildImageCard, fetchEventData, fetchFestivalData, fetchImageBytes, resolveEventId,
} from './_ogRender';

export const config = { maxDuration: 30 };

const SUPABASE_URL = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY ?? '';
const BAKE_SECRET = process.env.OG_BAKE_SECRET ?? '';

type EntityType = 'event' | 'festival';

// Presign a PUT (via the storage-sign-upload edge fn) then upload the bytes. Same
// path the Website uses for cover uploads (src/lib/uploadToR2.ts).
async function uploadJpeg(path: string, bytes: Buffer): Promise<string | null> {
  const sign = await fetch(`${SUPABASE_URL}/functions/v1/storage-sign-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ bucket: 'events', path, contentType: 'image/jpeg' }),
  });
  if (!sign.ok) return null;
  const data = (await sign.json()) as { ok?: boolean; uploadUrl?: string; publicUrl?: string };
  if (!data?.ok || !data.uploadUrl || !data.publicUrl) return null;
  const put = await fetch(data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: bytes });
  return put.ok ? data.publicUrl : null;
}

async function recordResult(
  entityType: EntityType, entityId: string, occurrenceId: string | null,
  coverSourceUrl: string | null, imageUrl: string | null, status: 'ready' | 'error', error: string | null,
): Promise<void> {
  if (!SUPABASE_SERVICE_KEY) return;
  await fetch(`${SUPABASE_URL}/rest/v1/rpc/set_og_image_v1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
    body: JSON.stringify({
      p_entity_type: entityType, p_entity_id: entityId, p_occurrence_id: occurrenceId,
      p_cover_source_url: coverSourceUrl, p_image_url: imageUrl, p_status: status, p_error: error,
    }),
  }).catch(() => { /* best-effort */ });
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') { res.status(405).json({ ok: false, reason: 'POST required' }); return; }
  if (!BAKE_SECRET || req.headers['authorization'] !== `Bearer ${BAKE_SECRET}`) {
    res.status(401).json({ ok: false, reason: 'unauthorized' }); return;
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {})) as Record<string, unknown>;
  const entityType: EntityType = body.entity_type === 'festival' ? 'festival' : 'event';
  const rawId = typeof body.entity_id === 'string' ? body.entity_id : '';
  const occurrenceId = typeof body.occurrence_id === 'string' && body.occurrence_id ? body.occurrence_id : null;
  if (!rawId) { res.status(400).json({ ok: false, reason: 'entity_id required' }); return; }

  let entityId = rawId;
  try {
    const id = await resolveEventId(rawId);
    if (!id) throw new Error('could not resolve entity id');
    entityId = id;

    const data = entityType === 'festival' ? await fetchFestivalData(id) : await fetchEventData(id, occurrenceId);
    if (!data) throw new Error('no card data');

    const coverBytes = data.coverUrl ? await fetchImageBytes(data.coverUrl) : null;
    const jpeg = coverBytes
      ? await buildImageCard(coverBytes)
      : await buildFallbackCard(data.title, data.dateLine, data.venueLine);

    // Content-addressed, immutable key: a new cover -> a new key -> a new URL.
    const coverTag = data.coverUrl ? createHash('sha1').update(data.coverUrl).digest('hex').slice(0, 16) : 'fallback';
    const occTag = occurrenceId ?? 'default';
    const path = `og/${entityType}/${id}-${occTag}-${coverTag}.jpg`;

    const publicUrl = await uploadJpeg(path, jpeg);
    if (!publicUrl) throw new Error('R2 upload failed');

    await recordResult(entityType, entityId, occurrenceId, data.coverUrl, publicUrl, 'ready', null);
    res.status(200).json({ ok: true, image_url: publicUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await recordResult(entityType, entityId, occurrenceId, null, null, 'error', msg);
    console.error('[og/bake] failed', msg);
    res.status(500).json({ ok: false, reason: msg });
  }
}
