// The ONE owner of the whole-flyer link-card choice
// (docs/design/whatsapp-whole-flyer.CONTRACT.md, D1 to D4).
//
// PURE on purpose: no sharp, no fetch, no supabase. The page route
// (app/routes/event.tsx through app/detailLoader.ts), the card route
// (app/routes/api.og.card.tsx) and the bake route (app/routes/api.og.bake.tsx)
// all import from here, and this file must never be able to drag sharp into
// the client bundle.
//
// What lives here:
//   - the mode switch OG_WHOLE_FLYER_MODE (off | test | allowlist | on) and its
//     id list OG_WHOLE_FLYER_EVENT_IDS, parsed ONCE at module load (D3);
//   - ogLayoutFor(kind, entityId): which layout the page EMITS and a bake WRITES;
//   - the canvas rule: 960 wide, height 960 / r with r clamped to [0.8, 1.91] (D1);
//   - the live URL params l=wf1&s=<W>x<H> (D4 b, b2) and their parser;
//   - the baked R2 key <id>-<occ>-<cover16>-wf1-<W>x<H>.jpg and the read-rule
//     classifier for any image_url (D4 c).

export type OgWholeFlyerMode = "off" | "test" | "allowlist" | "on";
export type OgLayout = "legacy" | "wf1";
export type OgEntityKind = "event" | "festival";

/** Current renderer version. ANY change to the D1 sizing or to the whole-flyer
 *  renderer bumps this (wf2), so pixels under existing URLs and keys never
 *  change silently (contract D4, r3 R8). */
export const WF_VERSION = 1;
export const WF_LAYOUT: OgLayout = "wf1";

export const WF_CANVAS_W = 960;
export const WF_MIN_RATIO = 0.8;
export const WF_MAX_RATIO = 1.91;
/** 960 / 0.8 */
export const WF_MAX_H = Math.round(WF_CANVAS_W / WF_MIN_RATIO);
/** 960 / 1.91, rounded: 503 */
export const WF_MIN_H = Math.round(WF_CANVAS_W / WF_MAX_RATIO);

export const LEGACY_CARD_W = 1200;
export const LEGACY_CARD_H = 630;

