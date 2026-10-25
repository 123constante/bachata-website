// @vitest-environment jsdom
/**
 * /account dashboard completion (owner decision 2026-10-23, review R6): the %
 * shows ONCE, and is main's number for the same profile. The harness (mocks,
 * ROW, wrap) is the one src/lib/__tests__/dancerProfilePrivateColumns.test.tsx
 * uses; the pure oracle over every profile shape is dancerCompletion.test.ts.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';

class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
(globalThis as { IntersectionObserver?: unknown }).IntersectionObserver ??= NoopObserver;

const PRIVATE = ['email', 'phone', 'whatsapp', 'created_by', 'claimed_by', 'meta_data'] as const;
const ACCOUNT = 'acct-1';

type RpcMode = 'data' | 'empty' | 'error';

const h = vi.hoisted(() => {
  const state = {
    mode: 'data' as 'data' | 'empty' | 'error',
    row: {} as Record<string, unknown>,
    selects: [] as string[],
    rpcs: [] as string[],
  };
  /** Top-level select tokens -> the keys PostgREST would return. */
  const project = (cols: string, row: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    let depth = 0;
    let cur = '';
    const tokens: string[] = [];
    for (const ch of cols) {
      if (ch === '(') depth += 1;
      if (ch === ')') depth -= 1;
      if (ch === ',' && depth === 0) {
        tokens.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    tokens.push(cur.trim());
    for (const t of tokens) {
      if (t === '*') Object.assign(out, Object.fromEntries(Object.entries(row).filter(([k]) => !k.includes('('))));
      else {
        const key = t.split(/[!(:]/)[0].trim();
        out[key] = row[key] ?? null;
      }
    }
    return out;
  };
  const chain = (table: string) => {
    let cols = '*';
    const builder: Record<string | symbol, unknown> = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === 'then') {
            return (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
              Promise.resolve({ data: [], error: null }).then(res, rej);
          }
          if (prop === 'select') {
            return (c?: string) => {
              cols = c ?? '*';
              if (table === 'dancer_profiles') state.selects.push(cols);
              return builder;
            };
          }
          if (prop === 'maybeSingle' || prop === 'single') {
            return async () => ({
              data: table === 'dancer_profiles' ? project(cols, state.row) : null,
              error: null,
            });
          }
          return () => builder;
        },
      },
    );
    return builder;
  };
  const user = { id: 'acct-1', is_anonymous: false, user_metadata: {}, email_confirmed_at: null, last_sign_in_at: null };
  return { state, chain, user };
});
const saveMyDancerProfile = vi.hoisted(() => vi.fn());

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => h.chain(table),
    rpc: async (name: string) => {
      h.state.rpcs.push(name);
      return { data: [], error: null };
    },
    auth: {
      getSession: async () => ({ data: { session: { user: h.user } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      updateUser: async () => ({ error: null }),
    },
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
  },
}));
vi.mock('@/integrations/supabase/rpcLoose', () => ({
  rpcLoose: async (fn: string) => {
    h.state.rpcs.push(fn);
    if (fn === '_my_dancer_profile_id_v1') return { data: ACCOUNT, error: null };
    const { mode } = h.state;
    if (mode === 'error') return { data: null, error: { message: 'boom', code: '42501' } };
    if (fn === 'my_dancer_contact_v1') {
      return mode === 'data'
        ? {
            data: [{ profile_id: ACCOUNT, email: 'x@example.invalid', phone: '+44 1', whatsapp: '+44 7700 900000', show_contact_publicly: false }],
            error: null,
          }
        : { data: [], error: null };
    }
    if (fn === 'my_dancer_meta_v1') return { data: mode === 'data' ? { onboarding_status: 'in_progress' } : null, error: null };
    return { data: null, error: null };
  },
}));
vi.mock('@/lib/saveMyDancerProfile', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/saveMyDancerProfile')>()),
  saveMyDancerProfile,
}));
vi.mock('@/lib/city-canonical', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/city-canonical')>()),
  resolveCanonicalCity: async () => ({ cityId: 'c1', cityName: 'London' }),
}));
vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({ user: h.user, isLoading: false, authStatus: 'ready', retryAuth: () => {} }),
}));
vi.mock('@/hooks/useUnsavedChangesGuard', () => ({ useUnsavedChangesGuard: () => {} }));
vi.mock('@/modules/organiser-self-serve/selfServeApi', () => ({ fetchOrganiserHome: async () => ({ organisers: [] }) }));
vi.mock('@/lib/featureFlags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/featureFlags')>()),
  flags: { organiserSelfServe: true },
}));
vi.mock('@/modules/organiser/shared/ownershipApi', () => ({ fetchCurrentUserOrganiserIds: async () => [] }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/contexts/CityContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/contexts/CityContext')>()),
  useCity: () => ({ citySlug: null, cityId: null, cityName: null, setCity: () => {}, cities: [], loading: false }),
}));
vi.mock('@/components/ui/city-picker', () => ({ CityPicker: () => null }));

