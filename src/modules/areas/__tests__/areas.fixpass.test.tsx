// @vitest-environment jsdom
/** B-WEB1 fix pass: review findings 1-8 and the D26 wizard design pass (each written red first). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
import { djWizardSteps } from '../dj/wizardSteps';
import { ROLE_ERROR_COPY } from '../shared/errorCopy';
import { roleField, type Role } from '../shared/fieldRegistry';
import { validateValue } from '../shared/roleModel';
import type { WizardStepDef } from '../wizardStep';

const DETAILS: Record<Role, Record<string, unknown>> = {
  teacher: { years_teaching: 6, teaching_styles: ['Sensual'], offers_private: null, private_lesson_types: [], private_lesson_locations: [], private_travel_distance: null, partner_role: null },
  dj: { dj_name: 'DJ Luna', genres: [], soundcloud: null, mixcloud: null, pricing: null },
};
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
    if (fn === 'my_roles_v1') return Promise.resolve(ok(['dancer', 'organiser', 'teacher', 'dj'].map((role) => ({ role, active: true, complete: false }))));
    if (fn === 'my_profile_progress_v1') return Promise.resolve(ok({ percent: 50, required_left: 0, publish_ready: true, steps: [], declined: [] }));
    return Promise.resolve(fail(`Could not find the function public.${fn}`));
  });
});
afterEach(cleanup);

function mount(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);
}
const calls = (fn: string) => h.rpc.mock.calls.filter((c) => c[0] === fn);
const pad = (n: number) => String(n).padStart(2, '0');

// 200 rows the way the server sends them (soonest first): 25 weekly series x 8 dates, interleaved by date.
const SERIES = Array.from({ length: 25 }, (_, i) => ({ id: `s${pad(i)}`, name: `Weekly Class ${pad(24 - i)}`, slug: `weekly-${pad(i)}` }));
const LINEUP_200 = Array.from({ length: 8 }, (_, week) =>
  SERIES.map((s, i) => ({ series_id: s.id, event_name: s.name, slug: s.slug, date: `2026-11-${pad(1 + week * 3 + (i % 3))}`, session_title: i % 2 ? 'Improvers' : null })),
).flat();

describe('finding 1 (D32): line-up grouped by series, first 10, then Show all', () => {
  it('a 200-row teacher gets one row per series, in server order, 10 first', async () => {
    expect(LINEUP_200).toHaveLength(200);
    answers.my_lineup_appearances_v1 = ok(LINEUP_200);
    mount(<TeacherAreaPage />);
    const rows = await screen.findAllByTestId('lineup-row');
    expect(rows).toHaveLength(10);
    expect(rows[0].textContent).toContain('Weekly Class 24');
    expect(rows[0].textContent).toContain('and 7 more dates');
    expect(rows[1].textContent).toContain('Improvers');
    const more = screen.getByTestId('lineup-show-all');
    expect(more.textContent).toBe('Show all 25');
    expect(more.getAttribute('class')).toMatch(/h-\[44px\]/);
    fireEvent.click(more);
    const all = screen.getAllByTestId('lineup-row');
    expect(all).toHaveLength(25);
    expect(all.map((r) => r.getAttribute('href'))).toEqual(SERIES.map((s) => `/event/${s.slug}`));
    expect(screen.queryByTestId('lineup-show-all')).toBeNull();
  });
  it('a single date reads without "more dates"; one more date is singular', async () => {
    answers.my_lineup_appearances_v1 = ok([
      { series_id: 'a', event_name: 'Alpha', slug: 'alpha', date: '2026-11-02', session_title: null },
      { series_id: 'b', event_name: 'Bravo', slug: 'bravo', date: '2026-11-03', session_title: null },
      { series_id: 'b', event_name: 'Bravo', slug: 'bravo', date: '2026-11-10', session_title: null },
    ]);
    mount(<DjAreaPage />);
    const rows = await screen.findAllByTestId('lineup-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).not.toContain('more date');
    expect(rows[1].textContent).toContain('and 1 more date');
    expect(rows[1].textContent).not.toContain('dates');
    expect(screen.queryByTestId('lineup-show-all')).toBeNull();
  });
});

describe('finding 8: render in server order even when it is neither name nor date order', () => {
  it('keeps the order the server sent', async () => {
    answers.my_lineup_appearances_v1 = ok([
      { series_id: 'm', event_name: 'Mid Social', slug: 'mid', date: '2026-11-20', session_title: null },
      { series_id: 'z', event_name: 'Zeta Night', slug: 'zeta', date: '2026-11-05', session_title: null },
      { series_id: 'a', event_name: 'Alpha Class', slug: 'alpha', date: '2026-12-01', session_title: null },
    ]);
    mount(<TeacherAreaPage />);
    const rows = await screen.findAllByTestId('lineup-row');
    expect(rows.map((r) => r.getAttribute('href'))).toEqual(['/event/mid', '/event/zeta', '/event/alpha']);
  });
});

describe('finding 4 (D33): a row with no slug has no link', () => {
  it('renders the row, but not as a link', async () => {
    answers.my_lineup_appearances_v1 = ok([{ series_id: 's1', event_name: 'Sooner Social', slug: null, date: '2026-10-30', session_title: null }]);
    mount(<TeacherAreaPage />);
    const [row] = await screen.findAllByTestId('lineup-row');
    expect(row.textContent).toContain('Sooner Social');
    expect(row.tagName).not.toBe('A');
    expect(row.getAttribute('href')).toBeNull();
    expect(row.querySelector('a')).toBeNull();
  });
});

describe('finding 2 (D27): a typed list item that was not added is kept', () => {
  it('profile: type, no Add -> Save is enabled and sends the term', async () => {
    answers.save_my_role_v1 = ok({ role: 'teacher', person_id: 'p1', changed: true, changed_keys: ['teaching_styles'], details: { ...DETAILS.teacher, teaching_styles: ['Sensual', 'Moderna'] } });
    mount(<TeacherProfilePage />);
    fireEvent.change(await screen.findByLabelText('Styles you teach (optional)'), { target: { value: '  Moderna ' } });
    const save = screen.getByTestId('save-details') as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    expect(screen.queryByTestId('save-reason')).toBeNull();
    fireEvent.click(save);
    await waitFor(() => expect(calls('save_my_role_v1')).toHaveLength(1));
    expect(calls('save_my_role_v1')[0][1]).toEqual({ p_role: 'teacher', p_patch: { teaching_styles: ['Sensual', 'Moderna'] } });
  });
  it('profile: a typed duplicate is de-duplicated, so nothing changes', async () => {
    mount(<TeacherProfilePage />);
    fireEvent.change(await screen.findByLabelText('Styles you teach (optional)'), { target: { value: 'sensual' } });
    expect((screen.getByTestId('save-details') as HTMLButtonElement).disabled).toBe(true);
  });
  it('wizard: Continue sends the typed term', () => {
    const step = teacherWizardSteps.find((s) => s.field === 'teaching_styles')!;
    const onAnswer = vi.fn();
    mount(<step.Component field={step.field} value={[]} required={false} saving={false} error={null} onAnswer={onAnswer} onSkip={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Styles you teach'), { target: { value: 'Sensual' } });
    fireEvent.click(screen.getByTestId('step-continue'));
    expect(onAnswer).toHaveBeenCalledWith(['Sensual']);
  });
});

const signedOutOrNoProfile: [string, () => ReactElement][] = [
  ['teacher dashboard', () => <TeacherAreaPage />],
  ['dj dashboard', () => <DjAreaPage />],
  ['teacher profile', () => <TeacherProfilePage />],
  ['dj profile', () => <DjProfilePage />],
];
describe.each(signedOutOrNoProfile)('finding 3: %s with no dancer profile', (_name, Page) => {
  it('shows ONE state with ONE action to finish the dancer profile, no retry, no line-up card', async () => {
    answers.my_role_details_v1 = fail('no_profile');
    answers.my_lineup_appearances_v1 = fail('no_profile');
    mount(<Page />);
    const state = await screen.findByTestId('blocked-state');
    expect(state.textContent).toContain(ROLE_ERROR_COPY.no_profile);
    const action = screen.getByTestId('blocked-action');
    expect(action.textContent).toBe('Finish your dancer profile');
    expect(action.getAttribute('href')).toBe('/finish-profile');
    expect(screen.queryByText('Try again')).toBeNull();
    expect(screen.queryByText(/Check your connection/)).toBeNull();
    expect(screen.queryByTestId('lineup-error')).toBeNull();
    expect(screen.queryByLabelText("Where you're on the line-up")).toBeNull();
    expect(screen.getAllByTestId('blocked-state')).toHaveLength(1);
  });
  it('signed out: one Sign in action, no retry', async () => {
    answers.my_role_details_v1 = fail('not_signed_in');
    answers.my_lineup_appearances_v1 = fail('not_signed_in');
    mount(<Page />);
    await screen.findByTestId('blocked-state');
    expect(screen.getByTestId('blocked-action').textContent).toBe('Sign in');
    expect(screen.getByTestId('blocked-action').getAttribute('href')).toBe('/auth');
    expect(screen.queryByText('Try again')).toBeNull();
  });
});
it('finding 3: the dancer profile path is a prop', async () => {
  answers.my_role_details_v1 = fail('no_profile');
  mount(<TeacherAreaPage dancerProfilePath="/somewhere/else" />);
  expect((await screen.findByTestId('blocked-action')).getAttribute('href')).toBe('/somewhere/else');
});

function mountStep(step: WizardStepDef, value: unknown, onAnswer = vi.fn(), onSkip = vi.fn()) {
  mount(<step.Component field={step.field} value={value} required={false} saving={false} error={null} onAnswer={onAnswer} onSkip={onSkip} />);
  return { onAnswer, onSkip };
}

describe('finding 5: an untouched wizard answer sends nothing', () => {
  it.each([
    ['years', teacherWizardSteps.find((s) => s.field === 'years_teaching')!, 6],
    ['list', teacherWizardSteps.find((s) => s.field === 'teaching_styles')!, ['Sensual']],
    ['text', djWizardSteps.find((s) => s.field === 'dj_name')!, 'DJ Luna'],
  ] as const)('%s step prefilled and unchanged: Continue skips, no answer', (_k, step, value) => {
    const { onAnswer, onSkip } = mountStep(step, value);
    fireEvent.click(screen.getByTestId('step-continue'));
    expect(onAnswer).not.toHaveBeenCalled();
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
  it('yes/no field step: tapping the held answer skips, the other answer answers', () => {
    const step = teacherWizardSteps.find((s) => s.field === 'offers_private')!;
    const { onAnswer, onSkip } = mountStep(step, true);
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    expect(onAnswer).not.toHaveBeenCalled();
    expect(onSkip).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(onAnswer).toHaveBeenCalledWith(false);
  });
});

describe('D26 design pass: one question per screen', () => {
  it('an empty optional step shows only "Skip for now"; Continue appears once something is entered', () => {
    const step = djWizardSteps.find((s) => s.field === 'dj_name')!;
    const { onSkip } = mountStep(step, null);
    expect(screen.queryByTestId('step-continue')).toBeNull();
    expect(screen.getByTestId('step-skip').textContent).toBe('Skip for now');
    fireEvent.change(screen.getByLabelText('DJ name'), { target: { value: 'Luna' } });
    expect(screen.getByTestId('step-continue')).toBeTruthy();
    expect(screen.queryByTestId('step-skip')).toBeNull();
    fireEvent.change(screen.getByLabelText('DJ name'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('step-skip'));
    expect(onSkip).toHaveBeenCalled();
  });
  it('the field label is visually hidden (the heading is the question) and Optional is on the hint line', () => {
    const step = teacherWizardSteps.find((s) => s.field === 'teaching_styles')!;
    mountStep(step, []);
    const label = document.querySelector('label[for]')!;
    expect(label.textContent).toBe('Styles you teach');
    expect(label.className).toContain('sr-only');
    expect(screen.getByText(/^Optional\./).textContent).toContain('For example Sensual');
    expect(step.labelIsQuestion).toBe(true);
  });
  it('the yes/no step advances on the tap of Yes or No, with no separate Continue', () => {
    expect(doYouTeachStep.advanceOnAnswer).toBe(true);
    const { onAnswer } = mountStep(doYouTeachStep, null);
    expect(screen.queryByTestId('step-continue')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(onAnswer).toHaveBeenCalledWith(false);
  });
});

describe('findings 6 and 7: client text rules match the server', () => {
  const name = roleField('dj', 'dj_name')!;
  const pricing = roleField('dj', 'pricing')!;
  const styles = roleField('teacher', 'teaching_styles')!;
  it('refuses control characters (pricing keeps new lines)', () => {
    expect(validateValue(name, 'DJ\tLuna')).toBe('invalid_text');
    expect(validateValue(pricing, 'From 100\nper night')).toBeNull();
    expect(validateValue(pricing, 'From 100\tper night')).toBe('invalid_text');
    expect(validateValue(styles, ['Sen\u0007sual'])).toBe('invalid_list');
    expect(ROLE_ERROR_COPY.invalid_text).toMatch(/character that cannot be saved/);
  });
  it('counts length in characters, not UTF-16 units', () => {
    const emoji80 = '\u{1F3B5}'.repeat(80);
    expect(validateValue(name, emoji80)).toBeNull();
    expect(validateValue(name, `${emoji80}x`)).toBe('invalid_text');
    expect(validateValue(styles, [emoji80])).toBeNull();
  });
});
