// @vitest-environment jsdom
/**
 * instagram-refusal r2, commit A: every checklist row reaches a place where ITS field can be entered.
 * Every code in REVIEW_ROWS (+ an unknown code) x person state {base-incomplete, base-complete, no_profile}
 * -> tap the row on Review -> the destination (the real router: /app/* is the real DancerAppRoutes,
 * /finish-profile the real RedirectIfAllowed) -> the control for THAT code is on screen. no_profile has no
 * field to fill anywhere, so its control is the screen's "message us" way on.
 * Red on the unfixed code: instagram, dj_answer, dj_genres, and the unknown code (handover
 * docs/handover/instagram-refusal-r2.md, "Commit A").
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { Route } from 'react-router-dom';

vi.mock('@/hooks/useAuth', async (importOriginal) => (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));
vi.mock('@/components/ui/city-picker', () => ({ CityPicker: () => <button type="button">City</button> }));
vi.mock('@/modules/organiser/wizard/wizardCountries', () => ({ wizardCountries: () => Promise.resolve([]) }));
vi.mock('@/components/account/profiles/signOutToHome', () => ({ SIGN_OUT_FAILED: 'failed', useSignOutToHome: () => ({ signOutToHome: vi.fn(async () => 'ok'), busy: false }) }));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ data: { organisers: [{ id: 'o1' }] }, isPending: false, isError: false, refetch: vi.fn() }) }));

import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';
import { makeProfile, CITY_LONDON } from '@/modules/dancer-app/api/fixtures';
import type { FakeDancerBackend } from '@/modules/dancer-app/api/fakeBackend';
import OnboardingFlow from '../OnboardingFlow';
import { GO_LIVE_NOT_DEPLOYED, type PageReads, type PageWrites } from '../pageApi';
import type { PersonReads, PersonWrites } from '../personApi';
import { DJ_ORDER, PERSON_ORDER, commandFor, genresReason, heldFrom, personPath, type PersonCommand } from '../personModel';
import { REVIEW_ROWS, appEditHref } from '../pageModel';

type State = 'base-incomplete' | 'base-complete' | 'no_profile';
const STATES: readonly State[] = ['base-incomplete', 'base-complete', 'no_profile'];
const UNKNOWN = 'later_item';

const FOUR = { first_name: 'Sam', based_city_id: CITY_LONDON.id, dance_role: 'Follower' as const, avatar_url: 'https://img.example/a.jpg' };
// Base-incomplete = no city (profile_complete_v1 needs it): the shape the city row exists for.
const PROFILE: Record<State, ReturnType<typeof makeProfile> | null> = {
  'base-incomplete': makeProfile({ ...FOUR, based_city_id: null }),
  'base-complete': makeProfile({ ...FOUR }),
  no_profile: null,
};

const PERSON_CODES = new Set(['first_name', 'city', 'dance_role', 'photo', 'nationality', 'languages', 'instagram', 'teach_answer', 'teach_styles', 'teach_years', 'teach_levels', 'dj_answer', 'dj_genres']);

/** account_role_intent as each code needs it (_onboarding_missing_v1): dj_genres = dj claimed with no genres. */
const intentFor = (missing: readonly string[]) => ({
  roles: [...(missing.some((c) => c.startsWith('teach_') && c !== 'teach_answer') ? ['teacher'] : []), ...(missing.includes('dj_genres') ? ['dj'] : [])],
  declined: [] as string[],
});

