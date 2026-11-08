// @vitest-environment jsdom
/** Find says when the list is cut short: matches {0,1,8,9,20} x rows shown x note. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const sb = vi.hoisted(() => ({ limitArg: [] as number[], rows: [] as unknown[] }));
vi.mock('@/integrations/supabase/client', () => {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  for (const k of ['select', 'eq', 'not', 'ilike', 'order']) chain[k] = self;
  chain.limit = (n: number) => { sb.limitArg.push(n); return Promise.resolve({ data: sb.rows.slice(0, n), error: null }); };
  return { supabase: { auth: {}, rpc: vi.fn(async () => ({ data: [], error: null })), from: vi.fn(() => chain) } };
});
vi.mock('@/modules/organiser/wizard/wizardCountries', () => ({ wizardCountries: () => Promise.resolve([]) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'sam@example.com' } }) }));
vi.mock('@/components/account/profiles/signOutToHome', () => ({ SIGN_OUT_FAILED: 'failed', useSignOutToHome: () => ({ signOutToHome: vi.fn(async () => 'ok'), busy: false }) }));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ data: { organisers: [] }, isPending: false, isError: false, refetch: vi.fn() }) }));

import OnboardingFlow from '../OnboardingFlow';
import { searchClaimableOrganisers, FIND_LIMIT } from '../../../shared/selfServeApi';
import type { PageReads, PageWrites } from '../pageApi';
import type { PersonReads, PersonWrites } from '../personApi';

const mkRows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Page ${i}`, slug: null, avatar_url: null, city_id: null, hint: 'managed' as const }));

function mount(rows: unknown[] | null) {
  const reads = {
    page: vi.fn(async () => ({})), phone: vi.fn(async () => null),
    status: vi.fn(async () => ({ v: 1, is_admin: false, person: { complete: true, missing: [] }, organisers: [] })),
    findPages: vi.fn(async () => { if (rows === null) throw new Error('boom'); return rows; }),
    cities: vi.fn(async () => []),
  } as unknown as PageReads;
  const writes = { run: vi.fn(), create: vi.fn(), claim: vi.fn(), ask: vi.fn(), rename: vi.fn() } as unknown as PageWrites;
  const pw: PersonWrites = { run: vi.fn(async () => undefined), skipAbout: vi.fn(async () => undefined) };
  const pr = { dancer: async () => ({}), intent: async () => ({ roles: [], declined: [] }), teacher: async () => ({}), organiser: async () => ({}) } as unknown as PersonReads;
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/account/p3/start?at=find']}>
        <Routes><Route path="/account/p3/start" element={<OnboardingFlow reads={reads} writes={writes} personReads={pr} personWrites={pw} upload={async () => ''} />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
afterEach(() => { cleanup(); sb.limitArg = []; });

const CELLS = [
  { matches: 0, shown: 0, note: false }, { matches: 1, shown: 1, note: false }, { matches: 8, shown: 8, note: false },
  { matches: 9, shown: 8, note: true }, { matches: 20, shown: 8, note: true },
];

describe('findMore.matrix', () => {
  it('FIND_LIMIT is 8', () => expect(FIND_LIMIT).toBe(8));
  it.each(CELLS)('$matches matches -> $shown rows, note $note', async ({ matches, shown, note }) => {
    // the read returns up to FIND_LIMIT + 1 rows, as the real query does
    mount(mkRows(Math.min(matches, FIND_LIMIT + 1)));
    fireEvent.change(await screen.findByTestId('p3-ob-find-q'), { target: { value: 'Page' } });
    await waitFor(() => expect(screen.getByTestId('p3-ob-find-results').textContent).not.toMatch(/Type two|Searching/), { timeout: 2000 });
    expect(screen.queryAllByTestId(/^p3-ob-find-p\d+$/)).toHaveLength(shown);
    const el = screen.queryByTestId('p3-ob-find-more');
    expect(!!el).toBe(note);
    if (el) { expect(el.getAttribute('role')).toBe('status'); expect(el.textContent).toBe('Showing the first 8. Type more of the name to narrow it.'); expect(el.className).toContain('text-sm'); }
  });
  it('error state still offers retry and no note', async () => {
    mount(null);
    fireEvent.change(await screen.findByTestId('p3-ob-find-q'), { target: { value: 'Page' } });
    expect(await screen.findByTestId('p3-ob-find-retry', {}, { timeout: 2000 })).toBeTruthy();
    expect(screen.queryByTestId('p3-ob-find-more')).toBeNull();
  });
  it('searchClaimableOrganisers: default asks for 8 (NewPageFlow), optional limit passes through', async () => {
    sb.rows = mkRows(20);
    expect(await searchClaimableOrganisers('Page')).toHaveLength(8);
    expect(await searchClaimableOrganisers('Page', FIND_LIMIT + 1)).toHaveLength(9);
    expect(sb.limitArg).toEqual([8, 9]);
  });
});
