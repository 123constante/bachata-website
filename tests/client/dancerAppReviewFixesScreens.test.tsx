// @vitest-environment jsdom
/**
 * R1a review fixes, the screen half (S1, S2 + B1, S5, S11, S12). Each test went
 * red on the unfixed r1a head first; quotes in docs/handover/dancer-rebuild-r1a.md.
 * Harness: the same mocks as dancerAppHomeNights.test.tsx (Home reads nights and
 * the calendar; the profile goes through the fake backend via renderInShell).
 */
import { setLanguages } from './languagesTick';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

vi.mock('@/hooks/useAuth', async (importOriginal) =>
  (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));

const h = vi.hoisted(() => ({
  events: [] as Array<[string, unknown]>,
  rpc: async (fn: string) =>
    fn === 'get_my_event_attendance_v2' ? { data: [], error: null } : { data: null, error: { message: `unexpected rpc ${fn}` } },
}));
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => ({ rpc: h.rpc }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: h.rpc } }));
vi.mock('@/contexts/CityContext', () => ({
  CityProvider: ({ children }: { children: ReactNode }) => children,
  useCity: () => ({ citySlug: 'london-gb', setCitySlug: () => {} }),
}));
vi.mock('@/hooks/useCalendarEventsRpc', () => ({ useCalendarEvents: () => ({ data: [], isLoading: false, isError: false }) }));
vi.mock('@/lib/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/analytics')>()),
  trackAnalyticsEvent: (name: string, props: unknown) => { h.events.push([name, props]); },
}));
vi.mock('@/components/ui/city-picker', () => ({
  CityPicker: ({ value, onChange }: { value?: string; onChange: (id: string) => void }) => (
    <button type="button" data-testid="city-picker" onClick={() => onChange('c1000000-0000-4000-8000-000000000002')}>{value ?? 'Pick'}</button>
  ),
}));

import { Route } from 'react-router-dom';
import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';
import { DANCER_SHAPES, DANCER_SHAPE_NAMES, makeProfile, withDerived, CITY_LONDON } from '@/modules/dancer-app/api/fixtures';
import { usePutMyDancerEdit } from '@/modules/dancer-app/api/useMyDancerEdit';
import { setDancerAnalyticsUser } from '@/modules/dancer-app/analytics/events';
import { FAKE_USER_ID } from '@/modules/dancer-app/api/fixtures';
import type { MyDancerEdit } from '@/modules/dancer-app/api/types';

class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= ResizeObserverStub;

