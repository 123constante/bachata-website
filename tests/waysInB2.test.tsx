// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { EventWorkspace } from '@/modules/organiser/events/eventModel';

const h = vi.hoisted(() => ({ on: true, types: [] as unknown[], check: { data: undefined, isError: false } as { data?: unknown; isError: boolean }, nav: vi.fn() }));
vi.mock('@/lib/featureFlags', async (orig) => {
  const m = (await orig()) as { flags: object };
  return { ...m, flags: new Proxy(m.flags, { get: (t, k) => (k === 'waysInV2' ? h.on : (t as Record<string | symbol, unknown>)[k]) }) };
});
vi.mock('react-router-dom', async (orig) => ({ ...((await orig()) as object), useNavigate: () => h.nav }));
vi.mock('@/modules/organiser/shared/goLiveCheck', async (orig) => ({ ...((await orig()) as object), useGoLiveCheck: () => h.check }));
vi.mock('@/modules/organiser/shared/runCommands', () => ({ eventWorkspaceQueryKey: (id: string) => ['ws', id], useSendOnce: () => vi.fn(), useRunCommands: () => vi.fn() }));
vi.mock('@/modules/organiser/p3/screens/Toast', () => ({ useToast: () => ({ run: vi.fn(), show: vi.fn(), node: null }) }));
vi.mock('@/modules/organiser/p3/screens/StatusSheet', () => ({ StatusSheet: () => <div /> }));
vi.mock('@/modules/organiser/p3/v2/HowToPaySheet', () => ({ HowToPaySheet: () => <div data-testid="howtopay" /> }));
vi.mock('@/modules/organiser/shared/selfServeApi', () => ({
  dateDetailQueryKey: (id: string) => ['d', id], occurrenceProgrammeQueryKey: (id: string) => ['p', id],
  runOccurrenceCommand: vi.fn(), saveOccurrenceProgramme: vi.fn(), fetchDateDetail: () => new Promise(() => undefined),
}));
vi.mock('@/modules/organiser/shared/publicVenues', () => ({ useVenueOptions: () => ({ data: [], isPending: false }) }));
vi.mock('@/modules/organiser/p3/tickets/data', () => ({ useSeriesTypes: () => ({ data: h.types }), useSummary: () => ({ data: undefined }), useStripe: () => ({ state: 'connected', query: { refetch: vi.fn() } }) }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...((await orig()) as object), londonTodayKey: () => '2026-11-22' }));
import { waysInLabel } from '@/modules/organiser/p3/v2/Facts';
import { GoLiveBar, WAYS_IN_REASON } from '@/modules/organiser/p3/v2/GoLiveBar';
import { NightCard } from '@/modules/organiser/p3/v2/NightCard';

const L = (onSaleTypes: { pricePence: number }[], paymentMethods: string | null = null, link: string | null = null) => waysInLabel({ onSaleTypes, paymentMethods, link });

describe('waysInLabel', () => {
  it('tickets only: one type, two types, free', () => {
    expect(L([{ pricePence: 1000 }])).toEqual({ m: 'Online ticket £10', s: '' });
    expect(L([{ pricePence: 1050 }, { pricePence: 1500 }])).toEqual({ m: 'Online ticket from £10.50', s: '' });
    expect(L([{ pricePence: 0 }]).m).toBe('Online ticket Free');
  });
  it('door only, link only, free only', () => {
    expect(L([], 'door')).toEqual({ m: 'Pay at the door', s: '' });
    expect(L([], null, 'https://x.test')).toEqual({ m: 'Ticket link', s: '' });
    expect(L([], 'free')).toEqual({ m: 'Free entry', s: '' });
  });
  it('tickets + door + link', () => {
    expect(L([{ pricePence: 800 }], 'door,ticket_link', 'https://x.test')).toEqual({ m: 'Online ticket £8', s: 'Pay at the door, Ticket link' });
  });
  it('nothing -> Add a way in; a door price in passes never appears', () => {
    expect(L([])).toEqual({ m: 'Add a way in', s: '' });
    expect(JSON.stringify(L([], 'door'))).not.toMatch(/£|\d/);
  });
});

const ws = (over = {}) => ({
  series: { id: 's1', version: 7, format: 'recurring', name: 'Thu', lifecycle_status: 'draft', default_venue_id: null, default_description: null, default_cover_image_url: null, default_ticket_url: null, default_local_start_time: null, passes: null, payment_methods: null, ...over },
  gallery: [], musicStyles: [], organiserIds: ['org1'], endedOn: null,
  dates: [{ id: 'o1', occurrence_date: '2026-11-26', lifecycle_status: 'scheduled', has_override: false, override_keys: [], session_overrides_count: 0, added_sessions_count: 0, version: 1 }],
}) as unknown as EventWorkspace;
const wrap = (n: React.ReactNode) => render(<QueryClientProvider client={new QueryClient()}><MemoryRouter>{n}</MemoryRouter></QueryClientProvider>);
afterEach(() => { cleanup(); h.on = true; h.types = []; h.nav.mockClear(); h.check = { data: undefined, isError: false }; });

describe('GoLiveBar no_payment', () => {
  const noPay = () => { h.check = { data: { ready: false, eventMissing: [{ code: 'no_payment', section: 'payment' }], recommended: [], profileRuleApplies: false, profileMissing: [] }, isError: false }; };
  it('flag on: new reason, tap navigates to /tickets', () => {
    noPay(); wrap(<GoLiveBar ws={ws()} />);
    expect(screen.getByTestId('golive-fix').textContent).toBe(WAYS_IN_REASON);
    fireEvent.click(screen.getByTestId('golive-fix'));
    expect(h.nav).toHaveBeenCalledWith(expect.stringMatching(/\/events\/s1\/tickets$/));
    expect(screen.queryByTestId('howtopay')).toBeNull();
  });
  it('flag off: old reason, tap opens HowToPaySheet', () => {
    h.on = false; noPay(); wrap(<GoLiveBar ws={ws()} />);
    expect(screen.getByTestId('golive-fix').textContent).not.toBe(WAYS_IN_REASON);
    fireEvent.click(screen.getByTestId('golive-fix'));
    expect(screen.getByTestId('howtopay')).toBeTruthy();
    expect(h.nav).not.toHaveBeenCalled();
  });
});

describe('NightCard price fact', () => {
  const card = (onOpenTickets: () => void) => wrap(<NightCard ws={ws({ lifecycle_status: 'live' })} date={ws().dates[0]} onBack={vi.fn()} onSave={vi.fn(async () => ({ ok: true, error: null }))} onOpenTickets={onOpenTickets} />);
  const price = () => screen.getByTestId('fact-price').querySelector('button') as HTMLButtonElement;
  it('no on-sale ticket for the night: shows Add a way in and calls onOpenTickets', () => {
    h.types = [{ status: 'on_sale', pricePence: 500, occurrenceId: 'other' }];
    const open = vi.fn(); card(open);
    expect(price().textContent).toContain('Add a way in');
    fireEvent.click(price());
    expect(open).toHaveBeenCalledTimes(1);
  });
  it('on-sale ticket for the night: opens the night price sheet, not onOpenTickets', () => {
    h.types = [{ status: 'on_sale', pricePence: 500, occurrenceId: 'o1' }];
    const open = vi.fn(); card(open);
    expect(price().textContent).toContain('Online ticket £5');
    fireEvent.click(price());
    expect(open).not.toHaveBeenCalled();
    expect(screen.getByTestId('v2-sheet')).toBeTruthy();
  });
});
