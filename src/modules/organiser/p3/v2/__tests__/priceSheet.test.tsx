// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { EventWorkspace } from '../../../events/eventModel';

const h = vi.hoisted(() => ({
  stripe: 'connected' as string | null, types: [] as unknown[], detail: {} as Record<string, unknown>,
  occ: vi.fn(), series: vi.fn(),
}));
vi.mock('../../../shared/runCommands', () => ({
  eventWorkspaceQueryKey: (id: string) => ['ws', id],
  useSendOnce: () => (c: unknown, v: number | null, k: string) => h.series(c, v, k),
}));
vi.mock('../../../shared/selfServeApi', () => ({
  dateDetailQueryKey: (id: string) => ['d', id], occurrenceProgrammeQueryKey: (id: string) => ['p', id],
  runOccurrenceCommand: (e: unknown) => h.occ(e), saveOccurrenceProgramme: vi.fn(),
  fetchDateDetail: async () => h.detail, fetchCancellationReasons: async () => [],
}));
vi.mock('../../../shared/publicVenues', () => ({ useVenueOptions: () => ({ data: [] }) }));
vi.mock('@/modules/organiser/shared/publicCache', () => ({ invalidatePublicEventCaches: () => undefined }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...((await orig()) as object), londonTodayKey: () => '2026-11-22' }));
vi.mock('../../tickets/data', () => ({
  useStripe: () => ({ state: h.stripe, query: { refetch: vi.fn() } }),
  useSeriesTypes: () => ({ data: h.types }),
}));
import { EditorV2 } from '../EditorV2';
import { PriceSheet } from '../PriceSheet';

const date = { id: 'o1', occurrence_date: '2026-11-26', lifecycle_status: 'scheduled', has_override: false, override_keys: [] as string[], session_overrides_count: 0, added_sessions_count: 0, version: 3 };
const ws = (format = 'recurring', url: string | null = null, d = date) => ({
  series: { id: 's1', version: 7, format, name: 'Thursdays', lifecycle_status: 'live', default_venue_id: null, default_description: null, default_cover_image_url: null, default_ticket_url: url, default_local_start_time: '19:30', passes: [{ id: '11111111-1111-4111-8111-111111111111', name: 'Entry', price: 10 }] },
  organiserIds: ['o1'], gallery: [], musicStyles: [], endedOn: null, dates: [d],
}) as unknown as EventWorkspace;
const ty = (o: Record<string, unknown> = {}) => ({ id: 't1', name: 'Early', status: 'on_sale', pricePence: 1200, occurrenceId: null, ...o });
function Where() { const l = useLocation(); return <output data-testid="where">{l.pathname}{l.search}</output>; }
const mount = (w: EventWorkspace) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={['/events/s1']}><EditorV2 ws={w} /><Where /></MemoryRouter></QueryClientProvider>);
const open = async () => { fireEvent.click(screen.getByText('Price').closest('button') as HTMLElement); await screen.findByTestId('price-sheet'); };
const q = (id: string) => screen.queryByTestId(id);
beforeEach(() => {
  h.stripe = 'connected'; h.types = []; h.detail = { start: '19:30', end: '00:00', venueId: null, venueOverride: null, descriptionOverride: null, coverImageOverride: null, ticketUrlOverride: null, titleOverride: null, passesOverride: null, coverImageUrl: null, ticketUrl: null };
  h.occ.mockReset().mockResolvedValue({ ok: true, new_version: 4 }); h.series.mockReset(); window.scrollTo = vi.fn() as never;
});
afterEach(cleanup);

