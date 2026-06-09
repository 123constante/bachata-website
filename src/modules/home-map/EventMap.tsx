import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import './homeMap.css';
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
// TEMPORARY touch-debug instrumentation (no-op unless ?touchdebug=1). Revert
// with the rest of the touch-debug scaffolding.
import { tlog } from '@/lib/touchDebug';

/** Imperative handle the parent (useMapList) drives the map through. */
export interface MapApi {
  flyTo(occId: string): void;
  reset(): void;
  zoom(delta: number): void;
  invalidate(): void;
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
  onSelect: (occId: string) => void;
  onHover: (occId: string | null) => void;
  onReady?: (api: MapApi) => void;
  onOpenEvent?: (href: string) => void;
  center?: [number, number];
  zoom?: number;
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
  center = LONDON,
  zoom = 12.5,
}: EventMapProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  // markercluster's types are awkward; `any` keeps the call sites readable.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clusterRef = useRef<any>(null);
  const markers = useRef<Map<string, L.Marker>>(new Map());
  const cb = useRef({ onSelect, onHover, onOpenEvent });
  cb.current.onSelect = onSelect;
  cb.current.onHover = onHover;
  cb.current.onOpenEvent = onOpenEvent;

  const eventsKey = events.map((e) => e.occurrence_id).join(',');
  const visKey = visible.join(',');
  const glowKey = glow.join(',');

  // ---- init once -----------------------------------------------------------
  useEffect(() => {
    if (!elRef.current) return;
    const m = L.map(elRef.current, {
      zoomControl: false,
      attributionControl: true,
      minZoom: 9,
      maxZoom: 18,
      zoomSnap: 0.5,
      fadeAnimation: false,
    }).setView(center, zoom);
    mapRef.current = m;
    // TEMPORARY touchdebug: how Leaflet classified this device.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const B = L.Browser as any;
    tlog(
      `L.Browser touch=${!!B.touch} touchNative=${!!B.touchNative} ` +
        `safari=${!!B.safari} mobile=${!!B.mobile} pointer=${!!B.pointer}`,
    );
    L.tileLayer(TILE_URL, { subdomains: 'abcd', attribution: ATTR, maxZoom: 19 }).addTo(m);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cl = (L as any).markerClusterGroup({
      maxClusterRadius: 40,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      removeOutsideVisibleBounds: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      iconCreateFunction: (c: any) =>
        L.divIcon({
          html: `<div class="rclbubble"><span class="rcn">${c.getChildCount()}</span></div>`,
          className: 'rcl',
          iconSize: [46, 46],
        }),
    });
    clusterRef.current = cl;
    m.addLayer(cl);

    const api: MapApi = {
      flyTo: (occId) => {
        const mk = markers.current.get(occId);
        if (!mk) return;
        cl.zoomToShowLayer(mk, () => {
          window.setTimeout(() => mk.openPopup(), 40);
        });
      },
      reset: () => m.flyTo(center, zoom, { duration: 0.6 }),
      zoom: (d) => m.setZoom(m.getZoom() + d),
      invalidate: () => m.invalidateSize(),
    };
    onReady?.(api);

    // The whole popup card routes to the event. The CTA is a raw <a> in
    // Leaflet-injected HTML, but the entire .rpop body should be tappable.
    // On mobile the synthetic click is suppressed by Leaflet's touch handling;
    // touchstart fires reliably, and preventDefault blocks the subsequent
    // synthetic click. click handles pointer (non-touch) devices.
    m.on('popupopen', (e: L.PopupEvent) => {
      const el = e.popup.getElement();
      const card = el ? el.querySelector('.rpop') : null;
      const cta = el ? el.querySelector('a.rpop-cta') : null;
      tlog(`popupopen card=${!!card} cta=${!!cta}`);
      if (!(card instanceof HTMLElement) || !(cta instanceof HTMLAnchorElement)) return;
      // FIX (iOS Safari dead-tap): on a real iPhone WebKit computes
      // pointer-events:none on the Leaflet popup subtree here (Chromium
      // computes auto), so taps fall straight through the card to <html> and
      // never reach the tap handler. Forcing the popup element interactive
      // inline beats the inherited none without a specificity fight. Confirmed
      // via the touch-debug capture (cardPE=none, elementFromPoint=html).
      if (el instanceof HTMLElement) el.style.pointerEvents = 'auto';
      card.style.pointerEvents = 'auto';
      // TEMPORARY touchdebug: after autopan settles, measure the card and probe
      // what is actually on top of its own centre. top!=card => the popup is
      // occluded / non-interactive; owns=false names the occluder.
      window.setTimeout(() => {
        const r = card.getBoundingClientRect();
        const cx = Math.round(r.left + r.width / 2);
        const cy = Math.round(r.top + r.height / 2);
        const top = document.elementFromPoint(cx, cy) as Element | null;
        const cls =
          top && typeof top.className === 'string'
            ? top.className.trim().replace(/\s+/g, '.').slice(0, 24)
            : '';
        const tg = top ? `${top.tagName.toLowerCase()}${cls ? '.' + cls : ''}` : 'null';
        const owns = !!top && (top === card || card.contains(top));
        tlog(
          `popup rect=${Math.round(r.left)},${Math.round(r.top)} ` +
            `${Math.round(r.width)}x${Math.round(r.height)} ctr=${cx},${cy} ` +
            `top=${tg} owns=${owns} cardPE=${getComputedStyle(card).pointerEvents}`,
        );
      }, 90);
      const onTap = (ev: Event) => {
        const href = cta.getAttribute('href');
        tlog(`onTap ${ev.type} href=${href ?? '(none)'}`);
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

    const t1 = window.setTimeout(() => m.invalidateSize(), 60);
    const t2 = window.setTimeout(() => m.invalidateSize(), 400);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      m.remove();
      mapRef.current = null;
      markers.current = new Map();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- (re)build markers when the pin set changes --------------------------
  useEffect(() => {
    if (!clusterRef.current) return;
    const next = new Map<string, L.Marker>();
    for (const e of events) {
      if (e.lat == null || e.lng == null) continue;
      const mk = L.marker([e.lat, e.lng], {
        icon: L.divIcon({
          html: posterHtml(e),
          className: 'rpinwrap',
          iconSize: [46, 52],
          iconAnchor: [23, 52],
          popupAnchor: [0, -52],
        }),
        // a11y: focusable via keyboard (Tab to reach, Enter/Space to open the
        // popup, whose "View event" link routes to the event); title gives
        // screen readers an accessible name for the otherwise-graphic pin.
        keyboard: true,
        riseOnHover: true,
        title: `${e.name}${e.venue_name ? `, ${e.venue_name}` : ''}`,
        alt: `${CATEGORY_LABEL[deriveCategory(e)]}: ${e.name}`,
      });
      mk.bindPopup(popupHtml(e), {
        className: 'rmap-pop',
        maxWidth: 248,
        minWidth: 228,
        keepInView: true,
        autoPanPadding: [40, 40],
      });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hovered, visKey]);

  // ---- selection highlight -------------------------------------------------
  useEffect(() => {
    markers.current.forEach((mk, occ) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const el = (mk as any)._icon as HTMLElement | undefined;
      if (el) el.classList.toggle('sel', occ === selected);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, visKey]);

  return <div ref={elRef} className="home-map home-map__canvas" />;
}
