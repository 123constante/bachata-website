// @vitest-environment jsdom
/**
 * A-WEB1b wizard matrix (C15, C16, D26, D27, D50). The server's step list is a
 * fake at the RPC boundary; the writers are fakes injected at the save
 * boundary, so "sends nothing" and "sends one key" are counted on them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc, from: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'me@x.example' }, session: null }) }));
vi.mock('@/modules/profile/organiserPublicProfile', async (orig) => ({
  ...(await orig<object>()),
  fetchOwnOrganiserEntity: async (id: string) => ({ id, name: 'Ritmo', city_id: 'c1', avatar_url: null, bio: null, instagram: null, website: null, socials: {}, organisation_category: null, founded_year: null }),
}));
vi.mock('@/modules/organiser/shared/ownershipApi', async (orig) => ({
  ...(await orig<object>()),
  fetchContactSettings: async () => ({ contact_email: null, contact_phone: null, show_phone_publicly: true, show_email_publicly: false, claim_email: null }),
}));

import type { ProgressStep } from '@/modules/organiser/shared/profileProgress';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { ProfileWizardScreen } from '../ProfileWizard';
import { REQUIRED_HINT, SKIP_LABEL } from '../stepKinds';
import type { WizardWriters } from '../wizardApi';

type Step = [area: ProgressStep['area'], field: string, required: boolean, done: boolean];
const steps = (rows: Step[]) => rows.map(([area, field, required, done]) => ({ area, field, required, done }));

let dancerRow: Record<string, unknown>;
let progress: { percent: number; required_left: number; publish_ready: boolean; steps: ReturnType<typeof steps>; declined: string[] };
let saveDancer: ReturnType<typeof vi.fn>;
let saveOrganiser: ReturnType<typeof vi.fn>;

function Where() {
  const l = useLocation();
  return <span data-testid="where">{l.pathname}</span>;
}

function mount(extra: Partial<WizardWriters> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const writers = { saveDancer, saveOrganiser, ...extra } as unknown as WizardWriters;
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/account/o/complete']}>
        <Routes>
          <Route path="/account/o/complete" element={<ProfileWizardScreen writers={writers} uploadLogo={async () => 'https://img.example/logo.jpg'} />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const question = () => screen.getByTestId('wizard-question').textContent;
const onStep = async (q: string) => waitFor(() => expect(question()).toBe(q));

beforeEach(() => {
  try { window.localStorage.clear(); } catch { /* jsdom */ }
  // A prod-shaped my_dancer_edit_v1 row (the keys the wizard reads).
  dancerRow = { profile_id: 'p1', user_id: 'u1', first_name: 'Ana', surname: 'Diaz', based_city_id: null, dance_role: null, avatar_url: null, nationality: null, languages: [], instagram: null, whatsapp: null, dance_started_year: null, bio: null, website_url: null, favorite_styles: ['Moderna'], achievements: [], other_roles: ['organiser'] };
  saveDancer = vi.fn(async (delta: Record<string, unknown>) => ({ ...dancerRow, ...delta }));
  saveOrganiser = vi.fn(async () => ({ kind: 'saved', stored: null, row: null, unmatched: [] }));
  progress = {
    percent: 40, required_left: 3, publish_ready: false, declined: [],
    steps: steps([
      ['dancer', 'first_name', true, true],
      ['dancer', 'languages', true, false],
      ['organiser', 'name', true, true],
      ['organiser', 'founded_year', true, false],
      ['teacher', 'years_teaching', false, false],
      ['dancer', 'surname', false, false],
      ['dancer', 'favourite_styles', false, false],
      ['dancer', 'bio', false, false],
    ]),
  };
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'organiser_home_v1') return { data: { today: '2026-10-20', organisers: [{ id: 'org-1', name: 'Ritmo', slug: 'ritmo', avatar_url: null, city_id: 'c1', lifecycle_status: 'live', role: 'owner', latest_decision: null, series: [], team: [] }] }, error: null };
    if (fn === 'my_profile_progress_v1') return { data: progress, error: null };
    if (fn === 'my_dancer_edit_v1') return { data: dancerRow, error: null };
    return { data: null, error: { message: `unexpected ${fn}` } };
  });
});
afterEach(cleanup);

