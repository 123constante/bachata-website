// @vitest-environment jsdom
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const rpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

import { eventPageQueryKey } from '@/modules/event-page/useEventPageQuery';
import { seoLandingEventsKey } from '@/lib/seoLandingEvents';
import { CALENDAR_EVENTS_QUERY_ROOT, EVENT_PAGE_QUERY_ROOT } from '@/lib/publicQueryKeys';
import { invalidatePublicEventCaches } from '../publicCache';
import { useRunCommands, useSendOnce } from '../runCommands';
import { useSendPlan } from '../../p3/data/dates';
import { lifecycleCommand } from '../seriesCommands';

/*
 * FIXLIST F-33: every organiser write marks the public event page (that series, every
 * date of it) and every calendar range stale, so the same tab shows the change.
 */

const S = 'ser-1';
const KEYS = {
  pageSeries: eventPageQueryKey(S, null),
  pageDate: eventPageQueryKey(S, 'occ-1'),
  pageOther: eventPageQueryKey('ser-2', null),
  calendar: ['calendar-events', '2026-10-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z', null],
  calendarCity: ['calendar-events', '2026-10-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z', 'london'],
  unrelated: ['festival-detail', S],
} as const;
type K = keyof typeof KEYS;
const STALE: Record<K, boolean> = { pageSeries: true, pageDate: true, pageOther: false, calendar: true, calendarCity: true, unrelated: false };

function seeded() {
  const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 60 * 60 * 1000 } } });
  for (const k of Object.keys(KEYS) as K[]) qc.setQueryData([...KEYS[k]], { k });
  return qc;
}
const staleOf = (qc: QueryClient) =>
  Object.fromEntries((Object.keys(KEYS) as K[]).map((k) => [k, !!qc.getQueryState([...KEYS[k]])?.isInvalidated]));

const wrapper = (client: QueryClient) => ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: { ok: true, new_version: 8 }, error: null });
});

describe('F-33 key roots are the ones the public hooks build', () => {
  it('event page key', () => expect(eventPageQueryKey(S, null)[0]).toBe(EVENT_PAGE_QUERY_ROOT));
  it('calendar key (the SEO landing pages dehydrate the same key)', () =>
    expect(seoLandingEventsKey('2026-10-31', 7)[0]).toBe(CALENDAR_EVENTS_QUERY_ROOT));
});

describe('F-33 invalidatePublicEventCaches', () => {
  it.each(Object.keys(KEYS) as K[])('%s', (k) => {
    const qc = seeded();
    invalidatePublicEventCaches(qc, S);
    expect(staleOf(qc)[k]).toBe(STALE[k]);
  });
});

/** Every P3 write hook in scope x success and refusal: both settle with the public caches stale. */
const HOOKS: Array<[string, (qc: QueryClient) => () => Promise<unknown>]> = [
  ['useSendOnce', (qc) => { const { result } = renderHook(() => useSendOnce(S), { wrapper: wrapper(qc) }); return () => result.current(lifecycleCommand('paused'), 7, 'k1'); }],
  ['useRunCommands', (qc) => { const { result } = renderHook(() => useRunCommands(S), { wrapper: wrapper(qc) }); return () => result.current([lifecycleCommand('paused')], 7); }],
  ['useSendPlan series', (qc) => { const { result } = renderHook(() => useSendPlan(S), { wrapper: wrapper(qc) }); return () => result.current({ to: 'series', command: lifecycleCommand('paused') }, ['k1'], 7); }],
  ['useSendPlan date', (qc) => { const { result } = renderHook(() => useSendPlan(S), { wrapper: wrapper(qc) }); return () => result.current({ to: 'date', occurrenceId: 'occ-1', version: 3, commands: [lifecycleCommand('paused')] }, ['k1'], 7); }],
];

describe('F-33 every P3 write hook calls it', () => {
  for (const [name, make] of HOOKS) {
    it.each(['ok', 'refused'] as const)(`${name} (%s)`, async (outcome) => {
      if (outcome === 'refused') rpc.mockResolvedValue({ data: null, error: { message: 'version_conflict' } });
      const qc = seeded();
      const send = make(qc);
      await send().catch(() => undefined);
      expect(staleOf(qc)).toEqual(STALE);
    });
  }
});

/*
 * Completeness: every source file that sends an event write (an owner command or a
 * date's programme, the three selfServeApi writers) calls the helper. A new write path
 * without it fails here. EXEMPT names why a file does not. Profile, onboarding and door
 * writes are not event-page facts and are out of F-33's scope.
 */
const ROOTS = ['src/modules/organiser/p3', 'src/modules/organiser/shared/runCommands.ts'];
const EXEMPT: Record<string, string> = {
  'src/modules/organiser/p3/data/repeat.ts': 'dry run (previewRepeat): the server rolls the write back',
  'src/modules/organiser/p3/data/sessions.ts': 'owned by open PR #1208; left for the lead (F-33)',
};
const SENDS = /\b(runSeriesCommand|runOccurrenceCommand|saveOccurrenceProgramme)\(/;

function files(p: string): string[] {
  if (statSync(p).isFile()) return [p];
  return readdirSync(p).flatMap((n) => (n === '__tests__' ? [] : files(join(p, n))));
}
const root = process.cwd();
const senders = ROOTS.flatMap((r) => files(join(root, r)))
  .filter((f) => /\.tsx?$/.test(f))
  .map((f) => relative(root, f).split('\\').join('/'))
  .filter((f) => SENDS.test(readFileSync(join(root, f), 'utf8')));

describe('F-33 completeness: every file that sends a command invalidates the public caches', () => {
  it('found the known senders (the grep still works)', () => {
    expect(senders).toEqual(expect.arrayContaining([
      'src/modules/organiser/p3/data/dates.ts',
      'src/modules/organiser/shared/runCommands.ts',
      ...Object.keys(EXEMPT),
    ]));
  });
  it.each(senders)('%s', (f) => {
    const calls = readFileSync(join(root, f), 'utf8').includes('invalidatePublicEventCaches(');
    expect(calls || f in EXEMPT).toBe(true);
  });
});
