// /api/og/card — branded Open Graph preview image for social shares.
//
// Sharing event links showed no WhatsApp/Facebook/LinkedIn preview because
// ~60% of event covers are WebP (which those platforms refuse to render)
// and some are >300KB. This endpoint returns a normalized 1200x630 JPEG so
// every shared link gets a branded card.
//
// All card-building logic is in this single file — no private helpers —
// because Vercel's bundler does not reliably trace underscore-prefixed
// helper modules when they are dynamically imported.
//
// Query params:
//   kind   event | festival | image   (default: event)
//   id     event/festival UUID or slug (for kind=event|festival)
//   src    absolute image URL          (for kind=image)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import sharp from 'sharp';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
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

// ─── Card dimensions & brand ──────────────────────────────────────────────

const CARD_W = 1200;
const CARD_H = 630;
const FLYER_W = 720;
const PANEL_W = CARD_W - FLYER_W;
const BRAND_DARK = { r: 20, g: 21, b: 25, alpha: 1 } as const;
const BRAND_DARK_HEX = '#141519';
const DIVIDER_HEX = '#2a2c33';
const ORANGE_HEX = '#f97316';

// ─── Font loading ─────────────────────────────────────────────────────────
// TTF files are bundled via vercel.json includeFiles.
// Write to /tmp so librsvg can load them via file:// URIs.

const __dir = typeof __dirname !== 'undefined'
  ? __dirname
  : dirname(fileURLToPath(import.meta.url));

const TMP = process.platform === 'win32' ? 'C:/tmp' : '/tmp';
const F_FRAUNCES = `${TMP}/og-fraunces-semi.ttf`;
const F_INTER_REG = `${TMP}/og-inter-reg.ttf`;
const F_INTER_SEMI = `${TMP}/og-inter-semi.ttf`;

function ensureFonts(): void {
  if (!existsSync(F_FRAUNCES)) writeFileSync(F_FRAUNCES, readFileSync(join(__dir, '_fonts/Fraunces-SemiBold.ttf')));
  if (!existsSync(F_INTER_REG)) writeFileSync(F_INTER_REG, readFileSync(join(__dir, '_fonts/Inter-Regular.ttf')));
  if (!existsSync(F_INTER_SEMI)) writeFileSync(F_INTER_SEMI, readFileSync(join(__dir, '_fonts/Inter-SemiBold.ttf')));
}

// ─── SVG helpers ──────────────────────────────────────────────────────────

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

function fontFaceBlock(): string {
  return `@font-face { font-family: 'Fraunces'; src: url('file://${F_FRAUNCES}'); font-weight: 600; }
      @font-face { font-family: 'InterReg'; src: url('file://${F_INTER_REG}'); font-weight: 400; }
      @font-face { font-family: 'InterSemi'; src: url('file://${F_INTER_SEMI}'); font-weight: 600; }`;
}

function brandPanelSvg(title: string, dateLine: string | null, venueLine: string | null): Buffer {
  const titleText = truncate(title || 'Bachata Calendar', 72);
  const fontSize = titleText.length > 30 ? 40 : titleText.length > 20 ? 46 : 54;
  const maxChars = fontSize >= 54 ? 13 : fontSize >= 46 ? 16 : 19;
  const titleLines = wrapTitle(titleText, maxChars);
  const lineH = Math.round(fontSize * 1.1);
  const infoH = (dateLine ? 34 : 0) + (venueLine ? 30 : 0) + (dateLine || venueLine ? 24 : 0);
  const totalH = 28 + 10 + titleLines.length * lineH + 20 + infoH;
  let y = Math.max(56, Math.round((CARD_H - totalH) / 2));
  const pad = 56;
  const rows: string[] = [];
  rows.push(`<text x="${pad}" y="${y}" font-family="InterSemi" font-size="20" fill="#e7e3da" letter-spacing="2">${esc('BACHATA CALENDAR')}</text>`);
  y += 38;
  for (const line of titleLines) {
    y += lineH;
    rows.push(`<text x="${pad}" y="${y}" font-family="Fraunces" font-size="${fontSize}" fill="#ffffff">${esc(line)}</text>`);
  }
  y += 24;
  rows.push(`<rect x="${pad}" y="${y}" width="64" height="6" fill="${ORANGE_HEX}" rx="1"/>`);
  y += 28;
  if (dateLine) { rows.push(`<text x="${pad}" y="${y}" font-family="InterReg" font-size="24" fill="#c9cbd1">${esc(dateLine)}</text>`); y += 34; }
  if (venueLine) rows.push(`<text x="${pad}" y="${y}" font-family="InterReg" font-size="20" fill="#9398a3">${esc(venueLine)}</text>`);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${PANEL_W}" height="${CARD_H}">
  <defs><style>${fontFaceBlock()}</style></defs>
  <rect width="${PANEL_W}" height="${CARD_H}" fill="${BRAND_DARK_HEX}"/>
  <rect x="0" y="0" width="1" height="${CARD_H}" fill="${DIVIDER_HEX}"/>
  ${rows.join('\n  ')}
</svg>`, 'utf8');
}

function fallbackSvg(title: string, dateLine: string | null, venueLine: string | null): Buffer {
  const titleText = truncate(title || 'Bachata Calendar', 64);
  const fontSize = titleText.length > 30 ? 52 : 64;
  const titleLines = wrapTitle(titleText, fontSize >= 64 ? 15 : 19);
  const lineH = Math.round(fontSize * 1.1);
  let y = Math.max(60, Math.round((CARD_H - (44 + 18 + 10 + titleLines.length * lineH + 22 + (dateLine ? 38 : 0) + (venueLine ? 32 : 0))) / 2));
  const cx = CARD_W / 2;
  const rows: string[] = [];
  rows.push(`<text x="${cx}" y="${y}" text-anchor="middle" font-family="InterSemi" font-size="26" fill="#e7e3da" letter-spacing="3">${esc('BACHATA CALENDAR')}</text>`);
  y += 36;
  rows.push(`<rect x="${cx - 40}" y="${y}" width="80" height="6" fill="${ORANGE_HEX}" rx="1"/>`);
  y += 28;
  for (const line of titleLines) { y += lineH; rows.push(`<text x="${cx}" y="${y}" text-anchor="middle" font-family="Fraunces" font-size="${fontSize}" fill="#ffffff">${esc(line)}</text>`); }
  y += 26;
  if (dateLine) { rows.push(`<text x="${cx}" y="${y}" text-anchor="middle" font-family="InterReg" font-size="28" fill="#c9cbd1">${esc(dateLine)}</text>`); y += 38; }
  if (venueLine) rows.push(`<text x="${cx}" y="${y}" text-anchor="middle" font-family="InterReg" font-size="22" fill="#9398a3">${esc(venueLine)}</text>`);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}">
  <defs><style>${fontFaceBlock()}</style></defs>
  <rect width="${CARD_W}" height="${CARD_H}" fill="${BRAND_DARK_HEX}"/>
  ${rows.join('\n  ')}
</svg>`, 'utf8');
}

