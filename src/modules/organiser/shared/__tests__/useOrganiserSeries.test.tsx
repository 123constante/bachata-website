// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

import { resolveSeries, useOrganiserSeries } from '../useOrganiserSeries';
import { parseWorkspace } from '../seriesModel';

const ID = 'cccccccc-0000-4000-8000-000000000003';
const series = (over: Record<string, unknown> = {}) => ({
  id: ID, name: 'Draft', slug: null, format: 'recurring', category: null, lifecycle_status: 'draft', default_local_start_time: null,
  default_cover_image_url: null, created_at: '2026-10-01T00:00:00Z', upcoming_count: 0, cancelled_upcoming_count: 0, next_dates: [], latest_decision: null, ...over,
});
const homeWith = (list: unknown[]) => ({ today: '2026-10-21', organisers: [{ id: 'o1', name: 'N', series: list }] });
const workspace = (s: Record<string, unknown> | null) => ({ series: { series: s ?? {}, program: [] }, occurrences: [] });

let homeData: unknown;
let wsAnswer: () => { data: unknown; error: unknown };
beforeEach(() => {
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string) => (fn === 'organiser_home_v1' ? { data: homeData, error: null } : wsAnswer()));
});
afterEach(cleanup);

function Probe() {
  const r = useOrganiserSeries(ID);
  return <p data-testid="s">{r.state}{r.state === 'found' ? `:${r.series.lifecycle_status}:${r.series.upcoming_count}` : ''}</p>;
}
const show = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Probe /></QueryClientProvider>,
);
const state = () => screen.findByTestId('s').then((el) => el.textContent);

describe('useOrganiserSeries states', () => {
  it('loading, then found for a draft with 0 dates that home lists', async () => {
    homeData = homeWith([series()]);
    wsAnswer = () => ({ data: null, error: null });
    show();
    expect(await state()).toBe('loading');
    await waitFor(() => expect(screen.getByTestId('s').textContent).toBe('found:draft:0'));
    expect(rpc.mock.calls.some(([fn]) => fn === 'admin_event_workspace_p5')).toBe(false);
  });
  it('found through the workspace when home does not carry the series (0 dates)', async () => {
    homeData = homeWith([]);
    wsAnswer = () => ({ data: workspace({ id: ID, name: 'Draft', lifecycle_status: 'draft', version: 1 }), error: null });
    show();
    await waitFor(() => expect(screen.getByTestId('s').textContent).toBe('found:draft:0'));
  });
  it('not-found-archived when the workspace says archived', async () => {
    homeData = homeWith([]);
    wsAnswer = () => ({ data: workspace({ id: ID, name: 'Old', lifecycle_status: 'archived', version: 1 }), error: null });
    show();
    await waitFor(() => expect(screen.getByTestId('s').textContent).toBe('not-found-archived'));
  });
  it('not-found-archived when home itself carries it archived', async () => {
    homeData = homeWith([series({ lifecycle_status: 'archived' })]);
    wsAnswer = () => ({ data: null, error: null });
    show();
    await waitFor(() => expect(screen.getByTestId('s').textContent).toBe('not-found-archived'));
    expect(rpc.mock.calls.some(([fn]) => fn === 'admin_event_workspace_p5')).toBe(false);
  });
  it('no-access when the server refuses the member check', async () => {
    homeData = homeWith([]);
    wsAnswer = () => ({ data: null, error: { message: 'permission_denied: not a member' } });
    show();
    await waitFor(() => expect(screen.getByTestId('s').textContent).toBe('no-access'));
  });
  it('gone when the workspace has no such series', async () => {
    homeData = homeWith([]);
    wsAnswer = () => ({ data: workspace(null), error: null });
    show();
    await waitFor(() => expect(screen.getByTestId('s').textContent).toBe('gone'));
  });
  it('gone for the REAL server reply to an unknown id (P0001 series_not_found: <id>)', async () => {
    homeData = homeWith([]);
    wsAnswer = () => ({ data: null, error: { code: 'P0001', message: `series_not_found: ${ID}` } });
    show();
    await waitFor(() => expect(screen.getByTestId('s').textContent).toBe('gone'));
  });
  it('error (not "Not found") when the read fails for another reason', async () => {
    homeData = homeWith([]);
    wsAnswer = () => ({ data: null, error: { message: 'network down' } });
    show();
    await waitFor(() => expect(screen.getByTestId('s').textContent).toBe('error'));
  });
});

describe('resolveSeries (pure)', () => {
  const noWs = { enabled: false, isError: false };
  it('home failing is an error with a retry, home pending is loading', () => {
    const retry = vi.fn();
    expect(resolveSeries({ isError: true }, noWs, ID, retry)).toEqual({ state: 'error', retry });
    expect(resolveSeries({ isError: false }, noWs, ID, retry)).toEqual({ state: 'loading' });
  });
  it('a series home does not carry and no workspace read is gone', () => {
    expect(resolveSeries({ isError: false, data: homeWith([]) as never }, noWs, ID, vi.fn())).toEqual({ state: 'gone' });
  });
  it('builds coming counts from the workspace dates', () => {
    const ws = parseWorkspace({
      series: { series: { id: ID, name: 'D', lifecycle_status: 'live' } },
      occurrences: [
        { id: 'a', occurrence_date: '2026-10-20', lifecycle_status: 'scheduled' },
        { id: 'b', occurrence_date: '2026-10-25', lifecycle_status: 'scheduled' },
        { id: 'c', occurrence_date: '2026-10-26', lifecycle_status: 'cancelled' },
      ],
    });
    const r = resolveSeries({ isError: false, data: homeWith([]) as never }, { enabled: true, isError: false, data: ws }, ID, vi.fn());
    expect(r.state === 'found' && [r.series.upcoming_count, r.series.cancelled_upcoming_count]).toEqual([1, 1]);
  });
});
