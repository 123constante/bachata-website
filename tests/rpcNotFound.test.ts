import { describe, it, expect } from 'vitest';
import {
  resolveRpcNotFound, MSG_RETRYING, MSG_STALE, MSG_MISSING, MSG_UNKNOWN,
} from '../scripts/lib/rpc-not-found.mjs';

const nf = { code: 'PGRST202', message: 'Could not find the function public.f in the schema cache' };
const other = { code: '42501', message: 'permission denied' };

// rows: first error, probe answer, result of the retry, expected outcome.
const rows = [
  { name: 'PGRST202 + in pg_proc, retry still fails -> STALE red', first: nf, probe: true,
    retry: { data: null, error: nf }, exitCode: 1, retries: 1, msg: MSG_STALE, logged: MSG_RETRYING },
  { name: 'PGRST202 + in pg_proc, retry succeeds -> recovered', first: nf, probe: true,
    retry: { data: [1], error: null }, exitCode: undefined, retries: 1, data: [1], logged: MSG_RETRYING },
  { name: 'PGRST202 + not in pg_proc -> MISSING red, no retry', first: nf, probe: false,
    retry: { data: [1], error: null }, exitCode: 1, retries: 0, msg: MSG_MISSING },
  { name: 'PGRST202 + no probe, retry still fails -> unknown red', first: nf, probe: undefined,
    retry: { data: null, error: nf }, exitCode: 1, retries: 1, msg: MSG_UNKNOWN },
  { name: 'PGRST202 + probe throws -> unknown, still one retry', first: nf, probe: 'throw',
    retry: { data: null, error: nf }, exitCode: 1, retries: 1, msg: MSG_UNKNOWN },
  { name: 'other error code -> not handled, no retry', first: other, probe: true,
    retry: { data: [1], error: null }, handled: false, retries: 0 },
  { name: 'retry fails with a different error -> handed back, one retry', first: nf, probe: true,
    retry: { data: null, error: other }, handled: false, retries: 1 },
];

describe('resolveRpcNotFound', () => {
  it.each(rows)('$name', async (r) => {
    let retryCalls = 0; const slept: number[] = []; const logs: string[] = [];
    const out = await resolveRpcNotFound('f', r.first, {
      retryCall: async () => { retryCalls++; return r.retry; },
      functionExists: r.probe === undefined ? undefined
        : async () => { if (r.probe === 'throw') throw new Error('no path'); return r.probe as boolean; },
      sleep: async (ms: number) => { slept.push(ms); },
      log: (m: string) => logs.push(m),
    });
    expect(retryCalls).toBe(r.retries);
    expect(retryCalls).toBeLessThanOrEqual(1);
    expect(out.handled).toBe(r.handled ?? true);
    expect((out as any).exitCode).toBe(r.exitCode);
    if (r.msg) expect((out as any).message).toContain(r.msg);
    if (r.data) expect((out as any).data).toEqual(r.data);
    if (r.logged) expect(logs.join('\n')).toContain(r.logged);
    expect(slept).toEqual(r.retries ? [5000] : []);
  });

  it('success path: a non-error never reaches the helper (not handled)', async () => {
    const out = await resolveRpcNotFound('f', null, { retryCall: async () => ({ data: 1, error: null }) });
    expect(out).toEqual({ handled: false });
  });
});
