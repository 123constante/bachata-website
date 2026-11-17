import { afterEach, describe, expect, it, vi } from 'vitest';

// Buyer onboarding slice A, items 2 + 3: the silent create before the "Message us" dead end,
// and every error path of it mapped to the ONE copy list (api/errors.ts).
const flag = vi.hoisted(() => ({ on: true }));
vi.mock('@/lib/buyerOnboardingFlag', () => ({
  get BUYER_ONBOARDING_ENABLED() {
    return flag.on;
  },
}));

import { codeFromMessage, copyFor, toDancerError } from '../api/errors';
import { createFakeBackend } from '../api/fakeBackend';
import { fetchMyDancerEdit, setFakeBackend } from '../api/rpc';

afterEach(() => {
  setFakeBackend(null);
  flag.on = true;
});

type Row = {
  name: string;
  flagOn: boolean;
  opts: Parameters<typeof createFakeBackend>[0];
  failEnsureWith?: 'unknown';
  expect: 'profile' | 'no_profile' | 'not_signed_in';
  ensureCalls: number;
};

const ROWS: Row[] = [
  { name: 'flag OFF, no persona: unchanged dead end, no create call', flagOn: false, opts: { shape: 'authUserNoPersona' }, expect: 'no_profile', ensureCalls: 0 },
  { name: 'no persona: created silently, read succeeds', flagOn: true, opts: { shape: 'authUserNoPersona' }, expect: 'profile', ensureCalls: 1 },
  { name: 'archived retired stub: created silently', flagOn: true, opts: { shape: 'archivedRetiredStub' }, expect: 'profile', ensureCalls: 1 },
  { name: 'has a profile: no create call', flagOn: true, opts: { shape: 'fourFieldComplete' }, expect: 'profile', ensureCalls: 0 },
  { name: 'rate limited (6th create today): falls back to no_profile', flagOn: true, opts: { shape: 'authUserNoPersona', ensureLimit: 0 }, expect: 'no_profile', ensureCalls: 1 },
  { name: 'create fails (offline): falls back to no_profile', flagOn: true, opts: { shape: 'authUserNoPersona' }, failEnsureWith: 'unknown', expect: 'no_profile', ensureCalls: 1 },
  { name: 'signed out: not_signed_in, no create call', flagOn: true, opts: { shape: 'unconfirmedAccount', gate: { open: true, allowed: true } }, expect: 'not_signed_in', ensureCalls: 0 },
];

describe('fetchMyDancerEdit silent create (ensure_my_dancer_profile_v1)', () => {
  it.each(ROWS)('$name', async (row) => {
    flag.on = row.flagOn;
    const fake = createFakeBackend(row.opts);
    setFakeBackend(fake);
    if (row.failEnsureWith) {
      const real = fake.ensureMyDancerProfile;
      fake.ensureMyDancerProfile = async () => {
        await real();
        throw new Error('Failed to fetch');
      };
    }
    const result = await fetchMyDancerEdit().then(
      () => 'profile' as const,
      (e) => toDancerError(e).code,
    );
    expect(result).toBe(row.expect);
    expect(fake.calls.filter((c) => c.fn === 'ensureMyDancerProfile')).toHaveLength(row.ensureCalls);
  });
});

describe('every error path of the flow has plain-words copy from the one list', () => {
  // The raw server text each path produces -> the code -> the copy the person sees.
  const PATHS: Array<[string, string, string]> = [
    ['RPC 42501 not_signed_in', 'not_signed_in', 'You are signed out. Sign in again to carry on.'],
    ['RPC 54000 rate_limited', 'rate_limited', 'That was a lot of saves in a short time. Wait a few minutes, then try again.'],
    ['anon caller refused by Postgres', 'permission denied for function ensure_my_dancer_profile_v1', 'You are signed out. Sign in again to carry on.'],
    ['read still finds no profile (fallback)', 'no_profile', 'We could not find your dancer profile. Message us and we will sort it out.'],
    ['network or anything else', 'Failed to fetch', 'Something went wrong. Check your connection and try again.'],
  ];
  it.each(PATHS)('%s', (_name, raw, copy) => {
    const code = codeFromMessage(raw);
    expect(copyFor(code)).toBe(copy);
    expect(toDancerError(new Error(raw)).message).toBe(copy);
    // Plain words: no codes, underscores or non-ASCII (mojibake) leak into the copy.
    expect(copy).not.toMatch(/_|[^\x20-\x7e]/);
  });
});
