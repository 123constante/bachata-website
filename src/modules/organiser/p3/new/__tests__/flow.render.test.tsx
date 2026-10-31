// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/*
 * p3-create slice 1: P3's New event, rendered. 0 / 1 / 2+ pages, the kind picker, the form, an
 * untouched save (nothing sent), a draft, going live (the fixed order, versions chained), the
 * onboarding refusal (organiser_onboarding_gate on) against success (off), a failure midway
 * (Open the draft / Discard it / Try again), venue not found, and Cancel. Copy never points at a
 * control that is not on screen.
 */

const rpc = vi.hoisted(() => vi.fn());
const upload = vi.hoisted(() => vi.fn());
const profileLeft = vi.hoisted(() => ({ value: false }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from: vi.fn(), storage: { from: vi.fn() } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/hooks/useLondonToday', () => ({ useLondonToday: () => '2026-11-02' }));
vi.mock('../../../events/media', () => ({ uploadEventPicture: upload }));
vi.mock('../../../shared/createCity', () => ({ resolveCreateCityId: async () => 'c1' }));
vi.mock('../../../home/onboarding/golive/profileLeft', () => ({ profileQuestionsLeft: async () => profileLeft.value }));

import CreateFlow from '../CreateFlow';
import { P3_BASE, P3_PATHS, p3StartReview } from '../../shell/paths';
import { COPY, RESULT_COPY } from '../model';
import { rawWorkspace } from '../../../events/__tests__/fixtures';
import { ONBOARDING_REFUSAL } from '../../../shared/selfServeErrors';

const page = (id: string, name: string, lifecycle = 'live') => ({ id, name, slug: null, avatar_url: null, city_id: 'c1', lifecycle_status: lifecycle, role: 'owner', latest_decision: null, series: [] });
const VENUES = [
  { id: 'v1', name: 'Studio One', neighbourhood: 'Soho', city_name: 'London', address: null, postcode: null },
  { id: 'v2', name: 'Salsa Hall', neighbourhood: 'Leith', city_name: 'Edinburgh', address: null, postcode: null },
];

let pages: ReturnType<typeof page>[] = [];
let commandFails: (env: { command: { kind: string } }, n: number) => { message: string } | null = () => null;
/** Commands the server took (the series' version); 0 = no row yet. */
let landed = 0;
let sent: Array<{ target_id: string; expected_version?: number; idempotency_key: string; command: { kind: string; payload: Record<string, unknown> } }> = [];

beforeEach(() => {
  pages = [page('org1', 'Latin Nights')];
  commandFails = () => null;
  sent = [];
  landed = 0;
  profileLeft.value = false;
  upload.mockReset();
  upload.mockResolvedValue('https://img.example/cover.jpg');
  try { window.sessionStorage.clear(); } catch { /* none */ }
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string, args: { p_envelope?: (typeof sent)[number] }) => {
    if (fn === 'organiser_home_v1') return { data: { today: '2026-11-02', organisers: pages }, error: null };
    if (fn === 'get_organiser_venue_options_v1') return { data: VENUES, error: null };
    // the series as the server has it now (a retry reads its version again): one version per command that landed
    if (fn === 'admin_event_workspace_p5') {
      return landed ? { data: rawWorkspace({ id: (args as { p_series_id?: string }).p_series_id, lifecycle_status: 'draft', version: landed }, []), error: null } : { data: null, error: { message: 'not found' } };
    }
    if (fn === 'series_command_p5') {
      const env = args.p_envelope!;
      sent.push(env);
      const fail = commandFails(env, sent.length);
      if (fail) return { data: null, error: fail };
      landed += 1;
      return { data: { ok: true, new_version: landed }, error: null };
    }
    return { data: null, error: { message: 'unexpected ' + fn } };
  });
});
afterEach(cleanup);

function Where() {
  const { pathname, search, state } = useLocation();
  return <output data-testid="where" data-toast={(state as { p3Toast?: string } | null)?.p3Toast ?? ''}>{pathname + search}</output>;
}

