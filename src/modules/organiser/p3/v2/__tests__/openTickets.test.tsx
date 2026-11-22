// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { EventWorkspace } from '../../../events/eventModel';
vi.mock('../../../shared/runCommands', () => ({ eventWorkspaceQueryKey: (id: string) => ['ws', id], useSendOnce: () => vi.fn() }));
vi.mock('../../../shared/selfServeApi', () => ({
  dateDetailQueryKey: (id: string) => ['d', id], occurrenceProgrammeQueryKey: (id: string) => ['p', id],
  runOccurrenceCommand: vi.fn(), saveOccurrenceProgramme: vi.fn(), fetchDateDetail: () => new Promise(() => undefined),
}));
vi.mock('../../../shared/publicVenues', () => ({ useVenueOptions: () => ({ data: [], isPending: false }) }));
vi.mock('../../../events/programmeSeriesApi', () => ({ fetchOrganiserPages: async () => [] }));
vi.mock('@/modules/organiser/shared/publicCache', () => ({ invalidatePublicEventCaches: () => undefined }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...((await orig()) as object), londonTodayKey: () => '2026-11-22' }));
vi.mock('../../tickets/data', () => ({ useStripe: () => ({ state: 'connected', query: { refetch: vi.fn() } }), useSeriesTypes: () => ({ data: [] }) }));
import { EditorV2 } from '../EditorV2';
import { EveryBody } from '../EveryBody';
import { NightCard } from '../NightCard';
import { TicketsView } from '../TicketsV2';

const date = { id: 'o1', occurrence_date: '2026-11-26', lifecycle_status: 'scheduled', has_override: false, override_keys: [], session_overrides_count: 0, added_sessions_count: 0, version: 1 };
const ws = (format = 'recurring') => ({
  series: { id: 's1', version: 7, format, name: 'Thursdays', lifecycle_status: 'live', default_venue_id: null, default_description: null, default_cover_image_url: null, default_ticket_url: null, default_local_start_time: '19:30:00', passes: null },
  gallery: [], musicStyles: [], organiserIds: [], endedOn: null, dates: [date],
}) as unknown as EventWorkspace;
const qc = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrap = (ui: React.ReactNode, url = '/e') => render(<QueryClientProvider client={qc()}><MemoryRouter initialEntries={[url]}>{ui}</MemoryRouter></QueryClientProvider>);
const priceBtn = () => screen.getByText('Price').closest('button') as HTMLButtonElement;
function Where() { const l = useLocation(); return <output data-testid="where">{l.pathname}</output>; }
afterEach(cleanup);

describe('open the Tickets screen from the Price fact (taps 22, 22n)', () => {
  it('Every card: Price fact calls onOpenTickets', () => {
    const f = vi.fn();
    wrap(<EveryBody ws={ws()} day="Thursday" saveNow={vi.fn()} onOpenTickets={f} />);
    fireEvent.click(priceBtn());
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('Every card without the prop: tap does nothing and does not throw', () => {
    wrap(<EveryBody ws={ws()} day="Thursday" saveNow={vi.fn()} />);
    expect(() => fireEvent.click(priceBtn())).not.toThrow();
  });
  it('Night card: Price fact calls onOpenTickets; without it nothing happens', () => {
    const f = vi.fn();
    wrap(<NightCard ws={ws()} date={date as never} onBack={vi.fn()} onOpenTickets={f} />);
    fireEvent.click(priceBtn());
    expect(f).toHaveBeenCalledTimes(1);
    cleanup();
    wrap(<NightCard ws={ws()} date={date as never} onBack={vi.fn()} />);
    expect(() => fireEvent.click(priceBtn())).not.toThrow();
  });
  it('shell: the night Price fact opens the Price sheet; its usual-price link navigates to the tickets path (tap 55)', async () => {
    wrap(<><EditorV2 ws={ws()} /><Where /></>);
    fireEvent.click(priceBtn());
    fireEvent.click(await screen.findByTestId('price-usual-link'));
    expect(screen.getByTestId('where').textContent).toMatch(/\/events\/s1\/tickets$/);
  });
  it('shell: the Every tab Price fact navigates to the tickets path', () => {
    wrap(<><EditorV2 ws={ws()} /><Where /></>, '/e?tab=every');
    fireEvent.click(priceBtn());
    expect(screen.getByTestId('where').textContent).toMatch(/\/events\/s1\/tickets$/);
  });
  it('tap 87: the Tickets screen back link returns to the first screen', () => {
    render(
      <MemoryRouter initialEntries={['/events/s1/tickets']}>
        <Routes>
          <Route path="/events/s1/tickets" element={<TicketsView name="Thursdays" oneOff={false} day="Thursday" backTo="/events/s1" stripe={false} mode={'none' as never} tickets={[]} dates={[]} doorPrice={null} link={null} />} />
          <Route path="/events/s1" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('tk-back'));
    expect(screen.getByTestId('where').textContent).toBe('/events/s1');
  });
});
