// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TODAY } from './wsFixtures';
import { NOW, ONE_OFF, OTHER, REASONS, cws, type OneOffKey, type OtherKey } from './cancelFixtures';
import { CANCEL_COPY, STATUS_COPY, cancelInputOf, statusRows } from '../../data/eventPage';
import { CANCEL_WHY, L, canCancelOneOff } from '../../model';
import { commandErrorMessage } from '../../../shared/selfServeErrors';
import { VERSION_CONFLICT } from '../../../shared/copy';
import { P3_PATHS } from '../../shell/paths';

/*
 * W2c "Cancel the event" (series.cancel_one_off, ER AD4) x every shape it meets: the
 * row's state and reason, the End it reason beside it, the sheet, the command, Bring it
 * back, already cancelled, each refusal, and the kept idempotency key.
 */

type Key = OneOffKey | OtherKey;
const wsQ = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
const sent = vi.hoisted(() => ({
  calls: [] as Array<{ commands: unknown[]; version: number | null }>,
  once: [] as Array<{ command: unknown; key: string }>,
  onceFail: [] as unknown[],
  onceData: {} as Record<string, unknown>,
}));

vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn(), auth: {}, from: vi.fn() } }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-25' }));
vi.mock('../../../shared/selfServeApi', async (orig) => ({
  ...(await orig<typeof import('../../../shared/selfServeApi')>()),
  fetchCancellationReasons: async () => REASONS,
}));
vi.mock('../../../shared/runCommands', () => ({
  useEventWorkspace: () => wsQ.value,
  useRunCommands: () => async (commands: unknown[], version: number | null) => {
    sent.calls.push({ commands, version });
    return 9;
  },
  useSendOnce: () => async (command: unknown, _version: number | null, key: string) => {
    sent.once.push({ command, key });
    const fail = sent.onceFail.shift();
    if (fail) throw fail;
    return { ok: true, new_version: 8, data: sent.onceData };
  },
}));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ isPending: true, data: undefined }) }));

import { EventPage } from '../EventPage';

/** Each shape: the Cancel row (absent / enabled / its reason) and the End it reason (null = enabled). */
const EXPECT: Record<Key, { cancel: 'absent' | null | string; end: string | null }> = {
  liveAhead: { cancel: null, end: STATUS_COPY.neverRanOneOff },
  todayBefore: { cancel: null, end: null },
  todayAfter: { cancel: CANCEL_WHY.started, end: null },
  passed: { cancel: CANCEL_WHY.passed, end: null },
  cancelled: { cancel: CANCEL_WHY.cancelled, end: STATUS_COPY.neverRan },
  hidden: { cancel: CANCEL_WHY.hidden, end: STATUS_COPY.neverRan },
  draft: { cancel: 'absent', end: null },
  noStart: { cancel: CANCEL_WHY.started, end: null },
  zeroDates: { cancel: CANCEL_WHY.dates, end: STATUS_COPY.neverRan },
  twoDates: { cancel: CANCEL_WHY.dates, end: STATUS_COPY.neverRan },
  weekly: { cancel: 'absent', end: null },
  course: { cancel: 'absent', end: null },
  monthly: { cancel: 'absent', end: null },
  custom: { cancel: 'absent', end: null },
  festival: { cancel: 'absent', end: STATUS_COPY.neverRan },
};
const KEYS = [...Object.keys(ONE_OFF), ...Object.keys(OTHER)] as Key[];

const ok = (k: Key) => ({ isPending: false, isError: false, data: cws(k), error: null, refetch: vi.fn() });

