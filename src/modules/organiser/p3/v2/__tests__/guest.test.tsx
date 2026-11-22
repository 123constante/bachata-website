// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

const h = vi.hoisted(() => ({ flag: true, read: vi.fn(), set: vi.fn() }));
vi.mock('@/lib/featureFlags', async (orig) => {
  const m = await orig<{ flags: Record<string, unknown> }>();
  return { ...m, flags: new Proxy(m.flags, { get: (t, k) => (k === 'organiserGuestListLive' ? h.flag : t[k as string]) }) };
});
vi.mock('../../guestlist/guestListApi', () => ({ readNight: (...a: unknown[]) => h.read(...a), setNight: (...a: unknown[]) => h.set(...a) }));
vi.mock('../../guestlist/GuestListSheet', () => ({ GL_KEY: 'organiser-guest-list' }));
import { GuestRow } from '../GuestSheet';
import { parseRead } from '../../guestlist/guestListModel';
import { V2Toast, type V2ToastState } from '../V2Toast';

const view = (o: Record<string, unknown> = {}, entries: unknown[] = [], total?: number) => ({
  ok: true, role: 'owner', canEdit: true, canCheckIn: true, readOnly: null,
  night: { occurrenceId: 'o1', enabled: true, capacityMax: 40, cutoffTime: '22:00', closed: false, full: false, past: false, cancelled: false, ...o },
  counts: { names: entries.length, inCount: 0, placesLeft: null }, total: total ?? entries.length, entries,
});
const ent = (id: string, firstName: string, plusOnes = 0) => ({ id, firstName, everyWeek: false, waitlist: false, byTeam: false, checkedIn: false, plusOnes });

function Host() {
  const [t, setT] = useState<V2ToastState | null>(null);
  return (
    <>
      <GuestRow occurrenceId="o1" longDate="Thursday 26 November" link="https://x.test/event/thu" toast={(text) => setT((p) => ({ seq: (p?.seq ?? 0) + 1, text }))} />
      <V2Toast toast={t} onDone={() => setT(null)} />
    </>
  );
}
const at = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Host /></QueryClientProvider>);
const open = async () => { fireEvent.click(await screen.findByTestId('hub-guest')); };

beforeEach(() => { h.flag = true; h.read.mockReset(); h.set.mockReset().mockResolvedValue({ ok: true }); });
afterEach(cleanup);

describe('guest row', () => {
  it('is hidden when the flag is off', () => {
    h.flag = false; h.read.mockResolvedValue(view());
    at();
    expect(screen.queryByTestId('hub-guest')).toBeNull();
  });
  it.each(['night_not_found', 'not_on_team'])('is hidden on %s', async (reason) => {
    h.read.mockResolvedValue({ ok: false, reason });
    at();
    await waitFor(() => expect(h.read).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId('hub-guest')).toBeNull());
  });
  it('pill: 3 names, 1 name, Off', async () => {
    h.read.mockResolvedValue(view({}, [ent('a', 'A'), ent('b', 'B'), ent('c', 'C')]));
    at();
    expect((await screen.findByTestId('hub-guest-pill')).textContent).toBe('On · 3 names');
    cleanup();
    h.read.mockResolvedValue(view({}, [ent('a', 'A')]));
    at();
    expect((await screen.findByTestId('hub-guest-pill')).textContent).toBe('On · 1 name');
    cleanup();
    h.read.mockResolvedValue(view({ enabled: false }));
    at();
    const p = await screen.findByTestId('hub-guest-pill');
    expect(p.textContent).toBe('Off');
    expect(p.className).toContain('off');
  });
  it('shows no pill while loading', () => {
    h.read.mockReturnValue(new Promise(() => undefined));
    at();
    expect(screen.getByTestId('hub-guest')).toBeTruthy();
    expect(screen.queryByTestId('hub-guest-pill')).toBeNull();
  });
});

