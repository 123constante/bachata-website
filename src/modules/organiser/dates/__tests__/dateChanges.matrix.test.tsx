// @vitest-environment jsdom
/**
 * ER-C9 + ER-FIX2-S6: the date page for one-off / recurring / festival / course x
 * live / cancelled / past, with the rebuild switch ON for the event (decision 2)
 * and OFF (the page as before C9). Rewritten from the C9 matrix: the one-off's
 * "Cancel the event" is parked (decision 11), Night starts is an inline select,
 * the one-off move is a list, copy lists only dates with own changes, and copy
 * carries untimed / untitled sessions as they are (F-C9-1, prod 223 / 239).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TODAY, VENUES, dateViewOf, pastOf, programmeOf, shapeByKey, upcomingOf, workspaceOf, type SeriesShape, type ShapeDate } from '../../__tests__/shapes/shapes';
import { RebuildSwitchContext } from '@/modules/organiser/shell/rebuildSwitch';

const rpc = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from } }));

import DatePage from '../index';

const REASONS = ['Venue closed', 'Teacher unavailable', 'Bank holiday', 'Low signups', 'Other'].map((label, i) => ({ key: `k${i}`, label }));
let s: SeriesShape;
let d: ShapeDate;
/** The date copied from: its programme, and which dates have their own changes. */
let sourceProgramme: ((id: string) => unknown) | null = null;
let ownDates = new Set<string>();
let cancelRefusal: string | null = null;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T10:00:00Z`));
  rpc.mockReset();
  from.mockReset();
  sourceProgramme = null;
  ownDates = new Set();
  cancelRefusal = null;
  from.mockReturnValue({ select: () => ({ is: () => ({ order: async () => ({ data: REASONS, error: null }) }) }) });
  rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
    if (fn === 'organiser_get_occurrence_programme_v1') {
      const id = String(args.p_occurrence_id ?? d.id);
      if (id !== d.id && sourceProgramme) return { data: sourceProgramme(id), error: null };
      return { data: programmeOf(s, { ...d, id }, true), error: null };
    }
    if (fn === 'event_view_p5') return { data: dateViewOf(s, d), error: null };
    if (fn === 'admin_event_workspace_p5') {
      const ws = workspaceOf(s);
      ws.occurrences = ws.occurrences.map((o) => (ownDates.has(o.id) ? { ...o, session_overrides_count: 1 } : o));
      return { data: ws, error: null };
    }
    if (fn === 'get_organiser_venue_options_v1') return { data: VENUES, error: null };
    if (fn === 'organiser_set_occurrence_programme_v1') return { data: { ok: true, changed: true, version: 4 }, error: null };
    if (fn === 'occurrence_command_p5' && cancelRefusal) {
      // The first answer was lost; the date IS cancelled now and the retry is refused.
      d = { ...d, status: 'cancelled' };
      return { data: null, error: { message: cancelRefusal, code: 'P0001' } };
    }
    return { data: { ok: true }, error: null };
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

async function open(shape: SeriesShape, date: ShapeDate, rebuilt = true) {
  s = shape; d = date;
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RebuildSwitchContext.Provider value={{ raw: rebuilt ? '*' : undefined, on: rebuilt, pending: false }}>
        <MemoryRouter initialEntries={[`/account/o/events/${s.id}/dates/${d.id}`]}>
          <Routes><Route path="/account/o/events/:seriesId/dates/:occurrenceId" element={<DatePage />} /></Routes>
        </MemoryRouter>
      </RebuildSwitchContext.Provider>
    </QueryClientProvider>,
  );
  await screen.findByTestId('date-header');
  await waitFor(() => expect(screen.getByTestId('date-span').textContent).toContain(s.name));
}
const writes = () => rpc.mock.calls.filter(([fn]) => ['organiser_set_occurrence_programme_v1', 'occurrence_command_p5', 'series_command_p5'].includes(fn));
const sentSessions = () => {
  const w = writes().find(([fn]) => fn === 'organiser_set_occurrence_programme_v1');
  return (w ? Object.values(w[1] as Record<string, unknown>).find(Array.isArray) : null) as Record<string, unknown>[] | null;
};
const bar = () => screen.getByTestId('date-preview-bar-action') as HTMLButtonElement;

const oneOff = shapeByKey('live-oneoff-upcoming');
const weekly = shapeByKey('live-weekly-until');
const festival = shapeByKey('live-festival');
const course = shapeByKey('live-course');
const oneOffPast = shapeByKey('live-oneoff-past');

describe.each([
  ['one-off', oneOff, 'Cancel the event', true, true],
  ['recurring', weekly, 'Cancel this date', false, false],
  ['in a festival', festival, 'Cancel this date', false, false],
  ['course', course, 'Cancel this date', false, false],
] as const)('%s date, rebuilt screens', (_n, shape, cancelLabel, canMove, cancelParked) => {
  it('names the cancel control; a one-off\'s is off with the reason; move is one-off only; no Take this date off', async () => {
    await open(shape, upcomingOf(shape)[0]);
    const cancel = screen.getByTestId('date-cancel') as HTMLButtonElement;
    expect(cancel.textContent).toContain(cancelLabel);
    expect(cancel.disabled).toBe(cancelParked);
    if (cancelParked) expect(cancel.textContent).toContain('Not available yet');
    expect(!!screen.queryByTestId('date-move')).toBe(canMove);
    expect(screen.queryByTestId('date-break')).toBeNull();
  });
  it('untouched: the bar is off and nothing is sent', async () => {
    await open(shape, upcomingOf(shape)[0]);
    expect(bar().disabled).toBe(true);
    expect(writes()).toEqual([]);
  });
});

describe('switch OFF for the event: the page as before C9', () => {
  it.each([['one-off', oneOff], ['recurring', weekly]] as const)('%s: no Night starts, move or copy; a one-off cancels its date', async (_n, shape) => {
    ownDates = new Set(upcomingOf(shape).map((x) => x.id));
    await open(shape, upcomingOf(shape)[0], false);
    for (const id of ['date-time', 'date-move', 'date-copy']) expect(screen.queryByTestId(id)).toBeNull();
    const cancel = screen.getByTestId('date-cancel') as HTMLButtonElement;
    expect(cancel.textContent).toContain('Cancel this date');
    expect(cancel.disabled).toBe(false);
  });
  it('a weekly date still offers Take this date off', async () => {
    await open(weekly, upcomingOf(weekly)[0], false);
    expect(screen.getByTestId('date-break')).toBeTruthy();
  });
});

describe('locked dates show no new control as working', () => {
  it('past one-off: night starts, move and cancel are disabled', async () => {
    await open(oneOffPast, pastOf(oneOffPast)[0]);
    for (const id of ['date-time', 'date-move', 'date-cancel']) expect((screen.queryByTestId(id) as HTMLButtonElement | null)?.disabled ?? true).toBe(true);
    expect(screen.queryByTestId('date-copy')).toBeNull();
  });
});

describe('Night starts (inline select), then Save this date', () => {
  it('marks the usual time, moves every session and sends ONE programme write', async () => {
    await open(weekly, upcomingOf(weekly)[0]);
    const select = screen.getByTestId('date-time') as HTMLSelectElement;
    expect([...select.options].find((o) => o.value === '0')?.textContent).toBe('20:00 (usual)');
    fireEvent.change(select, { target: { value: '30' } });
    await waitFor(() => expect(bar().disabled).toBe(false));
    expect((screen.getByTestId('date-time') as HTMLSelectElement).options[8].textContent).toBe('20:30');
    fireEvent.click(bar());
    await waitFor(() => expect(writes().length).toBeGreaterThan(0));
    expect(writes()).toHaveLength(1);
    expect(sentSessions()?.map((x) => x.start_time)).toEqual(['20:30', '21:30']);
  });
});

describe('copy changes from another date', () => {
  it('lists only coming dates with their own changes', async () => {
    const up = upcomingOf(weekly);
    ownDates = new Set([up[2].id]);
    await open(weekly, up[0]);
    fireEvent.click(screen.getByTestId('date-copy'));
    expect(await screen.findAllByTestId('copy-option')).toHaveLength(1);
  });
  it('no date with own changes: no copy row', async () => {
    await open(weekly, upcomingOf(weekly)[0]);
    expect(screen.queryByTestId('date-copy')).toBeNull();
  });
  it('an untimed, untitled source session copies and saves; series sessions are edited, never re-created (F-C9-1, F-C9-2)', async () => {
    const up = upcomingOf(weekly);
    ownDates = new Set([up[1].id]);
    sourceProgramme = (id) => ({
      ...programmeOf(weekly, { ...up[1], id }, true),
      sessions: [
        { series_item_id: 'i1', type: 'class', title: 'Beginners', start_time: '19:30', end_time: '20:30', ends_next_day: false, level_keys: ['beginner'], removed: false },
        { series_item_id: 'i2', type: 'party', title: null, start_time: null, end_time: null, ends_next_day: false, level_keys: [], removed: false },
      ],
    });
    await open(weekly, up[0]);
    fireEvent.click(screen.getByTestId('date-copy'));
    fireEvent.click((await screen.findAllByTestId('copy-option'))[0]);
    await waitFor(() => expect(bar().disabled).toBe(false));
    expect(writes()).toEqual([]);
    fireEvent.click(bar());
    await waitFor(() => expect(sentSessions()).not.toBeNull());
    expect(screen.queryByTestId('date-save-error')).toBeNull();
    const sent = sentSessions()!;
    expect(sent.map((x) => [x.series_item_id, x.start_time, x.removed])).toEqual([['i1', '19:30', false], ['i2', '21:00', false]]);
    expect(sent.some((x) => x.new === true)).toBe(false);
  });
});

describe('cancel needs a reason from the server list', () => {
  it('no free text; the button works only with a reason and the tick', async () => {
    await open(weekly, upcomingOf(weekly)[0]);
    fireEvent.click(screen.getByTestId('date-cancel'));
    const chips = await screen.findAllByTestId('cancel-reason');
    expect(chips.map((c) => c.textContent)).toEqual(REASONS.map((r) => r.label));
    expect(screen.getByTestId('date-cancel-view').querySelector('input[type=text], textarea')).toBeNull();
    const go = screen.getByTestId('date-cancel-confirm') as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    fireEvent.click(chips[0]);
    expect(go.disabled).toBe(true);
    fireEvent.click(screen.getByTestId('cancel-ack'));
    expect(go.disabled).toBe(false);
    expect(writes()).toEqual([]);
  });
  it.each([['version_conflict: expected 1, got 2'], ['invalid_transition: occurrence is already cancelled']])(
    'a retried cancel refused with "%s" while the date IS cancelled is success (F-C9-10)', async (refusal) => {
      cancelRefusal = refusal;
      await open(weekly, upcomingOf(weekly)[0]);
      fireEvent.click(screen.getByTestId('date-cancel'));
      fireEvent.click((await screen.findAllByTestId('cancel-reason'))[0]);
      fireEvent.click(screen.getByTestId('cancel-ack'));
      fireEvent.click(screen.getByTestId('date-cancel-confirm'));
      await waitFor(() => expect(screen.getByTestId('date-cancelled-note')).toBeTruthy());
      expect(screen.queryByTestId('date-command-error')).toBeNull();
    });
});

describe('one-off move to another day: a list of valid days (F-C9-8)', () => {
  it('offers no past day and not its own; the pick is saved with Save this date', async () => {
    const date = upcomingOf(oneOff)[0];
    await open(oneOff, date);
    fireEvent.click(screen.getByTestId('date-move'));
    const opts = await screen.findAllByTestId('move-option');
    expect(opts).toHaveLength(30);
    expect(screen.queryByTestId('date-move-input')).toBeNull();
    expect((screen.getByTestId('date-move-done') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(opts[3]);
    expect(opts[3].getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByTestId('date-move-done'));
    await waitFor(() => expect(bar().disabled).toBe(false));
    expect(writes()).toEqual([]);
    fireEvent.click(bar());
    await waitFor(() => expect(writes().length).toBe(1));
    const env = (writes()[0][1] as { p_envelope: { command: { kind: string; payload: { to_date: string } } } }).p_envelope.command;
    expect(env).toEqual({ kind: 'occurrence.move_date', payload: { to_date: '2026-10-11' } });
  });
});
