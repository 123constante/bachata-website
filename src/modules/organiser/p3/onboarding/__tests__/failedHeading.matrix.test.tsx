// @vitest-environment jsdom
// A failed-read checklist screen reads as a failed screen (not "Welcome"), and no onboarding heading draws a focus ring.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import fs from 'node:fs';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: vi.fn(), from: vi.fn() } }));
vi.mock('@/modules/organiser/wizard/wizardCountries', () => ({ wizardCountries: () => Promise.resolve([]) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'sam@example.com' } }) }));
vi.mock('@/components/account/profiles/signOutToHome', () => ({ SIGN_OUT_FAILED: 'failed', useSignOutToHome: () => ({ signOutToHome: vi.fn(async () => 'ok'), busy: false }) }));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ data: { organisers: [{ id: 'o1' }] }, isPending: false, isError: false, refetch: vi.fn() }) }));

import OnboardingFlow from '../OnboardingFlow';
import { GO_LIVE_NOT_DEPLOYED, type PageReads, type PageWrites } from '../pageApi';
import type { PersonReads, PersonWrites } from '../personApi';

const boom = async () => {
  throw new Error('Failed to fetch');
};
const ok = { page: async () => ({ name: 'Leeds Nights', city: 'Leeds', socials: {}, instagram: 'ln', organisation_category: 'Promoter', avatar_url: 'x' }), phone: async () => '+447700900123', status: async () => ({ v: 1, is_admin: false, person: { complete: false, missing: ['photo'] }, organisers: [] }), findPages: async () => [], cities: async () => [] };
const writes = { run: vi.fn(), create: vi.fn(), claim: vi.fn(), ask: vi.fn(), rename: vi.fn() } as unknown as PageWrites;
const personWrites: PersonWrites = { run: vi.fn(async () => undefined), skipAbout: vi.fn(async () => undefined) };
const person = (fail: boolean) => ({ dancer: fail ? boom : async () => ({ profile_id: 'd1', first_name: 'Sam', avatar_url: 'x', dance_role: 'Follower', nationality: 'GB', languages: ['English'] }), intent: async () => ({ roles: [], declined: [] }), teacher: async () => ({}), organiser: async () => ({ id: 'o1', name: 'Leeds Nights', bio: '', category: 'Promoter', city: 'Leeds' }) }) as unknown as PersonReads;

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('failed-read checklist screens', () => {
  it.each([['page', 'review'], ['person', 'photo']] as const)('%s read fails: heading says so, never "Welcome"', async (fail, at) => {
    const reads = (fail === 'page' ? { ...ok, page: boom } : ok) as unknown as PageReads;
    const flow = <OnboardingFlow reads={reads} writes={writes} personReads={person(fail === 'person')} personWrites={personWrites} goLive={GO_LIVE_NOT_DEPLOYED} organiserDetail upload={async () => 'x'} />;
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[`/account/p3/start?o=o1&at=${at}`]}><Routes><Route path="/account/p3/start" element={flow} /></Routes></MemoryRouter></QueryClientProvider>);
    await waitFor(() => expect(screen.getByTestId('p3-ob-readfail')).toBeTruthy());
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('That didn\u2019t load');
    expect(screen.getByTestId('p3-ob-retry')).toBeTruthy();
  });
});

describe('onboarding headings take focus (ObShell) but draw no ring', () => {
  const css = fs.readFileSync('src/modules/organiser/p3/onboarding/onboarding.css', 'utf8');
  it('a .p3-ob .p3-ob-t:focus-visible rule removes the outline, after the global ring rule', () => {
    const ring = css.indexOf('.p3-ob :focus-visible');
    const none = css.search(/\.p3-ob \.p3-ob-t:focus-visible\s*\{[^}]*outline:\s*none/);
    expect(ring).toBeGreaterThan(-1);
    expect(none).toBeGreaterThan(ring);
  });
});
