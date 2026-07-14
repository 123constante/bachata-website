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
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { supabase } from "@/integrations/supabase/client";
import { asWallClock, formatWallClockLocalIntl, wallClockDateKey, type WallClock } from "@/lib/time/wallClock";
import { fetchFestivalDetail } from "@/modules/event-page/useFestivalDetailQuery";
import interSemiBoldUrl from "./ogCardFonts/Inter-SemiBold.ttf";
import interRegularUrl from "./ogCardFonts/Inter-Regular.ttf";

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
function truncate(text: string, max: number): string {
  const t = (text ?? "").trim();
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + "…";
}
function wrapTitle(title: string, maxChars: number): string[] {
  const words = title.split(/\s+/);
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
  return lines.slice(0, 3);
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

export interface OgCardData {
  title: string;
  dateLine: string | null;
  venueLine: string | null;
  coverUrl: string | null;
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

/** Accept a uuid straight through, else resolve a slug to its event id. */
export async function resolveOgEventId(param: string): Promise<string | null> {
  if (UUID_RE.test(param)) return param;
  const { data, error } = await supabase.from("events").select("id").eq("slug", param).maybeSingle();
  if (error || !data) return null;
  return typeof data.id === "string" ? data.id : null;
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
  };
}
