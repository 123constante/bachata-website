import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));

import { fetchOrganiserAnalyticsV2, fetchPageAnalytics, fetchShareCode, parseAnalyticsV2, parseShareCode, shareLinkOf, sumAnalytics } from '../analyticsV2';

const zones = ['ticket', 'directions', 'share', 'group_chat', 'instagram', 'organiser_link', 'other'];
const raw = (t: Record<string, unknown>, over: Record<string, unknown> = {}) => ({
  has_own_code: true,
  totals: { visitors: 0, views: 0, from_your_link: 0, link_taps: Object.fromEntries(zones.map((z) => [z, 0])), link_taps_from_your_link: 0, guest_list_signups: 0, tickets_sold: 0, ...t },
  by_day: [],
  ...over,
});
const days = (n: number) => Array.from({ length: n }, (_, i) => ({ day: `2026-01-${String((i % 28) + 1).padStart(2, '0')}x${i}`, visitors: 1, views: 2, from_your_link: 0 }));

const SHAPES: Array<[string, unknown, { visitors: number; fromYourLink: number; guest: number; tickets: number; own: boolean; rows: number }]> = [
  ['all zero', raw({}), { visitors: 0, fromYourLink: 0, guest: 0, tickets: 0, own: true, rows: 0 }],
  ['views only', raw({ visitors: 8, views: 12 }, { has_own_code: false }), { visitors: 8, fromYourLink: 0, guest: 0, tickets: 0, own: false, rows: 0 }],
  ['own-code taps', raw({ visitors: 5, from_your_link: 3, link_taps_from_your_link: 2, link_taps: { ticket: 2 } }), { visitors: 5, fromYourLink: 3, guest: 0, tickets: 0, own: true, rows: 0 }],
  ['guest list 6 and tickets 2', raw({ visitors: 9, guest_list_signups: 6, tickets_sold: 2 }), { visitors: 9, fromYourLink: 0, guest: 6, tickets: 2, own: true, rows: 0 }],
  ['huge', raw({ visitors: 123456 }, { by_day: days(366) }), { visitors: 123456, fromYourLink: 0, guest: 0, tickets: 0, own: true, rows: 366 }],
  ['garbage', { totals: { visitors: -4, views: Number.NaN, from_your_link: 'x', guest_list_signups: Infinity }, by_day: [null, { day: 5 }] }, { visitors: 0, fromYourLink: 0, guest: 0, tickets: 0, own: false, rows: 0 }],
  ['null', null, { visitors: 0, fromYourLink: 0, guest: 0, tickets: 0, own: false, rows: 0 }],
];

describe('parseAnalyticsV2 x every shape', () => {
  it.each(SHAPES)('%s', (_n, input, e) => {
    const a = parseAnalyticsV2(input);
    expect(a.totals.visitors).toBe(e.visitors);
    expect(a.totals.fromYourLink).toBe(e.fromYourLink);
    expect(a.totals.guestListSignups).toBe(e.guest);
    expect(a.totals.ticketsSold).toBe(e.tickets);
    expect(a.hasOwnCode).toBe(e.own);
    expect(a.byDay).toHaveLength(e.rows);
  });
});

describe('sumAnalytics: page scope', () => {
  it('2 series are summed, has_own_code if any, days merged', () => {
    const a = parseAnalyticsV2(raw({ visitors: 4, tickets_sold: 1 }, { has_own_code: false, by_day: [{ day: '2026-11-01', visitors: 4, views: 5 }] }));
    const b = parseAnalyticsV2(raw({ visitors: 6, guest_list_signups: 2, link_taps: { ticket: 3 } }, { by_day: [{ day: '2026-11-01', visitors: 6, views: 7 }] }));
    const s = sumAnalytics([a, b]);
    expect(s.totals.visitors).toBe(10);
    expect(s.totals.ticketsSold).toBe(1);
    expect(s.totals.guestListSignups).toBe(2);
    expect(s.totals.linkTaps.ticket).toBe(3);
    expect(s.hasOwnCode).toBe(true);
    expect(s.byDay).toEqual([{ day: '2026-11-01', visitors: 10, views: 12, fromYourLink: 0 }]);
  });
  it('no series is zero with no own code', () => {
    expect(sumAnalytics([]).hasOwnCode).toBe(false);
  });
});

