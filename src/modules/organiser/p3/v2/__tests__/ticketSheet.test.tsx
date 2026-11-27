// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { EventWorkspace } from '../../../events/eventModel';

const h = vi.hoisted(() => ({
  upsert: vi.fn(), status: vi.fn(), setStep: vi.fn(), delStep: vi.fn(), manage: vi.fn(),
  stripeState: 'connected' as string | null,
  types: { data: [] as unknown[] }, summary: { data: { ok: true, types: [] as unknown[] } as unknown },
  managed: { types: [] as unknown[] }, ws: null as unknown,
}));
vi.mock('../../../shared/runCommands', () => ({
  eventWorkspaceQueryKey: (id: string) => ['ws', id],
  useSendOnce: () => () => Promise.resolve({ ok: true, new_version: 8 }),
}));
vi.mock('../../../shared/selfServeApi', () => ({
  dateDetailQueryKey: (id: string) => ['d', id], occurrenceProgrammeQueryKey: (id: string) => ['p', id],
  runOccurrenceCommand: vi.fn(), saveOccurrenceProgramme: vi.fn(),
}));
vi.mock('@/modules/organiser/shared/publicCache', () => ({ invalidatePublicEventCaches: () => undefined }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...((await orig()) as object), londonTodayKey: () => '2026-11-22' }));
vi.mock('../../tickets/data', () => ({
  useStripe: () => ({ state: h.stripeState, query: { refetch: vi.fn() } }),
  useSeriesTypes: () => h.types,
  useSummary: () => ({ ...h.summary, refetch: vi.fn() }),
  useManagedTypes: () => ({ data: h.managed }),
  useStartOnboarding: () => ({ go: vi.fn(), busy: false, note: null, switchedOff: false }),
}));
vi.mock('../../screens/EventPage', () => ({ WorkspaceGate: ({ children }: { children: (w: unknown) => React.ReactNode }) => <>{children(h.ws)}</> }));
vi.mock('../../../tickets/ticketsApi', async (orig) => ({
  ...((await orig()) as object),
  setTicketStatus: (id: string, s: string) => h.status(id, s),
  upsertTicketType: (d: unknown) => h.upsert(d),
  setPriceStep: (c: unknown) => h.setStep(c),
  removePriceStep: (id: string) => h.delStep(id),
  fetchManagedTypes: () => h.manage(),
}));
import { TicketsV2 } from '../TicketsV2';
import { formOfStored, instantToUntil, untilToInstant, wantedOf } from '../EarlyBirds';

const mk = (format = 'recurring') => ({
  series: { id: 's1', version: 7, format, lifecycle_status: 'live', name: 'Thursdays', default_ticket_url: null, passes: null },
  organiserIds: ['o1'], dates: [{ id: 'd1', occurrence_date: '2026-11-26', lifecycle_status: 'scheduled', version: 1 }],
}) as unknown as EventWorkspace;
const ty = (o: Record<string, unknown> = {}) => ({ id: 't1', name: 'Class and party', status: 'on_sale', pricePence: 1200, capacity: 40, occurrenceId: null, salesOpenAt: null, salesCloseAt: null, ...o });
const seed = (type: unknown, sold = 0, steps: unknown[] = [], base = 1200) => {
  h.types.data = type ? [type] : [];
  h.summary.data = { ok: true, types: type ? [{ id: 't1', ticketsSold: sold, grossPence: sold * 1200 }] : [] };
  h.managed = { types: type ? [{ id: 't1', basePricePence: base, steps }] : [] };
};
const mount = (format = 'recurring') => { h.ws = mk(format); return render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><TicketsV2 /></MemoryRouter></QueryClientProvider>); };
const tap = (id: string) => fireEvent.click(screen.getByTestId(id));
const q = (id: string) => screen.queryByTestId(id);
const type = (id: string, v: string) => fireEvent.change(screen.getByTestId(id), { target: { value: v } });
const toast = () => q('v2-toast')?.textContent ?? '';

beforeEach(() => {
  h.upsert.mockReset().mockResolvedValue({ ok: true, reason: null, id: 'new1' });
  h.status.mockReset().mockResolvedValue({ ok: true, reason: null });
  h.setStep.mockReset().mockResolvedValue({ ok: true, reason: null });
  h.delStep.mockReset().mockResolvedValue({ ok: true, reason: null });
  h.manage.mockReset().mockResolvedValue({ ok: true, types: [{ id: 't1', basePricePence: 1200, steps: [] }] });
  h.stripeState = 'connected';
  seed(ty());
});
afterEach(() => cleanup());

describe('loading gate', () => {
  it('does not show Connect while the Stripe state is still loading', () => {
    h.stripeState = null; mount();
    expect(q('tk-stripe')).toBeNull();
    expect(q('tk-loading')).toBeTruthy();
  });
  it('shows Connect once it is known not connected', () => {
    h.stripeState = 'none'; mount();
    expect(q('tk-stripe')).toBeTruthy();
  });
});

