// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/*
 * Start from a flyer (organiserFlyerReader): the entry shows only with three flags on and the kind
 * step is otherwise unchanged; every reader answer has its own screen and a way forward; the form
 * opens filled in with "check this" marks that clear on edit, a session tick list and the flyer's
 * notes; the flyer is the cover, uploaded only by the normal save; a pre-filled save plans exactly
 * what the same draft typed by hand plans; the 11 reference flyers all hand off.
 */

const rpc = vi.hoisted(() => vi.fn());
const invoke = vi.hoisted(() => vi.fn());
const getSession = vi.hoisted(() => vi.fn());
const upload = vi.hoisted(() => vi.fn());
const reencode = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from: vi.fn(), storage: { from: vi.fn() }, auth: { getSession }, functions: { invoke } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/hooks/useLondonToday', () => ({ useLondonToday: () => '2026-11-08' }));
vi.mock('../../../events/media', () => ({ uploadEventPicture: upload }));
vi.mock('../../../shared/createCity', () => ({ resolveCreateCityId: async () => 'c1' }));
vi.mock('../../../home/onboarding/golive/profileLeft', () => ({ profileQuestionsLeft: async () => false }));
vi.mock('../../../shared/flyerModel', async (orig) => ({ ...(await orig<typeof import('../../../shared/flyerModel')>()), reencodeFlyer: reencode }));

import CreateFlow from '../CreateFlow';
import { flags } from '@/lib/featureFlags';
import { P3_BASE } from '../../shell/paths';
import { DRAFT_STORE_KEY, blankCreate, parseStoredDraft, savePlan, withFirstDate, buildableKind, type CreateDraft } from '../model';
import { applySessionChoices, flyerToDraft } from '../flyerToDraft';
import { classifyFlyerAnswer, flyerHandoff, flyerHandoffFor, forgetFlyerHandoff, resetWords } from '../useFlyerRead';
import { ROWS, TODAY, VENUES, mk } from './flyerReadFixtures';

const page = { id: 'org1', name: 'Latin Nights', slug: null, avatar_url: null, city_id: 'c1', lifecycle_status: 'live', role: 'owner', latest_decision: null, series: [] };
let sent: Array<{ command: { kind: string; payload: Record<string, unknown> } }> = [];
const flagWas = { r: flags.organiserFlyerReader, p: flags.organiserP3, s: flags.organiserSelfServe };
const setFlags = (r: boolean, p = true, s = true) => Object.assign(flags, { organiserFlyerReader: r, organiserP3: p, organiserSelfServe: s });

const ok = (body: unknown) => async () => ({ data: body, error: null });
const refuse = (status: number, body: unknown) => async () => ({ data: null, error: { name: 'FunctionsHttpError', context: new Response(JSON.stringify(body), { status }) } });

beforeEach(() => {
  setFlags(true);
  sent = [];
  forgetFlyerHandoff();
  try { window.sessionStorage.clear(); } catch { /* none */ }
  (window as unknown as { dataLayer: unknown[] }).dataLayer = [];
  Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
  upload.mockReset();
  upload.mockResolvedValue('https://img.example/flyer.webp');
  reencode.mockReset();
  reencode.mockResolvedValue({ blob: new Blob(['flyer'], { type: 'image/webp' }), mime: 'image/webp', ext: 'webp', width: 10, height: 10 });
  getSession.mockReset();
  getSession.mockResolvedValue({ data: { session: { access_token: 'user-token' } } });
  invoke.mockReset();
  rpc.mockReset();
  let landed = 0;
  rpc.mockImplementation(async (fn: string, args: { p_envelope?: (typeof sent)[number] }) => {
    if (fn === 'organiser_home_v1') return { data: { today: TODAY, organisers: [page] }, error: null };
    if (fn === 'get_organiser_venue_options_v1') return { data: VENUES, error: null };
    if (fn === 'series_command_p5') { sent.push(args.p_envelope!); landed += 1; return { data: { ok: true, new_version: landed }, error: null }; }
    return { data: null, error: { message: 'unexpected ' + fn } };
  });
});
afterEach(() => { cleanup(); Object.assign(flags, { organiserFlyerReader: flagWas.r, organiserP3: flagWas.p, organiserSelfServe: flagWas.s }); });

