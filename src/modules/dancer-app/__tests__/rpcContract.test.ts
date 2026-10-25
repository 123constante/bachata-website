/**
 * F22 (review of B1b): offline contract for the dancer-area RPCs that are NOT in the
 * generated Supabase types (they go through rpcLoose, so a rename would not fail the build).
 *
 * The names and parameter keys below were read from prod pg_proc (REVIEW.md Q3,
 * 2026-10-17). This test calls the REAL wrappers in api/rpc.ts (no fake backend) and
 * records what reaches rpcLoose. If a function name or a parameter key changes in
 * rpc.ts, this goes red; if the database renames one, change it here AND in rpc.ts
 * together, from the admin repo's migration.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  calls: [] as Array<{ fn: string; keys: string[] | null }>,
  reply: {} as Record<string, unknown>,
}));

vi.mock('@/integrations/supabase/rpcLoose', () => ({
  rpcLoose: async (fn: string, args?: Record<string, unknown>) => {
    h.calls.push({ fn, keys: args === undefined ? null : Object.keys(args).sort() });
    return { data: h.reply[fn] ?? null, error: null };
  },
}));

import {
  DANCER_RPC,
  fetchMyFeatureInterest,
  fetchMyStats,
  fetchMyViews,
  fetchPublicExtras,
  registerFeatureInterest,
  setFakeBackend,
  submitFeedback,
} from '@/modules/dancer-app/api/rpc';

const PID = '00000000-0000-4000-8000-000000000001';

/** fn name -> exact sorted parameter keys (null = called with no arguments). From prod pg_proc. */
const RPC_CONTRACT = {
  submit_feedback_v1: ['p_body', 'p_kind', 'p_page'],
  register_feature_interest_v1: ['p_feature'],
  my_feature_interest_v1: null,
  my_profile_views_v1: null,
  my_dancer_stats_v1: null,
  get_public_dancer_extras_v1: ['p_profile_id'],
} as const;

beforeEach(() => {
  setFakeBackend(null);
  h.calls = [];
  h.reply = {
    my_dancer_stats_v1: { profile_id: PID },
    my_profile_views_v1: { profile_id: PID },
    submit_feedback_v1: { id: 'f1', kind: 'general', created_at: '2026-10-17T12:00:00Z' },
    register_feature_interest_v1: { already_registered: false },
    my_feature_interest_v1: { features: [] },
    get_public_dancer_extras_v1: null,
  };
});

const cases: Array<[keyof typeof RPC_CONTRACT, () => Promise<unknown>]> = [
  ['submit_feedback_v1', () => submitFeedback('hello', 'general', '/app/options')],
  ['register_feature_interest_v1', () => registerFeatureInterest('partner_search')],
  ['my_feature_interest_v1', () => fetchMyFeatureInterest()],
  ['my_profile_views_v1', () => fetchMyViews()],
  ['my_dancer_stats_v1', () => fetchMyStats()],
  ['get_public_dancer_extras_v1', () => fetchPublicExtras(PID)],
];

describe('F22: dancer-area RPC names + parameter names (prod pg_proc)', () => {
  it.each(cases)('%s: the wrapper calls exactly this name with exactly these keys', async (fn, run) => {
    await run();
    expect(h.calls).toEqual([{ fn, keys: RPC_CONTRACT[fn] === null ? null : [...RPC_CONTRACT[fn]] }]);
  });

  it('DANCER_RPC names the same functions (no stray or missing name)', () => {
    const named = Object.values(DANCER_RPC);
    for (const fn of Object.keys(RPC_CONTRACT)) expect(named).toContain(fn);
  });
});
