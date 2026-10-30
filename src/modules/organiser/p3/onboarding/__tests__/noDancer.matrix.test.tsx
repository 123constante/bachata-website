// @vitest-environment jsdom
/**
 * p3-prefix-b: an owner with NO dancer row (prod 2026-10-30: 3 of 43 accounts; my_dancer_edit_v1 raises
 * `no_profile`, and so does save_my_dancer_profile_v2, so the site cannot create one) must never meet a
 * Retry that cannot succeed. Owner shape (has a row, a stub row with every field empty, no row, a read
 * error) x screen (Welcome, the /you/details route, the onboarding person step, Review -> a person row).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: vi.fn(), from: vi.fn() } }));
vi.mock('@/modules/organiser/wizard/wizardCountries', () => ({ wizardCountries: () => Promise.resolve([]) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'sam@example.com' } }) }));
vi.mock('@/components/account/profiles/signOutToHome', () => ({ SIGN_OUT_FAILED: 'failed', useSignOutToHome: () => ({ signOutToHome: vi.fn(async () => 'ok'), busy: false }) }));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ data: { organisers: [{ id: 'o1' }] }, isPending: false, isError: false, refetch: vi.fn() }) }));

import OnboardingFlow from '../OnboardingFlow';
import PersonFlow from '../PersonFlow';
import { GO_LIVE_NOT_DEPLOYED, type PageReads, type PageWrites } from '../pageApi';
import type { PersonReads, PersonWrites } from '../personApi';
import { NO_PROFILE_CONTACT_URL, NO_PROFILE_TEXT } from '@/lib/profileCompletion';

type OwnerShape = 'hasRow' | 'stubRow' | 'noRow' | 'readError';
const DANCER: Record<OwnerShape, () => Promise<Record<string, unknown>>> = {
  hasRow: async () => ({ profile_id: 'd1', first_name: 'Sam', avatar_url: 'https://img/a.jpg', dance_role: 'Follower', nationality: 'GB', languages: ['English'] }),
  // The auth.users trigger's auto_stub row: a row, every field empty.
  stubRow: async () => ({ profile_id: 'd2', first_name: null, avatar_url: null, dance_role: null, nationality: null, languages: [] }),
  // fetchWizardDancer rethrows the RPC error message: my_dancer_edit_v1 RAISE MESSAGE = 'no_profile'.
  noRow: async () => {
    throw new Error('no_profile');
  },
  readError: async () => {
    throw new Error('Failed to fetch');
  },
};

const personReads = (shape: OwnerShape): PersonReads => ({
  dancer: vi.fn(DANCER[shape]),
  intent: async () => ({ roles: [], declined: [] }) as never,
  teacher: async () => ({}),
  organiser: async () => ({ id: 'o1', name: 'Leeds Nights', bio: '', category: 'Promoter', city: 'Leeds' }),
});
const page = { name: 'Leeds Nights', city: 'Leeds', socials: {}, instagram: 'ln', organisation_category: 'Promoter', avatar_url: 'https://img/l.png' };
const pageReads: PageReads = {
  page: async () => page,
  phone: async () => '+447700900123',
  status: async (id: string) => ({ v: 1, is_admin: false, person: { complete: false, missing: ['photo'] }, organisers: [{ id, name: 'Leeds Nights', role: 'owner', lifecycle: 'live', complete: true, missing: [], about: { done: false, skipped: false } }] }),
  findPages: async () => [],
  cities: async () => [],
} as unknown as PageReads;
const pageWrites = { run: vi.fn(), create: vi.fn(), claim: vi.fn(), ask: vi.fn(), rename: vi.fn() } as unknown as PageWrites;
const personWrites: PersonWrites = { run: vi.fn(async () => undefined), skipAbout: vi.fn(async () => undefined) };

type Screen = 'welcome' | 'details' | 'onboardingDetails' | 'review';
function mount(where: Screen, shape: OwnerShape) {
  const reads = personReads(shape);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const flow = <OnboardingFlow reads={pageReads} writes={pageWrites} personReads={reads} personWrites={personWrites} goLive={GO_LIVE_NOT_DEPLOYED} organiserDetail upload={async () => 'x'} />;
  const url = where === 'details' ? '/account/p3/you/details?o=o1' : `/account/p3/start?o=o1${where === 'welcome' ? '' : where === 'review' ? '&at=review' : '&at=photo'}`;
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/account/p3/start" element={flow} />
          <Route path="/account/p3/you/details" element={<PersonFlow reads={reads} writes={personWrites} />} />
          <Route path="*" element={<span data-testid="elsewhere" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return reads;
}

const shown = () => screen.getByTestId('p3-ob-shell').getAttribute('data-screen');
const settle = () => waitFor(() => expect(shown()).not.toMatch(/loading/));

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

/** The person step a shape lands on: the screen itself, the no-dancer screen, or the read error. */
const EXPECT: Record<OwnerShape, 'step' | 'nodancer' | 'readfail'> = { hasRow: 'step', stubRow: 'step', noRow: 'nodancer', readError: 'readfail' };
const SHAPES = Object.keys(EXPECT) as OwnerShape[];

describe('owner shape x screen: no dancer row is never a dead end', () => {
  it.each(SHAPES)('Welcome / %s: Welcome renders; no read error, no no-dancer screen', async (shape) => {
    mount('welcome', shape);
    await waitFor(() => expect(shown()).toBe('welcome'));
    expect(screen.queryByTestId('p3-ob-readfail')).toBeNull();
    expect(screen.queryByTestId('p3-ob-nodancer')).toBeNull();
  });

  const PERSON_SCREENS: Screen[] = ['details', 'onboardingDetails', 'review'];
  it.each(PERSON_SCREENS.flatMap((where) => SHAPES.map((shape) => ({ where, shape }))))('$where / $shape', async ({ where, shape }) => {
    const reads = mount(where, shape);
    await settle();
    if (where === 'review') {
      // Review reads the server's missing[], not the dancer row: it renders for every shape, and its person row opens the step.
      expect(shown()).toBe('review');
      fireEvent.click(screen.getByTestId('p3-ob-review-photo'));
      await settle();
    }
    const want = EXPECT[shape];
    if (want === 'step') {
      await waitFor(() => expect(shown()).toBe(where === 'details' ? 'name' : 'photo'));
      expect(screen.queryByTestId('p3-ob-readfail')).toBeNull();
      return;
    }
    if (want === 'nodancer') {
      await waitFor(() => expect(screen.getByTestId('p3-ob-nodancer').textContent).toBe(NO_PROFILE_TEXT));
      // The one action is real (the team's contact link); no Retry that cannot succeed; no generic error.
      expect(screen.getByTestId('p3-ob-nodancer-contact').getAttribute('href')).toBe(NO_PROFILE_CONTACT_URL);
      expect(screen.queryByTestId('p3-ob-retry')).toBeNull();
      expect(screen.queryByTestId('p3-ob-readfail')).toBeNull();
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      return;
    }
    // A real read error keeps Retry, and Retry reads again.
    await waitFor(() => expect(screen.getByTestId('p3-ob-readfail')).toBeTruthy());
    const before = (reads.dancer as ReturnType<typeof vi.fn>).mock.calls.length;
    fireEvent.click(screen.getByTestId('p3-ob-retry'));
    await waitFor(() => expect((reads.dancer as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(before));
    expect(screen.queryByTestId('p3-ob-nodancer')).toBeNull();
  });
});
