/**
 * TODAY's reminder banner (src/lib/profileCompletion.ts bannerModel): shown or
 * hidden on every path BANNER_HIDDEN_ON names, plus the paths around them.
 * R0 recorded `/app` and `/app/home` as SHOWN; W1's seam (the dancer area has its
 * own onboarding) added `/app` + `/app/*` to BANNER_HIDDEN_ON, so R1a flipped
 * those two rows here: the old value described code that no longer exists.
 */
import { describe, expect, it } from 'vitest';
import { bannerModel, type ProfileCompletion } from '@/lib/profileCompletion';

const INCOMPLETE: ProfileCompletion = { status: 'incomplete', missing: ['avatar_url'], profileId: 'p1' };
const NO_PROFILE: ProfileCompletion = { status: 'no_profile', missing: ['first_name', 'based_city_id', 'dance_role', 'avatar_url'], profileId: null };
const COMPLETE: ProfileCompletion = { status: 'complete', missing: [], profileId: 'p1' };

/** path -> is the banner shown for an incomplete profile TODAY. */
const PATHS: [string, boolean][] = [
  ['/', true],
  ['/events', true],
  ['/event/e1', true],
  ['/dancers', true],
  ['/dancers/abc', true],
  ['/festival/f1', true],
  ['/app/home', false], // W1 seam: hidden on the dancer area (was shown before the rebuild)
  ['/app', false],
  ['/apps', true], // prefix guard: only /app and /app/*
  ['/account', false],
  ['/account/', false],
  ['/account/dancer', false],
  ['/account/o', false],
  ['/account/o/events/e1', false],
  ['/account/settings', false],
  ['/account/settings/delete', false],
  ['/account/attendance', false],
  ['/finish-profile', false],
  ['/auth', false],
  ['/auth/callback', false],
  ['/auth/anything', false],
  ['/accountant', true], // prefix guard: only /account and /account/*
  ['/authors', true], // prefix guard: only /auth and /auth/*
];

describe('reminder banner: incomplete profile, by path', () => {
  it.each(PATHS)('%s -> shown=%s', (pathname, shown) => {
    const m = bannerModel(INCOMPLETE, { dismissed: false, pathname });
    expect(m !== null).toBe(shown);
    if (m) expect(m).toMatchSnapshot();
  });
});

describe('reminder banner: other states', () => {
  it('no profile: the message-us banner on a normal page, hidden on /account', () => {
    expect(bannerModel(NO_PROFILE, { dismissed: false, pathname: '/' })).toMatchSnapshot();
    expect(bannerModel(NO_PROFILE, { dismissed: false, pathname: '/account' })).toBeNull();
  });
  it('complete / loading / error / signed-out never show a banner', () => {
    for (const status of ['complete', 'loading', 'error', 'signed_out'] as const) {
      const c = status === 'complete' ? COMPLETE : ({ status, missing: [], profileId: null } as ProfileCompletion);
      expect(bannerModel(c, { dismissed: false, pathname: '/' }), status).toBeNull();
    }
  });
  it('dismissed hides it on a normal page', () => {
    expect(bannerModel(INCOMPLETE, { dismissed: true, pathname: '/' })).toBeNull();
  });
  it('the Finish link carries the page they were on as returnTo', () => {
    expect(bannerModel(INCOMPLETE, { dismissed: false, pathname: '/event/e1' })?.cta).toMatchSnapshot();
    expect(bannerModel(INCOMPLETE, { dismissed: false, pathname: '/', returnTo: '/event/e9' })?.cta).toMatchSnapshot();
  });
});
