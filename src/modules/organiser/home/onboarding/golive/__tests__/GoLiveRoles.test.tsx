// @vitest-environment jsdom
/**
 * Invite W2: "Do you also DJ or teach?" between the quick questions and All set. Counted as one more
 * quick question; asked only for roles neither claimed nor declined; Continue off with its reason on
 * screen until answered; a Yes opens the minimum inline; the answers go through the role writers.
 * Harness copied from GoLiveFlow.test.tsx (same fakes at the RPC boundary).
 */
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const rpc = vi.hoisted(() => vi.fn());
const send = vi.hoisted(() => vi.fn());
const wsState = vi.hoisted(() => ({ value: null as unknown, refetch: vi.fn() }));
const entityState = vi.hoisted(() => ({ city: 'c1' as string | null, delay: 0, hang: false }));
const flowErr = vi.hoisted(() => ({ refusal: undefined as undefined | ((e: unknown) => string | null) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc, from: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'me@x.example' }, session: null }) }));
vi.mock('@/modules/profile/organiserPublicProfile', async (orig) => ({
  ...(await orig<object>()),
  fetchOwnOrganiserEntity: async (id: string) => {
    if (entityState.hang) return new Promise(() => {});
    const city = entityState.city;
    if (entityState.delay) await new Promise((r) => setTimeout(r, entityState.delay));
    return { id, name: 'Ritmo', city_id: city, avatar_url: null, bio: null, instagram: null, website: null, socials: {}, organisation_category: null, founded_year: null };
  },
}));
vi.mock('@/modules/organiser/shared/ownershipApi', async (orig) => ({
  ...(await orig<object>()),
  fetchContactSettings: async () => ({ contact_email: null, contact_phone: null, show_phone_publicly: true, show_email_publicly: false, claim_email: null }),
}));
vi.mock('@/modules/organiser/flows/add/useFlow', () => ({
  useSeriesWorkspace: () => (wsState.value ?? { data: { series: { id: 's1', name: 'Friday Social', version: 3 } }, isError: false, refetch: wsState.refetch }),
  useFlowSend: (_id: string, refusal?: (e: unknown) => string | null) => ({ send: async (...a: unknown[]) => { try { return await send(...a); } catch (e) { refusal?.(e); return null; } }, run: async (w: () => Promise<void>) => w(), busy: false, conflict: false, error: null }),
}));

import type { ProgressStep } from '@/modules/organiser/shared/profileProgress';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import type { WizardWriters } from '../../../../wizard/wizardApi';
import { GoLiveFlowScreen } from '../GoLiveFlow';
import type { Role } from '@/modules/areas/shared/fieldRegistry';
import Done from '@/modules/organiser/flows/Done';
import { DEFAULT_AREA_PATHS } from '@/modules/areas/shared/paths';
import { ROLE_MINIMUM_REASON, ROLE_QUESTION_REASON_BOTH, ROLE_QUESTION_TITLE, ROLE_SAVE_FAILED, type RoleQuestionWriters } from '../roleQuestion';

type Step = [ProgressStep['area'], string, boolean];
const open = (rows: Step[]) => rows.map(([area, field, done]) => ({ area, field, required: true, done }));
const TEN: Step[] = [
  ['dancer', 'nationality', false], ['dancer', 'languages', false], ['dancer', 'instagram', false], ['dancer', 'phone_or_whatsapp', false], ['dancer', 'dance_started_year', false],
  ['organiser', 'logo', false], ['organiser', 'category', false], ['organiser', 'founded_year', false], ['organiser', 'instagram', false], ['organiser', 'contact_phone', false],
];

let dancerRow: Record<string, unknown>;
let steps: ReturnType<typeof open>;
let saveDancer: ReturnType<typeof vi.fn>;
let saveOrganiser: ReturnType<typeof vi.fn>;
let intent: { roles: string[]; declined: string[] } | 'error';
let roleWriters: { [K in keyof RoleQuestionWriters]: Mock<Parameters<RoleQuestionWriters[K]>, ReturnType<RoleQuestionWriters[K]>> };

function Where() {
  const l = useLocation();
  return <span data-testid="where">{l.pathname}</span>;
}

