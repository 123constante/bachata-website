import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useLondonToday } from '@/hooks/useLondonToday';
import type { MapEvent, MapTab, MapFilter, MapCategory } from './mapTypes';
import { matchesFilter } from './mapTypes';
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
  /** When true (desktop), a pin tap scrolls the list to the matching card. On
   *  mobile the inline preview card replaces that scroll, so pass false. */
  scrollOnPinSelect?: boolean;
  /** The page's city slug. Pins are scoped to it so a feed-wide festival in
   *  another city (real foreign coords) stays listable but never pins on the map
   *  and drags fitBounds abroad. Null/undefined = no scoping (pin everything). */
  citySlug?: string | null;
}

export interface UseMapListResult {
  tab: MapTab;
  setTab: (t: MapTab) => void;
  day: string | null;
  setDay: (d: string | null) => void;
  filter: MapFilter;
  setFilter: (f: MapFilter) => void;
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
  apiRef: React.MutableRefObject<MapApi | null>;
  onMapReady: (api: MapApi) => void;
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
  opts?: UseMapListOptions,
): UseMapListResult {
  // Lead with events (audit P1): the homepage opens on the All Events list, not
  // the brand/freshness hero. The /city/:slug/calendar deep-link still overrides
  // to the Calendar tab (handled in Index).
  const [tab, setTabState] = useState<MapTab>('all');
  const [day, setDayState] = useState<string | null>(null);
  const [filter, setFilterState] = useState<MapFilter>('all');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const navigate = useNavigate();
  const apiRef = useRef<MapApi | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const wantScroll = useRef(false);
  // Mobile suppresses the pin-tap -> list-scroll (the inline preview card stands
  // in for it); desktop keeps it. Read through a ref so the callbacks stay stable.
  const scrollOnPinSelect = useRef(opts?.scrollOnPinSelect ?? true);
  scrollOnPinSelect.current = opts?.scrollOnPinSelect ?? true;

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

  // Changing the category filter clears the selection too, so a preview card for
  // an event the new filter hides can't linger.
  const setFilter = useCallback((f: MapFilter) => {
    setFilterState(f);
    setSelected(null);
  }, []);

  // Picking a different Calendar day re-filters the day-scoped map; clear the
  // selection so a stale highlight/preview can't survive into the new day
  // (parity with setTab/setFilter).
  const setDay = useCallback((d: string | null) => {
    setDayState(d);
    setSelected(null);
  }, []);

  // Reactive LONDON-calendar "today" (rolls across midnight / tab-refocus so a
  // long-lived session doesn't freeze Tonight/Calendar filters at the mount
  // day — audit #20). Must match the London-anchored map query window in
  // Index.tsx, or the Tonight tab filters for a day the query didn't fetch.
  const today = useLondonToday();

  const geo = useGeolocation();
  const user = geo.coords;

  const onMapReady = useCallback((api: MapApi) => {
    apiRef.current = api;
  }, []);

  // Pins are scoped to the page city: dropping out-of-city rows here keeps them
  // out of BOTH the pin set and mapVisible (which resolves through pinKeyForOcc),
  // while listEvents/calendarDays/stats below still see every row, so a far-flung
  // festival stays in the list ("further afield") but never on the map.
  const citySlug = opts?.citySlug ?? null;
  const { pins, pinKeyForOcc } = useMemo(
    () => dedupePins(events.filter((e) => isOnCityMap(e, citySlug))),
    [events, citySlug],
  );
  const calendarDays = useMemo(
    () => buildCalendarDays(events.filter((e) => matchesFilter(e, filter))),
    [events, filter],
  );
  const stats = useMemo(() => homeStats(events, today), [events, today]);

  // occurrence_id -> its MapEvent, so a card tap can resolve the event_id it
  // must navigate to without threading the whole row through every callsite.
  const byOcc = useMemo(() => {
    const m = new Map<string, MapEvent>();
    for (const e of events) m.set(e.occurrence_id, e);
    return m;
  }, [events]);

  const listEvents = useMemo(
    () => listFor(tab, { events, day, filter, q, user, today }),
    [tab, events, day, filter, q, user, today],
  );
  const mapVisible = useMemo(
    () => mapVisibleFor(tab, day, listEvents, pinKeyForOcc, events, q, filter),
    [tab, day, listEvents, pinKeyForOcc, events, q, filter],
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
      if (occId.startsWith('remote-')) {
        navigate(`/festival/${e.event_id}`);
      } else {
        navigate(`/event/${e.event_id}?occurrenceId=${e.occurrence_id}`);
      }
    },
    [byOcc, navigate],
  );

  const fromPin = useCallback((occId: string | null) => {
    setSelected(occId);
    if (occId && scrollOnPinSelect.current) wantScroll.current = true;
  }, []);

  // Map popup "View event" CTA -> client-side route. Leaflet cancels the raw
  // anchor's default navigation on touch, so the href alone is a dead tap on
  // mobile; EventMap intercepts the click and calls this instead.
  const openEvent = useCallback((href: string) => navigate(href), [navigate]);

  // After a pin click, scroll the list to the matching card (desktop only -- on
  // mobile scrollOnPinSelect is false so wantScroll never arms).
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
    filter,
    setFilter,
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
    apiRef,
    onMapReady,
    listRef,
    fromCard,
    fromPin,
    openEvent,
    geo,
  };
}