function Where() {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{pathname + search}</output>;
}
function at(path = `${P3_BASE}/create`) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <div className="p3-theme p3-frame">
        <MemoryRouter initialEntries={[path]}>
          <Routes><Route path={`${P3_BASE}/create`} element={<CreateFlow />} /><Route path="*" element={<span data-testid="elsewhere" />} /></Routes>
          <Where />
        </MemoryRouter>
      </div>
    </QueryClientProvider>,
  );
}
const photo = (type = 'image/jpeg') => new File(['x'.repeat(100)], 'flyer.jpg', { type });
async function openFlyer() {
  at();
  fireEvent.click(await screen.findByTestId('p3-new-flyer'));
  return screen.findByTestId('p3-flyer-choose');
}
async function readWith(answer: () => Promise<unknown>, file = photo()) {
  invoke.mockImplementation(answer);
  await openFlyer();
  fireEvent.change(screen.getByTestId('p3-flyer-pick'), { target: { files: [file] } });
}
const stored = (): CreateDraft => parseStoredDraft(window.sessionStorage.getItem(DRAFT_STORE_KEY))!;

describe('the entry and the flags', () => {
  it.each([
    [true, true, true, true], [false, true, true, false], [true, false, true, false], [true, true, false, false], [false, false, false, false],
  ])('reader %s, p3 %s, self-serve %s -> entry %s', async (r, p, s, shown) => {
    setFlags(r, p, s);
    at();
    await screen.findByTestId('p3-new-kinds');
    expect(!!screen.queryByTestId('p3-new-flyer')).toBe(shown);
  });

  it('flag off = the kind step is byte-for-byte the flag-on one without the entry', async () => {
    setFlags(false);
    const off = at();
    await screen.findByTestId('p3-new-kinds');
    const offHtml = off.getByTestId('p3-new-kind').innerHTML;
    cleanup();
    setFlags(true);
    const on = at();
    await screen.findByTestId('p3-new-flyer');
    on.getByTestId('p3-new-flyer').remove();
    expect(on.getByTestId('p3-new-kind').innerHTML).toBe(offHtml);
  });
});