describe('taps 91 / 92 open the sheet', () => {
  it('91 ticket card opens "Ticket" filled in; 92 opens "Add a ticket" empty', () => {
    mount();
    tap('tk-ticket-t1');
    expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe('Ticket');
    expect((screen.getByTestId('t-name') as HTMLInputElement).value).toBe('Class and party');
    expect((screen.getByTestId('t-price') as HTMLInputElement).value).toBe('12.00');
    expect(q('t-sold')?.textContent).toBe('0 sold across all dates, £0');
    tap('v2-sheet-close');
    tap('tk-new');
    expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe('Add a ticket');
    expect((screen.getByTestId('t-name') as HTMLInputElement).value).toBe('');
    expect(q('t-remove')).toBeNull();
    expect(q('t-sold')).toBeNull();
  });
});

describe('102 free switch', () => {
  it('hides the price and early birds, shows the hint; back on restores them', () => {
    mount(); tap('tk-ticket-t1');
    tap('t-free');
    expect(q('t-price')).toBeNull(); expect(q('eb')).toBeNull();
    expect(q('t-free-hint')?.textContent).toBe('Sales stay open until the night ends.');
    tap('t-free');
    expect(q('t-price')).toBeTruthy(); expect(q('eb')).toBeTruthy();
  });
});

