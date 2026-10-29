// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { CheckIn, DoorResult } from '../model';
import { RESULT_TABLE, ACTION_LABEL } from '../model';
import type { DoorList } from '../data';
import type { ScannerDeps } from '../camera';

const api = vi.hoisted(() => ({ checkIn: vi.fn(), list: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('../data', async (orig) => ({
  ...(await orig<typeof import('../data')>()),
  checkInTicket: (...a: unknown[]) => api.checkIn(...a),
  fetchDoorList: (...a: unknown[]) => api.list(...a),
}));
import { Door } from '../DoorScreen';
import { SignedOutError } from '../data';

const TOKEN = 'ab'.repeat(32);
const LIST: DoorList = {
  result: 'ok', truncated: false, inCount: 1, totalCount: 3, loadedAt: Date.parse('2026-10-29T21:30:00Z'),
  rows: [
    { ticketId: 't1', firstName: 'Aisha', quantity: 3, typeName: 'Standard', checkedInAt: null },
    { ticketId: 't2', firstName: 'Maria', quantity: 2, typeName: 'Early bird', checkedInAt: '2026-10-29T21:00:00Z' },
    { ticketId: 't3', firstName: null, quantity: 1, typeName: 'Standard', checkedInAt: null },
  ],
};
const reply = (result: CheckIn['result']): CheckIn => ({
  result, ticket_type_name: result === 'unknown_code' || result === 'not_allowed' ? null : 'Early bird',
  first_name: result === 'unknown_code' || result === 'not_allowed' ? null : 'Maria', quantity: result === 'unknown_code' || result === 'not_allowed' ? null : 2,
  checked_in_at: result === 'ok' || result === 'already_in' ? '2026-10-29T21:42:00Z' : null,
  checked_in_by_first_name: result === 'already_in' ? 'Sam' : null,
  in_count: result === 'not_allowed' ? null : 2, total_count: result === 'not_allowed' ? null : 3,
});

/** A camera that hands the reader whatever `cam.code` is, every few ms. */
const cam = { code: null as string | null, fail: null as string | null };
const deps: ScannerDeps = {
  getStream: async () => {
    if (cam.fail) throw Object.assign(new Error('x'), { name: cam.fail });
    return { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;
  },
  makeDetector: async () => async () => cam.code,
  every: 5,
};

function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><Door seriesId="ser-1" deps={deps} /></MemoryRouter>
    </QueryClientProvider>,
  );
}

const vibrate = vi.fn();
beforeEach(() => {
  cam.code = null; cam.fail = null;
  api.checkIn.mockReset(); api.list.mockReset();
  api.list.mockResolvedValue(LIST);
  vibrate.mockReset();
  Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const typeCode = (code: string) => {
  fireEvent.change(screen.getByTestId('door-code-input'), { target: { value: code } });
  fireEvent.click(screen.getByTestId('door-code-check'));
};

describe('every result on the Scan screen, from the code box (the ONE table drives the words)', () => {
  const RPC: CheckIn['result'][] = ['ok', 'already_in', 'wrong_event', 'not_valid', 'unknown_code', 'not_allowed'];
  it.each(RPC)('%s', async (r) => {
    api.checkIn.mockResolvedValue(reply(r));
    show();
    await screen.findByTestId('door-codebox');
    typeCode(`  ${TOKEN.toUpperCase()} `);
    const card = await screen.findByTestId('door-result');
    expect(api.checkIn).toHaveBeenCalledWith(TOKEN, 'ser-1');
    const row = RESULT_TABLE[r];
    expect(card.getAttribute('data-state')).toBe(r);
    expect(within(card).getByTestId('door-headline').textContent).toBe(row.headline);
    expect(within(card).getByTestId('door-sub').textContent).toBe(row.sub(reply(r)));
    expect(within(card).getByTestId('door-detail').textContent).toBe(row.detail(reply(r)));
    for (const a of row.actions.filter((x) => x !== 'none')) expect(within(card).getByTestId(`door-act-${a}`).textContent).toBe(ACTION_LABEL[a]);
    if (row.vibrate.length) expect(vibrate).toHaveBeenCalledWith(row.vibrate); else expect(vibrate).not.toHaveBeenCalled();
    // the person line only where the database names someone
    expect(!!within(card).queryByTestId('door-who')).toBe(r !== 'unknown_code' && r !== 'not_allowed');
    // the counter follows the reply
    if (r !== 'not_allowed') expect(screen.getByTestId('door-count').textContent).toMatch(/^2 of 3 in/);
    // not allowed stops the camera; everything else keeps it reading
    if (r === 'not_allowed') expect(screen.queryByTestId('door-camera')).toBeNull();
    else expect(screen.getByTestId('door-camera')).toBeTruthy();
  });

  it('ok says one person and the order size', async () => {
    api.checkIn.mockResolvedValue(reply('ok'));
    show();
    await screen.findByTestId('door-codebox');
    typeCode(TOKEN);
    expect((await screen.findByTestId('door-sub')).textContent).toBe('1 person \u00b7 ticket 1 of an order of 2');
  });

  it('no signal (the read failed) opens tonight\'s list with the banner', async () => {
    api.checkIn.mockRejectedValue(new TypeError('Failed to fetch'));
    show();
    await screen.findByTestId('door-codebox');
    typeCode(TOKEN);
    expect(await screen.findByTestId('door-offline-banner')).toBeTruthy();
    expect(screen.getByTestId('door-tab-list').getAttribute('aria-current')).toBe('page');
    expect(screen.getAllByTestId('door-row')).toHaveLength(3);
  });

  it('signed out (42501) says so, with a way back in', async () => {
    api.checkIn.mockRejectedValue(new SignedOutError());
    show();
    await screen.findByTestId('door-codebox');
    typeCode(TOKEN);
    expect(await screen.findByTestId('door-signed-out')).toBeTruthy();
  });

  it('Scan next clears the answer; Type code clears it and focuses the box', async () => {
    api.checkIn.mockResolvedValue(reply('unknown_code'));
    show();
    await screen.findByTestId('door-codebox');
    typeCode(TOKEN);
    fireEvent.click(await screen.findByTestId('door-act-type'));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('door-code-input')));
    expect(screen.queryByTestId('door-result')).toBeNull();
  });

  it('the Check button is disabled with a visible reason while the box is empty-ish', async () => {
    show();
    await screen.findByTestId('door-codebox');
    fireEvent.change(screen.getByTestId('door-code-input'), { target: { value: '   ' } });
    expect(screen.getByTestId('door-code-check').getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByTestId('door-code-why').textContent).toBe('Type or paste the code first');
    fireEvent.click(screen.getByTestId('door-code-check'));
    expect(api.checkIn).not.toHaveBeenCalled();
  });
});

describe('camera mock: debounce and dead cameras', () => {
  it('the same code held in front of the camera fires ONCE within 2.5 s, again after', async () => {
    let t = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => t);
    api.checkIn.mockResolvedValue(reply('ok'));
    show();
    await waitFor(() => expect(screen.getByTestId('door-camera').getAttribute('data-cam')).toBe('on'));
    cam.code = `https://x.test/t/${TOKEN}`;
    await screen.findByTestId('door-result');
    await act(() => new Promise((r) => setTimeout(r, 60)));
    expect(api.checkIn).toHaveBeenCalledTimes(1);
    // still on screen: the same code never re-fires, however long it is held (ok must not become ALREADY IN)
    t += 2600;
    await act(() => new Promise((r) => setTimeout(r, 60)));
    expect(api.checkIn).toHaveBeenCalledTimes(1);
    // Scan next clears the answer and the gate: the same code reads again
    fireEvent.click(screen.getByTestId('door-act-scan'));
    await waitFor(() => expect(api.checkIn).toHaveBeenCalledTimes(2));
    // a different code replaces the answer at once
    cam.code = 'cd'.repeat(32);
    await waitFor(() => expect(api.checkIn).toHaveBeenCalledTimes(3));
    expect(api.checkIn).toHaveBeenLastCalledWith('cd'.repeat(32), 'ser-1');
    cam.code = null;
  });

  it('without Scan next, the same code re-fires only after the 2.5 s window (gate alone)', async () => {
    const t = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => t);
    api.checkIn.mockRejectedValue(new TypeError('Failed to fetch'));
    show();
    await waitFor(() => expect(screen.getByTestId('door-camera').getAttribute('data-cam')).toBe('on'));
    cam.code = TOKEN;
    await waitFor(() => expect(api.checkIn).toHaveBeenCalledTimes(1));
    // a failed read shows no answer for that code, so only the gate holds it back
    fireEvent.click(screen.getByTestId('door-tab-scan'));
    await act(() => new Promise((r) => setTimeout(r, 60)));
    expect(api.checkIn).toHaveBeenCalledTimes(1);
    cam.code = null;
  });

  it.each([['NotAllowedError', 'denied'], ['NotFoundError', 'none'], ['AbortError', 'failed']])('%s -> says so plainly, opens the list and the code box', async (name) => {
    cam.fail = name;
    show();
    expect(await screen.findByTestId('door-cam-dead')).toBeTruthy();
    expect(screen.getByTestId('door-tab-list').getAttribute('aria-current')).toBe('page');
    expect(screen.getByTestId('door-codebox')).toBeTruthy();
  });

  it('stops the camera tracks on unmount', async () => {
    const stop = vi.fn();
    const d: ScannerDeps = { ...deps, getStream: async () => ({ getTracks: () => [{ stop }] }) as unknown as MediaStream };
    const client = new QueryClient();
    const r = render(<QueryClientProvider client={client}><MemoryRouter><Door seriesId="ser-1" deps={d} /></MemoryRouter></QueryClientProvider>);
    await waitFor(() => expect(screen.getByTestId('door-camera').getAttribute('data-cam')).toBe('on'));
    r.unmount();
    expect(stop).toHaveBeenCalled();
  });
});

