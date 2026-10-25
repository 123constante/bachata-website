// "Seen in lists" impressions -> record_list_impressions_v1.
//
// A card counts when >= 50% of it is visible for >= 1 s. Each (surface, event id)
// counts at most once per mount of a list page. Ids are queued per surface and sent
// in ONE rpc call per flush (chunks of <= 60). Flush on page hidden, pagehide,
// unmount and a 5 s idle debounce. Same gating as useRecordEventView; errors are
// swallowed (fire and forget).

import { useEffect, useState } from 'react';
import { getSupabase } from '@/integrations/supabase/getSupabase';
import { getViewerSession } from '@/lib/viewerSession';
import { flags } from '@/lib/featureFlags';

export type ImpressionSurface =
  | 'home' | 'city' | 'search' | 'more_events' | 'organiser'
  | 'calendar' | 'tonight' | 'festivals' | 'venue' | 'profile';

export const VISIBLE_THRESHOLD = 0.5;
export const VISIBLE_MS = 1000;
export const IDLE_FLUSH_MS = 5000;
export const MAX_IDS_PER_CALL = 60;

export type ImpressionSender = (
  surface: ImpressionSurface,
  ids: string[],
  sessionId: string,
) => void;

const defaultSender: ImpressionSender = (surface, ids, sessionId) => {
  // getSupabase(), not a static client import: the client is vendor-supabase, which
  // must stay out of every list route's first-load graph (puller ratchet).
  void getSupabase()
    .then((supabase) =>
      supabase.rpc('record_list_impressions_v1', {
        p_event_ids: ids,
        p_surface: surface,
        p_viewer_session_id: sessionId,
        p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      }),
    )
    .then(() => undefined, () => undefined);
};

/** Returns the viewer session id when recording is allowed, else null. */
function gate(): string | null {
  if (!flags.listImpressions || !flags.enableEventTracking) return null;
  if (typeof navigator !== 'undefined' && navigator.webdriver) return null;
  if (typeof IntersectionObserver === 'undefined') return null;
  return getViewerSession() || null;
}

export type ImpressionController = {
  track: (id: string | null | undefined) => (el: Element | null) => void;
  start: () => void;
  dispose: () => void;
  flush: () => void;
};

export function createImpressionController(
  surface: ImpressionSurface,
  send: ImpressionSender = defaultSender,
): ImpressionController {
  const seen = new Set<string>();
  let queue: string[] = [];
  const elements = new Map<Element, string>();
  const timers = new Map<Element, ReturnType<typeof setTimeout>>();
  const refs = new Map<string, (el: Element | null) => void>();
  const byId = new Map<string, Element>();
  let observer: IntersectionObserver | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let active = false;

  const flush = () => {
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
    if (!queue.length) return;
    const ids = queue;
    queue = [];
    const sessionId = gate();
    if (!sessionId) return;
    for (let i = 0; i < ids.length; i += MAX_IDS_PER_CALL) {
      send(surface, ids.slice(i, i + MAX_IDS_PER_CALL), sessionId);
    }
  };

  const enqueue = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    queue.push(id);
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(flush, IDLE_FLUSH_MS);
  };

  const cancel = (el: Element) => {
    const t = timers.get(el);
    if (t) { clearTimeout(t); timers.delete(el); }
  };

  const onEntries = (entries: IntersectionObserverEntry[]) => {
    for (const entry of entries) {
      const el = entry.target;
      const id = elements.get(el);
      if (!id) continue;
      const visible = entry.isIntersecting && entry.intersectionRatio >= VISIBLE_THRESHOLD;
      if (!visible) { cancel(el); continue; }
      if (timers.has(el) || seen.has(id)) continue;
      timers.set(el, setTimeout(() => {
        timers.delete(el);
        if (active) enqueue(id);
      }, VISIBLE_MS));
    }
  };

  const ensureObserver = (): IntersectionObserver | null => {
    if (observer) return observer;
    if (!gate()) return null;
    observer = new IntersectionObserver(onEntries, { threshold: [0, VISIBLE_THRESHOLD, 1] });
    return observer;
  };

  const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };

  const attach = (el: Element, id: string) => {
    if (seen.has(id)) return;
    elements.set(el, id);
    byId.set(id, el);
    ensureObserver()?.observe(el);
  };

  const detach = (el: Element) => {
    cancel(el);
    const id = elements.get(el);
    elements.delete(el);
    if (id && byId.get(id) === el) byId.delete(id);
    observer?.unobserve(el);
  };

  const track = (id: string | null | undefined) => {
    if (!id) return () => undefined;
    let ref = refs.get(id);
    if (!ref) {
      let current: Element | null = null;
      ref = (el: Element | null) => {
        if (current && current !== el) detach(current);
        current = el;
        if (el) attach(el, id);
      };
      refs.set(id, ref);
    }
    return ref;
  };

  const start = () => {
    if (active) return;
    active = true;
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);
    if (typeof window !== 'undefined') window.addEventListener('pagehide', flush);
    // Re-observe elements attached before a (StrictMode) remount.
    if (elements.size) {
      const o = ensureObserver();
      elements.forEach((_id, el) => o?.observe(el));
    }
  };

  const dispose = () => {
    flush();
    active = false;
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
    if (typeof window !== 'undefined') window.removeEventListener('pagehide', flush);
    timers.forEach((t) => clearTimeout(t));
    timers.clear();
    observer?.disconnect();
    observer = null;
  };

  return { track, start, dispose, flush };
}

/**
 * Attach the returned callback to a card's existing root element:
 *   const track = useListImpressions('tonight');  ...  <Link ref={track(id)} />
 * Adds no wrapper and no state, so no extra render per card.
 */
export function useListImpressions(surface: ImpressionSurface) {
  const [ctl] = useState(() => createImpressionController(surface));
  useEffect(() => {
    ctl.start();
    return () => ctl.dispose();
  }, [ctl]);
  return ctl.track;
}
