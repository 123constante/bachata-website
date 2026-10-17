// Shared fixtures for the S3 flow tests (Add a date, Cancel a date, the no
// dates left fix). The clock is frozen by each test file on Tuesday
// 20 October 2026, five days before the clocks go back; every date here is
// derived from London today, never typed.
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Mock } from 'vitest';
import { addDaysToKey, londonTodayKey } from '@/lib/londonDate';
import { readDoneState } from '@/modules/organiser/flows/doneState';

export const FROZEN = new Date('2026-10-20T12:00:00Z');
export const today = () => londonTodayKey();
export const day = (n: number) => addDaysToKey(today(), n);

export const A = 'aaaaaaaa-0000-4000-8000-000000000001';
export const B = 'bbbbbbbb-0000-4000-8000-000000000002';
export const DRAFT = 'cccccccc-0000-4000-8000-000000000003';
export const PAUSED = 'dddddddd-0000-4000-8000-000000000004';
export const EMPTY = 'eeeeeeee-0000-4000-8000-000000000005';
export const FEST = 'ffffffff-0000-4000-8000-000000000006';

/** n coming scheduled dates from day 1 (prod: the 27 at-cap live series hold 47 to 59). */
export const comingRun = (n: number, from = 1): Occ[] =>
  Array.from({ length: n }, (_, i) => ({ id: `run${i}`, date: day(from + i), status: 'scheduled', version: 1 }));

/** Dates of series A: one past, one before 25 October, one after, one cancelled after. */
export const PAST = 'o0000000-0000-4000-8000-000000000000';
export const BEFORE = 'o1111111-0000-4000-8000-000000000001';
export const AFTER = 'o2222222-0000-4000-8000-000000000002';
export const GONE = 'o3333333-0000-4000-8000-000000000003';
export const NEW_OCC = 'o9999999-0000-4000-8000-000000000009';

export interface Occ { id: string; date: string; status: string; version: number }

export const occsA = (): Occ[] => [
  { id: PAST, date: day(-4), status: 'scheduled', version: 2 },
  { id: BEFORE, date: day(3), status: 'scheduled', version: 5 }, // Friday 23 October
  { id: AFTER, date: day(10), status: 'scheduled', version: 6 }, // Friday 30 October
  { id: GONE, date: day(17), status: 'cancelled', version: 7 }, // Friday 6 November
];

const homeDate = (o: Occ) => ({
  occurrence_id: o.id, occurrence_date: o.date, lifecycle_status: o.status, materialised_start_utc: `${o.date}T20:00:00Z`, has_own_changes: false,
});

export function series(id: string, name: string, occs: Occ[], over: Record<string, unknown> = {}) {
  const coming = occs.filter((o) => o.status === 'scheduled' && o.date >= today());
  return {
    id, name, slug: null, format: 'recurring', category: null, lifecycle_status: 'live', default_local_start_time: '20:00:00',
    default_cover_image_url: 'https://x/c.jpg', created_at: '2026-01-01T00:00:00Z',
    upcoming_count: coming.length, cancelled_upcoming_count: occs.filter((o) => o.status === 'cancelled' && o.date >= today()).length,
    next_dates: coming.slice(0, 3).map(homeDate), latest_decision: null, ...over,
  };
}

export interface World {
  series: ReturnType<typeof series>[];
  occs: Record<string, Occ[]>;
  seriesVersion: number;
  command: (fn: string, env: Record<string, unknown>) => { data: unknown; error: unknown };
}

export function defaultWorld(): World {
  const occs: Record<string, Occ[]> = {
    [A]: occsA(),
    [B]: [{ id: 'ob', date: day(5), status: 'scheduled', version: 3 }],
    [DRAFT]: [],
    [PAUSED]: [{ id: 'op', date: day(4), status: 'scheduled', version: 1 }],
    [EMPTY]: [],
  };
  return {
    occs,
    seriesVersion: 9,
    series: [
      series(A, 'Friday Social', occs[A]),
      series(B, 'Sunday Class', occs[B]),
      series(DRAFT, 'Old Draft', occs[DRAFT], { lifecycle_status: 'draft' }),
      series(PAUSED, 'Paused Night', occs[PAUSED], { lifecycle_status: 'paused' }),
    ],
    command: () => ({ data: { ok: true, new_version: 99, data: { occurrence_id: NEW_OCC } }, error: null }),
  };
}

