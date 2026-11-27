// @vitest-environment jsdom
// Draft events keep ticket prices (website half): a NEW ticket on a draft series is saved as a draft row and never
// asked to go on sale (ticket_type_set_status_v1 refuses series_not_live); it goes on sale when the event goes live.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({ upsert: vi.fn(), status: vi.fn(), setStep: vi.fn(), delStep: vi.fn(), manage: vi.fn(), ws: vi.fn() }));
vi.mock('../../../tickets/ticketsApi', async (orig) => ({
  ...((await orig()) as object),
  setTicketStatus: (id: string, s: string) => h.status(id, s),
  upsertTicketType: (d: unknown) => h.upsert(d),
  setPriceStep: (c: unknown) => h.setStep(c),
  removePriceStep: (id: string) => h.delStep(id),
  fetchManagedTypes: () => h.manage(),
}));
vi.mock('@/modules/organiser/shared/runCommands', async (orig) => ({
  ...((await orig()) as object),
  fetchEventWorkspace: (id: string) => h.ws(id),
}));
vi.mock('@/lib/featureFlags', async (orig) => { const m = (await orig()) as { flags: Record<string, boolean> }; return { ...m, flags: { ...m.flags } }; });
import { flags } from '@/lib/featureFlags';
import { TicketSheetV2, writeTicket } from '../TicketSheetV2';
import { useWaysInGuideSave } from '../useWaysInGuideSave';
import { V2 } from '../copy';
import type { EventWorkspace } from '../../../events/eventModel';
import type { GuideResult } from '../WaysInGuide';

const form = { name: 'Class', free: false, price: '12', qty: 40, birds: [] };
const base = { organiserId: 'o1', seriesId: 's1', basePence: 0, steps: [], form };
const type = { id: 't1', name: 'Class', capacity: 40, occurrenceId: null, salesOpenAt: null, salesCloseAt: null, pricePence: 1200, status: 'draft' as const };

beforeEach(() => {
  h.upsert.mockReset().mockResolvedValue({ ok: true, reason: null, id: 'new1' });
  h.status.mockReset().mockResolvedValue({ ok: true, reason: null });
  h.setStep.mockReset().mockResolvedValue({ ok: true, reason: null });
  h.delStep.mockReset().mockResolvedValue({ ok: true, reason: null });
  h.manage.mockReset().mockResolvedValue({ ok: true, types: [] });
  h.ws.mockReset().mockResolvedValue({ series: { id: 's1', lifecycle_status: 'draft' } });
  Object.assign(flags, { waysInRebuild: true });
});
afterEach(cleanup);

describe('writeTicket on a draft series', () => {
  it('a new ticket is upserted once and never asked to go on sale', async () => {
    const r = await writeTicket({ ...base, type: null, seriesLive: false });
    expect(h.upsert).toHaveBeenCalledTimes(1);
    expect(h.status).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: true, id: 'new1', changed: true, draft: true });
  });
  it('a live series still puts a new ticket on sale (unchanged)', async () => {
    const r = await writeTicket({ ...base, type: null, seriesLive: true });
    expect(h.status).toHaveBeenCalledWith('new1', 'on_sale');
    expect(r).toEqual({ ok: true, id: 'new1', changed: true });
  });
  it('editing an existing ticket on a draft series sends no status call (unchanged)', async () => {
    const r = await writeTicket({ ...base, basePence: 1200, type, form: { ...form, qty: 60 }, seriesLive: false });
    expect(h.upsert).toHaveBeenCalledTimes(1);
    expect(h.status).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: true, id: 't1', changed: true });
  });
});

const sheet = (seriesLive: boolean) => {
  const onDone = vi.fn(); const onFail = vi.fn(); const onClose = vi.fn();
  render(<TicketSheetV2 organiserId="o1" seriesId="s1" seriesLive={seriesLive} type={null} basePence={0} steps={[]} oneOff={false} soldMax={0} soldAll={0} pence={0} onClose={onClose} onDone={onDone} onFail={onFail} />);
  fireEvent.change(screen.getByTestId('t-price'), { target: { value: '12' } });
  fireEvent.click(screen.getByTestId('t-done'));
  return { onDone, onFail };
};

describe('the ticket sheet on a draft series', () => {
  it('flag on: the success line says the ticket goes on sale when the event goes live', async () => {
    const { onDone, onFail } = sheet(false);
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(onDone.mock.calls[0][0]).toBe(V2.ticketSheet.savedDraft);
    expect(V2.ticketSheet.savedDraft).toBe('Goes on sale when you put the event live.');
    expect(onFail).not.toHaveBeenCalled();
    expect(h.status).not.toHaveBeenCalled();
  });
  it('flag off: the normal saved line', async () => {
    Object.assign(flags, { waysInRebuild: false });
    const { onDone } = sheet(false);
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(onDone.mock.calls[0][0]).toBe(V2.ticketSheet.saved);
  });
  it('live series: on sale and the normal saved line', async () => {
    const { onDone } = sheet(true);
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(onDone.mock.calls[0][0]).toBe(V2.ticketSheet.saved);
    expect(h.status).toHaveBeenCalledWith('new1', 'on_sale');
  });
});

