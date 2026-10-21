// @vitest-environment jsdom
/**
 * The Coming dates card never contradicts itself (RELEASE-A-WEB fix pass,
 * orchestrator finding on golive-three-new-codes.png): it once read "1 more"
 * directly above "No coming dates". The listed rows came from Home
 * (organiser_home_v1 next_dates) while the count came from the workspace read,
 * so when Home listed none (a draft Home holds with no next_dates, or Home not
 * yet refetched after a date was added) the count had no list above it.
 * One rule now: the rows and the count come from the same dates.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { Route } from 'react-router-dom';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc, from: () => ({ select: () => ({ is: () => ({ order: async () => ({ data: [], error: null }) }) }) }) },
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

import OneEvent from '../OneEvent';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { comingCard, parseEventWorkspace } from '../eventModel';
import { DRAFT, FROZEN, answer, day, defaultWorld, mount, series, today, type Occ, type World } from '@/modules/organiser/flows/add/__tests__/fixtures';
import type { HomeSeriesFull } from '@/modules/organiser/shared/homeModel';

let world: World;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FROZEN);
  rpc.mockReset();
  world = defaultWorld();
  answer(rpc, () => world);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const routes = <Route path="/account/o/events/:seriesId" element={<OneEvent />} />;
const coming = (id: string, n: number): Occ => ({ id, date: day(n), status: 'scheduled', version: 1 });
const past = (id: string, n: number): Occ => ({ id, date: day(-n), status: 'scheduled', version: 1 });
const cancelledComing = (id: string, n: number): Occ => ({ id, date: day(n), status: 'cancelled', version: 1 });

/** The workspace holds `ws`; Home lists the draft with `homeOccs` (its next_dates). */
function draftWith(ws: Occ[], homeOccs: Occ[]) {
  world.occs[DRAFT] = ws;
  world.series[2] = series(DRAFT, 'Old Draft', homeOccs, { lifecycle_status: 'draft' });
}

async function card() {
  const el = await screen.findByTestId('org-coming');
  await waitFor(() => expect(rpc.mock.calls.some(([fn]) => fn === 'admin_event_workspace_p5')).toBe(true));
  await waitFor(() => expect(el.querySelector('[data-testid="org-coming-date"], [data-testid="org-coming-none"]')).not.toBeNull());
  return {
    rows: el.querySelectorAll('[data-testid="org-coming-date"]').length,
    more: el.querySelector('[data-testid="org-coming-more"]')?.textContent ?? null,
    none: el.querySelector('[data-testid="org-coming-none"]') !== null,
  };
}

describe('Coming dates card: rows and count from the same dates (one event screen)', () => {
  const rows: Array<{ name: string; ws: Occ[]; home: Occ[]; expect: { rows: number; more: string | null; none: boolean } }> = [
    { name: 'Home lists none, the workspace holds 1 coming date (the screenshot)', ws: [coming('c1', 3)], home: [],
      expect: { rows: 1, more: null, none: false } },
    { name: '0 coming dates + 1 past date', ws: [past('p1', 4)], home: [], expect: { rows: 0, more: null, none: true } },
    { name: '0 coming dates + 1 cancelled coming date', ws: [cancelledComing('x1', 4)], home: [], expect: { rows: 0, more: null, none: true } },
    { name: '0 coming dates + 1 past + 1 cancelled', ws: [past('p1', 4), cancelledComing('x1', 4)], home: [], expect: { rows: 0, more: null, none: true } },
    { name: 'Home lists 3 of 5 coming dates', ws: [1, 2, 3, 4, 5].map((n) => coming(`c${n}`, n * 7)), home: [1, 2, 3, 4, 5].map((n) => coming(`c${n}`, n * 7)),
      expect: { rows: 3, more: '2 more', none: false } },
    { name: 'Home lists none, the workspace holds 2 coming + 1 past', ws: [past('p1', 3), coming('c1', 2), coming('c2', 9)], home: [],
      expect: { rows: 2, more: null, none: false } },
  ];

  for (const r of rows) {
    it(r.name, async () => {
      draftWith(r.ws, r.home);
      mount(ORG_PATHS.event(DRAFT), routes);
      const got = await card();
      expect(got).toEqual(r.expect);
      // The invariant: never "N more" without a list above it, never "N more" beside "No coming dates".
      if (got.none) expect(got.more).toBeNull();
      if (got.more) expect(got.rows).toBeGreaterThan(0);
    });
  }
});

describe('comingCard (pure): the invariant over shapes', () => {
  const ws = (occs: Occ[], hasMore = false) => parseEventWorkspace({
    series: { series: { id: DRAFT, name: 'Old Draft', lifecycle_status: 'draft', version: 1 }, program: [] },
    occurrences: occs.map((o) => ({ id: o.id, occurrence_date: o.date, lifecycle_status: o.status, version: 1, materialised_start_utc: `${o.date}T19:30:00Z` })),
    meta: { has_more: hasMore },
  });
  const homeRow = (occs: Occ[]) => series(DRAFT, 'Old Draft', occs, { lifecycle_status: 'draft' }) as unknown as HomeSeriesFull;

  it('falls back to the workspace dates, soonest first, with their time', () => {
    const c = comingCard(homeRow([]), ws([coming('c2', 9), past('p1', 2), coming('c1', 2)]), today());
    expect(c.shown.map((d) => d.occurrenceId)).toEqual(['c1', 'c2']);
    expect(c.shown[0].time).toBe('19:30');
    expect(c.more).toBeNull();
  });

  it('no Home row at all (null) behaves the same', () => {
    const c = comingCard(null, ws([coming('c1', 2)]), today());
    expect(c.shown).toHaveLength(1);
    expect(c.more).toBeNull();
  });

  it('nothing coming: no rows, no count', () => {
    expect(comingCard(homeRow([]), ws([past('p1', 2), cancelledComing('x', 3)]), today())).toEqual({ shown: [], more: null });
  });

  it('a full read (100+) with no Home rows still shows no count without rows', () => {
    const full = Array.from({ length: 100 }, (_, i) => coming(`r${i}`, i + 1));
    const c = comingCard(homeRow([]), ws(full, true), today());
    if (c.shown.length === 0) expect(c.more).toBeNull();
  });

  it('workspace not loaded yet: Home rows and Home count stand in', () => {
    const occs = [1, 2, 3, 4].map((n) => coming(`c${n}`, n));
    const c = comingCard(homeRow(occs), undefined, today());
    expect(c.shown).toHaveLength(3);
    expect(c.more).toBe('1 more');
  });
});
