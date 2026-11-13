// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { SHAPES, type as typeOf } from './fixtures';
import { dataMock, load, show } from './harness';
import { PRESETS_UNAVAILABLE, PRESETS_FREE, PRESETS_FULL, PRESETS_UNSAVED, PRESET_PAST, PRESET_TAKEN } from '../../../tickets/coursePresets';
import type { ManagedType, PriceStep } from '../../../tickets/priceSteps';

/*
 * T5 course create + early-bird presets, screen x shape (docs/briefs/ticket-t5-course-presets.md).
 * Dates are fixed: "now" is 2026-11-13 12:00 UTC via a faked Date.
 */
const flagState = vi.hoisted(() => ({ on: true }));
vi.mock('@/lib/featureFlags', async (orig) => {
  const m = await orig<typeof import('@/lib/featureFlags')>();
  return { ...m, flags: new Proxy(m.flags, { get: (t, k) => (k === 'ticketPriceStepsEditor' || k === 'ticketCoursePresets' ? flagState.on : Reflect.get(t, k)) }) };
});
vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-11-13' }));
vi.mock('../data', (orig) => dataMock(orig as never));
const api = vi.hoisted(() => ({
  setTicketStatus: vi.fn(),
  upsertTicketType: vi.fn(),
  refundOrder: vi.fn(),
  fetchManagedTypes: vi.fn(),
  fetchCourseDates: vi.fn(),
  setPriceStep: vi.fn(),
  removePriceStep: vi.fn(),
}));
vi.mock('../../../tickets/ticketsApi', async (orig) => ({ ...(await orig<typeof import('../../../tickets/ticketsApi')>()), ...api }));

import { TicketsEntry } from '../TicketsEntry';

const S = (id: string, at: string): PriceStep => ({ id, effectiveFrom: at, pricePence: 7000, isLive: false });
const managedRow = (base: number, steps: PriceStep[]): ManagedType => ({ id: 't-sell', basePricePence: base, effectivePricePence: base, hasOrders: false, hasPriceSteps: steps.length > 0, steps });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-13T12:00:00Z'));
  Object.values(api).forEach((f) => f.mockReset());
  flagState.on = true;
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

async function editor(base: number, steps: PriceStep[], course: { kind: string; from: string | null }) {
  load(SHAPES.selling);
  api.fetchManagedTypes.mockResolvedValue({ ok: true, reason: null, types: [managedRow(base, steps)] });
  api.fetchCourseDates.mockResolvedValue({ kind: course.kind, validFrom: course.from, validTo: course.from });
  show(<TicketsEntry seriesId="ser-1" />);
  fireEvent.click(screen.getByTestId('tix-row'));
  fireEvent.click(within(screen.getByTestId('tix-type-t-sell')).getByTestId('tix-edit'));
  await waitFor(() => expect(screen.getByTestId('tix-steps')).toBeTruthy());
  await waitFor(() => expect(api.fetchCourseDates).toHaveBeenCalledWith('t-sell'));
}
void typeOf;

