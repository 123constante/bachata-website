// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { isRoutable } from './routeTable';
import { landingPathAfterAuth } from '@/lib/auth-otp-routing';
import { DoneScreen } from '@/modules/admin-organisers/join/JoinScreens';

// Login dead-ends F1 + F2: every internal path the sign-in routing and the get-listed CTAs can
// produce must be a route that exists, for every role and both flag values.
const ROLES = [null, 'dancer', 'organiser', 'teacher', 'dj', 'vendor', 'videographer'];

describe('landingPathAfterAuth targets exist', () => {
  const cases = ROLES.flatMap((role) =>
    [true, false].flatMap((organiserSelfServe) =>
      [true, false].map((isSignup) => ({ role, organiserSelfServe, isSignup })),
    ),
  );
  it.each(cases)('role=$role selfServe=$organiserSelfServe signup=$isSignup', (c) => {
    const to = landingPathAfterAuth(c);
    expect(isRoutable(to), `${to} has no route`).toBe(true);
  });
});

describe('role-entry maps point only at routes that exist', () => {
  const src = (f: string) => readFileSync(path.resolve(__dirname, '../..', f), 'utf8');
  it.each([
    'pages/AuthCallback.tsx',
    'pages/Onboarding.tsx',
    'components/auth/ProfileEntryFlow.tsx',
    'components/profile/ProfileEntryRouter.tsx',
    'components/organiser/GetListedHoloCta.tsx',
    'pages/Organisers.tsx',
  ])('%s has no retired organiser/videographer path', (f) => {
    expect(src(f)).not.toMatch(/create-(organiser|videographer)-profile|\/listing-request/);
  });
  it.each(['/account/new', '/auth', '/'])('CTA fallback %s is routable', (p) => {
    expect(isRoutable(p)).toBe(true);
  });
});

describe('invite Done screen', () => {
  afterEach(cleanup);
  it.each([
    { selfServe: true, to: '/account/o' },
    { selfServe: false, to: '/' },
  ])('selfServe=$selfServe -> link to $to, a routable page', ({ selfServe, to }) => {
    render(<MemoryRouter><DoneScreen org="Salsa Co" selfServe={selfServe} /></MemoryRouter>);
    expect(screen.getByTestId('join-done').textContent).toContain('Salsa Co');
    const href = screen.getByTestId('join-done-home').getAttribute('href');
    expect(href).toBe(to);
    expect(isRoutable(href!)).toBe(true);
  });
});
