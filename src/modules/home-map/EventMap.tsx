import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
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
import { groupPinsByLocation } from './mapListDerivations';

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
  /** 'popup' (desktop): Leaflet popup on pin tap. 'none' (mobile): no popup --
   *  the parent renders an inline preview card; a background tap clears it. */
  popupMode?: 'popup' | 'none';
  /** Smaller pins + clusters for the mobile inset map card. */
  compact?: boolean;
  /** Constrain panning (mobile: keep the city in view). */
  maxBounds?: L.LatLngBoundsExpression;
  /** Floor zoom (mobile keeps the city legible). */
  minZoom?: number;
  /** The user's location ("you are here" dot); null hides/removes it. */
  userCoords?: { lat: number; lng: number } | null;
}

const LONDON: [number, number] = [51.5085, -0.128];
// Esri's dark canvas, NOT CARTO. CARTO began watermarking keyless traffic --
// `basemaps.cartocdn.com/dark_all` returns HTTP 200 with "API KEY REQUIRED"
// burned into the raster, so nothing errors and no guard sees it. It was live
// on prod. `rastertiles/dark_all` is byte-identical, so it is not a way out;
// the only CARTO fix is an account + key, which is queued.
//
// Esri's tile scheme is /{z}/{y}/{x} -- y BEFORE x, the opposite of the usual
// XYZ order -- and it has no {s} subdomains and no {r} retina variant.
const TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
// The label half of the pair. Transparent PNG; must be added AFTER the base.
const TILE_REF_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}';
// MEASURED, not read off a docs page: z<=16 serves real tiles; z17 and z18 both
// return the same 2521-byte "Map data not yet available" placeholder, which is
// LIGHT GREY and would read as a broken map on this dark theme. maxNativeZoom
// pins fetching at 16 and lets Leaflet upscale, so the zoom range is unchanged.
const TILE_MAX_NATIVE_ZOOM = 16;
// Deliberately its own constant, seeded from the tile ceiling rather than
// spelled as it. These are two different facts that happen to share a number:
// one is Esri's cache depth, the other is a marker-clustering UX threshold.
// When the queued CARTO key lands and TILE_MAX_NATIVE_ZOOM goes back to 19,
// this must NOT silently follow it three levels out -- changing how every
// clustered pin tap behaves in a diff that never mentions clustering.
const UNCLUSTER_ZOOM = TILE_MAX_NATIVE_ZOOM;
// VERBATIM from the service's own metadata -- server.arcgisonline.com/ArcGIS/rest/
// services/Canvas/World_Dark_Gray_Base/MapServer?f=json -> copyrightText. Esri's
// terms require the service's stated credit, and an abridged "Esri" alone drops
// HERE, Garmin and the OSM contributors. Re-read that field if the service is
// ever changed; do not hand-shorten it.
const ATTR =
  'Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, and the GIS user community';
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
  const scene = eventScene(e); // always compute — used up-front (no cover) or on img error
  const mono = esc(monogram(e.name));
  if (e.cover_image_url) {
    // A 404/expired cover would otherwise render as a broken-image icon (Chrome
    // ORB-blocks the failed response). The delegated `error` listener on the map
    // container (see the init effect) reads data-scene, hides the img, promotes
    // the .cv container to the scene gradient, and reveals the pre-baked monogram
    // — the exact no-cover fallback DOM. (Can't use inline onerror: the site CSP
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
  // Stash the map's fit-to-visible-pins fn so the visibility effect (which runs
  // outside the init closure) can trigger the one-time initial framing.
  const fitRef = useRef<((animate: boolean) => void) | null>(null);
  const cb = useRef({ onSelect, onHover, onOpenEvent, onClusterSelect });
  cb.current.onSelect = onSelect;
  cb.current.onHover = onHover;
  cb.current.onOpenEvent = onOpenEvent;
  cb.current.onClusterSelect = onClusterSelect;

  // Fingerprint occurrence_id AND updated_at so a CONTENT-only change (cover
  // swap, cancellation, time edit) on an event already on the map re-triggers the
  // marker/popup rebuild effects below. Keying on occurrence_id alone froze the
  // Leaflet popup HTML against field changes — a stale/deleted cover URL then
  // rendered as a broken image (ORB-blocked 404), and a cancelled/rescheduled
  // event kept showing its old state — even though React Query already had the
  // fresh row. updated_at is the audit-log curation instant (bumps on any edit).
  const eventsKey = useMemo(
    () => events.map((e) => `${e.occurrence_id}:${e.updated_at ?? ''}`).join(','),
    [events],
  );
  const visKey = useMemo(() => visible.join(','), [visible]);
  const glowKey = useMemo(() => glow.join(','), [glow]);

  // ---- init once -----------------------------------------------------------
  useEffect(() => {
    if (!elRef.current) return;
    const m = L.map(elRef.current, {
      zoomControl: false,
      attributionControl: true,
      minZoom,
      maxZoom: 18,
      zoomSnap: 0.5,
      fadeAnimation: false,
      ...(maxBounds ? { maxBounds, maxBoundsViscosity: 0.8 } : {}),
    }).setView(center, zoom);
    mapRef.current = m;
    // All deferred Leaflet calls route through this so they no-op (and their
    // timeouts are cancelled) once the map is torn down on unmount.
    const disposer = new MapDisposer(mapRef);

    // Cover-image error fallback (CSP-safe). The pins/popups are Leaflet
    // innerHTML strings, so we can't use an inline onerror attribute — the site's
    // strict CSP (script-src nonce, no 'unsafe-inline') blocks inline event
    // handlers. Instead delegate one real listener on the map container in the
    // CAPTURE phase (the `error` event does NOT bubble). A 404/expired cover
    // (which Chrome ORB-blocks → a broken-image icon) is hidden and its `.cv`
    // container promoted to the scene gradient (+ monogram for pins) — the exact
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
    // at any zoom -- while the pre-mount placeholder still (a CARTO render) DOES
    // show them, making the swap visible at mount.
    // `className` is what lets homeMap.css darken the base WITHOUT darkening the
    // labels, which are light-on-transparent and would be crushed to unreadable.
    const baseLayer = L.tileLayer(TILE_URL, {
      attribution: ATTR,
      maxZoom: 19,
      maxNativeZoom: TILE_MAX_NATIVE_ZOOM,
      className: 'hm-basetiles',
    }).addTo(m);
    const refLayer = L.tileLayer(TILE_REF_URL, {
      maxZoom: 19,
      maxNativeZoom: TILE_MAX_NATIVE_ZOOM,
      className: 'hm-labeltiles',
    }).addTo(m);

    // The basemap has no other alarm. CARTO's failure was HTTP 200 with "API KEY
    // REQUIRED" painted into the raster -- nothing threw, nothing 404'd, and the
    // smoke suite only counts markers, so it stayed green while prod was broken.
    // `tileerror` will not catch a watermark, but it DOES catch the failure this
    // provider can produce (host/CSP/DNS/403), which is currently unobserved.
    // Fire ONCE PER LAYER: a pan over a dead layer emits one event per tile,
    // but the two layers are two independent services. A single shared latch
    // meant one benign Reference 404 (that cache is the sparser of the pair)
    // permanently silenced a later total Base-layer outage -- the exact
    // failure this alarm exists for -- and reported it against the wrong URL.
    // Alarm on a layer that painted NOTHING, not on the first failed tile.
    // ~95% of this site is mobile, where a single dropped tile <img> is ordinary
    // network noise. Reporting the first error would emit one Sentry event per
    // layer per mount -- and the latch resets on EVERY mount (breakpoint
    // crossing, re-entering home) -- so the steady drip would bury the outage
    // this alarm exists to surface. The failures it is for (host/CSP/DNS/403)
    // have a distinguishable shape: zero tiles ever paint. The grace window is
    // what stops a transient error on a healthy layer's first tile from
    // impersonating that shape.
    const TILE_ALARM_GRACE_MS = 8000;
    const reportedFor = new Set<string>();
    const loadedFor = new Set<string>();
    const pendingFor = new Set<string>();
    const noteTileLoad = (layerName: string) => () => {
      loadedFor.add(layerName);
    };
    const tileErrorHandler =
      (layerName: string, url: string) =>
      (ev: { coords?: { x: number; y: number; z: number } }) => {
        // One tile already painted => the service is reachable => noise.
        if (reportedFor.has(layerName) || loadedFor.has(layerName)) return;
        if (pendingFor.has(layerName)) return;
        pendingFor.add(layerName);
        const at = ev?.coords ? `z${ev.coords.z}/${ev.coords.y}/${ev.coords.x}` : 'unknown';
        // safeTimeout, not setTimeout: dispose() clears it, so unmounting inside
        // the grace window cannot fire this against a removed map.
        disposer.safeTimeout(() => {
          pendingFor.delete(layerName);
          if (loadedFor.has(layerName) || reportedFor.has(layerName)) return;
          reportedFor.add(layerName);
          void import('@/lib/sentry')
            .then(({ captureException }) =>
              captureException(
                new Error(`basemap layer painted no tiles in ${TILE_ALARM_GRACE_MS}ms (${layerName} ${at})`),
                {
                  context: 'EventMap.tileerror',
                  tileLayer: layerName,
                  tileUrl: url,
                },
              ),
            )
            .catch(() => {});
        }, TILE_ALARM_GRACE_MS);
      };
    baseLayer.on('tileload', noteTileLoad('base'));
    refLayer.on('tileload', noteTileLoad('reference'));
    baseLayer.on('tileerror', tileErrorHandler('base', TILE_URL));
    refLayer.on('tileerror', tileErrorHandler('reference', TILE_REF_URL));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cl = (L as any).markerClusterGroup({
      maxClusterRadius: compact ? 24 : 28,
      // 16, not 17, because 16 is the basemap's last NATIVE zoom (see
      // TILE_MAX_NATIVE_ZOOM). zoomToShowLayer zooms until a marker unclusters,
      // so at 17 the single most common interaction -- tapping a clustered pin --
      // always landed the user on 2x-upscaled tiles.
      disableClusteringAtZoom: UNCLUSTER_ZOOM,
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

    // Mobile: no Leaflet popup -- a background-map tap clears the inline preview.
    // (Marker/cluster clicks don't bubble to the map 'click', so this only fires
    // on empty map.)
    if (popupMode === 'none') {
      m.on('click', () => cb.current.onSelect?.(null));
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
      const off = g.offsetIndex * 0.00002;
      const mk = L.marker([g.lat + off, g.lng + off], {
        icon: locationIcon(g.rep, g.venueName, g.members.length, size, anchor, popAnchor),
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
      });
      if (popupMode !== 'none') {
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mk.setIcon(locationIcon(rep, (mk as any)._venueName, count, size, anchor, popAnchor));
        if (popupMode !== 'none') {
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
  }, [selected, visKey, eventsKey]);

  return <div ref={elRef} className={cn('home-map home-map__canvas', compact && 'home-map--compact')} />;
}
