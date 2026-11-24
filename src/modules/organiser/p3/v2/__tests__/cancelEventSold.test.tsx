// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { EventWorkspace } from '../../../events/eventModel';

type Q = { data?: unknown; isSuccess: boolean; isError: boolean; refetch: () => void };
const state: { types: Q; summary: Q } = { types: { isSuccess: false, isError: false, refetch: () => {} }, summary: { isSuccess: false, isError: false, refetch: () => {} } };
vi.mock('../../tickets/data', () => ({ useSeriesTypes: () => state.types, useSummary: () => state.summary }));
vi.mock('../../../shared/publicVenues', () => ({ useVenueOptions: () => ({ data: [], isPending: false }) }));
vi.mock('../../../events/programmeSeriesApi', () => ({ fetchOrganiserPages: async () => [], useSeriesRole: () => ({ role: 'owner', loading: false, myPages: [] }) }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...((await orig()) as object), londonTodayKey: () => '2026-11-22' }));
vi.mock('../../screens/CancelEventSheet', () => ({ useCancelReasons: () => ({ data: [{ key: 'v', label: 'Venue not available' }] }) }));
import { EveryBody } from '../EveryBody';

const RULE = { mode: 'weekly', interval: 1, weekdays: [4], end: { kind: 'none' } };
const d = (id: string, date: string) => ({ id, occurrence_date: date, lifecycle_status: 'scheduled', version: 1, has_override: false, override_keys: [], session_overrides_count: 0, added_sessions_count: 0, materialised_start_utc: null });
const w = {
  series: { id: 's1', version: 7, format: 'recurring', name: 'Thursdays', lifecycle_status: 'live', recurrence_rule: RULE, default_venue_id: null, default_description: null, default_cover_image_url: null, default_ticket_url: null, default_local_start_time: null, default_duration: null, passes: null, default_start_date: '2026-01-01', created_at: null },
  gallery: [], musicStyles: [], organiserIds: ['org1'], endedOn: null, dates: [d('a', '2026-11-26')],
} as unknown as EventWorkspace;

const ready = (sold: number[]) => {
  state.types = { isSuccess: true, isError: false, refetch: () => {}, data: sold.map((_, i) => ({ id: `t${i}` })) };
  state.summary = { isSuccess: true, isError: false, refetch: () => {}, data: { ok: true, types: sold.map((n, i) => ({ id: `t${i}`, ticketsSold: n })) } };
};
const open = () => {
  const save = vi.fn(async () => ({ ok: true, error: null }));
  render(<QueryClientProvider client={new QueryClient()}><EveryBody ws={w} day="Thursday" saveNow={save} /></QueryClientProvider>);
  fireEvent.click(screen.getByTestId('end-cancel').querySelector('button')!);
  return save;
};
afterEach(cleanup);

describe('cancel the event: real sold count', () => {
  it('0 sold: no buyer warning, confirm works', () => {
    ready([0]);
    const save = open();
    expect(screen.queryByTestId('cancel-sold')).toBeNull();
    fireEvent.click(screen.getByTestId('cancele-go'));
    expect(save).toHaveBeenCalledTimes(1);
  });
  it('1 sold (free ticket): warning says 1 ticket', () => {
    ready([1]);
    open();
    expect(screen.getByTestId('cancel-sold').textContent).toBe('1 ticket sold. We will email buyers. Refunds are sorted separately.');
  });
  it('N paid orders across types: warning sums them', () => {
    ready([4, 3, 0]);
    open();
    expect(screen.getByTestId('cancel-sold').textContent).toBe('7 tickets sold. We will email buyers. Refunds are sorted separately.');
  });
  it('loading: confirm disabled and sends nothing', () => {
    state.types = { isSuccess: false, isError: false, refetch: () => {} };
    state.summary = { isSuccess: false, isError: false, refetch: () => {} };
    const save = open();
    const go = screen.getByTestId('cancele-go') as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    fireEvent.click(go);
    expect(save).not.toHaveBeenCalled();
  });
  it('error: message, retry refetches, confirm stays disabled', () => {
    const refetch = vi.fn();
    state.types = { isSuccess: false, isError: true, refetch };
    state.summary = { isSuccess: true, isError: false, refetch, data: { ok: true, types: [] } };
    const save = open();
    expect(screen.getByText('Could not check ticket sales. Try again.')).toBeTruthy();
    expect((screen.getByTestId('cancele-go') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('cancele-sold-retry'));
    expect(refetch).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByTestId('cancele-go'));
    expect(save).not.toHaveBeenCalled();
  });
  it('a refused summary is an error, never zero sold', () => {
    state.types = { isSuccess: true, isError: false, refetch: () => {}, data: [] };
    state.summary = { isSuccess: true, isError: false, refetch: () => {}, data: { ok: false, types: [] } };
    open();
    expect(screen.getByTestId('cancele-sold-error')).toBeTruthy();
    expect((screen.getByTestId('cancele-go') as HTMLButtonElement).disabled).toBe(true);
  });
});
