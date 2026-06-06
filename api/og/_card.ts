// Branded Open Graph card builder — pure sharp + SVG (librsvg).
//
// Uses sharp throughout (no @vercel/og — its Satori WASM doesn't load in
// Vercel Node.js serverless functions):
//   1. sharp composites the letterboxed cover onto a brand-dark canvas
//   2. An SVG brand panel (fonts embedded as base64 data URIs) is composited
//      over the right-hand side via librsvg (available on Vercel's Lambda env)
//   3. sharp re-encodes the final composite as JPEG q80
//
// Result: 1200x630 JPEG, typically 40-80 KB — well under WhatsApp's ~300KB.
import sharp from 'sharp';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Read the TTF files bundled alongside this function (included via vercel.json
// includeFiles). Use __dirname equivalent for ESM context.
const __dir = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url));
const FONT_FRAUNCES_SEMIBOLD = readFileSync(join(__dir, '_fonts/Fraunces-SemiBold.ttf'));
const FONT_INTER_REGULAR = readFileSync(join(__dir, '_fonts/Inter-Regular.ttf'));
const FONT_INTER_SEMIBOLD = readFileSync(join(__dir, '_fonts/Inter-SemiBold.ttf'));

export const CARD_W = 1200;
export const CARD_H = 630;
const FLYER_W = 720;
const PANEL_W = CARD_W - FLYER_W; // 480
const BRAND_DARK = { r: 20, g: 21, b: 25, alpha: 1 } as const;
const BRAND_DARK_HEX = '#141519';
const DIVIDER_HEX = '#2a2c33';
const ORANGE_HEX = '#f97316';

// ─── Fonts: write to /tmp on first load, reference via file:// ──────────
// librsvg resolves local file:// URIs in @font-face reliably on both Vercel's
// Lambda (Linux, /tmp writable) and local dev. data: URIs in @font-face are
// NOT supported by librsvg (intentionally restricted in all versions).

const TMP_DIR = process.platform === 'win32' ? 'C:/tmp' : '/tmp';
const F_FRAUNCES = `${TMP_DIR}/og-fraunces-semi.ttf`;
const F_INTER_REG = `${TMP_DIR}/og-inter-reg.ttf`;
const F_INTER_SEMI = `${TMP_DIR}/og-inter-semi.ttf`;

function ensureFonts(): void {
  if (!existsSync(F_FRAUNCES)) writeFileSync(F_FRAUNCES, FONT_FRAUNCES_SEMIBOLD);
  if (!existsSync(F_INTER_REG)) writeFileSync(F_INTER_REG, FONT_INTER_REGULAR);
  if (!existsSync(F_INTER_SEMI)) writeFileSync(F_INTER_SEMI, FONT_INTER_SEMIBOLD);
}

const FONT_FRAUNCES_URI = `file://${F_FRAUNCES}`;
const FONT_INTER_REG_URI = `file://${F_INTER_REG}`;
const FONT_INTER_SEMI_URI = `file://${F_INTER_SEMI}`;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function truncate(text: string, max: number): string {
  const t = (text ?? '').trim();
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + '…';
}

// Greedy word-wrap: split title into lines that fit `maxChars` per line.
function wrapTitle(title: string, maxChars: number): string[] {
  const words = title.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = w;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3); // max 3 lines
}

// ─── SVG brand panel (right side, x:720–1200) ─────────────────────────────