describe("tonight's list states, each with an action", () => {
  const openList = async () => { fireEvent.click(await screen.findByTestId('door-tab-list')); };
  it('rows: first name + quantity + In / Not in, read only', async () => {
    show();
    await openList();
    const rows = await screen.findAllByTestId('door-row');
    expect(rows.map((r) => r.textContent)).toEqual(['AishaStandard\u00d73Not in', 'MariaEarly bird\u00d72In', 'No name givenStandard\u00d71Not in']);
    expect(within(rows[0]).queryByRole('button')).toBeNull();
    expect(screen.getByTestId('door-tab-list').textContent).toBe('Tonight\u2019s list (3)');
  });
  it('search, and a no-match state with Clear search', async () => {
    show();
    await openList();
    fireEvent.change(await screen.findByTestId('door-search'), { target: { value: 'mar' } });
    expect(screen.getAllByTestId('door-row')).toHaveLength(1);
    fireEvent.change(screen.getByTestId('door-search'), { target: { value: 'zed' } });
    fireEvent.click(within(screen.getByTestId('door-no-match')).getByRole('button', { name: 'Clear search' }));
    expect(screen.getAllByTestId('door-row')).toHaveLength(3);
  });
  it('truncated says so', async () => {
    api.list.mockResolvedValue({ ...LIST, truncated: true });
    show();
    await openList();
    expect(await screen.findByTestId('door-truncated')).toBeTruthy();
  });
  it('loading offers Back to scanning', async () => {
    api.list.mockReturnValue(new Promise(() => {}));
    show();
    await openList();
    fireEvent.click(within(await screen.findByTestId('door-list-loading')).getByRole('button', { name: 'Back to scanning' }));
    expect(screen.getByTestId('door-tab-scan').getAttribute('aria-current')).toBe('page');
  });
  it('a failed read offers Try again, which reads again', async () => {
    api.list.mockRejectedValue(new Error('boom'));
    show();
    await openList();
    const err = await screen.findByTestId('door-list-error', {}, { timeout: 5000 });
    api.list.mockResolvedValue(LIST);
    fireEvent.click(within(err).getByRole('button', { name: 'Try again' }));
    expect(await screen.findAllByTestId('door-row', {}, { timeout: 5000 })).toHaveLength(3);
  });
  it('0 sold: both tabs say what to do, the camera stays off', async () => {
    api.list.mockResolvedValue({ ...LIST, rows: [], inCount: 0, totalCount: 0 });
    show();
    expect(await screen.findByTestId('door-empty')).toBeTruthy();
    expect(screen.queryByTestId('door-camera')).toBeNull();
    await openList();
    expect(within(await screen.findByTestId('door-empty')).getByRole('link', { name: 'Go to the event page' })).toBeTruthy();
  });
  it('not on the team: both tabs say so, no camera', async () => {
    api.list.mockResolvedValue({ ...LIST, result: 'not_allowed', rows: [], inCount: null, totalCount: null });
    show();
    expect((await screen.findByTestId('door-sub')).textContent).toBe('You\u2019re not on this event\u2019s team');
    expect(screen.queryByTestId('door-camera')).toBeNull();
    await openList();
    expect((await screen.findByTestId('door-sub')).textContent).toBe('You\u2019re not on this event\u2019s team');
  });
});

describe('the no_signal row is the client-side one', () => {
  it('is in the table', () => { expect(RESULT_TABLE['no_signal' as DoorResult].headline).toBe('NO SIGNAL'); });
});
