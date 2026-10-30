// @vitest-environment jsdom
/**
 * Go live (F3, brief p3-golive-wiring): REAL_GO_LIVE (complete_organiser_onboarding_v1) through a MOCKED supabase
 * client -- never the network, never prod (it would publish a real page). Every server answer the live body gives
 * (read 2026-10-29) x Review's states x deployed on / off, against the ONE mapping (goLiveState / reviewCopy /
 * goLiveRefusalCopy / liveCopy): Review and Live agree with it, every refusal has a next action, pending_review is
 * never "You're live", a double tap sends one call and shows one result.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc, from: vi.fn() } }));
vi.mock('@/modules/organiser/wizard/wizardCountries', () => ({ wizardCountries: () => Promise.resolve([]) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'sam@example.com' } }) }));
vi.mock('@/components/account/profiles/signOutToHome', () => ({ SIGN_OUT_FAILED: 'failed', useSignOutToHome: () => ({ signOutToHome: vi.fn(async () => 'ok'), busy: false }) }));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ data: { organisers: [{ id: 'o1' }] }, isPending: false, isError: false, refetch: vi.fn() }) }));

import OnboardingFlow from '../OnboardingFlow';
import { GO_LIVE_NOT_DEPLOYED, REAL_GO_LIVE, type GoLiveApi, type PageReads, type PageWrites } from '../pageApi';
import type { PersonReads, PersonWrites } from '../personApi';
import {
  GoLiveError,
  goLiveOutcomeFrom,
  goLiveRefusalCopy,
  goLiveRefusalOfMessage,
  goLiveState,
  liveCopy,
  reviewCopy,
  reviewPercent,
  reviewRow,
  type GoLiveRefusal,
  type ReviewStatus,
} from '../pageModel';

const PAGE = { name: 'Leeds Nights', city: 'Leeds', socials: { facebook: 'https://facebook.com/ln' }, instagram: 'leedsnights', website: 'https://ln.com', organisation_category: 'Promoter', avatar_url: 'https://img/l.png' };
const statusOf = (lifecycle: string, missing: string[]) => ({ v: 1, is_admin: false, person: { complete: true, missing: [] }, organisers: [{ id: 'o1', name: PAGE.name, role: 'owner', lifecycle, complete: missing.length === 0, missing, about: { done: false, skipped: false } }] });
const PERSON_READS: PersonReads = {
  dancer: async () => ({ first_name: 'Sam', avatar_url: 'https://img/a.jpg', dance_role: 'Follower', nationality: 'GB', languages: ['English'] }),
  intent: async () => ({ roles: [], declined: ['teacher'] }) as never,
  teacher: async () => ({ teaching_styles: [], years_teaching: null }) as never,
  organiser: async () => ({ id: 'o1', name: 'Leeds Nights', bio: '', category: 'Promoter', city: 'Leeds' }),
};

function Where() {
  const l = useLocation();
  return <span data-testid="where">{l.pathname + l.search}</span>;
}

function mount(o: { lifecycle?: string; missing?: string[]; goLive?: GoLiveApi; organiserDetail?: boolean } = {}) {
  const reads: PageReads = {
    page: vi.fn(async () => PAGE),
    phone: vi.fn(async () => '+447700900123'),
    status: vi.fn(async () => statusOf(o.lifecycle ?? 'draft', o.missing ?? [])),
    findPages: vi.fn(async () => []),
    cities: vi.fn(async () => []),
  };
  const writes: PageWrites = { run: vi.fn(async () => undefined), create: vi.fn(async () => 'o1'), claim: vi.fn(async () => undefined), ask: vi.fn(async () => undefined), rename: vi.fn(async () => undefined) };
  const personWrites: PersonWrites = { run: vi.fn(async () => undefined), skipAbout: vi.fn(async () => undefined) };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/account/p3/start?o=o1&at=review']}>
        <Routes>
          <Route path="/account/p3/start" element={<OnboardingFlow reads={reads} writes={writes} personReads={PERSON_READS} personWrites={personWrites} goLive={o.goLive ?? REAL_GO_LIVE} organiserDetail={o.organiserDetail ?? true} upload={async () => 'x'} />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { reads, qc };
}

const cont = () => screen.getByTestId('p3-ob-continue');
const title = () => screen.getByTestId('p3-ob-title').textContent ?? '';
const shownStep = () => screen.getByTestId('p3-ob-shell').getAttribute('data-screen');
const onStep = async (s: string) => waitFor(() => expect(shownStep()).toBe(s));
const ok = (data: unknown) => ({ data, error: null });
const raised = (message: string, code?: string) => ({ data: null, error: { message, ...(code ? { code } : {}) } });
const progress = () => Number(screen.getByTestId('p3-ob-progress').getAttribute('aria-valuenow'));

beforeEach(() => {
  rpc.mockReset();
  window.localStorage.clear();
});
afterEach(cleanup);

// ---- the pure mapping ----

describe('goLiveOutcomeFrom / goLiveRefusalOfMessage: every answer of the live body', () => {
  it.each([
    [{ ok: true, changed: true, lifecycle: 'live', review: false }, 'live'],
    [{ ok: true, changed: true, lifecycle: 'pending_review', review: true }, 'pending_review'],
    [{ ok: true, changed: false, lifecycle: 'live', review: false }, 'live'],
    [{ ok: true, changed: false, lifecycle: 'pending_review', review: true }, 'pending_review'],
  ])('%j -> %s', (raw, out) => expect(goLiveOutcomeFrom(raw)).toBe(out));

  it.each<[unknown, GoLiveRefusal, string[]]>([
    [{ ok: false, reason: 'incomplete', missing: ['org_logo', 'photo'] }, 'incomplete', ['org_logo', 'photo']],
    [{ ok: false, reason: 'incomplete', missing: null }, 'incomplete', []],
    [{ ok: false, reason: 'invalid_state', lifecycle: 'archived' }, 'invalid-state', []],
    [{ ok: false, reason: 'something_new' }, 'failed', []],
    [{ ok: true, lifecycle: 'archived' }, 'failed', []],
    [null, 'failed', []],
  ])('%j refuses as %s', (raw, refusal, missing) => {
    let e: unknown;
    try {
      goLiveOutcomeFrom(raw);
    } catch (x) {
      e = x;
    }
    expect(e).toBeInstanceOf(GoLiveError);
    expect((e as GoLiveError).refusal).toBe(refusal);
    expect((e as GoLiveError).missing).toEqual(missing);
  });

  it.each<[string, GoLiveRefusal]>([
    ['authentication_required', 'signed-out'],
    ['not_found', 'not-owner'],
    ['Failed to fetch', 'failed'],
    // A real signed-out browser never reaches the RAISE: PostgREST refuses first (review r1 should-fix).
    ['permission denied for function complete_organiser_onboarding_v1', 'signed-out'],
    ['JWT expired', 'signed-out'],
    ['PGRST301 JWT expired', 'signed-out'],
    ['PGRST301', 'signed-out'],
    ['permission denied for table organiser_profiles', 'failed'],
  ])('raised %s -> %s', (m, r) => expect(goLiveRefusalOfMessage(m)).toBe(r));

  it('every refusal has text and one next action', () => {
    for (const r of ['incomplete', 'invalid-state', 'not-owner', 'signed-out', 'failed'] as GoLiveRefusal[]) {
      const c = goLiveRefusalCopy(r);
      expect(c.text.length).toBeGreaterThan(10);
      expect(['rows', 'home', 'sign-in', 'retry']).toContain(c.action);
    }
  });

  it.each([
    ['live', true, 'You\u2019re live', true, ['view', 'share', 'home']],
    ['live', false, 'You\u2019re live', true, ['view', 'home']],
    ['pending_review', true, 'Sent for a quick check', false, ['home']],
    ['pending_review', false, 'Sent for a quick check', false, ['home']],
  ] as const)('liveCopy(%s, organiserDetail %s): %s', (outcome, detail, t, celebrate, actions) => {
    const c = liveCopy(outcome, 'Leeds Nights', detail);
    expect(c.title).toBe(t);
    expect(c.celebrate).toBe(celebrate);
    expect(c.actions).toEqual(actions);
    if (outcome === 'pending_review') expect(c.sub).not.toMatch(/live/i);
  });
});

// ---- Review: every state x deployed on / off ----

const LIFECYCLES = ['draft', 'rejected', 'live', 'pending_review', 'archived'] as const;
const MISSING = [[], ['org_logo'], ['org_logo', 'photo']] as const;
const CELLS = LIFECYCLES.flatMap((lifecycle) => MISSING.flatMap((missing) => [true, false].map((deployed) => ({ lifecycle, missing: [...missing], deployed }))));

describe('Review x every lifecycle x missing x deployed: the screen IS the mapping', () => {
  it.each(CELLS)('$lifecycle missing=$missing deployed=$deployed', async ({ lifecycle, missing, deployed }) => {
    const s: ReviewStatus = { missing, isAdmin: false, lifecycle, about: { done: false, skipped: false } };
    const c = reviewCopy(s, deployed);
    const state = goLiveState(s, deployed);
    const complete = vi.fn(async () => 'live' as const);
    mount({ lifecycle, missing, goLive: deployed ? { deployed: true, complete } : GO_LIVE_NOT_DEPLOYED });
    await onStep('review');
    expect(title()).toBe(c.title);
    expect(cont().textContent).toBe(c.primary);
    // A disabled button always says why; an enabled one never carries a stale reason.
    expect(cont().getAttribute('aria-disabled') === 'true').toBe(!!c.reason);
    if (c.reason) expect(screen.getByTestId('p3-ob-why').textContent).toBe(c.reason);
    // Copy that says "Finish the N things" has those rows on screen.
    if (/Finish/.test(c.reason ?? '')) for (const m of missing) expect(screen.queryByTestId(`p3-ob-review-${m}`) ?? screen.getByTestId('p3-ob-review-all')).toBeTruthy();
    expect(['blocked', 'ready', 'not-yet', 'live', 'in-review', 'closed']).toContain(state);
    fireEvent.click(cont());
    if (state === 'ready') {
      await onStep('live');
      expect(complete).toHaveBeenCalledTimes(1);
    } else if (state === 'live' || state === 'in-review' || state === 'closed') {
      await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/account/p3'));
      expect(complete).not.toHaveBeenCalled();
    } else {
      expect(await screen.findByTestId('p3-ob-toast')).toBeTruthy();
      expect(complete).not.toHaveBeenCalled();
    }
    if (state !== 'ready') expect(screen.queryByText('You\u2019re live')).toBeNull();
  });
});

// ---- Review -> server answer -> next action (REAL_GO_LIVE, mocked client) ----

describe('Go live: every server answer on a ready draft', () => {
  it.each([
    ['live (changed)', { ok: true, changed: true, lifecycle: 'live', review: false }],
    ['already live (no-op ok)', { ok: true, changed: false, lifecycle: 'live', review: false }],
  ])('%s -> You\u2019re live, confetti, View / Share / Home', async (_n, data) => {
    rpc.mockResolvedValue(ok(data));
    mount();
    await onStep('review');
    fireEvent.click(cont());
    await onStep('live');
    expect(rpc).toHaveBeenCalledWith('complete_organiser_onboarding_v1', { p_organiser_id: 'o1' });
    expect(title()).toBe('You\u2019re live');
    expect(screen.getByTestId('p3-ob-confetti')).toBeTruthy();
    expect(screen.getByTestId('p3-ob-live-view').getAttribute('href')).toBe('/organisers/o1');
    expect(screen.getByTestId('p3-ob-live-share')).toBeTruthy();
    fireEvent.click(screen.getByTestId('p3-ob-live-home'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/account/p3'));
  });

  it.each([
    ['sent (changed)', { ok: true, changed: true, lifecycle: 'pending_review', review: true }],
    ['already in review (no-op ok)', { ok: true, changed: false, lifecycle: 'pending_review', review: true }],
  ])('%s -> Sent for a quick check: no confetti, no View / Share, never "You\u2019re live"', async (_n, data) => {
    rpc.mockResolvedValue(ok(data));
    mount();
    await onStep('review');
    fireEvent.click(cont());
    await onStep('live-review');
    expect(title()).toBe('Sent for a quick check');
    expect(screen.queryByText('You\u2019re live')).toBeNull();
    expect(screen.queryByTestId('p3-ob-confetti')).toBeNull();
    expect(screen.queryByTestId('p3-ob-live-view')).toBeNull();
    expect(screen.queryByTestId('p3-ob-live-share')).toBeNull();
    expect(screen.getByTestId('p3-ob-live-home')).toBeTruthy();
  });

  it('organiserDetail off: View opens the page in P3 (the public page is "coming soon"), no Share', async () => {
    rpc.mockResolvedValue(ok({ ok: true, changed: true, lifecycle: 'live', review: false }));
    mount({ organiserDetail: false });
    await onStep('review');
    fireEvent.click(cont());
    await onStep('live');
    expect(screen.queryByTestId('p3-ob-live-share')).toBeNull();
    fireEvent.click(screen.getByTestId('p3-ob-live-view'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/account/p3/you/page'));
  });

  it('incomplete -> stays on Review, lists what the server says is missing; a row jumps to its step', async () => {
    rpc.mockResolvedValue(ok({ ok: false, reason: 'incomplete', missing: ['org_logo'] }));
    mount();
    await onStep('review');
    fireEvent.click(cont());
    expect((await screen.findByTestId('p3-ob-golive-err')).textContent).toBe(goLiveRefusalCopy('incomplete').text);
    expect(shownStep()).toBe('review');
    expect(title()).toBe('1 thing left');
    expect(cont().getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByTestId('p3-ob-review-org_logo').textContent).toContain(reviewRow('org_logo').label);
    fireEvent.click(screen.getByTestId('p3-ob-review-org_logo'));
    await onStep('logo');
  });

  it.each<[string, { data: unknown; error: { message: string } | null }, GoLiveRefusal, string, string]>([
    ['invalid_state', ok({ ok: false, reason: 'invalid_state', lifecycle: 'archived' }), 'invalid-state', 'Go to Home', '/account/p3'],
    ['not owner (not_found)', raised('not_found'), 'not-owner', 'Go to Home', '/account/p3'],
    ['signed out', raised('authentication_required'), 'signed-out', 'Sign in again', '/auth'],
  ])('%s -> says so, one next action', async (_n, answer, refusal, label, to) => {
    rpc.mockResolvedValue(answer);
    mount();
    await onStep('review');
    fireEvent.click(cont());
    expect((await screen.findByTestId('p3-ob-golive-err')).textContent).toBe(goLiveRefusalCopy(refusal).text);
    expect(cont().textContent).toBe(label);
    expect(cont().getAttribute('aria-disabled')).toBeNull();
    fireEvent.click(cont());
    await waitFor(() => expect(screen.getByTestId('where').textContent?.startsWith(to)).toBe(true));
    if (refusal === 'signed-out') expect(decodeURIComponent(screen.getByTestId('where').textContent ?? '')).toContain('/account/p3/start?o=o1&at=review');
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('network failure -> Try again (nothing lost); the retry goes live', async () => {
    rpc.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(ok({ ok: true, changed: true, lifecycle: 'live', review: false }));
    mount();
    await onStep('review');
    fireEvent.click(cont());
    expect((await screen.findByTestId('p3-ob-golive-err')).textContent).toBe(goLiveRefusalCopy('failed').text);
    expect(cont().textContent).toBe('Try again');
    fireEvent.click(cont());
    await onStep('live');
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('double tap: one call, button busy while in flight, one result', async () => {
    let resolve: (v: unknown) => void = () => undefined;
    rpc.mockReturnValue(new Promise((r) => (resolve = r)));
    mount();
    await onStep('review');
    fireEvent.click(cont());
    fireEvent.click(cont());
    fireEvent.click(cont());
    await waitFor(() => expect(cont().getAttribute('aria-disabled')).toBe('true'));
    expect(cont().textContent).toBe('Going live\u2026');
    expect(rpc).toHaveBeenCalledTimes(1);
    resolve(ok({ ok: true, changed: true, lifecycle: 'live', review: false }));
    await onStep('live');
    expect(screen.getAllByTestId('p3-ob-title')).toHaveLength(1);
    expect(screen.queryByTestId('p3-ob-golive-err')).toBeNull();
  });
});

// ---- review r1: a real signed-out answer, a stale refusal, progress that tells the truth ----

describe('signed out as PostgREST really says it (anon / expired token) -> Sign in again', () => {
  it.each([
    ['anon: permission denied (42501)', raised('permission denied for function complete_organiser_onboarding_v1', '42501')],
    ['expired token (401, PGRST301)', raised('JWT expired', 'PGRST301')],
    ['PGRST301 with another message', raised('No suitable key or wrong key type', 'PGRST301')],
  ])('%s', async (_n, answer) => {
    rpc.mockResolvedValue(answer);
    mount();
    await onStep('review');
    fireEvent.click(cont());
    expect((await screen.findByTestId('p3-ob-golive-err')).textContent).toBe(goLiveRefusalCopy('signed-out').text);
    expect(cont().textContent).toBe('Sign in again');
  });
});

describe('a refusal is cleared when the status read brings new missing items', () => {
  it('failed -> status now says 1 thing left: the disabled reason shows, not Try again', async () => {
    rpc.mockRejectedValue(new TypeError('Failed to fetch'));
    const missing: string[] = [];
    const { qc } = mount({ missing });
    await onStep('review');
    fireEvent.click(cont());
    expect(await screen.findByTestId('p3-ob-golive-err')).toBeTruthy();
    expect(cont().textContent).toBe('Try again');
    missing.push('org_logo');
    await qc.invalidateQueries({ queryKey: ['p3-ob-status'] });
    await waitFor(() => expect(title()).toBe('1 thing left'));
    expect(screen.queryByTestId('p3-ob-golive-err')).toBeNull();
    expect(cont().textContent).toBe('Go live');
    expect(cont().getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByTestId('p3-ob-why').textContent).toBe('Finish the 1 thing left to go live.');
  });
});

describe('progress tells the truth: done steps over all steps, 100% only when nothing is left', () => {
  it.each([
    [10, 0, 100],
    [10, 1, 80],
    [10, 2, 70],
    [10, 9, 0],
    [10, 12, 0],
    [14, 1, 86],
    [1, 0, 100],
  ])('reviewPercent(%i steps, %i missing) = %i', (total, n, pct) => expect(reviewPercent(total, n)).toBe(pct));

  it('never 100 while anything is missing', () => {
    for (let total = 1; total <= 30; total++) for (let n = 1; n <= 5; n++) expect(reviewPercent(total, n)).toBeLessThan(100);
  });

  const STATES = LIFECYCLES.flatMap((lifecycle) => MISSING.map((missing) => ({ lifecycle, missing: [...missing] })));
  it.each(STATES)('Review $lifecycle missing=$missing: the bar matches what is left', async ({ lifecycle, missing }) => {
    mount({ lifecycle, missing, goLive: { deployed: true, complete: vi.fn(async () => 'live' as const) } });
    await onStep('review');
    const bar = screen.getByTestId('p3-ob-progress');
    expect(screen.getByTestId('p3-ob-pct').textContent).toBe(`${bar.getAttribute('aria-valuenow')}%`);
    if (missing.length === 0) expect(progress()).toBe(100);
    else expect(progress()).toBeLessThan(100);
  });

  it('more missing reads lower', async () => {
    const at = async (missing: string[]) => {
      mount({ missing });
      await onStep('review');
      const v = progress();
      cleanup();
      return v;
    };
    const one = await at(['org_logo']);
    const two = await at(['org_logo', 'photo']);
    expect(two).toBeLessThan(one);
  });

  it('an incomplete refusal from the server drops the bar below 100 at once', async () => {
    rpc.mockResolvedValue(ok({ ok: false, reason: 'incomplete', missing: ['org_logo'] }));
    mount();
    await onStep('review');
    expect(progress()).toBe(100);
    fireEvent.click(cont());
    await screen.findByTestId('p3-ob-golive-err');
    expect(progress()).toBeLessThan(100);
  });

  it.each([
    ['live', { ok: true, changed: true, lifecycle: 'live', review: false }, 'live'],
    ['review variant', { ok: true, changed: true, lifecycle: 'pending_review', review: true }, 'live-review'],
  ])('Live (%s) is 100%%', async (_n, data, step) => {
    rpc.mockResolvedValue(ok(data));
    mount();
    await onStep('review');
    fireEvent.click(cont());
    await onStep(step);
    expect(progress()).toBe(100);
  });
});