function buildPanelSvg(title: string, dateLine: string | null, venueLine: string | null): Buffer {
  const titleText = truncate(title || 'Bachata Calendar', 72);

  // Scale font size to title length, wrap accordingly
  const fontSize = titleText.length > 30 ? 40 : titleText.length > 20 ? 46 : 54;
  const maxCharsPerLine = fontSize >= 54 ? 13 : fontSize >= 46 ? 16 : 19;
  const titleLines = wrapTitle(titleText, maxCharsPerLine);

  // Vertically position the content block in the center of the 630px panel
  const lineH = Math.round(fontSize * 1.1);
  const titleH = titleLines.length * lineH;
  const infoH = (dateLine ? 34 : 0) + (venueLine ? 30 : 0) + (dateLine || venueLine ? 24 : 0); // orange bar + items
  const totalH = 28 + 10 + titleH + 20 + infoH; // wordmark + gap + title + gap + info
  const startY = Math.max(56, Math.round((CARD_H - totalH) / 2));

  let y = startY;
  const pad = 56; // horizontal padding within panel

  const rows: string[] = [];

  // Wordmark
  rows.push(`<text x="${pad}" y="${y}" font-family="InterSemi" font-size="20" fill="#e7e3da" letter-spacing="2">${esc('BACHATA CALENDAR')}</text>`);
  y += 38;

  // Title lines
  for (const line of titleLines) {
    y += lineH;
    rows.push(`<text x="${pad}" y="${y}" font-family="Fraunces" font-size="${fontSize}" fill="#ffffff">${esc(line)}</text>`);
  }
  y += 24;

  // Orange accent bar
  rows.push(`<rect x="${pad}" y="${y}" width="64" height="6" fill="${ORANGE_HEX}" rx="1"/>`);
  y += 28;

  // Date
  if (dateLine) {
    rows.push(`<text x="${pad}" y="${y}" font-family="InterReg" font-size="24" fill="#c9cbd1">${esc(dateLine)}</text>`);
    y += 34;
  }

  // Venue
  if (venueLine) {
    rows.push(`<text x="${pad}" y="${y}" font-family="InterReg" font-size="20" fill="#9398a3">${esc(venueLine)}</text>`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PANEL_W}" height="${CARD_H}">
  <defs>
    <style>
      @font-face { font-family: 'Fraunces'; src: url('${FONT_FRAUNCES_URI}'); font-weight: 600; }
      @font-face { font-family: 'InterReg'; src: url('${FONT_INTER_REG_URI}'); font-weight: 400; }
      @font-face { font-family: 'InterSemi'; src: url('${FONT_INTER_SEMI_URI}'); font-weight: 600; }
    </style>
  </defs>
  <rect width="${PANEL_W}" height="${CARD_H}" fill="${BRAND_DARK_HEX}"/>
  <rect x="0" y="0" width="1" height="${CARD_H}" fill="${DIVIDER_HEX}"/>
  ${rows.join('\n  ')}
</svg>`;

  return Buffer.from(svg, 'utf8');
}

function buildFallbackPanelSvg(title: string, dateLine: string | null, venueLine: string | null): Buffer {
  const titleText = truncate(title || 'Bachata Calendar', 64);
  const fontSize = titleText.length > 30 ? 52 : 64;
  const maxCharsPerLine = fontSize >= 64 ? 15 : 19;
  const titleLines = wrapTitle(titleText, maxCharsPerLine);
  const lineH = Math.round(fontSize * 1.1);

  const titleH = titleLines.length * lineH;
  const infoH = (dateLine ? 38 : 0) + (venueLine ? 32 : 0);
  const totalH = 44 + 18 + 10 + titleH + 22 + infoH;
  let y = Math.max(60, Math.round((CARD_H - totalH) / 2));

  const rows: string[] = [];
  const cx = CARD_W / 2;

  rows.push(`<text x="${cx}" y="${y}" text-anchor="middle" font-family="InterSemi" font-size="26" fill="#e7e3da" letter-spacing="3">${esc('BACHATA CALENDAR')}</text>`);
  y += 36;
  rows.push(`<rect x="${cx - 40}" y="${y}" width="80" height="6" fill="${ORANGE_HEX}" rx="1"/>`);
  y += 28;

  for (const line of titleLines) {
    y += lineH;
    rows.push(`<text x="${cx}" y="${y}" text-anchor="middle" font-family="Fraunces" font-size="${fontSize}" fill="#ffffff">${esc(line)}</text>`);
  }
  y += 26;

  if (dateLine) {
    rows.push(`<text x="${cx}" y="${y}" text-anchor="middle" font-family="InterReg" font-size="28" fill="#c9cbd1">${esc(dateLine)}</text>`);
    y += 38;
  }
  if (venueLine) {
    rows.push(`<text x="${cx}" y="${y}" text-anchor="middle" font-family="InterReg" font-size="22" fill="#9398a3">${esc(venueLine)}</text>`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}">
  <defs>
    <style>
      @font-face { font-family: 'Fraunces'; src: url('${FONT_FRAUNCES_URI}'); font-weight: 600; }
      @font-face { font-family: 'InterReg'; src: url('${FONT_INTER_REG_URI}'); font-weight: 400; }
      @font-face { font-family: 'InterSemi'; src: url('${FONT_INTER_SEMI_URI}'); font-weight: 600; }
    </style>
  </defs>
  <rect width="${CARD_W}" height="${CARD_H}" fill="${BRAND_DARK_HEX}"/>
  ${rows.join('\n  ')}
</svg>`;

  return Buffer.from(svg, 'utf8');
}

// ─── Public builders ──────────────────────────────────────────────────────

// Event card: flyer letterboxed on brand-dark left + SVG brand panel right.
export async function buildEventCard(opts: {
  title: string;
  dateLine?: string | null;
  venueLine?: string | null;
  coverBuf: Buffer;
}): Promise<Buffer> {
  ensureFonts();
  const coverResized = await sharp(opts.coverBuf)
    .resize(FLYER_W, CARD_H, { fit: 'contain', background: BRAND_DARK })
    .png()
    .toBuffer();

  const panelSvg = buildPanelSvg(opts.title, opts.dateLine ?? null, opts.venueLine ?? null);

  return sharp({
    create: { width: CARD_W, height: CARD_H, channels: 4, background: BRAND_DARK },
  })
    .composite([
      { input: coverResized, left: 0, top: 0 },
      { input: panelSvg, left: FLYER_W, top: 0 },
    ])
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
}

// No-cover fallback: full-bleed brand-dark with centered wordmark + text.
export async function buildFallbackCard(opts: {
  title?: string | null;
  dateLine?: string | null;
  venueLine?: string | null;
}): Promise<Buffer> {
  ensureFonts();
  const svg = buildFallbackPanelSvg(
    opts.title ?? 'Bachata Calendar',
    opts.dateLine ?? null,
    opts.venueLine ?? null,
  );

  return sharp({
    create: { width: CARD_W, height: CARD_H, channels: 4, background: BRAND_DARK },
  })
    .composite([{ input: svg }])
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
}

// Plain letterbox normalize for non-event entities (people / cities / venues).
export async function buildImageCard(coverBuf: Buffer): Promise<Buffer> {
  const resized = await sharp(coverBuf)
    .resize(CARD_W, CARD_H, { fit: 'inside', withoutEnlargement: false })
    .png()
    .toBuffer();

  return sharp({
    create: { width: CARD_W, height: CARD_H, channels: 4, background: BRAND_DARK },
  })
    .composite([{ input: resized, gravity: 'centre' }])
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}
