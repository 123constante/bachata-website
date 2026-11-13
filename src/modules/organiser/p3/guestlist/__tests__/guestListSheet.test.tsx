// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseRead } from '../guestListModel';

const h = vi.hoisted(() => ({ flag: true, api: {} as Record<string, ReturnType<typeof vi.fn>> }));
vi.mock('@/lib/featureFlags', () => ({ flags: { get organiserGuestListLive() { return h.flag; } } }));
vi.mock('../../../shared/support', () => ({ supportLinks: () => ({ email: 'help@example.test', whatsapp: null }) }));
vi.mock('../../door/camera', () => ({ useScanner: () => ({ state: 'ask', start: vi.fn(), denials: 0 }), browserDeps: {} }));
vi.mock('../../../shared/runCommands', () => ({ useEventWorkspace: () => ({ isPending: false, isError: false, data: { hasMore: false, dates: [{ id: 'occ1', occurrence_date: '2026-11-13' }] } }) }));
vi.mock('../../data/olderDates', () => ({ useOlderDates: () => ({ isPending: false, isError: false, data: undefined }), withOlder: (a: unknown) => a }));
vi.mock('../guestListApi', async (orig) => {
  const real = await orig<typeof import('../guestListApi')>();
  const f = (n: string) => (h.api[n] = vi.fn());
  return { ...real, readNight: f('readNight'), setNight: f('setNight'), addName: f('addName'), removeName: f('removeName'), restoreName: f('restoreName'), checkIn: f('checkIn'), undoCheckIn: f('undoCheckIn'), scan: f('scan') };
});
import { GuestListLive, GuestListRow, GuestListSheet } from '../GuestListSheet';

const entry = (id: string, n: string, o: Record<string, unknown> = {}) => ({ id, first_name: n, status: 'active', is_permanent: false, added_via: 'self', checked_in_at: null, ...o });
const body = (o: Record<string, unknown> = {}, n: Record<string, unknown> = {}) => ({
  ok: true, role: 'owner', can_edit: true, can_check_in: true, read_only_reason: null,
  night: { occurrence_id: 'occ1', enabled: true, capacity_max: 60, cutoff_time: '22:00', closed: false, full: false, past: false, cancelled: false, ...n },
  counts: { names: 2, in: 1, places_left: 58 }, total: 2, entries: [entry('e1', 'Ana'), entry('e2', 'Quin', { checked_in_at: 'x' })], ...o,
});
const draw = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><GuestListLive occurrenceId="occ1" title="Night" onClose={vi.fn()} /></QueryClientProvider>);
const night = { key: 'k', seriesId: 's', name: 'Party', date: '2026-11-13', dayLabel: 'Friday', sub: '', status: 'live', cancel: { ok: true, why: null }, canEdit: true, canDelete: false, moreDates: 0, openId: 's' } as never;

beforeEach(() => { h.flag = true; });
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const read = (b: unknown) => h.api.readNight.mockResolvedValue(parseRead(b));

describe('flag off', () => {
  it('shows Coming soon with a way to tell us, and calls no RPC', () => {
    h.flag = false;
    render(<><GuestListRow night={night} onOpen={vi.fn()} /><GuestListSheet night={night} onClose={vi.fn()} /></>);
    expect(screen.getByTestId('gl-soon').textContent).toMatch(/Coming soon/);
    expect((screen.getByTestId('gl-tell-us') as HTMLAnchorElement).href).toMatch(/^mailto:help@example.test/);
    expect(Object.values(h.api).every((f) => f.mock.calls.length === 0)).toBe(true);
  });
});

