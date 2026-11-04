// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { SHAPES } from './wsFixtures';
import { heldRefusal } from '../../onboarding/gateRule';
import { closeGate, getGate, subscribeGate } from '../../onboarding/gate';
import { GATE_COPY, gateView } from '../../onboarding/gateModel';
import { KEPT_BACK_STATE, KEPT_COPY, keptDraft } from '../../onboarding/keptDraft';
import { thingsLeft } from '../../onboarding/graceModel';

/*
 * Brief p3-gate-retry-1 (F-13, decision "F-13 b"): ONE count, edit screens open, the gate sheet at Save.
 * One table: person type (P) x journey (J) x data shape (S) -> locked or open, the count text shown on the
 * edit screen (none: the ONE count is the gate sheet's "things left"), the sheet shown or not, what was sent,
 * and where the person ends up. Real screens and send path (DetailsScreen / PricesScreen -> useSaveRun ->
 * series_command_p5); only supabase.rpc and the two side reads the OLD lock used (admin check, profile
 * progress) are stood in for, so the rows prove those reads no longer decide anything.
 * Red first: the P1/P3a/P4/P8 "open" rows fail on main 8c60541 (the up-front "answers left" lock).
 */

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, auth: {}, from: vi.fn() } }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-25' }));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ isPending: true, data: undefined }) }));
vi.mock('@/lib/city-canonical', () => ({ resolveCanonicalCity: async () => ({ cityId: 'city-9' }) }));
const who = vi.hoisted(() => ({ admin: false, progress: { publishReady: true, requiredLeft: 0 } as unknown, progressFailed: false }));
vi.mock('@/hooks/useIsAdmin', () => ({ useIsAdmin: () => ({ isAdmin: who.admin, isPending: false }) }));
vi.mock('../../../shared/profileProgress', async (orig) => ({
  ...(await orig<typeof import('../../../shared/profileProgress')>()),
  useProfileProgress: () => (who.progressFailed ? { data: undefined, isError: true } : { data: who.progress }),
}));
vi.mock('../../../shared/publicVenues', async (orig) => ({
  ...(await orig<typeof import('../../../shared/publicVenues')>()),
  useVenueOptions: () => ({ isPending: false, isError: false, data: [] }),
}));

import { EventPage } from '../EventPage';
import { DetailsScreen } from '../DetailsScreen';
import { PricesScreen } from '../PricesScreen';

type Raw = Record<string, unknown>;
const REFUSAL = { code: 'P0001', ...heldRefusal('o1'), hint: 'Finish your details' };
const DENIED = { code: 'P0001', message: 'permission_denied' };

/** Person types. `refused` = what _require_onboarding_complete_v1 does for them with the gate ON (read on prod 2026-11-04). */
type Person = { id: string; what: string; admin: boolean; ready: boolean; left: number; refusedWhenOn: boolean; denied?: boolean; progressFailed?: boolean };
const PEOPLE: Person[] = [
  { id: 'P1', what: 'owner, unfinished page', admin: false, ready: false, left: 3, refusedWhenOn: true },
  { id: 'P2', what: 'owner, finished page', admin: false, ready: true, left: 0, refusedWhenOn: false },
  { id: 'P3a', what: 'owner of two pages, event on the unfinished one', admin: false, ready: false, left: 6, refusedWhenOn: true },
  { id: 'P3b', what: 'owner of two pages, event on the finished one', admin: false, ready: true, left: 0, refusedWhenOn: false },
  { id: 'P4', what: 'admin (profile unfinished: never held)', admin: true, ready: false, left: 10, refusedWhenOn: false },
  { id: 'P5', what: 'manager who may not edit', admin: false, ready: false, left: 1, refusedWhenOn: true, denied: true },
  { id: 'P6', what: 'contributor who may not edit', admin: false, ready: false, left: 1, refusedWhenOn: true, denied: true },
  { id: 'P8', what: 'status read failed', admin: false, ready: false, left: 3, refusedWhenOn: true, progressFailed: true },
];

let sends: Raw[] = [];
let router: ReturnType<typeof createMemoryRouter>;
function serve(p: Person, gateOn: boolean, shape: Raw = SHAPES.weekly) {
  sends = [];
  rpc.mockImplementation(async (name: string, args: Raw) => {
    if (name === 'admin_event_workspace_p5') return p.denied ? { data: null, error: DENIED } : { data: shape, error: null };
    if (name === 'series_command_p5') {
      sends.push(args.p_envelope as Raw);
      return gateOn && p.refusedWhenOn ? { data: null, error: REFUSAL } : { data: { ok: true, new_version: 8, data: {} }, error: null };
    }
    return { data: [], error: null };
  });
}
function show(path: string, state: unknown = null) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  router = createMemoryRouter([
    { path: '/account/p3/events/:seriesId', element: <EventPage /> },
    { path: '/account/p3/events/:seriesId/details', element: <DetailsScreen /> },
    { path: '/account/p3/events/:seriesId/prices', element: <PricesScreen /> },
  ], { initialEntries: [{ pathname: path, state }] });
  render(<QueryClientProvider client={qc}><RouterProvider router={router} /></QueryClientProvider>);
}
const press = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el); }); };
const saveBtn = () => screen.getByTestId('p3-save') as HTMLButtonElement;