// ─── Card builders ────────────────────────────────────────────────────────

async function buildEventCard(title: string, dateLine: string | null, venueLine: string | null, coverBuf: Buffer): Promise<Buffer> {
  ensureFonts();
  const cover = await sharp(coverBuf).resize(FLYER_W, CARD_H, { fit: 'contain', background: BRAND_DARK }).png().toBuffer();
  const panel = brandPanelSvg(title, dateLine, venueLine);
  return sharp({ create: { width: CARD_W, height: CARD_H, channels: 4, background: BRAND_DARK } })
    .composite([{ input: cover, left: 0, top: 0 }, { input: panel, left: FLYER_W, top: 0 }])
    .jpeg({ quality: 80, mozjpeg: true }).toBuffer();
}

async function buildFallbackCard(title: string | null, dateLine: string | null, venueLine: string | null): Promise<Buffer> {
  ensureFonts();
  return sharp({ create: { width: CARD_W, height: CARD_H, channels: 4, background: BRAND_DARK } })
    .composite([{ input: fallbackSvg(title ?? 'Bachata Calendar', dateLine, venueLine) }])
    .jpeg({ quality: 80, mozjpeg: true }).toBuffer();
}

async function buildImageCard(coverBuf: Buffer): Promise<Buffer> {
  const resized = await sharp(coverBuf).resize(CARD_W, CARD_H, { fit: 'inside', withoutEnlargement: false }).png().toBuffer();
  return sharp({ create: { width: CARD_W, height: CARD_H, channels: 4, background: BRAND_DARK } })
    .composite([{ input: resized, gravity: 'centre' }])
    .jpeg({ quality: 82, mozjpeg: true }).toBuffer();
}

// ─── Data fetchers ────────────────────────────────────────────────────────

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

interface CardData { title: string; dateLine: string | null; venueLine: string | null; coverUrl: string | null; }

async function fetchEventData(id: string): Promise<CardData | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const snap: any = await supabaseRpc('event_view_p5', { p_target: { series_id: id }, p_viewer: { role: 'anon', shape: 'snapshot_compat' } });
  if (!snap || !snap.event) return null;
  const venue = snap.location_default?.venue;
  return { title: snap.event.name ?? 'Bachata Event', dateLine: formatDate(snap.occurrence_effective?.starts_at ?? snap.event.date ?? null), venueLine: venue?.name ? `at ${venue.name}` : null, coverUrl: firstString(snap.event.cover_image_url) ?? firstString(venue?.image_url) };
}

async function fetchFestivalData(id: string): Promise<CardData | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fest: any = await supabaseRpc('get_public_festival_detail', { p_event_id: id });
  if (!fest || !fest.identity) return null;
  const venue = fest.location?.primaryVenue;
  return { title: fest.identity.name ?? 'Bachata Festival', dateLine: formatDate(fest.dates?.startsAt ?? null), venueLine: venue?.name ? `at ${venue.name}` : null, coverUrl: firstString(fest.identity.posterUrl) ?? firstString(venue?.imageUrl) };
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

// ─── Handler ──────────────────────────────────────────────────────────────

function sendImage(res: VercelResponse, buf: Buffer): void {
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Content-Length', String(buf.length));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800');
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

  try {
    if (kind === 'image') {
      if (!src) return redirectToStatic(res);
      const bytes = await fetchImageBytes(src);
      if (!bytes) return redirectToStatic(res);
      return sendImage(res, await buildImageCard(bytes));
    }
    if (!idParam) return redirectToStatic(res);
    const id = await resolveEventId(idParam);
    if (!id) return redirectToStatic(res);
    const data = kind === 'festival' ? await fetchFestivalData(id) : await fetchEventData(id);
    if (!data) return sendImage(res, await buildFallbackCard(null, null, null));
    const coverBytes = data.coverUrl ? await fetchImageBytes(data.coverUrl) : null;
    if (!coverBytes) return sendImage(res, await buildFallbackCard(data.title, data.dateLine, data.venueLine));
    return sendImage(res, await buildEventCard(data.title, data.dateLine, data.venueLine, coverBytes));
  } catch (err) {
    console.error('[og/card] render_failed', err);
    return redirectToStatic(res);
  }
}
