// @vitest-environment jsdom
/**
 * The site-wide reminder: shown on every signed-in page while the profile is
 * unfinished, hidden for one page view by its close button, back on the next
 * page, and never shown once profile_complete_v1 is true. Also owns the
 * "right after sign-in, once" hop to the Finish-your-profile screen.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ProfileCompletion } from '@/lib/profileCompletion';

const h = vi.hoisted(() => ({ completion: null as unknown as ProfileCompletion }));
vi.mock('@/hooks/useProfileCompletion', () => ({
  useProfileCompletion: () => ({ ...h.completion, refetch: async () => h.completion }),
}));

import ProfileCompletionChrome from '../ProfileCompletionChrome';
import { POST_LOGIN_PROMPT_KEY, SKIP_FINISH_PROFILE_KEY, needsFinishing } from '@/lib/profileCompletion';
import type { ProfileGateValue } from '@/hooks/useAuth';

let path = '';
const Probe = () => {
  const l = useLocation();
  useEffect(() => {
    path = `${l.pathname}${l.search}`;
  });
  return null;
};

const mount = (at = '/parties', onGate?: (v: ProfileGateValue) => void) =>
  render(
    <MemoryRouter initialEntries={[at]}>
      <ProfileCompletionChrome onGate={onGate} />
      <Probe />
      <Routes>
        <Route path="*" element={<Link to="/classes">next page</Link>} />
      </Routes>
    </MemoryRouter>,
  );

const ALL = ['first_name', 'based_city_id', 'dance_role', 'avatar_url'] as const;
const SHAPES: { name: string; c: ProfileCompletion; banner: boolean }[] = [
  { name: 'complete', c: { status: 'complete', missing: [], profileId: 'p1' }, banner: false },
  { name: 'missing first name', c: { status: 'incomplete', missing: ['first_name'], profileId: 'p1' }, banner: true },
  { name: 'missing city', c: { status: 'incomplete', missing: ['based_city_id'], profileId: 'p1' }, banner: true },
  { name: 'missing dance role', c: { status: 'incomplete', missing: ['dance_role'], profileId: 'p1' }, banner: true },
  { name: 'missing photo', c: { status: 'incomplete', missing: ['avatar_url'], profileId: 'p1' }, banner: true },
  { name: 'all missing', c: { status: 'incomplete', missing: [...ALL], profileId: 'p1' }, banner: true },
  { name: 'no profile row', c: { status: 'no_profile', missing: [...ALL], profileId: null }, banner: true },
  { name: 'loading', c: { status: 'loading', missing: [], profileId: null }, banner: false },
  { name: 'signed out', c: { status: 'signed_out', missing: [], profileId: null }, banner: false },
];

beforeEach(() => {
  sessionStorage.clear();
  path = '';
});
afterEach(cleanup);

describe.each(SHAPES)('$name', ({ c, banner }) => {
  it('publishes the same fact to the rating card: blocked exactly when the banner shows', () => {
    h.completion = c;
    const onGate = vi.fn();
    mount('/parties', onGate);
    const value = onGate.mock.calls[onGate.mock.calls.length - 1][0] as ProfileGateValue;
    expect(value.status).toBe(c.status);
    expect(value.gateFor('/event/e1#level-rating').allowed).toBe(!needsFinishing(c));
    expect(!value.gateFor('/x').allowed).toBe(banner);
  });

  it(banner ? 'banner on screen with a way forward' : 'no banner', () => {
    h.completion = c;
    mount();
    const el = screen.queryByTestId('profile-completion-banner');
    expect(Boolean(el)).toBe(banner);
    if (!banner) return;
    if (c.status === 'incomplete') {
      expect(screen.getByRole('link', { name: 'Finish profile' }).getAttribute('href')).toBe(
        `/finish-profile?returnTo=${encodeURIComponent('/parties')}`,
      );
    } else {
      expect(screen.getByRole('link', { name: /whatsapp/i })).toBeTruthy();
    }
  });
});

it('close hides it for this page view only; the next page shows it again', async () => {
  h.completion = { status: 'incomplete', missing: ['avatar_url'], profileId: 'p1' };
  mount();
  fireEvent.click(screen.getByRole('button', { name: /hide this reminder/i }));
  expect(screen.queryByTestId('profile-completion-banner')).toBeNull();
  fireEvent.click(screen.getByRole('link', { name: 'next page' }));
  await waitFor(() => expect(screen.getByTestId('profile-completion-banner')).toBeTruthy());
});

it('"Skip for now" on the screen does not hide the banner', () => {
  sessionStorage.setItem(SKIP_FINISH_PROFILE_KEY, '1');
  h.completion = { status: 'incomplete', missing: ['dance_role'], profileId: 'p1' };
  mount();
  expect(screen.getByTestId('profile-completion-banner')).toBeTruthy();
});

it('right after sign-in with an unfinished profile: one hop to the screen, keeping where they were', async () => {
  sessionStorage.setItem(POST_LOGIN_PROMPT_KEY, '1');
  h.completion = { status: 'incomplete', missing: ['dance_role', 'avatar_url'], profileId: 'p1' };
  mount('/event/e1');
  await waitFor(() => expect(path).toBe(`/finish-profile?returnTo=${encodeURIComponent('/event/e1')}`));
  expect(sessionStorage.getItem(POST_LOGIN_PROMPT_KEY)).toBeNull();
});

it('right after sign-in, but skipped this session: no hop', async () => {
  sessionStorage.setItem(POST_LOGIN_PROMPT_KEY, '1');
  sessionStorage.setItem(SKIP_FINISH_PROFILE_KEY, '1');
  h.completion = { status: 'incomplete', missing: ['avatar_url'], profileId: 'p1' };
  mount('/event/e1');
  await waitFor(() => expect(sessionStorage.getItem(POST_LOGIN_PROMPT_KEY)).toBeNull());
  expect(path).toBe('/event/e1');
});

it('right after sign-in with a complete profile: no hop, flag cleared', async () => {
  sessionStorage.setItem(POST_LOGIN_PROMPT_KEY, '1');
  h.completion = { status: 'complete', missing: [], profileId: 'p1' };
  mount('/event/e1');
  await waitFor(() => expect(sessionStorage.getItem(POST_LOGIN_PROMPT_KEY)).toBeNull());
  expect(path).toBe('/event/e1');
});