describe('fetch', () => {
  beforeEach(() => rpc.mockReset());
  it('sends only the read RPC with the series and window', async () => {
    rpc.mockResolvedValue({ data: raw({ visitors: 2 }), error: null });
    const a = await fetchOrganiserAnalyticsV2('s1', '2026-10-01', '2026-10-30');
    expect(a.totals.visitors).toBe(2);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('organiser_analytics_v2', { p_series_id: 's1', p_from: '2026-10-01', p_to: '2026-10-30' });
  });
  it('refusal 42501 throws, is not retried, never zeros', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'not_allowed', code: '42501' } });
    await expect(fetchOrganiserAnalyticsV2('s1', 'a', 'b')).rejects.toMatchObject({ code: '42501' });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('network failure is retried once, then recovers', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'Failed to fetch' } }).mockResolvedValueOnce({ data: raw({ visitors: 3 }), error: null });
    expect((await fetchOrganiserAnalyticsV2('s1', 'a', 'b')).totals.visitors).toBe(3);
    expect(rpc).toHaveBeenCalledTimes(2);
  });
  it('network failure twice is an error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } });
    await expect(fetchOrganiserAnalyticsV2('s1', 'a', 'b')).rejects.toBeTruthy();
    expect(rpc).toHaveBeenCalledTimes(2);
  });
  // A refusal (an error WITH a code) is "analytics hidden for your role", never a Retry that
  // cannot succeed and never a partial sum shown as the page total. Code-less = network.
  const OK = { data: raw({ visitors: 1 }), error: null };
  const REFUSALS: Array<[string, { message: string; code?: string }, 'hidden' | 'throws']> = [
    ['42501', { message: 'not_allowed', code: '42501' }, 'hidden'],
    ['other coded error (22023)', { message: 'bad_request', code: '22023' }, 'hidden'],
    ['no code (network)', { message: 'Failed to fetch' }, 'throws'],
  ];
  describe.each(REFUSALS)('fetchPageAnalytics refusal %s', (_n, err, want) => {
    it('one series', async () => {
      rpc.mockResolvedValue({ data: null, error: err });
      const run = fetchPageAnalytics(['a'], 'f', 't');
      if (want === 'hidden') {
        await expect(run).resolves.toEqual({ hidden: true, data: null });
        expect(rpc).toHaveBeenCalledTimes(1);
      } else {
        await expect(run).rejects.toBeTruthy();
        expect(rpc).toHaveBeenCalledTimes(2);
      }
    });
    it('mixed: one allowed, one refused', async () => {
      rpc.mockImplementation(async (_fn?: string, args?: { p_series_id: string }) => { return (args?.p_series_id === 'a' ? OK : { data: null, error: err }); });
      const run = fetchPageAnalytics(['a', 'b'], 'f', 't');
      if (want === 'hidden') await expect(run).resolves.toEqual({ hidden: true, data: null });
      else await expect(run).rejects.toBeTruthy();
    });
  });
  it('all allowed: summed, not hidden', async () => {
    rpc.mockResolvedValue(OK);
    const r = await fetchPageAnalytics(['a', 'b'], 'f', 't');
    expect(r.hidden).toBe(false);
    expect(r.data?.totals.visitors).toBe(2);
  });
  it('share code read', async () => {
    rpc.mockResolvedValue({ data: { share_code: 'abc', disabled: false }, error: null });
    expect(await fetchShareCode('p1')).toEqual({ code: 'abc', disabled: false });
    expect(rpc).toHaveBeenCalledWith('organiser_share_code_v1', { p_organiser_id: 'p1' });
  });
});

describe('share code', () => {
  it.each([
    [{ share_code: 'abc', disabled: false }, { code: 'abc', disabled: false }],
    [{ share_code: 'abc', disabled: true }, { code: 'abc', disabled: true }],
    [{ share_code: null, disabled: false }, { code: null, disabled: false }],
    [{ share_code: '  ' }, { code: null, disabled: false }],
    [null, { code: null, disabled: false }],
  ])('%j', (i, e) => expect(parseShareCode(i)).toEqual(e));
  it('link is the public event URL plus ?ref=', () => {
    expect(shareLinkOf('https://x.test', 'sensual-fridays', 'a b')).toBe('https://x.test/event/sensual-fridays?ref=a%20b');
  });
});
