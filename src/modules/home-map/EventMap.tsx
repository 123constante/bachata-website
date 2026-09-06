import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
// Side-effect import: the adapter augments the `L` namespace with
// `L.maplibreGL`, so it must come AFTER leaflet above. It pulls maplibre-gl
// itself (a real ESM import, not a global), which is why maplibre-gl is a
// direct dependency and gets its own manual chunk in vite.chunks.ts.
import '@maplibre/maplibre-gl-leaflet';
import { setWorkerUrl } from 'maplibre-gl';
// STATIC, and the cost of that is accepted rather than unnoticed: these two
// imports make vendor-maplibre a static edge of this chunk, so the whole
// renderer is fetched at map mount even on the branch that draws the raster
// pair and never touches MapLibre. Measured from a production build, gzipped:
//
//   vendor-maplibre.js       250,570
//   maplibre-gl-worker.js    134,699
//   vendor-maplibre.css       10,585
//   ----------------------------------
//   fetched and never executed 395,854
//
// THE PARAGRAPH THIS REPLACES SAID THAT WASTE WAS REAL "in exactly ONE state
// -- a build with no VITE_ARCGIS_API_KEY", where "the deploy is already
// misconfigured and wants fixing, not optimising around", and closed "revisit
// if the raster path ever becomes a state we ship on purpose." THAT TRIGGER
// HAS FIRED. `hasWebgl2()` in the branch below makes the raster pair a
// deliberately shipped state for a whole device class -- iOS < 15, older
// Android WebViews, GPU-blocklisted Chrome -- so those bytes now land on the
// WEAKEST devices we serve, on a site that is ~95% mobile, and no
// misconfiguration is involved. The old sentence is struck rather than
// softened: it read as a standing argument against ever revisiting this, and
// it was the first thing a reader would have used to dismiss the question.
//
// It is still static here, deliberately, because moving it is a measured perf
// change and not a fold-in: a dynamic import puts an await on the mount path
// that markers, markercluster and the pin CSS all sit behind, and it moves a
// manual chunk boundary that `vite.chunks.ts` and the first-load request
// ratchet are both tuned against. `queued-home-map-renderer-weight.md` holds
// the numbers for that decision.
//
// This download happens on every homepage load regardless -- not because of
// the module-scope prefetch this comment used to blame (that is deleted, and
// it only ever moved the fetch earlier), but because HomeMapShell mounts
// HomeMapCard from an unconditional effect on the default tab. "Whether or not
// the visitor ever looks at the map" was the wrong axis: nobody has to look.
// `?worker&url` and NOT a plain `?url`, for two separate reasons.
//
// WHY IT IS NEEDED AT ALL. MapLibre resolves its own worker with
// `new URL(`./${name}`, import.meta.url)` where `name` is computed at runtime
// -- maplibre-gl.mjs, function `wi()`. Vite only rewrites the LITERAL
// `new URL('./file', import.meta.url)` form, so it emits no asset for the
// computed one, and the built chunk asks for a sibling that was never
// written. Measured on both sides: a 404 for maplibre-gl-worker.mjs in dev,
// and `find build -iname '*worker*'` empty after a production build. The map
// draws nothing, fetches no tile, and reports no error -- the placeholder
// still simply never gets covered.
//
// WHY NOT `?url`. The worker is not self-contained: it imports
// maplibre-gl-shared.mjs. `?url` would emit that one file verbatim and its
// import would 404 in turn. `?worker&url` makes Vite BUNDLE the worker with
// its dependencies and hand back the hashed asset URL.
//
// The URL is same-origin, which also decides the CSP shape: MapLibre only
// falls back to its blob-module shim when the worker URL is CROSS-origin
// (`Oi()` -> `Ci()` is an origin comparison). A same-origin URL goes straight
// to `new Worker(url, {type:'module'})`.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
// MapLibre positions its canvas from these rules; without them the ground
// layer does not sit where Leaflet expects it.
import 'maplibre-gl/dist/maplibre-gl.css';

// Module scope, so it is set before any Map is constructed below.
setWorkerUrl(maplibreWorkerUrl);
import './homeMap.css';
import { cn } from '@/lib/utils';
import { optimizedImageUrl } from '@/lib/imageCdn';
import { MapDisposer } from '@/lib/leaflet-safety';
import type { MapEvent } from './mapTypes';
import {
  categoryColor,
  eventScene,
  monogram,
  deriveCategory,
  CATEGORY_COLORS,
  CATEGORY_LABEL,
  formatTimeRange,
} from './mapTypes';
import { groupPinsByLocation, type LocationGroup } from './mapListDerivations';
import { TILE_URL, TILE_REF_URL, TILE_MAX_NATIVE_ZOOM, ATTR } from './basemapTiles';
import {
  VECTOR_ATTR,
  hasWebgl2,
  vectorStyleUrl,
  vectorTransformRequest,
} from './vectorBasemap';

/** Imperative handle the parent (useMapList) drives the map through. */
export interface MapApi {
  flyTo(occId: string): void;
  zoom(delta: number): void;
  invalidate(): void;
  /** Where the given pin sits vertically in the map viewport, so the mobile
   *  preview card can dock to the opposite edge (avoid covering the tapped pin).
   *  null when the pin isn't on the map. */
  pinHalf(occId: string): 'top' | 'bottom' | null;
  /** Pan/zoom to the user's location dot (granted control + first-fix auto-pan). */
  panToUser(coords: { lat: number; lng: number } | null): void;
  /** Fit/zoom the view to all currently visible event pins. */
  reset(): void;
}

interface EventMapProps {
  /** Deduped pins (one per event+venue) -- pass useMapList.pins. */
  events: MapEvent[];
  /** occurrence_ids currently shown on the map. */
  visible: string[];
  /** occurrence_ids that should pulse (newly added). */
  glow: string[];
  selected: string | null;
  hovered: string | null;
  /** null clears the selection (mobile background-map tap). */
  onSelect: (occId: string | null) => void;
  onHover: (occId: string | null) => void;
  /** Called with the map's API on mount, and with NULL on teardown -- callers hold
   *  this in a ref, and a resize across the mobile/desktop breakpoint remounts this
   *  component, so a ref left pointing at the removed map would invalidate() a corpse. */
  onReady?: (api: MapApi | null) => void;
  onOpenEvent?: (href: string) => void;
  /** Mobile: a tap on a multi-event location pin surfaces its events in an inline
   *  preview card instead of a Leaflet popup. Carries the currently-visible
   *  member occurrence_ids. */
  onClusterSelect?: (occIds: string[]) => void;
  center?: [number, number];
  zoom?: number;
  /** 'popup': a Leaflet popup bound per marker on pin tap. 'none': no popup --
   *  the parent renders an inline preview card; a background tap clears it.
   *  'venue' (/city/:slug/map): pins SELECT and nothing else. No popup of any
   *  kind -- the page renders the tapped venue's detail in its own list, in
   *  ordinary React DOM.
   *
   *  A Leaflet popup WAS the surface here, and it was reverted at review. Its
   *  body had to be an innerHTML string injected into Leaflet's DOM, and that
   *  one fact generated a whole family of defects that ordinary React cannot
   *  have: a popup lifecycle nothing owned (panels stacking, panels outliving
   *  the pin they point at, panels opened by a finished zoom for a selection
   *  already let go of), hand-rolled escaping, hand-rolled touch handling that
   *  fought the list's own scrolling, a specificity fight with the shipped
   *  popup CSS, and an iOS pointer-events workaround that no local browser can
   *  verify. Selecting is the half worth keeping; rendering belongs to the page. */
  popupMode?: 'popup' | 'none' | 'venue';
  /** VENUE MODE. The tapped location's representative occurrence_id, or null
   *  when the selection was cleared (a tap on bare map, or a pin that a filter
   *  removed). The page holds this as its selection and pushes a history entry
   *  for it, so BACK clears the selection before leaving the page. */
  onVenueSelect?: (repOccId: string | null) => void;
  /** Smaller pins + clusters for the mobile inset map card. */
  compact?: boolean;
  /** Constrain panning (mobile: keep the city in view). */
  maxBounds?: L.LatLngBoundsExpression;
  /** Floor zoom (mobile keeps the city legible). */
  minZoom?: number;
  /** The user's location ("you are here" dot); null hides/removes it. */
  userCoords?: { lat: number; lng: number } | null;
  /** TEASER MODE (the homepage card). The map stays a real, live, DRAGGABLE map
   *  -- the pan feel is the half worth keeping -- and everything that lets
   *  someone half-use it in a 148px card goes: no zoom of any kind, no keyboard
   *  pan, no pin focus, no popups, no cluster zoom. Any tap anywhere, pin or
   *  empty ground, calls `onTeaserTap`.
   *
   *  Turning interaction off is a LIST, not a flag: miss one entry and a
   *  gesture survives that the design says is gone. The full list lives in the
   *  constructor below, spelled out by name for exactly that reason. */
  teaser?: boolean;
  /** Teaser mode only: any tap on the map. Leaflet suppresses `click` after a
   *  drag, so this is genuinely tap-not-drag with no threshold of our own. */
  onTeaserTap?: () => void;
}

