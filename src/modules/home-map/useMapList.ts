import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGeolocation } from '@/hooks/useGeolocation';
import type { MapEvent, MapTab, MapCategory } from './mapTypes';
import { isRemoteRow } from './mapTypes';
import { isDesktopViewport } from './viewport';
import {
  dedupePins,
  listFor,
  mapVisibleFor,
  glowFor,
  calendarDays as buildCalendarDays,
  homeStats,
  isOnCityMap,
} from './mapListDerivations';
import type { HomeStats } from './mapListDerivations';
import type { MapApi } from './EventMap';

export interface UseMapListOptions {
  /** The page's city slug. Pins are scoped to it so a feed-wide festival in
   *  another city (real foreign coords) stays listable but never pins on the map
   *  and drags fitBounds abroad. Null/undefined = no scoping (pin everything). */
  citySlug?: string | null;
  /** The tab to open on. MUST be seeded synchronously by the page rather than
   *  corrected in a post-mount effect: on mobile the Calendar tab reorders the
   *  feed above the map (index.css .is-cal), so arriving on 'all' and flipping
   *  to 'cal' one tick later moved .hm-side by most of the viewport -- a 0.417
   *  CLS on /city/:slug/calendar, measured. Defaults to 'all'. */
  initialTab?: MapTab;
  /** The London day everything here dates against (YYYY-MM-DD). The PAGE owns the
   *  clock (Index's useLondonToday, seeded from the server's day and rolling over
   *  on its own) and passes the live value down -- this hook deliberately does NOT
   *  run a second useLondonToday. Two independent 60s intervals could flip up to a
   *  minute apart at London midnight, and the feed's grouping would disagree with
   *  the query window that fetched it. */
  today: string;
}

export interface UseMapListResult {
  tab: MapTab;
  setTab: (t: MapTab) => void;
  day: string | null;
  setDay: (d: string | null) => void;
  q: string;
  setQ: (q: string) => void;
  /** selection/hover hold the LIST occurrence_id (per-day card). */
  selected: string | null;
  hovered: string | null;
  setHovered: (occId: string | null) => void;
  /** the same selection/hover mapped to the representative PIN occ for the map. */
  mapSelected: string | null;
  mapHovered: string | null;
  pins: MapEvent[];
  eventsByOcc: Map<string, MapEvent>;
  listEvents: MapEvent[];
  mapVisible: string[];
  glow: string[];
  calendarDays: Map<string, MapCategory[]>;
  stats: HomeStats;
  /** The London day every consumer must date against (YYYY-MM-DD). Exposed so
   *  the feed's own "today" reads come from the SAME hydration-pinned source as
   *  these derivations, instead of each calling todayStr() at render time. */
  today: string;
  apiRef: React.MutableRefObject<MapApi | null>;
  /** EventMap calls this with its API on mount and with NULL on teardown. */
  onMapReady: (api: MapApi | null) => void;
  listRef: React.MutableRefObject<HTMLDivElement | null>;
  fromCard: (occId: string) => void;
  fromPin: (occId: string | null) => void;
  openEvent: (href: string) => void;
  geo: ReturnType<typeof useGeolocation>;
}

/**
 * Shared map <-> list discovery state for the Festival Map homepage. Wired to
 * real MapEvent[] from useMapEvents. All heavy logic lives in the pure
 * mapListDerivations functions so it can be unit-tested without React. Keyed by
 * occurrence_id throughout (never array index).
 */
