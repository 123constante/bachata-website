// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { isRoutable } from './routeTable';
import { landingPathAfterAuth } from '@/lib/auth-otp-routing';
import { getListedTarget } from '@/lib/getListedTarget';
import { JOIN_COPY } from '@/modules/admin-organisers/join/joinCopy';
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
    'lib/getListedTarget.ts',
  ])('%s has no retired organiser/videographer path', (f) => {
    // Template-literal forms too: `/create-${role}-profile`.
    expect(src(f)).not.toMatch(/create-(organiser|videographer|\$\{[^}]*\})-profile|\/listing-request/);
  });
  it.each([
    { selfServe: true, external: false, href: '/account/new' },
    { selfServe: false, external: true, href: null },
  ])('Get listed target, selfServe=$selfServe', ({ selfServe, external, href }) => {
    const t = getListedTarget(selfServe);
    expect(t.external).toBe(external);
    if (href) expect(t.href).toBe(href);
    if (!selfServe) {
      // Sign-in and the organiser area go live together: nothing may point at them while off.
      expect(t.href).not.toBe('/auth');
      expect(t.href).not.toBe('/account/new');
      expect(t.href).not.toMatch(/create-(organiser|videographer)-profile|listing-request/);
      expect(t.href).toMatch(/^https:\/\//);
    } else {
      expect(isRoutable(t.href)).toBe(true);
    }
  });
});

describe('invite Done screen', () => {
  afterEach(cleanup);
  const ID = 'org-1';
  it.each([
    { organiserP3: false, selfServe: true, id: ID, to: `/account/o/welcome?o=${ID}`, body: JOIN_COPY.done.body },
    { organiserP3: true, selfServe: true, id: ID, to: `/account/p3?o=${ID}`, body: JOIN_COPY.done.body },
    { organiserP3: false, selfServe: true, id: null, to: '/account/o', body: JOIN_COPY.done.body },
    { organiserP3: true, selfServe: true, id: null, to: '/account/p3', body: JOIN_COPY.done.body }, // F-01: P3 live -> P3 Home
    { organiserP3: false, selfServe: false, id: ID, to: '/', body: JOIN_COPY.done.bodyOff },
    { organiserP3: true, selfServe: false, id: ID, to: '/', body: JOIN_COPY.done.bodyOff },
    { organiserP3: false, selfServe: false, id: null, to: '/', body: JOIN_COPY.done.bodyOff },
    { organiserP3: true, selfServe: false, id: null, to: '/', body: JOIN_COPY.done.bodyOff },
  ])('p3=$organiserP3 selfServe=$selfServe id=$id -> link to $to', ({ organiserP3, selfServe, id, to, body }) => {
    render(<MemoryRouter><DoneScreen org="Salsa Co" flags={{ organiserP3, organiserSelfServe: selfServe }} organiserId={id} /></MemoryRouter>);
    expect(screen.getByTestId('join-done').textContent).toContain('Salsa Co');
    expect(document.body.textContent).toContain(body);
    const href = screen.getByTestId('join-done-home').getAttribute('href');
    expect(href).toBe(to);
    expect(isRoutable(href!.split('?')[0])).toBe(true);
  });

  it('the button label says Home and opens Home for either flag (F-05, brief p3-wt-land), and an id that needs encoding is encoded', () => {
    render(<MemoryRouter><DoneScreen org="Salsa Co" flags={{ organiserP3: false, organiserSelfServe: true }} organiserId="x" /></MemoryRouter>);
    expect(screen.getByTestId('join-done-home').textContent).toBe('Open your organiser home');
    cleanup();
    render(<MemoryRouter><DoneScreen org="Salsa Co" flags={{ organiserP3: true, organiserSelfServe: true }} organiserId="a b/c" /></MemoryRouter>);
    const link = screen.getByTestId('join-done-home');
    expect(link.textContent).toBe(JOIN_COPY.done.button);
    expect(JOIN_COPY.done.button).toBe('Open your organiser home');
    expect(link.getAttribute('href')).toBe('/account/p3?o=a%20b%2Fc');
  });

  // Review r1 F1 (brief p3-wt-land): P3 Home waits for its refetch only when it gets a `confirmation`;
  // without it a pre-join "no page" cache sends the new member to Start.
  it.each([
    [true, 'org-1', `You${String.fromCharCode(8217)}re on Salsa Co${String.fromCharCode(8217)}s team.`],
    [true, null, null],
    [false, 'org-1', null],
  ] as const)('P3 live=%s id=%s -> Home gets confirmation %s', (organiserP3, id, want) => {
    const Probe = () => {
      const s = useLocation().state as { confirmation?: string } | null;
      return <p data-testid="probe">{s?.confirmation ?? 'none'}</p>;
    };
    render(
      <MemoryRouter initialEntries={['/join']}>
        <Routes>
          <Route path="/join" element={<DoneScreen org="Salsa Co" flags={{ organiserP3, organiserSelfServe: true }} organiserId={id} />} />
          <Route path="*" element={<Probe />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('join-done-home'));
    expect(screen.getByTestId('probe').textContent).toBe(want ?? 'none');
    expect(want ?? JOIN_COPY.done.heading('Salsa Co')).toBe(JOIN_COPY.done.heading('Salsa Co'));
  });
});