import { DancerDashboard } from '@/components/profile/DancerDashboard';

/** A complete persona row. The private columns are SET, so a leak would show. */
const ROW = {
  id: ACCOUNT,
  first_name: 'Ana',
  surname: 'Bee',
  based_city_id: 'c1',
  dance_role: 'Follower',
  avatar_url: null,
  nationality: 'GB',
  instagram: 'ana.ig',
  facebook: '',
  website_url: '',
  email: 'x@example.invalid',
  phone: '+44 1',
  whatsapp: '+44 7700 900000',
  created_by: 'someone',
  claimed_by: ACCOUNT,
  meta_data: { onboarding_status: 'in_progress' },
  cities: { name: 'London' },
  dancing_role_details: null,
};

const wrap = (ui: ReactNode, path: string) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>home</p>} />
        <Route path="/profile" element={ui} />
        <Route path="/edit-profile" element={ui} />
        <Route path="/auth/callback" element={ui} />
        <Route path="*" element={<p>landed</p>} />
      </Routes>
    </MemoryRouter>
  </QueryClientProvider>
);

/** Every top-level column a select string names; `*` stands for all of them. */
const topLevelColumns = (cols: string): string[] => {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of cols) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else if (depth === 0 && ch !== ')') cur += ch;
  }
  out.push(cur.trim());
  return out.map((t) => t.split(/[!:]/)[0].trim()).filter(Boolean);
};

const expectNoPrivateSelect = () => {
  expect(h.state.selects.length).toBeGreaterThan(0);
  for (const s of h.state.selects) {
    const cols = topLevelColumns(s);
    expect(cols, `select('${s}')`).not.toContain('*');
    for (const p of PRIVATE) expect(cols, `select('${s}')`).not.toContain(p);
  }
};

const sentKeys = () => saveMyDancerProfile.mock.calls.flatMap((c) => Object.keys(c[0] ?? {}));

beforeEach(() => {
  h.state.selects = [];
  h.state.rpcs = [];
  h.state.row = { ...ROW };
  localStorage.clear();
  sessionStorage.clear();
  saveMyDancerProfile.mockReset().mockImplementation(async (p: Record<string, unknown>) => ({ ...ROW, ...p }));
});
afterEach(cleanup);

describe.each(['data', 'empty', 'error'] as RpcMode[])('RPC answers: %s', (mode) => {
  beforeEach(() => {
    h.state.mode = mode;
  });

  it('the completion % shows ONCE, and is main\'s number', async () => {
    render(wrap(<DancerDashboard />, '/profile'));
    // ROW: name + city, role, instagram; no photo; no nights (going switch off) -> main's 3/5.
    const badge = await screen.findByTestId('dashboard-completion');
    expect(badge.textContent).toBe('60% ready');
    expect(document.body.textContent?.match(/\d+%/g)).toEqual(['60%']);
    expect(screen.queryByText(/core tiles live/)).toBeNull();
    expect(screen.queryByText(/^Completion$/)).toBeNull();
    // The Calendar tile reads the same fact as step 3 (no nights): not 'Live'.
    expect(screen.getByText('Find your next night')).toBeTruthy();
    expect(screen.queryByText('Nights in your list')).toBeNull();
  });
});
