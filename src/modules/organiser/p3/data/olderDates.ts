import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { eventWorkspaceQueryKey } from '../../shared/runCommands';
import { parseEventWorkspace, type EventWorkspace } from '../../events/eventModel';

/**
 * W-31: the dates older than the workspace's first page. admin_event_workspace_p5 pages
 * (p_before, p_limit 1..200; meta.has_more / next_before, read from pg_proc on prod 2026-11-04):
 * each page asks for the dates before the oldest one already held. Keyed UNDER the workspace's
 * key, so every write that reloads the workspace (useSendPlan, useSendOnce) reloads these too
 * and an older date never saves against a stale version.
 */
export const OLDER_PAGE = 100;

interface OlderPage { dates: EventWorkspace['dates']; hasMore: boolean; total: number | null }

/** Where the next page starts: the oldest date held, while the server says there is more. */
export const nextBeforeOf = (dates: EventWorkspace['dates'], hasMore: boolean): string | null =>
  hasMore && dates.length ? dates.reduce((m, d) => (d.occurrence_date < m ? d.occurrence_date : m), dates[0].occurrence_date) : null;

async function fetchOlder(seriesId: string, before: string): Promise<OlderPage> {
  const { data, error } = await supabase.rpc('admin_event_workspace_p5', { p_series_id: seriesId, p_before: before, p_limit: OLDER_PAGE });
  if (error) throw error;
  const ws = parseEventWorkspace(data);
  return { dates: ws.dates, hasMore: ws.hasMore, total: ws.total };
}

/** The workspace with every older page loaded so far merged in, and the way to the next. */
export function useOlderDates(ws: EventWorkspace) {
  const first = nextBeforeOf(ws.dates, ws.hasMore);
  // Off until asked; then ON (an enabled query is what invalidateQueries refetches after a write).
  const [asked, setAsked] = useState(false);
  const q = useInfiniteQuery({
    queryKey: [...eventWorkspaceQueryKey(ws.series.id), 'older', first],
    queryFn: ({ pageParam }) => fetchOlder(ws.series.id, pageParam as string),
    initialPageParam: first ?? '',
    getNextPageParam: (last: OlderPage) => nextBeforeOf(last.dates, last.hasMore) ?? undefined,
    enabled: asked && !!first,
  });
  const pages = first ? q.data?.pages ?? [] : [];
  const merged = mergeOlder(ws, pages);
  const more = () => {
    if (!asked) setAsked(true);
    else void (pages.length ? q.fetchNextPage() : q.refetch());
  };
  return { ws: merged, more, loading: q.isFetching, failed: q.isError && !q.isFetching };
}

/** Pure: the first page plus the older pages, each date once; has_more / total from the last page read. */
export function mergeOlder(ws: EventWorkspace, pages: OlderPage[]): EventWorkspace {
  if (!pages.length) return ws;
  const seen = new Set(ws.dates.map((d) => d.id));
  const dates = [...ws.dates];
  for (const p of pages) for (const d of p.dates) if (!seen.has(d.id)) { seen.add(d.id); dates.push(d); }
  const last = pages[pages.length - 1];
  return { ...ws, dates, hasMore: last.hasMore, total: last.total ?? ws.total };
}

/** The older-dates button's words: how many the next page brings, never more than are left. */
export function olderLabel(ws: EventWorkspace): string {
  if (ws.total === null) return 'Show older dates';
  const n = Math.min(Math.max(ws.total - ws.dates.length, 1), OLDER_PAGE);
  return n === 1 ? 'Show 1 older date' : `Show ${n} older dates`;
}
