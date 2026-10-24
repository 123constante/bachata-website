// @vitest-environment jsdom
/**
 * W2 walk fixes 1 and 2 on /account/o/complete: required steps first; opened
 * from an event (returnTo) it asks ONLY the required ones; the counter counts
 * required answers only; Finish later, Back and the end screen go back to the
 * event, "Back to <event>" first and "Keep going" second.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
import { requiredLeftText } from '@/modules/organiser/shared/profileProgress';
import { ProfileWizardScreen } from '../ProfileWizard';
import { SKIP_LABEL } from '../stepKinds';
import type { WizardWriters } from '../wizardApi';

type Step = [area: ProgressStep['area'], field: string, required: boolean, done: boolean];
const steps = (rows: Step[]) => rows.map(([area, field, required, done]) => ({ area, field, required, done }));

const EVENT = '/account/o/events/s1';
let dancerRow: Record<string, unknown>;
let progress: { percent: number; required_left: number; publish_ready: boolean; steps: ReturnType<typeof steps>; declined: string[] };
let saveDancer: ReturnType<typeof vi.fn>;
let saveOrganiser: ReturnType<typeof vi.fn>;

function Where() {
  const l = useLocation();
  return <span data-testid="where">{`${l.pathname}${l.search}`}</span>;
}

function mount(entry = '/account/o/complete') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const writers = { saveDancer, saveOrganiser } as unknown as WizardWriters;
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/account/o/complete" element={<ProfileWizardScreen writers={writers} uploadLogo={async () => 'https://img.example/logo.jpg'} />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const fromEvent = () => mount(`/account/o/complete?returnTo=${encodeURIComponent(EVENT)}`);

const question = () => screen.getByTestId('wizard-question').textContent;
const onStep = async (q: string) => waitFor(() => expect(question()).toBe(q));
const answerText = (v: string) => {
  fireEvent.change(screen.getByRole('textbox'), { target: { value: v } });
  fireEvent.click(screen.getByTestId('step-continue'));
};

beforeEach(() => {
  try { window.localStorage.clear(); } catch { /* jsdom */ }
  dancerRow = { profile_id: 'p1', user_id: 'u1', first_name: null, surname: null, based_city_id: null, dance_role: null, avatar_url: null, nationality: null, languages: [], instagram: null, whatsapp: null, dance_started_year: null, bio: null, website_url: null, favorite_styles: [], achievements: [], other_roles: ['organiser'] };
  saveDancer = vi.fn(async (delta: Record<string, unknown>) => ({ ...dancerRow, ...delta }));
  saveOrganiser = vi.fn(async () => ({ kind: 'saved', stored: null, row: null, unmatched: [] }));
  // The walk's shape: optional questions come first in the server's order, the required ones after them.
  progress = {
    percent: 10, required_left: 2, publish_ready: false, declined: [],
    steps: steps([
      ['dancer', 'surname', false, false],
      ['dancer', 'bio', false, false],
      ['dancer', 'first_name', true, false],
      ['organiser', 'website', false, false],
      ['organiser', 'founded_year', true, false],
    ]),
  };
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'organiser_home_v1') return { data: { today: '2026-10-24', organisers: [{ id: 'org-1', name: 'Ritmo', slug: 'ritmo', avatar_url: null, city_id: 'c1', lifecycle_status: 'live', role: 'owner', latest_decision: null, series: [], team: [] }] }, error: null };
    if (fn === 'my_profile_progress_v1') return { data: progress, error: null };
    if (fn === 'my_dancer_edit_v1') return { data: dancerRow, error: null };
    if (fn === 'admin_event_workspace_p5') return { data: { series: { series: { id: 's1', name: 'Friday Social', lifecycle_status: 'draft', version: 3 } }, occurrences: [] }, error: null };
    return { data: null, error: { message: `unexpected ${fn}` } };
  });
});
afterEach(cleanup);

