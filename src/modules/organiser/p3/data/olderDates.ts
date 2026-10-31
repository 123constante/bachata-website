import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { nextBeforeOf, type EventWorkspace } from '../../events/eventModel';
import { parseWorkspace, type WorkspaceDate } from '../../shared/seriesModel';

/**
 * FIXLIST F-27 (DATES-100): All dates reads past the newest 100. admin_event_workspace_p5
 * pages by p_before (dates strictly older, newest first) and p_limit (1..200); meta.has_more
 * and meta.next_before say whether and where the next older page starts (live body, prod
 * stsdtacfauprzrdebmzg, read 2026-10-31).
 */
export const OLDER_PAGE = 200;
/** A guard against a server that never says "no more" (10,000 dates; prod's largest has 132). */
const MAX_PAGES = 50;

export interface OlderPage {
  dates: WorkspaceDate[];
  hasMore: boolean;
  nextBefore: string | null;
}

export async function readOlderPage(seriesId: string, before: string): Promise<OlderPage> {
  const { data, error } = await supabase.rpc('admin_event_workspace_p5', { p_series_id: seriesId, p_before: before, p_limit: OLDER_PAGE });
  if (error) throw error;
  const meta = (data as { meta?: { has_more?: unknown } } | null)?.meta;
  return { dates: parseWorkspace(data).dates, hasMore: meta?.has_more === true, nextBefore: nextBeforeOf(meta) };
}

export interface OlderDates {
  dates: WorkspaceDate[];
  /** false only when the page guard stopped the read: some dates are still not loaded. */
  complete: boolean;
}

/** Every date older than `before`, page after page, until the server says nothing is older. */
export async function fetchOlderDates(seriesId: string, before: string, read = readOlderPage): Promise<OlderDates> {
  const dates: WorkspaceDate[] = [];
  let cursor: string | null = before;
  for (let i = 0; cursor && i < MAX_PAGES; i++) {
    const page = await read(seriesId, cursor);
    dates.push(...page.dates);
    cursor = page.hasMore ? page.nextBefore : null;
  }
  return { dates, complete: cursor === null };
}

/** The workspace with the older dates added (newest first, as the read sends them; a date in both counts once). */
export function withOlder(ws: EventWorkspace, older: OlderDates): EventWorkspace {
  const seen = new Set(ws.dates.map((d) => d.id));
  const dates = [...ws.dates, ...older.dates.filter((d) => !seen.has(d.id))]
    .sort((a, b) => b.occurrence_date.localeCompare(a.occurrence_date));
  return { ...ws, dates, hasMore: !older.complete };
}

/** The older dates, read once the person asks (`wanted`); re-read when the event changes. */
export function useOlderDates(ws: EventWorkspace, wanted: boolean) {
  const before = ws.hasMore ? ws.nextBefore ?? null : null;
  return useQuery({
    queryKey: ['p3-older-dates', ws.series.id, ws.series.version, before],
    queryFn: () => fetchOlderDates(ws.series.id, before as string),
    enabled: wanted && before !== null,
    placeholderData: keepPreviousData,
  });
}
