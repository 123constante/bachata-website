// @vitest-environment jsdom
/**
 * Integration (bundle): the Options sign-out confirm is loaded ON DEMAND, so the shared
 * sign-out-to-home module is not a first-load chunk of /app/* (perf-budgets chunk ratchet:
 * it was one more request on every dancer-app view). And while signing out, the sheet's
 * Close is disabled: the confirm owns the H10 "leave first, then sign out" wait, so it must
 * not be unmounted half way.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

vi.mock('@/hooks/useAuth', async (importOriginal) =>
  (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));

const h = vi.hoisted(() => ({ busy: false, signOutToHome: (() => Promise.resolve('ok')) as () => Promise<'ok' | 'failed'> }));
vi.mock('@/components/account/profiles/signOutToHome', async (importOriginal) => {
  const mod = await importOriginal<Record<string, unknown>>();
  return { ...mod, useSignOutToHome: () => ({ signOutToHome: () => h.signOutToHome(), busy: h.busy }) };
});
vi.mock('@/contexts/CityContext', () => ({
  CityProvider: ({ children }: { children: ReactNode }) => children,
  useCity: () => ({ citySlug: 'london-gb', setCitySlug: () => {} }),
}));
vi.mock('@/hooks/useCalendarEventsRpc', () => ({ useCalendarEvents: () => ({ data: [], isLoading: false, isError: false }) }));
vi.mock('@/integrations/supabase/getSupabase', () => ({
  getSupabase: async () => ({
    rpc: async () => ({ data: [], error: null }),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { slug: 'london-gb' }, error: null }) }) }) }),
  }),
}));

import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';
import { CITY_LONDON, makeProfile } from '@/modules/dancer-app/api/fixtures';

const SCREEN = 'src/modules/dancer-app/screens/options/OptionsScreen.tsx';

beforeEach(() => { h.busy = false; h.signOutToHome = () => Promise.resolve('ok'); });
afterEach(() => { cleanup(); resetShell(); });

describe('Options sign-out is loaded on demand', () => {
  it('OptionsScreen has no static import of the sign-out-to-home module', () => {
    const src = readFileSync(SCREEN, 'utf8');
    expect(src).not.toMatch(/^import[^;]*from\s+['"]@\/components\/account\/profiles\/signOutToHome['"]/m);
  });

  it('OptionsScreen lazy-loads the confirm through lazyWithRetry', () => {
    const src = readFileSync(SCREEN, 'utf8');
    expect(src).toMatch(/lazyWithRetry\(\(\) => import\('\.\/SignOutConfirm'\)\)/);
  });

  it.each([
    [false, false],
    [true, true],
  ])('busy=%s: the sheet Close is disabled=%s', async (busy, closeDisabled) => {
    h.busy = busy;
    renderInShell({ path: '/app/options', backend: { profile: makeProfile({ first_name: 'Ana', based_city_id: CITY_LONDON.id }) } });
    fireEvent.click(await screen.findByTestId('opt-sign-out'));
    await screen.findByTestId('opt-signout-confirm');
    const sheet = screen.getByTestId('opt-signout-sheet');
    await waitFor(() => expect((within(sheet).getByRole('button', { name: 'Close' }) as HTMLButtonElement).disabled).toBe(closeDisabled));
  });
});
