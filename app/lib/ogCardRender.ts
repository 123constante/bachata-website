// Shared OG-card image renderer for /api/og/card and /api/og/bake (see the two
// resource routes at app/routes/api.og.card.tsx and api.og.bake.tsx).
//
// Was previously duplicated between api/og/card.ts and api/og/bake.ts with a
// "keep in sync" comment, because Vercel's old per-function file tracing for
// /api/*.ts didn't reliably resolve sibling imports. That constraint doesn't
// apply to RR7 resource routes (everything bundles into one server build), so
// this is now a single shared module.
//
// Font loading: sharp's Pango text renderer needs a real FILESYSTEM path
// (`fontfile`), not bytes. RR7's server build bundles into one JS file with no
// guaranteed sibling-file layout at runtime, so the two Inter .ttf files are
// imported as Vite assets (resolves to a hashed /assets/*.ttf URL, which Vite
// copies into build/client — the same static-asset pipeline that already
// serves e.g. src/fontsource webfonts). At first use, fetch that URL from the
// site's own deployed origin and write the bytes to /tmp once (Vercel Node
// functions always have a writable /tmp and network access to their own
// origin); the memoized promise means concurrent cold-start requests share one
// write instead of racing.
import sharp from "sharp";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { supabase } from "@/integrations/supabase/client";
import { resolvePublicEventRef } from "@/lib/seo/resolvePublicEventRef";
import { asWallClock, formatWallClockLocalIntl, wallClockDateKey, type WallClock } from "@/lib/time/wallClock";
import { fetchFestivalDetail } from "@/modules/event-page/useFestivalDetailQuery";
import interSemiBoldUrl from "./ogCardFonts/Inter-SemiBold.ttf";
import interRegularUrl from "./ogCardFonts/Inter-Regular.ttf";
import { truncate } from "../truncate";

const SITE_URL = "https://www.bachatacalendar.co.uk";

const CARD_W = 1200;
const CARD_H = 630;
const BRAND_DARK = { r: 20, g: 21, b: 25, alpha: 1 } as const;
const ORANGE = { r: 249, g: 115, b: 22, alpha: 1 } as const;

const fontPathCache = new Map<string, Promise<string>>();

function absoluteAssetUrl(assetUrl: string): string {
  return assetUrl.startsWith("http") ? assetUrl : `${SITE_URL}${assetUrl}`;
}

async function materializeFont(assetUrl: string): Promise<string> {
  const cached = fontPathCache.get(assetUrl);
  if (cached) return cached;

  const promise = (async () => {
    const dest = join(tmpdir(), `og-font-${assetUrl.replace(/[^a-z0-9.]/gi, "_")}`);
    const res = await fetch(absoluteAssetUrl(assetUrl));
    if (!res.ok) throw new Error(`font fetch failed: ${assetUrl} (${res.status})`);
    const bytes = Buffer.from(await res.arrayBuffer());
    await writeFile(dest, bytes);
    return dest;
  })();

  fontPathCache.set(assetUrl, promise);
  return promise;
}

async function fontSemiPath(): Promise<string> {
  return materializeFont(interSemiBoldUrl);
}
async function fontRegPath(): Promise<string> {
  return materializeFont(interRegularUrl);
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
/** Greedy word wrap by CHARACTER COUNT, all lines; the line cap belongs to the
 *  caller, so a wrapper that silently drops the overflow cannot hide it.
 *  buildFallbackCard's wrapTitle is the only caller -- that card has no photo
 *  under it and a fixed 64-char clip, so an estimate is good enough. The
 *  branded card wraps by MEASURED pixel width instead (wrapMeasured): the same
 *  estimate there could not be made to converge. */
function wrapAll(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = w;
    } else current = candidate;
  }
  if (current) lines.push(current);
  return lines;
}

function wrapTitle(title: string, maxChars: number): string[] {
  return wrapAll(title, maxChars).slice(0, 3);
}

async function renderText(
  text: string, fontfile: string, family: string, size: number, color: string, letterSpacing = 0,
): Promise<{ buf: Buffer; w: number; h: number }> {
  const ls = letterSpacing ? ` letter_spacing="${letterSpacing}"` : "";
  const markup = `<span foreground="${color}"${ls}>${esc(text)}</span>`;
  const buf = await sharp({ text: { text: markup, fontfile, font: `${family} ${size}`, rgba: true, dpi: 72 } }).png().toBuffer();
  const meta = await sharp(buf).metadata();
  return { buf, w: meta.width ?? 0, h: meta.height ?? 0 };
}

