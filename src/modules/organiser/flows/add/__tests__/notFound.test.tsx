// @vitest-environment jsdom
/**
 * ER-S1 red-first: "Add a date: Not found" on a series with 0 dates (a draft).
 * The screens looked the series up only in organiser_home_v1's list, so a series
 * the home read did not carry read "Not found" although the workspace read
 * (the caller IS a member) holds it. Archived / no access / gone are now told apart.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { Route } from 'react-router-dom';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

import AddFlow from '../index';
import { answer, DRAFT, FROZEN, defaultWorld, mount, type World } from './fixtures';

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

const routes = <Route path="/account/o/add/:seriesId" element={<AddFlow step="day" />} />;
const path = (id: string) => `/account/o/add/${id}`;

describe('Add a date: a series with 0 dates', () => {
  it('a draft with 0 dates in the home list shows its days', async () => {
    mount(path(DRAFT), routes);
    expect(await screen.findByTestId('add-which-day')).toBeTruthy();
    expect(screen.queryByText('Not found')).toBeNull();
  });

  it('a draft with 0 dates the home read left out is found through the workspace read', async () => {
    world.series = world.series.filter((s) => s.id !== DRAFT);
    mount(path(DRAFT), routes);
    expect(await screen.findByTestId('add-which-day')).toBeTruthy();
    expect(screen.queryByText('Not found')).toBeNull();
  });
});

// ER-FIX-W1 C3-1 red-first: the REAL server reply for an unknown id is
// P0001 `series_not_found: <id>` (_assert_can_edit_series_p5). Before the fix
// the screens read it as a network failure ("Did not load").
const GONE = 'dddddddd-0000-4000-8000-00000000dead';
const timeRoutes = <Route path="/account/o/add/:seriesId/:date" element={<AddFlow step="time" />} />;
function serverSaysGone() {
  const real = rpc.getMockImplementation()!;
  rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) =>
    fn === 'admin_event_workspace_p5' && args.p_series_id === GONE
      ? { data: null, error: { code: 'P0001', message: `series_not_found: ${GONE}` } }
      : real(fn, args));
}

describe('Add a date: an id the server does not know', () => {
  it.each([
    ['Which day', path(GONE), routes],
    ['Time', `${path(GONE)}/2026-10-30`, timeRoutes],
  ])('%s shows Event not found, not Did not load', async (_n, url, r) => {
    serverSaysGone();
    mount(url, r);
    expect(await screen.findByText('Event not found')).toBeTruthy();
    expect(screen.queryByText(/Did not load/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Try again/ })).toBeNull();
  });
});
