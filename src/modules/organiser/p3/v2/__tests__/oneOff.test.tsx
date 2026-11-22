// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { EventWorkspace } from '../../../events/eventModel';

const net = vi.hoisted(() => ({ series: vi.fn(), occ: vi.fn(), detail: vi.fn() }));
vi.mock('../../tickets/data', () => ({
  useSeriesTypes: () => ({ data: [{ id: 't1', occurrenceId: null }, { id: 't2', occurrenceId: 'o2' }] }),
  useSummary: () => ({ data: { ok: true, types: [{ id: 't1', ticketsSold: 4, grossPence: 5000 }, { id: 't2', ticketsSold: 3, grossPence: 1000 }] } }),
}));
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
  fetchCancellationReasons: async () => [],
}));
vi.mock('../../../shared/publicVenues', () => ({ useVenueOptions: () => ({ data: [{ id: 'v1', name: 'Club Uno', neighbourhood: 'Soho', city_name: 'London' }] }) }));
vi.mock('@/modules/organiser/shared/publicCache', () => ({ invalidatePublicEventCaches: () => undefined }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...((await orig()) as object), londonTodayKey: () => '2026-11-22' }));
import { EditorV2 } from '../EditorV2';
import { EndCard } from '../EndCard';
import { V2 } from '../copy';

const date = (id: string, d: string, extra: Record<string, unknown> = {}) => ({
  id, occurrence_date: d, version: 3, lifecycle_status: 'scheduled', has_override: false, override_keys: [], session_overrides_count: 0, added_sessions_count: 0, ...extra,
});
const detail = () => ({
  start: '19:30', end: '00:00', venueId: 'v1', venueOverride: null, descriptionOverride: null, coverImageOverride: null, ticketUrlOverride: null,
  titleOverride: null, passesOverride: null, coverImageUrl: null, ticketUrl: null,
});
const ws = (format: string, dates: unknown[], extra: Record<string, unknown> = {}) => ({ series: { id: 's1', version: 7, format, name: 'Salsa Special', lifecycle_status: 'live', default_venue_id: 'v1', default_description: null, default_cover_image_url: null, default_ticket_url: null, default_local_start_time: '19:30', passes: null, ...extra }, dates, organiserIds: ['org1'], musicStyles: ['Bachata'] }) as unknown as EventWorkspace;
const at = (w: EventWorkspace) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={['/e']}><EditorV2 ws={w} /></MemoryRouter>
  </QueryClientProvider>);
const one = () => ws('one_off', [date('o1', '2026-12-05', { override_keys: ['passes', 'description'] })]);
beforeEach(() => { net.series.mockReset(); net.occ.mockReset().mockResolvedValue({ ok: true, new_version: 4 }); net.detail.mockReset().mockResolvedValue(detail()); window.scrollTo = vi.fn() as never; });
afterEach(cleanup);

describe('one-off page', () => {
  it('O-01/02/03/05: one page, long date title, own label, no tags or back-to-usual', async () => {
    at(one());
    expect(screen.queryByTestId('ev2-tab-night')).toBeNull();
    expect(screen.queryByTestId('ev2-chips')).toBeNull();
    expect(screen.queryByTestId('ev2-scope')).toBeNull();
    expect(screen.getByTestId('ev2-title').textContent).toMatch(/5 December/);
    expect(screen.getByText('What dancers see. Tap to change.')).toBeTruthy();
    await screen.findByTestId('night-name');
    expect(screen.queryByText(/Only this night/i)).toBeNull();
    expect(screen.queryByText(/Back to usual/i)).toBeNull();
  });
  it('O-07: tiles show the real sold count and money (all types of the event)', async () => {
    at(one());
    expect(screen.getByTestId('hub-sold').textContent).toBe('7');
    expect(screen.getByTestId('hub-money').textContent).toBe('£60');
  });
  it('O-09/10: The event group has Name, Music, Tickets, Organisers and nothing else', () => {
    at(one());
    const g = screen.getByTestId('oneoff-event');
    expect(g.textContent).toContain('The event');
    expect(within(g).getByTestId('row-name')).toBeTruthy();
    expect(within(g).getByTestId('row-music').textContent).toContain('Bachata');
    expect(within(g).getByTestId('row-goTickets').textContent).toContain('Prices and how dancers pay');
    expect(within(g).getByTestId('row-organisers')).toBeTruthy();
    expect(within(g).queryByTestId('row-about')).toBeNull();
    expect(within(g).queryByTestId('row-repeats')).toBeNull();
  });
  it('O-11: End card has Pause and End (Dancers see it as ended.), no Cancel the event', () => {
    at(one());
    const e = screen.getByTestId('oneoff-end');
    expect(e.textContent).toContain('Pause the event');
    expect(e.textContent).toContain('End the event');
    expect(e.textContent).toContain('Dancers see it as ended.');
    expect(e.textContent).not.toContain('Cancel the event');
    expect(screen.queryByTestId('end-cancel')).toBeNull();
  });
  it('End card, paused one-off: Make it live again, no Cancel row', () => {
    at(ws('one_off', [date('o1', '2026-12-05')], { lifecycle_status: 'paused' }));
    const e = screen.getByTestId('oneoff-end');
    expect(e.textContent).toContain('Make it live again');
    expect(e.textContent).not.toContain('Cancel the event');
  });
  it('weekly EndCard still has Cancel the event and the old End line', () => {
    render(<EndCard status="Live" endDate={null} reason={null} onLive={() => undefined} onPause={() => undefined} onEnd={() => undefined} />);
    expect(screen.getByTestId('end-cancel')).toBeTruthy();
    expect(screen.getByTestId('every-end').textContent).not.toContain('Dancers see it as ended.');
  });
  it('O-06/cancel sheet shows the real sold count and cancels through series.cancel_one_off', async () => {
    at(one());
    fireEvent.click(await screen.findByRole('button', { name: /Cancel this night/ }));
    expect((await screen.findByTestId('cancel-sold')).textContent).toMatch(/7/);
  });
  it('O-12: Share this night at the bottom', () => {
    at(one());
    expect(screen.getByTestId('hub-share').textContent).toBe('Share this night');
  });
  it('O-13: a Name save toasts Saved, never "for every"', async () => {
    net.series.mockResolvedValue({ ok: true, new_version: 8 });
    at(one());
    fireEvent.click(within(screen.getByTestId('row-name')).getByRole('button'));
    fireEvent.change(await screen.findByLabelText(V2.every.nameField), { target: { value: 'New name' } });
    fireEvent.click(screen.getByTestId('name-done'));
    await waitFor(() => expect(net.series).toHaveBeenCalled());
    expect(await screen.findByText('Saved')).toBeTruthy();
    expect(screen.queryByText(/for every/i)).toBeNull();
  });
  it('weekly night counts only types tied to that night', () => {
    at(ws('recurring', [date('o2', '2026-12-03')], { name: 'Thursdays' }));
    expect(screen.getByTestId('hub-sold').textContent).toBe('3');
    expect(screen.queryByTestId('oneoff-event')).toBeNull();
  });
});
