// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ws, TODAY } from '../../screens/__tests__/wsFixtures';

/*
 * F-33: every organiser save path marks the public event page of THAT series and the
 * calendar stale (same tab, no reload), and nothing broader: another series' event page
 * and unrelated public entries stay fresh. Only the network is stood in for.
 */

vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn(), auth: {}, from: vi.fn() } }));
vi.mock('../../../shared/selfServeApi', async (orig) => ({
  ...(await orig<typeof import('../../../shared/selfServeApi')>()),
  runSeriesCommand: vi.fn(async () => ({ ok: true, new_version: 8 })),
  runOccurrenceCommand: vi.fn(async () => ({ ok: true, new_version: 4 })),
  saveOccurrenceProgramme: vi.fn(async () => ({ ok: true })),
}));

import { useSendPlan, PLAN } from '../dates';
import { useEverySend, useDateSend } from '../sessions';
import { useRunCommands, useSendOnce } from '../../../shared/runCommands';
import { lifecycleCommand } from '../../../shared/seriesCommands';
import { publicEventPageKey, PUBLIC_CALENDAR_KEY } from '../../../shared/publicViewKeys';
import { eventPageQueryKey } from '@/modules/event-page/useEventPageQuery';
import { seoLandingEventsKey } from '@/lib/seoLandingEvents';

afterEach(() => vi.clearAllMocks());

const W = ws('weekly');
const SID = W.series.id;
const OCC = W.dates[0].id;

/** The public entries a same-tab organiser may have open, all fresh before the save. */
const PUBLIC: Array<{ key: readonly unknown[]; mine: boolean }> = [
  { key: eventPageQueryKey(SID, null), mine: true },
  { key: eventPageQueryKey(SID, OCC), mine: true },
  { key: ['calendar-events', '2026-10-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z', 'london'], mine: true },
  { key: seoLandingEventsKey(TODAY, 28), mine: true },
  { key: eventPageQueryKey('ser-other', null), mine: false },
  { key: ['city-page', 'london'], mine: false },
  { key: ['venue-page', 'v1'], mine: false },
];

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  for (const p of PUBLIC) qc.setQueryData(p.key, { cached: true });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return { qc, wrapper };
}

const stale = (qc: QueryClient) => PUBLIC.map((p) => ({ key: JSON.stringify(p.key), stale: qc.getQueryState(p.key)?.isInvalidated === true }));
const expected = PUBLIC.map((p) => ({ key: JSON.stringify(p.key), stale: p.mine }));

type Path = { name: string; run: (w: ReturnType<typeof setup>['wrapper']) => Promise<void> };
const PATHS: Path[] = [
  { name: 'dates.useSendPlan (one date: cancel)', run: async (wrapper) => {
    const { result } = renderHook(() => useSendPlan(SID), { wrapper });
    await act(async () => { await result.current(PLAN.cancel(W.dates[0], 'Illness'), ['k1'], 7); });
  } },
  { name: 'dates.useSendPlan (series command: add a date)', run: async (wrapper) => {
    const { result } = renderHook(() => useSendPlan(SID), { wrapper });
    await act(async () => { await result.current(PLAN.add('2027-03-05'), ['k1'], 7); });
  } },
  { name: 'sessions.useEverySend (every date)', run: async (wrapper) => {
    const { result } = renderHook(() => useEverySend(W), { wrapper });
    await act(async () => { await result.current(lifecycleCommand('paused'), 7); });
  } },
  { name: 'sessions.useDateSend (just this date)', run: async (wrapper) => {
    const { result } = renderHook(() => useDateSend(W, OCC), { wrapper });
    await act(async () => { await result.current(4, []); });
  } },
  { name: 'runCommands.useSendOnce (edit tray, status sheet)', run: async (wrapper) => {
    const { result } = renderHook(() => useSendOnce(SID), { wrapper });
    await act(async () => { await result.current(lifecycleCommand('paused'), 7, 'k1'); });
  } },
  { name: 'runCommands.useRunCommands (undo)', run: async (wrapper) => {
    const { result } = renderHook(() => useRunCommands(SID), { wrapper });
    await act(async () => { await result.current([lifecycleCommand('live')], 7); });
  } },
];

describe('F-33: organiser saves refresh the public event page and calendar in the same tab', () => {
  it.each(PATHS)('$name marks exactly this series’ event page and the calendar stale', async ({ run }) => {
    const { qc, wrapper } = setup();
    expect(stale(qc).every((s) => !s.stale)).toBe(true);
    await run(wrapper);
    expect(stale(qc)).toEqual(expected);
  });

  it('a refused save still refreshes them (the date may have moved on the server)', async () => {
    const api = await import('../../../shared/selfServeApi');
    vi.mocked(api.runOccurrenceCommand).mockRejectedValueOnce(Object.assign(new Error('stale'), { code: 'P0001' }));
    const { qc, wrapper } = setup();
    const { result } = renderHook(() => useSendPlan(SID), { wrapper });
    await act(async () => { await result.current(PLAN.cancel(W.dates[0], 'Illness'), ['k1'], 7).catch(() => null); });
    expect(stale(qc)).toEqual(expected);
  });

  it('the keys are the public modules’ own keys (a renamed key fails here, not silently on prod)', () => {
    expect(eventPageQueryKey(SID, OCC).slice(0, 2)).toEqual([...publicEventPageKey(SID)]);
    expect(seoLandingEventsKey(TODAY, 28)[0]).toBe(PUBLIC_CALENDAR_KEY[0]);
    expect(PUBLIC_CALENDAR_KEY).toHaveLength(1);
  });
});
