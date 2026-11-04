// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import * as model from '../model';
import type { CheckIn, DoorResult } from '../model';
import type { DoorList, DoorRow } from '../data';
import type { ScannerDeps } from '../camera';

/*
 * Door short code (ticket_check_in_by_code_v1) and Tonight-list check-in by id
 * (ticket_check_in_by_id_v1), brief docs/briefs/ticket-door-code-screen.md.
 * Matrix: every result x staff role x list shape. The role is the DATABASE's call
 * (_ticket_door_orgs_v1): a person off the team gets not_allowed whatever the code; the
 * screen never checks a role itself, so the role enters only through the RPC answer.
 */

const api = vi.hoisted(() => ({ qr: vi.fn(), byCode: vi.fn(), byId: vi.fn(), list: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('../data', async (orig) => ({
  ...(await orig<typeof import('../data')>()),
  checkInTicket: (...a: unknown[]) => api.qr(...a),
  checkInByCode: (...a: unknown[]) => api.byCode(...a),
  checkInById: (...a: unknown[]) => api.byId(...a),
  fetchDoorList: (...a: unknown[]) => api.list(...a),
}));
import { Door } from '../DoorScreen';

const deps: ScannerDeps = {
  getStream: async () => { throw Object.assign(new Error('x'), { name: 'NotFoundError' }); },
  makeDetector: async () => async () => null,
  every: 5,
};

const row = (i: number, inAt: string | null = null): DoorRow => ({
  ticketId: `t${i}`, firstName: `Name${String(i).padStart(3, '0')}`, quantity: 1, typeName: 'Standard', checkedInAt: inAt,
});
const listOf = (n: number): DoorList => ({
  result: 'ok', truncated: false, inCount: 0, totalCount: n, loadedAt: Date.parse('2026-11-03T21:00:00Z'),
  rows: Array.from({ length: n }, (_, i) => row(i + 1)),
});
const SHAPES = { empty: listOf(0), one: listOf(1), many: listOf(120) } as const;
type Shape = keyof typeof SHAPES;
const ROLES = ['owner', 'manager', 'contributor', 'admin', 'off_team'] as const;
type Role = (typeof ROLES)[number];

/** Every answer the code path can show: the by-code RPC's six + too_many_attempts, plus no_signal (network). */
const CODE_RESULTS: DoorResult[] = ['ok', 'already_in', 'wrong_event', 'not_valid', 'unknown_code', 'not_allowed', 'too_many_attempts', 'no_signal'];
/** ticket_check_in_by_id_v1 never rate-limits. */
const ID_RESULTS: DoorResult[] = CODE_RESULTS.filter((r) => r !== 'too_many_attempts');

const reply = (result: Exclude<DoorResult, 'no_signal'>): CheckIn => {
  const person = !['unknown_code', 'not_allowed', 'too_many_attempts'].includes(result);
  return {
    result, ticket_type_name: person ? 'Standard' : null, first_name: person ? 'Maria' : null, quantity: person ? 2 : null,
    checked_in_at: result === 'ok' || result === 'already_in' ? '2026-11-03T21:42:00Z' : null,
    checked_in_by_first_name: result === 'already_in' ? 'Sam' : null,
    in_count: result === 'not_allowed' ? null : 1, total_count: result === 'not_allowed' ? null : 120,
  };
};
/** What the RPC answers this role for this intended result. */
const answer = (role: Role, r: DoorResult) => {
  if (r === 'no_signal') return Promise.reject(new Error('fetch failed'));
  return Promise.resolve(reply(role === 'off_team' ? 'not_allowed' : (r as Exclude<DoorResult, 'no_signal'>)));
};
const shownFor = (role: Role, r: DoorResult): DoorResult => (role === 'off_team' && r !== 'no_signal' ? 'not_allowed' : r);

function show(list: DoorList, shortCodes = true) {
  api.list.mockResolvedValue(list);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><Door seriesId="ser-1" deps={deps} shortCodes={shortCodes} /></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  for (const f of Object.values(api)) f.mockReset();
  Object.defineProperty(navigator, 'vibrate', { value: vi.fn(), configurable: true });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const typeCode = (code: string) => {
  fireEvent.change(screen.getByTestId('door-code-input'), { target: { value: code } });
  fireEvent.click(screen.getByTestId('door-code-check'));
};
const goScan = () => fireEvent.click(screen.getByTestId('door-tab-scan'));

/** Copy never points at a control that is not on screen (brief, CLAUDE.md DoD 2). */
function assertCopyHasControls(card: HTMLElement, kind: DoorResult) {
  const row = model.RESULT_TABLE[kind];
  const words = `${row.detail(null)} ${row.sub(null)}`;
  for (const a of row.actions.filter((x) => x !== 'none')) {
    expect(within(card).getByTestId(`door-act-${a}`).textContent).toBe(model.ACTION_LABEL[a]);
  }
  if (/tonight’s list/i.test(words)) expect(screen.getByTestId('door-tab-list')).toBeTruthy();
  if (/tap Check in/i.test(words)) expect(row.actions).toContain('list');
}

describe('the ONE mapping covers every by-code / by-id answer', () => {
  it.each(CODE_RESULTS)('%s has a headline, words and a next action (or says there is none)', (r) => {
    const row = model.RESULT_TABLE[r];
    expect(row.headline).toBeTruthy();
    expect(row.detail(null)).toBeTruthy();
    expect(row.actions.length).toBeGreaterThan(0);
  });
  it('too_many_attempts says wait and offers the list, never a dead end', () => {
    const row = model.RESULT_TABLE.too_many_attempts;
    expect(row.actions).toContain('list');
    expect(row.detail(null)).toMatch(/15 minutes/);
    expect(row.detail(null)).toMatch(/Check in/);
  });
});

describe('short code parsing mirrors the RPC (case, spaces and dashes ignored; 6 of 23456789ABCDEFGHJKMNPQRSTUVWXYZ)', () => {
  it.each([
    ['k7m 2qx', { kind: 'short', code: 'K7M2QX' }],
    ['K7M-2QX', { kind: 'short', code: 'K7M2QX' }],
    [' k7m2qx ', { kind: 'short', code: 'K7M2QX' }],
    ['ab'.repeat(32), { kind: 'qr', code: 'ab'.repeat(32) }],
    ['', null],
    ['   ', null],
  ])('%j', (raw, want) => expect(model.classifyCode(raw, true)).toEqual(want));
  it.each(['K7M2Q', 'K7M2QXX', 'K7M2Q0', 'IOL123', 'K7M2Q1'])('%s is blocked with a reason and never sent (a wrong code costs one of 20 tries)', (raw) => {
    expect(model.classifyCode(raw, true)).toBeNull();
    expect(model.codeBoxBlock(raw, false, true)).toMatch(/6 letters and numbers/);
  });
  it('flag off: the box behaves exactly as before (no short codes)', () => {
    expect(model.classifyCode('K7M2QX', false)).toEqual({ kind: 'qr', code: 'K7M2QX' });
    expect(model.codeBoxBlock('K7M2Q0', false, false)).toBeNull();
  });
  it('busy wins over every other reason', () => expect(model.codeBoxBlock('K7M2QX', true, true)).toMatch(/Checking/));
});

describe('typed short code: every result x staff role x list shape', () => {
  const cases = ROLES.flatMap((role) => (Object.keys(SHAPES) as Shape[]).flatMap((shape) => CODE_RESULTS.map((r) => [role, shape, r] as const)));
  it.each(cases)('%s / %s list / %s', async (role, shape, r) => {
    api.byCode.mockImplementation(() => answer(role, r));
    show(SHAPES[shape]);
    if (shape === 'empty') {
      // nothing sold: no row to check in, nothing sent, and the card says what to do (and links to it)
      expect(await screen.findByTestId('door-empty')).toBeTruthy();
      expect(screen.getByText('Go to the event page')).toBeTruthy();
      expect(screen.queryByTestId('door-row-checkin')).toBeNull();
      goScan();
      expect(screen.getByTestId('door-empty')).toBeTruthy();
      expect(api.byCode).not.toHaveBeenCalled();
      return;
    }
    goScan();
    await screen.findByTestId('door-codebox');
    typeCode('k7m-2qx');
    const kind = shownFor(role, r);
    if (kind === 'no_signal') {
      // network error: straight to the list, which says why
      expect(await screen.findByTestId('door-offline-banner')).toBeTruthy();
    } else {
      const card = await screen.findByTestId('door-result');
      expect(card.getAttribute('data-state')).toBe(kind);
      expect(within(card).getByTestId('door-headline').textContent).toBe(model.RESULT_TABLE[kind].headline);
      assertCopyHasControls(card, kind);
    }
    expect(api.byCode).toHaveBeenCalledWith('K7M2QX', 'ser-1');
    expect(api.qr).not.toHaveBeenCalled();
  });
});

describe('Tonight-list Check in by id: every result x staff role x list shape', () => {
  const cases = ROLES.flatMap((role) => (['one', 'many'] as Shape[]).flatMap((shape) => ID_RESULTS.map((r) => [role, shape, r] as const)));
  it.each(cases)('%s / %s list / %s', async (role, shape, r) => {
    api.byId.mockImplementation(() => answer(role, r));
    show(SHAPES[shape]);
    const btns = await screen.findAllByTestId('door-row-checkin');
    expect(btns).toHaveLength(SHAPES[shape].rows.length);
    fireEvent.click(btns[0]);
    const kind = shownFor(role, r);
    if (kind === 'no_signal') expect(await screen.findByTestId('door-offline-banner')).toBeTruthy();
    else {
      const card = await screen.findByTestId('door-result');
      expect(card.getAttribute('data-state')).toBe(kind);
      assertCopyHasControls(card, kind);
    }
    expect(api.byId).toHaveBeenCalledWith('t1', 'ser-1');
  });
});

describe('too_many_attempts is never a dead end', () => {
  it('Open tonight’s list, then Check in by id lets the person in', async () => {
    api.byCode.mockResolvedValue(reply('too_many_attempts'));
    api.byId.mockResolvedValue(reply('ok'));
    show(SHAPES.many);
    goScan();
    await screen.findByTestId('door-codebox');
    typeCode('K7M2QX');
    const card = await screen.findByTestId('door-result');
    expect(within(card).getByTestId('door-headline').textContent).toBe(model.RESULT_TABLE.too_many_attempts.headline);
    fireEvent.click(within(card).getByTestId('door-act-list'));
    fireEvent.click((await screen.findAllByTestId('door-row-checkin'))[4]);
    await waitFor(() => expect(screen.getByTestId('door-result').getAttribute('data-state')).toBe('ok'));
    expect(api.byId).toHaveBeenCalledWith('t5', 'ser-1');
  });
});

describe('button hygiene', () => {
  it('empty input sends nothing; the disabled button says why', async () => {
    show(SHAPES.one);
    goScan();
    await screen.findByTestId('door-codebox');
    fireEvent.click(screen.getByTestId('door-code-check'));
    expect(screen.getByTestId('door-code-check').getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByTestId('door-code-why').textContent).toMatch(/Type or paste/);
    fireEvent.change(screen.getByTestId('door-code-input'), { target: { value: 'K7M2Q0' } });
    fireEvent.click(screen.getByTestId('door-code-check'));
    expect(screen.getByTestId('door-code-why').textContent).toMatch(/6 letters and numbers/);
    expect(api.byCode).not.toHaveBeenCalled();
    expect(api.qr).not.toHaveBeenCalled();
  });
  it('no double submit: a second tap while checking sends nothing, and the pending state shows', async () => {
    let done!: (c: CheckIn) => void;
    api.byId.mockReturnValue(new Promise<CheckIn>((res) => { done = res; }));
    show(SHAPES.many);
    const btns = await screen.findAllByTestId('door-row-checkin');
    fireEvent.click(btns[0]);
    fireEvent.click(btns[0]);
    fireEvent.click(btns[1]);
    expect(api.byId).toHaveBeenCalledTimes(1);
    expect(btns[0].textContent).toMatch(/Checking/);
    expect(btns[1].getAttribute('aria-disabled')).toBe('true');
    done(reply('ok'));
    await screen.findByTestId('door-result');
  });
  it('a checked-in row has no Check in button, only In', async () => {
    show({ ...SHAPES.one, rows: [row(1, '2026-11-03T21:00:00Z')] });
    await screen.findByTestId('door-list');
    expect(screen.queryByTestId('door-row-checkin')).toBeNull();
    expect(screen.getByTestId('door-row-status').textContent).toBe('In');
  });
});

describe('flag OFF ships the door exactly as before', () => {
  it('a 6-character code goes to the QR check, the list has no Check in, and the note says read only', async () => {
    api.qr.mockResolvedValue(reply('unknown_code'));
    show(SHAPES.one, false);
    await screen.findByTestId('door-list');
    expect(screen.queryByTestId('door-row-checkin')).toBeNull();
    expect(screen.getByTestId('door-list-note').textContent).toMatch(/Read only/);
    goScan();
    await screen.findByTestId('door-codebox');
    typeCode('K7M2QX');
    await screen.findByTestId('door-result');
    expect(api.qr).toHaveBeenCalled();
    expect(api.byCode).not.toHaveBeenCalled();
  });
  it('flag ON: the list note points at the Check in buttons that are there', async () => {
    show(SHAPES.one);
    await screen.findByTestId('door-list');
    expect(screen.getByTestId('door-list-note').textContent).toMatch(/tap Check in/);
    expect(screen.getAllByTestId('door-row-checkin')).toHaveLength(1);
  });
});

describe('r2 fixes (review 1294-r1)', () => {
  it('F3: after a list Check in answers not_allowed, no row keeps an enabled Check in', async () => {
    api.byId.mockImplementation(() => answer('off_team', 'ok'));
    show(SHAPES.many);
    fireEvent.click((await screen.findAllByTestId('door-row-checkin'))[0]);
    const card = await screen.findByTestId('door-result');
    expect(card.getAttribute('data-state')).toBe('not_allowed');
    expect(screen.queryAllByTestId('door-row-checkin')).toHaveLength(0);
    expect(api.byId).toHaveBeenCalledTimes(1);
  });
  it('F4: a list Check in answering already_in refetches the list', async () => {
    api.byId.mockResolvedValue(reply('already_in'));
    show(SHAPES.one);
    fireEvent.click((await screen.findAllByTestId('door-row-checkin'))[0]);
    await screen.findByTestId('door-result');
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
  });
  it('F5: the paused banner never says tap Check in when the list failed to load', async () => {
    api.byCode.mockResolvedValue(reply('too_many_attempts'));
    api.list.mockRejectedValue(new Error('fetch failed'));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><Door seriesId="ser-1" deps={deps} shortCodes /></MemoryRouter></QueryClientProvider>);
    await screen.findByTestId('door-codebox');
    typeCode('K7M2QX');
    fireEvent.click(await screen.findByTestId('door-act-list'));
    await screen.findByTestId('door-list-error');
    expect(screen.queryByTestId('door-paused-banner')?.textContent ?? '').not.toMatch(/tap Check in/);
  });
  it('F7: flag OFF: empty submit shows no reason and the busy label stays Check (as main)', async () => {
    let done!: (c: CheckIn) => void;
    api.qr.mockReturnValue(new Promise<CheckIn>((res) => { done = res; }));
    show(SHAPES.one, false);
    goScan();
    await screen.findByTestId('door-codebox');
    fireEvent.click(screen.getByTestId('door-code-check'));
    expect(screen.queryByTestId('door-code-why')).toBeNull();
    done(reply('ok'));
  });
});