describe('103 / 104 early birds', () => {
  it('adds and removes rows; label, hint and warning follow', () => {
    mount(); tap('tk-ticket-t1');
    expect(q('eb-hint')?.textContent).toBe('One fixed price. Sales stay open until the night ends.');
    tap('eb-add');
    expect(screen.getByText('Price after early bird (£)')).toBeTruthy();
    expect((screen.getByTestId('e-price-0') as HTMLInputElement).value).toBe('10');
    expect(q('eb-hint')?.textContent).toBe('Then £12. Sales stay open until the night ends.');
    expect(q('eb-warn')).toBeNull();
    type('e-price-0', '12');
    expect(q('eb-warn')?.textContent).toBe('Check the prices: early bird prices usually go up over time and stay below £12.');
    expect(screen.getByLabelText('Remove this early bird price')).toBeTruthy();
    tap('eb-del-0');
    expect(q('eb-row-0')).toBeNull(); expect(q('eb-warn')).toBeNull();
  });
  it('weekly shows the same-date hint, one-off does not', () => {
    mount(); tap('tk-ticket-t1');
    expect(q('eb-same')?.textContent).toBe('Early bird prices end on the same date for every night.');
    cleanup(); mount('one_off'); tap('tk-ticket-t1');
    expect(q('eb-same')).toBeNull();
  });
  it('stops at 3', () => {
    mount(); tap('tk-ticket-t1');
    tap('eb-add'); tap('eb-add'); tap('eb-add');
    expect((screen.getByTestId('eb-add') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('105 Done', () => {
  it('below the busiest-night sold count: error line, nothing saved, sheet stays', async () => {
    seed(ty(), 30);
    mount(); tap('tk-ticket-t1');
    expect(q('t-busiest')?.textContent).toBe('30 already sold on the busiest night');
    type('t-qty', '10'); tap('t-done');
    expect(q('t-err')?.textContent).toBe('How many available cannot be lower than 30, the number already sold.');
    await Promise.resolve();
    expect(h.upsert).not.toHaveBeenCalled();
    expect(q('ticket-sheet')).toBeTruthy();
  });
  it('an untouched ticket sends no command and just closes', async () => {
    mount(); tap('tk-ticket-t1'); tap('t-done');
    await waitFor(() => expect(q('ticket-sheet')).toBeNull());
    expect(h.upsert).not.toHaveBeenCalled(); expect(h.setStep).not.toHaveBeenCalled(); expect(h.delStep).not.toHaveBeenCalled();
    expect(toast()).toBe('');
  });
  it('a new ticket: upsert, put on sale, toast Saved; Undo closes it', async () => {
    mount(); tap('tk-new');
    type('t-name', 'Party'); type('t-price', '8'); type('t-qty', '60'); tap('t-done');
    await waitFor(() => expect(toast()).toContain('Saved'));
    expect(h.upsert.mock.calls[0][0]).toMatchObject({ id: null, organiserId: 'o1', seriesId: 's1', name: 'Party', pricePence: 800, capacity: 60 });
    expect(h.status).toHaveBeenCalledWith('new1', 'on_sale');
    fireEvent.click(screen.getByRole('button', { name: /undo/i }));
    await waitFor(() => expect(h.status).toHaveBeenCalledWith('new1', 'closed'));
    await waitFor(() => expect(toast()).toContain('Undone'));
  });
  it('early birds are written as base + steps (last step = main price)', async () => {
    mount(); tap('tk-ticket-t1');
    tap('eb-add'); type('e-price-0', '9'); type('e-until-0', '2026-12-01'); tap('t-done');
    await waitFor(() => expect(toast()).toContain('Saved'));
    expect(h.upsert.mock.calls[0][0]).toMatchObject({ id: 't1', pricePence: 900 });
    expect(h.setStep).toHaveBeenCalledWith({ p_ticket_type_id: 't1', p_step_id: null, p_effective_from: '2026-12-02T00:00:00.000Z', p_price_pence: 1200 });
  });
  it('a refused write shows the words, no Saved toast, no Undo', async () => {
    h.upsert.mockResolvedValue({ ok: false, reason: 'has_orders' });
    mount(); tap('tk-ticket-t1'); type('t-price', '15'); tap('t-done');
    await waitFor(() => expect(q('t-err')).toBeTruthy());
    expect(toast()).not.toContain('Saved');
    expect((screen.getByTestId('t-done') as HTMLButtonElement).disabled).toBe(false);
  });
  it('a failed step write puts the ticket back and says not saved', async () => {
    h.setStep.mockResolvedValue({ ok: false, reason: 'unknown' });
    h.manage.mockResolvedValue({ ok: true, types: [{ id: 't1', basePricePence: 900, steps: [] }] }); // what the server holds after the first write
    mount(); tap('tk-ticket-t1');
    tap('eb-add'); type('e-price-0', '9'); type('e-until-0', '2026-12-01'); tap('t-done');
    await waitFor(() => expect(q('t-err')).toBeTruthy());
    expect(h.upsert.mock.calls.length).toBe(2); // the change, then the restore
    expect(h.upsert.mock.calls[1][0]).toMatchObject({ id: 't1', pricePence: 1200 });
  });
  it('a double tap sends one write', async () => {
    mount(); tap('tk-ticket-t1'); type('t-qty', '45');
    tap('t-done'); tap('t-done');
    await waitFor(() => expect(toast()).toContain('Saved'));
    expect(h.upsert).toHaveBeenCalledTimes(1);
  });
  it('a live early bird cannot be changed: refused before any write', async () => {
    seed(ty(), 0, [{ id: 'st1', effectiveFrom: '2026-11-01T00:00:00.000Z', pricePence: 1200, isLive: true }], 900);
    mount(); tap('tk-ticket-t1');
    expect((screen.getByTestId('t-price') as HTMLInputElement).value).toBe('12.00');
    tap('eb-del-0'); tap('t-done');
    await waitFor(() => expect(q('t-err')).toBeTruthy());
    expect(h.delStep).not.toHaveBeenCalled(); expect(h.upsert).not.toHaveBeenCalled();
  });
});

describe('106 Remove', () => {
  it('closes the ticket, toast Ticket removed, Undo puts the status back', async () => {
    mount(); tap('tk-ticket-t1'); tap('t-remove');
    await waitFor(() => expect(toast()).toContain('Ticket removed'));
    expect(h.status).toHaveBeenCalledWith('t1', 'closed');
    fireEvent.click(screen.getByRole('button', { name: /undo/i }));
    await waitFor(() => expect(h.status).toHaveBeenCalledWith('t1', 'on_sale'));
  });
  it('disabled with the hint when anything is sold', () => {
    seed(ty(), 3); mount(); tap('tk-ticket-t1');
    expect((screen.getByTestId('t-remove') as HTMLButtonElement).disabled).toBe(true);
    expect(q('t-remove-hint')?.textContent).toBe('Tickets are already sold, so this ticket cannot be removed.');
    expect(q('t-sold')?.textContent).toBe('3 sold across all dates, £36');
  });
});

describe('early bird mapping', () => {
  const st = (iso: string, p: number, live = false) => ({ id: iso, effectiveFrom: iso, pricePence: p, isLive: live });
  it('round trips base + steps', () => {
    const steps = [st('2026-12-02T00:00:00.000Z', 1000), st('2026-12-09T00:00:00.000Z', 1200)];
    const f = formOfStored(800, steps);
    expect(f).toEqual({ price: '12.00', birds: [{ price: '8.00', until: '2026-12-01' }, { price: '10.00', until: '2026-12-08' }] });
    const w = wantedOf(false, f.price, f.birds);
    expect(w).toEqual({ basePence: 800, steps: [{ at: steps[0].effectiveFrom, pence: 1000 }, { at: steps[1].effectiveFrom, pence: 1200 }] });
  });
  it('no steps = one fixed price; free = nothing', () => {
    expect(formOfStored(1200, [])).toEqual({ price: '12.00', birds: [] });
    expect(wantedOf(true, '', [])).toEqual({ basePence: 0, steps: [] });
  });
  it('refuses a bad price or a bird with no date', () => {
    expect('error' in wantedOf(false, '', [])).toBe(true);
    expect('error' in wantedOf(false, '12', [{ price: '9', until: '' }])).toBe(true);
  });
  it('the day after the Until date, London midnight (summer and winter)', () => {
    expect(untilToInstant('2026-12-01')).toBe('2026-12-02T00:00:00.000Z');
    expect(untilToInstant('2026-07-01')).toBe('2026-07-01T23:00:00.000Z');
    expect(instantToUntil('2026-07-01T23:00:00.000Z')).toBe('2026-07-01');
  });
});
