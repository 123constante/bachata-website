// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { addDaysToKey } from '@/lib/londonDate';
import { REASONS } from './cancelFixtures';
import { SHAPES, TODAY, occ, weekly, wsRaw } from './wsFixtures';

/*
 * p3-dates-fix-1. W-31: a series over the read's page of 100 can reach EVERY date (the server pages:
 * admin_event_workspace_p5 p_before / next_before, proven on prod 2026-11-04). W-35: a save refused as
 * version_conflict holds Save with a reason and offers "Start again", which re-reads the date.
 * The rule each cell checks: no dead end, a reachable next action in every state.
 */

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, auth: {}, from: vi.fn() } }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-25' }));
vi.mock('../../../shared/selfServeApi', async (orig) => ({
  ...(await orig<typeof import('../../../shared/selfServeApi')>()),
  fetchCancellationReasons: async () => REASONS,
}));
vi.mock('../../../shared/publicVenues', async (orig) => ({
  ...(await orig<typeof import('../../../shared/publicVenues')>()),
  useVenueOptions: () => ({ isPending: false, isError: false, data: [] }),
}));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ isPending: true, data: undefined }) }));

import { AllDatesScreen } from '../AllDatesScreen';

afterEach(cleanup);

type Env = Record<string, unknown>;
let all: string[];
let ver: number;
let detail: Env;
let sent: Env[];
let failNext: unknown;
let olderFails: number;
const calls = (name: string) => rpc.mock.calls.filter((c) => c[0] === name);

/** n weekly dates whose newest 30 are coming up: the shape of a long-running weekly social. */
const series = (n: number) => weekly(addDaysToKey(TODAY, -(n - 30) * 7 + 5), n);

/** The live function's paging, as read from pg_proc: newest first, before p_before, LIMIT p_limit ?? 100. */
function page(before: string | null, limit: number | null): Env {
  const lim = limit ?? 100;
  const rest = all.filter((d) => !before || d < before).sort().reverse();
  const got = rest.slice(0, lim);
  const more = rest.length > lim;
  return wsRaw({}, (SHAPES.weekly as { series: { program: unknown } }).series.program, got.map((d) => occ(d, 'scheduled', { version: ver })),
    { has_more: more, total: all.length, next_before: more ? got[got.length - 1] : null, before, limit: lim });
}

beforeEach(() => {
  all = series(10);
  ver = 3;
  detail = {};
  sent = [];
  failNext = null;
  olderFails = 0;
  rpc.mockReset();
  rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    if (name === 'admin_event_workspace_p5') {
      const before = (args.p_before as string | undefined) ?? null;
      if (before && olderFails > 0) { olderFails--; throw new TypeError('Failed to fetch'); }
      return { data: page(before, (args.p_limit as number | undefined) ?? null), error: null };
    }
    if (name === 'event_view_p5') {
      const id = (args.p_target as { occurrence_id: string }).occurrence_id;
      return { data: { event: { ...detail }, occurrence: { id, date: id.slice(2), version: ver, lifecycle_status: 'scheduled', materialised_start_utc: null }, schedule: {} }, error: null };
    }
    if (name === 'occurrence_command_p5' || name === 'series_command_p5') {
      sent.push(args.p_envelope as Env);
      if (failNext) { const f = failNext; failNext = null; if (f instanceof Error) throw f; return { data: null, error: f }; }
      return { data: { ok: true, new_version: ver + 1 }, error: null };
    }
    return { data: null, error: null };
  });
});