beforeEach(() => { h.events = []; localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { cleanup(); resetShell(); });

const ROLE_CITY_NAME = { first_name: 'Ana', based_city_id: CITY_LONDON.id, dance_role: 'Follower' as const };
/** B1: the 55% shape, built through withDerived (pct >= 70 <=> complete holds). */
const noPhoto = makeProfile({ ...ROLE_CITY_NAME });
const incomplete = DANCER_SHAPE_NAMES.filter((n) => DANCER_SHAPES[n].signedIn && DANCER_SHAPES[n].profile?.strength.next_step);
const cases: Array<[string, MyDancerEdit]> = [['noPhoto', noPhoto], ...incomplete.map((n) => [n, DANCER_SHAPES[n].profile!] as [string, MyDancerEdit])];

const textOf = async (path: string, profile: MyDancerEdit, testId: string) => {
  renderInShell({ path, backend: { profile } });
  const el = await screen.findByTestId(testId);
  const t = el.textContent ?? '';
  cleanup(); resetShell();
  return t;
};

describe('S2 + B1: the next step reads the same words on Home, Me and Onboarding', () => {
  it('the no-photo shape is a real server shape (55%, incomplete, next step photo)', () => {
    expect(noPhoto.strength.pct).toBe(55);
    expect(noPhoto.complete).toBe(false);
    expect(noPhoto.strength.next_step).toBe('photo');
    for (const [, p] of cases) expect(p.strength.pct >= 70).toBe(p.complete);
  });

  it.each(cases)('%s', async (_name, profile) => {
    const home = await textOf('/app/home', profile, 'tile-strength-next');
    const me = await textOf('/app/me', profile, 'me-next-step');
    expect(home).toBe(me);
    if (!profile.complete) {
      const onboarding = await textOf('/app/welcome', profile, 'onboarding-next-step');
      expect(onboarding).toBe(home);
    }
    if (profile.strength.next_step === 'photo') expect(home).toMatch(/photo/);
  });
});

describe('S1: Edit "Try again" sends the CURRENT delta and keeps unsent input', () => {
  it('fail, edit while the error shows, retry: both edits go, none is lost', async () => {
    const { backend } = renderInShell({ path: '/app/me/edit', backend: { shape: 'completeAllExtras' } });
    await screen.findByTestId('dancer-screen-edit');
    const type = (id: string, v: string) => fireEvent.change(document.getElementById(id)!, { target: { value: v } });
    backend.failNextWith('rate_limited');
    await setLanguages('French');
    fireEvent.click(screen.getByTestId('edit-save'));
    await screen.findByTestId('edit-top-error');
    type('bio', 'A newer bio');
    fireEvent.click(screen.getByTestId('edit-retry'));
    await waitFor(() => expect(backend.writes).toBe(1));
    const sent = backend.calls.filter((c) => c.fn === 'saveMyDancerProfile').at(-1)!.args;
    expect(sent).toEqual({ languages: ['French'], bio: 'A newer bio' });
    await waitFor(() => expect((document.getElementById('bio') as HTMLTextAreaElement).value).toBe('A newer bio'));
  });
});

describe('S5: profile_strength_70 fires wherever the cache crosses 70', () => {
  const Probe = ({ next }: { next: MyDancerEdit }) => {
    const put = usePutMyDancerEdit();
    return <button type="button" data-testid="probe-put" onClick={() => put(next)}>put</button>;
  };
  it('a photo-path cache write (55 -> 70) fires exactly once', async () => {
    const after = withDerived({ ...noPhoto, avatar_url: 'https://img.example/a.jpg' });
    const r = renderInShell({ path: '/probe', backend: { profile: noPhoto }, extraRoutes: <Route path="/probe" element={<Probe next={after} />} /> });
    // The shell publishes the analytics identity on /app/*; the probe route sits outside it.
    setDancerAnalyticsUser(FAKE_USER_ID);
    r.queryClient.setQueryData(['my-dancer-edit', FAKE_USER_ID], noPhoto);
    fireEvent.click(await screen.findByTestId('probe-put'));
    fireEvent.click(screen.getByTestId('probe-put'));
    expect(h.events.filter(([n]) => n === 'profile_strength_70')).toEqual([['profile_strength_70', { pct: 70 }]]);
  });
});

describe('S11: every stored style shows once, selected', () => {
  it('prod-shaped values (a preset, a lower-case preset, an off-list style) each render one chip', async () => {
    const p = makeProfile({ ...ROLE_CITY_NAME, favorite_styles: ['Bachata Sensual', 'zouk', 'Urban Kiz'] });
    renderInShell({ path: '/app/me/edit', backend: { profile: p } });
    await screen.findByTestId('dancer-screen-edit');
    const group = document.getElementById('favorite_styles')!;
    for (const label of ['Bachata Sensual', 'Zouk', 'Urban Kiz']) {
      const chips = within(group).getAllByRole('button').filter((b) => (b.textContent ?? '').trim().toLowerCase() === label.toLowerCase());
      expect(chips.length, label).toBe(1);
      expect(chips[0].getAttribute('aria-pressed'), label).toBe('true');
    }
  });
});

describe('S12: nationality shows the country name and keeps the ISO code', () => {
  it('a stored "ES" reads "Spain" in Edit', async () => {
    renderInShell({ path: '/app/me/edit', backend: { profile: makeProfile({ ...ROLE_CITY_NAME, nationality: 'ES' }) } });
    await screen.findByTestId('dancer-screen-edit');
    const field = document.getElementById('nationality')!;
    await waitFor(() => expect(field.textContent).toMatch(/Spain/));
  });
});
