// @vitest-environment jsdom
// The checklist's "read failed" screen also offers the way back to the refused event when there is a valid one; never otherwise.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: vi.fn(), from: vi.fn() } }));
vi.mock('@/modules/organiser/wizard/wizardCountries', () => ({ wizardCountries: () => Promise.resolve([]) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'sam@example.com' } }) }));
vi.mock('@/components/account/profiles/signOutToHome', () => ({ SIGN_OUT_FAILED: 'failed', useSignOutToHome: () => ({ signOutToHome: vi.fn(async () => 'ok'), busy: false }) }));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ data: { organisers: [{ id: 'o1' }] }, isPending: false, isError: false, refetch: vi.fn() }) }));

import OnboardingFlow from '../OnboardingFlow';
import { GO_LIVE_NOT_DEPLOYED, type PageReads, type PageWrites } from '../pageApi';
import type { PersonReads, PersonWrites } from '../personApi';
import { BACK_TO_EVENT } from '../returnTo';

const boom = async () => {
  throw new Error('Failed to fetch');
};
const ok = { page: async () => ({ name: 'Leeds Nights', city: 'Leeds', socials: {}, instagram: 'ln', organisation_category: 'Promoter', avatar_url: 'x' }), phone: async () => '+447700900123', status: async () => ({ v: 1, is_admin: false, person: { complete: false, missing: ['photo'] }, organisers: [] }), findPages: async () => [], cities: async () => [] };
const writes = { run: vi.fn(), create: vi.fn(), claim: vi.fn(), ask: vi.fn(), rename: vi.fn() } as unknown as PageWrites;
const personWrites: PersonWrites = { run: vi.fn(async () => undefined), skipAbout: vi.fn(async () => undefined) };
const person = (fail: boolean) => ({ dancer: fail ? boom : async () => ({ profile_id: 'd1', first_name: 'Sam', avatar_url: 'x', dance_role: 'Follower', nationality: 'GB', languages: ['English'] }), intent: async () => ({ roles: [], declined: [] }), teacher: async () => ({}), organiser: async () => ({ id: 'o1', name: 'Leeds Nights', bio: '', category: 'Promoter', city: 'Leeds' }) }) as unknown as PersonReads;
const Landed = () => {
  const loc = useLocation();
  return <span data-testid="landed" data-path={loc.pathname} data-kept={String((loc.state as { p3KeptBack?: boolean } | null)?.p3KeptBack === true)} />;
};

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

const FAILS = [['page', 'review'], ['person', 'photo']] as const;
const ARRIVALS: ReadonlyArray<[string, string | null, boolean]> = [['valid event', '/account/p3/events/e1', true], ['no event', null, false], ['off-site event', 'https://evil.example/account/p3/events/e1', false], ['malformed id', '/account/p3/events/e 1', false]];

describe('read failed x arrival: the way back to the event', () => {
  it.each(FAILS.flatMap(([fail, at]) => ARRIVALS.map(([name, back, shows]) => ({ fail, at, name, back, shows }))))('$fail / $name', async ({ fail, at, back, shows }) => {
    const reads = (fail === 'page' ? { ...ok, page: boom } : ok) as unknown as PageReads;
    const flow = <OnboardingFlow reads={reads} writes={writes} personReads={person(fail === 'person')} personWrites={personWrites} goLive={GO_LIVE_NOT_DEPLOYED} organiserDetail upload={async () => 'x'} />;
    const url = `/account/p3/start?o=o1&at=${at}${back === null ? '' : `&back=${encodeURIComponent(back)}`}`;
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[url]}><Routes><Route path="/account/p3/start" element={flow} /><Route path="*" element={<Landed />} /></Routes></MemoryRouter></QueryClientProvider>);
    await waitFor(() => expect(screen.getByTestId('p3-ob-readfail')).toBeTruthy());
    expect(screen.getByTestId('p3-ob-retry')).toBeTruthy();
    const btn = screen.queryByTestId('p3-ob-back-event');
    if (!shows) return expect(btn).toBeNull();
    expect(btn?.textContent).toBe(BACK_TO_EVENT);
    fireEvent.click(btn!);
    await waitFor(() => expect(screen.getByTestId('landed').getAttribute('data-path')).toBe('/account/p3/events/e1'));
    expect(screen.getByTestId('landed').getAttribute('data-kept')).toBe('true');
  });
});