function at(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <div className="p3-theme p3-frame" data-testid="p3-shell">
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={`${P3_BASE}/create`} element={<CreateFlow />} />
            <Route path="*" element={<span data-testid="elsewhere" />} />
          </Routes>
          <Where />
        </MemoryRouter>
      </div>
    </QueryClientProvider>,
  );
}
const where = () => screen.getByTestId('where').textContent;
const form = (kind: string, o: string | null = null) => P3_PATHS.createStep('form', kind, o);

/** Every link and every control a line of copy names is on screen (the "points at a missing control" guard). */
function namedControlsOnScreen(text: string) {
  const names: Array<[RegExp, string]> = [
    [/Skip for now/, 'Skip for now'], [/Save draft/, 'Save draft'], [/Try again/, 'Try again'], [/open Help|Open Help/, 'Open Help'],
    [/Open the draft|open the draft/, 'Open the draft'], [/discard it|Discard it/, 'Discard it'], [/tap Add/, 'Add'],
  ];
  for (const [re, label] of names) {
    if (re.test(text)) expect(screen.getAllByText(label, { exact: true }).length, `"${label}" is named but not on screen`).toBeGreaterThan(0);
  }
}

describe('0 / 1 / 2+ pages', () => {
  it('no page: says to set one up, and the link goes to P3 onboarding', async () => {
    pages = [];
    at(P3_PATHS.create);
    const card = await screen.findByTestId('p3-new-no-page-card');
    expect(within(card).getByRole('link', { name: 'Set up my page' }).getAttribute('href')).toBe(P3_PATHS.start);
    expect(screen.getByTestId('org-back').getAttribute('href')).toBe(P3_PATHS.events);
  });

  it('one page: kind -> the form; deferred kinds are off with "Coming soon"', async () => {
    at(P3_PATHS.create);
    await screen.findByTestId('p3-new-kinds');
    expect(screen.getByTestId('org-back').getAttribute('href')).toBe(P3_PATHS.events);
    for (const k of ['course', 'festival', 'online']) {
      const b = screen.getByTestId(`p3-new-kind-${k}`) as HTMLButtonElement;
      expect(b.disabled).toBe(true);
      expect(document.getElementById(b.getAttribute('aria-describedby')!)!.textContent).toBe('Coming soon');
    }
    fireEvent.click(screen.getByTestId('p3-new-kind-weekly'));
    expect(where()).toBe(form('weekly'));
  });

  it('two pages: kind -> which page -> the form for that page; Back from the form is the page step', async () => {
    pages = [page('org1', 'Latin Nights'), page('org2', 'Bachata Lab')];
    at(P3_PATHS.create);
    fireEvent.click(await screen.findByTestId('p3-new-kind-monthly'));
    expect(where()).toBe(P3_PATHS.createStep('page', 'monthly', null));
  });

  it('two pages: the page step picks, Continue opens the form with ?o=', async () => {
    pages = [page('org1', 'Latin Nights'), page('org2', 'Bachata Lab')];
    at(P3_PATHS.createStep('page', 'monthly', null));
    const rows = await screen.findAllByTestId('p3-new-page-row');
    fireEvent.click(rows[1]);
    fireEvent.click(screen.getByTestId('p3-new-page-continue'));
    expect(where()).toBe(form('monthly', 'org2'));
  });

  it('two pages: the form without a page goes back to the page question', async () => {
    pages = [page('org1', 'Latin Nights'), page('org2', 'Bachata Lab')];
    at(form('weekly'));
    await waitFor(() => expect(where()).toBe(P3_PATHS.createStep('page', 'weekly', null)));
  });

  it('two pages: the form keeps Back to the page step (inside P3)', async () => {
    pages = [page('org1', 'Latin Nights'), page('org2', 'Bachata Lab')];
    at(form('weekly', 'org2'));
    await screen.findByTestId('p3-new-name');
    expect(screen.getByTestId('org-back').getAttribute('href')).toBe(P3_PATHS.createStep('page', 'weekly', 'org2'));
  });

  it('a page that is not live: says why and links to the page', async () => {
    pages = [page('org1', 'Latin Nights', 'pending_review')];
    at(form('one_date'));
    const card = await screen.findByTestId('p3-new-blocked-card');
    expect(within(card).getByRole('link', { name: 'See my page' }).getAttribute('href')).toBe(P3_PATHS.youPage);
  });

  it('a deferred kind in the URL goes back to the kind picker', async () => {
    at(form('festival'));
    await waitFor(() => expect(where()).toBe(P3_PATHS.create));
  });

  // review r1 F6: the other two fall-throughs of buildableKind
  it('an unknown kind in the URL goes back to the kind picker', async () => {
    at(form('rave'));
    await waitFor(() => expect(where()).toBe(P3_PATHS.create));
  });

  it('at=form with no kind goes back to the kind picker', async () => {
    at(`${P3_PATHS.create}?at=form`);
    await waitFor(() => expect(where()).toBe(P3_PATHS.create));
  });
});

