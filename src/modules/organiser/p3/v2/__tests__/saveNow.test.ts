// @vitest-environment jsdom
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const net = vi.hoisted(() => ({ series: vi.fn(), occ: vi.fn(), prog: vi.fn() }));
vi.mock('../../../shared/runCommands', () => ({
  eventWorkspaceQueryKey: (id: string) => ['ws', id],
  useSendOnce: () => (command: unknown, version: number | null, key: string) => net.series(command, version, key),
}));
vi.mock('../../../shared/selfServeApi', () => ({
  dateDetailQueryKey: (id: string) => ['d', id],
  occurrenceProgrammeQueryKey: (id: string) => ['p', id],
  runOccurrenceCommand: (env: unknown) => net.occ(env),
  saveOccurrenceProgramme: (id: string, v: number, payload: unknown) => net.prog(id, v, payload),
}));
vi.mock('@/modules/organiser/shared/publicCache', () => ({ invalidatePublicEventCaches: () => undefined }));
import { inverseOf, type WriteStep } from '../editorModel';
import { SAVED_TEXT, UNDONE_TEXT, undoPlan, useSaveNow } from '../saveNow';
import { V2Toast, type V2ToastState } from '../V2Toast';

const ser = (kind: string, payload: Record<string, unknown>): WriteStep =>
  ({ part: 'p', target: 'series', id: 's1', version: null, command: { kind: kind as never, payload }, order: 0 });
const occ = (kind: string, payload: Record<string, unknown>, version = 4): WriteStep =>
  ({ part: 'p', target: 'occurrence', id: 'o1', version, command: { kind: kind as never, payload }, order: 1 });
const prog = (payload: Record<string, unknown>[]): WriteStep =>
  ({ part: 'p', target: 'programme', id: 'o1', version: 4, command: null, payload, order: 2 });

/** every kind writePlan / the editor sends: [step, before, expected inverse command or payload] */
const KINDS: [string, WriteStep, Record<string, unknown>, unknown][] = [
  ['series.upsert', ser('series.upsert', { name: 'New', default_description: 'x' }), { name: 'Old', default_description: null }, { kind: 'series.upsert', payload: { name: 'Old', default_description: null } }],
  ['series.set_recurrence', ser('series.set_recurrence', { mode: 'weekly', weekdays: [2], end: { kind: 'none' } }), { mode: 'weekly', weekdays: [1], end: { kind: 'none' } }, { kind: 'series.set_recurrence', payload: { mode: 'weekly', weekdays: [1], end: { kind: 'none' } } }],
  ['series.set_lifecycle', ser('series.set_lifecycle', { to: 'paused' }), { to: 'live' }, { kind: 'series.set_lifecycle', payload: { to: 'live' } }],
  ['series.set_program', ser('series.set_program', { days: [1] }), { days: [0] }, { kind: 'series.set_program', payload: { days: [0] } }],
  ['series.set_organisers', ser('series.set_organisers', { organiser_ids: ['a'] }), { organiser_ids: ['b', 'c'] }, { kind: 'series.set_organisers', payload: { organiser_ids: ['b', 'c'] } }],
  ['occurrence.set_override', occ('occurrence.set_override', { title: 'T', venue_id: 'v2' }), { title: null, venue_id: 'v1' }, { kind: 'occurrence.set_override', payload: { title: null, venue_id: 'v1' } }],
  ['occurrence.set_time (had own)', occ('occurrence.set_time', { new_local_start: '20:00', new_local_end: null }), { new_local_start: '19:00', new_local_end: '23:00' }, { kind: 'occurrence.set_time', payload: { new_local_start: '19:00', new_local_end: '23:00' } }],
  ['occurrence.set_time (had none)', occ('occurrence.set_time', { new_local_start: '20:00', new_local_end: null }), { reset: true }, { kind: 'occurrence.set_time', payload: { reset: true } }],
  ['occurrence.cancel', occ('occurrence.cancel', { cancelled: true, reason: 'ill' }), { cancelled: false }, { kind: 'occurrence.cancel', payload: { cancelled: false } }],
  ['occurrence.cancel (bring back)', occ('occurrence.cancel', { cancelled: false }), { cancelled: true, reason: 'ill' }, { kind: 'occurrence.cancel', payload: { cancelled: true, reason: 'ill' } }],
];