describe('saved type: presets per shape', () => {
  const T: [string, number, PriceStep[], { kind: string; from: string | null }, (s: HTMLElement) => void][] = [
    ['paid course, 0 steps: 3 presets', 6000, [], { kind: 'course', from: '2027-03-01' }, (s) => {
      expect(within(s).getAllByTestId(/^tix-preset-weeks-/)).toHaveLength(3);
    }],
    ['paid course, 1 step on a preset day: that one says why', 6000, [S('a', '2027-02-15T00:00:00.000Z')], { kind: 'course', from: '2027-03-01' }, (s) => {
      expect(within(s).getByTestId('tix-preset-skipped-weeks-2').textContent).toContain(PRESET_TAKEN);
      expect(within(s).getAllByTestId(/^tix-preset-weeks-/)).toHaveLength(2);
    }],
    ['paid course, 3 steps: none, says why', 6000, [S('a', '2027-01-01T00:00:00.000Z'), S('b', '2027-01-02T00:00:00.000Z'), S('c', '2027-01-03T00:00:00.000Z')], { kind: 'course', from: '2027-03-01' }, (s) => {
      expect(within(s).getByTestId('tix-presets-blocked').textContent).toBe(PRESETS_FULL);
      expect(within(s).queryByTestId(/^tix-preset-weeks-/)).toBeNull();
    }],
    ['free course: none, says why', 0, [], { kind: 'course', from: '2027-03-01' }, (s) => {
      expect(within(s).getByTestId('tix-presets-blocked').textContent).toBe(PRESETS_FREE);
    }],
    ['start in the past: all skipped as past', 6000, [], { kind: 'course', from: '2026-10-01' }, (s) => {
      expect(within(s).queryByTestId(/^tix-preset-weeks-/)).toBeNull();
      expect(within(s).getByTestId('tix-preset-skipped-weeks-1').textContent).toContain(PRESET_PAST);
    }],
    ['start 10 days away: only 1 week offered', 6000, [], { kind: 'course', from: '2026-11-23' }, (s) => {
      expect(within(s).getAllByTestId(/^tix-preset-weeks-/)).toHaveLength(1);
      expect(within(s).getByTestId('tix-preset-skipped-weeks-4').textContent).toContain(PRESET_PAST);
    }],
    ['a per-night type: no presets block', 6000, [], { kind: 'night', from: null }, (s) => {
      expect(within(s).queryByTestId('tix-presets')).toBeNull();
    }],
  ];
  it.each(T)('%s', async (_n, base, steps, course, check) => {
    await editor(base, steps, course);
    check(screen.getByTestId('tix-steps').parentElement as HTMLElement);
  });

  it('tapping a preset opens the T3 form with the time and NO price, and writes nothing', async () => {
    await editor(6000, [], { kind: 'course', from: '2027-03-01' });
    fireEvent.click(screen.getByTestId('tix-preset-weeks-4'));
    expect((screen.getByTestId('tix-step-at') as HTMLInputElement).value).toBe('2027-02-01T00:00');
    expect((screen.getByTestId('tix-step-price') as HTMLInputElement).value).toBe('');
    expect(api.setPriceStep).not.toHaveBeenCalled();
    // saving still needs a price: nothing is sent
    fireEvent.click(screen.getByTestId('tix-step-save'));
    expect(screen.getByTestId('tix-step-price-err')).toBeTruthy();
    expect(api.setPriceStep).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId('tix-step-price'), { target: { value: '70' } });
    api.setPriceStep.mockResolvedValue({ ok: true, reason: null });
    fireEvent.click(screen.getByTestId('tix-step-save'));
    await waitFor(() => expect(api.setPriceStep).toHaveBeenCalledTimes(1));
    expect(api.setPriceStep).toHaveBeenCalledWith({ p_ticket_type_id: 't-sell', p_step_id: null, p_effective_from: '2027-02-01T00:00:00.000Z', p_price_pence: 7000 });
  });

  it('a failed course read says presets are unavailable; no row (not readable) says the same', async () => {
    for (const read of [() => Promise.reject(new Error('x')), () => Promise.resolve(null)]) {
      cleanup();
      load(SHAPES.selling);
      api.fetchManagedTypes.mockResolvedValue({ ok: true, reason: null, types: [managedRow(6000, [])] });
      api.fetchCourseDates.mockImplementation(read);
      show(<TicketsEntry seriesId="ser-1" />);
      fireEvent.click(screen.getByTestId('tix-row'));
      fireEvent.click(within(screen.getByTestId('tix-type-t-sell')).getByTestId('tix-edit'));
      expect((await screen.findByTestId('tix-presets-blocked')).textContent).toBe(PRESETS_UNAVAILABLE);
    }
  });

  it('presets are disabled while a remove is in flight', async () => {
    await editor(6000, [S('a', '2027-01-01T00:00:00.000Z')], { kind: 'course', from: '2027-03-01' });
    api.removePriceStep.mockReturnValue(new Promise(() => {}));
    fireEvent.click(screen.getByTestId('tix-step-remove'));
    fireEvent.click(screen.getByTestId('tix-step-remove-yes'));
    await waitFor(() => expect((screen.getByTestId('tix-preset-weeks-4') as HTMLButtonElement).disabled).toBe(true));
  });

  it('flag off: no presets, and the course reads never fire', async () => {
    flagState.on = false;
    load(SHAPES.selling);
    show(<TicketsEntry seriesId="ser-1" />);
    fireEvent.click(screen.getByTestId('tix-row'));
    fireEvent.click(within(screen.getByTestId('tix-type-t-sell')).getByTestId('tix-edit'));
    expect(screen.queryByTestId('tix-presets')).toBeNull();
    expect(api.fetchCourseDates).not.toHaveBeenCalled();
  });
});

describe('new ticket: course create', () => {
  const input = (id: string, v: string) => fireEvent.change(screen.getByTestId(id), { target: { value: v } });
  function open() {
    load(SHAPES.bare);
    show(<TicketsEntry seriesId="ser-1" />);
    fireEvent.click(screen.getByTestId('tix-row'));
    fireEvent.click(screen.getByTestId('tix-add'));
  }
  it('Course shows start and end; missing dates stop Continue with a reason', () => {
    open();
    expect(screen.queryByTestId('tix-form-validFrom')).toBeNull();
    fireEvent.click(screen.getByTestId('tix-kind-course'));
    input('tix-form-name', 'Term 1');
    input('tix-form-price', '60');
    expect(screen.getByTestId('tix-presets-unsaved').textContent).toBe(PRESETS_UNSAVED);
    fireEvent.click(screen.getByTestId('tix-next'));
    expect(screen.getByTestId('tix-err-validFrom')).toBeTruthy();
    expect(screen.getByTestId('tix-err-validTo')).toBeTruthy();
    expect(screen.getByTestId('tix-step').textContent).toBe('1 / 3');
  });
  it('end before start is refused; valid dates reach the create wrapper with kind course', async () => {
    open();
    api.upsertTicketType.mockResolvedValue({ ok: true, reason: null, id: 'new-1' });
    fireEvent.click(screen.getByTestId('tix-kind-course'));
    input('tix-form-name', 'Term 1');
    input('tix-form-price', '60');
    input('tix-form-validFrom', '2027-03-01');
    input('tix-form-validTo', '2027-02-01');
    fireEvent.click(screen.getByTestId('tix-next'));
    expect(screen.getByTestId('tix-err-validTo')).toBeTruthy();
    input('tix-form-validTo', '2027-05-10');
    fireEvent.click(screen.getByTestId('tix-next'));
    input('tix-form-capacity', '20');
    fireEvent.click(screen.getByTestId('tix-next'));
    fireEvent.click(screen.getByTestId('tix-save'));
    await waitFor(() => expect(api.upsertTicketType).toHaveBeenCalledTimes(1));
    expect(api.upsertTicketType.mock.calls[0][0]).toMatchObject({ kind: 'course', validFrom: '2027-03-01', validTo: '2027-05-10', occurrenceId: null, pricePence: 6000 });
  });
  it('flag off: no kind chips', () => {
    flagState.on = false;
    open();
    expect(screen.queryByTestId('tix-kind-course')).toBeNull();
  });
});