describe('guest sheet', () => {
  it('off text exact, no link', async () => {
    h.read.mockResolvedValue(view({ enabled: false }));
    at(); await open();
    expect((await screen.findByTestId('guest-off')).textContent).toBe('Off. Dancers cannot put their name down. Turn it on to get a link to share.');
    expect(screen.queryByTestId('guest-link')).toBeNull();
  });
  it('on: count line with date, names with +N, link', async () => {
    h.read.mockResolvedValue(view({}, [ent('a', 'Aisha', 1), ent('b', 'Tom'), ent('c', 'Lucia', 2)]));
    at(); await open();
    expect((await screen.findByTestId('guest-count')).textContent).toBe('3 names for Thursday 26 November.');
    const rows = Array.from(screen.getByTestId('guest-names').querySelectorAll('.row')).map((r) => r.textContent);
    expect(rows).toEqual(['Aisha+1', 'Tom', 'Lucia+2']);
    expect(screen.getByTestId('guest-link').textContent).toBe('https://x.test/event/thu');
  });
  it('one name is singular; none says No names yet.; cap line', async () => {
    h.read.mockResolvedValue(view({}, [ent('a', 'Aisha')], 60));
    at(); await open();
    expect((await screen.findByTestId('guest-count')).textContent).toBe('1 name for Thursday 26 November.');
    expect(screen.getByTestId('guest-cap').textContent).toBe('Showing 1 of 60.');
    cleanup();
    h.read.mockResolvedValue(view({}, []));
    at(); await open();
    expect((await screen.findByTestId('guest-none')).textContent).toBe('No names yet.');
    expect(screen.queryByTestId('guest-names')).toBeNull();
  });
  it('switch keeps places and closing time, toasts with no Undo, sheet stays open', async () => {
    h.read.mockResolvedValue(view({ enabled: false }));
    at(); await open();
    const sw = await screen.findByTestId('guest-switch');
    expect(sw.getAttribute('aria-checked')).toBe('false');
    h.read.mockResolvedValue(view({}, []));
    fireEvent.click(sw);
    await waitFor(() => expect(h.set).toHaveBeenCalledWith('o1', true, 40, '22:00'));
    expect(await screen.findByText('Guest list on')).toBeTruthy();
    expect(screen.queryByText(/undo/i)).toBeNull();
    await waitFor(() => expect(screen.getByTestId('guest-switch').getAttribute('aria-checked')).toBe('true'));
  });
  it('switch off toasts "Guest list off"', async () => {
    h.read.mockResolvedValue(view({}, []));
    at(); await open();
    h.read.mockResolvedValue(view({ enabled: false }));
    fireEvent.click(await screen.findByTestId('guest-switch'));
    await waitFor(() => expect(h.set).toHaveBeenCalledWith('o1', false, 40, '22:00'));
    expect(await screen.findByText('Guest list off')).toBeTruthy();
  });
  it('failed setNight toasts the reason and leaves the switch', async () => {
    h.read.mockResolvedValue(view({ enabled: false }));
    h.set.mockResolvedValue({ ok: false, reason: 'past' });
    at(); await open();
    fireEvent.click(await screen.findByTestId('guest-switch'));
    expect(await screen.findByText(/This night is over/)).toBeTruthy();
    expect(screen.getByTestId('guest-switch').getAttribute('aria-checked')).toBe('false');
  });
  it('readOnly disables the switch and says why', async () => {
    h.read.mockResolvedValue({ ...view({ enabled: false }), canEdit: false, readOnly: 'cancelled' });
    at(); await open();
    const sw = await screen.findByTestId('guest-switch');
    expect((sw as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('guest-readonly').textContent).toMatch(/This night is cancelled/);
    fireEvent.click(sw);
    expect(h.set).not.toHaveBeenCalled();
  });
  it('copy link: success and blocked toasts', async () => {
    h.read.mockResolvedValue(view({}, []));
    const w = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: w } });
    at(); await open();
    fireEvent.click(await screen.findByTestId('guest-copy'));
    await waitFor(() => expect(w).toHaveBeenCalledWith('https://x.test/event/thu'));
    expect(await screen.findByText('Link copied')).toBeTruthy();
    w.mockRejectedValue(new Error('no'));
    fireEvent.click(screen.getByTestId('guest-copy'));
    expect(await screen.findByText('Select the link to copy it')).toBeTruthy();
  });
});

describe('parseRead plus_ones', () => {
  it('maps plus_ones and defaults to 0', () => {
    const r = parseRead({ ok: true, night: {}, counts: {}, entries: [{ id: 'a', first_name: 'A', plus_ones: 2 }, { id: 'b', first_name: 'B' }] });
    expect(r.ok && r.entries.map((e) => e.plusOnes)).toEqual([2, 0]);
  });
});
