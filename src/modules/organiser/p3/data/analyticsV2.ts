import { supabase } from '@/integrations/supabase/client';
import type { IsoDate } from '../model';

/**
 * organiser_analytics_v2 (prod definition read 2026-11-06): counts only, owner / manager of
 * the series, window capped at 366 days. organiser_share_code_v1 answers
 * { share_code, disabled } for an owner or manager. Neither is in the generated types, so
 * both go through one narrow caller and the answer is parsed, never cast through.
 */
export interface AnalyticsTotals {
  visitors: number;
  views: number;
  fromYourLink: number;
  linkTaps: Record<string, number>;
  linkTapsFromYourLink: number;
  guestListSignups: number;
  ticketsSold: number;
}

export interface AnalyticsDay {
  day: IsoDate;
  visitors: number;
  views: number;
  fromYourLink: number;
}

export interface AnalyticsV2 {
  hasOwnCode: boolean;
  totals: AnalyticsTotals;
  byDay: AnalyticsDay[];
}

/** Non-finite, negative or missing is 0. */
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export const EMPTY_TOTALS: AnalyticsTotals = {
  visitors: 0, views: 0, fromYourLink: 0, linkTaps: {}, linkTapsFromYourLink: 0, guestListSignups: 0, ticketsSold: 0,
};

export function parseAnalyticsV2(v: unknown): AnalyticsV2 {
  const o = obj(v);
  const t = obj(o.totals);
  const taps: Record<string, number> = {};
  for (const [k, n] of Object.entries(obj(t.link_taps))) taps[k] = num(n);
  return {
    hasOwnCode: o.has_own_code === true,
    totals: {
      visitors: num(t.visitors),
      views: num(t.views),
      fromYourLink: num(t.from_your_link),
      linkTaps: taps,
      linkTapsFromYourLink: num(t.link_taps_from_your_link),
      guestListSignups: num(t.guest_list_signups),
      ticketsSold: num(t.tickets_sold),
    },
    byDay: (Array.isArray(o.by_day) ? o.by_day : [])
      .map(obj)
      .filter((d) => typeof d.day === 'string')
      .map((d) => ({ day: d.day as string, visitors: num(d.visitors), views: num(d.views), fromYourLink: num(d.from_your_link) })),
  };
}

/** The page's total: every series in scope summed; has_own_code is true if any series has it. */
export function sumAnalytics(list: readonly AnalyticsV2[]): AnalyticsV2 {
  const totals: AnalyticsTotals = { ...EMPTY_TOTALS, linkTaps: {} };
  for (const a of list) {
    totals.visitors += a.totals.visitors;
    totals.views += a.totals.views;
    totals.fromYourLink += a.totals.fromYourLink;
    totals.linkTapsFromYourLink += a.totals.linkTapsFromYourLink;
    totals.guestListSignups += a.totals.guestListSignups;
    totals.ticketsSold += a.totals.ticketsSold;
    for (const [k, n] of Object.entries(a.totals.linkTaps)) totals.linkTaps[k] = (totals.linkTaps[k] ?? 0) + n;
  }
  const days = new Map<string, AnalyticsDay>();
  for (const a of list) {
    for (const d of a.byDay) {
      const m = days.get(d.day) ?? { day: d.day, visitors: 0, views: 0, fromYourLink: 0 };
      m.visitors += d.visitors; m.views += d.views; m.fromYourLink += d.fromYourLink;
      days.set(d.day, m);
    }
  }
  return {
    hasOwnCode: list.some((a) => a.hasOwnCode),
    totals,
    byDay: [...days.values()].sort((a, b) => (a.day < b.day ? -1 : 1)),
  };
}

type RpcError = { message: string; code?: string } | null;
type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: RpcError }>;
const rpc: Rpc = (fn, args) => (supabase.rpc as unknown as Rpc)(fn, args);

/** A refusal or bad request from the server has a code; a dropped connection has none. */
export const isRefusal = (e: unknown): boolean => !!(e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string' && (e as { code: string }).code !== '');
const isNetwork = (e: unknown): boolean => !isRefusal(e);

/** One retry, and only for a network failure. */
export async function withOneRetry<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if (!isNetwork(e)) throw e;
    return run();
  }
}

export async function fetchOrganiserAnalyticsV2(seriesId: string, from: IsoDate, to: IsoDate): Promise<AnalyticsV2> {
  return withOneRetry(async () => {
    const { data, error } = await rpc('organiser_analytics_v2', { p_series_id: seriesId, p_from: from, p_to: to });
    if (error) throw error;
    return parseAnalyticsV2(data);
  });
}

/**
 * The page's analytics, or hidden. organiser_analytics_v2 is owner / manager of the SERIES, so a
 * server refusal (any error with a code) means "not for your role": analyticsHidden, never an
 * error with a Retry that cannot succeed. One refused series hides the lot (a partial sum is
 * never shown as the page total). Only a code-less (network) error throws, after one retry.
 */
export type PageAnalytics = { hidden: true; data: null } | { hidden: false; data: AnalyticsV2 };

const REFUSED = Symbol('refused');

export async function fetchPageAnalytics(seriesIds: readonly string[], from: IsoDate, to: IsoDate): Promise<PageAnalytics> {
  const list = await Promise.all(
    seriesIds.map((id) =>
      fetchOrganiserAnalyticsV2(id, from, to).catch((e: unknown) => {
        if (isRefusal(e)) return REFUSED;
        throw e;
      }),
    ),
  );
  if (list.some((a) => a === REFUSED)) return { hidden: true, data: null };
  return { hidden: false, data: sumAnalytics(list as AnalyticsV2[]) };
}

export interface ShareCode {
  /** The code to put after ?ref=, or null when there is no usable one. */
  code: string | null;
  disabled: boolean;
}

export function parseShareCode(v: unknown): ShareCode {
  const o = obj(v);
  const code = typeof o.share_code === 'string' && o.share_code.trim() ? o.share_code.trim() : null;
  return { code, disabled: o.disabled === true };
}

export async function fetchShareCode(pageId: string): Promise<ShareCode> {
  return withOneRetry(async () => {
    const { data, error } = await rpc('organiser_share_code_v1', { p_organiser_id: pageId });
    if (error) throw error;
    return parseShareCode(data);
  });
}

export const analyticsKey = (userId: string | undefined, ids: readonly string[], from: IsoDate, to: IsoDate) =>
  ['p3-analytics-v2', userId, [...ids].sort().join(','), from, to] as const;
export const shareCodeKey = (userId: string | undefined, pageId: string | undefined) => ['p3-share-code', userId, pageId] as const;

/**
 * The share link: the PUBLIC event URL plus ?ref=<code>. publicEventRef is P3Row.publicEventRef
 * (slug, or legacy_event_id ?? id), never the series id. The code comes only from the RPC.
 */
export function shareLinkOf(origin: string, publicEventRef: string, code: string): string {
  return `${origin}/event/${encodeURIComponent(publicEventRef)}?ref=${encodeURIComponent(code)}`;
}