function mount(opts: { state: State; person: string[]; org?: string[]; genres?: string[] }) {
  const backend = { profile: PROFILE[opts.state] };
  let shell: { backend: FakeDancerBackend; location: () => string } | null = null;
  const personMissing = () => opts.person.filter((c) => !(c === 'instagram' && shell?.backend.current()?.instagram));
  const reads: PageReads = {
    page: vi.fn(async () => ({ name: 'Leeds Nights', city: 'Leeds', socials: { facebook: 'https://facebook.com/ln' }, instagram: 'leedsnights', website: 'https://ln.com', organisation_category: 'Promoter', avatar_url: 'https://img/l.png' })),
    phone: vi.fn(async () => '+447700900123'),
    status: vi.fn(async (id: string) => ({ v: 1, is_admin: false, person: { complete: false, missing: personMissing() }, organisers: [{ id, name: 'Leeds Nights', role: 'owner', lifecycle: 'draft', complete: false, missing: opts.org ?? [], about: { done: false, skipped: false } }] })),
    findPages: vi.fn(async () => []),
    cities: vi.fn(async () => []),
  };
  const writes: PageWrites = { run: vi.fn(async () => undefined), create: vi.fn(async () => 'o1'), claim: vi.fn(async () => undefined), ask: vi.fn(async () => undefined), rename: vi.fn(async () => undefined) };
  const noRow = async () => {
    throw new Error('no_profile');
  };
  const p = PROFILE[opts.state];
  const personReads: PersonReads & { dj?: () => Promise<Record<string, unknown>> } = {
    dancer: p ? async () => ({ profile_id: 'd1', first_name: p.first_name, avatar_url: p.avatar_url, dance_role: p.dance_role, nationality: 'GB', languages: ['English'] }) : noRow,
    intent: async () => intentFor(opts.person) as never,
    teacher: p ? async () => ({}) : noRow,
    dj: p ? async () => ({ genres: opts.genres ?? [] }) : noRow,
    organiser: async () => ({ id: 'o1', name: 'Leeds Nights', bio: '', category: 'Promoter', city: 'Leeds' }),
  };
  const sent: PersonCommand[] = [];
  const personWrites: PersonWrites = { run: vi.fn(async (cmd: PersonCommand) => void sent.push(cmd)), skipAbout: vi.fn(async () => undefined) };
  shell = renderInShell({
    path: '/account/p3/start?o=o1&at=review',
    backend,
    extraRoutes: (
      <Route
        path="/account/p3/start"
        element={<OnboardingFlow reads={reads} writes={writes} personReads={personReads} personWrites={personWrites} goLive={GO_LIVE_NOT_DEPLOYED} organiserDetail />}
      />
    ),
  });
  return { ...shell, sent, reads };
}

const shownStep = () => document.querySelector('[data-testid="p3-ob-shell"]')?.getAttribute('data-screen') ?? null;
const onReview = async (timeout = 1000) => waitFor(() => expect(shownStep()).toBe("review"), { timeout });
const tapRow = async (code: string) => {
  await onReview();
  if (!screen.queryByTestId(`p3-ob-review-${code}`)) fireEvent.click(screen.getByTestId('p3-ob-review-all'));
  fireEvent.click(await screen.findByTestId(`p3-ob-review-${code}`));
};

/** The control for each in-flow step (PersonFlow / OnboardingFlow test ids). */
const STEP_CONTROL: Record<string, string> = {
  name: 'p3-ob-name', photo: 'p3-ob-photo-file', role: 'p3-ob-role-Leader', nat: 'p3-ob-nat-chips', langs: 'p3-ob-langs',
  teach: 'p3-ob-teach-yes', styles: 'p3-ob-styles', years: 'p3-ob-years', levels: 'p3-ob-level-Beginner',
  dj: 'p3-ob-dj-yes', djgenres: 'p3-ob-djgenres',
  contact: 'p3-ob-continue', cat: 'p3-ob-continue', link: 'p3-ob-continue', logo: 'p3-ob-continue',
};
const STEP_OF: Record<string, string> = {
  first_name: 'name', dance_role: 'role', photo: 'photo', nationality: 'nat', languages: 'langs', teach_answer: 'teach',
  teach_styles: 'styles', teach_years: 'years', teach_levels: 'levels', dj_answer: 'dj', dj_genres: 'djgenres',
  org_logo: 'logo', org_link: 'link', org_category: 'cat', contact_confirm: 'contact',
};

type Expect = { screen?: string; testId?: string; selector?: string; path?: RegExp; na?: string };

/** Where the row must land, and what must be on screen there. */
function expected(code: string, state: State): Expect {
  if (code === 'city') {
    if (state === 'base-complete') return { na: 'a missing city IS base-incomplete (profile_complete_v1)' };
    // The real /finish-profile: an incomplete person goes on to /app/welcome at the city step; no_profile stays (contact).
    return state === 'no_profile' ? { path: /^\/finish-profile/, testId: 'today-finish-profile' } : { path: /^\/app\/welcome/, testId: 'onboarding-city' };
  }
  if (code === 'instagram') {
    return state === 'no_profile'
      ? { path: /^\/app\/me\/edit\?focus=instagram&returnTo=/, testId: 'load-error' }
      : { path: /^\/app\/me\/edit\?focus=instagram&returnTo=/, selector: '#instagram' };
  }
  if (code === 'org_city') return { path: /^\/account\/p3\/you\/page$/ };
  if (code === UNKNOWN) return { screen: 'elsewhere', testId: 'p3-ob-elsewhere-edit' };
  const step = STEP_OF[code];
  if (state === 'no_profile' && PERSON_CODES.has(code)) return { screen: 'person-nodancer', testId: 'p3-ob-nodancer-contact' };
  return { screen: step, testId: STEP_CONTROL[step] };
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  resetShell();
  document.body.innerHTML = '';
});