describe('live shapes', () => {
  it('loading then names; error says nothing changed', async () => {
    h.api.readNight.mockReturnValue(new Promise(() => {}));
    draw();
    expect(screen.getByTestId('gl-loading')).toBeTruthy();
    cleanup();
    h.api.readNight.mockRejectedValue(new Error('x'));
    draw();
    expect((await screen.findByTestId('gl-error')).textContent).toMatch(/Nothing was changed/);
  });
  it('refused (not on team) says why', async () => {
    h.api.readNight.mockResolvedValue({ ok: false, reason: 'not_on_team' });
    draw();
    expect((await screen.findByTestId('gl-refused')).textContent).toMatch(/not on this page/);
  });
  it('contributor: everything that changes is disabled and the reason is on screen once', async () => {
    read(body({ role: 'contributor', can_edit: false, can_check_in: false, read_only_reason: 'view_only' }));
    draw();
    expect((await screen.findByTestId('gl-why')).textContent).toMatch(/Contributors can look/);
    expect((screen.getByTestId('gl-add-go') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getAllByTestId('gl-remove')[0] as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('gl-tab-settings'));
    expect((screen.getByTestId('gl-switch') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByTestId('gl-save') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('gl-tab-door'));
    expect((screen.getByTestId('gl-scan') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getAllByTestId('gl-check')[0] as HTMLButtonElement).disabled).toBe(true);
    expect(h.api.addName).not.toHaveBeenCalled();
    expect((document.body.textContent ?? '').split('Contributors can look').length - 1).toBe(1); // said once
  });
  it('empty list says what to do; 63 names page 50 at a time', async () => {
    read(body({ entries: [], total: 0 }, {}));
    draw();
    expect((await screen.findByTestId('gl-empty')).textContent).toMatch(/Add one above/);
    cleanup();
    read(body({ total: 63 }));
    draw();
    expect((await screen.findByTestId('gl-more')).textContent).toMatch(/Show 50 more \(2 of 63 shown\)/);
  });
  it('past night: view only with the reason', async () => {
    read(body({ can_edit: false, read_only_reason: 'past' }, { past: true }));
    draw();
    expect((await screen.findByTestId('gl-banner')).textContent).toMatch(/This night is over/);
    expect((screen.getByTestId('gl-add-go') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('writes', () => {
  it('add sends the trimmed name for this night, then reads again', async () => {
    read(body());
    h.api.addName.mockResolvedValue({ ok: true });
    draw();
    const input = await screen.findByTestId('gl-add-name');
    expect((screen.getByTestId('gl-add-go') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(input, { target: { value: '  Sol ' } });
    fireEvent.click(screen.getByTestId('gl-add-go'));
    await waitFor(() => expect(h.api.addName).toHaveBeenCalledWith('occ1', 'Sol', false));
    expect((await screen.findByTestId('gl-note')).textContent).toBe('Sol added.');
    expect(h.api.readNight.mock.calls.length).toBeGreaterThan(1);
  });
  it('a refusal is said in words and nothing else happens', async () => {
    read(body());
    h.api.addName.mockResolvedValue({ ok: false, reason: 'duplicate_name' });
    draw();
    fireEvent.change(await screen.findByTestId('gl-add-name'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByTestId('gl-add-go'));
    expect((await screen.findByTestId('gl-note')).textContent).toMatch(/already on this night/);
  });
  it('remove then Undo restores', async () => {
    read(body());
    h.api.removeName.mockResolvedValue({ ok: true });
    h.api.restoreName.mockResolvedValue({ ok: true });
    draw();
    const first = (await screen.findAllByTestId('gl-remove'))[0];
    read(body({ entries: [entry('e2', 'Quin')], total: 1 })); // what the list reads after the remove
    fireEvent.click(first);
    await waitFor(() => expect(h.api.removeName).toHaveBeenCalledWith('e1', 'occ1'));
    fireEvent.click(await screen.findByTestId('gl-undo'));
    await waitFor(() => expect(h.api.restoreName).toHaveBeenCalledWith('e1', 'occ1'));
  });
  it('settings: untouched Save is disabled with its reason and sends nothing; a change sends once', async () => {
    read(body());
    h.api.setNight.mockResolvedValue({ ok: true });
    draw();
    fireEvent.click(await screen.findByTestId('gl-tab-settings'));
    const save = screen.getByTestId('gl-save') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(screen.getByTestId('gl-settings-why').textContent).toMatch(/Change places/);
    fireEvent.change(screen.getByTestId('gl-places'), { target: { value: '80' } });
    fireEvent.click(save);
    await waitFor(() => expect(h.api.setNight).toHaveBeenCalledTimes(1));
    expect(h.api.setNight).toHaveBeenCalledWith('occ1', true, 80, '22:00');
  });
  it('switch off sends enabled=false with the night’s own places and closing time', async () => {
    read(body());
    h.api.setNight.mockResolvedValue({ ok: true });
    draw();
    fireEvent.click(await screen.findByTestId('gl-tab-settings'));
    fireEvent.click(screen.getByTestId('gl-switch'));
    await waitFor(() => expect(h.api.setNight).toHaveBeenCalledWith('occ1', false, 60, '22:00'));
  });
  it('door: check in, and Undo for someone already in', async () => {
    read(body());
    h.api.checkIn.mockResolvedValue({ ok: true });
    h.api.undoCheckIn.mockResolvedValue({ ok: true });
    draw();
    fireEvent.click(await screen.findByTestId('gl-tab-door'));
    expect(screen.getByTestId('gl-door-count').textContent).toBe('1 of 2 in');
    const btns = await screen.findAllByTestId('gl-check');
    expect(btns.map((b) => b.textContent)).toEqual(['Check in', 'Undo']);
    fireEvent.click(btns[0]);
    await waitFor(() => expect(h.api.checkIn).toHaveBeenCalledWith('e1', 'occ1'));
    fireEvent.click(btns[1]);
    await waitFor(() => expect(h.api.undoCheckIn).toHaveBeenCalledWith('e2', 'occ1'));
  });
});