function show() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/account/p3/events/ser-1/dates']}>
        <Routes><Route path="/account/p3/events/:seriesId/dates" element={<AllDatesScreen />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const count = (k: string) => Number(screen.getByTestId(`p3-filter-${k}`).querySelector('.p3-num')?.textContent);
const older = () => screen.queryByTestId('p3-load-older') as HTMLButtonElement | null;

/** Rows the list shows on a tab (the tab counts are whole-series meta, so they cannot prove a row is reachable). */
function listed(k: string): number {
  fireEvent.click(screen.getByTestId(`p3-filter-${k}`));
  return screen.queryAllByTestId('p3-date-row').length;
}

const SIZES = [0, 1, 99, 100, 101, 132, 500];
const TABS = ['coming', 'past', 'cancelled', 'breaks', 'own'] as const;

/*
 * After the main merge (#1218, F-27) these cells drive MAIN's control: "Load older dates"
 * (p3-load-older), one tap reads every older page (p_limit 200). They were all green on main
 * before this branch's W-31 code was dropped; this branch keeps no paging code of its own.
 */
describe('W-31: every date of a long series is reachable, on every tab', () => {
  for (const n of SIZES) {
    for (const tab of TABS) {
      it(`${n} dates, ${tab} tab: nothing hidden, or a way to the hidden dates`, async () => {
        all = series(n);
        show();
        await waitFor(() => screen.getByTestId('p3-all-dates-screen'));
        fireEvent.click(screen.getByTestId(`p3-filter-${tab}`));
        if (n > 100) {
          // a way to the rest on this tab, and the line naming how many are hidden
          await waitFor(() => expect(older()).not.toBeNull());
          expect(screen.getByTestId('p3-partial').textContent).toMatch(new RegExp(`newest 100 of ${n} dates`));
          expect(older()!.disabled).toBe(false);
          fireEvent.click(older()!);
          await waitFor(() => expect(older()).toBeNull(), { timeout: 5000 });
        }
        // every date is now LISTED (rows, not the whole-series meta counts), and nothing says otherwise
        expect(count('coming') + count('past')).toBe(n);
        expect(listed('coming') + listed('past')).toBe(n);
        expect(screen.queryByTestId('p3-partial')?.textContent ?? null).toBeNull();
        expect(older()).toBeNull();
        // an older read asks for dates BEFORE the oldest one already held
        for (const c of calls('admin_event_workspace_p5').slice(1)) expect(c[1]).toMatchObject({ p_series_id: 'ser-1', p_limit: 200 });
      }, 20000);
    }
  }

  it('132 dates: the oldest date, reached through Load older, opens its date sheet', async () => {
    all = series(132);
    show();
    await waitFor(() => expect(older()).not.toBeNull());
    fireEvent.click(older()!);
    await waitFor(() => expect(older()).toBeNull());
    fireEvent.click(screen.getByTestId('p3-filter-past'));
    const rows = screen.getAllByTestId('p3-date-row');
    fireEvent.click(rows[rows.length - 1].querySelector('button')!);
    await waitFor(() => screen.getByTestId('p3-date-actions'));
    const views = calls('event_view_p5');
    expect(views[views.length - 1][1]).toMatchObject({ p_target: { occurrence_id: `o-${all[0]}` } });
  });

  it('older dates that fail to load say so, and Try again loads them', async () => {
    all = series(132);
    olderFails = 1;
    show();
    await waitFor(() => expect(older()).not.toBeNull());
    fireEvent.click(older()!);
    await waitFor(() => screen.getByTestId('p3-older-error'));
    expect(screen.getByTestId('p3-older-error').textContent).toMatch(/didn.t load/);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(listed('coming') + listed('past')).toBe(132));
    expect(older()).toBeNull();
  });
});

// ---- W-35 ------------------------------------------------------------------------------

const save = () => screen.getByTestId('p3-own-save') as HTMLButtonElement;
const nameBox = () => screen.getByTestId('p3-own-name-text') as HTMLInputElement;

async function openName() {
  show();
  await waitFor(() => screen.getAllByTestId('p3-date-row'));
  fireEvent.click(screen.getAllByTestId('p3-date-row')[0].querySelector('button')!);
  await waitFor(() => screen.getByTestId('p3-date-actions'));
  fireEvent.click(screen.getByTestId('p3-date-act-details'));
  await waitFor(() => screen.getByTestId('p3-own-name-edit'));
  fireEvent.click(screen.getByTestId('p3-own-name-edit'));
  fireEvent.change(nameBox(), { target: { value: 'Mine' } });
}

const OUTCOMES = {
  ok: null,
  refused: { message: 'invalid_input: title too long', code: 'P0001' },
  offline: new TypeError('Failed to fetch'),
  conflict: { message: 'version_conflict: expected 3, got 4', code: 'P0001' },
} as const;