describe('every checklist row x person state -> destination -> the control for that code', () => {
  const codes = [...Object.keys(REVIEW_ROWS), UNKNOWN];
  const cells = codes.flatMap((code) => STATES.map((state) => ({ code, state })));
  it.each(cells)('$code / $state', async ({ code, state }) => {
    const want = expected(code, state);
    if (want.na) return;
    const isOrg = code.startsWith('org_') || code === 'contact_confirm';
    const { location } = mount({ state, person: isOrg ? [] : [code], org: isOrg ? [code] : [] });
    await tapRow(code);
    if (want.path) await waitFor(() => expect(location()).toMatch(want.path!), { timeout: 2000 });
    if (want.screen) await waitFor(() => expect(shownStep()).toBe(want.screen), { timeout: 2000 });
    if (want.testId) expect(await screen.findByTestId(want.testId, {}, { timeout: 2000 })).toBeTruthy();
    if (want.selector) await waitFor(() => expect(document.querySelector(want.selector!)).not.toBeNull(), { timeout: 2000 });
  });
});

describe('acceptance shapes', () => {
  it("Daniel's shape (teach_answer, dj_answer, contact_confirm): the DJ row opens the yes/no", async () => {
    mount({ state: 'base-complete', person: ['teach_answer', 'dj_answer'], org: ['contact_confirm'] });
    await tapRow('dj_answer');
    await waitFor(() => expect(shownStep()).toBe('dj'));
    expect(screen.getByTestId('p3-ob-title').textContent).toBe('Do you DJ?');
    expect(screen.getByTestId('p3-ob-dj-yes')).toBeTruthy();
    expect(screen.getByTestId('p3-ob-dj-no')).toBeTruthy();
  });

  it("Simon's shape (instagram, dj_genres): the DJ row opens Music you play directly, not the yes/no", async () => {
    mount({ state: 'base-complete', person: ['instagram', 'dj_genres'] });
    await tapRow('dj_genres');
    await waitFor(() => expect(shownStep()).toBe('djgenres'));
    expect(screen.getByTestId('p3-ob-title').textContent).toBe('Music you play');
    expect(screen.queryByTestId('p3-ob-dj-yes')).toBeNull();
  });

  it("Simon's shape: Instagram row -> /app edit -> save -> back on Review with the row gone, no reload", async () => {
    const { location, backend } = mount({ state: 'base-complete', person: ['instagram', 'dj_genres'] });
    await tapRow('instagram');
    await waitFor(() => expect(location()).toMatch(/^\/app\/me\/edit\?focus=instagram&returnTo=/));
    const input = await waitFor(() => {
      const el = document.querySelector<HTMLInputElement>('#instagram');
      expect(el).not.toBeNull();
      return el!;
    });
    fireEvent.change(input, { target: { value: 'simon.dances' } });
    fireEvent.click(screen.getByTestId('edit-save'));
    await waitFor(() => expect(location()).toBe('/account/p3/start?o=o1&at=review'), { timeout: 3000 });
    expect(backend.current()?.instagram).toBe('simon.dances');
    await onReview(5000);
    await waitFor(() => expect(screen.queryByTestId('p3-ob-review-instagram')).toBeNull());
    expect(screen.getByTestId('p3-ob-review-dj_genres')).toBeTruthy();
  });
});

describe('the DJ steps from Review: one command per answer, back to Review, never a disabled Continue without a reason', () => {
  const cont = () => screen.getByTestId('p3-ob-continue');
  const why = () => screen.getByTestId('p3-ob-why').textContent;

  it('Yes -> Music you play -> saved -> Review; one command each', async () => {
    const { sent } = mount({ state: 'base-complete', person: ['dj_answer'] });
    await tapRow('dj_answer');
    await waitFor(() => expect(shownStep()).toBe('dj'));
    expect(cont().getAttribute('aria-disabled')).toBe('true');
    expect(why()).toBe('Answer to continue.');
    fireEvent.click(screen.getByTestId('p3-ob-dj-yes'));
    fireEvent.click(cont());
    await waitFor(() => expect(shownStep()).toBe('djgenres'));
    expect(screen.getByText('For example Bachata, Kizomba or Salsa.')).toBeTruthy();
    expect(why()).toBe('Type at least one to continue.');
    fireEvent.change(screen.getByTestId('p3-ob-djgenres'), { target: { value: 'Bachata, Kizomba, , Bachata' } });
    fireEvent.click(cont());
    await onReview();
    expect(sent).toEqual([{ kind: 'dj', yes: true }, { kind: 'djrole', patch: { genres: ['Bachata', 'Kizomba'] } }]);
  });

  it('No -> Review at once (genres skipped), one command', async () => {
    const { sent } = mount({ state: 'base-complete', person: ['dj_answer'] });
    await tapRow('dj_answer');
    await waitFor(() => expect(shownStep()).toBe('dj'));
    fireEvent.click(screen.getByTestId('p3-ob-dj-no'));
    fireEvent.click(cont());
    await onReview();
    expect(sent).toEqual([{ kind: 'dj', yes: false }]);
  });

  it('Back from the first DJ step goes to Review and sends nothing', async () => {
    const { sent } = mount({ state: 'base-complete', person: ['dj_genres'] });
    await tapRow('dj_genres');
    await waitFor(() => expect(shownStep()).toBe('djgenres'));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await onReview();
    expect(sent).toEqual([]);
  });

  it('genres already held: an untouched Continue sends nothing and returns to Review', async () => {
    const { sent } = mount({ state: 'base-complete', person: ['dj_genres'], genres: ['Salsa'] });
    await tapRow('dj_genres');
    await waitFor(() => expect((screen.getByTestId('p3-ob-djgenres') as HTMLInputElement).value).toBe('Salsa'));
    fireEvent.click(cont());
    await onReview();
    expect(sent).toEqual([]);
  });

  it.each([
    ['', 'Type at least one to continue.'],
    [' , ,', 'Type at least one to continue.'],
    [Array.from({ length: 21 }, (_, i) => `G${i}`).join(', '), 'Up to 20, separated by commas.'],
    ['x'.repeat(81), 'Keep each one to 80 characters or fewer.'],
    [Array.from({ length: 20 }, (_, i) => `G${i}`).join(', '), null],
    ['x'.repeat(80), null],
  ])('genres %j -> reason %j (save_my_role_v1 list limits)', (raw, reason) => {
    expect(genresReason(raw)).toBe(reason);
  });
});

