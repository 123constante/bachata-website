/**
 * Sign-up focus mode (owner decision 2026-10-16): the ONE mapping every chrome
 * component reads. Table-driven: every path the flow can sit on, and the
 * look-alikes that must keep the normal site.
 */
import { describe, expect, it } from 'vitest';
import { FOCUS_NOT_NOW_LABEL, isSignupFocusPath } from '@/lib/focusMode';
import { focusNotNowHref } from '@/components/layout/FocusHeader';

const CASES: Array<[string, string, boolean, boolean]> = [
  // pathname, search, profileComplete, expected
  ['/auth', '?mode=signup', false, true],
  ['/auth', '?mode=signup&returnTo=%2Fevent%2F1', false, true],
  ['/auth', '', false, true], // no mode renders the sign-up flow
  ['/auth', '?mode=nonsense', false, true], // so does any mode but signin
  ['/Auth/', '?mode=signup', false, true],
  ['/auth', '?mode=signup', true, true], // pre-account: the profile flag is irrelevant
  ['/auth/callback', '?mode=signup', false, true],
  ['/auth', '?mode=signin', false, false], // sign-in is NOT focus mode
  ['/auth', '?mode=signin&returnTo=%2Fapp', false, false],
  ['/auth/callback', '?mode=signin', false, false],
  ['/auth/callback', '', false, false],
  ['/app/welcome', '', false, true],
  ['/app/welcome', '', true, false],
  ['/app/welcome/', '?step=2', false, true],
  ['/app/me/photo', '?return=/app/welcome', false, true],
  ['/app/me/photo', '?return=%2Fapp%2Fwelcome', false, true],
  ['/app/me/photo', '?return=/app/welcome', true, false],
  ['/app/me/photo', '', false, false], // editing the photo later: normal app
  ['/app/me/photo', '?return=/app/me', false, false],
  ['/app/home', '', false, false],
  ['/app', '', false, false],
  ['/', '', false, false],
  ['/city/london', '', false, false],
  ['/event/abc', '', false, false],
  ['/account/settings', '', false, false],
  ['/finish-profile', '', false, false],
  ['/authx', '?mode=signup', false, false],
];

describe('isSignupFocusPath', () => {
  it.each(CASES)('%s%s (profileComplete=%s) -> %s', (pathname, search, complete, expected) => {
    expect(isSignupFocusPath(pathname, search, complete)).toBe(expected);
  });

  it('accepts a search string without the leading "?"', () => {
    expect(isSignupFocusPath('/auth', 'mode=signin', false)).toBe(false);
  });
});

describe('focusNotNowHref', () => {
  it.each([
    ['?mode=signup', '/'],
    ['', '/'],
    ['?mode=signup&returnTo=%2Fevent%2Fabc', '/event/abc'],
    ['?mode=signup&returnTo=%2Fevent%2Fabc%3Frsvp%3D1', '/event/abc?rsvp=1'],
    ['?returnTo=https%3A%2F%2Fevil.example', '/'], // off-site never
    ['?returnTo=%2F%2Fevil.example', '/'],
    ['?returnTo=%2Fauth%3Fmode%3Dsignup', '/'], // never back into the flow
    ['?returnTo=%2Fapp%2Fwelcome', '/'],
  ])('%s -> %s', (search, expected) => {
    expect(focusNotNowHref(search)).toBe(expected);
  });

  it('the label is the pinned one', () => {
    expect(FOCUS_NOT_NOW_LABEL).toBe('Not now');
  });
});