describe('inverseOf', () => {
  it.each(KINDS)('%s puts the old value back', (_n, step, before, expected) => {
    expect(inverseOf(step, before)?.command).toEqual(expected);
  });
  it('programme replace puts the old sessions list back', () => {
    const old = [{ id: 'a' }];
    const inv = inverseOf(prog([{ id: 'b' }]), { payload: old });
    expect(inv?.target).toBe('programme');
    expect(inv?.payload).toEqual(old);
  });
  it.each(KINDS)('round trip: %s inverse of the inverse is the original', (_n, step, before) => {
    const inv = inverseOf(step, before)!;
    const back = inverseOf(inv, step.command!.payload)!;
    // the original keys come back with the original values
    for (const k of Object.keys(step.command!.payload)) expect(back.command!.payload[k]).toEqual(step.command!.payload[k]);
  });
  it('no safe inverse: nothing read, a key the read missed, unknown kind', () => {
    expect(inverseOf(KINDS[0][1], null)).toBeNull();
    expect(inverseOf(KINDS[0][1], { name: 'Old' })).toBeNull();
    expect(inverseOf(ser('series.add_date', { date: 'x' }), { date: 'x' })).toBeNull();
    expect(inverseOf(prog([]), {})).toBeNull();
  });
  it('undoPlan runs the inverses in reverse and is null when one step has none', () => {
    const a = ser('series.upsert', { name: 'N' }); const b = occ('occurrence.set_override', { title: 'T' }); const c = prog([]);
    const plan = undoPlan([a, b, c], [{ name: 'O' }, { title: null }, { payload: [] }])!;
    expect(plan.map((s) => s.target)).toEqual(['programme', 'occurrence', 'series']);
    // the override bumped o1 to 5, so the programme inverse goes against 6 and the override inverse against 5
    expect(plan.map((s) => s.version)).toEqual([6, 5, null]);
    expect(undoPlan([a, b], [{ name: 'O' }, null])).toBeNull();
  });
});

const wrap = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { enabled: false, retry: false } } }) }, children);
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe('useSaveNow', () => {
  beforeEach(() => { vi.useFakeTimers(); net.series.mockReset().mockResolvedValue({ new_version: 9 }); net.occ.mockReset().mockResolvedValue({ new_version: 5 }); net.prog.mockReset().mockResolvedValue({ version: 5 }); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });
  const hook = () => renderHook(() => useSaveNow('s1', 3), { wrapper: wrap });
  const ui = (h: ReturnType<typeof hook>) => render(createElement(V2Toast, { toast: h.result.current.toast, onDone: h.result.current.onToastDone }));

  it('success shows Saved with Undo for 8000 ms; Undo runs inverses in reverse and shows Undone 2200 ms', async () => {
    const h = hook();
    const steps = [ser('series.upsert', { name: 'N' }), occ('occurrence.set_override', { title: 'T' })];
    await act(async () => { await h.result.current.saveNow(steps, [{ name: 'O' }, { title: null }]); });
    expect(h.result.current.toast?.text).toBe(SAVED_TEXT);
    expect(h.result.current.toast?.onUndo).toBeTypeOf('function');
    net.series.mockClear();
    await act(async () => { h.result.current.toast!.onUndo!(); });
    await flush();
    const first = net.occ.mock.invocationCallOrder[1]; const second = net.series.mock.invocationCallOrder[0];
    expect(first).toBeLessThan(second); // night first, event last
    expect(net.occ).toHaveBeenLastCalledWith(expect.objectContaining({ target_id: 'o1', expected_version: 5 }));
    expect(h.result.current.toast?.text).toBe(UNDONE_TEXT);
    expect(h.result.current.toast?.onUndo).toBeUndefined();
  });
  it('toast times: 8000 with Undo, 2200 without, a new toast resets the timer', async () => {
    const h = hook();
    await act(async () => { await h.result.current.saveNow([ser('series.upsert', { name: 'N' })], [{ name: 'O' }]); });
    const v = ui(h);
    expect(screen.getByTestId('v2-toast-undo')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(7999); });
    expect(screen.queryByTestId('v2-toast')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(1); });
    expect(h.result.current.toast).toBeNull();
    v.unmount();
    await act(async () => { await h.result.current.saveNow([ser('series.upsert', { name: 'N' })], [], 'Link copied'); });
    expect(h.result.current.toast?.onUndo).toBeUndefined();
    ui(h);
    expect(screen.queryByTestId('v2-toast-undo')).toBeNull();
    act(() => { vi.advanceTimersByTime(2199); });
    expect(h.result.current.toast).not.toBeNull();
    act(() => { vi.advanceTimersByTime(1); });
    expect(h.result.current.toast).toBeNull();
  });
  it('a kind with no inverse shows the toast without Undo; noUndo does too', async () => {
    const h = hook();
    await act(async () => { await h.result.current.saveNow([ser('series.upsert', { name: 'N' })], [null]); });
    expect(h.result.current.toast?.text).toBe(SAVED_TEXT);
    expect(h.result.current.toast?.onUndo).toBeUndefined();
    await act(async () => { await h.result.current.saveNow([ser('series.upsert', { name: 'N' })], [{ name: 'O' }], 'Cancelled', { noUndo: true }); });
    expect(h.result.current.toast?.onUndo).toBeUndefined();
  });
});

