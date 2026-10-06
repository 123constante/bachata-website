// @vitest-environment jsdom
/**
 * Login launch gate step 6: the header's signed-out "Sign in" entry point.
 * Asserts WHEN it shows and WHERE it links; jsdom does no layout, so the 44px
 * target is checked by the Sign in test in organiser-account-onboarding.spec.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

type AuthStatus = 'resolving' | 'ready' | 'unavailable';
const auth = vi.hoisted(() => ({ value: { user: null as unknown, isLoading: false, authStatus: 'ready' as AuthStatus } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth.value }));
const flags = vi.hoisted(() => ({ organiserSelfServe: true, searchV5: true, rafflesPage: false }));
vi.mock('@/lib/featureFlags', () => ({ flags }));
vi.mock('@/contexts/CityContext', () => ({ useCity: () => ({ citySlug: 'london' }) }));
vi.mock('@/components/search/HeaderSearch', () => ({ HeaderSearch: () => null }));
vi.mock('@/components/search/SearchTrigger', () => ({ SearchTrigger: () => null }));

import { GlobalHeader } from '../GlobalHeader';

const mount = (at: string) => render(<MemoryRouter initialEntries={[at]}><GlobalHeader /></MemoryRouter>);
const link = () => screen.queryByTestId('header-sign-in-link');

beforeEach(() => {
  auth.value = { user: null, isLoading: false, authStatus: 'ready' };
  flags.organiserSelfServe = true;
});
afterEach(cleanup);

describe('GlobalHeader sign-in link', () => {
  it('shows to a signed-out reader and comes back to the page they were on', () => {
    mount('/event/abc?occ=2#rsvp');
    expect(link()?.textContent).toBe('Sign in');
    expect(link()?.getAttribute('href')).toBe('/auth?mode=signin&returnTo=%2Fevent%2Fabc%3Focc%3D2');
  });

  it('stays hidden while the session is still resolving', () => {
    auth.value = { user: null, isLoading: true, authStatus: 'resolving' };
    mount('/');
    expect(link()).toBeNull();
  });

  it('stays hidden when auth resolution failed: that reader may well be signed in', () => {
    auth.value = { user: null, isLoading: false, authStatus: 'unavailable' };
    mount('/');
    expect(link()).toBeNull();
  });

  it('is gone once signed in', () => {
    auth.value = { user: { id: 'me' }, isLoading: false, authStatus: 'ready' };
    mount('/');
    expect(link()).toBeNull();
  });

  it('is not offered on the sign-in page itself, however it is spelled', () => {
    for (const at of ['/auth?mode=signin', '/Auth?mode=signin', '/%61uth']) {
      mount(at);
      expect(link(), at).toBeNull();
      cleanup();
    }
  });

  it('stays hidden while organiser self-serve is off (no signed-in header entry yet)', () => {
    flags.organiserSelfServe = false;
    mount('/');
    expect(link()).toBeNull();
  });
});