describe('the form: untouched sends nothing, Cancel, disabled says why', () => {
  it('untouched: Save draft and Go live are off with their reasons; Cancel goes straight to Events; nothing sent', async () => {
    at(form('one_date'));
    await screen.findByTestId('p3-new-name');
    const draft = screen.getByTestId('p3-new-save-draft') as HTMLButtonElement;
    const live = screen.getByTestId('p3-new-go-live') as HTMLButtonElement;
    expect(draft.disabled && live.disabled).toBe(true);
    expect(screen.getByTestId('p3-new-draft-why').textContent).toBe(COPY.nameFirst);
    expect(screen.getByTestId('p3-new-live-why').textContent).toMatch(/^Go live needs a name, where it is, the first date, a start and end on every session, a photo and how dancers pay\.$/);
    fireEvent.click(draft);
    fireEvent.click(live);
    fireEvent.click(screen.getByTestId('p3-new-cancel'));
    expect(where()).toBe(P3_PATHS.events);
    expect(sent).toEqual([]);
  });

  it('typed something: Cancel asks; Keep going stays; Leave without saving goes to Events and sends nothing', async () => {
    at(form('one_date'));
    fireEvent.change(await screen.findByTestId('p3-new-name'), { target: { value: 'Salsa Sunday' } });
    fireEvent.click(screen.getByTestId('p3-new-cancel'));
    const sheet = screen.getByTestId('p3-sheet');
    namedControlsOnScreen(sheet.textContent ?? '');
    fireEvent.click(within(sheet).getByTestId('p3-new-keep-going'));
    expect(screen.queryByTestId('p3-sheet')).toBeNull();
    fireEvent.click(screen.getByTestId('p3-new-cancel'));
    fireEvent.click(screen.getByTestId('p3-new-leave-discard'));
    expect(where()).toBe(P3_PATHS.events);
    expect(sent).toEqual([]);
  });
});

async function fillWeekly() {
  at(form('weekly'));
  fireEvent.change(await screen.findByTestId('p3-new-name'), { target: { value: 'Friday Bachata' } });
  fireEvent.click(screen.getByTestId('p3-new-row-venue'));
  fireEvent.change(screen.getByTestId('p3-new-venue-search'), { target: { value: 'studio' } });
  fireEvent.click(await screen.findByTestId('p3-new-venue-row'));
  fireEvent.change(screen.getByTestId('p3-new-first'), { target: { value: '2026-11-06' } });
  fireEvent.click(screen.getByTestId('p3-new-row-sessions'));
  fireEvent.change(screen.getByTestId('p3-new-sess-start'), { target: { value: '19:00' } });
  fireEvent.change(screen.getByTestId('p3-new-sess-end'), { target: { value: '20:00' } });
  fireEvent.click(screen.getByTestId('p3-new-sess-done'));
  fireEvent.click(screen.getByTestId('p3-new-row-price'));
  fireEvent.click(screen.getByTestId('p3-new-pay-door'));
  fireEvent.click(screen.getByTestId('p3-new-price-done'));
  fireEvent.change(screen.getByTestId('p3-new-cover-input'), { target: { files: [new File(['x'], 'flyer.jpg', { type: 'image/jpeg' })] } });
}