describe('W-35: every save outcome of a date field has a next action', () => {
  for (const [k, f] of Object.entries(OUTCOMES)) {
    it(`${k}`, async () => {
      await openName();
      failNext = f;
      fireEvent.click(save());
      if (k === 'ok') {
        await waitFor(() => screen.getByTestId('p3-toast'));
        return;
      }
      await waitFor(() => screen.getByTestId('p3-sheet-error'));
      expect(nameBox().value).toBe('Mine');
      if (k === 'conflict') {
        // Save is held while the conflict stands, and says why; Start again is the way on
        expect(save().disabled).toBe(true);
        expect(screen.getByTestId('p3-conflict-why').textContent).toMatch(/Start again/);
        expect((screen.getByTestId('p3-start-again') as HTMLButtonElement).disabled).toBe(false);
      } else {
        // fix it, or send the same thing again: Save is the next action
        expect(save().disabled).toBe(false);
        expect(screen.queryByTestId('p3-start-again')).toBeNull();
      }
    });
  }

  it('conflict -> Start again re-reads the date, shows the other change, offers mine back, then saves at the new version', async () => {
    await openName();
    failNext = OUTCOMES.conflict;
    fireEvent.click(save());
    await waitFor(() => screen.getByTestId('p3-start-again'));
    await new Promise((r) => setTimeout(r, 30));
    // someone else's change is on the server now; only a fresh read can show it
    detail = { title_override: 'Theirs' };
    ver = 5;
    const views = calls('event_view_p5').length;
    const reads = calls('admin_event_workspace_p5').length;
    fireEvent.click(screen.getByTestId('p3-start-again'));
    await waitFor(() => expect(nameBox().value).toBe('Theirs'));
    expect(calls('event_view_p5').length).toBeGreaterThan(views);
    expect(calls('admin_event_workspace_p5').length).toBeGreaterThan(reads);
    expect(screen.queryByTestId('p3-sheet-error')).toBeNull();
    expect(screen.queryByTestId('p3-start-again')).toBeNull();
    expect(screen.getByTestId('p3-kept-offer').textContent).toMatch(/not saved/);
    fireEvent.click(screen.getByTestId('p3-kept-put'));
    expect(nameBox().value).toBe('Mine');
    expect(screen.queryByTestId('p3-kept-offer')).toBeNull();
    expect(save().disabled).toBe(false);
    sent = [];
    fireEvent.click(save());
    await waitFor(() => screen.getByTestId('p3-toast'));
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ expected_version: 5, command: { kind: 'occurrence.set_override', payload: { title: 'Mine' } } });
  });

  it('conflict -> Start again -> Drop my changes keeps their value and sends nothing', async () => {
    await openName();
    failNext = OUTCOMES.conflict;
    fireEvent.click(save());
    await waitFor(() => screen.getByTestId('p3-start-again'));
    detail = { title_override: 'Theirs' };
    ver = 5;
    fireEvent.click(screen.getByTestId('p3-start-again'));
    await waitFor(() => screen.getByTestId('p3-kept-drop'));
    fireEvent.click(screen.getByTestId('p3-kept-drop'));
    expect(nameBox().value).toBe('Theirs');
    expect(screen.queryByTestId('p3-kept-offer')).toBeNull();
    expect(save().disabled).toBe(true);
  });

  it('conflict on the About sheet: Save held, Start again shows the new text', async () => {
    show();
    await waitFor(() => screen.getAllByTestId('p3-date-row'));
    fireEvent.click(screen.getAllByTestId('p3-date-row')[0].querySelector('button')!);
    await waitFor(() => screen.getByTestId('p3-date-actions'));
    fireEvent.click(screen.getByTestId('p3-date-act-details'));
    await waitFor(() => screen.getByTestId('p3-own-about-edit'));
    fireEvent.click(screen.getByTestId('p3-own-about-edit'));
    fireEvent.change(screen.getByTestId('p3-own-text'), { target: { value: 'My words' } });
    failNext = OUTCOMES.conflict;
    fireEvent.click(save());
    await waitFor(() => screen.getByTestId('p3-start-again'));
    expect(save().disabled).toBe(true);
    detail = { description_override: 'Their words' };
    fireEvent.click(screen.getByTestId('p3-start-again'));
    await waitFor(() => expect((screen.getByTestId('p3-own-text') as HTMLTextAreaElement).value).toBe('Their words'));
    fireEvent.click(screen.getByTestId('p3-kept-put'));
    expect((screen.getByTestId('p3-own-text') as HTMLTextAreaElement).value).toBe('My words');
  });
});