describe('the Ways in guide on a draft series', () => {
  const ws = (lifecycle: string) => ({ series: { id: 's1', payment_methods: 'ticket_link', lifecycle_status: lifecycle } } as unknown as EventWorkspace);
  const run = async (lifecycle: string) => {
    const say = vi.fn(); const refresh = vi.fn(); const change = vi.fn().mockResolvedValue(true);
    const save = useWaysInGuideSave({ ws: ws(lifecycle), organiserId: 'o1', ticketCount: 0, change, say, refresh });
    const out = await save({ methods: ['ticket_link'], ticket: { pence: 1200, qty: 40 }, early: null } as unknown as GuideResult);
    return { out, say };
  };
  it('saves the first ticket as a draft: success, no on_sale and no closed call', async () => {
    const { out, say } = await run('draft');
    expect(out).toEqual({ ok: true });
    expect(h.upsert).toHaveBeenCalledTimes(1);
    expect(h.status).not.toHaveBeenCalled();
    expect(say).toHaveBeenCalledWith(V2.ticketSheet.savedDraft);
  });
  it('a live series still puts the first ticket on sale', async () => {
    const { out, say } = await run('live');
    expect(out).toEqual({ ok: true });
    expect(h.status).toHaveBeenCalledWith('new1', 'on_sale');
    expect(say).toHaveBeenCalledWith(V2.ticketSheet.saved);
  });
});

// P70: the snapshot said draft, but the event went live in another tab. The go-live trigger only flips draft tickets
// AT go-live, so writeTicket re-reads the real lifecycle before leaving a new ticket a draft.
const server = (v: string | Error) => (v instanceof Error ? h.ws.mockRejectedValue(v) : h.ws.mockResolvedValue({ series: { id: 's1', lifecycle_status: v } }));

describe('writeTicket re-reads the series before leaving a new ticket a draft', () => {
  it.each([
    { name: 'prop draft, server live', prop: false, srv: 'live', reads: 1, onSale: true, out: { ok: true, id: 'new1', changed: true } },
    { name: 'prop draft, server draft', prop: false, srv: 'draft', reads: 1, onSale: false, out: { ok: true, id: 'new1', changed: true, draft: true } },
    { name: 'prop draft, server pending_review', prop: false, srv: 'pending_review', reads: 1, onSale: false, out: { ok: true, id: 'new1', changed: true, draft: true } },
    { name: 'prop draft, server rejected', prop: false, srv: 'rejected', reads: 1, onSale: false, out: { ok: true, id: 'new1', changed: true, draft: true } },
    { name: 'prop draft, read fails', prop: false, srv: new Error('network'), reads: 1, onSale: false, out: { ok: true, id: 'new1', changed: true, draft: true } },
    { name: 'prop live (unchanged, no extra read)', prop: true, srv: 'draft', reads: 0, onSale: true, out: { ok: true, id: 'new1', changed: true } },
  ])('$name', async ({ prop, srv, reads, onSale, out }) => {
    server(srv);
    const r = await writeTicket({ ...base, type: null, seriesLive: prop });
    expect(h.ws).toHaveBeenCalledTimes(reads);
    if (reads) expect(h.ws).toHaveBeenCalledWith('s1');
    if (onSale) expect(h.status).toHaveBeenCalledWith('new1', 'on_sale'); else expect(h.status).not.toHaveBeenCalled();
    expect(r).toEqual(out);
  });
  it('prop draft, server live, on_sale refused: not ok, with the created id (the sheet closes that row)', async () => {
    server('live');
    h.status.mockResolvedValue({ ok: false, reason: 'series_not_live' });
    const r = await writeTicket({ ...base, type: null, seriesLive: false });
    expect(r).toMatchObject({ ok: false, createdId: 'new1' });
    expect('error' in r && r.error.length > 0).toBe(true);
  });
  it('an existing ticket: no read and no status call', async () => {
    server('live');
    const r = await writeTicket({ ...base, basePence: 1200, type, form: { ...form, qty: 60 }, seriesLive: false });
    expect(h.ws).not.toHaveBeenCalled();
    expect(h.status).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: true, id: 't1', changed: true });
  });
});

describe('the ticket sheet when the event went live meanwhile', () => {
  const price = () => (screen.getByTestId('t-price') as HTMLInputElement).value;
  it('server live: on sale and the normal saved line', async () => {
    server('live');
    const { onDone, onFail } = sheet(false);
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(onDone.mock.calls[0][0]).toBe(V2.ticketSheet.saved);
    expect(h.status).toHaveBeenCalledWith('new1', 'on_sale');
    expect(onFail).not.toHaveBeenCalled();
  });
  it.each([
    { name: 'on_sale refused', arrange: () => { server('live'); h.status.mockImplementation((_id: string, s: string) => Promise.resolve(s === 'on_sale' ? { ok: false, reason: 'series_not_live' } : { ok: true, reason: null })); } },
    { name: 'upsert refused', arrange: () => { server('live'); h.upsert.mockResolvedValue({ ok: false, reason: null, id: null }); } },
  ])('$name: the error shows and the typed price stays in the sheet', async ({ arrange }) => {
    arrange();
    const { onDone, onFail } = sheet(false);
    await waitFor(() => expect(onFail).toHaveBeenCalled());
    expect(onDone).not.toHaveBeenCalled();
    expect(price()).toBe('12');
  });
  it('read fails: still saved as a draft, no throw', async () => {
    server(new Error('network'));
    const { onDone, onFail } = sheet(false);
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(onDone.mock.calls[0][0]).toBe(V2.ticketSheet.savedDraft);
    expect(onFail).not.toHaveBeenCalled();
  });
});
