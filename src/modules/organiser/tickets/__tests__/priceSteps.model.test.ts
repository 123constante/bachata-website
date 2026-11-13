import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_STEPS,
  STEPS_FREE,
  STEPS_FULL,
  addBlock,
  buildStepCommand,
  isAmbiguousTime,
  parseManage,
  stepReasonMessage,
  timeDoesNotExist,
  validateStep,
  TIME_DOES_NOT_EXIST,
} from '../priceSteps';

/* T3 price steps: the pure mapping (s.2c time rules, R3-7 command shape) and the wire (exact RPC names and args). */

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
import { fetchManagedTypes, removePriceStep, setPriceStep } from '../ticketsApi';

describe('London time (s.2c), both clock changes', () => {
  it.each([
    ['2027-03-28T00:30', false, false],
    ['2027-03-28T01:00', true, false],
    ['2027-03-28T01:30', true, false],
    ['2027-03-28T02:00', false, false],
    ['2026-10-25T00:59', false, false],
    ['2026-10-25T01:00', false, true],
    ['2026-10-25T01:30', false, true],
    ['2026-10-25T02:00', false, false],
    ['2027-01-10T19:00', false, false],
  ])('%s: missing=%s ambiguous=%s', (v, missing, ambiguous) => {
    expect(timeDoesNotExist(v)).toBe(missing);
    expect(isAmbiguousTime(v)).toBe(ambiguous);
    expect(validateStep({ at: v, price: '15' }).at).toBe(missing ? TIME_DOES_NOT_EXIST : undefined);
  });
});

describe('buildStepCommand', () => {
  const S = { id: 's1', effectiveFrom: '2027-01-10T19:00:00+00:00', pricePence: 1500, isLive: false };
  it.each([
    ['add', null, { at: '2027-01-10T19:00', price: '15' }, { p_ticket_type_id: 't', p_step_id: null, p_effective_from: '2027-01-10T19:00:00.000Z', p_price_pence: 1500 }],
    ['untouched move (server text form of the same instant)', S, { at: '2027-01-10T19:00', price: '15.00' }, null],
    ['move price only', S, { at: '2027-01-10T19:00', price: '14' }, { p_ticket_type_id: 't', p_step_id: 's1', p_effective_from: '2027-01-10T19:00:00.000Z', p_price_pence: 1400 }],
    ['move time only, into BST', S, { at: '2027-04-10T19:00', price: '15' }, { p_ticket_type_id: 't', p_step_id: 's1', p_effective_from: '2027-04-10T18:00:00.000Z', p_price_pence: 1500 }],
  ] as const)('%s', (_n, original, form, want) => {
    expect(buildStepCommand('t', form, original)).toEqual(want);
  });
});

describe('addBlock', () => {
  const st = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `s${i}`, effectiveFrom: '2027-01-01T00:00:00Z', pricePence: 100 + i, isLive: false }));
  it.each([
    [1200, 0, null],
    [1200, 2, null],
    [1200, MAX_STEPS, STEPS_FULL],
    [0, 0, STEPS_FREE],
  ])('base %s, %s steps', (base, n, want) => expect(addBlock({ basePricePence: base, steps: st(n) })).toBe(want));
});

describe('parseManage', () => {
  it('maps the row and sorts steps; refusal carries its word', () => {
    const r = parseManage({
      ok: true,
      ticket_types: [{ id: 't', base_price_pence: 1200, effective_price_pence: 1500, has_orders: true, has_price_steps: true, steps: [
        { id: 'b', effective_from: '2027-02-01T00:00:00+00:00', price_pence: 1800, is_live: false },
        { id: 'a', effective_from: '2026-11-01T00:00:00+00:00', price_pence: 1500, is_live: true },
      ] }],
    });
    expect(r.types[0]).toMatchObject({ id: 't', basePricePence: 1200, effectivePricePence: 1500, hasOrders: true, hasPriceSteps: true });
    expect(r.types[0].steps.map((s) => [s.id, s.isLive])).toEqual([['a', true], ['b', false]]);
    expect(parseManage({ ok: false, reason: 'invalid_payload' })).toEqual({ ok: false, reason: 'invalid_payload', types: [] });
  });
  it('every documented refusal has its own words', () => {
    for (const r of ['reserve_not_ready', 'too_many_steps', 'not_paid_ticket', 'step_in_past', 'out_of_order', 'same_price', 'invalid_price', 'not_found', 'has_price_steps', 'time_does_not_exist'])
      expect(stepReasonMessage(r)).not.toBe(stepReasonMessage('???'));
  });
});

describe('wire: exact RPC names and arguments', () => {
  beforeEach(() => rpc.mockReset().mockResolvedValue({ data: { ok: true, step_id: 'x' }, error: null }));
  it('set', async () => {
    const cmd = { p_ticket_type_id: 't', p_step_id: null, p_effective_from: '2027-01-10T19:00:00.000Z', p_price_pence: 1500 };
    expect(await setPriceStep(cmd)).toMatchObject({ ok: true });
    expect(rpc).toHaveBeenCalledWith('ticket_price_step_set_v1', cmd);
  });
  it('remove', async () => {
    await removePriceStep('s1');
    expect(rpc).toHaveBeenCalledWith('ticket_price_step_remove_v1', { p_step_id: 's1' });
  });
  it('manage read', async () => {
    rpc.mockResolvedValue({ data: { ok: true, ticket_types: [] }, error: null });
    expect(await fetchManagedTypes('ser')).toEqual({ ok: true, reason: null, types: [] });
    expect(rpc).toHaveBeenCalledWith('ticket_types_manage_v1', { p_event_series_id: 'ser' });
  });
  it('a refusal is not ok', async () => {
    rpc.mockResolvedValue({ data: { ok: false, reason: 'reserve_not_ready' }, error: null });
    expect(await setPriceStep({ p_ticket_type_id: 't', p_step_id: null, p_effective_from: 'x', p_price_pence: 1 })).toEqual({ ok: false, reason: 'reserve_not_ready' });
  });
});
