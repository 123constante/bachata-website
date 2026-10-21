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
