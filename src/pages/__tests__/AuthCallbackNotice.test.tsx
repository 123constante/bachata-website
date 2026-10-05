// @vitest-environment jsdom
/**
 * Lever 2 walk S5: /auth/callback bounces an expired or invalid magic link to
 * /auth?mode=signin&callbackError=<reason>, and the page used to show the plain
 * sign-in form with no explanation. It must say what happened. The Supabase
 * client is mocked; nothing here touches a network.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';

const rpc = vi.hoisted(() => vi.fn());
const signInWithOtp = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc, auth: { signInWithOtp } },
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/components/ui/city-picker', () => ({ CityPicker: () => null }));

import Auth from '../Auth';

function mount(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/auth" element={<Auth />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  rpc.mockReset();
  signInWithOtp.mockReset();
});
afterEach(cleanup);

describe('Auth after a bounced magic link', () => {
  it('explains an expired link on the sign-in form', () => {
    mount('/auth?mode=signin&callbackError=expired&returnTo=%2Forganisers%2Fritmo');
    expect(screen.getByTestId('auth-callback-notice').textContent).toMatch(/expired or was already used/);
  });

  it('shows nothing without a callbackError', () => {
    mount('/auth?mode=signin');
    expect(screen.queryByTestId('auth-callback-notice')).toBeNull();
  });

  it('shows nothing for an unknown reason', () => {
    mount('/auth?mode=signin&callbackError=whatever');
    expect(screen.queryByTestId('auth-callback-notice')).toBeNull();
  });

  it('is a sign-in notice only: sign-up mode ignores the param', () => {
    mount('/auth?mode=signup&callbackError=expired');
    expect(screen.queryByTestId('auth-callback-notice')).toBeNull();
  });
});