export async function buildFallbackCard(
  title: string | null, dateLine: string | null, venueLine: string | null,
): Promise<Buffer> {
  const [fontSemi, fontReg] = await Promise.all([fontSemiPath(), fontRegPath()]);
  const titleText = truncate(title || "Bachata Calendar", 64);
  const titleSize = titleText.length > 30 ? 52 : 64;
  const titleLines = wrapTitle(titleText, titleSize >= 64 ? 15 : 19);
  const label = await renderText("BACHATA CALENDAR", fontSemi, "Inter SemiBold", 24, "#e7e3da", 3072);
  const lines: { buf: Buffer; w: number; h: number }[] = [];
  for (const l of titleLines) lines.push(await renderText(l, fontSemi, "Inter SemiBold", titleSize, "#ffffff"));
  const date = dateLine ? await renderText(dateLine, fontReg, "Inter Regular", 28, "#c9cbd1") : null;
  const venue = venueLine ? await renderText(venueLine, fontReg, "Inter Regular", 22, "#9398a3") : null;
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

export async function buildImageCard(coverBuf: Buffer): Promise<Buffer> {
  const resized = await sharp(coverBuf).resize(CARD_W, CARD_H, { fit: "inside", withoutEnlargement: false }).png().toBuffer();
  return sharp({ create: { width: CARD_W, height: CARD_H, channels: 4, background: BRAND_DARK } })
    .composite([{ input: resized, gravity: "centre" }])
    .jpeg({ quality: 82, mozjpeg: true }).toBuffer();
}

// ---------------------------------------------------------------------------
// Branded image card ("Option C") -- the card a share of an event WITH a cover
// photo gets once OG_BRANDED_CARD_ENABLED is on.
//
// Shape: the organiser's own photo, centre-cropped to a 1:1 square on the brand
// canvas, a gradient scrim over its lower portion, and the event's own facts
// drawn on top -- category pill, title, then "<date> - <venue>" in the accent.
//
// Why the outer canvas STAYS 1200x630 while the photo becomes a square. Three
// places hardcode 1200x630 as og:image:width/height independently of the bytes
// (app/seoMeta.ts -- which is what /festival emits -- app/routes/event.tsx, and
// src/lib/seo/useSeo.ts for the default card), and none of them can see the
// actual image. Changing the frame means changing all three and re-checking
// every crawler's layout; changing what sits INSIDE the frame costs nothing.
// A 630x630 square is the largest the frame holds, and it keeps a portrait
// flyer's subject instead of pillarboxing it, which is what buildImageCard does.
//
// The square is full-bleed vertically (SQUARE === CARD_H), so a y coordinate
// inside the square is the same number on the canvas. Several offsets below
// rely on that; the constant states it rather than leaving it to arithmetic.
// ---------------------------------------------------------------------------

/** Ship dark. Both call sites select through buildCoverCard, so flipping this
 *  per environment (preview first) is the rollback -- not a revert. Read once
 *  at module load: Vercel needs a redeploy to change an env var anyway. */
export const OG_BRANDED_CARD_ENABLED = process.env.OG_BRANDED_CARD_ENABLED === "true";

const SQUARE = CARD_H;
const SQUARE_X = Math.round((CARD_W - SQUARE) / 2);
const PAD_X = 34;
const PAD_BOTTOM = 30;
const TEXT_MAX_W = SQUARE - PAD_X * 2;
const SCRIM_MIN_H = Math.round(SQUARE * 0.4);
/** Tried in order; the first whose MEASURED lines fit wins. The last is used
 *  whether it fits or not, so the layout always terminates. */
const TITLE_SIZES = [46, 40, 34];
const META_SIZES = [23, 20];
const TITLE_MAX_LINES = 2;

/** U+00B7, spelled by code point -- see app/truncate.ts on why this repo never
 *  pastes the character itself. */
const MIDDOT = String.fromCharCode(183);

function rgbHex(c: { r: number; g: number; b: number }): string {
  return `#${[c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Pill copy, keyed on the snapshot's `event.type`. That field is built by
 *  _event_view_snapshot_compat_v1 as: format 'festival'/'course' pass through,
 *  otherwise the discovery category when it is party|class|workshop, else
 *  'standard'. Live on 2026-09-15: party 50, course 12, class 7, festival 6.
 *
 *  'party' reads PARTY, and that is a RULE, not a preference:
 *  scripts/check-no-social-word.mjs -- "new dancers don't know what a 'social'
 *  is, but everyone understands 'party'", so the word must never be shown to a
 *  human for an event. A first draft of this map said SOCIAL and the lint chain
 *  went green on it, because that guard scans src/ only and matches title-case
 *  'Social' as a code value -- it is blind to app/ and to "SOCIAL" on both
 *  axes. The green was the guard's reach, not permission. (runNoun's "night" is
 *  a different register again: it writes a sentence about a finished run.)
 *
 *  'standard' is deliberately absent, as is every unknown value: no pill at
 *  all, rather than a raw DB token shouted at a reader. */
const PILL_LABELS: Record<string, string> = {
  party: "PARTY",
  class: "CLASS",
  workshop: "WORKSHOP",
  course: "COURSE",
  festival: "FESTIVAL",
};

export function ogPillLabel(eventType: string | null): string | null {
  if (!eventType) return null;
  return PILL_LABELS[eventType.trim().toLowerCase()] ?? null;
}

/** "<date> - <venue>", with the venue's "at " prefix stripped. venueLine is
 *  shared with buildFallbackCard, where it reads as a sentence fragment; after
 *  a middot the "at" is just noise. Either half may be missing. */
function joinMeta(dateLine: string | null, venueLine: string | null): string | null {
  const venue = venueLine ? venueLine.replace(/^at\s+/i, "").trim() : "";
  const parts = [dateLine?.trim() ?? "", venue].filter(Boolean);
  return parts.length ? parts.join(` ${MIDDOT} `) : null;
}

/** A rendered run of text that still knows what it says. The text is carried
 *  because the wrap below re-flows lines it has already drawn, and recovering
 *  the string from the pixels is not a thing. */
type Drawn = { buf: Buffer; w: number; h: number; text: string };

async function draw(
  text: string, fontfile: string, family: string, size: number, color: string,
): Promise<Drawn> {
  return { ...(await renderText(text, fontfile, family, size, color)), text };
}

/** Greedy wrap by MEASURED width, one render per candidate line.
 *
 *  What this replaces, and why nothing cheaper will do: the first cut wrapped
 *  by a character estimate (`maxW / (size * 0.52)`) and then stepped the point
 *  size down when the result measured too wide. That ladder could not
 *  converge, because `perLine` rescaled with the size -- every rung asked the
 *  same wrong ratio the same question. Review measured a real title against
 *  the repo's own Inter: 659 / 574 / 686px into a 562px box. The LAST rung was
 *  wider than the middle one and was accepted unconditionally, so the overflow
 *  reached sharp.
 *
 *  Measuring removes the failure mode rather than the two instances of it:
 *  every line this returns is known to fit, at every size, by construction. */
async function wrapMeasured(
  text: string, fontfile: string, family: string, size: number, color: string, maxW: number,
): Promise<Drawn[]> {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: Drawn[] = [];
  let current: Drawn | null = null;
  for (const word of words) {
    const candidate = current ? `${current.text} ${word}` : word;
    const merged = await draw(candidate, fontfile, family, size, color);
    if (merged.w <= maxW) { current = merged; continue; }
    if (current) { lines.push(current); current = null; }
    const alone = await draw(word, fontfile, family, size, color);
    if (alone.w <= maxW) { current = alone; continue; }
    // No amount of wrapping narrows a single unbroken token, and sharp's
    // composite THROWS on a layer wider than the canvas rather than clipping
    // it. Break it.
    const pieces = await breakToken(word, fontfile, family, size, color, maxW);
    lines.push(...pieces.slice(0, -1));
    current = pieces[pieces.length - 1] ?? null;
  }
  if (current) lines.push(current);
  return lines;
}

/** Split ONE token too wide to fit into pieces that each measure within maxW.
 *  Binary search per piece (~7 renders for a 90-char token, against ~90 for a
 *  character walk). Always advances: the search floor is one character, so
 *  this terminates even if a single glyph is wider than the box. */
async function breakToken(
  token: string, fontfile: string, family: string, size: number, color: string, maxW: number,
): Promise<Drawn[]> {
  const out: Drawn[] = [];
  let rest = token;
  while (rest) {
    const whole = await draw(rest, fontfile, family, size, color);
    if (whole.w <= maxW) { out.push(whole); break; }
    let lo = 1, hi = rest.length - 1, bestN = 1;
    let best = await draw(rest.slice(0, 1), fontfile, family, size, color);
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const piece = await draw(rest.slice(0, mid), fontfile, family, size, color);
      if (piece.w <= maxW) { best = piece; bestN = mid; lo = mid + 1; } else hi = mid - 1;
    }
    out.push(best);
    rest = rest.slice(bestN);
  }
  return out;
}

/** The longest ellipsised prefix of `text` that MEASURES within maxW, found by
 *  binary search. The old proportional guess (`length * (maxW / w)`) could
 *  still land over the box, which is the same composite throw by another
 *  route. Falls back to the one-character clip, never to the unclipped text. */
async function ellipsiseToWidth(
  text: string, fontfile: string, family: string, size: number, color: string, maxW: number,
): Promise<Drawn> {
  const full = await draw(text, fontfile, family, size, color);
  if (full.w <= maxW) return full;
  let lo = 1, hi = text.length;
  let best = await draw(truncate(text, 1), fontfile, family, size, color);
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const clipped = await draw(truncate(text, mid), fontfile, family, size, color);
    if (clipped.w <= maxW) { best = clipped; lo = mid + 1; } else hi = mid - 1;
  }
  return best;
}

/** Title block: at most TITLE_MAX_LINES lines, every one MEASURED within maxW.
 *  The size ladder now only ever buys back a LINE -- width is guaranteed at
 *  every rung by wrapMeasured -- so it cannot end wider than it started.
 *  Overflow past the line cap is ellipsised, never dropped: a share card that
 *  silently renames an event is worse than one that visibly runs out of room. */
async function layOutTitle(
  title: string, fontfile: string, maxW: number,
): Promise<Drawn[]> {
  const clipped = truncate(title, 90) || "Bachata Event";
  let lines: Drawn[] = [];
  for (let i = 0; i < TITLE_SIZES.length; i++) {
    const size = TITLE_SIZES[i];
    lines = await wrapMeasured(clipped, fontfile, "Inter SemiBold", size, "#ffffff", maxW);
    if (lines.length <= TITLE_MAX_LINES) return lines;
    if (i < TITLE_SIZES.length - 1) continue;
    // Smallest rung and STILL over the line cap. Keep the leading lines and
    // fold everything from the cap onwards into one, ellipsised by
    // measurement -- the width of every line is already guaranteed, so this
    // only ever has to win back height.
    const kept = lines.slice(0, TITLE_MAX_LINES);
    const tail = lines.slice(TITLE_MAX_LINES - 1).map((l) => l.text).join(" ");
    kept[TITLE_MAX_LINES - 1] = await ellipsiseToWidth(tail, fontfile, "Inter SemiBold", size, "#ffffff", maxW);
    return kept;
  }
  return lines;
}

/** One meta line: the largest META_SIZES rung that MEASURES within maxW, else
 *  the smallest rung ellipsised to fit by measurement. The proportional clip
 *  this replaces (`length * (maxW / w)`, floored at 12 characters) could still
 *  return a line over the box, and an overflowing meta line is the same
 *  composite throw an overflowing title is -- just less obvious. */
async function layOutMeta(
  text: string, fontfile: string, maxW: number, color: string,
): Promise<Drawn> {
  let out = await draw(text, fontfile, "Inter Regular", META_SIZES[0], color);
  for (let i = 1; i < META_SIZES.length && out.w > maxW; i++) {
    out = await draw(text, fontfile, "Inter Regular", META_SIZES[i], color);
  }
  if (out.w <= maxW) return out;
  return ellipsiseToWidth(text, fontfile, "Inter Regular", META_SIZES[META_SIZES.length - 1], color, maxW);
}

/** Filled rounded pill, label centred. Rasterised to PNG first rather than
 *  handed to composite as SVG bytes, so the geometry cannot move with
 *  librsvg's default density. */
async function buildPill(
  label: string, fontfile: string, bg: string, fg: string,
): Promise<{ buf: Buffer; w: number; h: number }> {
  const text = await renderText(label, fontfile, "Inter SemiBold", 19, fg, 2048);
  const padX = 15, padY = 8;
  const w = text.w + padX * 2, h = text.h + padY * 2, r = Math.round(h / 2);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<rect x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="${bg}"/></svg>`;
  const plate = await sharp(Buffer.from(svg)).png().toBuffer();
  const buf = await sharp(plate)
    .composite([{ input: text.buf, left: Math.round((w - text.w) / 2), top: padY }])
    .png().toBuffer();
  return { buf, w, h };
}

/** Bottom-up scrim in BRAND_DARK, sized to the SQUARE's footprint only. Full
 *  canvas width would double-darken the two brand-dark pillars either side. */
async function buildScrim(w: number, h: number, hex: string): Promise<Buffer> {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${hex}" stop-opacity="0"/>` +
    `<stop offset="0.38" stop-color="${hex}" stop-opacity="0.55"/>` +
    `<stop offset="1" stop-color="${hex}" stop-opacity="0.94"/>` +
    `</linearGradient></defs>` +
    `<rect width="${w}" height="${h}" fill="url(#s)"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Last line of defence before composite, and the reason it exists rather than
 *  the arithmetic above being trusted: sharp THROWS on a layer that extends
 *  past the canvas instead of clipping it. On /api/og/card that throw is a
 *  render-error redirect; on /api/og/bake it is a 500 that increments
 *  `attempts`, and _og_sweep selects `attempts < 5` while _og_enqueue resets
 *  it only on a cover-hash change -- so five throws retire that entity from
 *  the bake pipeline until someone re-uploads its cover. A layout bug must not
 *  be able to cost that.
 *
 *  It reads each buffer's REAL dimensions rather than the numbers the layout
 *  computed. A check that asks the layout whether the layout was right cannot
 *  catch a wrong layout -- that is the whole defect this is here for. An
 *  overhanging layer is scaled down to fit; one whose origin is already off
 *  the canvas is dropped, because there is no size at which it would show. */
/** Exported for its own test, and that is not incidental. Mutation-tested
 *  2026-09-15: with wrapMeasured intact, deleting this call left the layout
 *  suite 9/9 GREEN -- the clamp never fires on conforming input, because the
 *  layer it exists to catch can no longer be built. A second layer nothing can
 *  exercise is indistinguishable from a second layer that does not work, so it
 *  is driven directly with an oversized layer instead of being taken on
 *  trust. */
export async function clampToCanvas(
  layers: { input: Buffer; left: number; top: number }[],
): Promise<{ input: Buffer; left: number; top: number }[]> {
  const out: { input: Buffer; left: number; top: number }[] = [];
  for (const layer of layers) {
    const left = Math.max(0, Math.round(layer.left));
    const top = Math.max(0, Math.round(layer.top));
    if (left >= CARD_W || top >= CARD_H) continue;
    const meta = await sharp(layer.input).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (w <= 0 || h <= 0) continue;
    const roomW = CARD_W - left;
    const roomH = CARD_H - top;
    if (w <= roomW && h <= roomH) {
      out.push({ input: layer.input, left, top });
      continue;
    }
    const shrunk = await sharp(layer.input)
      .resize({ width: Math.min(w, roomW), height: Math.min(h, roomH), fit: "inside", withoutEnlargement: true })
      .png().toBuffer();
    out.push({ input: shrunk, left, top });
  }
  return out;
}

export async function buildBrandedImageCard(
  coverBuf: Buffer,
  title: string,
  dateLine: string | null,
  venueLine: string | null,
  eventType: string | null,
): Promise<Buffer> {
  const [fontSemi, fontReg] = await Promise.all([fontSemiPath(), fontRegPath()]);
  const accent = rgbHex(ORANGE);
  const dark = rgbHex(BRAND_DARK);

  const square = await sharp(coverBuf)
    .resize(SQUARE, SQUARE, { fit: "cover", position: "centre" })
    .png().toBuffer();

  const titleLines = await layOutTitle(title, fontSemi, TEXT_MAX_W);
  const metaText = joinMeta(dateLine, venueLine);
  const meta = metaText ? await layOutMeta(metaText, fontReg, TEXT_MAX_W, accent) : null;
  const pillLabel = ogPillLabel(eventType);
  const pill = pillLabel ? await buildPill(pillLabel, fontSemi, accent, dark) : null;

  const GAP_LINE = 4, GAP_PILL_TITLE = 14, GAP_TITLE_META = 12;
  const titleH =
    titleLines.reduce((a, l) => a + l.h, 0) + Math.max(0, titleLines.length - 1) * GAP_LINE;
  const contentH =
    (pill ? pill.h + GAP_PILL_TITLE : 0) + titleH + (meta ? GAP_TITLE_META + meta.h : 0);

  // Scrim sized to the CONTENT, floored at 40% of the square so the card reads
  // the same whether the title ran to one line or two, and clamped to the
  // square so no arithmetic here can composite outside the photo.
  const scrimH = Math.min(SQUARE, Math.max(SCRIM_MIN_H, contentH + PAD_BOTTOM + 46));
  const scrim = await buildScrim(SQUARE, scrimH, dark);

  const left = SQUARE_X + PAD_X;
  let y = Math.max(0, SQUARE - PAD_BOTTOM - contentH);
  const layers: { input: Buffer; left: number; top: number }[] = [
    { input: square, left: SQUARE_X, top: 0 },
    { input: scrim, left: SQUARE_X, top: SQUARE - scrimH },
  ];
  if (pill) {
    layers.push({ input: pill.buf, left, top: y });
    y += pill.h + GAP_PILL_TITLE;
  }
  for (let i = 0; i < titleLines.length; i++) {
    layers.push({ input: titleLines[i].buf, left, top: y });
    y += titleLines[i].h + (i < titleLines.length - 1 ? GAP_LINE : 0);
  }
  if (meta) {
    y += GAP_TITLE_META;
    layers.push({ input: meta.buf, left, top: y });
  }

  return sharp({ create: { width: CARD_W, height: CARD_H, channels: 4, background: BRAND_DARK } })
    .composite(await clampToCanvas(layers))
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}

export interface OgCardData {
  title: string;
  dateLine: string | null;
  venueLine: string | null;
  coverUrl: string | null;
  /** Snapshot `event.type` -- party|class|workshop|course|festival|standard, or
   *  null. Drives the branded card's pill only; see ogPillLabel. */
  eventType: string | null;
}

/** The ONE place the branded/raw choice is made, for the one case where both
 *  are possible: an entity that has card data AND a fetched cover. Both call
 *  sites (api.og.card's live render, api.og.bake's persist) go through it, so
 *  they cannot drift -- the same reason the fetchers below live here rather
 *  than inlined per route. kind=image has no card data and stays on
 *  buildImageCard; a missing cover stays on buildFallbackCard. */
export function buildCoverCard(coverBuf: Buffer, data: OgCardData): Promise<Buffer> {
  return OG_BRANDED_CARD_ENABLED
    ? buildBrandedImageCard(coverBuf, data.title, data.dateLine, data.venueLine, data.eventType)
    : buildImageCard(coverBuf);
}

/** The one hash of the FACTS a branded card draws beyond its cover --
 *  title/date/venue/type. `/api/og/card`'s ETag and `/api/og/bake`'s R2 key
 *  both fold this in (see queued_og_branded_card_etag_cache_key_work.md):
 *  without it, a renamed or rescheduled event whose cover URL is unchanged
 *  revalidates 304 against a crawler holding the stale ETag, and re-bakes
 *  onto the SAME R2 key, serving the old title/date for up to a year.
 *
 *  Returns "" whenever OG_BRANDED_CARD_ENABLED is false or there is no card
 *  data -- a deliberate no-op so the flag stays a true dark-ship lever: with
 *  it off, every cache key this feeds is byte-identical to before this
 *  existed. Do not widen it to run unconditionally "for future-proofing";
 *  that would move the flag's dark half live without a review round. */
export function ogFactsTag(data: Pick<OgCardData, "title" | "dateLine" | "venueLine" | "eventType"> | null): string {
  if (!OG_BRANDED_CARD_ENABLED || !data) return "";
  return createHash("sha1")
    .update(`${data.title}\u0000${data.dateLine ?? ""}\u0000${data.venueLine ?? ""}\u0000${data.eventType ?? ""}`)
    .digest("hex")
    .slice(0, 12);
}

export function firstString(val: unknown): string | null {
  if (Array.isArray(val)) {
    const f = val.find((v) => typeof v === "string" && v.trim());
    return typeof f === "string" ? f : null;
  }
  return typeof val === "string" && val.trim() ? val : null;
}

export function formatOgDate(wc: WallClock | null): string | null {
  if (!wc) return null;
  // Read the stored calendar day AS STORED. The pre-brand new Date(stamp) +
  // Europe/London Intl shifted late-night local-as-UTC stamps to the NEXT day
  // all BST season -- OG cards carried the wrong date. Same Intl options, so
  // the output is byte-identical outside that bug case.
  return (
    formatWallClockLocalIntl(wc, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) ??
    wallClockDateKey(wc)
  );
}

export async function fetchImageBytes(url: string): Promise<Buffer | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) return null;
    const ab = await r.arrayBuffer();
    if (ab.byteLength > 12_000_000) return null;
    return Buffer.from(ab);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// ---------------------------------------------------------------------------
// Shared OG data fetchers
//
// These live HERE, not inlined per route, because /api/og/card (live render) and
// /api/og/bake (pre-bake to R2) must produce the SAME card for the same entity.
// They were previously copy-pasted into both routes -- and that duplication is
// exactly how the festival card broke: one copy read camelCase keys off the
// snake_case RPC json, so dateLine/venue/cover silently came back undefined and
// festival cards rendered title-only. One definition = one bug surface.
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Accept a uuid straight through, else resolve a slug to its event id. Identity
 *  now comes from P5 via the SHARED resolvePublicEventRef (src/lib/seo), which
 *  wraps resolve_public_event_ref_v1: reads the canonical event_series_p5.slug,
 *  id = COALESCE(legacy_event_id, series id). Not legacy `events`.
 *
 *  Only the slug branch hits the DB -- the uuid short-circuit is deliberately kept
 *  (an OG card must still render for a uuid URL a crawler already holds, even
 *  though the page itself 301s to the slug), so unlike the page loaders this is
 *  NOT gated on the resolver. 'swallow': a DB blip degrades the card to the
 *  branded fallback, never a 500 on the image endpoint. */
export async function resolveOgEventId(param: string): Promise<string | null> {
  if (UUID_RE.test(param)) return param;
  const ref = await resolvePublicEventRef(param, "swallow");
  return ref?.id ?? null;
}

export async function fetchEventCardData(id: string, occ: string | null): Promise<OgCardData | null> {
  const target: Record<string, string> = { series_id: id };
  if (occ) target.occurrence_id = occ;
  const { data, error } = await supabase.rpc("event_view_p5" as never, {
    p_target: target,
    p_viewer: { role: "anon", shape: "snapshot_compat" },
  } as never);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const snap: any = data;
  if (error || !snap || !snap.event) return null;
  const venue = snap.location_default?.venue;
  // Mini boundary codec: occurrence starts_at / event.date are stored wall
  // clocks on the snapshot RPC -- brand at this read so formatOgDate renders
  // the stored day (never new Date + tz-shift).
  const rawStart = firstString(snap.occurrence_effective?.starts_at) ?? firstString(snap.event.date);
  return {
    title: snap.event.name ?? "Bachata Event",
    dateLine: formatOgDate(rawStart ? asWallClock(rawStart) : null),
    venueLine: venue?.name ? `at ${venue.name}` : null,
    coverUrl: firstString(snap.event.cover_image_url) ?? firstString(venue?.image_url),
    // snake_case snapshot, but this key really is a bare `type` -- built by
    // _event_view_snapshot_compat_v1 from format/category (see PILL_LABELS).
    // The same key the page model reads (buildEventPageModel identity.eventType).
    eventType: firstString(snap.event.type),
  };
}

export async function fetchFestivalCardData(id: string): Promise<OgCardData | null> {
  let fest: Awaited<ReturnType<typeof fetchFestivalDetail>> = null;
  try {
    fest = await fetchFestivalDetail(id);
  } catch (err) {
    // Do NOT swallow silently. A dropped/renamed _v2 RPC or a grant regression
    // would otherwise degrade EVERY festival share card to the title-only
    // fallback, indistinguishable from "festival not found" -- invisible until
    // someone eyeballs a shared link. Server logs surface in Vercel runtime logs.
    console.error("[og] get_public_festival_detail_v2 failed for %s:", id, err);
    return null;
  }
  if (!fest) return null;
  const venue = fest.location.primaryVenue;
  return {
    title: fest.identity.name ?? "Bachata Festival",
    // localStart = event-timezone calendar date (date-only wall clock).
    dateLine: formatOgDate(fest.dates.localStart),
    venueLine: venue?.name ? `at ${venue.name}` : null,
    coverUrl: firstString(fest.identity.posterUrl) ?? firstString(venue?.imageUrl),
    // Constant, not a lookup: this fetcher is reached only from the kind=festival
    // branch of both routes, so the entity IS a festival. get_public_festival_
    // detail_v2 carries no equivalent of the snapshot's event.type.
    eventType: "festival",
  };
}
