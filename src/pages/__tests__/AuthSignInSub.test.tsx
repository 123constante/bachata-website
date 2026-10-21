// @vitest-environment jsdom
/**
 * Arc 1 flow 9a: "Welcome back" + ONE sub line on every sign-in visit, however
 * the person arrived (new phone, ended session, bounced link, a returnTo, the
 * Join tab). Table-driven over the visits; the Supabase client is mocked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
import { SIGN_IN_SUB } from '@/lib/auth-otp-routing';

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
  rpc.mockReset();
  signInWithOtp.mockReset();
});
afterEach(cleanup);

const subLine = () => screen.getByRole('heading', { level: 1 }).nextElementSibling?.textContent;

describe('9a: the sign-in sub line is the same on every visit', () => {
  it('is the mockup wording', () => {
    expect(SIGN_IN_SUB).toBe('Sign in with the email you used before.');
  });

  it.each([
    ['a plain visit', '/auth?mode=signin'],
    ['with a returnTo (a page that needs sign-in)', '/auth?mode=signin&returnTo=%2Faccount%2Fo'],
    ['after an expired link (9b)', '/auth?mode=signin&callbackError=expired'],
    ['after an invalid link', '/auth?mode=signin&callbackError=invalid'],
    ['after a timed-out callback', '/auth?mode=signin&callbackError=timeout'],
    ['after a manual bounce', '/auth?mode=signin&callbackError=manual'],
    ['with an unknown reason', '/auth?mode=signin&callbackError=whatever'],
  ])('%s', (_label, path) => {
    mount(path);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Welcome back');
    expect(subLine()).toBe(SIGN_IN_SUB);
  });

  it('from the Join tab: the same line', () => {
    mount('/auth?mode=signup');
    expect(subLine()).not.toBe(SIGN_IN_SUB);
    fireEvent.click(screen.getAllByRole('button', { name: 'Sign in' })[0]);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Welcome back');
    expect(subLine()).toBe(SIGN_IN_SUB);
  });
});
