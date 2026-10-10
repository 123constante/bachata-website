/**
 * The self-claim helper (claim_my_dancer_profile_v1, admin contract). Every
 * status of the contract, a thrown error, a missing function (PGRST202 / 404,
 * while the admin migration is not applied), an off-contract answer and a hang:
 * none of them may reject, and only "linked" drops the persona caches and
 * suppresses the one-time finish-profile hop.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

const rpcLoose = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose }));

import {
  CLAIM_STATUSES,
  claimAtSignIn,
  claimMyDancerProfile,
  parseClaimResult,
  shouldArmFinishHop,
  type ClaimOutcome,
} from '../claimMyDancerProfile';
import { myPersonaQueryKey } from '../myPersona';
import { profileCompletionQueryKey } from '@/hooks/useProfileCompletion';

beforeEach(() => {
  rpcLoose.mockReset();
  vi.spyOn(console, 'debug').mockImplementation(() => {});
});

const seeded = () => {
  const qc = new QueryClient();
  qc.setQueryData(myPersonaQueryKey('u1'), 'u1');
  qc.setQueryData(profileCompletionQueryKey('u1'), { status: 'incomplete', missing: ['avatar_url'], profileId: 'u1' });
  return qc;
};
const invalidated = (qc: QueryClient) => ({
  persona: qc.getQueryState(myPersonaQueryKey('u1'))?.isInvalidated,
  completion: qc.getQueryState(profileCompletionQueryKey('u1'))?.isInvalidated,
});

describe.each(CLAIM_STATUSES)('status %s', (status) => {
  const profileId = status === 'linked' || status === 'already_linked' ? 'admin-1' : null;

  it('is read off the contract and only "linked" invalidates and skips the hop', async () => {
    rpcLoose.mockResolvedValue({ data: { ok: true, status, profile_id: profileId }, error: null });
    const qc = seeded();
    const outcome = await claimAtSignIn(qc);
    expect(outcome).toEqual({ status, profileId });
    expect(rpcLoose).toHaveBeenCalledWith('claim_my_dancer_profile_v1');
    const linked = status === 'linked';
    await Promise.resolve();
    expect(invalidated(qc)).toEqual({ persona: linked, completion: linked });
    expect(shouldArmFinishHop({ firstSignIn: true, claim: outcome })).toBe(!linked);
    expect(shouldArmFinishHop({ firstSignIn: false, claim: outcome })).toBe(false);
  });
});

const UNAVAILABLE: ClaimOutcome = { status: 'unavailable', profileId: null };

describe.each([
  ['function missing (PGRST202)', () => rpcLoose.mockResolvedValue({ data: null, error: { message: 'Could not find the function public.claim_my_dancer_profile_v1 without parameters in the schema cache (PGRST202)' } })],
  ['404', () => rpcLoose.mockResolvedValue({ data: null, error: { message: 'Not Found' } })],
  ['thrown error (client chunk failed)', () => rpcLoose.mockRejectedValue(new Error('chunk load failed'))],
  ['off-contract: ok false', () => rpcLoose.mockResolvedValue({ data: { ok: false, status: 'linked' }, error: null })],
  ['off-contract: unknown status', () => rpcLoose.mockResolvedValue({ data: { ok: true, status: 'merged' }, error: null })],
  ['off-contract: null', () => rpcLoose.mockResolvedValue({ data: null, error: null })],
] as [string, () => void][])('%s', (_name, arrange) => {
  it('resolves "unavailable", never rejects, drops no cache, keeps the first-sign-in hop', async () => {
    arrange();
    const qc = seeded();
    const outcome = await claimAtSignIn(qc);
    expect(outcome).toEqual(UNAVAILABLE);
    expect(invalidated(qc)).toEqual({ persona: false, completion: false });
    expect(shouldArmFinishHop({ firstSignIn: true, claim: outcome })).toBe(true);
  });
});

it('a call that hangs never holds the sign-in past the timeout', async () => {
  rpcLoose.mockReturnValue(new Promise(() => {}));
  const started = Date.now();
  expect(await claimMyDancerProfile(30)).toEqual(UNAVAILABLE);
  expect(Date.now() - started).toBeLessThan(1000);
});

it('parseClaimResult keeps a profile id only when it is a non-empty string', () => {
  expect(parseClaimResult({ ok: true, status: 'linked', profile_id: '' })).toEqual({ status: 'linked', profileId: null });
  expect(parseClaimResult({ ok: true, status: 'no_match', profile_id: 7 })).toEqual({ status: 'no_match', profileId: null });
});
