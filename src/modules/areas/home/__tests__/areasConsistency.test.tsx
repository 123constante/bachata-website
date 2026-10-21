// @vitest-environment jsdom
/**
 * B-WEB3 consistency matrix: for each role x every shape the server can return,
 * the Your areas row, the Switch profile entry, and Home's / the wizard's "N
 * left" line read the SAME status words (areaStatus, one mapping, the one
 * requiredLeftText wording), and no area link points at a route the catchall
 * does not register. The server answers are fakes at the RPC boundary,
 * prod-shaped (my_roles_v1 rows, my_profile_progress_v1 steps). Reachable
 * shapes only (D100): teacher / DJ have no required answers (the server calls a
 * held one complete), so "held, N left" is a dancer / organiser shape, and
 * "chosen at sign-up, nothing saved" (intent only, B1) is a teacher / DJ one.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc, from: vi.fn() } }));

import { CATCHALL_CLIENT_PATHS } from '@/components/catchallClientPaths';
import { AREA_PATHS } from '@/lib/areaPaths';
import YourAreasPage from '../YourAreasPage';
import { SwitcherAreas } from '../SwitcherAreas';
import { parseProfileProgress, requiredLeftText } from '@/modules/organiser/shared/profileProgress';
import { ProgressBar } from '@/modules/organiser/wizard/LevelTrack';
import { profileTodoSub } from '@/modules/organiser/home/ProfileButton';
import {
  AREA_HREF, COMPLETE_WORDS, DECLINED_WORDS, NOT_HELD_WORDS, UNFINISHED_WORDS, areaAction, areaStatus, isAreaShown, toFinishWords,
} from '../areaStatus';
import { AREA_ROLES, answerDoYou, parseMyRoles, parseRoleIntent, type AreaRole, type RoleWriters } from '../rolesApi';

type Case = 'complete' | 'n-left' | 'intent-only' | 'not-held' | 'declined';
const isTeacherOrDj = (role: AreaRole) => role === 'teacher' || role === 'dj';
/** The shapes my_roles_v1 + my_profile_progress_v1 can return for each role (D100). */
const casesFor = (role: AreaRole): Case[] =>
  isTeacherOrDj(role) ? ['complete', 'intent-only', 'not-held', 'declined'] : ['complete', 'n-left', 'not-held'];

/** The teacher wizard's seven steps (profile_requirements_v1: none required). */
const SEVEN = ['years_teaching', 'teaching_styles', 'offers_private', 'private_lesson_types', 'private_lesson_locations', 'private_travel_distance', 'partner_role'];

/** Server answers for one role in one case; every other role is held and complete. */
function serverFor(role: AreaRole, c: Case) {
  const rows = AREA_ROLES.map((r) => ({ role: r, active: true, complete: true }));
  const me = rows.find((r) => r.role === role)!;
  if (c === 'n-left') me.complete = false;
  if (c === 'intent-only' || c === 'not-held' || c === 'declined') { me.active = false; me.complete = false; }
  const steps = c === 'n-left'
    ? [
      { area: role, field: 'a', required: true, done: false },
      { area: role, field: 'b', required: true, done: false },
      { area: role, field: 'c', required: false, done: true },
    ]
    : c === 'intent-only' ? SEVEN.map((field) => ({ area: role, field, required: false, done: false })) : [];
  // The server's required_left counts open required answers: the same steps the row counts.
  const requiredLeft = steps.filter((s) => s.required && !s.done).length;
  const declined = c === 'declined' ? [role] : [];
  return { rows, progress: { percent: 50, required_left: requiredLeft, publish_ready: requiredLeft === 0, steps, declined } };
}

const EXPECTED: Record<Case, string> = {
  complete: COMPLETE_WORDS,
  'n-left': requiredLeftText(2),
  'intent-only': requiredLeftText(SEVEN.length),
  'not-held': NOT_HELD_WORDS,
  declined: DECLINED_WORDS,
};

const matchesPattern = (href: string, pattern: string): boolean => {
  const path = href.split('?')[0];
  if (pattern.endsWith('/*')) return path === pattern.slice(0, -2) || path.startsWith(`${pattern.slice(0, -1)}`);
  const re = new RegExp(`^${pattern.replace(/\/:[A-Za-z]+\?/g, '(?:/[^/]+)?').replace(/:[A-Za-z]+/g, '[^/]+')}$`);
  return re.test(path);
};
const registered = (href: string) => CATCHALL_CLIENT_PATHS.some((p) => matchesPattern(href, p));

