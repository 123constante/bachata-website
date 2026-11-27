// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { EventWorkspace } from '../../../events/eventModel';

const h = vi.hoisted(() => ({
  log: [] as string[], save: vi.fn(), go: vi.fn(), types: [] as unknown[], stripe: 'connected' as string,
  managed: undefined as unknown, summary: undefined as unknown, upsert: vi.fn(), step: vi.fn(), status: vi.fn(), ws: undefined as unknown,
}));
vi.mock('@/lib/featureFlags', async (orig) => { const m = (await orig()) as { flags: Record<string, boolean> }; return { ...m, flags: { ...m.flags } }; });
vi.mock('@/lib/londonDate', async (orig) => ({ ...((await orig()) as object), londonTodayKey: () => '2026-11-22' }));
vi.mock('../../screens/EventPage', () => ({ WorkspaceGate: ({ children }: { children: (w: EventWorkspace) => React.ReactNode }) => <>{children(h.ws as EventWorkspace)}</> }));
vi.mock('../../tickets/data', () => ({
  useStripe: () => ({ state: h.stripe, query: { refetch: vi.fn() } }),
  useSeriesTypes: () => ({ data: h.types }),
  useSummary: () => ({ data: h.summary, refetch: vi.fn() }),
  useManagedTypes: () => ({ data: h.managed }),
  useStartOnboarding: () => ({ go: h.go, busy: false, note: null, switchedOff: false }),
}));
vi.mock('../../tickets/connectReturn', () => ({ returnKindOf: () => null, useConnectReturn: () => ({ phase: 'idle', again: vi.fn() }) }));
vi.mock('../saveNow', async (orig) => ({ ...((await orig()) as object), useSaveNow: () => ({ saveNow: h.save, toast: null, onToastDone: vi.fn() }) }));
vi.mock('../../../shared/selfServeApi', () => ({ dateDetailQueryKey: (id: string) => ['d', id], fetchDateDetail: async () => ({ noDoor: true }), setNightNoDoor: vi.fn() }));
vi.mock('../../../tickets/ticketsApi', async (orig) => ({
  ...((await orig()) as object), ticketKeys: { all: ['t'] },
  upsertTicketType: (a: unknown) => { h.log.push('upsert'); return h.upsert(a); },
  setPriceStep: (a: unknown) => { h.log.push('step'); return h.step(a); },
  setTicketStatus: (...a: unknown[]) => { h.log.push('status'); return h.status(...a); },
}));
vi.mock('../TicketSheetV2', async (orig) => ({ ...((await orig()) as object), TicketSheetV2: (p: { type: { id: string } | null }) => <div data-testid="sheet-mock">{p.type?.id ?? 'new'}</div> }));
vi.mock('../SkipDoorSheet', () => ({ SkipDoorSheet: (p: { dates: unknown[] }) => <div data-testid="skip-mock">{JSON.stringify(p.dates)}</div> }));
import { flags } from '@/lib/featureFlags';
import { TicketsV2 } from '../TicketsV2';

const ticket = { id: 't1', name: 'Ticket', pricePence: 1000, capacity: 50, status: 'on_sale', occurrenceId: null };
const mk = (over: Record<string, unknown> = {}, dates: unknown[] = []) => {
  h.ws = { series: { id: 's1', version: 3, format: 'recurring', name: 'Thursdays', payment_methods: null, default_ticket_url: null, passes: null, ...over }, organiserIds: ['o1'], dates } as unknown;
};
const show = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><TicketsV2 /></MemoryRouter></QueryClientProvider>);
const click = (id: string) => fireEvent.click(screen.getByTestId(id));
const type = (id: string, v: string) => fireEvent.change(screen.getByTestId(id), { target: { value: v } });
const onlineGuide = (early: boolean) => {
  click('wg-online'); click('wg-next');
  type('wg-price', '10'); type('wg-qty', '50'); click('wg-next');
  if (early) { click('wg-early-yes'); type('wg-early-price', '8'); type('wg-until', '2026-12-05'); } else click('wg-early-no');
  click('wg-finish');
};
beforeEach(() => {
  Object.assign(flags, { waysInV2: true, waysInRebuild: true });
  h.log.length = 0; h.types = []; h.stripe = 'connected'; h.managed = undefined; h.summary = undefined;
  h.save.mockReset().mockResolvedValue({ ok: true }); h.go.mockReset();
  h.upsert.mockReset().mockResolvedValue({ ok: true, id: 'n1' }); h.step.mockReset().mockResolvedValue({ ok: true }); h.status.mockReset().mockResolvedValue({ ok: true });
  mk();
});
afterEach(cleanup);

