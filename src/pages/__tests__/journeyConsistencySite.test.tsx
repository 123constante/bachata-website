// @vitest-environment jsdom
/**
 * Definition of done, step 2, for the dancer journey OUTSIDE /app: the site's
 * dancer home (/account/dancer, DancerHome), the Finish screen and the account
 * pages, x the prod shapes, through the shared in-memory backend
 * (helpers/dancerBackend, the account.today pattern). The same four checks as
 * src/modules/dancer-app/__tests__/journeyConsistency.test.tsx (journeyChecks).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { CITY, FULL, makeBackend, type BackendState, type DancerRow } from './helpers/dancerBackend';
import { installJsdomPolyfills } from '../../../tests/client/jsdomPolyfills';

const h = vi.hoisted(() => ({
  backend: null as unknown as { client: { rpc: (n: string, a?: unknown) => Promise<unknown> } },
  visibility: 'visible' as string,
}));
vi.mock('@/integrations/supabase/client', () => ({
  get supabase() {
    return h.backend.client;
  },
}));
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => h.backend.client }));
vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({
    user: { id: 'u1', email: 'ana@example.com', is_anonymous: false },
    session: null,
    isLoading: false,
    authStatus: 'ready',
    signOut: async () => 'signed-out',
  }),
}));
vi.mock('@/hooks/useMyProfileVisibility', () => ({
  useMyProfileVisibility: () => ({ status: h.visibility, refetch: vi.fn() }),
}));
vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/contexts/CityContext', () => ({ useCity: () => ({ citySlug: 'london-gb' }) }));
vi.mock('@/lib/accountSettings', async (orig) => ({
  ...(await orig<typeof import('@/lib/accountSettings')>()),
  fetchEraseCheck: async () => ({ can_erase: true, blockers: [], code: null }),
}));

import Account from '@/pages/Account';
import FinishProfile from '@/pages/FinishProfile';
import AccountSettings from '@/pages/AccountSettings';
import AccountDeleted from '@/pages/AccountDeleted';
import AccountRestore from '@/pages/AccountRestore';
import { avatars, disabled, emptyStates, pointers } from '@/modules/dancer-app/__tests__/journeyChecks';

const EMPTY: DancerRow = { first_name: null, based_city_id: null, dance_role: null, avatar_url: null, archived_at: null };
type Shape = { label: string; row: DancerRow | null; hidden?: boolean };
const SHAPES: Shape[] = [
  { label: 'no profile', row: null },
  { label: 'empty profile', row: { ...EMPTY } },
  { label: 'no photo (name, city, role)', row: { ...FULL, avatar_url: null } },
  { label: 'complete', row: { ...FULL } },
  { label: 'hidden profile', row: { ...FULL }, hidden: true },
  { label: 'name + city only', row: { ...EMPTY, first_name: 'Ana', based_city_id: CITY.id } },
];

const PAGES = [
  ['dancer home (/account/dancer)', '/account/dancer'],
  ['finish profile', '/finish-profile'],
  ['account settings', '/account/settings'],
  ['delete account', '/account/settings/delete'],
  ['account deleted', '/account/deleted'],
  ['account restore', '/account/restore'],
] as const;

let here = '';
const Probe = () => {
  const l = useLocation();
  here = `${l.pathname}${l.search}`;
  return null;
};

const mount = (shape: Shape, at: string) => {
  const state: BackendState = { row: shape.row, organisers: 0, requests: [] };
  h.backend = makeBackend(state);
  h.visibility = !shape.row ? 'none' : shape.hidden ? 'hidden' : 'visible';
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[at]}>
        <Probe />
        <Routes>
          <Route path="/account" element={<Account />} />
          <Route path="/account/dancer" element={<Account view="dancer" />} />
          <Route path="/finish-profile" element={<FinishProfile />} />
          <Route path="/account/settings" element={<AccountSettings view="home" />} />
          <Route path="/account/settings/delete" element={<AccountSettings view="delete" />} />
          <Route path="/account/deleted" element={<AccountDeleted />} />
          <Route path="/account/restore" element={<AccountRestore />} />
          <Route path="*" element={<p>elsewhere</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const settled = () => {
  // A blank body is a route still moving (a Navigate, a lazy page): never a screen to check.
  expect((document.body.textContent ?? '').trim()).not.toBe('');
  expect(document.body.textContent ?? '').not.toMatch(/Loading|Checking/);
  expect(document.querySelector('[aria-busy="true"]')).toBeNull();
};

beforeEach(() => { installJsdomPolyfills(); sessionStorage.clear(); localStorage.clear(); });
afterEach(cleanup);

describe.each(PAGES)('%s', (_name, path) => {
  it.each(SHAPES)('$label', async (shape) => {
    mount(shape, path);
    await waitFor(settled);
    await new Promise((r) => setTimeout(r, 60));
    await waitFor(settled);
    const root = document.body;
    const photos = shape.row?.avatar_url ? [shape.row.avatar_url] : [];
    expect(pointers(root), 'a: copy points at a control that is not on screen').toEqual([]);
    expect(emptyStates(root), 'b: an empty state offers nothing to do').toEqual([]);
    expect(disabled(root), 'c: a disabled control has no visible reason').toEqual([]);
    expect(avatars(root, photos), 'd: an avatar outside PersonAvatar').toEqual([]);
  });
});

describe('d: the dancer home avatar is PersonAvatar for every shape that reaches it', () => {
  it.each([
    ['complete: the photo', { ...FULL }, 'photo'],
    ['hidden, complete: the photo', { ...FULL }, 'photo'],
  ] as const)('%s', async (_l, row, face) => {
    mount({ label: _l, row }, '/account/dancer');
    await waitFor(() => expect(document.querySelector('[data-testid="dancer-home-photo"], [data-testid="dancer-home-photo-empty"]')).not.toBeNull());
    const el = document.querySelector('[data-testid="dancer-home-photo"], [data-testid="dancer-home-photo-empty"]') as HTMLElement;
    expect(el.getAttribute('data-face')).toBe(face);
    expect(el.getAttribute('alt')).toBe("Ana's photo");
  });
});
