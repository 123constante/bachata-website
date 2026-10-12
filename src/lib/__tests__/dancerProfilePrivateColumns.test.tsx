// @vitest-environment jsdom
/**
 * Contact lockdown step 2 (admin PR #770): no authenticated Website read of
 * dancer_profiles may name a private column, and no own-profile save may send a
 * private key it never loaded.
 *
 * Step 3 revokes `authenticated`'s column SELECT on dancer_profiles email,
 * phone, whatsapp, created_by, claimed_by and meta_data. After that a select
 * naming any of them -- or `*`, which expands to them -- fails the WHOLE read
 * with 42501. The own-row contact moves to my_dancer_contact_v1(); meta_data is
 * not read at all (it can never decide a gate: see inferOnboardingStatusFromDancer).
 *
 * Every own-profile call site x every RPC answer { data, null/empty, error }:
 * the page still renders, no select string names a private column, and an
 * untouched save sends no private key.
 *
 * The mock answers a dancer_profiles read with ONLY the columns its select
 * string names, as PostgREST does -- so a screen cannot pass by reading a
 * column it no longer asks for.
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

import { AuthGuard } from '@/components/auth/AuthGuard';
import AuthCallback from '@/pages/AuthCallback';
import EditProfile from '@/pages/EditProfile';
import { DancerDashboard } from '@/components/profile/DancerDashboard';
import { buildDashboardSectionPayload } from '@/lib/dancerEditorPayloads';

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

const MODES: RpcMode[] = ['data', 'empty', 'error'];

describe.each(MODES)('RPC answers: %s', (mode) => {
  beforeEach(() => {
    h.state.mode = mode;
  });

  it('AuthGuard: a complete persona is let in; no private column is read', async () => {
    render(wrap(<AuthGuard><p>inside</p></AuthGuard>, '/profile'));
    expect(await screen.findByText('inside')).toBeTruthy();
    expectNoPrivateSelect();
  });

  it('AuthGuard: an incomplete persona goes home once (no loop); no private column is read', async () => {
    h.state.row = { ...ROW, based_city_id: null };
    render(wrap(<AuthGuard><p>inside</p></AuthGuard>, '/profile'));
    expect(await screen.findByText('home')).toBeTruthy();
    expect(screen.queryByText('inside')).toBeNull();
    expectNoPrivateSelect();
  });

  it('AuthCallback: a complete persona routes onwards with no save; no private column is read', async () => {
    render(wrap(<AuthCallback />, '/auth/callback?mode=signin'));
    await waitFor(() => expect(screen.queryByText('landed') ?? screen.queryByText('home')).toBeTruthy());
    expect(saveMyDancerProfile).not.toHaveBeenCalled();
    expectNoPrivateSelect();
  });

  it('EditProfile: renders the persona; no private column is read; an untouched Save sends nothing', async () => {
    render(wrap(<EditProfile />, '/edit-profile'));
    expect(await screen.findByDisplayValue('Ana')).toBeTruthy();
    expectNoPrivateSelect();
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await new Promise((r) => setTimeout(r, 30));
    expect(saveMyDancerProfile).not.toHaveBeenCalled();
  });

  it('EditProfile: an edited Save sends no private key', async () => {
    render(wrap(<EditProfile />, '/edit-profile'));
    const first = await screen.findByDisplayValue('Ana');
    fireEvent.change(first, { target: { value: 'Anna' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(saveMyDancerProfile).toHaveBeenCalledTimes(1));
    for (const p of PRIVATE) expect(sentKeys()).not.toContain(p);
  });

  it('DancerDashboard: renders; no private column is read; WhatsApp is shown only when loaded', async () => {
    render(wrap(<DancerDashboard />, '/profile'));
    fireEvent.click(await screen.findByRole('button', { name: /edit links/i }));
    const wa = (await screen.findByPlaceholderText('+44 7XXX XXX XXX')) as HTMLInputElement;
    expectNoPrivateSelect();
    if (mode === 'data') {
      expect(wa.value).toBe('+44 7700 900000');
      expect(wa.disabled).toBe(false);
    } else {
      // Unknown is not empty: never shown as a blank the person could "save".
      expect(wa.value).toBe('');
      expect(wa.disabled).toBe(true);
    }
  });

  it('DancerDashboard: an untouched social Save sends no whatsapp key', async () => {
    render(wrap(<DancerDashboard />, '/profile'));
    fireEvent.click(await screen.findByRole('button', { name: /edit links/i }));
    await screen.findByPlaceholderText('+44 7XXX XXX XXX');
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(saveMyDancerProfile).toHaveBeenCalledTimes(1));
    for (const p of PRIVATE) expect(sentKeys()).not.toContain(p);
  });
});

describe('DancerDashboard: an edited WhatsApp is sent', () => {
  it('when contact loaded', async () => {
    h.state.mode = 'data';
    render(wrap(<DancerDashboard />, '/profile'));
    fireEvent.click(await screen.findByRole('button', { name: /edit links/i }));
    const wa = await screen.findByPlaceholderText('+44 7XXX XXX XXX');
    fireEvent.change(wa, { target: { value: '+44 7700 900111' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(saveMyDancerProfile).toHaveBeenCalledTimes(1));
    expect(saveMyDancerProfile.mock.calls[0][0].whatsapp).toBe('+44 7700 900111');
  });
});

describe('buildDashboardSectionPayload("social"): whatsapp only as a real edit of a loaded value', () => {
  const form = { instagram: '', facebook: '', website: '', whatsapp: '' } as Parameters<typeof buildDashboardSectionPayload>[1];
  it.each([
    ['never loaded (undefined)', undefined, '', false],
    ['never loaded (null)', null, '', false],
    ['loaded, unchanged', '+44 1', '+44 1', false],
    ['loaded empty, unchanged', '', '', false],
    ['loaded, edited', '+44 1', '+44 2', true],
    ['loaded empty, filled in', '', '+44 2', true],
  ] as const)('%s', (_n, loaded, typed, sent) => {
    const payload = buildDashboardSectionPayload('social', { ...form, whatsapp: typed }, { loadedWhatsapp: loaded });
    expect('whatsapp' in payload).toBe(sent);
  });
});

// ---------------------------------------------------------------------------
// The CLASS, not the four sites: every dancer_profiles read in the repo.
// ---------------------------------------------------------------------------
const ROOT = join(__dirname, '..', '..', '..');
const SCAN_DIRS = ['src', 'app', 'api', 'scripts', 'supabase/functions'];
const walk = (dir: string): string[] => {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((name) => {
    if (name === 'node_modules' || name === '__tests__' || name.startsWith('.')) return [];
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.(tsx?|mjs|js)$/.test(name) && !/\.test\./.test(name) ? [p] : [];
  });
};

describe('every .from("dancer_profiles") read names no private column', () => {
  const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));
  const sites = files.flatMap((file) => {
    const src = readFileSync(file, 'utf8');
    const out: { at: string; arg: string }[] = [];
    const re = /\.from\(\s*["'`]dancer_profiles["'`]\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      // The select of THIS chain: the first .select( before the next .from( or
      // the end of the statement, read with balanced parentheses.
      const tail = src.slice(m.index + m[0].length, m.index + m[0].length + 800);
      const stop = tail.search(/\.from\(|;\s*\n/);
      const chain = stop === -1 ? tail : tail.slice(0, stop);
      const at = chain.indexOf('.select(');
      let sel: string | null = null;
      if (at !== -1) {
        let depth = 0;
        let i = at + '.select'.length;
        for (; i < chain.length; i += 1) {
          if (chain[i] === '(') depth += 1;
          if (chain[i] === ')') depth -= 1;
          if (depth === 0) break;
        }
        sel = chain.slice(at + '.select('.length, i).trim();
      }
      const line = src.slice(0, m.index).split('\n').length;
      out.push({ at: `${relative(ROOT, file)}:${line}`, arg: sel ?? '<no select>' });
    }
    return out;
  });

  it('finds the known readers (the scan is not vacuous)', () => {
    expect(sites.length).toBeGreaterThanOrEqual(10);
  });

  it.each(sites.map((s) => [s.at, s.arg]))('%s', (_at, arg) => {
    if (arg === '<no select>') return; // a write chain with no read
    if (arg === '') throw new Error('bare .select() returns every column');
    const literal = /^["'`]([\s\S]*)["'`]$/.exec(arg);
    // An identifier must be the public column list, which has its own contract.
    if (!literal) {
      expect(arg).toBe('DANCER_PUBLIC_COLS');
      return;
    }
    const cols = topLevelColumns(literal[1]);
    expect(cols).not.toContain('*');
    for (const p of PRIVATE) expect(cols).not.toContain(p);
  });
});
