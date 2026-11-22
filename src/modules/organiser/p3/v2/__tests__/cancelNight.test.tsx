// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { EventWorkspace } from '../../../events/eventModel';

const net = vi.hoisted(() => ({ series: vi.fn(), occ: vi.fn(), detail: vi.fn() }));
vi.mock('../../../shared/runCommands', () => ({
  eventWorkspaceQueryKey: (id: string) => ['ws', id],
  useSendOnce: () => (c: unknown, v: number | null, k: string) => net.series(c, v, k),
}));
vi.mock('../../../shared/selfServeApi', () => ({
  dateDetailQueryKey: (id: string) => ['d', id],
  occurrenceProgrammeQueryKey: (id: string) => ['p', id],
  runOccurrenceCommand: (env: unknown) => net.occ(env),
  saveOccurrenceProgramme: vi.fn(),
  fetchDateDetail: (id: string) => net.detail(id),
  fetchCancellationReasons: async () => [{ key: 'a', label: 'Bad weather' }, { key: 'v', label: 'venue not available' }],
}));
vi.mock('../../../shared/publicVenues', () => ({ useVenueOptions: () => ({ data: [{ id: 'v1', name: 'Club Uno', neighbourhood: 'Soho', city_name: 'London' }] }) }));
vi.mock('@/modules/organiser/shared/publicCache', () => ({ invalidatePublicEventCaches: () => undefined }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...((await orig()) as object), londonTodayKey: () => '2026-11-22' }));
import { EditorV2 } from '../EditorV2';
import { SoldWarning, venueReasonLabel } from '../CancelNight';
import { V2 } from '../copy';

const date = (extra: Record<string, unknown> = {}) => ({ id: 'o1', occurrence_date: '2026-11-26', version: 3, lifecycle_status: 'scheduled', has_override: false, override_keys: [], session_overrides_count: 0, added_sessions_count: 0, ...extra });
const ws = (d: unknown, s: Record<string, unknown> = {}) => ({ series: { id: 's1', version: 7, format: 'recurring', name: 'Thursdays', lifecycle_status: 'live', default_venue_id: 'v1', default_description: null, default_cover_image_url: null, default_ticket_url: null, default_local_start_time: '19:30', passes: null, ...s }, dates: [d] }) as unknown as EventWorkspace;
const at = (w: EventWorkspace) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={['/e']}><EditorV2 ws={w} /></MemoryRouter>
  </QueryClientProvider>);
beforeEach(() => {
  net.series.mockReset().mockResolvedValue({ ok: true, new_version: 8 });
  net.occ.mockReset().mockResolvedValue({ ok: true, new_version: 4 });
  net.detail.mockReset().mockResolvedValue({ start: '19:30', end: '00:00', venueId: 'v1', cancellationReason: 'Bad weather', venueOverride: null, descriptionOverride: null, coverImageOverride: null, ticketUrlOverride: null, titleOverride: null, passesOverride: null, coverImageUrl: null, ticketUrl: null });
  window.scrollTo = vi.fn() as never;
});
afterEach(cleanup);

describe('cancel a night: buttons', () => {
  it('live night: red button and line', () => {
    at(ws(date()));
    expect(screen.getByTestId('cancel-open').textContent).toBe('Cancel this night');
    expect(screen.getByText('Dancers see it as cancelled.')).toBeTruthy();
    expect(screen.queryByTestId('bring-open')).toBeNull();
  });
  it('cancelled night: Bring this night back and the reason', async () => {
    at(ws(date({ lifecycle_status: 'cancelled' })));
    expect(screen.getByTestId('bring-open').textContent).toBe('Bring this night back');
    expect(screen.queryByTestId('cancel-open')).toBeNull();
    await waitFor(() => expect(screen.getByText('Cancelled. Reason: Bad weather.')).toBeTruthy());
  });
  it('whole event cancelled: a line and no button', () => {
    at(ws(date(), { lifecycle_status: 'cancelled' }));
    expect(screen.getByText('The whole event is cancelled.')).toBeTruthy();
    expect(screen.queryByTestId('cancel-open')).toBeNull();
    expect(screen.queryByTestId('bring-open')).toBeNull();
  });
});