const ready = () => {
  progress = { ...progress, percent: 60, required_left: 0, publish_ready: true, steps: progress.steps.map((s) => (s.required ? { ...s, done: true } : s)) };
};

describe('finding 1: required first, and only required from an event', () => {
  it('opened from Home: the first question is the first REQUIRED one, not an optional surname', async () => {
    mount();
    await onStep('What is your first name?');
    expect(screen.getByTestId('wizard-required-left').textContent).toBe(requiredLeftText(2));
  });

  it('opened from Home: the optional ones come after every required one', async () => {
    mount();
    await onStep('What is your first name?');
    answerText('Ana');
    await onStep('What year did it start?');
  });

  it('opened from an event: only the required questions, then the end', async () => {
    fromEvent();
    await onStep('What is your first name?');
    answerText('Ana');
    await onStep('What year did it start?');
    ready();
    answerText('2019');
    await onStep('You can publish now');
  });

  it('the counter counts required answers only: skipping an optional one never moves it', async () => {
    progress = { ...progress, required_left: 0, publish_ready: true, steps: steps([['dancer', 'surname', false, false], ['dancer', 'bio', false, false]]) };
    mount();
    await onStep('What is your surname?');
    expect(screen.queryByTestId('wizard-required-left')).toBeNull();
    fireEvent.click(screen.getByText(SKIP_LABEL));
    await onStep('Tell dancers about you');
    expect(screen.queryByTestId('wizard-required-left')).toBeNull();
  });
});

describe('finding 2: returnTo survives Finish later, Back and the end screen', () => {
  it('Finish later goes back to the event, not Home', async () => {
    fromEvent();
    await onStep('What is your first name?');
    fireEvent.click(screen.getByTestId('wizard-finish-later'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(EVENT));
  });

  it('Back from the first question goes back to the event', async () => {
    fromEvent();
    await onStep('What is your first name?');
    fireEvent.click(screen.getByTestId('wizard-back'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(EVENT));
  });

  it('"You can publish now": Back to <event> first, Keep going second', async () => {
    fromEvent();
    await onStep('What is your first name?');
    answerText('Ana');
    await onStep('What year did it start?');
    ready();
    answerText('2019');
    await onStep('You can publish now');
    const back = await screen.findByTestId('wizard-back-to-event');
    await waitFor(() => expect(back.textContent).toBe('Back to Friday Social'));
    const keep = screen.getByTestId('wizard-milestone-continue');
    expect(back.compareDocumentPosition(keep) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(keep.className).not.toBe(back.className);
    fireEvent.click(back);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(EVENT));
  });

  it('Keep going after the event milestone carries on with the optional questions', async () => {
    progress.steps = steps([['dancer', 'surname', false, false], ['dancer', 'first_name', true, false]]);
    progress.required_left = 1;
    fromEvent();
    await onStep('What is your first name?');
    ready();
    answerText('Ana');
    await onStep('You can publish now');
    fireEvent.click(await screen.findByTestId('wizard-milestone-continue'));
    await onStep('What is your surname?');
  });

  it('no returnTo: the end screen still says Keep going and Back to Home', async () => {
    progress.steps = steps([['dancer', 'first_name', true, false], ['dancer', 'surname', false, false]]);
    progress.required_left = 1;
    mount();
    await onStep('What is your first name?');
    ready();
    answerText('Ana');
    await onStep('You can publish now');
    expect(screen.queryByTestId('wizard-back-to-event')).toBeNull();
    expect(screen.getByTestId('wizard-milestone-continue').textContent).toBe('Keep going');
  });

  it('a returnTo that is not a site path is ignored (Home as before)', async () => {
    mount(`/account/o/complete?returnTo=${encodeURIComponent('https://evil.example/')}`);
    await onStep('What is your first name?');
    fireEvent.click(screen.getByTestId('wizard-finish-later'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/account/o'));
  });
});