const SCREENS = {
  details: {
    path: '/account/p3/events/ser-1/details', control: 'p3-d-name', lock: 'p3-details-lock', kept: 'p3-details-kept',
    edit: () => fireEvent.change(screen.getByTestId('p3-d-name'), { target: { value: 'Typed Before Refusal' } }),
    typed: () => (screen.getByTestId('p3-d-name') as HTMLInputElement).value === 'Typed Before Refusal',
  },
  prices: {
    path: '/account/p3/events/ser-1/prices', control: 'p3-free-switch', lock: 'p3-prices-lock', kept: 'p3-prices-kept',
    edit: () => fireEvent.click(screen.getByTestId('p3-free-switch')),
    typed: () => (screen.getByTestId('p3-free-switch') as HTMLInputElement).checked,
  },
} as const;
type ScreenId = keyof typeof SCREENS;

let unsub: () => void = () => {};
beforeEach(() => {
  rpc.mockReset();
  window.sessionStorage.clear();
  // stands in for the P3 frame's GateHost: the store opens the sheet only while a host listens
  unsub = subscribeGate(() => {});
});
afterEach(() => { cleanup(); closeGate(); unsub(); who.admin = false; who.progressFailed = false; who.progress = { publishReady: true, requiredLeft: 0 }; });

function as(p: Person) {
  who.admin = p.admin;
  who.progressFailed = !!p.progressFailed;
  // S "the two counts differ": the OLD answers-left count is deliberately NOT the things-left count (60 of 66 on prod)
  who.progress = { publishReady: p.ready, requiredLeft: p.left + 2 };
}

const NO_COUNT = /answers? left|things? left/;

// ---- J1 / J2 / J3 / J4 / J5 for every person x gate on/off x screen ----
type Row = { p: Person; gateOn: boolean; screen: ScreenId };
const ROWS: Row[] = PEOPLE.flatMap((p) => [true, false].flatMap((gateOn) => (['details', 'prices'] as const).map((s) => ({ p, gateOn, screen: s }))));

describe('F-13 matrix: person x gate x screen', () => {
  it.each(ROWS.map((r) => [`${r.p.id} ${r.p.what} | gate ${r.gateOn ? 'on' : 'off'} | ${r.screen}`, r] as const))('%s', async (_n, r) => {
    const sc = SCREENS[r.screen];
    as(r.p);
    serve(r.p, r.gateOn);
    show(sc.path);

    if (r.p.denied) {
      // P5 / P6: the existing "Not yours" state; nothing to type, nothing sent (F-20 out of scope)
      await screen.findByTestId('p3-event-notyours');
      expect(screen.queryByTestId('p3-save')).toBeNull();
      expect(sends).toHaveLength(0);
      return;
    }

    // OPEN: no up-front lock, no count on the edit screen, the control works
    await screen.findByTestId(sc.control);
    expect(screen.queryByTestId(sc.lock)).toBeNull();
    expect(document.body.textContent).not.toMatch(NO_COUNT);
    expect((screen.getByTestId(sc.control) as HTMLInputElement).disabled).toBe(false);

    // J1: untouched Save is off and sends NOTHING
    expect(saveBtn().disabled).toBe(true);
    await press(saveBtn());
    expect(sends).toHaveLength(0);

    // J2 / J3: change, Save
    sc.edit();
    expect(saveBtn().disabled).toBe(false);
    await press(saveBtn());
    await waitFor(() => expect(sends.length).toBeGreaterThan(0));
    const refused = r.gateOn && r.p.refusedWhenOn;
    if (!refused) {
      // saved: back to the event page, no sheet, nothing kept
      await waitFor(() => expect(router.state.location.pathname).toBe('/account/p3/events/ser-1'));
      expect(getGate()).toBeNull();
      expect(keptDraft('ser-1')).toBeNull();
      return;
    }

    // J4 first half: ONE send, the shared sheet opens for THIS screen, no error line, the typing stays
    expect(sends).toHaveLength(1);
    await waitFor(() => expect(getGate()).not.toBeNull());
    expect(getGate()?.at).toBe(sc.path);
    expect(getGate()?.organiserId).toBe('o1');
    expect(screen.queryByTestId('p3-save-error')).toBeNull();
    expect(sc.typed()).toBe(true);
    expect(keptDraft('ser-1')?.screen).toBe(r.screen);

    // J5 Not now: the sheet closes, the person stays with the typing, Save still offered
    act(() => closeGate());
    expect(router.state.location.pathname).toBe(sc.path);
    expect(sc.typed()).toBe(true);
    expect(saveBtn().disabled).toBe(false);
    expect(sends).toHaveLength(1);

    // J4 second half: the checklist's "Back to your event" lands on the event, which hands the kept typing back
    cleanup();
    serve({ ...r.p, refusedWhenOn: false }, r.gateOn);
    show('/account/p3/events/ser-1', KEPT_BACK_STATE);
    await waitFor(() => expect(router.state.location.pathname).toBe(sc.path));
    await screen.findByTestId(sc.kept);
    expect(screen.getByTestId(sc.kept).textContent).toBe(KEPT_COPY.line);
    expect(sc.typed()).toBe(true);
    expect(sends).toHaveLength(0); // nothing replayed
    expect(keptDraft('ser-1')).toBeNull(); // shown once
    await press(saveBtn());
    await waitFor(() => expect(router.state.location.pathname).toBe('/account/p3/events/ser-1'));
    expect(sends.length).toBeGreaterThan(0);
  });
});