const LONDON: [number, number] = [51.5085, -0.128];
const PIN_SVG =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>';
const ARROW_SVG =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

/** Escape user-supplied strings flowing into Leaflet innerHTML (XSS guard). */
function esc(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Live read so a session-long map honours an OS reduced-motion toggle made
 *  after init (CSS media queries update live; this is the JS-animation path). */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Live-wins representative among a (visible) member subset: a non-cancelled
 *  event beats a cancelled one, then the soonest date. Mirrors pickLiveRep in
 *  mapListDerivations so the pin face stays a real, live event after filtering. */
function repOf(list: MapEvent[]): MapEvent {
  return list.reduce((best, e) => {
    if (best.is_cancelled !== e.is_cancelled) return best.is_cancelled ? e : best;
    return (e.instance_date ?? '9999-99-99') < (best.instance_date ?? '9999-99-99') ? e : best;
  });
}

/** The poster body of a pin (cover image or monogram on a scene gradient). */
function posterCore(e: MapEvent): string {
  const color = categoryColor(e);
  const scene = eventScene(e); // always compute -- used up-front (no cover) or on img error
  const mono = esc(monogram(e.name));
  if (e.cover_image_url) {
    // A 404/expired cover would otherwise render as a broken-image icon (Chrome
    // ORB-blocks the failed response). The delegated `error` listener on the map
    // container (see the init effect) reads data-scene, hides the img, promotes
    // the .cv container to the scene gradient, and reveals the pre-baked monogram
    // -- the exact no-cover fallback DOM. (Can't use inline onerror: the site CSP
    // blocks inline handlers.) The scene class can't be present up-front: its
    // ::before (z-index 1) sits ABOVE .cv-fill (z-index 0) and would mask a good
    // flyer. The monogram is pre-baked with inline display:none because
    // .rpin-mono{display:grid} outranks the [hidden] UA rule.
    return `<div class="rpin" style="--pc:${color}"><span class="pcv cv">` +
      `<img class="cv-fill" src="${esc(optimizedImageUrl(e.cover_image_url, 320))}" loading="lazy" alt="" data-scene="${scene}" />` +
      `<span class="rpin-mono" style="display:none">${mono}</span>` +
      `<span class="grain"></span></span></div>`;
  }
  return `<div class="rpin" style="--pc:${color}"><span class="pcv cv ${scene}">` +
    `<span class="rpin-mono">${mono}</span><span class="grain"></span></span></div>`;
}

/** A single-event location pin: poster + event-name label (revealed at zoom). */
function singlePinHtml(e: MapEvent): string {
  const color = categoryColor(e);
  const label = `<span class="plabel"><i class="pdot" style="background:${color}"></i><span class="ptxt">${esc(
    e.name,
  )}</span></span>`;
  return `${posterCore(e)}${label}`;
}

/** A multi-event location pin (Approach B): the rep poster on a stacked-card
 *  silhouette + a neutral count chip + a "Venue . N events" label. */
function stackPinHtml(rep: MapEvent, venueName: string | null, count: number): string {
  const color = categoryColor(rep);
  const labelInner = venueName
    ? `<span class="ptxt">${esc(venueName)}</span><span class="pcount">&middot; ${count} events</span>`
    : `<span class="ptxt">${count} events here</span>`;
  const label = `<span class="plabel"><i class="pdot" style="background:${color}"></i>${labelInner}</span>`;
  const chip = `<span class="rpin-count" aria-hidden="true">${count}</span>`;
  return `<div class="rpin-stack">${posterCore(rep)}</div>${chip}${label}`;
}

/** Build the divIcon for a location, single or stacked, sized for the surface. */
function locationIcon(
  rep: MapEvent,
  venueName: string | null,
  count: number,
  size: [number, number],
  anchor: [number, number],
  popAnchor: [number, number],
): L.DivIcon {
  const isStack = count >= 2;
  return L.divIcon({
    html: isStack ? stackPinHtml(rep, venueName, count) : singlePinHtml(rep),
    className: isStack ? 'rpinwrap rpinloc' : 'rpinwrap',
    iconSize: size,
    iconAnchor: anchor,
    popupAnchor: popAnchor,
  });
}

/** The TEASER's pin: a category-coloured dot, and nothing else.
 *
 *  The full pin is a 36x40 cover-image bubble, sized when this card could be
 *  236px tall. At a flat 148px those bubbles are roughly a third of the card
 *  and the map reads as a pile of thumbnails rather than as a picture of where
 *  things are -- and a teaser pin is decoration, not a control, so a poster and
 *  a label are detail nobody can act on.
 *
 *  Size carries ONE bit: how many DISTINCT EVENTS run at this venue.
 *
 *  THRESHOLDS MEASURED, NOT INHERITED. The prototype scaled dots at 5 and 12,
 *  but it scaled by OCCURRENCES -- min 1, median 13, max 41 across London, a
 *  range those thresholds split sensibly. What reaches this function is
 *  `members.length` from groupPinsByLocation, which counts DISTINCT EVENTS,
 *  and that does not spread: measured 2026-09-05 over 29 London venues it is
 *  min 1, median 1, max 4, with 19 venues on exactly 1. The prototype's
 *  thresholds put ALL 29 in the smallest bucket -- a scale that renders one
 *  value, which is worse than no scale because it looks like it is saying
 *  something.
 *
 *  Occurrence counts are not reachable here: EventMap is given `pins`, already
 *  deduped one per event+venue, so the number the prototype used does not
 *  survive to this point. Re-splitting on the range that does exist keeps the
 *  approved look and drops the false precision.
 *
 *  Deliberately three fixed sizes, not a ramp: three sizes read as three
 *  categories, where a continuous scale over a 1-4 range reads as noise.
 *  If the data ever spreads, re-measure before touching these numbers. */
function teaserDotIcon(count: number, color: string): L.DivIcon {
  const s = count >= 4 ? 14 : count >= 2 ? 11 : 9;
  return L.divIcon({
    className: 'rdot',
    html: `<span class="rdot-i" style="width:${s}px;height:${s}px;background:${color}"></span>`,
    iconSize: [s, s],
    iconAnchor: [s / 2, s / 2],
  });
}

function popupHtml(e: MapEvent): string {
  const cat = deriveCategory(e);
  const color = CATEGORY_COLORS[cat];
  const scene = eventScene(e);
  const cover = e.cover_image_url
    ? `<img class="cv-fill" src="${esc(optimizedImageUrl(e.cover_image_url, 640))}" loading="lazy" alt="" data-scene="${scene}" />`
    : '';
  // Container carries the scene gradient up-front only when there's no cover; on
  // an img error the delegated map-container listener adds it (see posterCore).
  const sceneClass = e.cover_image_url ? '' : scene;
  const time = formatTimeRange(e);
  const line = `<div class="rpop-line"><span class="rpop-dot" style="background:${color}"></span><b style="color:${color}">${esc(
    CATEGORY_LABEL[cat],
  )}</b>${time ? ` <span>${esc(time)}</span>` : ''}</div>`;
  const venue = e.venue_name
    ? `<div class="rpop-venue">${PIN_SVG} ${esc(e.venue_name)}${e.area ? `, ${esc(e.area)}` : ''}</div>`
    : '';
  const cancelled = e.is_cancelled
    ? `<div class="rpop-cancel">Cancelled${
        e.cancellation_reason_label ? ` &middot; ${esc(e.cancellation_reason_label)}` : ''
      }</div>`
    : '';
  const href = `/event/${esc(e.event_id)}?occurrenceId=${esc(e.occurrence_id)}`;
  return (
    `<div class="rpop"><div class="rpop-cv cv ${sceneClass}">${cover}<span class="grain"></span></div>` +
    `<div class="rpop-body">${cancelled}<div class="rpop-t">${esc(e.name)}</div>` +
    `<div class="rpop-lines">${line}</div>${venue}` +
    `<a class="rpop-cta" href="${href}">View event ${ARROW_SVG}</a></div></div>`
  );
}

/** Desktop stack popup: the full list of events at one location. Each row is an
 *  <a> the popupopen handler routes through onOpenEvent for SPA navigation. The
 *  venue subline only shows when every event agrees on the venue (so the rare
 *  mixed-venue-at-one-coord case stays a neutral "N events here"). */
function stackPopupHtml(events: MapEvent[]): string {
  const venues = new Set(events.map((e) => e.venue_name).filter(Boolean) as string[]);
  const venue = venues.size === 1 ? [...venues][0] : null;
  const area = venue ? events.find((e) => e.venue_name === venue)?.area : null;
  const sub = venue
    ? `<span class="rstack-sub">${PIN_SVG} ${esc(venue)}${area ? `, ${esc(area)}` : ''}</span>`
    : '';
  const head = `<div class="rstack-head"><b>${events.length} events here</b>${sub}</div>`;
  const rows = events
    .map((e) => {
      const cat = deriveCategory(e);
      const color = CATEGORY_COLORS[cat];
      const scene = eventScene(e);
      const cover = e.cover_image_url
        ? `<img class="cv-fill" src="${esc(optimizedImageUrl(e.cover_image_url, 320))}" loading="lazy" alt="" data-scene="${scene}" />`
        : '';
      const sceneClass = e.cover_image_url ? '' : scene;
      const time = formatTimeRange(e);
      const meta = time ? `${esc(CATEGORY_LABEL[cat])} &middot; ${esc(time)}` : esc(CATEGORY_LABEL[cat]);
      const inner = e.is_cancelled ? `<span class="rstack-x">Cancelled</span>` : meta;
      const href = `/event/${esc(e.event_id)}?occurrenceId=${esc(e.occurrence_id)}`;
      return (
        `<a class="rstack-row" href="${href}">` +
        `<span class="rstack-cv cv ${sceneClass}">${cover}<span class="grain"></span></span>` +
        `<span class="rstack-meta"><b class="rstack-name">${esc(e.name)}</b>` +
        `<span class="rstack-line"><span class="rpop-dot" style="background:${color}"></span>${inner}</span></span>` +
        `${ARROW_SVG}</a>`
      );
    })
    .join('');
  return `<div class="rstack">${head}<div class="rstack-list">${rows}</div></div>`;
}

/**
 * Lazy-loaded Leaflet map. Initialised once; markers / visibility / glow /
 * selection are reconciled on prop changes WITHOUT tearing the map down.
 *
 * Colocated events collapse to ONE marker per physical venue-coordinate
 * (groupPinsByLocation): a multi-event location shows a stacked-card pin with a
 * count chip + venue label and lists its events on tap; a single-event location
 * is a normal pin. The count reflects only the events visible under the active
 * filter (computed against `visible`). Must be rendered inside a
 * position:relative, height-bearing parent (Leaflet needs a definite size).
 */
export default function EventMap({
  events,
  visible,
  glow,
  selected,
  hovered,
  onSelect,
  onHover,
  onReady,
  onOpenEvent,
  onClusterSelect,
  center = LONDON,
  zoom = 12.5,
  popupMode = 'popup',
  compact = false,
  maxBounds,
  minZoom = 9,
  userCoords,
  teaser = false,
  onTeaserTap,
  onVenueSelect,
}: EventMapProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  // markercluster's types are awkward; `any` keeps the call sites readable.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clusterRef = useRef<any>(null);
  // markers keyed by the group's representative occurrence_id.
  const markers = useRef<Map<string, L.Marker>>(new Map());
  // every member occurrence_id -> its location marker (for flyTo/pinHalf).
  const occMarkerRef = useRef<Map<string, L.Marker>>(new Map());
  const userMarkerRef = useRef<L.Marker | null>(null);
  // The markers currently added to the cluster group (drives fit-to-pins).
  const shownRef = useRef<L.Marker[]>([]);
  const didInitialFit = useRef(false);
  // VENUE MODE: the repOccId whose panel is currently open, so a close event
  // can tell "the user dismissed this" from "a newer panel replaced it".
  const openRepRef = useRef<string | null>(null);
  // `selected` as of the latest render, for async callbacks that must compare
  // against the CURRENT selection rather than the one they were queued with.
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  // Bumped when a clustered marker has been revealed. The highlight effects run
  // off `selected`, which does NOT change across a reveal, so without this the
  // ring is applied to an _icon that did not exist yet and never re-applied.
  const [revealTick, setRevealTick] = useState(0);
  // Stash the map's fit-to-visible-pins fn so the visibility effect (which runs
  // outside the init closure) can trigger the one-time initial framing.
  const fitRef = useRef<((animate: boolean) => void) | null>(null);
  const cb = useRef({
    onSelect,
    onHover,
    onOpenEvent,
    onClusterSelect,
    onTeaserTap,
    onVenueSelect,
  });
  cb.current.onSelect = onSelect;
  cb.current.onHover = onHover;
  cb.current.onOpenEvent = onOpenEvent;
  cb.current.onClusterSelect = onClusterSelect;
  cb.current.onTeaserTap = onTeaserTap;
  cb.current.onVenueSelect = onVenueSelect;

  // Fingerprint occurrence_id AND updated_at so a CONTENT-only change (cover
  // swap, cancellation, time edit) on an event already on the map re-triggers the
  // marker/popup rebuild effects below. Keying on occurrence_id alone froze the
  // Leaflet popup HTML against field changes -- a stale/deleted cover URL then
  // rendered as a broken image (ORB-blocked 404), and a cancelled/rescheduled
  // event kept showing its old state -- even though React Query already had the
  // fresh row. updated_at is the audit-log curation instant (bumps on any edit).
  const eventsKey = useMemo(
    () => events.map((e) => `${e.occurrence_id}:${e.updated_at ?? ''}`).join(','),
    [events],
  );
  const visKey = useMemo(() => visible.join(','), [visible]);
  const glowKey = useMemo(() => glow.join(','), [glow]);

  // THE LIVE CREDIT, and why it is state rather than a constant. Which string
  // is correct depends on which ground actually mounted: the vector branch
  // below credits VECTOR_ATTR, the raster pair credits ATTR, and they are
  // DIFFERENT strings for different providers -- not drift. The branch runs
  // inside the init effect, so the only honest way for the teaser's own credit
  // control to name the right one is to be told by that branch.
  // ATTR is the seed because the raster pair is the path every WebGL2-less
  // device takes and the one production is on today; a wrong-but-present
  // credit for one frame is still a credit, where an empty seed would render
  // an empty panel.
  const [liveCredit, setLiveCredit] = useState<string>(ATTR);
  const [creditOpen, setCreditOpen] = useState(false);

  // ---- init once -----------------------------------------------------------
  useEffect(() => {
    if (!elRef.current) return;
    const m = L.map(elRef.current, {
      zoomControl: false,
      // TEASER: Leaflet's own credit control is OFF, and this component renders
      // the credit itself instead -- see the control at the end of this file.
      // The two are deliberately welded together in ONE component so "teaser
      // mode" and "a credit exists" cannot come apart: there is no prop a
      // caller can set that turns the credit off, and no way to render this
      // map in teaser mode without the control being in the tree.
      attributionControl: !teaser,
      minZoom,
      maxZoom: 18,
      zoomSnap: 0.5,
      fadeAnimation: false,
      // TEASER: pan only. Every gesture is named individually and set false,
      // because "turning interaction off" is a list -- a flag that only killed
      // scrollWheelZoom would leave pinch, double-tap and the keyboard alive,
      // and each of those is a way to half-use a card that is not a tool.
      // `dragging` stays TRUE on purpose: the pan feel is the whole point.
      // `tap: false` disables Leaflet's own synthetic-tap shim so a touch tap
      // arrives as one ordinary `click`, which is what onTeaserTap listens for.
      ...(teaser
        ? {
            dragging: true,
            scrollWheelZoom: false,
            touchZoom: false,
            doubleClickZoom: false,
            boxZoom: false,
            keyboard: false,
            tap: false,
          }
        : {}),
      ...(maxBounds ? { maxBounds, maxBoundsViscosity: 0.8 } : {}),
    }).setView(center, zoom);
    mapRef.current = m;
    // All deferred Leaflet calls route through this so they no-op (and their
    // timeouts are cancelled) once the map is torn down on unmount.
    const disposer = new MapDisposer(mapRef);

    // Cover-image error fallback (CSP-safe). The pins/popups are Leaflet
    // innerHTML strings, so we can't use an inline onerror attribute -- the site's
    // strict CSP (script-src nonce, no 'unsafe-inline') blocks inline event
    // handlers. Instead delegate one real listener on the map container in the
    // CAPTURE phase (the `error` event does NOT bubble). A 404/expired cover
    // (which Chrome ORB-blocks -> a broken-image icon) is hidden and its `.cv`
    // container promoted to the scene gradient (+ monogram for pins) -- the exact
    // no-cover fallback DOM. The scene token rides on the img's data-scene attr.
    const onCoverError = (ev: Event) => {
      const img = ev.target as HTMLElement | null;
      if (!(img instanceof HTMLImageElement) || !img.classList.contains('cv-fill')) return;
      img.style.display = 'none';
      const cv = img.closest('.cv');
      const scene = img.dataset.scene;
      if (cv && scene) cv.classList.add(scene);
      const mono = cv?.querySelector<HTMLElement>('.rpin-mono');
      if (mono) mono.style.display = '';
    };
    elRef.current.addEventListener('error', onCoverError, true);

    // TWO layers, because Esri's Dark Gray Canvas is a PAIR: the Base service is
    // opaque terrain with NO place names, and the labels live in a separate
    // transparent Reference service. CARTO's dark_all baked both into one raster,
    // so a straight URL swap silently ships a map with no street or place names
    // at any zoom.
    //
    // THE "MOUNT IS A CONTINUATION" NOTE THAT USED TO SIT HERE IS NOW FALSE ON
    // THE BRANCH THAT ACTUALLY RUNS, and is corrected rather than left to be
    // inherited on faith. It said the pre-mount stills were re-rendered from
    // "this same Esri pair: same provider, same default view". That is still
    // true of the RASTER pair below -- and the raster pair is now the fallback,
    // not the default. The stills under /map-placeholder are Esri RASTER Dark
    // Gray; the ground that mounts is Esri VECTOR open/dark-gray, different
    // cartography off Overture/OSM data at a different tone. So the visible
    // jump at mount that #321 removed is BACK on the vector path, and
    // mapPlaceholders.ts states the rule this breaks in its own words:
    // re-render, do not hand-edit, whenever the tile provider changes.
    // Re-rendering them is PR 2 of this arc, deliberately not smuggled in here
    // -- but nobody should read this block as saying it is already done.
    // NO `className` on either layer, and no CSS filter on the tiles: the pair
    // renders at Esri's native tone, which is the tone its labels were drawn
    // for. A `hm-basetiles` hook existed here to darken the base alone; both it
    // and the rule are gone. Do not reintroduce a class that no selector uses --
    // it reads as an active styling hook and sends the next reader looking for
    // a rule that is not there.
    // No `maxZoom` here: L.map above sets it explicitly, so Leaflet never
    // derives _layersMaxZoom and a layer-level value is inert. It was carried
    // from the CARTO layer, where it was equally inert, and read as if the map
    // went to 19.
    // BASEMAP. Vector through MapLibre when a key is configured; the legacy
    // raster pair when it is not. That fallback is not defensive padding --
    // VITE_ARCGIS_API_KEY is a BUILD-time var, so a deploy that forgets it
    // would otherwise serve a map that draws nothing at HTTP 200, with no
    // failed request and no error. See vectorBasemap.ts for the byte
    // measurements behind the swap and for the token-scope probe.
    // TWO gates, and they answer different questions. `vectorStyleUrl()` is a
    // BUILD-time fact: a key string was present when this bundle was made.
    // `hasWebgl2()` is a RUNTIME fact about the device in front of us, and
    // without it a WebGL2-less browser gets a permanently blank ground at HTTP
    // 200 -- see that function's header for the mechanism, and for the three
    // gaps it still does NOT cover.
    const vectorStyle = vectorStyleUrl();
    if (vectorStyle && hasWebgl2()) {
      // ONE Leaflet layer, which is the whole point of the adapter: markers,
      // markercluster, popups, the pin CSS and every interaction below stay
      // untouched, and MapLibre only draws the ground. The adapter forces
      // `attributionControl: false` on the MapLibre map it constructs, so
      // there is no second credit painted inside the canvas.
      //
      // customAttribution rather than letting the adapter read the style's
      // own `source.attribution` (which it does by default): that field is
      // byte-identical to VECTOR_ATTR except it carries a raw copyright sign
      // and NO link, and the OpenStreetMap credit wants one. The two must
      // stay in step -- re-read the service field, never hand-shorten it.
      //
      // No maxNativeZoom analogue is needed or wanted here. The raster pair
      // below caps at native z16 and Leaflet upscales above it; this source's
      // TileJSON reports maxzoom 22 against the map's own maxZoom of 18, so
      // the whole range is native and that upscale regression is gone.
      // transformRequest is LOAD-BEARING, not a nicety: the style's own
      // `sources[].url` carries no token, and that URL answers "Token
      // Required." at HTTP 200 -- so without this MapLibre reads an error body
      // as its TileJSON and never requests a tile. See TOKEN SCOPE in
      // vectorBasemap.ts; this shipped missing and blanked the live map.
      L.maplibreGL({
        style: vectorStyle,
        transformRequest: vectorTransformRequest(),
        attributionControl: { customAttribution: VECTOR_ATTR },
      }).addTo(m);
      // Tell the teaser's credit control which ground actually mounted. Set on
      // BOTH branches, from inside the branch, so the two can never disagree:
      // a credit chosen anywhere else would be a second decision about which
      // provider is on screen, and the two would drift the first time this
      // condition changed.
      setLiveCredit(VECTOR_ATTR);

      // THE GAP THAT REMAINS, now that the WebGL2 half is closed by the branch
      // condition above. This layer is now only ever constructed on a device
      // that can actually draw it. What nothing here gates is the STYLE
      // endpoint:
      //
      //   - The style endpoint is referrer-locked, so it 401s on EVERY Vercel
      //     preview deployment, on any new domain, and after a key regen. It
      //     401ed in PRODUCTION too, for hours on 2026-09-02: the allowlist
      //     held the apex only, every host 308s to www, so the one host a
      //     real visitor ever loads was the single entry that was missing.
      //     www is now listed. Do NOT restore the sentence this replaces --
      //     "production is on the allowlist" argued the reviewer out of
      //     exactly the defect that shipped. The allowlist is per-HOST.
      //
      // That one is ASYNCHRONOUS, and a listener attached here AFTER `.addTo()`
      // would genuinely see it -- unlike the WebGL2 failure, which is
      // dispatched to zero listeners inside the constructor and is why the
      // gate above is a synchronous pre-flight instead. So the reason the 401
      // is still unhandled is not that it cannot be handled. It is that
      // nothing in this repo can GATE the handler: reaching a style request at
      // all needs a live painter, jsdom has no GPU, and the mount test that
      // gates the WebGL2 half is therefore blind to this half. Covering it
      // means a mocked adapter or a fetch pre-flight, and both were left out
      // of this change deliberately rather than shipped unproven -- the first
      // draft of this fallback was REVERTED at review round 2 for exactly
      // that, a mutant disabling the whole handler having kept every one of
      // the repo's then-1368 tests green.
      //
      // Its acceptance criteria -- including "a transient 5xx must not latch
      // the session to raster" and "the two credits must not co-exist after a
      // swap" -- are in `queued-home-map-runtime-fallback-REVERTED.md`. Do not
      // add a swap here without one that reds against its own mutant.
    } else {
      L.tileLayer(TILE_URL, {
        attribution: ATTR,
        maxNativeZoom: TILE_MAX_NATIVE_ZOOM,
      }).addTo(m);
      L.tileLayer(TILE_REF_URL, {
        maxNativeZoom: TILE_MAX_NATIVE_ZOOM,
      }).addTo(m);
      setLiveCredit(ATTR);
    }
    // Leaflet's own "Leaflet" credit is optional (`prefix: String|false` is the
    // documented way to drop it) and Esri's is not.
    //
    // THE MEASUREMENT BELOW IS ABOUT `ATTR`, WHICH IS NOW THE FALLBACK STRING.
    // Scoped explicitly, because it was taken before the vector swap and the
    // default path no longer renders the string it describes. ATTR is 76
    // visible chars and renders 342px wide at the shipped 9px/weight-500
    // style. MEASURED IN A BROWSER against the real `.hm-mapcard`, not
    // calculated:
    //   360px viewport -> card 324px -> TWO lines, 29px, 13.5% of the card
    //   390px viewport -> card 354px -> ONE line, 17px
    // So it wraps at <=375px and fits from 390px up. Dropping Leaflet's prefix
    // buys 35px and is what keeps 390px on one line.
    //
    // VECTOR_ATTR IS NOT MEASURED. Esri's terms make it a longer credit -- 101
    // visible chars against ATTR's 76 -- so the 390px result above cannot be
    // assumed to carry over, and it is the one most users see. It is NOT
    // restated here as a proportional estimate on purpose: the note this
    // replaces did exactly that ("two lines on every common phone"), and the
    // browser disagreed with the arithmetic. Put it in a browser before
    // quoting a number. Neither string may be hand-shortened either way --
    // both are provider-required.
    //
    // A COLLAPSIBLE "(i)" CHIP WAS BUILT FOR THIS AND REVERTED at review round 2,
    // which found FIVE defects in ~40 lines of it: preventDefault() on the
    // container's keydown made the OSM copyright link unreachable by keyboard;
    // `role="button"` on a container that HOLDS a link is invalid nested
    // interactive content AND its aria-label became the accessible name, hiding
    // the very credit the control exists to present; the 18x18 target is under
    // WCAG 2.2 SC 2.5.8's 24x24; there was no Escape or outside-click dismiss;
    // and the disableClickPropagation() call was a no-op Leaflet already makes
    // in Control.Attribution.onAdd, so its comment asserted a dependency that
    // does not exist. The ARIA defect is not patchable in place -- the correct
    // shape is a separate toggle BUTTON as a sibling of the credit text, not a
    // role on its container -- so this is queued as its own piece of work with
    // those five as acceptance criteria, not carried as a sixth draft here.
    // Two wrapped lines is the honest cost of the credit until then.
    //
    // GUARDED because teaser mode constructs the map with
    // `attributionControl: false`, which leaves `m.attributionControl`
    // UNDEFINED -- this line then threw inside the mount effect, the whole
    // EventMap subtree hit its error boundary, and the homepage rendered with
    // no map at all. Caught by running it, not by the typechecker: Leaflet's
    // types declare `attributionControl` as always present.
    m.attributionControl?.setPrefix(false);

    // NO client-side tile alarm here, deliberately. A `tileerror` watcher was
    // drafted and cut at review: it is blind to the only basemap failure this
    // project has actually had (CARTO's HTTP 200 with "API KEY REQUIRED" painted
    // into the raster -- and Esri's own 200 OK "Map data not yet available"
    // placeholder is the same class), while firing on every offline or
    // proxy-blocked mount, on a site that is ~95% mobile. It would have buried
    // a real outage under connectivity noise and reported nothing for the case
    // it was written for.
    // The two failure classes are covered where they can actually be seen:
    //   - CSP / host drift  -> tests/homeMapTileCsp.test.ts, at build time,
    //                          before it can reach prod at all.
    //   - watermark / "not yet available" -> QUEUED as a prod-smoke check on
    //                          tile BYTE LENGTH, which is an exact detector:
    //                          2521 B (Base) and 875 B (Reference) are the
    //                          placeholder, measured 2026-09-01.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cl = (L as any).markerClusterGroup({
      // TEASER: effectively NO clustering. The prototypes this card was judged
      // from drew every venue as its own dot -- 29 of them -- and clustering
      // them into 11 counted bubbles is a different picture, not a smaller one.
      // A dot is 9-14px, so 29 of them are legible where 29 cover-bubbles were
      // not; clustering existed to make the BIG pins survivable, and it is not
      // needed once they are dots. 0 rather than removing the group entirely so
      // every add/remove/visibility path below stays on one code path.
      maxClusterRadius: teaser ? 0 : compact ? 24 : 28,
      // UNCHANGED at 17. A draft lowered it to 16 to match the basemap's last
      // native zoom, so a cluster tap would land on sharp tiles. Cut at review
      // for two reasons. (1) leaflet.markercluster sets
      // `_maxZoom = disableClusteringAtZoom - 1` and compares
      // `Math.round(map._zoom)`, so with `zoomSnap: 0.5` above, 16 unclusters
      // from an effective 15.5 -- a FULL level earlier than intended, scattering
      // individual 36px pins across a card that can be 148px tall in dense
      // central London. (2) A clustering threshold is a UX decision, and it does
      // not belong in a diff whose subject is the tile provider. The cost of
      // leaving it is that a cluster tap lands on 2x-upscaled tiles; that is the
      // honest price of Esri's z16 cache depth and it goes away with the queued
      // CARTO key.
      disableClusteringAtZoom: 17,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: false,
      // We own every cluster tap (handler below): a residual colocated bundle
      // lists its events; a spread cluster zooms to its bounds.
      zoomToBoundsOnClick: false,
      removeOutsideVisibleBounds: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      iconCreateFunction: (c: any) =>
        L.divIcon({
          html: `<div class="rclbubble"><span class="rcn">${c.getChildCount()}</span></div>`,
          className: 'rcl',
          iconSize: compact ? [34, 34] : [46, 46],
        }),
    });
    clusterRef.current = cl;
    m.addLayer(cl);

    // Cluster tap. Colocated events at one venue are already collapsed to a
    // single marker, so a geographic cluster normally holds DISTINCT locations
    // -> zoom to its bounds. The one exception is the rare residual case of two
    // different venues at the same rounded coord (same _coordKey): zoom can't
    // separate them, so list their combined events instead.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cl.on('clusterclick', (ev: any) => {
      // TEASER: a cluster is still a tap on the map, and the design has exactly
      // one rule for that. Return BEFORE reading children -- zooming to bounds
      // here would be a zoom the teaser says does not exist.
      if (teaser) {
        cb.current.onTeaserTap?.();
        return;
      }
      // VENUE MODE: a cluster tap ALWAYS zooms and never selects. The rule is
      // flat on purpose -- the alternative below picks between zooming and
      // listing a colocated bundle, and on this page a bundle already has a
      // per-venue panel that a zoom can reach. One behaviour means a user
      // learns "tapping a number zooms in" from the first tap and it stays
      // true, instead of a control that usually zooms and occasionally does
      // something else. Same-coord venues are separated by the marker effect's
      // venue-mode offset, so the zoom always has somewhere to land.
      if (popupMode === 'venue') {
        ev.layer.zoomToBounds({ padding: [48, 48], animate: !prefersReducedMotion() });
        return;
      }
      const cluster = ev.layer;
      const children = cluster.getAllChildMarkers();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const keys = new Set(children.map((c: any) => c._coordKey));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const members: MapEvent[] = children.flatMap((c: any) => (c._stack as MapEvent[]) || []);
      if (keys.size > 1 || members.length < 2) {
        cluster.zoomToBounds({ padding: [40, 40] });
        return;
      }
      if (popupMode === 'none') {
        cb.current.onClusterSelect?.(members.map((e) => e.occurrence_id));
      } else {
        const popup = L.popup({
          className: 'rmap-pop rmap-stack',
          maxWidth: 280,
          minWidth: 252,
          keepInView: true,
          autoPanPadding: [40, 40],
        })
          .setLatLng(cluster.getLatLng())
          .setContent(stackPopupHtml(members));
        m.openPopup(popup);
      }
    });

    // Progressive disclosure: reveal pin name labels (CSS) once zoomed in past
    // neighbourhood level. Toggling a class on the canvas avoids re-rendering
    // every marker on each zoom.
    const LABEL_ZOOM = 15;
    const applyZoomClass = () => {
      if (elRef.current) elRef.current.classList.toggle('hm-zoomed', m.getZoom() >= LABEL_ZOOM);
    };
    m.on('zoomend', applyZoomClass);
    applyZoomClass();

    // Fit the view to the pins currently shown (padding so they clear the card
    // edges; cap the zoom so a single pin doesn't slam to street level). Falls
    // back to the default view when nothing is visible yet (still loading).
    const doFitVisible = (animate: boolean) => {
      const layers = shownRef.current;
      if (!layers.length) {
        m.setView(center, zoom, { animate });
        return;
      }
      // Robust framing: a lone stray pin (e.g. a festival surfaced feed-wide but
      // physically in another country) must not drag the auto-frame abroad. Keep
      // only pins within ~1.5deg (~160km) of the median coordinate before
      // fitting; the outlier pin still renders, only the initial fit ignores it.
      // A genuine single-pin city still frames on its one pin (core == pts).
      const pts = layers.map((mk) => mk.getLatLng());
      const med = (xs: number[]) =>
        [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
      const mLat = med(pts.map((p) => p.lat));
      const mLng = med(pts.map((p) => p.lng));
      const OUTLIER_DEG = 1.5;
      const core = pts.filter(
        (p) => Math.abs(p.lat - mLat) <= OUTLIER_DEG && Math.abs(p.lng - mLng) <= OUTLIER_DEG,
      );
      const b = L.latLngBounds(core.length ? core : pts);
      if (teaser) {
        // Fit the LONGITUDE span and let latitude CROP. A plain fitBounds fits
        // BOTH axes, so on a wide short card the LIMITING axis is height:
        // measured at 824x105 (~8:1) against London bounds of ~1.9:1 it zoomed
        // out until the pins were a small cluster with Cardiff on screen. The
        // 148px mobile card is ~2.6:1 and has a milder version of the same
        // problem. Cropping top and bottom is the right trade for a card whose
        // job is "here is where things are" rather than "read this map":
        // a hairline latitude span at the data's centre makes width the
        // limiting axis, so the pins fill the card at every aspect ratio.
        const c = b.getCenter();
        const EPS = 0.0004;
        m.fitBounds(
          L.latLngBounds([c.lat - EPS, b.getWest()], [c.lat + EPS, b.getEast()]),
          // No vertical padding: there is nothing to pad against once latitude
          // is deliberately overflowing. maxZoom 12 stops a single-pin city (or
          // a hard tab filter) refitting to street level, where the basemap's
          // own labels blow up and the card reads as broken.
          { padding: [26, 0], maxZoom: 12, animate },
        );
        return;
      }
      m.fitBounds(b, { padding: [24, 24], maxZoom: 13, animate });
    };
    fitRef.current = doFitVisible;

    const api: MapApi = {
      flyTo: (occId) => {
        const mk = occMarkerRef.current.get(occId);
        if (!mk) return;
        cl.zoomToShowLayer(mk, () => {
          // Tracked + mount-guarded: if the user navigates away during the
          // zoom animation, this won't openPopup() on a removed map (the old
          // _leaflet_pos crash, BACHATA-WEBSITE-2C).
          disposer.safeTimeout(() => mk.openPopup(), 40);
        });
      },
      zoom: (d) => m.setZoom(m.getZoom() + d),
      invalidate: () => {
        // Called from ResizeObserver / visualViewport / orientation listeners,
        // which can fire while the map is mid-init or after teardown -- Leaflet
        // then throws on an unpositioned pane. A missed re-measure is harmless.
        disposer.safeCall((map) => map.invalidateSize());
      },
      pinHalf: (occId) => {
        const mk = occMarkerRef.current.get(occId);
        if (!mk) return null;
        try {
          const pt = m.latLngToContainerPoint(mk.getLatLng());
          const h = m.getSize().y;
          if (h <= 0) return null;
          return pt.y > h / 2 ? 'bottom' : 'top';
        } catch {
          return null;
        }
      },
      panToUser: (coords) => {
        if (!coords || !mapRef.current) return;
        const z = Math.max(m.getZoom(), 14);
        m.setView([coords.lat, coords.lng], z, { animate: !prefersReducedMotion() });
      },
      reset: () => fitRef.current?.(true),
    };
    onReady?.(api);

    // TEASER: one rule -- any tap opens the map page. Marker clicks do not bubble
    // to the map's 'click', which is exactly why teaser pins are built
    // non-interactive below: with no marker handler in the way the tap lands on
    // the map itself, so pin and empty ground genuinely take the same path
    // rather than two paths that happen to agree. Clusters DO stay interactive
    // (they are their own layer), so their own handler routes here too.
    if (teaser) {
      m.on('click', () => cb.current.onTeaserTap?.());
    } else if (popupMode === 'none') {
      // Mobile: no Leaflet popup -- a background-map tap clears the inline preview.
      // (Marker/cluster clicks don't bubble to the map 'click', so this only fires
      // on empty map.)
      m.on('click', () => cb.current.onSelect?.(null));
    } else if (popupMode === 'venue') {
      // VENUE MODE opens NOTHING. A tap on a pin selects it and a tap on bare
      // ground clears the selection; the page renders the selected venue's
      // detail in its own list, in ordinary React DOM.
      //
      // A Leaflet popup was the surface here and was reverted at review. The
      // whole family of defects it produced -- panels that stacked because
      // nothing owned closing them, a panel outliving the pin it pointed at, a
      // finished zoom opening a panel for a selection already dropped, plus
      // hand-rolled escaping, hand-rolled touch handling that fought the list's
      // own scrolling, and an iOS pointer-events workaround unverifiable in any
      // browser we have -- existed because the body was an innerHTML string in
      // Leaflet's DOM. None of them are reachable from a React subtree.
      //
      // Marker and cluster clicks do not bubble to the map, so this only ever
      // fires on bare map.
      m.on('click', () => cb.current.onVenueSelect?.(null));
    } else {
      m.on('popupopen', (e: L.PopupEvent) => {
        const el = e.popup.getElement();
        if (!(el instanceof HTMLElement)) return;
        // Stack popup (location list): every row is an <a> to its event. Route
        // through onOpenEvent for SPA navigation. Desktop is pointer-based so the
        // iOS pointer-events workaround below isn't needed here.
        const stack = el.querySelector('.rstack');
        if (stack instanceof HTMLElement) {
          el.style.pointerEvents = 'auto';
          stack.querySelectorAll('a.rstack-row').forEach((row) => {
            row.addEventListener('click', (rev) => {
              const href = (row as HTMLAnchorElement).getAttribute('href');
              if (!href) return;
              rev.preventDefault();
              rev.stopPropagation();
              cb.current.onOpenEvent?.(href);
            });
          });
          return;
        }
        // The whole popup card routes to the event. The CTA is a raw <a> in
        // Leaflet-injected HTML, but the entire .rpop body should be tappable.
        // On mobile the synthetic click is suppressed by Leaflet's touch handling;
        // touchstart fires reliably, and preventDefault blocks the subsequent
        // synthetic click. click handles pointer (non-touch) devices.
        const card = el.querySelector('.rpop');
        const cta = el.querySelector('a.rpop-cta');
        if (!(card instanceof HTMLElement) || !(cta instanceof HTMLAnchorElement)) return;
        // iOS Safari dead-tap fix: on a real iPhone WebKit computes
        // pointer-events:none on the Leaflet popup subtree here (Chromium
        // computes auto on the identical DOM), so taps fall straight through the
        // card to <html> and the tap handler below never runs. Forcing the popup
        // element interactive inline beats the inherited none without a
        // specificity fight, restoring whole-card + CTA taps on touch devices.
        el.style.pointerEvents = 'auto';
        card.style.pointerEvents = 'auto';
        const onTap = (rev: Event) => {
          const href = cta.getAttribute('href');
          if (!href) return;
          rev.preventDefault();
          rev.stopPropagation();
          cb.current.onOpenEvent?.(href);
        };
        card.addEventListener('touchstart', onTap);
        card.addEventListener('click', onTap);
        m.once('popupclose', () => {
          card.removeEventListener('touchstart', onTap);
          card.removeEventListener('click', onTap);
        });
      });
    }

    disposer.safeTimeout((map) => map.invalidateSize(), 60);
    disposer.safeTimeout((map) => map.invalidateSize(), 400);

    // Black-map guard: both fixed timeouts above can fire before hydration gives
    // the pane a size (SSR-prerendered home route), so tiles never paint until an
    // interaction and the container's near-black background shows through. A
    // one-shot observer re-measures the moment the container first reports a
    // non-zero size, painting tiles as soon as it is actually laid out.
    let sizeObs: ResizeObserver | null = null;
    if (elRef.current && typeof ResizeObserver !== 'undefined') {
      sizeObs = new ResizeObserver((entries) => {
        const r = entries[0]?.contentRect;
        if (r && r.width > 0 && r.height > 0) {
          sizeObs?.disconnect();
          sizeObs = null;
          disposer.safeCall((map) => map.invalidateSize());
        }
      });
      sizeObs.observe(elRef.current);
    }
    return () => {
      sizeObs?.disconnect();
      elRef.current?.removeEventListener('error', onCoverError, true);

      // dispose() cancels any pending timeouts AND marks the map dead, so a
      // deferred call (e.g. flyTo's openPopup) scheduled just before unmount
      // can't fire against the removed map.
      disposer.dispose();
      m.remove();
      // Retract the API before anything else can reach for it: this map is dead.
      onReady?.(null);
      mapRef.current = null;
      markers.current = new Map();
      occMarkerRef.current = new Map();
      userMarkerRef.current = null;
      shownRef.current = [];
      fitRef.current = null;
      didInitialFit.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- "you are here" user-location dot (non-clustered, above pins) ---------
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    if (userCoords) {
      const ll: L.LatLngExpression = [userCoords.lat, userCoords.lng];
      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng(ll);
      } else {
        userMarkerRef.current = L.marker(ll, {
          icon: L.divIcon({
            className: 'hm-userloc',
            html: '<span class="hm-userdot" data-testid="user-location-dot"><i class="r1"></i><i class="r2"></i><i class="core"></i></span>',
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          }),
          interactive: false,
          keyboard: false,
          zIndexOffset: 10000,
        }).addTo(m);
        // First appearance: frame on the user and suppress the later
        // fit-to-pins so the view stays centred on "you are here". Runs here
        // (not in the parent) so the map is guaranteed ready -- avoids the
        // cached-coords race where a parent effect pans a still-null apiRef.
        didInitialFit.current = true;
        m.setView(ll, Math.max(m.getZoom(), 14), { animate: !prefersReducedMotion() });
      }
    } else if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }
  }, [userCoords]);

  // ---- (re)build markers when the pin set changes --------------------------
  // One marker per physical venue-coordinate (groupPinsByLocation). Icons are
  // built with the FULL member count; the visibility effect below narrows the
  // count to the events matching the active filter.
  useEffect(() => {
    if (!clusterRef.current) return;
    const size: [number, number] = compact ? [36, 40] : [46, 52];
    const anchor: [number, number] = compact ? [18, 40] : [23, 52];
    const popAnchor: [number, number] = compact ? [0, -40] : [0, -52];
    const groups = groupPinsByLocation(events);
    const next = new Map<string, L.Marker>();
    const occIdx = new Map<string, L.Marker>();
    for (const g of groups) {
      // COINCIDENT VENUES. Two venues at one address share a rounded coord, so
      // without an offset the second marker sits exactly under the first and is
      // unreachable at every zoom -- silently and permanently.
      //
      // 0.00002deg is ~2m, which separates nothing a finger can use; it exists
      // so markercluster still bundles them. That is fine where a colocated
      // bundle has its own list (popupMode 'popup'/'none'), and NOT fine here,
      // where each venue owns a panel that can only be opened from its own pin.
      // Venue mode uses 0.00025deg. Applied to both axes at London's latitude
      // that is 27.8m of latitude and 17.3m of longitude, so ~33m apart on the
      // diagonal; taking the conservative latitude component alone it is 37px
      // at the cluster group's disableClusteringAtZoom of 17 and 75px at 18.
      // Either way the pins are separately tappable by the zoom a cluster tap
      // lands on, which is the property that matters.
      const off = g.offsetIndex * (popupMode === 'venue' ? 0.00025 : 0.00002);
      // TEASER pins are DECORATION. They are what makes the card say "here is
      // where things are", and nothing more: no click handler, no keyboard stop,
      // no tooltip. That is not a simplification, it is what makes "any tap
      // opens the map page" ONE rule -- an interactive marker swallows the click
      // instead of letting it reach the map, so pin and empty ground would take
      // two different paths that merely happen to agree today.
      //
      // The a11y cost is paid deliberately and elsewhere: a teaser pin is not a
      // control, so it must not be a tab stop announcing a name that leads
      // nowhere. The CARD is the one focusable control, with one accessible
      // name -- which is also the shape the reverted attribution chip's finding
      // 2 was about (nested interactive content inside a container control).
      const mk = L.marker([g.lat + off, g.lng + off], {
        icon: teaser
          ? teaserDotIcon(g.members.length, CATEGORY_COLORS[deriveCategory(g.rep)])
          : locationIcon(g.rep, g.venueName, g.members.length, size, anchor, popAnchor),
        ...(teaser
          ? { interactive: false, keyboard: false, riseOnHover: false }
          : {
              // a11y: focusable via keyboard (Tab to reach, Enter/Space to open); title
              // gives screen readers an accessible name for the otherwise-graphic pin.
              keyboard: true,
              riseOnHover: true,
              title: g.isStack
                ? `${g.members.length} events at ${g.venueName ?? 'this location'}`
                : `${g.rep.name}${g.rep.venue_name ? `, ${g.rep.venue_name}` : ''}`,
              alt: g.isStack
                ? `${g.members.length} events at ${g.venueName ?? 'this location'}`
                : `${CATEGORY_LABEL[deriveCategory(g.rep)]}: ${g.rep.name}`,
            }),
      });
      // 'popup' only. Venue mode deliberately does NOT bindPopup: bindPopup
      // also installs Leaflet's own click -> _openPopup handler on the marker,
      // which then runs alongside ours and fights it -- measured in the
      // prototype, where the SECOND tap on a pin left no popup in the DOM at
      // all. Venue mode opens a standalone L.popup from the selection effect
      // instead, so there is exactly one thing deciding what is open.
      if (popupMode === 'popup') {
        if (g.isStack) {
          mk.bindPopup(stackPopupHtml(g.members), {
            className: 'rmap-pop rmap-stack',
            maxWidth: 280,
            minWidth: 252,
            keepInView: true,
            autoPanPadding: [40, 40],
          });
        } else {
          mk.bindPopup(popupHtml(g.rep), {
            className: 'rmap-pop',
            maxWidth: 248,
            minWidth: 228,
            keepInView: true,
            autoPanPadding: [40, 40],
          });
        }
      }
      /* eslint-disable @typescript-eslint/no-explicit-any */
      (mk as any)._occ = g.repOccId;
      (mk as any)._members = new Set(g.memberOccs);
      (mk as any)._stackAll = g.members;
      (mk as any)._stack = g.members;
      (mk as any)._venueName = g.venueName;
      (mk as any)._renderedCount = g.members.length;
      (mk as any)._coordKey = `${g.lat.toFixed(4)},${g.lng.toFixed(4)}`;
      /* eslint-enable @typescript-eslint/no-explicit-any */
      // A multi-event location lists its events; a single one selects/previews.
      // Stacks don't fire onSelect (avoids a stale .sel ring under the open list).
      mk.on('click', () => {
        // VENUE MODE: one rule for every pin, stacked or not. The page's
        // selection is the single source of truth for what is open -- this
        // reports the tap and the sync effect below opens the panel, so a
        // selection made from the LIST under the map and one made from a pin
        // travel the identical path.
        if (popupMode === 'venue') {
          cb.current.onVenueSelect?.(g.repOccId);
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stack = (mk as any)._stack as MapEvent[];
        if (stack && stack.length >= 2) {
          if (popupMode === 'none') cb.current.onClusterSelect?.(stack.map((e) => e.occurrence_id));
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const occ = stack && stack[0] ? stack[0].occurrence_id : (mk as any)._occ;
          cb.current.onSelect?.(occ);
        }
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mk.on('mouseover', () => cb.current.onHover?.((mk as any)._occ));
      mk.on('mouseout', () => cb.current.onHover?.(null));
      next.set(g.repOccId, mk);
      for (const occ of g.memberOccs) occIdx.set(occ, mk);
    }
    markers.current = next;
    occMarkerRef.current = occIdx;
    // visibility is applied by the effect below (depends on visKey + eventsKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventsKey]);

  // ---- visibility + count-of-visible ---------------------------------------
  // A location marker shows when >=1 of its events is visible under the active
  // filter; its chip/label count reflect ONLY the visible events (decision 2),
  // re-iconed when that count changes (cheap: only affected stacks). When a
  // filter narrows a stack to a single event it renders as a plain single pin.
  useEffect(() => {
    const cl = clusterRef.current;
    if (!cl) return;
    const size: [number, number] = compact ? [36, 40] : [46, 52];
    const anchor: [number, number] = compact ? [18, 40] : [23, 52];
    const popAnchor: [number, number] = compact ? [0, -40] : [0, -52];
    const show = new Set(visible);
    const layers: L.Marker[] = [];
    markers.current.forEach((mk) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const all = (mk as any)._stackAll as MapEvent[];
      const vis = all.filter((e) => show.has(e.occurrence_id));
      if (!vis.length) return;
      const count = vis.length;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((mk as any)._renderedCount !== count) {
        const rep = count >= 2 ? repOf(vis) : vis[0];
        // TEASER stays a DOT here. The marker effect builds teaser icons as
        // dots, and this re-icon had no teaser branch -- so the moment a filter
        // changed a venue's visible count (the Tonight tab, or any typed
        // search) the pin swapped to the 36x40 cover-image bubble the teaser
        // design exists to avoid, on a card only 148px tall. The count still
        // drives the dot's SIZE, which is the whole point of re-iconing.
        mk.setIcon(
          teaser
            ? teaserDotIcon(count, CATEGORY_COLORS[deriveCategory(rep)])
            : // eslint-disable-next-line @typescript-eslint/no-explicit-any
              locationIcon(rep, (mk as any)._venueName, count, size, anchor, popAnchor),
        );
        // 'popup' ONLY, not "anything that is not none". Venue mode never calls
        // bindPopup (it opens a standalone popup instead), so this was a no-op
        // there by luck rather than by intent -- and building the HTML for a
        // popup that does not exist is work done for nothing on every filter.
        if (popupMode === 'popup') {
          mk.setPopupContent(count >= 2 ? stackPopupHtml(vis) : popupHtml(vis[0]));
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const venueName = (mk as any)._venueName as string | null;
        mk.options.title =
          count >= 2
            ? `${count} events at ${venueName ?? 'this location'}`
            : `${vis[0].name}${vis[0].venue_name ? `, ${vis[0].venue_name}` : ''}`;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mk as any)._renderedCount = count;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mk as any)._stack = vis;
      layers.push(mk);
    });
    cl.clearLayers();
    cl.addLayers(layers);
    shownRef.current = layers;
    if (!didInitialFit.current && layers.length > 0) {
      didInitialFit.current = true;
      fitRef.current?.(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visKey, eventsKey]);

  // ---- glow (re-applied after visibility rebuilds the icon DOM) ------------
  useEffect(() => {
    const g = new Set(glow);
    markers.current.forEach((mk) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const el = (mk as any)._icon as HTMLElement | undefined;
      if (!el) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const members = (mk as any)._members as Set<string>;
      let on = false;
      g.forEach((o) => {
        if (members.has(o)) on = true;
      });
      el.classList.toggle('glow', on);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glowKey, visKey, eventsKey]);

  // Escape closes the credit panel. Bound on the document rather than on the
  // panel, because the panel is not focus-trapped: the button keeps focus after
  // the click that opened it, so a keydown on the panel itself would never
  // fire. Only bound while the panel is open, so it cannot swallow Escape from
  // anything else on the page.
  useEffect(() => {
    if (!creditOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCreditOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [creditOpen]);

  // ---- hover highlight -----------------------------------------------------
  useEffect(() => {
    markers.current.forEach((mk) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const el = (mk as any)._icon as HTMLElement | undefined;
      if (!el) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const members = (mk as any)._members as Set<string>;
      el.classList.toggle('hot', !!hovered && members.has(hovered));
    });
  }, [hovered, visKey, eventsKey]);

  // ---- VENUE MODE: bring the selected pin into view --------------------------
  // There is no panel to manage any more, so this does two things only: reveal
  // a selected pin that markercluster has bundled away, and report a selection
  // that cannot be shown so the page can drop it.
  useEffect(() => {
    if (popupMode !== 'venue' || !mapRef.current) return;
    const mk = selected ? markers.current.get(selected) : undefined;
    const onMap = !!mk && shownRef.current.includes(mk);

    // A selection whose pin is not on the map -- filtered out, or a stale id
    // from a shared ?venue= link that matches nothing -- is reported so the
    // page clears it.
    //
    // NOT unconditional, and the earlier draft's two failures are different
    // ones. It must not return early merely because no popup is open (that
    // left a stale id uncleared), and it must not fire when there are NO PINS
    // AT ALL: with an empty pin set the map has nothing to judge against, so
    // "this id matches nothing" is indistinguishable from "the rows have not
    // arrived yet". The unconditional form therefore stripped every COLD-loaded
    // ?venue= before its rows landed -- measured 10 of 10 cold loads, which is
    // precisely the shared-link and reload case this URL state exists for. A
    // warm in-SPA navigation hid it, because the rows were already cached.
    //
    // Once any pin exists this is safe: the marker-build and visibility effects
    // above are declared earlier, so they have already run for this commit and
    // a miss here is a real miss, which still clears. eventsKey is empty
    // exactly when `events` is, and is already a dependency -- `events` itself
    // is a fresh array identity each render, which is why this effect keys on
    // the string rather than the array.
    const hasPins = eventsKey !== '';
    if (selected && !onMap && hasPins) {
      cb.current.onVenueSelect?.(null);
      return;
    }
    if (!selected || !mk) return;

    // A bundled marker has no _icon in the DOM, so the selection ring would
    // land on nothing and the pin the list is pointing at would be invisible.
    // zoomToShowLayer expands/zooms until the marker is real, then calls back.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(mk as any)._icon && clusterRef.current) {
      clusterRef.current.zoomToShowLayer(mk, () => {
        // A zoom animation takes time and both the map and the selection can
        // move during it; re-icon only for the selection still current.
        if (!mapRef.current || selectedRef.current !== selected) return;
        setRevealTick((t) => t + 1);
      });
    }
  }, [selected, popupMode, eventsKey, visKey]);

  // ---- selection highlight -------------------------------------------------
  useEffect(() => {
    markers.current.forEach((mk) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const el = (mk as any)._icon as HTMLElement | undefined;
      if (!el) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const members = (mk as any)._members as Set<string>;
      el.classList.toggle('sel', !!selected && members.has(selected));
    });
    // revealTick: a marker un-clustered by zoomToShowLayer gets its _icon AFTER
    // `selected` last changed, so without this the ring is applied to an
    // element that did not exist yet and is never re-applied.
  }, [selected, visKey, eventsKey, revealTick]);

  return (
    <>
      <div ref={elRef} className={cn('home-map home-map__canvas', compact && 'home-map--compact')} />
      {teaser && (
        /* THE TEASER'S CREDIT CONTROL.
         *
         * A 22px "i" in the card's top-right that opens the live basemap's own
         * credit, verbatim. Leaflet's control is off in teaser mode (see the
         * constructor) because its plate wraps to two lines on any card under
         * ~390px wide and takes 29px of a 148px card -- measured, and Esri's
         * terms do not allow shortening the string to make it fit.
         *
         * WHAT THIS IS, HONESTLY: Esri documents a popup/menu allowance for
         * attribution, but every instance of that wording is scoped to STATIC
         * maps, and this is a live tile layer. So this placement is a judgement
         * call rather than a documented permission. It was made deliberately,
         * with that stated. If it ever needs unwinding, the fix is to drop
         * `teaser` here and let Leaflet's control render -- nothing else
         * depends on this control existing.
         *
         * The three defects that killed the previous attempt at this chip are
         * fixed rather than repeated: it is a real <button> with a real
         * accessible name (not a div with a click handler), `aria-expanded`
         * tracks the panel, the tap target is 24px via a transparent inset on a
         * 22px circle, and no interactive content is nested inside any other
         * interactive content. */
        <div className="hm-credit">
          <button
            type="button"
            className="hm-credit-btn"
            aria-label="Map data credits"
            aria-expanded={creditOpen}
            onClick={() => setCreditOpen((v) => !v)}
          >
            i
          </button>
          {creditOpen && (
            <div className="hm-credit-panel" role="dialog" aria-label="Map data credits">
              {/* dangerouslySetInnerHTML for the same reason HomeMapShell's
                  static credit uses it: the credit constants carry an <a> for
                  the OpenStreetMap copyright link, they are module constants
                  with no user input anywhere near them, and the alternative is
                  a second, hand-written spelling of a string the terms require
                  verbatim. */}
              <span dangerouslySetInnerHTML={{ __html: liveCredit }} />
              <button
                type="button"
                className="hm-credit-close"
                aria-label="Close map credits"
                onClick={() => setCreditOpen(false)}
              >
                &times;
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
