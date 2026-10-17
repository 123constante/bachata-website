// @vitest-environment jsdom
/**
 * H10 with the REAL AuthGuard: the page the person signs out from is guarded.
 * Signing out first made AuthGuard send them to /auth?mode=signin before our
 * navigate('/') ran; useSignOutToHome must land on "/".
 */
import { useSyncExternalStore } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => {
  let user: { id: string } | null = { id: 'me' };
  const subs = new Set<() => void>();
  return {
    get: () => user,
    set: (u: { id: string } | null) => {
      user = u;
      subs.forEach((f) => f());
    },
    subscribe: (f: () => void) => {
      subs.add(f);
      return () => subs.delete(f);
    },
  };
});

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => {
    const user = useSyncExternalStore(store.subscribe, store.get);
    return {
      user,
      isLoading: false,
      authStatus: 'ready',
      retryAuth: () => {},
      signOut: async () => {
        store.set(null);
        await new Promise((r) => setTimeout(r, 0));
        return 'signed-out';
      },
    };
  },
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

import { AuthGuard } from '@/components/auth/AuthGuard';
import { useSignOutToHome } from '../signOutToHome';

let here = '';
const Probe = () => {
  const l = useLocation();
  here = `${l.pathname}${l.search}`;
  return null;
};
const Page = () => {
  const { signOutToHome } = useSignOutToHome();
  return <button type="button" data-testid="sign-out" onClick={() => void signOutToHome()}>Yes, sign out</button>;
};

afterEach(cleanup);

describe('sign-out from a guarded page (real AuthGuard)', () => {
  it('lands on the site home, not /auth?mode=signin', async () => {
    store.set({ id: 'me' });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/app/options']}>
          <Probe />
          <Routes>
            <Route path="/app/*" element={<AuthGuard><Page /></AuthGuard>} />
            <Route path="/" element={<p data-testid="site-home">home</p>} />
            <Route path="/auth" element={<p data-testid="auth">auth</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await act(async () => fireEvent.click(screen.getByTestId('sign-out')));
    await waitFor(() => expect(store.get()).toBeNull());
    await act(async () => new Promise((r) => setTimeout(r, 20)));
    expect(here).toBe('/');
    expect(screen.getByTestId('site-home')).toBeTruthy();
  });
});