// ---- P7: ended / archived keep the event-closed lock, with its reason ----
describe('P7 owner of an ended or archived event: the closed lock stays', () => {
  it.each((['ended', 'archived'] as const).flatMap((shape) => (['details', 'prices'] as const).map((s) => [shape, s] as const)))(
    '%s | %s: closed with the reason (ended: the lock; archived: the finished card), no count, nothing sent', async (shape, s) => {
      const sc = SCREENS[s];
      const p = PEOPLE[0];
      as(p);
      serve(p, true, SHAPES[shape]);
      show(sc.path);
      if (shape === 'archived') {
        // archived: the existing "This event has finished" card, no form at all (unchanged by this brief)
        await screen.findByTestId('p3-event-archived');
        expect(screen.queryByTestId('p3-save')).toBeNull();
        expect(document.body.textContent).not.toMatch(NO_COUNT);
        expect(sends).toHaveLength(0);
        return;
      }
      const lock = await screen.findByTestId(sc.lock);
      expect(lock.textContent?.length).toBeGreaterThan(0);
      expect(lock.textContent).not.toMatch(NO_COUNT);
      expect(screen.queryByText('Complete your profile')).toBeNull();
      expect(saveBtn().disabled).toBe(true);
      expect(screen.getByTestId('p3-save-why').textContent?.length).toBeGreaterThan(0);
      await press(saveBtn());
      expect(sends).toHaveLength(0);
    });
});

// ---- S: the ONE count the sheet shows (rows left 10/6/3/1/0; status ok / failed / slow) ----
const status = (n: number) => ({
  v: 1, gate_on: true, is_admin: false, complete: n === 0,
  person: { complete: n === 0, missing: ['first_name', 'city', 'dance_role', 'photo', 'nationality', 'languages', 'instagram', 'teach_answer', 'dj_answer', 'org_logo'].slice(0, Math.max(0, n - 1)) },
  organisers: [{ id: 'o1', name: 'Page', role: 'owner', complete: n === 0, missing: n > 0 ? ['org_links'] : [] }],
});
describe('the sheet count is the ONE onboarding count (organiser_onboarding_status_v1)', () => {
  it.each([10, 6, 3, 1])('%i left: "%i things left" style, one row per code', (n) => {
    const v = gateView(status(n), 'o1');
    expect(v.kind).toBe('left');
    if (v.kind !== 'left') return;
    expect(v.count).toBe(thingsLeft(n));
    expect(v.rows).toHaveLength(n);
    expect(v.count).not.toMatch(/answer/);
  });
  it('0 left but refused (the read lags): the refusal\'s own codes, never "0 things left"', () => {
    const v = gateView(status(0), 'o1', ['org_logo']);
    expect(v.kind === 'left' && v.count).toBe(thingsLeft(1));
  });
  it.each([['failed', null], ['slow (not read yet)', undefined]] as const)('status %s: no count, Continue still goes to the page named', (_n, raw) => {
    const v = gateView(raw as unknown, 'o1');
    expect(v.kind).toBe('unknown');
    expect(v.kind === 'unknown' && v.to).toContain('o1');
  });
  it('the sheet copy never says "answers"', () => {
    expect(Object.values(GATE_COPY).join(' ')).not.toMatch(/answer/);
  });
});