export function home(w: World) {
  return {
    today: today(),
    organisers: [{ id: 'org1', name: 'Bachata Nights', slug: null, avatar_url: null, city_id: null, lifecycle_status: 'live', role: 'owner', latest_decision: null, series: w.series }],
  };
}

const findOcc = (w: World, id: string) => Object.values(w.occs).flat().find((o) => o.id === id);

/** The rpc spy's answers for one world. */
export function answer(rpc: Mock, w: () => World) {
  rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
    const world = w();
    if (fn === 'organiser_home_v1') return { data: home(world), error: null };
    if (fn === 'admin_event_workspace_p5') {
      const id = String(args.p_series_id);
      const s = world.series.find((x) => x.id === id);
      return {
        data: {
          series: { series: { id, name: s?.name ?? '', lifecycle_status: s?.lifecycle_status ?? 'live', version: world.seriesVersion, default_local_start_time: '20:00:00', default_start_date: '2026-01-01' }, program: [] },
          occurrences: (world.occs[id] ?? []).map((o) => ({ id: o.id, occurrence_date: o.date, lifecycle_status: o.status, version: o.version, materialised_start_utc: `${o.date}T20:00:00Z` })),
        },
        error: null,
      };
    }
    if (fn === 'event_view_p5') {
      const id = String((args.p_target as { occurrence_id: string }).occurrence_id);
      const o = findOcc(world, id) ?? { id, date: day(7), status: 'scheduled', version: 1 };
      return {
        data: { occurrence: { id, date: o.date, version: o.version, lifecycle_status: o.status, materialised_start_utc: `${o.date}T20:00:00Z` }, event: {}, schedule: { local_start_time: '20:00:00' } },
        error: null,
      };
    }
    if (fn === 'series_command_p5' || fn === 'occurrence_command_p5') return world.command(fn, args.p_envelope as Record<string, unknown>);
    return { data: null, error: null };
  });
}

export const commandsOf = (rpc: Mock) =>
  rpc.mock.calls
    .filter(([fn]) => fn === 'series_command_p5' || fn === 'occurrence_command_p5')
    .map(([fn, args]) => ({ fn: fn as string, env: (args as { p_envelope: Record<string, unknown> }).p_envelope as {
      target_id: string; expected_version?: number; idempotency_key: string; command: { kind: string; payload: Record<string, unknown> };
    } }));

/** Only Date is faked, so a real timeout lets a pending send reach the spy. */
export const flush = () => new Promise((r) => setTimeout(r, 50));

export function Where() {
  return <p data-testid="where">{useLocation().pathname}{useLocation().search}</p>;
}
export function DoneProbe() {
  const state = readDoneState(useLocation().state);
  return <p data-testid="done-probe">{state?.title}|{state?.message}|{state?.next ?? ''}</p>;
}

export function mount(path: string, routes: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          {routes}
          <Route path="*" element={<p data-testid="elsewhere" />} />
        </Routes>
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Every control at least 44px: the class carries an explicit px height of 44 or more. */
export function tooSmall(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll('button, a, input, [role="button"]'))
    .filter((el) => {
      const sizes = Array.from(el.className.toString().matchAll(/(?:min-h|h)-\[(\d+)px\]/g)).map((m) => Number(m[1]));
      return !sizes.some((n) => n >= 44);
    })
    .map((el) => el.outerHTML.slice(0, 120));
}

/** eventState.ts line 75's sentence, read off the file (the C34 refusal, verbatim). */
export function line75(read: (p: string) => string): string {
  const line = read('src/modules/organiser/shared/eventState.ts').split(/\r?\n/)[74];
  const m = line.match(/'([^']+)'/);
  if (!m) throw new Error(`eventState.ts:75 has no sentence: ${line}`);
  return m[1];
}