describe('Ways in rebuild wiring (W3)', () => {
  it('flag off: the old WaysInView, no guide or summary', () => {
    Object.assign(flags, { waysInRebuild: false });
    show();
    expect(screen.getByTestId('ways-in-v2')).toBeTruthy();
    expect(screen.queryByTestId('ways-in-guide')).toBeNull();
    expect(screen.queryByTestId('ways-in-summary')).toBeNull();
  });
  it('flag on, empty event: the guide', () => {
    show();
    expect(screen.getByTestId('ways-in-guide')).toBeTruthy();
    expect(screen.queryByTestId('ways-in-v2')).toBeNull();
  });
  it('flag on, one ticket: the summary with the ticket line', () => {
    h.types = [ticket];
    show();
    expect(screen.getByTestId('ways-in-summary')).toBeTruthy();
    expect(screen.getByTestId('ws-text-ticket-t1').textContent).toBe('Online \u00a310, 50 a night');
  });
  it('guide done with door only: one payment_methods write, no ticket call', async () => {
    show();
    click('wg-door'); click('wg-next');
    await waitFor(() => expect(h.save).toHaveBeenCalledTimes(1));
    expect(JSON.stringify(h.save.mock.calls[0][0])).toContain('door');
    expect(h.log).toEqual([]);
    expect(screen.getByTestId('ways-in-summary')).toBeTruthy();
  });
  it('guide done online with a date early bird: methods, create, then the step, in that order', async () => {
    show();
    onlineGuide(true);
    await waitFor(() => expect(h.step).toHaveBeenCalledTimes(1));
    expect(h.log).toEqual(['upsert', 'step', 'status']);
    expect(h.upsert.mock.calls[0][0]).toMatchObject({ pricePence: 800, capacity: 50, seriesId: 's1' });
    expect(h.step.mock.calls[0][0]).toMatchObject({ p_effective_from: '2026-12-06T00:00:00.000Z', p_price_pence: 1000 });
    expect(h.save).not.toHaveBeenCalled(); // online alone has no stored code
  });
  it('ticket create fails: summary and the error line, no early-bird call', async () => {
    h.upsert.mockResolvedValue({ ok: false, reason: null });
    show();
    onlineGuide(true);
    expect(await screen.findByTestId('ways-guide-err')).toBeTruthy();
    expect(screen.getByTestId('ways-in-summary')).toBeTruthy();
    expect(h.step).not.toHaveBeenCalled();
  });
  it('guide reopened from the summary and closed: zero writes', () => {
    h.types = [ticket]; mk({ payment_methods: 'door' });
    show();
    click('ws-rerun');
    expect(screen.getByTestId('ways-in-guide')).toBeTruthy();
    click('wg-close');
    expect(screen.getByTestId('ways-in-summary')).toBeTruthy();
    expect(h.save).not.toHaveBeenCalled(); expect(h.log).toEqual([]);
  });
  it('guide reopened and finished unchanged: zero writes', async () => {
    h.types = [ticket]; mk({ payment_methods: 'door' });
    show();
    click('ws-rerun'); click('wg-next'); click('wg-next'); click('wg-early-no'); click('wg-finish');
    await waitFor(() => expect(screen.getByTestId('ways-in-summary')).toBeTruthy());
    expect(h.save).not.toHaveBeenCalled(); expect(h.log).toEqual([]);
  });
  it('summary taps: ticket / early / newTicket open the ticket sheet', () => {
    h.types = [ticket]; mk({ payment_methods: 'door' });
    h.summary = { ok: true, types: [] };
    h.managed = { types: [{ id: 't1', basePricePence: 1000, steps: [{ id: 'p1', effectiveFrom: '2099-01-01T00:00:00Z', pricePence: 1200, isLive: false }] }] };
    show();
    click('ws-ticket-t1'); expect(screen.getByTestId('sheet-mock').textContent).toBe('t1'); cleanup();
    show(); click('ws-early-t1'); expect(screen.getByTestId('sheet-mock').textContent).toBe('t1'); cleanup();
    show(); click('ws-another'); expect(screen.getByTestId('sheet-mock').textContent).toBe('new');
  });
  it('guide picks a ticket site with no address: saves door only, then opens the link sheet', async () => {
    show();
    click('wg-door'); click('wg-link'); click('wg-next');
    await waitFor(() => expect(h.save).toHaveBeenCalledTimes(1));
    const sent = JSON.stringify(h.save.mock.calls[0][0]);
    expect(sent).toContain('door');
    expect(sent).not.toContain('ticket_link');
    expect(await screen.findByTestId('link-done')).toBeTruthy();
  });
  it('guide connect: saves the door choice before the Stripe redirect', async () => {
    h.stripe = 'none';
    show();
    click('wg-online'); click('wg-door'); click('wg-next'); click('wg-connect');
    await waitFor(() => expect(h.go).toHaveBeenCalledTimes(1));
    expect(h.save).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(h.save.mock.calls[0][0])).toContain('door');
  });
  it('summary tap: link opens the link sheet (its address lives there)', () => {
    h.types = [ticket]; mk({ payment_methods: 'ticket_link', default_ticket_url: 'https://x.test' });
    show(); click('ws-link');
    expect(screen.getByTestId('link-done')).toBeTruthy();
  });
  it('summary taps: door / free / rerun open the guide with the current answers', () => {
    h.types = [ticket]; mk({ payment_methods: 'door,free', default_ticket_url: 'https://x.test' });
    for (const id of ['ws-door', 'ws-free', 'ws-rerun']) {
      show(); click(id);
      expect(screen.getByTestId('ways-in-guide')).toBeTruthy();
      expect(screen.getByTestId('wg-online').getAttribute('aria-checked')).toBe('true');
      cleanup();
    }
  });
  it('summary tap: stripe starts onboarding', () => {
    h.stripe = 'none'; mk({ payment_methods: 'door' });
    show(); click('ws-stripe-nudge');
    expect(h.go).toHaveBeenCalledTimes(1);
  });
  it('summary tap: skipDoor opens the sheet with the coming nights, worded in full', async () => {
    h.types = [ticket]; mk({ payment_methods: 'door' }, [{ id: 'd1', occurrence_date: '2026-12-06', lifecycle_status: 'scheduled' }]);
    show(); click('ws-skip-door');
    const el = await screen.findByTestId('skip-mock');
    expect(JSON.parse(el.textContent ?? '[]')).toEqual([{ id: 'd1', label: 'Sunday 6 December', noDoor: true }]);
  });
  it('festival: guide hides door and free', () => {
    mk({ format: 'festival' });
    show();
    expect(screen.queryByTestId('wg-door')).toBeNull();
    expect(screen.queryByTestId('wg-free')).toBeNull();
  });
});