describe('R1: a person with no page (P4)', () => {
  it('no page entry never mounts', async () => {
    rpc.mockImplementation(async (fn: string) => {
      if (fn === 'organiser_home_v1') return { data: { today: TODAY, organisers: [] }, error: null };
      if (fn === 'get_organiser_venue_options_v1') return { data: VENUES, error: null };
      return { data: null, error: { message: 'unexpected ' + fn } };
    });
    at();
    await screen.findByTestId('p3-new-no-page-card');
    expect(screen.queryByTestId('p3-new-flyer')).toBeNull();
    expect(screen.queryByTestId('p3-flyer-choose')).toBeNull();
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe('each reader answer has its screen and a way forward', () => {
  const daily = { error: 'daily_limit', resets_at: '2026-11-09T09:00:00Z' };
  it.each([
    ['daily limit', refuse(429, daily), 'p3-flyer-daily-limit', /Back Monday 09:00/, false],
    ['attempts limit back tomorrow', refuse(429, { error: 'attempts_limit' }), 'p3-flyer-attempts-limit', /Back tomorrow\./, false],
    ['attempts limit back at the reset time', refuse(429, { error: 'attempts_limit', resets_at: '2026-11-09T00:00:00Z' }), 'p3-flyer-attempts-limit', /Back Monday 00:00\./, false],
    ['switched off', refuse(503, { error: 'switched_off' }), 'p3-flyer-switched-off', /paused for now/, false],
    ['not an organiser', refuse(403, { error: 'not_organiser' }), 'p3-flyer-not-organiser', /for organisers/, false],
    ['unauthorised', refuse(401, {}), 'p3-flyer-unauthorised', /sign-in has run out/, false],
    ['bad image', refuse(400, { error: 'bad_image' }), 'p3-flyer-failed', /read that one/, true],
    ['read failed', refuse(502, { error: 'read_failed' }), 'p3-flyer-failed', /read that one/, true],
    ['server error', refuse(500, {}), 'p3-flyer-failed', /read that one/, true],
    ['off-shape answer', ok({ kind: 'nonsense' }), 'p3-flyer-failed', /read that one/, true],
    ['network drop', async () => ({ data: null, error: { name: 'FunctionsFetchError' } }), 'p3-flyer-failed', /read that one/, true],
  ])('%s', async (_n, answer, testId, copy, again) => {
    await readWith(answer);
    const card = await screen.findByTestId(testId);
    expect(card.textContent).toMatch(copy);
    // copy names only controls that are on screen
    if (/fill it in yourself/i.test(card.textContent!)) expect(screen.getByTestId('p3-flyer-blank')).toBeTruthy();
    expect(!!screen.queryByTestId('p3-flyer-pick')).toBe(again);
    fireEvent.click(screen.getByTestId('p3-flyer-blank'));
    expect(screen.getByTestId('p3-new-kinds')).toBeTruthy();
  });

  it('sends the re-encoded photo with the signed-in token, never the anon key', async () => {
    await readWith(ok(ROWS[0].read));
    await waitFor(() => expect(invoke).toHaveBeenCalled());
    const [name, opts] = invoke.mock.calls[0];
    expect(name).toBe('event-flyer-read');
    expect(opts.headers.Authorization).toBe('Bearer user-token');
    expect(opts.body).toEqual({ image: btoa('flyer'), media_type: 'image/webp', today: TODAY });
    expect(reencode).toHaveBeenCalledTimes(1);
  });

  it('no session = unauthorised, nothing sent', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    await readWith(ok(ROWS[0].read));
    await screen.findByTestId('p3-flyer-unauthorised');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('offline: says so, try again and fill it in are there', async () => {
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
    await readWith(ok(ROWS[0].read));
    await screen.findByTestId('p3-flyer-offline');
    expect(screen.getByTestId('p3-flyer-pick')).toBeTruthy();
    expect(invoke).not.toHaveBeenCalled();
  });

  it('a file that is not a photo shows the flyer problem copy', async () => {
    await readWith(ok(ROWS[0].read), photo('application/pdf'));
    const card = await screen.findByTestId('p3-flyer-problem');
    expect(card.querySelector('.p3-error')?.textContent).toBeTruthy();
    expect(invoke).not.toHaveBeenCalled();
  });

  it('reading: one at a time, the pick is off with its reason, Cancel goes back', async () => {
    invoke.mockImplementation(() => new Promise(() => {}));
    await openFlyer();
    fireEvent.change(screen.getByTestId('p3-flyer-pick'), { target: { files: [photo()] } });
    await screen.findByTestId('p3-flyer-reading');
    const pick = screen.getByTestId('p3-flyer-pick') as HTMLInputElement;
    expect(pick.disabled).toBe(true);
    expect(pick.getAttribute('aria-describedby')).toBe('p3-flyer-pick-why');
    expect(screen.getByTestId('p3-flyer-pick-why').textContent).toMatch(/One flyer at a time/);
    fireEvent.click(screen.getByTestId('p3-flyer-cancel'));
    expect(screen.getByTestId('p3-flyer-choose')).toBeTruthy();
  });

  it('not enough: says what was found, and Use what we found opens the form', async () => {
    await readWith(ok(mk({ kind: 'not_enough', title: 'Mystery Night' })));
    const card = await screen.findByTestId('p3-flyer-not-enough');
    expect(card.textContent).toMatch(/Name: Mystery Night/);
    fireEvent.click(screen.getByTestId('p3-flyer-use'));
    await screen.findByTestId('p3-new-form');
    expect(screen.getByTestId('p3-new-flyer-note-not_enough')).toBeTruthy();
  });
});

describe('the hand-off to the form', () => {
  it('a good read opens the form of the flyer’s kind, with its notes', async () => {
    await readWith(ok(ROWS[0].read)); // weekly Saturday
    await screen.findByTestId('p3-new-form');
    expect(screen.getByTestId('where').textContent).toMatch(/kind=weekly/);
    expect(screen.getByTestId('p3-new-flyer-note-repeats')).toBeTruthy();
    expect((screen.getByTestId('p3-new-name') as HTMLInputElement).value).toBe('Salsa Saturdays');
    expect(stored().venue?.id).toBe('v-ritz');
    expect(screen.getByTestId('p3-new-cover-picked').textContent).toMatch(/flyer\.jpg/);
  });

  it('doubtful marks show, Flyer says shows, and a mark clears on edit', async () => {
    await readWith(ok(ROWS[1].read)); // past Halloween, venue not matched
    await screen.findByTestId('p3-new-form');
    expect(screen.getByTestId('p3-new-check-firstDate')).toBeTruthy();
    expect(screen.getByTestId('p3-new-check-venue')).toBeTruthy();
    expect(screen.getByTestId('p3-new-venue-said').textContent).toBe('Flyer says: Nowhere Hall');
    expect(screen.getByTestId('p3-new-flyer-note-past_date')).toBeTruthy();
    fireEvent.change(screen.getByTestId('p3-new-first'), { target: { value: '2026-11-21' } });
    await waitFor(() => expect(screen.queryByTestId('p3-new-check-firstDate')).toBeNull());
    expect(screen.getByTestId('p3-new-check-venue')).toBeTruthy();
  });

  it('the tick list adds only the ticked sessions', async () => {
    await readWith(ok(ROWS[3].read)); // weekly, Room 1 + Room 2
    await screen.findByTestId('p3-new-ticks');
    expect(stored().sessions.map((s) => s.title)).toEqual(['Room 1', 'Room 2']);
    fireEvent.click(screen.getByTestId('p3-new-tick-s1'));
    await waitFor(() => expect(stored().sessions.map((s) => s.title)).toEqual(['Room 1']));
  });

  it('several events: the note says so', async () => {
    await readWith(ok(ROWS[2].read));
    await screen.findByTestId('p3-new-form');
    expect(screen.getByTestId('p3-new-flyer-note-many_events')).toBeTruthy();
  });

  it('save: the flyer is uploaded by the normal save, and only field names are recorded', async () => {
    await readWith(ok(ROWS[5].read)); // Double Bill, Thames Boat, 2026-11-20
    await screen.findByTestId('p3-new-form');
    fireEvent.change(screen.getByTestId('p3-new-name'), { target: { value: 'Double Bill Live' } });
    expect(upload).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByTestId('p3-new-save-draft')); });
    await waitFor(() => expect(upload).toHaveBeenCalled());
    expect((upload.mock.calls[0][1] as File).name).toBe('flyer.jpg');
    const ev = (window as unknown as { dataLayer: Array<Record<string, unknown>> }).dataLayer.find((e) => e.event === 'flyer_read_saved');
    expect(ev).toEqual({ event: 'flyer_read_saved', flyer_read_filled: ['name', 'venue', 'firstDate', 'sessions'], flyer_read_changed: ['name'] });
    expect(JSON.stringify(ev)).not.toMatch(/Double Bill|Thames/);
  });

  it('leaving without saving forgets the flyer', async () => {
    await readWith(ok(ROWS[5].read));
    await screen.findByTestId('p3-new-form');
    const sid = stored().seriesId;
    expect(flyerHandoffFor(sid)).not.toBeNull();
    fireEvent.click(screen.getByTestId('p3-new-cancel'));
    fireEvent.click(await screen.findByTestId('p3-new-leave-discard'));
    expect(flyerHandoffFor(sid)).toBeNull();
    expect(upload).not.toHaveBeenCalled();
  });
});

describe('the 11 reference flyers through the hand-off', () => {
  const input = { organiserId: 'org1', today: TODAY, hasCover: true, coverUrl: null, cityId: 'c1', goLive: false };
  it.each(ROWS.map((r) => [r.n, r] as const))('%s', (_n, row) => {
    const result = flyerToDraft(row.read, VENUES, TODAY);
    const { draft, handoff } = flyerHandoff(result, photo());
    expect(buildableKind(draft.kind)).not.toBeNull();
    expect(parseStoredDraft(JSON.stringify(draft))).not.toBeNull();
    expect(handoff.doubtful).toEqual(result.doubtful);
    // the same draft typed by hand plans exactly the same commands
    let hand = { ...blankCreate(draft.kind, draft.seriesId), name: draft.name, venue: draft.venue, prices: draft.prices, ticketUrl: draft.ticketUrl, pay: draft.pay };
    if (draft.firstDate) hand = withFirstDate(hand, draft.firstDate);
    hand = { ...hand, extraDates: draft.extraDates };
    hand = applySessionChoices(hand, result.sessionChoices);
    expect(savePlan(draft, input)).toEqual(savePlan(hand, input));
  });
});

describe('pure parts', () => {
  it('resetWords: full weekday, London time', () => {
    expect(resetWords('2026-11-09T09:00:00Z')).toBe('Monday 09:00');
    expect(resetWords('2026-07-06T08:30:00Z')).toBe('Monday 09:30');
    expect(resetWords('nope')).toBeNull();
    expect(resetWords(null)).toBeNull();
  });
  it('classifyFlyerAnswer', () => {
    expect(classifyFlyerAnswer(null, null, false)).toEqual({ kind: 'offline' });
    expect(classifyFlyerAnswer(null, null, true)).toEqual({ kind: 'error' });
    expect(classifyFlyerAnswer(200, { read: ROWS[0].read }, true)).toEqual({ kind: 'read', read: ROWS[0].read });
    expect(classifyFlyerAnswer(429, { reason: 'daily_limit', resets_at: 'x' }, true)).toEqual({ kind: 'refused', reason: 'daily_limit', resetsAt: 'x' });
  });
});

describe('review fixes D1, D2, D5, D7', () => {
  const coverSent = () => sent.some((e) => 'default_cover_image_url' in (e.command.payload ?? {}));

  it('D1: Remove photo drops the flyer cover, and saving then sends no cover', async () => {
    await readWith(ok(ROWS[5].read));
    await screen.findByTestId('p3-new-form');
    expect(screen.getByTestId('p3-new-cover-picked')).toBeTruthy();
    const remove = screen.getByTestId('p3-new-cover-remove');
    expect(remove.textContent).toBe('Remove photo');
    expect(remove.className).toMatch(/p3-new-file/); // the 48px tap class
    fireEvent.click(remove);
    expect(screen.queryByTestId('p3-new-cover-picked')).toBeNull();
    expect(screen.queryByTestId('p3-new-cover-remove')).toBeNull();
    expect(screen.getByTestId('p3-new-cover-label').textContent).toMatch(/Add a photo/);
    await act(async () => { fireEvent.click(screen.getByTestId('p3-new-save-draft')); });
    await waitFor(() => expect(sent.length).toBeGreaterThan(0));
    expect(upload).not.toHaveBeenCalled();
    expect(coverSent()).toBe(false);
  });

  it('D1 control: without Remove the same save does send the cover', async () => {
    await readWith(ok(ROWS[5].read));
    await screen.findByTestId('p3-new-form');
    await act(async () => { fireEvent.click(screen.getByTestId('p3-new-save-draft')); });
    await waitFor(() => expect(coverSent()).toBe(true));
  });

  it('D2: a venue list that never settles: after the wait, continue without venue matching and say so', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const base = rpc.getMockImplementation()!;
      rpc.mockImplementation(async (fn: string, args: never) => (fn === 'get_organiser_venue_options_v1' ? new Promise(() => {}) : base(fn, args)));
      await readWith(ok(ROWS[0].read)); // The Ritz Club, which would match
      await screen.findByTestId('p3-flyer-reading');
      await act(async () => { vi.advanceTimersByTime(8050) /* the 8 s venue wait */; });
      await screen.findByTestId('p3-new-form');
      expect(screen.getByTestId('p3-new-flyer-note-no_venue_match').textContent).toMatch(/without venue matching/);
      expect(stored().venue).toBeNull();
      expect(screen.getByTestId('p3-new-venue-said').textContent).toMatch(/^Flyer says: The Ritz Club/);
    } finally {
      vi.useRealTimers();
    }
  });

  it('D5: the daily-limit title names no number', async () => {
    await readWith(refuse(429, { error: 'daily_limit' }));
    const card = await screen.findByTestId('p3-flyer-daily-limit');
    expect(card.textContent).toMatch(/today’s flyer reads/);
    expect(card.textContent).not.toMatch(/\d+ flyer reads/);
  });

  it('D7: the not-enough title names only what is missing', async () => {
    const dated = [{ date_start: '2026-12-04', date_end: null, year_printed: true, weekday_printed: null, recurrence_text: null }];
    await readWith(ok(mk({ kind: 'not_enough', dates: dated, venue_name: 'The Ritz Club' })));
    const card = await screen.findByTestId('p3-flyer-not-enough');
    expect(card.querySelector('h2,h3,strong')?.textContent ?? card.textContent).toMatch(/missing a name/);
    expect(card.textContent).not.toMatch(/date and venue/);
  });

  it('D7: a flyer with nothing on it names all three, and never says date and venue alone', async () => {
    await readWith(ok(mk({ kind: 'not_enough', title: 'Mystery Night' })));
    expect((await screen.findByTestId('p3-flyer-not-enough')).textContent).toMatch(/missing a date, a venue/);
  });
});