describe('wizard order is the server order (C15)', () => {
  it('skips done steps and resumes at the first unanswered one', async () => {
    mount();
    await onStep('Which languages do you speak?');
  });

  it('walks the server order; a step with no component is skipped', async () => {
    progress.steps = steps([['dancer', 'gallery', false, false], ['dancer', 'bio', false, false]]);
    progress.required_left = 0;
    progress.publish_ready = true;
    mount();
    await onStep('Tell dancers about you');
  });

  it('Release B: a teacher step is B-WEB1\'s own component, in server order; its answer goes to the role writer with ONE key', async () => {
    progress.steps = steps([['teacher', 'years_teaching', false, false], ['dancer', 'bio', false, false]]);
    progress.required_left = 0;
    progress.publish_ready = true;
    const saveRole = vi.fn(async (_step: unknown, _value: unknown) => undefined);
    rpc.mockImplementation(async (fn: string) => {
      if (fn === 'organiser_home_v1') return { data: { today: '2026-10-20', organisers: [] }, error: null };
      if (fn === 'my_profile_progress_v1') return { data: progress, error: null };
      if (fn === 'my_dancer_edit_v1') return { data: dancerRow, error: null };
      if (fn === 'my_role_details_v1') return { data: { role: 'teacher', person_id: 'p1', details: {} }, error: null };
      return { data: null, error: { message: `unexpected ${fn}` } };
    });
    mount({ saveRole });
    await onStep('How many years have you been teaching?');
    fireEvent.change(screen.getByLabelText('Years teaching'), { target: { value: '6' } });
    fireEvent.click(screen.getByTestId('step-continue'));
    await onStep('Tell dancers about you');
    expect(saveRole).toHaveBeenCalledTimes(1);
    expect(saveRole.mock.calls[0][1]).toBe(6);
    expect(saveDancer).not.toHaveBeenCalled();
  });
});

describe('D26: required vs optional controls', () => {
  it.each([
    ['required, empty', 'languages', true],
    ['optional, empty', 'bio', false],
  ])('%s', async (_label, field, required) => {
    progress.steps = steps([['dancer', field, required, false]]);
    mount();
    await waitFor(() => screen.getByTestId('wizard-step'));
    if (required) {
      expect(screen.queryByText(SKIP_LABEL)).toBeNull();
      expect((screen.getByTestId('step-continue') as HTMLButtonElement).disabled).toBe(true);
      expect(screen.getByTestId('step-hint').textContent).toContain(REQUIRED_HINT);
    } else {
      expect(screen.getByText(SKIP_LABEL)).toBeTruthy();
      expect(screen.queryByTestId('step-continue')).toBeNull();
      expect(screen.getByTestId('step-hint').textContent).toMatch(/^Optional\./);
    }
  });

  it('the heading is the question; the field label is for screen readers only', async () => {
    progress.steps = steps([['dancer', 'bio', false, false]]);
    mount();
    await onStep('Tell dancers about you');
    const label = document.querySelector('label[for]') as HTMLLabelElement;
    expect(label.className).toContain('sr-only');
  });

  it('an optional step shows Continue only once something is entered', async () => {
    progress.steps = steps([['dancer', 'bio', false, false]]);
    mount();
    await onStep('Tell dancers about you');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Social dancer' } });
    expect(screen.getByTestId('step-continue')).toBeTruthy();
    expect(screen.queryByText(SKIP_LABEL)).toBeNull();
  });

  it('a choice step answers on the tap (no Continue)', async () => {
    progress.steps = steps([['dancer', 'dance_role', true, false], ['dancer', 'bio', false, false]]);
    mount();
    await onStep('Do you lead or follow?');
    expect(screen.queryByTestId('step-continue')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Follower/ }));
    await waitFor(() => expect(saveDancer).toHaveBeenCalledTimes(1));
    expect(saveDancer.mock.calls[0][0]).toEqual({ dance_role: 'Follower' });
  });
});