describe('door mode (taps 10, 53, 54)', () => {
  it('shows the weekly lines, saves a one-night passes override with Undo, toast "Saved for … only"', async () => {
    mount(ws()); await open();
    expect(screen.getByTestId('price-date').textContent).toBe('Thursday 26 November');
    expect(screen.getByText(/changes the price for this night only/)).toBeTruthy();
    expect(q('price-back')).toBeNull();
    fireEvent.change(screen.getByLabelText('Price at the door (£)'), { target: { value: '15' } });
    fireEvent.click(screen.getByTestId('price-done'));
    await waitFor(() => expect(h.occ).toHaveBeenCalled());
    const env = h.occ.mock.calls[0][0] as { command: { kind: string; payload: { passes: { price: number }[] } } };
    expect(env.command.kind).toBe('occurrence.set_override');
    expect(env.command.payload.passes[0].price).toBe(15);
    await waitFor(() => expect(q('price-sheet')).toBeNull());
    expect(screen.getByTestId('v2-toast').textContent).toMatch(/Saved for .* only/);
    expect(screen.getByTestId('v2-toast').textContent).toMatch(/Undo/);
  });
  it('empty or unchanged field just closes, no write', async () => {
    mount(ws()); await open();
    fireEvent.change(screen.getByLabelText('Price at the door (£)'), { target: { value: '10' } });
    fireEvent.click(screen.getByTestId('price-done'));
    await waitFor(() => expect(q('price-sheet')).toBeNull());
    await open();
    fireEvent.change(screen.getByLabelText('Price at the door (£)'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('price-done'));
    await waitFor(() => expect(q('price-sheet')).toBeNull());
    expect(h.occ).not.toHaveBeenCalled();
  });
  it('a failed save keeps the sheet open with the error', async () => {
    h.occ.mockRejectedValue(new Error('nope'));
    mount(ws()); await open();
    fireEvent.change(screen.getByLabelText('Price at the door (£)'), { target: { value: '15' } });
    fireEvent.click(screen.getByTestId('price-done'));
    await screen.findByTestId('price-err');
    expect(q('price-sheet')).not.toBeNull();
  });
  it('a bad price is refused before any write', async () => {
    mount(ws()); await open();
    fireEvent.change(screen.getByLabelText('Price at the door (£)'), { target: { value: '-3' } });
    fireEvent.click(screen.getByTestId('price-done'));
    expect((await screen.findByTestId('price-err')).textContent).toMatch(/Enter a price/);
    expect(h.occ).not.toHaveBeenCalled();
  });
  it('Back to the usual price when the night owns one: clears and shows "Back to usual for"', async () => {
    h.detail.passesOverride = [{ id: '11111111-1111-4111-8111-111111111111', name: 'Entry', price: 20 }];
    mount(ws('recurring', null, { ...date, override_keys: ['passes'] })); await open();
    fireEvent.click(screen.getByTestId('price-back'));
    await waitFor(() => expect(h.occ).toHaveBeenCalled());
    expect((h.occ.mock.calls[0][0] as { command: { payload: unknown } }).command.payload).toEqual({ passes: null });
    await waitFor(() => expect(screen.getByTestId('v2-toast').textContent).toMatch(/Back to usual for/));
  });
  it('weekly link "Change the usual price" sets the Every tab and opens Tickets', async () => {
    mount(ws()); await open();
    fireEvent.click(screen.getByText('Change the usual price'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/\/tickets$/));
  });
  it('one-off: no date lines, "All ticket settings", toast "Saved"', async () => {
    mount(ws('one_off')); await open();
    expect(q('price-date')).toBeNull();
    expect(screen.getByText('All ticket settings')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Price at the door (£)'), { target: { value: '12' } });
    fireEvent.click(screen.getByTestId('price-done'));
    await waitFor(() => expect(screen.getByTestId('v2-toast').textContent).toMatch(/^Saved/));
    expect(screen.getByTestId('v2-toast').textContent).not.toMatch(/only/);
  });
});

describe('link, no Stripe, no tickets, tickets here', () => {
  it('link mode weekly', async () => {
    mount(ws('recurring', 'https://x.co/t')); await open();
    expect(screen.getByTestId('price-link-text').textContent).toBe('Dancers buy at https://x.co/t.');
    fireEvent.click(screen.getByText('Change tickets for every Thursday'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/tickets/));
  });
  it('link mode one-off: Change the link opens "Link to buy tickets"; no write by itself', async () => {
    mount(ws('one_off', 'https://x.co/t')); await open();
    expect(screen.getByText('All ticket settings')).toBeTruthy();
    fireEvent.click(screen.getByTestId('price-change-link'));
    expect(await screen.findByLabelText(/link/i)).toBeTruthy();
    expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe('Link to buy tickets');
    expect(h.series).not.toHaveBeenCalled();
  });
  it('Stripe not connected', async () => {
    h.types = [ty()]; h.stripe = 'not_started';
    mount(ws()); await open();
    expect(screen.getByTestId('price-nostripe').textContent).toBe('Dancers can’t buy yet.');
    fireEvent.click(screen.getByText('Set up tickets'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/tickets/));
  });
  it('No tickets yet (state)', () => {
    const go = vi.fn();
    render(<PriceSheet state="noTickets" weekly long="x" day="Thursday" doorPrice={null} link={null} tickets={[]} changed={false} onSaveDoor={vi.fn()} onBack={vi.fn()} onGoTickets={go} onLink={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByTestId('price-notickets').textContent).toBe('No tickets yet.');
    fireEvent.click(screen.getByText('Add your first ticket'));
    expect(go).toHaveBeenCalled();
  });
  it('tickets here: a field per paid ticket, free as a line, Done closes without a write, Back to the usual prices', async () => {
    h.types = [ty(), ty({ id: 't2', name: 'Free pass', pricePence: 0 })];
    h.detail.passesOverride = [{ id: '11111111-1111-4111-8111-111111111111', name: 'Entry', price: 20 }];
    mount(ws('recurring', null, { ...date, override_keys: ['passes'] })); await open();
    expect(screen.getByLabelText('Early (£)')).toBeTruthy();
    expect(screen.getByTestId('price-free-t2').textContent).toBe('Free pass: Free');
    expect(q('p-t2')).toBeNull();
    fireEvent.change(screen.getByLabelText('Early (£)'), { target: { value: '9' } });
    fireEvent.click(screen.getByTestId('price-done'));
    await waitFor(() => expect(q('price-sheet')).toBeNull());
    expect(h.occ).not.toHaveBeenCalled(); // UNBUILT: no per-night ticket price write exists
    await open();
    expect(screen.getByTestId('price-back').textContent).toBe('Back to the usual prices');
  });
  it('loading line while the ticket list is not known', () => {
    render(<PriceSheet state="loading" weekly long="x" day="Thursday" doorPrice={null} link={null} tickets={[]} changed={false} onSaveDoor={vi.fn()} onBack={vi.fn()} onGoTickets={vi.fn()} onLink={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByTestId('price-loading')).toBeTruthy();
  });
});