export function useMapList(
  events: MapEvent[],
  opts: UseMapListOptions,
): UseMapListResult {
  // Lead with events (audit P1): the homepage opens on the All Events list, not
  // the brand/freshness hero. The /city/:slug/calendar deep-link opens on the
  // Calendar tab, seeded here (see initialTab) rather than corrected on mount.
  const [tab, setTabState] = useState<MapTab>(opts.initialTab ?? 'all');
  const [day, setDayState] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const navigate = useNavigate();
  const apiRef = useRef<MapApi | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const wantScroll = useRef(false);

  // Switching tabs clears any picked day (a stale Calendar day must not silently
  // re-filter the list/map on return; audit #16) and the current selection (so a
  // preview/highlight from the old tab can't survive into the new one), and
  // resets the feed scroll to the top so each tab opens at its head.
  const setTab = useCallback((t: MapTab) => {
    setTabState(t);
    setDayState(null);
    setSelected(null);
    listRef.current?.scrollTo({ top: 0 });
  }, []);

  // Picking a different Calendar day re-filters the day-scoped map; clear the
  // selection so a stale highlight/preview can't survive into the new day
  // (parity with setTab).
  const setDay = useCallback((d: string | null) => {
    setDayState(d);
    setSelected(null);
  }, []);

  // The page's London day (see UseMapListOptions.today). It is BY CONSTRUCTION the
  // same value that keyed the map query in Index, so the Tonight tab can never
  // filter for a day the query didn't fetch.
  const today = opts.today;

  const geo = useGeolocation();
  const user = geo.coords;

  // Also called with null when EventMap tears down (a resize across the
  // mobile/desktop breakpoint remounts it), so nothing can invalidate a dead map.
  const onMapReady = useCallback((api: MapApi | null) => {
    apiRef.current = api;
  }, []);

  // Pins are scoped to the page city: dropping out-of-city rows here keeps them
  // out of BOTH the pin set and mapVisible (which resolves through pinKeyForOcc),
  // while listEvents/calendarDays/stats below still see every row, so a far-flung
  // festival stays in the list but never on the map.
  const citySlug = opts.citySlug ?? null;
  const { pins, pinKeyForOcc } = useMemo(
    () => dedupePins(events.filter((e) => isOnCityMap(e, citySlug))),
    [events, citySlug],
  );
  const calendarDays = useMemo(() => buildCalendarDays(events), [events]);
  const stats = useMemo(() => homeStats(events, today), [events, today]);

  // occurrence_id -> its MapEvent, so a card tap can resolve the event_id it
  // must navigate to without threading the whole row through every callsite.
  const byOcc = useMemo(() => {
    const m = new Map<string, MapEvent>();
    for (const e of events) m.set(e.occurrence_id, e);
    return m;
  }, [events]);

  const listEvents = useMemo(
    () => listFor(tab, { events, day, q, user, today }),
    [tab, events, day, q, user, today],
  );
  const mapVisible = useMemo(
    () => mapVisibleFor(tab, day, listEvents, pinKeyForOcc, events, q),
    [tab, day, listEvents, pinKeyForOcc, events, q],
  );
  const glow = useMemo(
    () => glowFor(tab, events, pinKeyForOcc),
    [tab, events, pinKeyForOcc],
  );

  const mapSelected = useMemo(
    () => (selected ? pinKeyForOcc.get(selected) ?? selected : null),
    [selected, pinKeyForOcc],
  );
  const mapHovered = useMemo(
    () => (hovered ? pinKeyForOcc.get(hovered) ?? hovered : null),
    [hovered, pinKeyForOcc],
  );

  // Card tap OPENS the event (audit P0). The list row is the primary route to
  // /event now; the map-fly is kept as a side effect for coord-bearing events so
  // the (desktop) map still tracks the selection as the page transitions.
  const fromCard = useCallback(
    (occId: string) => {
      // Select (so the map highlights the pin) then route to the event. No flyTo:
      // the navigation unmounts the map immediately, so the fly animation is
      // wasted and can flash a popup/zoom mid-transition (audit #18).
      // Remote festivals (global, not in this city) route to /festival/:id.
      setSelected(occId);
      const e = byOcc.get(occId);
      if (!e) return;
      if (isRemoteRow(e)) {
        navigate(`/festival/${e.event_id}`);
      } else {
        navigate(`/event/${e.event_id}?occurrenceId=${e.occurrence_id}`);
      }
    },
    [byOcc, navigate],
  );

  // A pin tap arms the list scroll on desktop only -- on mobile the inline
  // preview card stands in for it. The viewport is read HERE, at tap time: a pin
  // can only be tapped on a mounted, client-side map, so matchMedia is always
  // available and always current (it even survives a resize across the
  // breakpoint, which a render-time flag would not).
  const fromPin = useCallback((occId: string | null) => {
    setSelected(occId);
    if (occId && isDesktopViewport()) wantScroll.current = true;
  }, []);

  // Map popup "View event" CTA -> client-side route. Leaflet cancels the raw
  // anchor's default navigation on touch, so the href alone is a dead tap on
  // mobile; EventMap intercepts the click and calls this instead.
  const openEvent = useCallback((href: string) => navigate(href), [navigate]);

  // After a pin click, scroll the feed to the matching card. The feed (.hm-feed)
  // is now the ONE scroller at every viewport -- the desktop rail no longer
  // scrolls itself -- so offsetTop is always measured from the same offset
  // parent as the element it scrolls.
  useEffect(() => {
    if (wantScroll.current && selected && listRef.current) {
      const el = listRef.current.querySelector(
        `[data-occ="${selected}"]`,
      ) as HTMLElement | null;
      if (el) {
        listRef.current.scrollTo({ top: Math.max(0, el.offsetTop - 96), behavior: 'smooth' });
      }
    }
    wantScroll.current = false;
  }, [selected]);

  return {
    tab,
    setTab,
    day,
    setDay,
    q,
    setQ,
    selected,
    hovered,
    setHovered,
    mapSelected,
    mapHovered,
    pins,
    eventsByOcc: byOcc,
    listEvents,
    mapVisible,
    glow,
    calendarDays,
    stats,
    today,
    apiRef,
    onMapReady,
    listRef,
    fromCard,
    fromPin,
    openEvent,
    geo,
  };
}
