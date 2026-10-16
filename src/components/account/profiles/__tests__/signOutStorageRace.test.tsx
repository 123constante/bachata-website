// @vitest-environment jsdom
/**
 * #789 sign-out storage race (build-smoke account-edges, "no trace of A"): the page was left
 * BEFORE sign-out cleared the person's storage, so on a shared phone the next person found
 * A's e-mail, form and session token. The REAL AuthProvider + useSignOutToHome: at the
 * moment navigate() is called, nothing of A is left in storage -- whether the server call
 * is fast, slower than the cap, or rejects.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TOKEN_KEY = 'sb-phoneqafakenotaproject-auth-token';
const A_EMAIL = 'aurelia.a@example.com';

type Mode = 'fast' | 'slow' | 'reject';
const h = vi.hoisted(() => ({
  mode: 'fast' as 'fast' | 'slow' | 'reject',
  emit: (_e: string, _s: unknown) => {},
  atNavigate: [] as string[][],
}));

/** The server half of a sign-out, per mode (slow = past every cap). */
const network = () =>
  h.mode === 'fast'
    ? Promise.resolve({ error: null })
    : h.mode === 'slow'
      ? new Promise<{ error: null }>((r) => setTimeout(() => r({ error: null }), 10_000))
      : Promise.reject(new TypeError('Failed to fetch'));

vi.mock('@/integrations/supabase/getSupabase', () => {
  const session = { access_token: 'at', user: { id: 'u-a', email: 'aurelia.a@example.com' } };
  const removeSession = () => {
    localStorage.removeItem('sb-phoneqafakenotaproject-auth-token');
    h.emit('SIGNED_OUT', null);
  };
  const client = {
    auth: {
      onAuthStateChange: (cb: (e: string, s: unknown) => void) => {
        h.emit = cb;
        return { data: { subscription: { unsubscribe() {} } } };
      },
      getSession: async () => ({ data: { session } }),
      // supabase-js: storage is the source of truth; with a stored session it calls the
      // server, without one it only removes and emits.
      signOut: async () => {
        if (localStorage.getItem('sb-phoneqafakenotaproject-auth-token')) await network();
        removeSession();
        return { error: null };
      },
      admin: { signOut: () => network() },
    },
  };
  return { getSupabase: async () => client };
});
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => {
      const navigate = actual.useNavigate();
      return (...args: Parameters<typeof navigate>) => {
        h.atNavigate.push(personKeysLeft());
        return navigate(...(args as [string]));
      };
    },
  };
});

import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { PERSON_SCOPED_LOCAL_KEYS } from '@/lib/personScopedStorage';
import { useSignOutToHome } from '../signOutToHome';

function personKeysLeft(): string[] {
  return [...Object.entries(localStorage), ...Object.entries(sessionStorage)]
    .filter(([, v]) => v.includes(A_EMAIL) || v.includes('Aurelia'))
    .map(([k]) => k);
}

const seedA = () => {
  localStorage.setItem(TOKEN_KEY, JSON.stringify({ access_token: 'at', user: { email: A_EMAIL } }));
  localStorage.setItem('auth_last_email', A_EMAIL);
  localStorage.setItem('auth_form_state_v1', JSON.stringify({ email: A_EMAIL, firstName: 'Aurelia' }));
};

const Page = () => {
  const { user } = useAuth();
  const { signOutToHome } = useSignOutToHome();
  return (
    <>
      <p data-testid="who">{user ? 'in' : 'out'}</p>
      <button type="button" data-testid="sign-out" onClick={() => void signOutToHome()}>Sign out</button>
    </>
  );
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  h.atNavigate = [];
});
afterEach(cleanup);

describe('sign-out clears A from storage BEFORE leaving the page', () => {
  it('the seeded keys are what the build-smoke spec found, and are on the one list', () => {
    seedA();
    expect(personKeysLeft().sort()).toEqual(['auth_form_state_v1', 'auth_last_email', TOKEN_KEY]);
    expect(PERSON_SCOPED_LOCAL_KEYS).toEqual(expect.arrayContaining(['auth_form_state_v1', 'auth_last_email']));
  });

  it.each<Mode>(['fast', 'slow', 'reject'])('server call %s: nothing of A when navigate is called, lands on / signed out', async (mode) => {
    h.mode = mode;
    seedA();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/app/home']}>
            <Routes>
              <Route path="/app/*" element={<Page />} />
              <Route path="/" element={<p data-testid="site-home">home</p>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('who').textContent).toBe('in'));
    await act(async () => fireEvent.click(screen.getByTestId('sign-out')));
    await waitFor(() => expect(h.atNavigate.length).toBeGreaterThan(0), { timeout: 8_000 });
    expect(h.atNavigate[0]).toEqual([]);
    await waitFor(() => expect(screen.getByTestId('site-home')).toBeTruthy(), { timeout: 8_000 });
    expect(personKeysLeft()).toEqual([]);
  }, 20_000);
});