function mount(entry = `${ORG_PATHS.goLive}?series=s1&o=org-1`) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const writers = { saveDancer, saveOrganiser } as unknown as WizardWriters;
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path={ORG_PATHS.goLive} element={<GoLiveFlowScreen writers={writers} roleWriters={roleWriters} uploadLogo={async () => 'https://img.example/logo.jpg'} />} />
          <Route path={ORG_PATHS.done} element={<Done />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const question = () => screen.getByTestId('golive-question').textContent;
const onQuestion = (q: string) => waitFor(() => expect(question()).toBe(q));

beforeEach(() => {
  dancerRow = { profile_id: 'p1', user_id: 'u1', first_name: 'Ana', based_city_id: 'c1', dance_role: 'Follower', avatar_url: 'x', nationality: null, languages: [], instagram: null, whatsapp: null, dance_started_year: null, other_roles: ['organiser'] };
  steps = open([['organiser', 'category', false]]);
  intent = { roles: ['dancer', 'organiser'], declined: [] };
  roleWriters = { answerDoYou: vi.fn(async (_r: Role, _y: boolean) => 1), fetchDetails: vi.fn(async (_r: Role) => ({})), saveMyRole: vi.fn(async (_r: Role, _p: Record<string, unknown>) => ({}) as unknown) };
  entityState.city = 'c1';
  entityState.delay = 0;
  entityState.hang = false;
  saveDancer = vi.fn(async (delta: Record<string, unknown>) => ({ ...dancerRow, ...delta }));
  saveOrganiser = vi.fn(async () => ({ kind: 'saved', stored: null, row: null, unmatched: [] }));
  wsState.value = null;
  wsState.refetch.mockReset();
  send.mockReset();
  send.mockResolvedValue({ ok: true });
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'organiser_home_v1') return { data: { today: '2026-10-21', organisers: [{ id: 'org-1', name: 'Ritmo', slug: 'ritmo', avatar_url: null, city_id: 'c1', lifecycle_status: 'live', role: 'owner', latest_decision: null, series: [], team: [] }] }, error: null };
    if (fn === 'my_profile_progress_v1') return { data: { percent: 40, required_left: steps.length, publish_ready: false, declined: [], steps }, error: null };
    if (fn === 'my_dancer_edit_v1') return { data: dancerRow, error: null };
    if (fn === 'my_role_intent_v1') return intent === 'error' ? { data: null, error: { message: 'boom' } } : { data: intent, error: null };
    if (fn === 'series_go_live_check_v1') return { data: { ready: true, event_missing: [], recommended: [], profile_rule_applies: true, profile_missing: [] }, error: null };
    return { data: null, error: { message: `unexpected ${fn}` } };
  });
});
afterEach(cleanup);

const toRoles = async () => {
  fireEvent.click(await screen.findByTestId('golive-continue'));
  await onQuestion('What kind of organisation is it?');
  fireEvent.click(screen.getAllByTestId('step-choice')[0]);
  await onQuestion(ROLE_QUESTION_TITLE);
};

