import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import './homeMap.css';
import { cn } from '@/lib/utils';
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
  onReady?: (api: MapApi) => void;
  onOpenEvent?: (href: string) => void;
  /** Mobile: a cluster tap surfaces the child events in an inline preview card
   *  instead of zooming/spiderfying. When set, clusters don't zoom on click. */
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
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
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

function posterHtml(e: MapEvent): string {
  const color = categoryColor(e);
  const inner = e.cover_image_url
    ? `<img class="cv-fill" src="${esc(e.cover_image_url)}" loading="lazy" alt="" />`
    : `<span class="rpin-mono">${esc(monogram(e.name))}</span>`;
  const scene = e.cover_image_url ? '' : eventScene(e);
  return `<div class="rpin" style="--pc:${color}"><span class="pcv cv ${scene}">${inner}<span class="grain"></span></span></div>`;
}

function popupHtml(e: MapEvent): string {
  const cat = deriveCategory(e);
  const color = CATEGORY_COLORS[cat];
  const cover = e.cover_image_url
    ? `<img class="cv-fill" src="${esc(e.cover_image_url)}" loading="lazy" alt="" />`
    : '';
  const scene = e.cover_image_url ? '' : eventScene(e);
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
    `<div class="rpop"><div class="rpop-cv cv ${scene}">${cover}<span class="grain"></span></div>` +
    `<div class="rpop-body">${cancelled}<div class="rpop-t">${esc(e.name)}</div>` +
    `<div class="rpop-lines">${line}</div>${venue}` +
    `<a class="rpop-cta" href="${href}">View event ${ARROW_SVG}</a></div></div>`
  );
}

