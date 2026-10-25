import { supabase } from '@/integrations/supabase/client';
import { addDaysToKey } from '@/lib/londonDate';
import { L, type IsoDate } from '../model';

/**
 * The views source for P3 Home and Stats: organiser_series_stats_v1 (admin ER P4 A4,
 * read with pg_get_functiondef 25 Oct 2026). Called with no series it covers every
 * series the signed-in person may read on their organisers' teams; counts only,
 * London days, window capped at 366 days. event_views itself is admin-only to select.
 */
export interface SeriesViews {
  seriesId: string;
  name: string;
  total: number;
  byDay: Array<{ day: IsoDate; count: number }>;
}

export interface ViewsStats {
  from: IsoDate;
  to: IsoDate;
  series: SeriesViews[];
}

export type StatsRange = 'd' | 'w' | 'm';
/** Days back from today, inclusive of today: Today, 7 days, 30 days. */
export const RANGE_DAYS: Record<StatsRange, number> = { d: 1, w: 7, m: 30 };

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);

export function parseStats(v: unknown): ViewsStats {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const series = Array.isArray(o.series) ? o.series : [];
  return {
    from: typeof o.from === 'string' ? o.from : '',
    to: typeof o.to === 'string' ? o.to : '',
    series: series
      .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object' && typeof (s as Record<string, unknown>).series_id === 'string')
      .map((s) => ({
        seriesId: s.series_id as string,
        name: typeof s.name === 'string' ? s.name : '',
        total: num(s.views_total),
        byDay: (Array.isArray(s.views_by_day) ? s.views_by_day : [])
          .filter((d): d is Record<string, unknown> => !!d && typeof d === 'object' && typeof (d as Record<string, unknown>).day === 'string')
          .map((d) => ({ day: d.day as string, count: num(d.count) })),
      })),
  };
}

/** The window's first day: `days` London days ending today. */
export function rangeFrom(today: IsoDate, days: number): IsoDate {
  return addDaysToKey(today, -(days - 1));
}

/**
 * organiser_series_stats_v1 is not in the generated types yet (types-drift regenerates
 * them from the live schema), so it goes through this one narrow caller, as
 * selfServeApi's programmeRpc does; the result is parsed (parseStats), never trusted.
 */
type StatsRpc = (fn: 'organiser_series_stats_v1', args: { p_from: string; p_to: string }) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
const statsRpc = (...args: Parameters<StatsRpc>) => (supabase.rpc as unknown as StatsRpc)(...args);

export async function fetchViewsStats(from: IsoDate, to: IsoDate): Promise<ViewsStats> {
  const { data, error } = await statsRpc('organiser_series_stats_v1', { p_from: from, p_to: to });
  if (error) throw error;
  return parseStats(data);
}

export const viewsStatsKey = (userId: string | undefined, from: IsoDate, to: IsoDate) => ['p3-views', userId, from, to] as const;

/** Every day of the window, zero-filled, summed over the series (the chart and the table). */
export function dailyTotals(s: ViewsStats): Array<{ day: IsoDate; count: number }> {
  if (!s.from || !s.to || s.from > s.to) return [];
  const sum = new Map<IsoDate, number>();
  for (const x of s.series) for (const d of x.byDay) sum.set(d.day, (sum.get(d.day) ?? 0) + d.count);
  const out: Array<{ day: IsoDate; count: number }> = [];
  const t = new Date(`${s.from}T12:00:00Z`);
  for (let i = 0; i < 400; i++) {
    const day = t.toISOString().slice(0, 10);
    if (day > s.to) break;
    out.push({ day, count: sum.get(day) ?? 0 });
    t.setUTCDate(t.getUTCDate() + 1);
  }
  return out;
}

/**
 * The last `days` of a window, worked out from the 30-day read already in hand (one RPC
 * for every range button). views_total is the sum of views_by_day in the RPC, so the
 * sliced totals are the same numbers a narrower call would return.
 */
export function sliceStats(s: ViewsStats, days: number): ViewsStats {
  if (!s.to) return s;
  const from = rangeFrom(s.to, days);
  if (from <= s.from) return s;
  return {
    from,
    to: s.to,
    series: s.series.map((x) => {
      const byDay = x.byDay.filter((d) => d.day >= from && d.day <= s.to);
      return { ...x, byDay, total: byDay.reduce((m, d) => m + d.count, 0) };
    }),
  };
}

export function viewsTotal(s: ViewsStats): number {
  return s.series.reduce((m, x) => m + x.total, 0);
}

/** Per-event rows, most viewed first; name ties keep the server's order. */
export function byEventOf(s: ViewsStats) {
  const max = Math.max(1, ...s.series.map((x) => x.total));
  return [...s.series]
    .sort((a, b) => b.total - a.total)
    .map((x) => ({ id: x.seriesId, name: x.name.trim() || L.noName, total: x.total, pct: x.total > 0 ? Math.max(2, Math.round((x.total / max) * 100)) : 0 }));
}
