// @vitest-environment jsdom
/**
 * W4b build 2 slices 2+3: the whole onboarding route (OnboardingFlow) x the prod page shapes, with fake
 * reads / writes (no network). Asserts per page screen: one question, aria-valuenow = the % shown and on
 * the FULL path, an untouched Continue sends nothing (diff-first), a change sends one command; Find / claim
 * (sheet portalled to body) / create and its refusals; Review from missing[] (Go live disabled WITH the
 * reason while complete_organiser_onboarding_v1 is not wired in, deployed: false); Live (confetti) only via a deployed
 * go-live; the Settings sheet (dark switch writes p3-ob-theme); the Home grace banner.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: vi.fn(), from: vi.fn() } }));
vi.mock('@/modules/organiser/wizard/wizardCountries', () => ({ wizardCountries: () => Promise.resolve([]) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'sam@example.com' } }) }));
vi.mock('@/components/account/profiles/signOutToHome', () => ({ SIGN_OUT_FAILED: 'failed', useSignOutToHome: () => ({ signOutToHome: vi.fn(async () => 'ok'), busy: false }) }));
const home = vi.hoisted(() => ({ organisers: [{ id: 'o1' }] as { id: string }[], teach: 'yes' as 'yes' | 'no' }));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ data: { organisers: home.organisers }, isPending: false, isError: false, refetch: vi.fn() }) }));

import OnboardingFlow from '../OnboardingFlow';
import { GO_LIVE_NOT_DEPLOYED, type PageReads, type PageWrites } from '../pageApi';
import type { PersonReads, PersonWrites } from '../personApi';

const cont = () => screen.getByTestId('p3-ob-continue');

import { FIND_INVITE_NOTE } from '../pageModel';

const WA = 'https://wa.me/447700900000';
const MAIL = 'team@example.com';
const LINKS = { both: [WA, MAIL], whatsapp: [WA, ''], email: ['', MAIL], none: ['', ''] } as const;
const FINDS = { 'no results': { q: 'Zzz Nowhere', rows: [] }, results: { q: 'Leeds', rows: [{ id: 'p1', name: 'Bachata Nights Leeds', slug: null, avatar_url: null, city_id: null, hint: 'managed' as const }] }, error: { q: 'Leeds', rows: null }, 'short query': { q: 'L', rows: [] } };

function mount(at: string | null, find: { q: string; rows: unknown[] | null }) {
  const reads = {
    page: vi.fn(async () => ({})), phone: vi.fn(async () => null),
    status: vi.fn(async () => ({ v: 1, is_admin: false, person: { complete: true, missing: [] }, organisers: [] })),
    findPages: vi.fn(async () => { if (find.rows === null) throw new Error('boom'); return find.rows; }),
    cities: vi.fn(async () => []),
  } as unknown as PageReads;
  const writes = { run: vi.fn(), create: vi.fn(), claim: vi.fn(), ask: vi.fn(), rename: vi.fn() } as unknown as PageWrites;
  const personWrites: PersonWrites = { run: vi.fn(async () => undefined), skipAbout: vi.fn(async () => undefined) };
  const personReads = { dancer: async () => ({}), intent: async () => ({ roles: [], declined: [] }), teacher: async () => ({}), organiser: async () => ({}) } as unknown as PersonReads;
  home.organisers = [];
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[`/account/p3/start${at ? `?at=${at}` : ''}`]}>
        <Routes><Route path="/account/p3/start" element={<OnboardingFlow reads={reads} writes={writes} personReads={personReads} personWrites={personWrites} goLive={GO_LIVE_NOT_DEPLOYED} organiserDetail upload={async () => ''} />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const step = () => screen.getByTestId('p3-ob-shell').getAttribute('data-screen');
afterEach(() => { cleanup(); vi.unstubAllEnvs(); document.body.innerHTML = ''; });
beforeEach(() => window.localStorage.clear());

describe('findFooter.matrix: invite note + footer on the Find step', () => {
  const cells = Object.keys(FINDS).flatMap((f) => Object.keys(LINKS).map((l) => ({ f, l })));
  it.each(cells)('$f x links:$l', async ({ f, l }) => {
    const [wa, em] = LINKS[l as keyof typeof LINKS];
    vi.stubEnv('VITE_SUPPORT_WHATSAPP', wa);
    vi.stubEnv('VITE_SUPPORT_EMAIL', em);
    mount('find', FINDS[f as keyof typeof FINDS]);
    await waitFor(() => expect(step()).toBe('find'));
    fireEvent.change(screen.getByTestId('p3-ob-find-q'), { target: { value: FINDS[f as keyof typeof FINDS].q } });
    if (f !== 'short query') await waitFor(() => expect(screen.getByTestId('p3-ob-find-results').textContent).not.toMatch(/Type two|Searching/), { timeout: 2000 });
    expect(screen.getByTestId('p3-ob-find-invite-note').textContent).toContain(FIND_INVITE_NOTE);
    expect(cont().textContent).toBe('Have an invite? Create a page');
    const wl = screen.queryByTestId('p3-ob-find-support-whatsapp');
    const el = screen.queryByTestId('p3-ob-find-support-email');
    expect(wl?.getAttribute('href') ?? null).toBe(wa || null);
    expect(el?.getAttribute('href') ?? null).toBe(em ? `mailto:${em}` : null);
    expect(screen.queryAllByRole('link').every((a) => !!a.getAttribute('href'))).toBe(true);
    // copy names only controls that are on screen
    expect(screen.getByTestId('p3-ob-find-invite-note').textContent).not.toMatch(/button below|tap/i);
    expect(document.body.textContent).not.toContain('Not listed');
  });
  it('absent on every other step; Find button still moves to create-name', async () => {
    mount('cat', FINDS.results);
    await waitFor(() => expect(step()).not.toBe('find'));
    expect(screen.queryByTestId('p3-ob-find-invite-note')).toBeNull();
    cleanup();
    mount('find', FINDS['no results']);
    await waitFor(() => expect(step()).toBe('find'));
    fireEvent.click(cont());
    await waitFor(() => expect(step()).toBe('create-name'));
    expect(screen.queryByTestId('p3-ob-find-invite-note')).toBeNull();
  });
});
