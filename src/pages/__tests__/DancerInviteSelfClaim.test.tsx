// @vitest-environment jsdom
/**
 * M70 (owner decision, Website side): the admin's dancer invite e-mail links to
 * the dancer link (/auth?mode=signup&userType=dancer, or sign-in). Whichever the
 * person does, /auth/callback runs the self-claim (claim_my_dancer_profile_v1)
 * for the confirmed e-mail BEFORE reading the persona, so the profile the admin
 * made is the one the rest of the sign-in sees. Pinned for sign-up AND sign-in.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';

const h = vi.hoisted(() => ({ calls: [] as string[], persona: 'own-stub' as string | null }));
const user = vi.hoisted(() => ({
  id: 'u-new',
  email: 'invited@example.com',
  user_metadata: { user_type: 'dancer' } as Record<string, unknown>,
  email_confirmed_at: '2026-10-15T10:00:00Z',
  last_sign_in_at: '2026-10-15T10:00:01Z',
}));
const COMPLETE = { first_name: 'Ana', based_city_id: 'c1', dance_role: 'Follower' };

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: (_c: string, id: string) => ({
          maybeSingle: async () => {
            h.calls.push(`read:${id}`);
            return { data: { id, ...COMPLETE }, error: null };
          },
        }),
      }),
    }),
    rpc: async () => ({ data: null, error: null }),
    auth: {
      getSession: async () => ({ data: { session: { user } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));
vi.mock('@/integrations/supabase/rpcLoose', () => ({
  rpcLoose: async (fn: string) => {
    h.calls.push(fn);
    if (fn === 'claim_my_dancer_profile_v1') {
      // The admin-made profile carries the account's confirmed e-mail: linked.
      h.persona = 'admin-made-1';
      return { data: { ok: true, status: 'linked', profile_id: 'admin-made-1' }, error: null };
    }
    if (fn === '_my_dancer_profile_id_v1') return { data: h.persona, error: null };
    return { data: null, error: null };
  },
}));
vi.mock('@/lib/featureFlags', () => ({ flags: { organiserSelfServe: true } }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/lib/analytics', () => ({ trackAnalyticsEvent: () => {} }));

import AuthCallback from '../AuthCallback';
import { DANCER_LINK } from '../../../tests/journeys/publicEntryJourneys';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  h.calls = [];
  h.persona = 'own-stub';
  vi.spyOn(console, 'debug').mockImplementation(() => {});
});
afterEach(cleanup);

describe('the dancer invite e-mail lands on the dancer link and self-claims the admin-made profile', () => {
  it('the dancer link is the sign-up as a dancer', () => {
    const u = new URL(DANCER_LINK, 'https://x.test');
    expect(u.pathname).toBe('/auth');
    expect(u.searchParams.get('mode')).toBe('signup');
    expect(u.searchParams.get('userType')).toBe('dancer');
  });

  it.each(['signup', 'signin'])('/auth/callback?mode=%s: claims once, before the persona read, and reads the admin-made profile', async (mode) => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={[`/auth/callback?mode=${mode}`]}>
          <Routes>
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="*" element={<p>landed</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByText('landed');
    expect(h.calls.filter((c) => c === 'claim_my_dancer_profile_v1')).toHaveLength(1);
    expect(h.calls.indexOf('claim_my_dancer_profile_v1')).toBeLessThan(h.calls.indexOf('_my_dancer_profile_id_v1'));
    expect(h.calls).toContain('read:admin-made-1');
    expect(h.calls).not.toContain('read:own-stub');
  });
});
