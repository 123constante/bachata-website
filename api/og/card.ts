// /api/og/card — live Open Graph preview image for social shares.
//
// SELF-CONTAINED on purpose: Vercel's ESM build does not reliably resolve sibling
// helper modules at runtime (a shared ./_ogRender import 500s with
// ERR_MODULE_NOT_FOUND), so all render + fetch logic lives in this one file. The
// SAME logic is mirrored in api/og/bake.ts — keep the two in sync.
//
// Returns a normalized 1200x630 JPEG so every shared link gets a preview that
// WhatsApp/Facebook/LinkedIn will actually render (they refuse WebP and large
// files). In steady state the middleware serves the pre-baked R2 URL (api/og/bake);
// this endpoint is the always-current fallback for not-yet-baked entities —
// occurrence-aware (`occ`) and cover-versioned (`v`).
//
// Query params: kind=event|festival|image, id, occ, v (cache-buster), src (kind=image)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const config = { maxDuration: 20 };

const SITE_URL = (process.env.SITE_URL ?? 'https://www.bachatacalendar.co.uk').replace(/\/$/, '');
const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';
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

// Fonts: sharp `text` with an explicit fontfile loads via Pango directly — no
// fontconfig (librsvg ignores @font-face; FONTCONFIG_FILE set from JS is too late).
// Single family (Inter) only: libvips' process-global Pango map mis-resolves a
// second family on warm instances; two weights of one family resolve reliably.
const __dir = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = join(__dir, '_fonts'); // shipped via vercel.json includeFiles
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

function makeEtag(kind: string, idParam: string, src: string, occ = '', v = ''): string {
  const h = createHash('sha1').update(`${kind}:${idParam}:${src}:${occ}:${v}`).digest('base64url').slice(0, 24);
  return `"${h}"`;
}
function sendImage(res: VercelResponse, buf: Buffer, etag?: string): void {
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Content-Length', String(buf.length));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800');
  if (etag) res.setHeader('ETag', etag);
  res.status(200).send(buf);
}
function redirectToStatic(res: VercelResponse): void {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.statusCode = 302;
  res.setHeader('Location', `${SITE_URL}/og-image.jpg`);
  res.end();
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.status(405).send('Method Not Allowed'); return; }
  const q = req.query;
  const kind = (Array.isArray(q.kind) ? q.kind[0] : q.kind) ?? 'event';
  const idParam = (Array.isArray(q.id) ? q.id[0] : q.id) ?? '';
  const src = (Array.isArray(q.src) ? q.src[0] : q.src) ?? '';
  const occ = (Array.isArray(q.occ) ? q.occ[0] : q.occ) ?? '';
  const v = (Array.isArray(q.v) ? q.v[0] : q.v) ?? '';

  const etag = makeEtag(kind, idParam, src, occ, v);
  if (req.headers['if-none-match'] === etag) { res.status(304).end(); return; }

  try {
    if (kind === 'image') {
      if (!src) return redirectToStatic(res);
      const bytes = await fetchImageBytes(src);
      if (!bytes) return redirectToStatic(res);
      return sendImage(res, await buildImageCard(bytes), etag);
    }
    if (!idParam) return redirectToStatic(res);
    const id = await resolveEventId(idParam);
    if (!id) return redirectToStatic(res);
    const data = kind === 'festival' ? await fetchFestivalData(id) : await fetchEventData(id, occ || null);
    if (!data) return sendImage(res, await buildFallbackCard(null, null, null), etag);
    // Hybrid: a flyer becomes the preview itself (no text/fonts); the branded card
    // is only the fallback for entities with no flyer.
    const coverBytes = data.coverUrl ? await fetchImageBytes(data.coverUrl) : null;
    if (!coverBytes) return sendImage(res, await buildFallbackCard(data.title, data.dateLine, data.venueLine), etag);
    return sendImage(res, await buildImageCard(coverBytes), etag);
  } catch (err) {
    console.error('[og/card] render_failed', err);
    return redirectToStatic(res);
  }
}
