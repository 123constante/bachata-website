// @vitest-environment jsdom
/**
 * Arc 1 PR 3 slice B: bridge -> questions -> All set -> Go live, on a prod-shaped
 * progress (5 dancer + 5 page answers open). Server calls are fakes at the RPC
 * boundary; the writers are counted fakes at the save boundary.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const rpc = vi.hoisted(() => vi.fn());
const send = vi.hoisted(() => vi.fn());
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
vi.mock('@/modules/organiser/flows/add/useFlow', () => ({
  useSeriesWorkspace: () => ({ data: { series: { id: 's1', name: 'Friday Social', version: 3 } } }),
  useFlowSend: () => ({ send, run: async (w: () => Promise<void>) => w(), busy: false, conflict: false, error: null }),
}));

import type { ProgressStep } from '@/modules/organiser/shared/profileProgress';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import type { WizardWriters } from '../../../../wizard/wizardApi';
import { GoLiveFlowScreen } from '../GoLiveFlow';

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
          <Route path={ORG_PATHS.goLive} element={<GoLiveFlowScreen writers={writers} uploadLogo={async () => 'https://img.example/logo.jpg'} />} />
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
  steps = open(TEN);
  saveDancer = vi.fn(async (delta: Record<string, unknown>) => ({ ...dancerRow, ...delta }));
  saveOrganiser = vi.fn(async () => ({ kind: 'saved', stored: null, row: null, unmatched: [] }));
  send.mockReset();
  send.mockResolvedValue({ ok: true });
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'organiser_home_v1') return { data: { today: '2026-10-21', organisers: [{ id: 'org-1', name: 'Ritmo', slug: 'ritmo', avatar_url: null, city_id: 'c1', lifecycle_status: 'live', role: 'owner', latest_decision: null, series: [], team: [] }] }, error: null };
    if (fn === 'my_profile_progress_v1') return { data: { percent: 40, required_left: steps.length, publish_ready: false, declined: [], steps }, error: null };
    if (fn === 'my_dancer_edit_v1') return { data: dancerRow, error: null };
    return { data: null, error: { message: `unexpected ${fn}` } };
  });
});
afterEach(cleanup);

describe('the bridge', () => {
  it('names the event and the count, with Continue and Not now; nothing is saved', async () => {
    mount();
    expect((await screen.findByTestId('golive-title')).textContent).toBe('Almost live');
    expect(screen.getByTestId('golive-line').textContent).toBe('Friday Social is saved. 10 quick questions and you can publish it.');
    expect(screen.getAllByTestId('golive-dot')).toHaveLength(10);
    expect(screen.getByTestId('golive-continue').textContent).toBe('Continue');
    fireEvent.click(screen.getByTestId('golive-not-now'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(ORG_PATHS.home));
    expect(saveDancer).not.toHaveBeenCalled();
    expect(saveOrganiser).not.toHaveBeenCalled();
  });
});

describe('the questions, one per screen', () => {
  it('Continue opens the first question with its section and step count; a required step has no Skip', async () => {
    mount();
    fireEvent.click(await screen.findByTestId('golive-continue'));
    await onQuestion('What is your nationality?');
    expect(screen.getByTestId('golive-section').textContent).toContain('About you');
    expect(screen.getByTestId('golive-section').textContent).toContain('Step 1 of 5');
    expect(screen.queryByTestId('step-skip')).toBeNull();
  });

  it('Back from the first question returns to the bridge', async () => {
    mount();
    fireEvent.click(await screen.findByTestId('golive-continue'));
    await onQuestion('What is your nationality?');
    fireEvent.click(screen.getByTestId('golive-back'));
    expect((await screen.findByTestId('golive-title')).textContent).toBe('Almost live');
  });

  it('an answer saves through the wizard writer with its one key, then the next question shows', async () => {
    steps = open([['dancer', 'instagram', false], ['dancer', 'phone_or_whatsapp', false]]);
    mount();
    fireEvent.click(await screen.findByTestId('golive-continue'));
    await onQuestion('What is your Instagram?');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ana.dances' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    await onQuestion('What is your WhatsApp number?');
    expect(saveDancer).toHaveBeenCalledTimes(1);
    expect(saveDancer).toHaveBeenCalledWith({ instagram: 'ana.dances' });
  });

  it('Use mine on the page questions saves the dancer answer in one tap, and nothing else', async () => {
    dancerRow = { ...dancerRow, instagram: 'ana.dances', whatsapp: '+44 7700 900123' };
    steps = open([['organiser', 'instagram', false], ['organiser', 'contact_phone', false]]);
    mount();
    fireEvent.click(await screen.findByTestId('golive-continue'));
    await onQuestion('What is its Instagram?');
    expect(screen.getByTestId('golive-section').textContent).toContain('About your page');
    expect(screen.getByTestId('golive-use-mine').textContent).toBe('Use mine');
    fireEvent.click(screen.getByTestId('golive-use-mine'));
    await onQuestion('What number can dancers call?');
    expect(saveOrganiser).toHaveBeenCalledTimes(1);
    expect(saveOrganiser.mock.calls[0][3]).toEqual({ instagram: 'ana.dances' });
    expect(screen.getByTestId('golive-use-mine').textContent).toBe('Use my WhatsApp number');
    expect(saveDancer).not.toHaveBeenCalled();
  });

  it('no Use mine when the person has no answer to reuse', async () => {
    steps = open([['organiser', 'instagram', false]]);
    mount();
    fireEvent.click(await screen.findByTestId('golive-continue'));
    await onQuestion('What is its Instagram?');
    expect(screen.queryByTestId('golive-use-mine')).toBeNull();
  });

  it('a failed save keeps the person on the question with the reason', async () => {
    saveDancer.mockRejectedValueOnce(new Error('Instagram handle not allowed'));
    steps = open([['dancer', 'instagram', false]]);
    mount();
    fireEvent.click(await screen.findByTestId('golive-continue'));
    await onQuestion('What is your Instagram?');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'bad' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Instagram handle not allowed'));
    expect(question()).toBe('What is your Instagram?');
  });
});

describe('All set and Go live', () => {
  it('after the last answer: All set names the event; Go live sends the live command, Not yet goes Home', async () => {
    steps = open([['dancer', 'instagram', false]]);
    mount();
    fireEvent.click(await screen.findByTestId('golive-continue'));
    await onQuestion('What is your Instagram?');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ana.dances' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect((await screen.findByTestId('golive-title')).textContent).toBe('All set');
    expect(screen.getByTestId('golive-line').textContent).toBe('Friday Social is ready to go live.');
    fireEvent.click(screen.getByTestId('golive-live'));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(send.mock.calls[0][0]).toBe('s1');
    expect(send.mock.calls[0][1]).toBe(3);
    expect(JSON.stringify(send.mock.calls[0][2])).toContain('live');
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(ORG_PATHS.done));
  });

  it('nothing left to ask: opens on All set, never on an empty bridge', async () => {
    steps = [];
    mount();
    expect((await screen.findByTestId('golive-title')).textContent).toBe('All set');
    expect(screen.getByTestId('golive-live')).toBeTruthy();
    fireEvent.click(screen.getByTestId('golive-not-yet'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(ORG_PATHS.home));
  });

  it('opened from Home without an event: starts at the first question; All set offers the first event', async () => {
    steps = open([['dancer', 'instagram', false]]);
    mount(ORG_PATHS.goLive);
    await onQuestion('What is your Instagram?');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ana.dances' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect((await screen.findByTestId('golive-line')).textContent).toBe('You can publish your first event.');
    expect(screen.queryByTestId('golive-live')).toBeNull();
    expect(screen.getByTestId('golive-add-first').textContent).toBe('Add your first event');
  });
});
