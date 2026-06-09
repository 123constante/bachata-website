import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGeolocation } from '@/hooks/useGeolocation';
import type { MapEvent, MapTab, MapFilter, MapCategory } from './mapTypes';
import { todayStr } from './mapTypes';
import {
  dedupePins,
  listFor,
  mapVisibleFor,
  glowFor,
  calendarDays as buildCalendarDays,
  homeStats,
} from './mapListDerivations';
import type { HomeStats } from './mapListDerivations';
import type { MapApi } from './EventMap';
// TEMPORARY touch-debug instrumentation (no-op unless ?touchdebug=1). Revert
// with the rest of the touch-debug scaffolding.
import { tlog } from '@/lib/touchDebug';

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
export function useMapList(events: MapEvent[]): UseMapListResult {
  // Lead with events (audit P1): the homepage opens on the All Events list, not
  // the brand/freshness hero. The /city/:slug/calendar deep-link still overrides
  // to the Calendar tab (handled in Index).
  const [tab, setTab] = useState<MapTab>('all');
  const [day, setDay] = useState<string | null>(null);
  const [filter, setFilter] = useState<MapFilter>('all');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const navigate = useNavigate();
  const apiRef = useRef<MapApi | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const wantScroll = useRef(false);
  // Captured once so derivations + query keys stay stable for the session.
  const today = useMemo(() => todayStr(), []);

  const geo = useGeolocation();
  const user = geo.coords;

  const onMapReady = useCallback((api: MapApi) => {
    apiRef.current = api;
  }, []);

  const { pins, pinKeyForOcc } = useMemo(() => dedupePins(events), [events]);
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
      setSelected(occId);
      const pin = pinKeyForOcc.get(occId) ?? occId;
      apiRef.current?.flyTo(pin);
      const e = byOcc.get(occId);
      if (e) navigate(`/event/${e.event_id}?occurrenceId=${e.occurrence_id}`);
    },
    [pinKeyForOcc, byOcc, navigate],
  );

  const fromPin = useCallback((occId: string | null) => {
    setSelected(occId);
    if (occId) wantScroll.current = true;
  }, []);

  // Map popup "View event" CTA -> client-side route. Leaflet cancels the raw
  // anchor's default navigation on touch, so the href alone is a dead tap on
  // mobile; EventMap intercepts the click and calls this instead.
  const openEvent = useCallback(
    (href: string) => {
      // TEMPORARY touchdebug: confirm the handler ran and the route changed.
      tlog('openEvent -> navigate ' + href);
      navigate(href);
      window.setTimeout(
        () => tlog('after navigate path=' + window.location.pathname),
        0,
      );
    },
    [navigate],
  );

  // After a pin click, scroll the list to the matching card.
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
