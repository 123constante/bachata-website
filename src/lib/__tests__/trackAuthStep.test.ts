import { beforeEach, describe, expect, it, vi } from 'vitest';

// Plain closures, not vi.fn: a spy that returns a rejected promise or throws is itself reported as a test error.
const h = vi.hoisted(() => ({ impl: (() => undefined) as () => unknown, calls: [] as unknown[][] }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => {
      h.calls.push(args);
      return h.impl();
    },
  },
}));
import { trackAuthStep } from '../trackAuthStep';

beforeEach(() => {
  h.calls = [];
});

const rejecting = { then: (_ok: unknown, bad: (e: unknown) => void) => bad(new Error('network')) };

describe('trackAuthStep never blocks', () => {
  const cases: [string, () => unknown][] = [
    ['ok', () => Promise.resolve({ data: null, error: null })],
    ['RPC missing (PGRST202 result)', () => Promise.resolve({ data: null, error: { code: 'PGRST202' } })],
    ['rejects', () => rejecting],
    ['throws synchronously', () => { throw new Error('boom'); }],
    ['never settles', () => ({ then: () => undefined })],
  ];
  it.each(cases)('%s: returns undefined at once, no throw', (_n, impl) => {
    h.impl = impl;
    expect(trackAuthStep({ step: 'code_sent', outcome: 'ok' })).toBeUndefined();
    expect(h.calls).toEqual([['record_auth_funnel_step_v1', { p_step: 'code_sent', p_outcome: 'ok' }]]);
  });
  it('sends only step and outcome', () => {
    h.impl = () => Promise.resolve({ error: null });
    trackAuthStep({ step: 'landing', outcome: 'S-HOME-1' });
    expect(Object.keys(h.calls[0][1] as object).sort()).toEqual(['p_outcome', 'p_step']);
  });
});