/**
 * Lazy-loaded Leaflet map. Initialised once; markers / visibility / glow /
 * selection are reconciled on prop changes WITHOUT tearing the map down. Keyed
 * end-to-end by occurrence_id. Must be rendered inside a position:relative,
 * height-bearing parent (Leaflet needs a definite size).
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
  const markers = useRef<Map<string, L.Marker>>(new Map());
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

  const eventsKey = events.map((e) => e.occurrence_id).join(',');
  const visKey = visible.join(',');
  const glowKey = glow.join(',');

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
    L.tileLayer(TILE_URL, { subdomains: 'abcd', attribution: ATTR, maxZoom: 19 }).addTo(m);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cl = (L as any).markerClusterGroup({
      maxClusterRadius: compact ? 24 : 28,
      disableClusteringAtZoom: 17,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: false,
      zoomToBoundsOnClick: true,
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

    // Fit the view to the pins currently shown (padding so they clear the card
    // edges; cap the zoom so a single pin doesn't slam to street level). Falls
    // back to the default view when nothing is visible yet (still loading).
    const doFitVisible = (animate: boolean) => {
      const layers = shownRef.current;
      if (!layers.length) {
        m.setView(center, zoom, { animate });
        return;
      }
      const b = L.latLngBounds(layers.map((mk) => mk.getLatLng()));
      m.fitBounds(b, { padding: [24, 24], maxZoom: 13, animate });
    };
    fitRef.current = doFitVisible;

    const api: MapApi = {
      flyTo: (occId) => {
        const mk = markers.current.get(occId);
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
        const mk = markers.current.get(occId);
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
      // The whole popup card routes to the event. The CTA is a raw <a> in
      // Leaflet-injected HTML, but the entire .rpop body should be tappable.
      // On mobile the synthetic click is suppressed by Leaflet's touch handling;
      // touchstart fires reliably, and preventDefault blocks the subsequent
      // synthetic click. click handles pointer (non-touch) devices.
      m.on('popupopen', (e: L.PopupEvent) => {
        const el = e.popup.getElement();
        const card = el ? el.querySelector('.rpop') : null;
        const cta = el ? el.querySelector('a.rpop-cta') : null;
        if (!(card instanceof HTMLElement) || !(cta instanceof HTMLAnchorElement)) return;
        // iOS Safari dead-tap fix: on a real iPhone WebKit computes
        // pointer-events:none on the Leaflet popup subtree here (Chromium
        // computes auto on the identical DOM), so taps fall straight through the
        // card to <html> and the tap handler below never runs. Forcing the popup
        // element interactive inline beats the inherited none without a
        // specificity fight, restoring whole-card + CTA taps on touch devices.
        if (el instanceof HTMLElement) el.style.pointerEvents = 'auto';
        card.style.pointerEvents = 'auto';
        const onTap = (ev: Event) => {
          const href = cta.getAttribute('href');
          if (!href) return;
          ev.preventDefault();
          ev.stopPropagation();
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
    return () => {
      // dispose() cancels any pending timeouts AND marks the map dead, so a
      // deferred call (e.g. flyTo's openPopup) scheduled just before unmount
      // can't fire against the removed map.
      disposer.dispose();
      m.remove();
      mapRef.current = null;
      markers.current = new Map();
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
  useEffect(() => {
    if (!clusterRef.current) return;
    const size: [number, number] = compact ? [36, 40] : [46, 52];
    const anchor: [number, number] = compact ? [18, 40] : [23, 52];
    const popAnchor: [number, number] = compact ? [0, -40] : [0, -52];
    const next = new Map<string, L.Marker>();
    const coordKey = (lat: number | null, lng: number | null) => `${lat},${lng}`;
    const eventsByCoord = new Map<string, MapEvent[]>();
    for (const e of events) {
      if (e.lat == null || e.lng == null) continue;
      const key = coordKey(e.lat, e.lng);
      if (!eventsByCoord.has(key)) eventsByCoord.set(key, []);
      eventsByCoord.get(key)!.push(e);
    }
    for (const e of events) {
      if (e.lat == null || e.lng == null) continue;
      const colocated = eventsByCoord.get(coordKey(e.lat, e.lng))!;
      const index = colocated.indexOf(e);
      const offsetDeg = index * 0.00002;
      const lat = e.lat + offsetDeg;
      const lng = e.lng + offsetDeg;
      const mk = L.marker([lat, lng], {
        icon: L.divIcon({
          html: posterHtml(e),
          className: 'rpinwrap',
          iconSize: size,
          iconAnchor: anchor,
          popupAnchor: popAnchor,
        }),
        // a11y: focusable via keyboard (Tab to reach, Enter/Space to open the
        // popup, whose "View event" link routes to the event); title gives
        // screen readers an accessible name for the otherwise-graphic pin.
        keyboard: true,
        riseOnHover: true,
        title: `${e.name}${e.venue_name ? `, ${e.venue_name}` : ''}`,
        alt: `${CATEGORY_LABEL[deriveCategory(e)]}: ${e.name}`,
      });
      if (popupMode !== 'none') {
        mk.bindPopup(popupHtml(e), {
          className: 'rmap-pop',
          maxWidth: 248,
          minWidth: 228,
          keepInView: true,
          autoPanPadding: [40, 40],
        });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mk as any)._occ = e.occurrence_id;
      mk.on('click', () => cb.current.onSelect?.(e.occurrence_id));
      mk.on('mouseover', () => cb.current.onHover?.(e.occurrence_id));
      mk.on('mouseout', () => cb.current.onHover?.(null));
      next.set(e.occurrence_id, mk);
    }
    markers.current = next;
    // visibility is applied by the effect below (depends on visKey + eventsKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventsKey]);


  // ---- (re)build markers when the pin set changes --------------------------
  useEffect(() => {
    if (!clusterRef.current) return;
    const size: [number, number] = compact ? [36, 40] : [46, 52];
    const anchor: [number, number] = compact ? [18, 40] : [23, 52];
    const popAnchor: [number, number] = compact ? [0, -40] : [0, -52];
    const next = new Map<string, L.Marker>();
    const coordKey = (lat: number | null, lng: number | null) => `${lat},${lng}`;
    const eventsByCoord = new Map<string, MapEvent[]>();
    for (const e of events) {
      if (e.lat == null || e.lng == null) continue;
      const key = coordKey(e.lat, e.lng);
      if (!eventsByCoord.has(key)) eventsByCoord.set(key, []);
      eventsByCoord.get(key)!.push(e);
    }
    for (const e of events) {
      if (e.lat == null || e.lng == null) continue;
      const colocated = eventsByCoord.get(coordKey(e.lat, e.lng))!;
      const index = colocated.indexOf(e);
      const offsetDeg = index * 0.00002;
      const lat = e.lat + offsetDeg;
      const lng = e.lng + offsetDeg;
      const mk = L.marker([lat, lng], {
        icon: L.divIcon({
          html: posterHtml(e),
          className: 'rpinwrap',
          iconSize: size,
          iconAnchor: anchor,
          popupAnchor: popAnchor,
        }),
        keyboard: true,
        riseOnHover: true,
        title: `${e.name}${e.venue_name ? `, ${e.venue_name}` : ''}`,
        alt: `${CATEGORY_LABEL[deriveCategory(e)]}: ${e.name}`,
      });
      if (popupMode !== 'none') {
        mk.bindPopup(popupHtml(e), {
          className: 'rmap-pop',
          maxWidth: 248,
          minWidth: 228,
          keepInView: true,
          autoPanPadding: [40, 40],
        });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mk as any)._occ = e.occurrence_id;
      mk.on('click', () => cb.current.onSelect?.(e.occurrence_id));
      mk.on('mouseover', () => cb.current.onHover?.(e.occurrence_id));
      mk.on('mouseout', () => cb.current.onHover?.(null));
      next.set(e.occurrence_id, mk);
    }
    markers.current = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventsKey]);

  // ---- visibility ----------------------------------------------------------
  useEffect(() => {
    const cl = clusterRef.current;
    if (!cl) return;
    cl.clearLayers();
    const show = new Set(visible);
    const layers: L.Marker[] = [];
    markers.current.forEach((mk, occ) => {
      if (show.has(occ)) layers.push(mk);
    });
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
    markers.current.forEach((mk, occ) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const el = (mk as any)._icon as HTMLElement | undefined;
      if (el) el.classList.toggle('glow', g.has(occ));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glowKey, visKey, eventsKey]);

  // ---- hover highlight -----------------------------------------------------
  useEffect(() => {
    markers.current.forEach((mk, occ) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const el = (mk as any)._icon as HTMLElement | undefined;
      if (el) el.classList.toggle('hot', occ === hovered);
    });
  }, [hovered, visKey, eventsKey]);

  // ---- selection highlight -------------------------------------------------
  useEffect(() => {
    markers.current.forEach((mk, occ) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const el = (mk as any)._icon as HTMLElement | undefined;
      if (el) el.classList.toggle('sel', occ === selected);
    });
  }, [selected, visKey, eventsKey]);

  return <div ref={elRef} className={cn('home-map home-map__canvas', compact && 'home-map--compact')} />;
}