describe('useSaveNow (real timers)', () => {
  beforeEach(() => { net.series.mockReset().mockResolvedValue({ new_version: 9 }); });
  afterEach(cleanup);
  const hook = () => renderHook(() => useSaveNow('s1', 3), { wrapper: wrap });

  it('failure shows no toast and returns the error text, nothing undone', async () => {
    net.series.mockRejectedValue(new Error('boom'));
    const h = hook();
    const r = await h.result.current.saveNow([ser('series.upsert', { name: 'N' })], [{ name: 'O' }]);
    expect(r.ok).toBe(false);
    expect(typeof r.error).toBe('string');
    expect(r.error).not.toBe('');
    expect(h.result.current.toast).toBeNull();
    expect(net.series).toHaveBeenCalledTimes(1);
  });
  it('a second tap during a run is ignored', async () => {
    let release!: (v: unknown) => void;
    net.series.mockReturnValue(new Promise((res) => { release = res; }));
    const h = hook();
    const a = h.result.current.saveNow([ser('series.upsert', { name: 'N' })], [{ name: 'O' }]);
    const b = await h.result.current.saveNow([ser('series.upsert', { name: 'N2' })], [{ name: 'O' }]);
    release({ new_version: 4 });
    expect((await a).ok).toBe(true);
    expect(b.ok).toBe(false);
    expect(net.series).toHaveBeenCalledTimes(1);
  });
});

describe('V2Toast box at 390x844', () => {
  afterEach(cleanup);
  it('sits 12px in from each side and 76px up, inside the viewport', () => {
    const t: V2ToastState = { seq: 1, text: 'Saved', onUndo: () => undefined };
    render(createElement(V2Toast, { toast: t, onDone: () => undefined }));
    const el = screen.getByTestId('v2-toast');
    expect(el.parentElement).toBe(document.body);
    expect(el.getAttribute('role')).toBe('status');
    const css = el.style;
    expect([css.position, css.left, css.right, css.bottom, css.fontSize, css.borderRadius]).toEqual(['fixed', '12px', '12px', '76px', '15px', '10px']);
    const w = 390; const h = 844;
    const box = { left: 12, right: w - 12, bottom: h - 76 };
    expect(box.left).toBeGreaterThanOrEqual(0); expect(box.right).toBeLessThanOrEqual(w); expect(box.bottom).toBeLessThanOrEqual(h);
    const btn = screen.getByTestId('v2-toast-undo');
    expect([btn.style.minHeight, btn.style.fontWeight, btn.style.borderWidth, btn.style.borderStyle]).toEqual(['36px', '600', '1px', 'solid']);
  });
});