describe('new people: the DJ steps are NOT on the main path', () => {
  it.each([['yes'], ['no'], [null]] as const)('personPath(%s) has no DJ step; the bar is unchanged', (teach) => {
    for (const org of [true, false]) {
      const path = personPath(teach, org);
      expect(path.some((s) => DJ_ORDER.includes(s))).toBe(false);
      expect(path.every((s) => PERSON_ORDER.includes(s))).toBe(true);
    }
  });
  it('the DJ answer is read from the intent; an untouched answer sends nothing', () => {
    const held = heldFrom({ dancer: {}, intent: { roles: ['dj'], declined: [] }, teacher: {}, bio: null, dj: { genres: ['Bachata'] } });
    expect(held.dj).toBe('yes');
    expect(held.genres).toBe('Bachata');
    expect(commandFor('dj', held, held)).toBeNull();
    expect(commandFor('djgenres', held, held)).toBeNull();
    expect(heldFrom({ dancer: {}, intent: { roles: [], declined: ['dj'] }, teacher: {}, bio: null }).dj).toBe('no');
  });
});

describe('the /app editor link and its returnTo (sanitizeReturnTo)', () => {
  it.each([
    ['/account/p3/start?o=o1&at=review', '/app/me/edit?focus=instagram&returnTo=%2Faccount%2Fp3%2Fstart%3Fo%3Do1%26at%3Dreview'],
    ['//evil.example/x', '/app/me/edit?focus=instagram'],
    ['https://evil.example', '/app/me/edit?focus=instagram'],
    ['/auth?mode=signin', '/app/me/edit?focus=instagram'],
    [null, '/app/me/edit?focus=instagram'],
  ])('returnTo %j -> %s', (back, href) => {
    expect(appEditHref('instagram', back)).toBe(href);
  });

  it('an off-site returnTo typed into the URL is ignored: Save stays on the editor', async () => {
    const { location, backend } = renderInShell({ path: '/app/me/edit?focus=instagram&returnTo=%2F%2Fevil.example', backend: { profile: PROFILE['base-complete'] } });
    const input = await waitFor(() => {
      const el = document.querySelector<HTMLInputElement>('#instagram');
      expect(el).not.toBeNull();
      return el!;
    });
    fireEvent.change(input, { target: { value: 'sam.dances' } });
    fireEvent.click(screen.getByTestId('edit-save'));
    await waitFor(() => expect(backend.current()?.instagram).toBe('sam.dances'));
    expect(location()).toBe('/app/me/edit?focus=instagram&returnTo=%2F%2Fevil.example');
  });

  it('no returnTo: Save stays on the editor (the screen is otherwise unchanged)', async () => {
    const { location, backend } = renderInShell({ path: '/app/me/edit', backend: { profile: PROFILE['base-complete'] } });
    const input = await waitFor(() => {
      const el = document.querySelector<HTMLInputElement>('#instagram');
      expect(el).not.toBeNull();
      return el!;
    });
    fireEvent.change(input, { target: { value: 'sam.dances' } });
    fireEvent.click(screen.getByTestId('edit-save'));
    await waitFor(() => expect(backend.current()?.instagram).toBe('sam.dances'));
    expect(location()).toBe('/app/me/edit');
  });
});