function show(k: Key) {
  vi.setSystemTime(NOW[k]);
  wsQ.value = ok(k);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[P3_PATHS.event('ser-1')]}>
        <Routes><Route path="/account/p3/events/:seriesId" element={<EventPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const openSheet = () => fireEvent.click(screen.getByTestId('p3-open-status'));
const cancelRow = () => screen.queryByTestId('p3-status-row-cancel') as HTMLButtonElement | null;
const confirm = () => screen.getByTestId('p3-cancel-confirm') as HTMLButtonElement;
async function openCancel(k: Key = 'liveAhead') {
  show(k);
  openSheet();
  fireEvent.click(cancelRow()!);
  await waitFor(() => screen.getByRole('button', { name: 'Weather' }));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  sent.calls = [];
  sent.once = [];
  sent.onceFail = [];
  sent.onceData = { already_cancelled: false, reason: 'Weather' };
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('the rule x every shape (canCancelOneOff, one function)', () => {
  it.each(KEYS)('%s', (k) => {
    const rule = canCancelOneOff(cancelInputOf(cws(k)), TODAY, NOW[k]);
    const want = EXPECT[k].cancel;
    if (want === 'absent') expect(rule).toBeNull();
    else expect(rule).toEqual({ ok: want === null, reason: want });
  });

  it('a date today: one minute before the start it can go; at the start it cannot', () => {
    const input = cancelInputOf(cws('todayBefore'));
    expect(canCancelOneOff(input, TODAY, new Date('2026-10-25T20:59:00Z')).ok).toBe(true);
    expect(canCancelOneOff(input, TODAY, new Date('2026-10-25T21:00:00Z')).reason).toBe(CANCEL_WHY.started);
  });

  it('every greyed reason says what to do instead', () => {
    for (const reason of Object.values(CANCEL_WHY)) expect(reason).toMatch(/End it|bring it back|Show it again|Ask the Bachata Calendar team/);
  });
});

describe('the Status sheet x every shape', () => {
  it.each(KEYS)('%s: the Cancel row and End it beside it', (k) => {
    const rows = statusRows(cws(k), TODAY, NOW[k]);
    const want = EXPECT[k];
    const cancel = rows.find((r) => r.move === 'cancel');
    if (want.cancel === 'absent') expect(cancel).toBeUndefined();
    else expect(cancel).toEqual({ move: 'cancel', title: L.cancelEvent, sub: L.cancelEventWhy, reason: want.cancel });
    const end = rows.find((r) => r.move === 'end');
    if (end) expect(end.reason).toBe(want.end);
  });

  it.each(KEYS)('%s: rendered, a greyed row says why and tapping it sends nothing', (k) => {
    show(k);
    openSheet();
    const b = cancelRow();
    const want = EXPECT[k].cancel;
    if (want === 'absent') {
      expect(b).toBeNull();
      expect(screen.queryByText(L.cancelEvent)).toBeNull();
    } else {
      expect(b!.disabled).toBe(want !== null);
      expect(b!.textContent).toContain(want ?? L.cancelEventWhy);
      if (want) fireEvent.click(b!);
    }
    expect(sent.calls).toEqual([]);
    expect(sent.once).toEqual([]);
  });

  it('a recurring date keeps its own control: no shape but a one-off sends series.cancel_one_off', () => {
    for (const k of Object.keys(OTHER) as OtherKey[]) {
      expect(statusRows(cws(k), TODAY, NOW[k]).map((r) => r.move)).not.toContain('cancel');
    }
  });
});

describe('the Cancel the event sheet', () => {
  it('names the event and the full date; carry on is off until a reason is picked; nothing is sent untouched', async () => {
    await openCancel();
    expect(document.getElementById('p3-sheet-title')!.textContent).toBe('Cancel Halloween Party on Saturday 31 October?');
    expect(screen.getByTestId('p3-cancel-body').textContent).toBe('Dancers will see \u2018Cancelled\u2019 on Saturday 31 October. You can bring it back any time.');
    expect(confirm().disabled).toBe(true);
    expect(confirm().textContent).toBe(CANCEL_COPY.pick);
    fireEvent.click(confirm());
    fireEvent.click(screen.getByText(CANCEL_COPY.keep));
    expect(screen.queryByTestId('p3-sheet')).toBeNull();
    expect(sent.once).toEqual([]);
    expect(sent.calls).toEqual([]);
  });

  it('every reason is offered, Other included (one list: cancellation_reasons)', async () => {
    await openCancel();
    for (const r of REASONS) expect(screen.getByRole('button', { name: r.label })).toBeTruthy();
  });

  it('Escape closes it without sending', async () => {
    await openCancel();
    fireEvent.click(screen.getByRole('button', { name: 'Weather' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('p3-sheet')).toBeNull();
    expect(sent.once).toEqual([]);
  });

  it('a picked reason sends series.cancel_one_off {reason} only; the toast offers Bring it back = occurrence.cancel {cancelled:false} on the date', async () => {
    await openCancel();
    fireEvent.click(screen.getByRole('button', { name: 'Weather' }));
    expect(confirm().textContent).toBe(CANCEL_COPY.go);
    await act(async () => { fireEvent.click(confirm()); });
    expect(sent.once).toHaveLength(1);
    expect(sent.once[0].command).toEqual({ kind: 'series.cancel_one_off', payload: { reason: 'Weather' } });
    expect(typeof sent.once[0].key).toBe('string');
    expect(screen.queryByTestId('p3-sheet')).toBeNull();
    expect(screen.getByTestId('p3-toast').textContent).toBe(`${CANCEL_COPY.done}${L.bringItBack}`);
    expect(sent.calls).toEqual([]);
    await act(async () => { fireEvent.click(screen.getByTestId('p3-undo')); });
    expect(sent.calls).toEqual([{
      commands: [{ kind: 'occurrence.cancel', payload: { cancelled: false }, occurrence: { id: 'o-2026-10-31', version: 0 } }],
      version: 8,
    }]);
  });

  it('already cancelled (data.already_cancelled) is success with the STORED reason, never a second "Cancelled."', async () => {
    sent.onceData = { already_cancelled: true, reason: 'Illness' };
    await openCancel();
    fireEvent.click(screen.getByRole('button', { name: 'Weather' }));
    await act(async () => { fireEvent.click(confirm()); });
    const toast = screen.getByTestId('p3-toast').textContent!;
    expect(toast).toBe(`It was already cancelled. Dancers see: Illness.${L.bringItBack}`);
    expect(toast).not.toMatch(/^Cancelled\./);
  });

  it('a retry after a dropped connection sends the SAME key (one write); another reason is a new key', async () => {
    sent.onceFail = [new TypeError('Failed to fetch'), { message: 'invalid_transition: cancel_one_off_started: the event has already started (today, 2026-10-31); x', code: 'P0001' }];
    await openCancel();
    fireEvent.click(screen.getByRole('button', { name: 'Weather' }));
    await act(async () => { fireEvent.click(confirm()); });
    expect(screen.getByTestId('p3-sheet-error').textContent).toMatch(/offline/);
    await act(async () => { fireEvent.click(confirm()); });
    expect(sent.once[1].key).toBe(sent.once[0].key);
    expect(screen.getByTestId('p3-sheet-error').textContent).toBe(CANCEL_WHY.started);
    fireEvent.click(screen.getByRole('button', { name: 'Illness' }));
    await act(async () => { fireEvent.click(confirm()); });
    expect(sent.once[2].key).not.toBe(sent.once[0].key);
    expect(sent.once[2].command).toEqual({ kind: 'series.cancel_one_off', payload: { reason: 'Illness' } });
  });
});

describe('each refusal reads as plain copy, never a raw token', () => {
  const refusals: Array<[string, string]> = [
    ['invalid_transition: cancel_one_off_started: the event has already started (today, 2026-10-25); an event that has started cannot be cancelled', CANCEL_WHY.started],
    ['invalid_transition: cancel_one_off_past: the date (2026-08-01) has passed; a past event cannot be cancelled', CANCEL_WHY.passed],
    ['invalid_transition: cancel_one_off_not_live: only a live one-off can be cancelled; this one is paused', 'Only an event that is showing can be cancelled. Show it again first, then cancel it.'],
    ['invalid_transition: cancel_one_off_not_one_off: only a one-off event can be cancelled this way; this event is a recurring. Cancel its dates or end its run instead.', 'This event can\u2019t be cancelled this way. Reload the page to see it as it is now.'],
    ['invalid_transition: cancel_one_off_festival: a festival is cancelled through its own flows, not this command', 'This event can\u2019t be cancelled this way. Reload the page to see it as it is now.'],
    ['invalid_transition: cancel_one_off_dates: a one-off must hold exactly one date to be cancelled; this one holds 2', 'This event can\u2019t be cancelled this way. Reload the page to see it as it is now.'],
    ['invalid_payload: cancel_one_off_reason: the reason must be one of: Weather, Illness, Other', 'That reason is no longer on the list. Reload the page, then pick a reason again.'],
    ['permission_denied: series.cancel_one_off needs a reason that is a cancellation_reasons label', 'That reason is no longer on the list. Reload the page, then pick a reason again.'],
    ['permission_denied: series.cancel_one_off payload keys must be reason, not: cancelled', 'That reason is no longer on the list. Reload the page, then pick a reason again.'],
    ['permission_denied: series.cancel_one_off needs an owner or manager membership of series 0b6c', 'You cannot make that change here. Ask the Bachata Calendar team.'],
    ['not_found: series 0b6c does not exist', 'This date or event no longer exists. Reload the page.'],
    ['permission_denied: daily_edit_cap', "You have reached today's limit of 100 changes. You can carry on tomorrow, or ask the Bachata Calendar team."],
    ['version_conflict: expected 7, got 9', VERSION_CONFLICT],
  ];
  it.each(refusals)('%s', (message, copy) => {
    const text = commandErrorMessage({ message, code: 'P0001' });
    expect(text).toBe(copy);
    expect(text).not.toMatch(/cancel_one_off|invalid_|permission_denied|_/);
  });

  it('in the sheet: the copy shows, the sheet stays open, no toast', async () => {
    sent.onceFail = [{ message: refusals[1][0], code: 'P0001' }];
    await openCancel();
    fireEvent.click(screen.getByRole('button', { name: 'Weather' }));
    await act(async () => { fireEvent.click(confirm()); });
    expect(screen.getByTestId('p3-sheet-error').textContent).toBe(CANCEL_WHY.passed);
    expect(screen.queryByTestId('p3-toast')).toBeNull();
    expect(document.body.textContent).not.toMatch(/cancel_one_off|invalid_transition/);
  });
});
