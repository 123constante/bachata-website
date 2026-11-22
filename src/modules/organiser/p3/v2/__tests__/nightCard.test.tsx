// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
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
}));
vi.mock('../../../shared/publicVenues', () => ({ useVenueOptions: () => ({ data: [{ id: 'v1', name: 'Club Uno', neighbourhood: 'Soho', city_name: 'London' }] }) }));
vi.mock('@/modules/organiser/shared/publicCache', () => ({ invalidatePublicEventCaches: () => undefined }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...((await orig()) as object), londonTodayKey: () => '2026-11-22' }));
import { EditorV2 } from '../EditorV2';
import { aboutShort, priceLabel } from '../Facts';

const date = (id: string, d: string, extra: Record<string, unknown> = {}) => ({
  id, occurrence_date: d, version: 3, lifecycle_status: 'scheduled', has_override: false, override_keys: [], session_overrides_count: 0, added_sessions_count: 0, ...extra,
});
const detail = (extra: Record<string, unknown> = {}) => ({
  start: '19:30', end: '00:00', venueId: 'v1', venueOverride: null, descriptionOverride: null, coverImageOverride: null, ticketUrlOverride: null,
  titleOverride: null, passesOverride: null, coverImageUrl: null, ticketUrl: null, ...extra,
});
const ws = (dates: unknown[]) => ({ series: { id: 's1', version: 7, format: 'recurring', name: 'Thursdays', lifecycle_status: 'live', default_venue_id: 'v1', default_description: null, default_cover_image_url: null, default_ticket_url: null, default_local_start_time: '19:30', passes: null }, dates }) as unknown as EventWorkspace;
function Where() { const l = useLocation(); return <output data-testid="where">{l.search}</output>; }
const at = (w: EventWorkspace, url = '/e') => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[url]}><EditorV2 ws={w} /><Where /></MemoryRouter>
  </QueryClientProvider>);
beforeEach(() => { net.series.mockReset(); net.occ.mockReset().mockResolvedValue({ ok: true, new_version: 4 }); net.detail.mockReset().mockResolvedValue(detail()); window.scrollTo = vi.fn() as never; });
afterEach(cleanup);

describe('priceLabel five modes', () => {
  it('door, link, not on sale, none, tickets', () => {
    expect(priceLabel({ doorPrice: '10' })).toMatchObject({ m: '£10', s: 'Pay at the door' });
    expect(priceLabel({ link: 'https://x.co' })).toMatchObject({ m: 'Tickets on another site', s: 'https://x.co' });
    expect(priceLabel({ stripeConnected: false, ticketCount: 2 })).toMatchObject({ m: 'Not on sale yet', s: 'Set up tickets first' });
    expect(priceLabel({ ticketCount: 0 })).toMatchObject({ m: 'Add a ticket', s: '' });
    expect(priceLabel({ ticketCount: 1, minPrice: 8 })).toMatchObject({ m: '£8', s: '1 ticket' });
    expect(priceLabel({ ticketCount: 2, minPrice: null })).toMatchObject({ m: 'From Free', s: '2 tickets' });
    expect(priceLabel({ ticketCount: 3, minPrice: 5 })).toMatchObject({ m: 'From £5', s: '3 tickets' });
  });
  it('description is cut at 60 characters', () => {
    expect(aboutShort('a'.repeat(61))).toBe(`${'a'.repeat(60)}…`);
    expect(aboutShort('')).toBe('No description');
  });
});

describe('night card', () => {
  it('shows the label, facts and status, and no tag on an untouched night', async () => {
    at(ws([date('o1', '2026-11-26')]));
    expect(screen.getByText('What dancers see on this night. Tap to change.')).toBeTruthy();
    expect(screen.getByText('Live')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('19:30 to 00:00')).toBeTruthy());
    expect(screen.queryByText('Only this night')).toBeNull();
    expect(screen.getByText('No flyer')).toBeTruthy();
    fireEvent.click(screen.getByTestId('fact-flyer'));
    expect(screen.getByTestId('where').textContent).toBe('');
  });
  it('cancelled night shows the red Cancelled pill', () => {
    at(ws([date('o1', '2026-11-26', { lifecycle_status: 'cancelled' })]));
    expect(document.querySelector('.pill.x')?.textContent).toBe('Cancelled');
  });
  it('tag only on the fact whose override key is saved; a key that is not there never tags', async () => {
    at(ws([date('o1', '2026-11-26', { has_override: true, override_keys: ['description', 'title'] })]));
    await waitFor(() => expect(screen.getByTestId('only-about')).toBeTruthy());
    expect(screen.queryByTestId('only-where')).toBeNull();
    expect(screen.queryByTestId('only-price')).toBeNull();
    expect(screen.queryByTestId('only-when')).toBeNull();
    expect(screen.getAllByText('Only this night')).toHaveLength(1);
  });
  it('Back to usual sends the inverse step and shows the toast with Undo', async () => {
    net.detail.mockResolvedValue(detail({ descriptionOverride: 'Special night' }));
    at(ws([date('o1', '2026-11-26', { has_override: true, override_keys: ['description'] })]));
    await waitFor(() => expect(screen.getByText('Special night')).toBeTruthy());
    fireEvent.click(screen.getByTestId('back-about'));
    await waitFor(() => expect(net.occ).toHaveBeenCalledTimes(1));
    expect(net.occ.mock.calls[0][0]).toMatchObject({ target_id: 'o1', command: { kind: 'occurrence.set_override', payload: { description: null } } });
    expect((await screen.findByTestId('v2-toast')).textContent).toContain('Back to usual for Thursday 26 November');
    fireEvent.click(screen.getByTestId('v2-toast-undo'));
    await waitFor(() => expect(net.occ).toHaveBeenCalledTimes(2));
    expect(net.occ.mock.calls[1][0].command.payload).toEqual({ description: 'Special night' });
  });
});

describe('All dates sheet', () => {
  const many = Array.from({ length: 15 }, (_, i) => date(`o${i}`, `2026-12-${String(i + 1).padStart(2, '0')}`, i === 3 ? { lifecycle_status: 'cancelled' } : i === 4 ? { has_override: true } : {}));
  it('shows 12 rows with tags; a row picks the night, closes, switches to This night', () => {
    at(ws(many), '/e?tab=every&night=o0');
    fireEvent.click(screen.getByTestId('ev2-tab-night'));
    fireEvent.click(screen.getByTestId('ev2-more-dates'));
    const sheet = screen.getByRole('dialog', { name: 'All dates' });
    expect(within(sheet).getByText('Tap a date to see and change that night.')).toBeTruthy();
    const rows = within(sheet).getAllByTestId('dates-row');
    expect(rows).toHaveLength(12);
    expect(within(rows[3]).getByText('Cancelled')).toBeTruthy();
    expect(within(rows[4]).getByText('Changed')).toBeTruthy();
    fireEvent.click(rows[9]);
    expect(screen.queryByTestId('v2-sheet')).toBeNull();
    expect(screen.getByTestId('where').textContent).toBe('?night=o9');
    expect(screen.getByTestId('ev2-title').textContent).toBe('Thursday 10 December');
  });
});
