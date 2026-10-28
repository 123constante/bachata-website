import { supabase } from '@/integrations/supabase/client';
import { LONDON_TZ, formatKeyDayLabel, londonDateKey } from '@/lib/londonDate';
import { L, type IsoDate } from '../model';

/**
 * One event's History (W3b-1, read only): organiser_series_history_v1 (admin ER P4 A4,
 * 20261223010000; read with pg_get_functiondef 28 Oct 2026). STABLE SECURITY DEFINER,
 * gated by _organiser_series_reader_v1 (42501 not_signed_in / not_a_member). It reads
 * event_audit_p5 rows with outcome 'success' whose target is the series or one of its
 * occurrences (event_occurrence_p5); those rows are written by the command writers
 * (apply_aggregate_write_p5, organiser_set_occurrence_programme_v1 and the admin
 * bulk/duplicate/collapse commands). Newest first, limit clamped 1..100, paged with
 * p_before = next_before while has_more.
 */
export type HistoryWho = 'you' | 'co-host' | 'team' | 'someone';

export interface HistoryItem {
  at: string;
  kind: string;
  label: string;
  who: HistoryWho;
  /** The date a date-level command was for (YYYY-MM-DD), else null. */
  date: IsoDate | null;
  fields: string[];
}

export interface HistoryPage {
  items: HistoryItem[];
  hasMore: boolean;
  nextBefore: string | null;
  /** Rows the parser dropped (not an object, no label, no real time). */
  dropped: number;
}

/** The ONE mapping from the RPC's `who` to the words on screen; anything else is "someone". */
export const WHO_OF: Record<string, HistoryWho> = { you: 'you', 'a co-host': 'co-host', 'the Bachata team': 'team' };
export const whoWord = (w: HistoryWho): string => L.historyWho[w];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseHistoryItem(v: unknown): HistoryItem | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const label = typeof o.label === 'string' ? o.label.trim() : '';
  if (!label || typeof o.at !== 'string' || !Number.isFinite(Date.parse(o.at))) return null;
  return {
    at: o.at,
    kind: typeof o.kind === 'string' ? o.kind : '',
    label,
    who: (typeof o.who === 'string' && WHO_OF[o.who]) || 'someone',
    date: typeof o.date === 'string' && DATE_RE.test(o.date) ? o.date : null,
    fields: (Array.isArray(o.fields) ? o.fields : []).filter((f): f is string => typeof f === 'string' && f.trim() !== '').map((f) => f.trim()),
  };
}

export function parseHistory(v: unknown): HistoryPage {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const raw = Array.isArray(o.items) ? o.items : [];
  const items: HistoryItem[] = [];
  for (const r of raw) {
    const x = parseHistoryItem(r);
    if (x) items.push(x);
  }
  const dropped = raw.length - items.length;
  if (dropped && import.meta.env.DEV) console.warn(`[p3 history] dropped ${dropped} malformed row(s)`);
  const nextBefore = typeof o.next_before === 'string' && Number.isFinite(Date.parse(o.next_before)) ? o.next_before : null;
  // a "more" with no cursor could never be fetched, so it is not offered
  return { items, hasMore: o.has_more === true && nextBefore !== null, nextBefore, dropped };
}

/**
 * Not in the generated types yet (types-drift regenerates them from the live schema), so it
 * goes through this one narrow caller, as stats.ts does; the result is parsed, never trusted.
 */
type HistoryRpc = (fn: 'organiser_series_history_v1', args: { p_series_id: string; p_limit: number; p_before?: string }) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
const historyRpc = (...args: Parameters<HistoryRpc>) => (supabase.rpc as unknown as HistoryRpc)(...args);

export const HISTORY_PAGE = 50;

export async function fetchHistory(seriesId: string, before: string | null): Promise<HistoryPage> {
  const { data, error } = await historyRpc('organiser_series_history_v1', {
    p_series_id: seriesId,
    p_limit: HISTORY_PAGE,
    ...(before ? { p_before: before } : {}),
  });
  if (error) throw error;
  return parseHistory(data);
}

export const historyKey = (userId: string | undefined, seriesId: string | undefined) => ['p3-history', userId, seriesId] as const;

/** The reader's refusal (not signed in, not on this event's team). */
export const isHistoryRefusal = (e: unknown): boolean => {
  const x = (e && typeof e === 'object' ? e : {}) as { code?: unknown; message?: unknown };
  return x.code === '42501' || /^(not_a_member|not_signed_in|permission_denied)/.test(String(x.message ?? ''));
};

export interface HistoryRow extends HistoryItem {
  /** "You · 14:32 · for Friday 6 March" */
  sub: string;
  /** "Changed: Name, Price", or null when the row names no field. */
  changed: string | null;
}

export interface HistoryDay {
  day: IsoDate;
  title: string;
  rows: HistoryRow[];
}

const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: LONDON_TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export function historyRowOf(x: HistoryItem): HistoryRow {
  const forDay = x.date ? formatKeyDayLabel(x.date) : null;
  const sub = [whoWord(x.who), timeFmt.format(new Date(x.at)), forDay ? L.historyFor(forDay) : null].filter(Boolean).join(' · ');
  return { ...x, sub, changed: x.fields.length ? L.historyChanged(x.fields) : null };
}

/** Rows grouped by their London day, newest day and newest row first. */
export function historyDays(items: readonly HistoryItem[], today: IsoDate = londonDateKey(new Date())): HistoryDay[] {
  const sorted = [...items].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const out: HistoryDay[] = [];
  for (const x of sorted) {
    const day = londonDateKey(new Date(x.at));
    let g = out[out.length - 1];
    if (!g || g.day !== day) {
      // a day from another year says which (an event's history can span years)
      const title = formatKeyDayLabel(day) ?? day;
      g = { day, title: day.slice(0, 4) === today.slice(0, 4) ? title : `${title} ${day.slice(0, 4)}`, rows: [] };
      out.push(g);
    }
    g.rows.push(historyRowOf(x));
  }
  return out;
}
