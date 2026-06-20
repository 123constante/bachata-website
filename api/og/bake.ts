// /api/og/bake — render an event/festival OG card ONCE and store it in R2 as an
// immutable URL, then record it via set_og_image_v1. Invoked by a DB trigger when
// a cover changes (+ the pg_cron retry sweep + the backfill script). The middleware
// then serves the stored R2 URL instead of rendering live.
//
// SELF-CONTAINED on purpose (see api/og/card.ts): Vercel's ESM build does not
// reliably resolve sibling helper modules at runtime, so the render + fetch logic
// is inlined here, mirroring card.ts — keep the two in sync.
//
// Auth: Bearer OG_BAKE_SECRET (shared with the DB trigger via Vault).
// POST body: { entity_type: 'event'|'festival', entity_id: uuid, occurrence_id?: uuid|null }
import type { VercelRequest, VercelResponse } from '@vercel/node';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const config = { maxDuration: 30 };

const SUPABASE_URL = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY ?? '';
const BAKE_SECRET = process.env.OG_BAKE_SECRET ?? '';
const SUPABASE_HEADERS = {
  'Content-Type': 'application/json',
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CARD_W = 1200;
const CARD_H = 630;
const BRAND_DARK = { r: 20, g: 21, b: 25, alpha: 1 } as const;
const ORANGE = { r: 249, g: 115, b: 22, alpha: 1 } as const;

const __dir = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = join(__dir, '_fonts');
const FONT_SEMI = join(FONTS_DIR, 'Inter-SemiBold.ttf');
const FONT_REG = join(FONTS_DIR, 'Inter-Regular.ttf');

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function truncate(text: string, max: number): string {
  const t = (text ?? '').trim();
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + '…';
}
function wrapTitle(title: string, maxChars: number): string[] {
  const words = title.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (candidate.length > maxChars && current) { lines.push(current); current = w; }
    else current = candidate;
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}
async function renderText(
  text: string, fontfile: string, family: string, size: number, color: string, letterSpacing = 0,
): Promise<{ buf: Buffer; w: number; h: number }> {
  const ls = letterSpacing ? ` letter_spacing="${letterSpacing}"` : '';
  const markup = `<span foreground="${color}"${ls}>${esc(text)}</span>`;
  const buf = await sharp({ text: { text: markup, fontfile, font: `${family} ${size}`, rgba: true, dpi: 72 } }).png().toBuffer();
  const meta = await sharp(buf).metadata();
  return { buf, w: meta.width ?? 0, h: meta.height ?? 0 };
}
async function buildFallbackCard(title: string | null, dateLine: string | null, venueLine: string | null): Promise<Buffer> {
  const titleText = truncate(title || 'Bachata Calendar', 64);
  const titleSize = titleText.length > 30 ? 52 : 64;
  const titleLines = wrapTitle(titleText, titleSize >= 64 ? 15 : 19);
  const label = await renderText('BACHATA CALENDAR', FONT_SEMI, 'Inter SemiBold', 24, '#e7e3da', 3072);
  const lines: { buf: Buffer; w: number; h: number }[] = [];
  for (const l of titleLines) lines.push(await renderText(l, FONT_SEMI, 'Inter SemiBold', titleSize, '#ffffff'));
  const date = dateLine ? await renderText(dateLine, FONT_REG, 'Inter Regular', 28, '#c9cbd1') : null;
  const venue = venueLine ? await renderText(venueLine, FONT_REG, 'Inter Regular', 22, '#9398a3') : null;
  const DIV_W = 80, DIV_H = 6, GAP_LABEL = 22, GAP_DIV = 26, GAP_LINE = 6, GAP_DATE = 24, GAP_VENUE = 14;
  const titleBlockH = lines.reduce((a, l) => a + l.h, 0) + Math.max(0, lines.length - 1) * GAP_LINE;
  const totalH = label.h + GAP_LABEL + DIV_H + GAP_DIV + titleBlockH + (date ? GAP_DATE + date.h : 0) + (venue ? GAP_VENUE + venue.h : 0);
  const cx = CARD_W / 2;
  let y = Math.max(48, Math.round((CARD_H - totalH) / 2));
  const layers: { input: Buffer; left: number; top: number }[] = [];
  const place = (l: { buf: Buffer; w: number; h: number }) => { layers.push({ input: l.buf, left: Math.round(cx - l.w / 2), top: y }); y += l.h; };
  place(label); y += GAP_LABEL;
  const divider = await sharp({ create: { width: DIV_W, height: DIV_H, channels: 4, background: ORANGE } }).png().toBuffer();
  layers.push({ input: divider, left: Math.round(cx - DIV_W / 2), top: y }); y += DIV_H + GAP_DIV;
  for (let i = 0; i < lines.length; i++) { place(lines[i]); if (i < lines.length - 1) y += GAP_LINE; }
  if (date) { y += GAP_DATE; place(date); }
  if (venue) { y += GAP_VENUE; place(venue); }
  return sharp({ create: { width: CARD_W, height: CARD_H, channels: 4, background: BRAND_DARK } })
    .composite(layers).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
}
async function buildImageCard(coverBuf: Buffer): Promise<Buffer> {
  const resized = await sharp(coverBuf).resize(CARD_W, CARD_H, { fit: 'inside', withoutEnlargement: false }).png().toBuffer();
  return sharp({ create: { width: CARD_W, height: CARD_H, channels: 4, background: BRAND_DARK } })
    .composite([{ input: resized, gravity: 'centre' }])
    .jpeg({ quality: 82, mozjpeg: true }).toBuffer();
}

interface CardData { title: string; dateLine: string | null; venueLine: string | null; coverUrl: string | null; }
function firstString(val: unknown): string | null {
  if (Array.isArray(val)) { const f = val.find((v) => typeof v === 'string' && v.trim()); return typeof f === 'string' ? f : null; }
  return typeof val === 'string' && val.trim() ? val : null;
}
function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  try { return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' }).format(new Date(iso)); }
  catch { return iso.slice(0, 10); }
}
async function supabaseRpc(fn: string, body: unknown): Promise<unknown> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: SUPABASE_HEADERS, body: JSON.stringify(body), signal: ctrl.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; } finally { clearTimeout(t); }
}
async function resolveEventId(param: string): Promise<string | null> {
  if (UUID_RE.test(param)) return param;
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/events?slug=eq.${encodeURIComponent(param)}&select=id`, { headers: SUPABASE_HEADERS, signal: ctrl.signal });
    if (!r.ok) return null;
    const rows = (await r.json()) as Array<{ id?: string }>;
    const id = Array.isArray(rows) && rows[0] ? rows[0].id : null;
    return typeof id === 'string' ? id : null;
  } catch { return null; } finally { clearTimeout(t); }
}
async function fetchEventData(id: string, occ: string | null): Promise<CardData | null> {
  const target: Record<string, string> = { series_id: id };
  if (occ) target.occurrence_id = occ;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const snap: any = await supabaseRpc('event_view_p5', { p_target: target, p_viewer: { role: 'anon', shape: 'snapshot_compat' } });
  if (!snap || !snap.event) return null;
  const venue = snap.location_default?.venue;
  return {
    title: snap.event.name ?? 'Bachata Event',
    dateLine: formatDate(snap.occurrence_effective?.starts_at ?? snap.event.date ?? null),
    venueLine: venue?.name ? `at ${venue.name}` : null,
    coverUrl: firstString(snap.event.cover_image_url) ?? firstString(venue?.image_url),
  };
}
async function fetchFestivalData(id: string): Promise<CardData | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fest: any = await supabaseRpc('get_public_festival_detail', { p_event_id: id });
  if (!fest || !fest.identity) return null;
  const venue = fest.location?.primaryVenue;
  return {
    title: fest.identity.name ?? 'Bachata Festival',
    dateLine: formatDate(fest.dates?.startsAt ?? null),
    venueLine: venue?.name ? `at ${venue.name}` : null,
    coverUrl: firstString(fest.identity.posterUrl) ?? firstString(venue?.imageUrl),
  };
}
async function fetchImageBytes(url: string): Promise<Buffer | null> {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) return null;
    const ab = await r.arrayBuffer();
    if (ab.byteLength > 12_000_000) return null;
    return Buffer.from(ab);
  } catch { return null; } finally { clearTimeout(t); }
}

type EntityType = 'event' | 'festival';

// Presign a PUT (storage-sign-upload edge fn) then upload the bytes — the path the
// Website uses for cover uploads (src/lib/uploadToR2.ts).
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
    const jpeg = coverBytes ? await buildImageCard(coverBytes) : await buildFallbackCard(data.title, data.dateLine, data.venueLine);

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