describe('the roles question', () => {
  it('counts as one more quick question, in About your page, after the page questions', async () => {
    mount();
    expect((await screen.findByTestId('golive-line')).textContent).toBe('Friday Social is saved. 2 quick questions and you can publish it.');
    expect(screen.getAllByTestId('golive-dot')).toHaveLength(2);
    await toRoles();
    expect(screen.getByTestId('golive-section').textContent).toBe('About your pageStep 2 of 2');
  });

  it('Continue is off with its reason on screen until both are answered; a Yes opens the minimum', async () => {
    mount();
    await toRoles();
    const cont = screen.getByTestId('golive-roles-continue') as HTMLButtonElement;
    expect(cont.disabled).toBe(true);
    expect(screen.getByTestId('golive-roles-reason').textContent).toBe(ROLE_QUESTION_REASON_BOTH);
    expect(cont.getAttribute('aria-describedby')).toBe(screen.getByTestId('golive-roles-reason').id);
    fireEvent.click(screen.getByTestId('golive-role-teacher-no'));
    fireEvent.click(screen.getByTestId('golive-role-dj-yes'));
    expect(screen.getByTestId('golive-roles-reason').textContent).toBe(ROLE_MINIMUM_REASON);
    fireEvent.change(screen.getByTestId('golive-role-dj-dj_name'), { target: { value: 'DJ Ana' } });
    fireEvent.change(screen.getByTestId('golive-role-dj-genres'), { target: { value: 'Bachata, Kizomba' } });
    expect(screen.queryByTestId('golive-roles-reason')).toBeNull();
    fireEvent.click(cont);
    await waitFor(() => expect(screen.getByTestId('golive-title').textContent).not.toBe('Almost live'));
    expect(roleWriters.answerDoYou.mock.calls).toEqual([['teacher', false], ['dj', true]]);
    expect(roleWriters.saveMyRole.mock.calls).toEqual([['dj', { dj_name: 'DJ Ana', genres: ['Bachata', 'Kizomba'] }]]);
  });

  it('a failed save keeps the answers and says so; Back returns to the last question', async () => {
    roleWriters.answerDoYou.mockRejectedValueOnce(new Error('network'));
    mount();
    await toRoles();
    fireEvent.click(screen.getByTestId('golive-role-teacher-no'));
    fireEvent.click(screen.getByTestId('golive-role-dj-no'));
    fireEvent.click(screen.getByTestId('golive-roles-continue'));
    expect((await screen.findByTestId('golive-roles-error')).textContent).toBe(ROLE_SAVE_FAILED);
    expect(screen.getByTestId('golive-role-dj-no').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByTestId('golive-back'));
    await onQuestion('What kind of organisation is it?');
  });

  it.each([
    ['both claimed', { roles: ['teacher', 'dj'], declined: [] }],
    ['both declined', { roles: [], declined: ['teacher', 'dj'] }],
    ['the intent did not load', 'error' as const],
  ])('%s: not asked, 1 quick question', async (_l, i) => {
    intent = i;
    mount();
    expect((await screen.findByTestId('golive-line')).textContent).toBe('Friday Social is saved. 1 quick question and you can publish it.');
    fireEvent.click(screen.getByTestId('golive-continue'));
    await onQuestion('What kind of organisation is it?');
    fireEvent.click(screen.getAllByTestId('step-choice')[0]);
    await waitFor(() => expect(screen.queryByTestId('golive-question')).toBeNull());
    expect(screen.queryByTestId('golive-roles')).toBeNull();
    expect(roleWriters.answerDoYou).not.toHaveBeenCalled();
  });

  it('only DJ left to ask: one question, "Answer the question to continue."', async () => {
    intent = { roles: ['teacher'], declined: [] };
    mount();
    await toRoles();
    expect(screen.queryByTestId('golive-role-teacher')).toBeNull();
    expect(screen.getByTestId('golive-roles-reason').textContent).toBe('Answer the question to continue.');
  });

  it('no event: never asked', async () => {
    intent = { roles: [], declined: [] };
    mount(`${ORG_PATHS.goLive}?o=org-1`);
    await onQuestion('What kind of organisation is it?');
    fireEvent.click(screen.getAllByTestId('step-choice')[0]);
    await waitFor(() => expect(screen.queryByTestId('golive-question')).toBeNull());
    expect(screen.queryByTestId('golive-roles')).toBeNull();
  });
});

/** Go live once the button is on (the check is re-read after a role answer). */
const goLive = async () => {
  await waitFor(() => expect((screen.getByTestId('golive-live') as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByTestId('golive-live'));
};

describe("It's live", () => {
  it('after a Yes to DJ: title, "<event> is live." and ONE offer into the DJ editor; Maybe later hides it', async () => {
    mount();
    await toRoles();
    fireEvent.click(screen.getByTestId('golive-role-teacher-no'));
    fireEvent.click(screen.getByTestId('golive-role-dj-yes'));
    fireEvent.change(screen.getByTestId('golive-role-dj-dj_name'), { target: { value: 'DJ Ana' } });
    fireEvent.change(screen.getByTestId('golive-role-dj-genres'), { target: { value: 'Bachata' } });
    fireEvent.click(screen.getByTestId('golive-roles-continue'));
    await goLive();
    expect((await screen.findByTestId('org-done-message')).textContent).toBe('Friday Social is live.');
    expect(screen.queryByTestId('org-done-offer-teacher')).toBeNull();
    expect(screen.getByTestId('org-done-offer-dj').textContent).toContain('Make your DJ page stand out');
    expect(screen.getByTestId('org-done-offer-dj-open').getAttribute('href')).toBe(DEFAULT_AREA_PATHS.dj.profile);
    fireEvent.click(screen.getByTestId('org-done-offer-dj-later'));
    expect(screen.queryByTestId('org-done-offer')).toBeNull();
  });

  it('no role claimed and both No: no offer at all', async () => {
    intent = { roles: [], declined: [] };
    mount();
    await toRoles();
    fireEvent.click(screen.getByTestId('golive-role-teacher-no'));
    fireEvent.click(screen.getByTestId('golive-role-dj-no'));
    fireEvent.click(screen.getByTestId('golive-roles-continue'));
    await goLive();
    expect((await screen.findByTestId('org-done-message')).textContent).toBe('Friday Social is live.');
    expect(screen.queryByTestId('org-done-offer')).toBeNull();
  });

  it('a teacher already: offered without being asked', async () => {
    intent = { roles: ['teacher'], declined: ['dj'] };
    steps = [];
    mount();
    await goLive();
    expect((await screen.findByTestId('org-done-offer-teacher-open')).getAttribute('href')).toBe(DEFAULT_AREA_PATHS.teacher.profile);
    expect(screen.queryByTestId('org-done-offer-dj')).toBeNull();
  });
});
