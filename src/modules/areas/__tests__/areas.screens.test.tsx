// @vitest-environment jsdom
/** B-WEB1 screens: dashboard states, diff-first save, refusal copy, wizard routing, 44px targets (both roles). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';

const h = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => h.rpc(...a) } }));

import TeacherAreaPage from '../teacher/TeacherAreaPage';
import TeacherProfilePage from '../teacher/TeacherProfilePage';
import DjAreaPage from '../dj/DjAreaPage';
import DjProfilePage from '../dj/DjProfilePage';
import { doYouTeachStep, teacherWizardSteps } from '../teacher/wizardSteps';
import { doYouDjStep } from '../dj/wizardSteps';
import { submitRoleWizardStep } from '../shared/roleWizard';
import { ROLE_ERROR_COPY } from '../shared/errorCopy';
import { LINEUP_EMPTY_BODY } from '../shared/LineupList';
import { NOTHING_CHANGED } from '../shared/RoleProfilePage';
import type { Role } from '../shared/fieldRegistry';

const DETAILS: Record<Role, Record<string, unknown>> = {
  teacher: { years_teaching: 6, teaching_styles: ['Sensual'], offers_private: null, private_lesson_types: [], private_lesson_locations: [], private_travel_distance: null, partner_role: null },
  dj: { dj_name: 'DJ Luna', genres: [], soundcloud: null, mixcloud: null, pricing: null },
};
const LINEUP = [
  { series_id: 's2', event_name: 'Later Night', slug: 'later-night', date: '2026-12-05', session_title: 'Beginners class' },
  { series_id: 's1', event_name: 'Sooner Social', slug: null, date: '2026-10-30', session_title: null },
];
type Answer = { data: unknown; error: { message: string } | null } | 'hang';
let answers: Record<string, Answer>;
const ok = (data: unknown): Answer => ({ data, error: null });
const fail = (message: string): Answer => ({ data: null, error: { message } });

beforeEach(() => {
  answers = {};
  h.rpc.mockReset().mockImplementation((fn: string, args: { p_role: Role }) => {
    const a = answers[fn];
    if (a === 'hang') return new Promise(() => {});
    if (a) return Promise.resolve(a);
    if (fn === 'my_role_details_v1') return Promise.resolve(ok({ role: args.p_role, person_id: 'p1', details: DETAILS[args.p_role] }));
    if (fn === 'my_lineup_appearances_v1') return Promise.resolve(ok([]));
    return Promise.resolve(fail(`Could not find the function public.${fn}`));
  });
});
afterEach(cleanup);

function mount(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);
}
const calls = (fn: string) => h.rpc.mock.calls.filter((c) => c[0] === fn);

const AREAS: [Role, () => ReactElement, string][] = [
  ['teacher', () => <TeacherAreaPage />, '2 of 7 details added'],
  ['dj', () => <DjAreaPage />, '1 of 5 details added'],
];
const PROFILES: [Role, () => ReactElement, string, string][] = [
  ['teacher', () => <TeacherProfilePage />, 'Role you dance when teaching (optional)', 'partner_role'],
  ['dj', () => <DjProfilePage />, 'Pricing (optional)', 'pricing'],
];

describe.each(AREAS)('%s dashboard', (role, Page, line) => {
  it('loading: shimmer rows for details and line-up', () => {
    answers.my_role_details_v1 = 'hang';
    answers.my_lineup_appearances_v1 = 'hang';
    mount(<Page />);
    expect(screen.getAllByRole('status').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByTestId('edit-details')).toBeNull();
  });
  it('filled details + empty line-up: completeness, Edit details, empty state says what happens', async () => {
    mount(<Page />);
    expect((await screen.findByTestId('completeness-line')).textContent).toContain(line);
    expect((screen.getByRole('progressbar')).getAttribute('aria-valuetext')).toBe(line);
    expect((screen.getByTestId('edit-details')).textContent).toContain('Edit details');
    expect((await screen.findByTestId('lineup-empty')).textContent).toContain(LINEUP_EMPTY_BODY);
  });
  it('line-up rows render in server order and link to the event page', async () => {
    answers.my_lineup_appearances_v1 = ok(LINEUP);
    mount(<Page />);
    const rows = await screen.findAllByTestId('lineup-row');
    expect(rows.map((r) => r.getAttribute('href'))).toEqual(['/event/later-night', '/event/s1']);
    expect((rows[0]).textContent).toContain('Later Night');
    expect((rows[0]).textContent).toContain('Beginners class');
    expect((rows[1]).textContent).toContain('Sooner Social');
  });
  it('error: a missing function shows the calm error state, never a crash; retry re-asks', async () => {
    answers.my_role_details_v1 = fail('Could not find the function public.my_role_details_v1');
    answers.my_lineup_appearances_v1 = fail('Could not find the function public.my_lineup_appearances_v1');
    mount(<Page />);
    expect((await screen.findByTestId('details-error')).textContent).toContain('This did not load');
    expect(await screen.findByTestId('lineup-error')).toBeTruthy();
    fireEvent.click(screen.getByTestId('details-error-retry'));
    await waitFor(() => expect(calls('my_role_details_v1').length).toBe(2));
  });
  it('a pinned refusal on load reads as its sentence', async () => {
    answers.my_role_details_v1 = fail('no_profile');
    mount(<Page />);
    expect((await screen.findByTestId('details-error')).textContent).toContain(ROLE_ERROR_COPY.no_profile);
  });
  it('asks only for its own role', async () => {
    mount(<Page />);
    await screen.findByTestId('completeness-line');
    expect(h.rpc.mock.calls.every((c) => (c[1] as { p_role: string }).p_role === role)).toBe(true);
  });
});

describe.each(PROFILES)('%s profile edit', (role, Page, label, key) => {
  it('every field is marked optional; untouched Save is disabled with a visible reason and sends nothing', async () => {
    mount(<Page />);
    const save = await screen.findByTestId('save-details');
    expect(screen.getAllByText(/\(optional\)$/).length).toBe(role === 'teacher' ? 7 : 5);
    expect((save) as HTMLButtonElement).toHaveProperty('disabled', true);
    expect((screen.getByTestId('save-reason')).textContent).toContain(NOTHING_CHANGED);
    fireEvent.submit(save.closest('form')!);
    expect(calls('save_my_role_v1')).toHaveLength(0);
  });
  it('one changed key sends exactly that key', async () => {
    answers.save_my_role_v1 = ok({ role, person_id: 'p1', changed: true, changed_keys: [key], details: { ...DETAILS[role], [key]: 'Both' } });
    mount(<Page />);
    fireEvent.change(await screen.findByLabelText(label), { target: { value: 'Both' } });
    fireEvent.click(screen.getByTestId('save-details'));
    await waitFor(() => expect(calls('save_my_role_v1')).toHaveLength(1));
    expect(calls('save_my_role_v1')[0][1]).toEqual({ p_role: role, p_patch: { [key]: 'Both' } });
    // The form restarts from the saved details: untouched again.
    await waitFor(() => expect((screen.getByTestId('save-details')) as HTMLButtonElement).toHaveProperty('disabled', true));
  });
  it.each(['rate_limited', 'invalid_text', 'not_signed_in'] as const)('server refusal %s shows its sentence', async (code) => {
    answers.save_my_role_v1 = fail(code);
    mount(<Page />);
    fireEvent.change(await screen.findByLabelText(label), { target: { value: 'Both' } });
    fireEvent.click(screen.getByTestId('save-details'));
    expect((await screen.findByTestId('save-error')).textContent).toContain(ROLE_ERROR_COPY[code]);
  });
});

it('a value over the limit is refused on the phone, and nothing is sent', async () => {
  mount(<DjProfilePage />);
  fireEvent.change(await screen.findByLabelText('SoundCloud link (optional)'), { target: { value: 'https://a b' } });
  fireEvent.click(screen.getByTestId('save-details'));
  expect(await screen.findByText(ROLE_ERROR_COPY.invalid_link)).toBeTruthy();
  expect(calls('save_my_role_v1')).toHaveLength(0);
});

it('list input: add, refuse a duplicate with a reason, remove', async () => {
  mount(<TeacherProfilePage />);
  const input = await screen.findByLabelText('Styles you teach (optional)');
  fireEvent.change(input, { target: { value: 'sensual' } });
  expect(screen.getByText('sensual is already in the list.')).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Add to Styles you teach' })) as HTMLButtonElement).toHaveProperty('disabled', true);
  fireEvent.change(input, { target: { value: 'Dominican' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(within(screen.getByRole('list', { name: 'Styles you teach' })).getAllByRole('listitem')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Remove Sensual' }));
  expect(within(screen.getByRole('list', { name: 'Styles you teach' })).getAllByRole('listitem')).toHaveLength(1);
});

describe('wizard steps', () => {
  it.each([
    [doYouTeachStep, 'teacher', false, true],
    [doYouTeachStep, 'teacher', true, false],
    [doYouDjStep, 'dj', false, true],
  ] as const)('%#: the yes/no step calls set_my_role_declined_v1 (No = declined true)', async (step, role, answer, declined) => {
    answers.set_my_role_declined_v1 = ok({ roles: ['dancer'], declined: [], changed: true });
    await submitRoleWizardStep(step, answer);
    expect(calls('set_my_role_declined_v1')[0][1]).toEqual({ p_role: role, p_declined: declined });
    expect(calls('save_my_role_v1')).toHaveLength(0);
  });
  it('a field step saves exactly its one key', async () => {
    answers.save_my_role_v1 = ok({ role: 'teacher', person_id: 'p1', changed: true, changed_keys: ['years_teaching'], details: DETAILS.teacher });
    await submitRoleWizardStep(teacherWizardSteps[0], 9);
    expect(calls('save_my_role_v1')[0][1]).toEqual({ p_role: 'teacher', p_patch: { years_teaching: 9 } });
  });
  it('a field step offers Skip and refuses a bad value without answering', () => {
    const onAnswer = vi.fn();
    const onSkip = vi.fn();
    const { Component, field } = teacherWizardSteps[0];
    mount(<Component field={field} value={null} required={false} saving={false} error={null} onAnswer={onAnswer} onSkip={onSkip} />);
    fireEvent.change(screen.getByLabelText('Years teaching (optional)'), { target: { value: '99' } });
    fireEvent.click(screen.getByTestId('step-continue'));
    expect(onAnswer).not.toHaveBeenCalled();
    expect(screen.getByText(ROLE_ERROR_COPY.invalid_years)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Years teaching (optional)'), { target: { value: '12' } });
    fireEvent.click(screen.getByTestId('step-continue'));
    expect(onAnswer).toHaveBeenCalledWith(12);
    fireEvent.click(screen.getByTestId('step-skip'));
    expect(onSkip).toHaveBeenCalled();
  });
  it('the yes/no step keeps Continue disabled with a reason until answered', () => {
    const onAnswer = vi.fn();
    const { Component, field } = doYouDjStep;
    mount(<Component field={field} value={null} required={false} saving={false} error={null} onAnswer={onAnswer} />);
    expect((screen.getByTestId('step-continue')) as HTMLButtonElement).toHaveProperty('disabled', true);
    expect(screen.getByText('Choose Yes or No to continue.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    fireEvent.click(screen.getByTestId('step-continue'));
    expect(onAnswer).toHaveBeenCalledWith(false);
  });
  it('unlock lines promise nothing but the next questions', () => {
    for (const s of [doYouTeachStep, doYouDjStep]) expect(s.unlockLine).toMatch(/^Yes lets you add your .* details next\. Every one is optional\.$/);
  });
});

// jsdom has no layout, so the 44px rule is checked on the size classes every tap target carries.
const TARGET = /(?:^|\s)(?:min-)?h-\[(4[4-9]|[5-9]\d|\d{3})px\]/;
describe.each([
  ['teacher dashboard', () => <TeacherAreaPage />],
  ['dj dashboard', () => <DjAreaPage />],
  ['teacher profile', () => <TeacherProfilePage />],
  ['dj profile', () => <DjProfilePage />],
] as const)('%s: every tap target is at least 44px', (_name, Page) => {
  it('buttons, links and inputs', async () => {
    answers.my_lineup_appearances_v1 = ok(LINEUP);
    answers.my_role_details_v1 = ok({ role: _name.startsWith('dj') ? 'dj' : 'teacher', person_id: 'p1', details: _name.startsWith('dj') ? { ...DETAILS.dj, genres: ['Bachata'] } : DETAILS.teacher });
    const { container } = mount(<Page />);
    await waitFor(() => expect(container.querySelector('[role="status"][aria-busy="true"]')).toBeNull());
    const targets = Array.from(container.querySelectorAll('button, a, input, textarea'));
    expect(targets.length).toBeGreaterThan(1);
    for (const el of targets) expect({ el: el.outerHTML.slice(0, 80), ok: TARGET.test(el.getAttribute('class') ?? '') }).toMatchObject({ ok: true });
  });
});