function serve(server: ReturnType<typeof serverFor>) {
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'my_roles_v1') return { data: server.rows, error: null };
    if (fn === 'my_profile_progress_v1') return { data: server.progress, error: null };
    return { data: null, error: { message: `unexpected ${fn}` } };
  });
}

function mount(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><MemoryRouter>{node}</MemoryRouter></QueryClientProvider>);
}

beforeEach(() => rpc.mockReset());
afterEach(cleanup);

describe('one status mapping: Your areas row == Switch profile entry', () => {
  const table = AREA_ROLES.flatMap((role) => casesFor(role).map((c) => [role, c] as const));
  it.each(table)('%s, %s', async (role, c) => {
    const server = serverFor(role, c);
    const want = EXPECTED[c];
    // The pure mapping says it first.
    expect(areaStatus(role, parseMyRoles(server.rows).find((r) => r.role === role), { steps: server.progress.steps, declined: server.progress.declined as never }).words).toBe(want);

    serve(server);
    mount(<YourAreasPage />);
    await waitFor(() => expect(screen.getByTestId(`area-status-${role}`).textContent).toBe(want));
    const row = screen.getByTestId(`area-row-${role}`);
    // One action per row, and a link goes to a registered route.
    const links = within(row).queryAllByRole('link');
    const buttons = within(row).queryAllByRole('button');
    expect(links.length + buttons.length).toBe(1);
    for (const a of links) expect(registered(a.getAttribute('href')!), a.getAttribute('href')!).toBe(true);
    cleanup();

    serve(server);
    mount(<SwitcherAreas rowClass="" mutedClass="" onPick={() => undefined} />);
    await screen.findByTestId('profile-switcher-your-areas');
    if (isTeacherOrDj(role)) {
      if (c === 'complete' || c === 'intent-only') {
        await waitFor(() => expect(screen.getByTestId(`profile-switcher-area-status-${role}`).textContent).toBe(want));
        expect(screen.getByTestId(`profile-switcher-area-${role}`).getAttribute('href')).toBe(AREA_HREF[role]);
      } else {
        // The sheet lists only areas the person holds; adding one is on Your areas.
        await waitFor(() => expect(rpc.mock.calls.some(([fn]) => fn === 'my_roles_v1')).toBe(true));
        expect(screen.queryByTestId(`profile-switcher-area-${role}`)).toBeNull();
      }
    }
    cleanup();

    // Home / wizard column (S1): the "N left" line they render from the SAME progress answer. Only required answers
    // reach it (teacher / DJ have none), so it carries a number exactly when a dancer / organiser row does.
    const progress = parseProfileProgress(server.progress);
    render(<ProgressBar percent={progress.percent} requiredLeft={progress.requiredLeft} />);
    const line = screen.queryByTestId('wizard-required-left')?.textContent ?? null;
    if (c === 'n-left') {
      expect(line).toBe(want);
      expect(profileTodoSub(progress.requiredLeft).startsWith(want)).toBe(true);
    } else {
      expect(line).toBeNull();
    }
  });

  it('the open-answers count has ONE wording: Your areas uses requiredLeftText itself', () => {
    expect(toFinishWords).toBe(requiredLeftText);
  });

  it('isAreaShown is the one "listed" rule: held, or a teacher / DJ the wizard still lists steps for', () => {
    for (const role of AREA_ROLES) {
      for (const c of casesFor(role)) {
        const s = serverFor(role, c);
        const row = parseMyRoles(s.rows).find((r) => r.role === role);
        const shown = isAreaShown(role, row, parseProfileProgress(s.progress));
        expect(shown, `${role} ${c}`).toBe(c === 'complete' || c === 'n-left' || c === 'intent-only');
      }
    }
  });

  it('every area link and action is a registered route', () => {
    for (const p of Object.values(AREA_PATHS)) expect(registered(p), p).toBe(true);
    for (const p of [`${AREA_PATHS.teacher}/details`, `${AREA_PATHS.dj}/details`]) expect(registered(p), p).toBe(true);
    for (const role of AREA_ROLES) {
      expect(registered(AREA_HREF[role]), AREA_HREF[role]).toBe(true);
      for (const kind of ['complete', 'to-finish', 'not-held', 'declined'] as const) {
        const a = areaAction(role, { kind, words: '' });
        if (a.kind !== 'ask') expect(registered(a.to), a.to).toBe(true);
      }
    }
  });

  it('held, not complete, progress unknown: the plain unfinished words, never "0 answers left"', () => {
    expect(areaStatus('teacher', { role: 'teacher', active: true, complete: false }, undefined).words).toBe(UNFINISHED_WORDS);
  });
});

