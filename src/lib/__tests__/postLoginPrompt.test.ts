/**
 * The one-time Finish-your-profile hop is for the account's FIRST sign-in
 * (owner decision: "shown ONCE right after first login, then only the banner").
 * Read off the session's own user object: on the first sign-in the email is
 * confirmed by that very sign-in, so email_confirmed_at ~= last_sign_in_at.
 */
import { describe, expect, it } from 'vitest';
import { isFirstSignIn } from '../auth-otp-routing';

describe.each([
  ['first sign-in after sign-up (confirmed by this sign-in)', { email_confirmed_at: '2026-10-10T10:00:00Z', last_sign_in_at: '2026-10-10T10:00:02Z' }, true],
  ['first sign-in, a typed code (same second)', { email_confirmed_at: '2026-10-10T10:00:00Z', last_sign_in_at: '2026-10-10T10:00:00Z' }, true],
  ['a later sign-in (confirmed weeks ago)', { email_confirmed_at: '2026-09-01T10:00:00Z', last_sign_in_at: '2026-10-10T10:00:00Z' }, false],
  ['a later sign-in on a second device minutes after the first', { email_confirmed_at: '2026-10-10T10:00:00Z', last_sign_in_at: '2026-10-10T10:05:00Z' }, false],
  ['a stale user object that never recorded a sign-in', { email_confirmed_at: '2026-10-10T10:00:00Z', last_sign_in_at: null }, true],
  ['an account pre-confirmed at creation, signing in later (banner only)', { email_confirmed_at: '2026-09-01T10:00:00Z', last_sign_in_at: '2026-10-10T10:00:00Z' }, false],
  ['no confirmation timestamp at all (cannot tell: banner only)', { email_confirmed_at: null, last_sign_in_at: '2026-10-10T10:00:00Z' }, false],
  ['unparseable timestamps (cannot tell: banner only)', { email_confirmed_at: 'nope', last_sign_in_at: 'nope' }, false],
] as [string, Record<string, string | null>, boolean][])('%s', (_name, user, expected) => {
  it(expected ? 'arms the hop' : 'does not arm it', () => {
    expect(isFirstSignIn(user)).toBe(expected);
  });
});

it('null user: does not arm', () => {
  expect(isFirstSignIn(null)).toBe(false);
});