const MODES: ReadonlySet<string> = new Set(["off", "test", "allowlist", "on"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Exactly four values; anything else (wrong case included: "On") is off. */
export function parseOgWholeFlyerMode(raw: string | null | undefined): OgWholeFlyerMode {
  const v = typeof raw === "string" ? raw.trim() : "";
  return MODES.has(v) ? (v as OgWholeFlyerMode) : "off";
}

/** Split on commas, trim, lower-case, keep only UUIDs (public_event_id). */
export function parseOgWholeFlyerIds(raw: string | null | undefined): ReadonlySet<string> {
  const out = new Set<string>();
  for (const part of String(raw ?? "").split(",")) {
    const id = part.trim().toLowerCase();
    if (UUID_RE.test(id)) out.add(id);
  }
  return out;
}

export interface OgLayoutPolicy {
  /** The mode as it BEHAVES: allowlist with no valid ids is off. */
  mode: OgWholeFlyerMode;
  ids: ReadonlySet<string>;
  layoutFor(kind: OgEntityKind | string, entityId: string | null | undefined): OgLayout;
}

/** Pure constructor so tests can build every mode without touching env. */
export function makeOgLayoutPolicy(rawMode: string | null | undefined, rawIds: string | null | undefined): OgLayoutPolicy {
  const ids = parseOgWholeFlyerIds(rawIds);
  let mode = parseOgWholeFlyerMode(rawMode);
  if (mode === "allowlist" && ids.size === 0) mode = "off";
  return {
    mode,
    ids,
    layoutFor(kind, entityId) {
      // Festivals are OUT of B1 (contract D3, r2 N10): always legacy.
      if (kind !== "event") return "legacy";
      // test mode: legacy for EVERY caller; only event.tsx applies
      // ?ogtest=whole-flyer, and nothing bakes it (r3 R7).
      if (mode === "on") return WF_LAYOUT;
      if (mode === "allowlist") {
        // The id is the series' public_event_id; an occurrence is not looked
        // up separately -- it follows its series (callers pass the series id).
        const id = String(entityId ?? "").trim().toLowerCase();
        return ids.has(id) ? WF_LAYOUT : "legacy";
      }
      return "legacy";
    },
  };
}

/** Parsed ONCE at module load, like OG_BRANDED_CARD_ENABLED: a Vercel env change
 *  plus a redeploy is the switch AND the rollback. Never read per request. */
export const OG_LAYOUT_POLICY: OgLayoutPolicy = makeOgLayoutPolicy(
  typeof process !== "undefined" ? process.env.OG_WHOLE_FLYER_MODE : undefined,
  typeof process !== "undefined" ? process.env.OG_WHOLE_FLYER_EVENT_IDS : undefined,
);

/** THE one owner of the layout choice (contract D3). The page meta, the card URL
 *  the page emits and the bake route all ask this, so they cannot disagree. The
 *  card ROUTE does not ask it: it renders the layout its URL names (D4 b). */
export function ogLayoutFor(kind: OgEntityKind | string, entityId: string | null | undefined): OgLayout {
  return OG_LAYOUT_POLICY.layoutFor(kind, entityId);
}

// ── Canvas rule (D1) ────────────────────────────────────────────────────────

export interface CanvasSize {
  width: number;
  height: number;
}

/** 960 wide; height 960 / r with r = flyerW / flyerH clamped to [0.8, 1.91].
 *  Tall flyers give 4:5 at most, wide ones 1.91:1 at most (960x503); nothing
 *  of the flyer is cropped (it is drawn fit:inside). Null for a size that
 *  cannot be read. */
export function wholeFlyerCanvas(flyerW: number, flyerH: number): CanvasSize | null {
  if (!(flyerW > 0) || !(flyerH > 0) || !Number.isFinite(flyerW) || !Number.isFinite(flyerH)) return null;
  const r = Math.min(WF_MAX_RATIO, Math.max(WF_MIN_RATIO, flyerW / flyerH));
  const height = Math.min(WF_MAX_H, Math.max(WF_MIN_H, Math.round(WF_CANVAS_W / r)));
  return { width: WF_CANVAS_W, height };
}

/** A canvas the whole-flyer renderer may draw: exactly 960 wide, 503 to 1200 high. */
export function isWholeFlyerCanvas(width: number, height: number): boolean {
  return width === WF_CANVAS_W && Number.isInteger(height) && height >= WF_MIN_H && height <= WF_MAX_H;
}

export function formatCanvas(size: CanvasSize): string {
  return `${size.width}x${size.height}`;
}

/** "960x1200" to a size, or null when it is not exactly <digits>x<digits>. */
export function parseCanvas(raw: string | null | undefined): CanvasSize | null {
  const m = /^([0-9]{1,5})x([0-9]{1,5})$/.exec(String(raw ?? ""));
  if (!m) return null;
  return { width: Number(m[1]), height: Number(m[2]) };
}

// ── Live card URL (D4 b, b2) ────────────────────────────────────────────────

/** Append l=wf1&s=<W>x<H> to a live card query. l-less URLs are the legacy
 *  card and stay byte-identical (nothing here touches them). */
export function setWholeFlyerParams(params: URLSearchParams, size: CanvasSize): void {
  params.set("l", WF_LAYOUT);
  params.set("s", formatCanvas(size));
}

export type LiveLayoutRequest =
  | { layout: "legacy" }
  | { layout: "wf1"; size: CanvasSize }
  /** l=wf1 with an s outside the D1 range (or missing/garbled): the route
   *  answers it through the legacy-fallback path, never at a guessed size. */
  | { layout: "wf1-invalid"; raw: string };

/** What the card route renders, read from its URL only (never from the mode).
 *  Only kind=event honours l; any other l value is ignored (legacy), so an
 *  unknown layout can never reach a renderer. */
export function parseLiveLayout(kind: string, q: URLSearchParams): LiveLayoutRequest {
  if (kind !== "event" || q.get("l") !== WF_LAYOUT) return { layout: "legacy" };
  const raw = q.get("s") ?? "";
  const size = parseCanvas(raw);
  if (!size || !isWholeFlyerCanvas(size.width, size.height)) return { layout: "wf1-invalid", raw };
  return { layout: "wf1", size };
}

// ── Baked R2 key (D2, D4 a, D8) ─────────────────────────────────────────────

/** The bake object path. Legacy keeps today's exact shape (facts suffix only
 *  when the branded flag gives one). Whole-flyer carries version and size and
 *  NEVER the facts tag (D8): title, date and venue are not on the card. */
export function bakedOgPath(opts: {
  entityType: OgEntityKind;
  entityId: string;
  occTag: string;
  coverTag: string;
  layout: OgLayout;
  size?: CanvasSize | null;
  factsTag?: string;
}): string {
  const base = `og/${opts.entityType}/${opts.entityId}-${opts.occTag}-${opts.coverTag}`;
  if (opts.layout === WF_LAYOUT) {
    if (!opts.size || !isWholeFlyerCanvas(opts.size.width, opts.size.height)) {
      throw new Error("whole-flyer bake needs a D1 canvas size");
    }
    return `${base}-wf${WF_VERSION}-${formatCanvas(opts.size)}.jpg`;
  }
  return `${base}${opts.factsTag ? `-${opts.factsTag}` : ""}.jpg`;
}

export type BakedKeyShape =
  | { shape: "legacy" }
  | { shape: "wf"; version: number; width: number; height: number }
  | { shape: "unknown" };

const LEGACY_TAIL_RE = /-[0-9a-f]{16}(?:-[0-9a-f]{12})?[.]jpg$/;
const WF_TAIL_RE = /-[0-9a-f]{16}-wf([0-9]+)-([0-9]{3,4})x([0-9]{3,4})[.]jpg$/;

/** The last path segment of a URL, query and fragment removed, any host. */
export function lastPathSegment(url: string): string {
  const noQuery = String(url).split("#")[0].split("?")[0];
  return noQuery.split("/").pop() ?? "";
}

/** Classify a baked image_url by its key tail (contract D4 c). */
export function classifyBakedKey(imageUrl: string): BakedKeyShape {
  const seg = lastPathSegment(imageUrl);
  const wf = WF_TAIL_RE.exec(seg);
  if (wf) return { shape: "wf", version: Number(wf[1]), width: Number(wf[2]), height: Number(wf[3]) };
  if (LEGACY_TAIL_RE.test(seg)) return { shape: "legacy" };
  return { shape: "unknown" };
}

/** The read rule (D4 c): may the page serve this baked URL under this layout,
 *  and at what declared size? Null means "use the live URL". The size comes
 *  from the key alone -- no fetch. */
export function acceptBakedKey(imageUrl: string, layout: OgLayout): CanvasSize | null {
  const k = classifyBakedKey(imageUrl);
  if (layout === "legacy") return k.shape === "legacy" ? { width: LEGACY_CARD_W, height: LEGACY_CARD_H } : null;
  if (k.shape === "wf" && k.version === WF_VERSION && isWholeFlyerCanvas(k.width, k.height)) {
    return { width: k.width, height: k.height };
  }
  return null;
}

/** Is this image_url already on `layout`? Used by the backfill skip filter. */
export function isOnLayout(imageUrl: string | null | undefined, layout: OgLayout): boolean {
  return Boolean(imageUrl) && acceptBakedKey(String(imageUrl), layout) !== null;
}