describe('boundary parsers refuse an unexpected shape', () => {
  it.each([[{}], ['x'], [[{ role: 'teacher' }]], [[{ role: 'teacher', active: 'yes', complete: true }]]])('my_roles_v1 %j', (raw) => {
    expect(() => parseMyRoles(raw)).toThrow();
  });
  it('a role the server adds later is left out, never shown as a code', () => {
    expect(parseMyRoles([{ role: 'videographer', active: true, complete: true }])).toEqual([]);
  });
  it('my_role_intent_v1: nulls read as empty; a wrong type throws', () => {
    expect(parseRoleIntent({ roles: null, declined: null })).toEqual({ roles: [], declined: [] });
    expect(() => parseRoleIntent({ roles: 'teacher', declined: [] })).toThrow();
  });
});

describe('Add: the wizard\'s "Do you...?" step, diff-first through the B-DB1 writers', () => {
  const writers = (intent: { roles: string[]; declined: string[] }) => ({
    fetchIntent: vi.fn(async () => intent),
    setIntent: vi.fn(async () => undefined),
    setDeclined: vi.fn(async () => ({})),
  });
  it.each([
    ['Yes, nothing stored', { roles: [], declined: [] }, true, { intent: [[['teacher']]], declined: [] }],
    ['Yes, had said No', { roles: ['teacher'], declined: ['teacher'] }, true, { intent: [], declined: [['teacher', false]] }],
    ['Yes, already in the intent', { roles: ['dancer', 'teacher'], declined: [] }, true, { intent: [], declined: [] }],
    ['No, nothing stored', { roles: [], declined: [] }, false, { intent: [], declined: [['teacher', true]] }],
    ['No, already No', { roles: [], declined: ['teacher'] }, false, { intent: [], declined: [] }],
  ] as const)('%s', async (_n, intent, yes, want) => {
    const w = writers({ roles: [...intent.roles], declined: [...intent.declined] });
    await answerDoYou('teacher', yes, w as unknown as RoleWriters);
    expect(w.setIntent.mock.calls).toEqual(want.intent);
    expect(w.setDeclined.mock.calls).toEqual(want.declined);
  });

  it('on the screen: Add opens the step, No is stored, and the row stays with its Add', async () => {
    const server = serverFor('dj', 'not-held');
    serve(server);
    const w = writers({ roles: [], declined: [] });
    mount(<YourAreasPage writers={w as unknown as RoleWriters} />);
    const row = await screen.findByTestId('area-row-dj');
    fireEvent.click(within(row).getByRole('button', { name: 'Add' }));
    const panel = await screen.findByTestId('do-you-dj');
    expect(within(panel).getByText('Do you DJ?')).toBeTruthy();
    fireEvent.click(within(panel).getByRole('button', { name: 'No' }));
    await waitFor(() => expect(w.setDeclined).toHaveBeenCalledWith('dj', true));
    await waitFor(() => expect(screen.queryByTestId('do-you-dj')).toBeNull());
    expect(w.setIntent).not.toHaveBeenCalled();
  });
});

describe('states', () => {
  it('my_roles_v1 not on the database yet: the normal error state with a retry, no crash', async () => {
    rpc.mockImplementation(async () => ({ data: null, error: { message: 'Could not find the function public.my_roles_v1' } }));
    mount(<YourAreasPage />);
    expect(await screen.findByTestId('areas-error')).toBeTruthy();
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
  });
  it('no dancer profile: the one blocked state with its one action', async () => {
    rpc.mockImplementation(async () => ({ data: null, error: { message: 'no_profile' } }));
    mount(<YourAreasPage />);
    expect((await screen.findByTestId('blocked-action')).getAttribute('href')).toBe('/finish-profile');
  });
  it('progress fails but roles load: rows still show, a held unfinished area reads the plain words', async () => {
    const server = serverFor('dancer', 'n-left');
    rpc.mockImplementation(async (fn: string) => (fn === 'my_roles_v1' ? { data: server.rows, error: null } : { data: null, error: { message: 'boom' } }));
    mount(<YourAreasPage />);
    await waitFor(() => expect(screen.getByTestId('area-status-dancer').textContent).toBe(UNFINISHED_WORDS));
  });
});
