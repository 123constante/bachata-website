// @vitest-environment jsdom
/** F5: the "Signed in as <email>. Not you? Sign out" line on the onboarding screen, against real-world shapes. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const api = vi.hoisted(() => ({ signOut: vi.fn(), home: vi.fn(), mine: vi.fn(), search: vi.fn() }));
const auth = vi.hoisted(() => ({ email: 'me@x.example' as string | null }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', email: auth.email }, session: null, signOut: api.signOut }),
}));
vi.mock('@/modules/organiser/shared/selfServeApi', async () => {
  const actual = await vi.importActual<typeof import('@/modules/organiser/shared/selfServeApi')>('@/modules/organiser/shared/selfServeApi');
  return { ...actual, fetchOrganiserHome: api.home, fetchMyAccessRequests: api.mine, searchClaimableOrganisers: api.search };
});

import { OnboardingView } from '../onboarding/OnboardingView';
import HomePage from '../index';

const LONG = `${'a'.repeat(30)}.${'b'.repeat(30)}@${'c'.repeat(14)}.example`; // 30+1+30+1+14+8 = 84 chars
const OPEN = { requestId: 'r1', organiserId: 'o9', organiserName: 'Bachata Nights', status: 'open', createdAt: '2026-10-06T10:00:00Z', resolvedAt: null };

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}
function wrap(ui: React.ReactElement, path = '/account/o') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/account/o" element={ui} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const view = (email: string | null, firstRun: boolean, requests: unknown[] = []) =>
  wrap(
    <OnboardingView
      user={{ id: 'u1', email }}
      mailboxProven
      myOrganiserIds={new Set()}
      requests={requests as never}
      firstRun={firstRun}
      onChanged={vi.fn()}
    />,
  );

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.search.mockResolvedValue([]);
  api.mine.mockResolvedValue([]);
  auth.email = 'me@x.example';
});
afterEach(cleanup);

const SHAPES: [string, string | null][] = [
  ['plain email', 'me@x.example'],
  ['very long email (84 chars)', LONG],
  ['no email', null],
];

describe.each(SHAPES)('sign-out line: %s', (_name, email) => {
  describe.each([true, false])('firstRun=%s', (firstRun) => {
    it.each([[[]], [[OPEN]]])('shows the line (requests %j) with a labelled, 44px, non-primary control', (requests) => {
      view(email, firstRun, requests);
      const line = screen.getByTestId('onboarding-signedin-line');
      expect(line.textContent).toContain(email ? `Signed in as ${email}.` : 'Signed in.');
      if (!email) expect(line.textContent).not.toContain(' as ');
      expect(line.textContent).toContain('Not you?');
      const btn = screen.getByTestId('onboarding-signout');
      expect(btn.getAttribute('aria-label')).toBe(email ? `Sign out of ${email}` : 'Sign out');
      expect(btn.className).toContain('min-h-[44px]');
      expect(btn.className).toContain('text-[var(--gold)]');
      expect(btn.className).not.toMatch(/\b(h|px|py|text)-(\d|xs|sm|base|lg)/);
      // wraps instead of scrolling sideways
      expect(screen.getByTestId('onboarding-signedin-as').className).toContain('break-all');
      expect(line.className).toContain('flex-wrap');
    });
  });
});

describe('sign-out confirm step', () => {
  it('a tap on the line only asks; nothing signs out until "Yes, sign out"', async () => {
    api.signOut.mockResolvedValue('signed-out');
    view('me@x.example', true);
    expect(screen.queryByTestId('onboarding-signout-yes')).toBeNull();
    fireEvent.click(screen.getByTestId('onboarding-signout'));
    expect(await screen.findByTestId('onboarding-signout-yes')).toBeTruthy();
    expect(api.signOut).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('onboarding-signout-yes'));
    await waitFor(() => expect(api.signOut).toHaveBeenCalledTimes(1));
    expect((await screen.findByTestId('where')).textContent).toBe('/');
  });

  it('"No, stay signed in" closes it without signing out', async () => {
    view('me@x.example', true);
    fireEvent.click(screen.getByTestId('onboarding-signout'));
    fireEvent.click(await screen.findByTestId('onboarding-signout-no'));
    await waitFor(() => expect(screen.queryByTestId('onboarding-signout-yes')).toBeNull());
    expect(api.signOut).not.toHaveBeenCalled();
  });

  it('Escape closes it without signing out', async () => {
    view('me@x.example', false);
    fireEvent.click(screen.getByTestId('onboarding-signout'));
    const yes = await screen.findByTestId('onboarding-signout-yes');
    fireEvent.keyDown(yes, { key: 'Escape', code: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('onboarding-signout-yes')).toBeNull());
    expect(api.signOut).not.toHaveBeenCalled();
    expect(screen.getByTestId('onboarding-signedin-line')).toBeTruthy();
  });

  it('a failed sign-out stays put and says so', async () => {
    api.signOut.mockResolvedValue('failed');
    view('me@x.example', true);
    fireEvent.click(screen.getByTestId('onboarding-signout'));
    fireEvent.click(await screen.findByTestId('onboarding-signout-yes'));
    expect((await screen.findByTestId('onboarding-signout-error')).textContent).toContain('Sign-out did not complete');
    expect(screen.queryByTestId('where')).toBeNull();
  });
});

describe('Home while the read is loading or failed', () => {
  it('loading: no onboarding, no crash', () => {
    api.home.mockReturnValue(new Promise(() => {}));
    wrap(<HomePage />);
    expect(screen.queryByTestId('org-onboarding')).toBeNull();
    expect(screen.queryByTestId('onboarding-signedin-line')).toBeNull();
  });

  it('error: the error state shows, onboarding does not, nothing throws', async () => {
    api.home.mockRejectedValue(new Error('boom'));
    wrap(<HomePage />);
    expect(await screen.findByTestId('home-error')).toBeTruthy();
    expect(screen.queryByTestId('org-onboarding')).toBeNull();
  });

  it('loaded with no organiser: the line is there, with open requests too', async () => {
    api.home.mockResolvedValue({ today: '2026-10-07', organisers: [] });
    api.mine.mockResolvedValue([OPEN]);
    wrap(<HomePage />);
    expect((await screen.findByTestId('onboarding-signedin-line')).textContent).toContain('me@x.example');
    expect(await screen.findByTestId('onboarding-pending-row')).toBeTruthy();
  });
});