describe('saves: one key, untouched sends nothing, failures keep the answer', () => {
  it('D27: typed list text not yet added counts as added on Continue; ONE key sent', async () => {
    mount();
    await onStep('Which languages do you speak?');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  Spanish ' } });
    fireEvent.click(screen.getByTestId('step-continue'));
    await waitFor(() => expect(saveDancer).toHaveBeenCalledTimes(1));
    expect(saveDancer.mock.calls[0][0]).toEqual({ languages: ['Spanish'] });
  });

  it('an untouched answer sends nothing and moves on', async () => {
    progress.steps = steps([['dancer', 'favourite_styles', false, false], ['dancer', 'bio', false, false]]);
    mount();
    await onStep('Which styles do you love dancing?');
    fireEvent.click(screen.getByTestId('step-continue'));
    await onStep('Tell dancers about you');
    expect(saveDancer).not.toHaveBeenCalled();
  });

  it('Skip for now sends nothing and moves on', async () => {
    progress.steps = steps([['dancer', 'bio', false, false], ['dancer', 'achievements', false, false]]);
    mount();
    await onStep('Tell dancers about you');
    fireEvent.click(screen.getByText(SKIP_LABEL));
    await onStep('Anything you are proud of in dance?');
    expect(saveDancer).not.toHaveBeenCalled();
  });

  it('a failed save keeps the answer on screen and shows the error', async () => {
    saveDancer.mockRejectedValueOnce(new Error('We could not save that. Try again.'));
    mount();
    await onStep('Which languages do you speak?');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Spanish' } });
    fireEvent.click(screen.getByTestId('step-continue'));
    await waitFor(() => expect(screen.getByTestId('step-error').textContent).toBe('We could not save that. Try again.'));
    expect(question()).toBe('Which languages do you speak?');
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Spanish');
  });

  it('an organiser answer goes through My page\'s ONE save with its one field draft', async () => {
    progress.steps = steps([['organiser', 'founded_year', true, false]]);
    mount();
    await onStep('What year did it start?');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '2019' } });
    fireEvent.click(screen.getByTestId('step-continue'));
    await waitFor(() => expect(saveOrganiser).toHaveBeenCalledTimes(1));
    expect(saveOrganiser.mock.calls[0][1]).toBe('org-1');
    expect(saveOrganiser.mock.calls[0][3]).toEqual({ founded_year: '2019' });
  });

  it('our own check refuses before anything is sent', async () => {
    progress.steps = steps([['dancer', 'dance_started_year', true, false]]);
    mount();
    await onStep('What year did you start dancing?');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '1800' } });
    fireEvent.click(screen.getByTestId('step-continue'));
    expect(screen.getByTestId('step-error').textContent).toMatch(/Enter a year from 1950/);
    expect(saveDancer).not.toHaveBeenCalled();
  });
});

describe('milestones and the end (C16)', () => {
  it('leaving the last required step shows "You can publish now" once progress says ready', async () => {
    progress.steps = steps([['dancer', 'languages', true, false], ['dancer', 'bio', false, false]]);
    mount();
    await onStep('Which languages do you speak?');
    progress = { ...progress, percent: 70, required_left: 0, publish_ready: true, steps: steps([['dancer', 'languages', true, true], ['dancer', 'bio', false, false]]) };
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Spanish' } });
    fireEvent.click(screen.getByTestId('step-continue'));
    await onStep('You can publish now');
    expect(screen.getByTestId('wizard-unlock').textContent).toBe('You can now put your events live.');
    expect(within(screen.getByTestId('level-track')).getAllByTestId('level-step').map((s) => s.getAttribute('aria-current'))).toEqual([null, 'step', null]);
    fireEvent.click(screen.getByTestId('wizard-milestone-continue'));
    await onStep('Tell dancers about you');
  });

  it('nothing left at 100% -> the Full profile screen with one way out', async () => {
    progress = { percent: 100, required_left: 0, publish_ready: true, declined: [], steps: steps([['dancer', 'bio', false, true]]) };
    mount();
    await onStep('Your profile is 100% complete');
    fireEvent.click(screen.getByTestId('wizard-home'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(ORG_PATHS.home));
  });
});

describe('leaving (C15, D50)', () => {
  it('Finish later leaves to Home and marks the 24 h pause', async () => {
    mount();
    await onStep('Which languages do you speak?');
    fireEvent.click(screen.getByTestId('wizard-finish-later'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(ORG_PATHS.home));
    expect(window.localStorage.getItem('bc:profile-wizard-nudge:v1:u1')).toContain('finishLaterAt');
  });

  it('Back returns to the previous question', async () => {
    progress.steps = steps([['dancer', 'bio', false, false], ['dancer', 'achievements', false, false]]);
    mount();
    await onStep('Tell dancers about you');
    fireEvent.click(screen.getByText(SKIP_LABEL));
    await onStep('Anything you are proud of in dance?');
    fireEvent.click(screen.getByTestId('wizard-back'));
    await onStep('Tell dancers about you');
  });
});

describe('44 px targets', () => {
  it.each(['languages', 'dance_role', 'bio', 'city'])('every control on the %s step is at least 44 px tall', async (field) => {
    progress.steps = steps([['dancer', field, false, false]]);
    mount();
    await waitFor(() => screen.getByTestId('wizard-step'));
    const controls = [...document.querySelectorAll('button, a, input:not([type=file])')];
    expect(controls.length).toBeGreaterThan(0);
    for (const el of controls) expect(el.className, el.outerHTML.slice(0, 80)).toMatch(/(^|\s)(min-)?h-\[(4[4-9]|[5-9]\d)px\]/);
  });
});