describe('cancel sheet', () => {
  it('copy, default radio, venue label matched case-insensitively', async () => {
    at(ws(date()));
    fireEvent.click(screen.getByTestId('cancel-open'));
    expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe('Cancel Thursday 26 November?');
    expect(screen.getByText('Dancers see this night as cancelled, with your reason.')).toBeTruthy();
    expect(screen.getByText('This takes effect straight away.')).toBeTruthy();
    expect((screen.getByLabelText('Venue not available') as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByTestId('cancel-sold')).toBeNull();
    await waitFor(() => expect((screen.getByTestId('cancel-go') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('cancel-go'));
    await waitFor(() => expect(net.occ).toHaveBeenCalled());
    expect(JSON.stringify(net.occ.mock.calls[0][0])).toContain('"reason":"venue not available"');
    await waitFor(() => expect(screen.getByTestId('v2-toast').textContent).toContain('Cancelled Thursday 26 November'));
    expect(screen.getByTestId('v2-toast').textContent).not.toContain('Undo');
    expect(screen.queryByTestId('v2-sheet')).toBeNull();
  });
  it('No reason sends an empty reason', async () => {
    at(ws(date()));
    fireEvent.click(screen.getByTestId('cancel-open'));
    fireEvent.click(screen.getByLabelText('No reason'));
    fireEvent.click(screen.getByTestId('cancel-go'));
    await waitFor(() => expect(net.occ).toHaveBeenCalled());
    expect(JSON.stringify(net.occ.mock.calls[0][0])).toContain('"reason":""');
  });
  it('Keep this night saves nothing and closes', () => {
    at(ws(date()));
    fireEvent.click(screen.getByTestId('cancel-open'));
    fireEvent.click(screen.getByTestId('cancel-keep'));
    expect(screen.queryByTestId('v2-sheet')).toBeNull();
    expect(net.occ).not.toHaveBeenCalled();
    expect(net.series).not.toHaveBeenCalled();
  });
  it('a one-off uses series.cancel_one_off', async () => {
    at(ws(date(), { format: 'one_off' }));
    fireEvent.click(screen.getByTestId('cancel-open'));
    await waitFor(() => expect((screen.getByTestId('cancel-go') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('cancel-go'));
    await waitFor(() => expect(net.series).toHaveBeenCalled());
    expect(JSON.stringify(net.series.mock.calls[0][0])).toContain('series.cancel_one_off');
    expect(net.occ).not.toHaveBeenCalled();
  });
  it('both buttons are disabled while the call runs', async () => {
    let done: (v: unknown) => void = () => undefined;
    net.occ.mockReset().mockImplementation(() => new Promise((r) => { done = r; }));
    at(ws(date()));
    fireEvent.click(screen.getByTestId('cancel-open'));
    await waitFor(() => expect((screen.getByTestId('cancel-go') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('cancel-go'));
    await waitFor(() => expect((screen.getByTestId('cancel-keep') as HTMLButtonElement).disabled).toBe(true));
    expect((screen.getByTestId('cancel-go') as HTMLButtonElement).disabled).toBe(true);
    done({ ok: true, new_version: 4 });
    await waitFor(() => expect(screen.queryByTestId('v2-sheet')).toBeNull());
  });
});

describe('bring back', () => {
  it('copy, uncancel, toast without Undo', async () => {
    at(ws(date({ lifecycle_status: 'cancelled' })));
    fireEvent.click(screen.getByTestId('bring-open'));
    expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe('Bring Thursday 26 November back?');
    expect(screen.getByText('Dancers see this night again.')).toBeTruthy();
    fireEvent.click(screen.getByTestId('bring-keep'));
    expect(net.occ).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('bring-open'));
    fireEvent.click(screen.getByTestId('bring-go'));
    await waitFor(() => expect(net.occ).toHaveBeenCalled());
    expect(JSON.stringify(net.occ.mock.calls[0][0])).toContain('"cancelled":false');
    await waitFor(() => expect(screen.getByTestId('v2-toast').textContent).toContain('Brought back Thursday 26 November'));
    expect(screen.getByTestId('v2-toast').textContent).not.toContain('Undo');
  });
});

describe('helpers', () => {
  it('sold warning plural and hidden at 0', () => {
    const { rerender } = render(<SoldWarning soldCount={1} />);
    expect(screen.getByText('1 ticket sold. We will email buyers. Refunds are sorted separately.')).toBeTruthy();
    rerender(<SoldWarning soldCount={2} />);
    expect(screen.getByText('2 tickets sold. We will email buyers. Refunds are sorted separately.')).toBeTruthy();
    rerender(<SoldWarning soldCount={0} />);
    expect(screen.queryByTestId('cancel-sold')).toBeNull();
  });
  it('venue label: match, else first, else none', () => {
    expect(venueReasonLabel(['A', 'VENUE NOT AVAILABLE'])).toEqual({ label: 'VENUE NOT AVAILABLE', exact: true });
    expect(venueReasonLabel(['A', 'B'])).toEqual({ label: 'A', exact: false });
    expect(venueReasonLabel([]).label).toBeNull();
    expect(V2.eventCancelledLine('x')).toBe('The whole event is cancelled. Reason: x.');
  });
});
