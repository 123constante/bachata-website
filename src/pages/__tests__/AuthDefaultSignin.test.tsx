// @vitest-environment jsdom
/**
 * L1: a bare /auth link opens SIGN-IN. Only an explicit mode=signup opens
 * sign-up. Table-driven: every mode value x with and without a returnTo.
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
  sessionStorage.clear();
});
afterEach(cleanup);

const RETURN = 'returnTo=%2Fevent%2F1';
const heading = () => screen.getByRole('heading', { level: 1 }).textContent;

describe('L1: which tab a /auth link opens', () => {
  it.each([
    ['absent', '', 'Welcome back'],
    ['empty', 'mode=', 'Welcome back'],
    ['junk', 'mode=nonsense', 'Welcome back'],
    ['upper-case SIGNUP', 'mode=SIGNUP', 'Welcome back'],
    ['repeated, signin first', 'mode=signin&mode=signup', 'Welcome back'],
    ['repeated, signup first', 'mode=signup&mode=signin', 'Join the community'],
    ['signin', 'mode=signin', 'Welcome back'],
    ['signup', 'mode=signup', 'Join the community'],
  ])('mode %s', (_label, query, expected) => {
    for (const withReturn of [false, true]) {
      cleanup();
      const q = [query, withReturn ? RETURN : ''].filter(Boolean).join('&');
      mount(`/auth${q ? `?${q}` : ''}`);
      expect(heading(), q).toBe(expected);
    }
  });
});