describe('saving: the fixed order, the versions chained, one key per step', () => {
  it('a name only saves a draft: the create (no version), then the sessions at its version; lands on the event page', async () => {
    at(form('one_date'));
    fireEvent.change(await screen.findByTestId('p3-new-name'), { target: { value: 'Salsa Sunday' } });
    expect(screen.getByTestId('p3-new-live-why').textContent).toContain('Save draft works now.');
    fireEvent.click(screen.getByTestId('p3-new-save-draft'));
    await waitFor(() => expect(where()).toMatch(/^\/account\/p3\/events\//));
    expect(sent.map((e) => e.command.kind)).toEqual(['series.upsert', 'series.set_program']);
    expect(sent[0].expected_version).toBeUndefined();
    expect(sent[0].command.payload).toMatchObject({ name: 'Salsa Sunday', format: 'one_off', [['organiser', 'ids'].join('_')]: ['org1'] });
    expect(sent[1].expected_version).toBe(1);
    expect(sent.every((e) => e.target_id === sent[0].target_id)).toBe(true);
    expect(where()).toBe(P3_PATHS.event(sent[0].target_id));
    expect(screen.getByTestId('where').getAttribute('data-toast')).toBe(RESULT_COPY.savedDraft);
    expect(upload).not.toHaveBeenCalled();
  });

  it('weekly, go live (gate off = success): photo, create, repeat, sessions, live, in that order', async () => {
    await fillWeekly();
    const live = screen.getByTestId('p3-new-go-live') as HTMLButtonElement;
    expect(live.disabled).toBe(false);
    fireEvent.click(live);
    await waitFor(() => expect(where()).toMatch(/^\/account\/p3\/events\//));
    const id = sent[0].target_id;
    expect(upload).toHaveBeenCalledWith(id, expect.any(File));
    expect(sent.map((e) => e.command.kind)).toEqual(['series.upsert', 'series.set_recurrence', 'series.set_program', 'series.set_lifecycle']);
    expect(sent.map((e) => e.expected_version)).toEqual([undefined, 1, 2, 3]);
    expect(sent[0].command.payload).toMatchObject({
      format: 'recurring', default_start_date: '2026-11-06', default_venue_id: 'v1', default_city_id: 'c1',
      default_cover_image_url: 'https://img.example/cover.jpg', payment_methods: 'door',
    });
    expect(sent[0].command.payload).not.toHaveProperty('default_local_start_time');
    expect(sent[1].command.payload).toMatchObject({ mode: 'weekly', weekdays: [5], end: { kind: 'none' } });
    expect(sent[3].command.payload).toEqual({ to: 'live' });
    expect(new Set(sent.map((e) => e.idempotency_key)).size).toBe(4);
    expect(screen.getByTestId('where').getAttribute('data-toast')).toBe(RESULT_COPY.live);
  });

  it('profile questions left: the draft saves, going live is not sent, and the next step is P3\u2019s Review', async () => {
    profileLeft.value = true;
    await fillWeekly();
    fireEvent.click(screen.getByTestId('p3-new-go-live'));
    const card = await screen.findByTestId('p3-new-details');
    expect(sent.map((e) => e.command.kind)).toEqual(['series.upsert', 'series.set_recurrence', 'series.set_program']);
    expect(within(card).getByTestId('p3-new-details-go').getAttribute('href')).toBe(p3StartReview('org1'));
    expect(within(card).getByTestId('p3-new-open').getAttribute('href')).toBe(P3_PATHS.event(sent[0].target_id));
  });

  it('gate on (onboarding refusal): nothing saved, the existing copy, a link to finish the details', async () => {
    commandFails = () => ({ message: 'onboarding_incomplete' });
    at(form('one_date'));
    fireEvent.change(await screen.findByTestId('p3-new-name'), { target: { value: 'Salsa Sunday' } });
    fireEvent.click(screen.getByTestId('p3-new-save-draft'));
    const card = await screen.findByTestId('p3-new-onboarding-error');
    expect(card.textContent).toContain(ONBOARDING_REFUSAL);
    expect(within(card).getByRole('link', { name: 'Finish your details' }).getAttribute('href')).toBe(p3StartReview('org1'));
    expect(sent.length).toBe(1);
    expect((screen.getByTestId('p3-new-name') as HTMLInputElement).value).toBe('Salsa Sunday');
    expect(screen.queryByTestId('p3-new-discard')).toBeNull();
  });

  it('another refusal before the create (the 20-a-day limit): The event was not saved, Try again', async () => {
    commandFails = (_e, n) => (n === 1 ? { message: 'rate_limited: too many creates' } : null);
    at(form('one_date'));
    fireEvent.change(await screen.findByTestId('p3-new-name'), { target: { value: 'Salsa Sunday' } });
    fireEvent.click(screen.getByTestId('p3-new-save-draft'));
    const card = await screen.findByTestId('p3-new-failed-error');
    expect(card.textContent).toContain(RESULT_COPY.nothingSaved);
    namedControlsOnScreen(card.textContent ?? '');
    fireEvent.click(within(card).getByText('Try again'));
    await waitFor(() => expect(where()).toMatch(/^\/account\/p3\/events\//));
    // the retry is the same write: same key for the create
    expect(sent[1].idempotency_key).toBe(sent[0].idempotency_key);
  });
});

describe('failure midway: the draft exists, the screen says what did not save and every way out', () => {
  it('sessions fail: Not saved yet names them; Try again resends only them with the same key; Open goes to the draft', async () => {
    let failSessions = true;
    commandFails = (e) => (failSessions && e.command.kind === 'series.set_program' ? { message: 'Failed to fetch' } : null);
    await fillWeekly();
    fireEvent.click(screen.getByTestId('p3-new-save-draft'));
    const card = await screen.findByTestId('p3-new-partial-error');
    expect(screen.getByTestId('p3-new-partial-left').textContent).toBe('Not saved yet: the sessions.');
    namedControlsOnScreen(card.textContent ?? '');
    expect(within(card).getByTestId('p3-new-open').getAttribute('href')).toBe(P3_PATHS.event(sent[0].target_id));
    const firstKey = sent[2].idempotency_key;
    failSessions = false;
    fireEvent.click(within(card).getByTestId('p3-new-retry'));
    await waitFor(() => expect(where()).toMatch(/^\/account\/p3\/events\//));
    expect(sent.map((e) => e.command.kind)).toEqual(['series.upsert', 'series.set_recurrence', 'series.set_program', 'series.set_program']);
    expect(sent[3].idempotency_key).toBe(firstKey);
    expect(sent[3].expected_version).toBe(2);
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('Discard it archives the draft at its version and goes to Events', async () => {
    commandFails = (e) => (e.command.kind === 'series.set_recurrence' ? { message: 'Failed to fetch' } : null);
    await fillWeekly();
    fireEvent.click(screen.getByTestId('p3-new-go-live'));
    await screen.findByTestId('p3-new-partial-error');
    expect(screen.getByTestId('p3-new-partial-left').textContent).toBe('Not saved yet: how it repeats, the sessions and going live.');
    fireEvent.click(screen.getByTestId('p3-new-discard'));
    await waitFor(() => expect(where()).toBe(P3_PATHS.events));
    const last = sent[sent.length - 1];
    expect(last.command).toEqual({ kind: 'series.set_lifecycle', payload: { to: 'archived' } });
    expect(last.target_id).toBe(sent[0].target_id);
    expect(last.expected_version).toBe(1);
  });
});

describe('the sheets', () => {
  it('venue not found: says what to do, and every control it names is there (Skip for now, Open Help)', async () => {
    at(form('weekly'));
    fireEvent.click(await screen.findByTestId('p3-new-row-venue'));
    fireEvent.change(screen.getByTestId('p3-new-venue-search'), { target: { value: 'salsa lab' } });
    const none = await screen.findByTestId('p3-new-venue-none');
    expect(none.textContent).toContain('No venue matches \u201csalsa lab\u201d');
    namedControlsOnScreen(none.textContent ?? '');
    expect(within(none).getByTestId('p3-new-venue-help').getAttribute('href')).toBe(P3_PATHS.youHelp);
    fireEvent.click(screen.getByTestId('p3-new-venue-skip'));
    expect(screen.queryByTestId('p3-sheet')).toBeNull();
    expect(screen.getByTestId('p3-new-row-venue').textContent).toContain('Not set');
  });

  it('repeat: the P3 editor, the 31st warning, the problem in words', async () => {
    at(form('monthly'));
    fireEvent.change(await screen.findByTestId('p3-new-first'), { target: { value: '2026-12-31' } });
    fireEvent.click(screen.getByTestId('p3-new-row-repeat'));
    expect(screen.getByTestId('p3-repeat-editor')).toBeTruthy();
    fireEvent.click(screen.getByText('On a date'));
    expect(screen.getByTestId('p3-new-repeat-warn').textContent).toBe('Not every month has a 31st. Those months get no date.');
    fireEvent.click(screen.getByTestId('p3-new-repeat-done'));
    expect(screen.queryByTestId('p3-new-when-problem')).toBeNull();
  });

  it('sessions: none yet says what to do; end equal to start is named beside Save', async () => {
    at(form('one_date'));
    fireEvent.click(await screen.findByTestId('p3-new-row-sessions'));
    fireEvent.change(screen.getByTestId('p3-new-sess-start'), { target: { value: '20:00' } });
    fireEvent.change(screen.getByTestId('p3-new-sess-end'), { target: { value: '20:00' } });
    expect(screen.getByTestId('p3-new-sess-problem').textContent).toMatch(/end time/);
    fireEvent.click(screen.getByTestId('p3-new-sess-remove'));
    expect(screen.getByTestId('p3-new-sess-empty').textContent).toContain('Add one with its start and end');
    expect(screen.getByTestId('p3-new-sess-add')).toBeTruthy();
  });

  it('a photo that is too big says so and keeps the old one off', async () => {
    at(form('one_date'));
    const big = new File(['x'], 'big.jpg', { type: 'image/jpeg' });
    Object.defineProperty(big, 'size', { value: 30 * 1024 * 1024 });
    fireEvent.change(await screen.findByTestId('p3-new-cover-input'), { target: { files: [big] } });
    expect(screen.getByTestId('p3-new-cover-error').textContent).toMatch(/too big/);
  });

  it('other dates: none yet says how; Add is off until a date is picked, with why', async () => {
    at(form('other_dates'));
    expect((await screen.findByTestId('p3-new-dates-empty')).textContent).toContain(COPY.noDates);
    const add = screen.getByTestId('p3-new-add-date-go') as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    namedControlsOnScreen(document.getElementById(add.getAttribute('aria-describedby')!)!.textContent ?? '');
    fireEvent.change(screen.getByTestId('p3-new-add-date'), { target: { value: '2026-11-21' } });
    fireEvent.click(add);
    fireEvent.change(screen.getByTestId('p3-new-add-date'), { target: { value: '2026-11-07' } });
    fireEvent.click(add);
    expect(screen.getAllByTestId('p3-new-date').map((x) => x.textContent)).toEqual(['Saturday 7 NovemberRemove', 'Saturday 21 NovemberRemove']);
  });
});
