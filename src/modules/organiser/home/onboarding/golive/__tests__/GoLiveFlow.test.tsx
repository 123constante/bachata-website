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
    if (fn === 'series_go_live_check_v1') return { data: { ready: true, event_missing: [], recommended: [], profile_rule_applies: true, profile_missing: [] }, error: null };
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
    await waitFor(() => expect((screen.getByTestId('golive-live') as HTMLButtonElement).disabled).toBe(false));
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


describe('Go live is never silently off, and the server list is never dropped', () => {
  const checkOf = (over: Record<string, unknown>) => ({ ready: false, event_missing: [], recommended: [], profile_rule_applies: true, profile_missing: [], ...over });
  const withCheck = (c: unknown) => {
    const base = rpc.getMockImplementation()!;
    rpc.mockImplementation(async (fn: string, a?: unknown) => (fn === 'series_go_live_check_v1' ? { data: c, error: null } : base(fn, a)));
  };

  it('while the event loads: a reason is shown and Go live is off', async () => {
    steps = [];
    wsState.value = { data: undefined, isError: false, refetch: wsState.refetch };
    mount();
    expect((await screen.findByTestId('golive-live-reason')).textContent).toBe('Loading your event');
    expect((screen.getByTestId('golive-live') as HTMLButtonElement).disabled).toBe(true);
  });

  it('when the event read fails: a reason and a Retry that refetches', async () => {
    steps = [];
    wsState.value = { data: undefined, isError: true, refetch: wsState.refetch };
    mount();
    expect((await screen.findByTestId('golive-live-reason')).textContent).toContain('did not load');
    expect((screen.getByTestId('golive-live') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('golive-live-retry'));
    expect(wsState.refetch).toHaveBeenCalledTimes(1);
  });

  it('server items with no question (event items, a field with no wizard step, another page) are named on All set', async () => {
    steps = [];
    withCheck(checkOf({
      event_missing: [{ code: 'cover', section: 'cover' }],
      profile_missing: [{ area: 'organiser', [['organiser', 'id'].join('_')]: 'org-2', fields: ['contact_email', 'logo'] }],
    }));
    mount();
    const gaps = await screen.findAllByTestId('golive-gap');
    expect(gaps.map((g) => g.textContent)).toEqual([
      'Add a flyer', 'Add your page contact email', 'About your page: Add your organisation logo',
    ]);
    expect(screen.queryByTestId('golive-live-error')).toBeNull();
  });

  it('a refusal from the server shows its list instead of a bare sentence', async () => {
    steps = [];
    send.mockRejectedValueOnce({ message: 'permission_denied: series.set_lifecycle draft -> live needs a ready series: ' + JSON.stringify(checkOf({ event_missing: [{ code: 'venue', section: 'venue' }] })) });
    mount();
    await waitFor(() => expect((screen.getByTestId('golive-live') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('golive-live'));
    await waitFor(() => expect(screen.getAllByTestId('golive-gap').map((g) => g.textContent)).toEqual(['Pick a venue']));
    expect(screen.getByTestId('golive-not-yet-line').textContent).toBe('Not yet. Pick a venue.');
    expect(screen.getByTestId('golive-title').textContent).toBe('Almost there');
    expect((screen.getByTestId('golive-live') as HTMLButtonElement).disabled).toBe(true);
  });

  const six = [['venue', 'venue'], ['city', 'venue'], ['upcoming_date', 'dates'], ['session', 'programme'], ['cover', 'cover'], ['description', 'about']].map(([code, section]) => ({ code, section }));
  it.each([
    ['ready', checkOf({ ready: true }), 'All set', 'Friday Social is ready to go live.', false, null, 0],
    ['recommended only', checkOf({ ready: true, recommended: [{ code: 'ticket_link', section: 'tickets' }] }), 'All set', 'Friday Social is ready to go live.', false, null, 0],
    ['1 missing', checkOf({ event_missing: [{ code: 'venue', section: 'venue' }] }), 'Almost there', '1 thing left before Friday Social can go live.', true, 'Finish the list above first.', 1],
    ['6 missing', checkOf({ event_missing: six }), 'Almost there', '6 things left before Friday Social can go live.', true, 'Finish the list above first.', 6],
    ['ready:false, empty lists', checkOf({}), 'Almost there', 'Friday Social is not ready to go live yet.', true, 'Finish the list above first.', 0],
    ['ready:true but a gap listed', checkOf({ ready: true, event_missing: [{ code: 'cover', section: 'cover' }] }), 'Almost there', '1 thing left before Friday Social can go live.', true, 'Finish the list above first.', 1],
  ])('check %s: screen text, Go live state and reason agree', async (_n, c, title, line, disabled, reason, gapCount) => {
    steps = [];
    withCheck(c);
    mount();
    await waitFor(() => expect(screen.getByTestId('golive-title').textContent).toBe(title));
    await waitFor(() => expect(screen.queryByText('Checking...')).toBeNull());
    expect(screen.getByTestId('golive-line').textContent).toBe(line);
    expect(screen.queryAllByTestId('golive-gap')).toHaveLength(gapCount);
    const btn = screen.getByTestId('golive-live') as HTMLButtonElement;
    expect(btn.disabled).toBe(disabled);
    if (reason) {
      expect(screen.getByTestId('golive-live-reason').textContent).toBe(reason);
      expect(btn.getAttribute('aria-describedby')).toBe(screen.getByTestId('golive-live-reason').id);
    }
    // never "ready" words together with a "Still to do" list
    expect(screen.queryByTestId('golive-gaps') !== null && screen.getByTestId('golive-line').textContent!.includes('is ready')).toBe(false);
  });

  it('check failed: Go live off with a reason and a Try again that asks again', async () => {
    steps = [];
    const base = rpc.getMockImplementation()!;
    let healthy = false;
    rpc.mockImplementation(async (fn: string, a?: unknown) => {
      if (fn !== 'series_go_live_check_v1') return base(fn, a);
      return !healthy ? { data: null, error: { message: 'boom' } } : { data: checkOf({ ready: true }), error: null };
    });
    mount();
    await waitFor(() => expect(screen.getByTestId('golive-live-reason').textContent).toBe('Could not check. Try again.'), { timeout: 8000 });
    expect((screen.getByTestId('golive-live') as HTMLButtonElement).disabled).toBe(true);
    healthy = true;
    fireEvent.click(screen.getByTestId('golive-check-retry'));
    await waitFor(() => expect((screen.getByTestId('golive-live') as HTMLButtonElement).disabled).toBe(false));
  });

  it('check still loading: Go live off, reads Checking...', async () => {
    steps = [];
    const base = rpc.getMockImplementation()!;
    rpc.mockImplementation((fn: string, a?: unknown) => (fn === 'series_go_live_check_v1' ? new Promise(() => {}) : base(fn, a)));
    mount();
    expect((await screen.findByTestId('golive-live-reason')).textContent).toBe('Checking...');
    expect((screen.getByTestId('golive-live') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('the stale-entity class (organiser answers)', () => {
  it('the next answer is built from the entity as saved, not the one read before the last save', async () => {
    dancerRow = { ...dancerRow, instagram: 'ana.dances', whatsapp: '+44 7700 900123' };
    steps = open([['organiser', 'instagram', false], ['organiser', 'contact_phone', false]]);
    entityState.city = null; // the tab read the page before its city was saved
    entityState.delay = 60;
    saveOrganiser.mockImplementation(async () => { entityState.city = 'c9'; return { kind: 'saved', stored: null, row: null, unmatched: [] }; });
    mount();
    fireEvent.click(await screen.findByTestId('golive-continue'));
    await onQuestion('What is its Instagram?');
    fireEvent.click(screen.getByTestId('golive-use-mine'));
    await onQuestion('What number can dancers call?');
    fireEvent.click(screen.getByTestId('golive-use-mine'));
    await waitFor(() => expect(saveOrganiser).toHaveBeenCalledTimes(2));
    expect((saveOrganiser.mock.calls[1][2] as { city_id: string | null }).city_id).toBe('c9');
  });

  it('an entity read that never answers ends in Try again, not grey bars for good', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      entityState.hang = true;
      mount();
      expect(await screen.findByTestId('golive-loading')).toBeTruthy();
      await vi.advanceTimersByTimeAsync(8100);
      expect(screen.getByTestId('golive-stuck')).toBeTruthy();
      expect(screen.queryByTestId('golive-loading')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
