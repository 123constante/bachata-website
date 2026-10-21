// @vitest-environment jsdom
/** ER-C9: the date page for one-off / recurring / festival x live / cancelled / past; shift, move, copy, reason. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TODAY, VENUES, dateViewOf, pastOf, programmeOf, shapeByKey, upcomingOf, workspaceOf, type SeriesShape, type ShapeDate } from '../../__tests__/shapes/shapes';

const rpc = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from } }));

import DatePage from '../index';

const REASONS = ['Venue closed', 'Teacher unavailable', 'Bank holiday', 'Low signups', 'Other'].map((label, i) => ({ key: `k${i}`, label }));
let s: SeriesShape;
let d: ShapeDate;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T10:00:00Z`));
  rpc.mockReset();
  from.mockReset();
  from.mockReturnValue({ select: () => ({ is: () => ({ order: async () => ({ data: REASONS, error: null }) }) }) });
  rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
    if (fn === 'organiser_get_occurrence_programme_v1') return { data: programmeOf(s, { ...d, id: String(args.p_occurrence_id ?? d.id) }, true), error: null };
    if (fn === 'event_view_p5') return { data: dateViewOf(s, d), error: null };
    if (fn === 'admin_event_workspace_p5') return { data: workspaceOf(s), error: null };
    if (fn === 'get_organiser_venue_options_v1') return { data: VENUES, error: null };
    if (fn === 'organiser_set_occurrence_programme_v1') return { data: { changed: true }, error: null };
    return { data: { ok: true }, error: null };
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

async function open(shape: SeriesShape, date: ShapeDate) {
  s = shape; d = date;
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[`/account/o/events/${s.id}/dates/${d.id}`]}>
        <Routes><Route path="/account/o/events/:seriesId/dates/:occurrenceId" element={<DatePage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByTestId('date-header');
  await waitFor(() => expect(screen.getByTestId('date-span').textContent).toContain(s.name));
}
const writes = () => rpc.mock.calls.filter(([fn]) => ['organiser_set_occurrence_programme_v1', 'occurrence_command_p5', 'series_command_p5'].includes(fn));

const oneOff = shapeByKey('live-oneoff-upcoming');
const weekly = shapeByKey('live-weekly-until');
const festival = shapeByKey('live-festival');
const oneOffPast = shapeByKey('live-oneoff-past');

describe.each([
  ['one-off', oneOff, upcomingOf(oneOff)[0], 'Cancel the event', true],
  ['recurring', weekly, upcomingOf(weekly)[0], 'Cancel this date', false],
  ['in a festival', festival, upcomingOf(festival)[0], 'Cancel this date', false],
] as const)('%s date', (_n, shape, date, cancelLabel, canMove) => {
  it('names the cancel control for its kind; the move row is for a one-off only', async () => {
    await open(shape, date);
    expect(screen.getByTestId('date-cancel').textContent).toContain(cancelLabel);
    expect(!!screen.queryByTestId('date-move')).toBe(canMove);
  });
  it('untouched: the bar says Saved, is off, and nothing is sent', async () => {
    await open(shape, date);
    const bar = screen.getByTestId('date-preview-bar-action') as HTMLButtonElement;
    expect(bar.disabled).toBe(true);
    expect(writes()).toEqual([]);
  });
});

describe('locked dates show no new control as working', () => {
  it('past one-off: time, move and cancel are disabled', async () => {
    await open(oneOffPast, pastOf(oneOffPast)[0]);
    for (const id of ['date-time', 'date-move', 'date-cancel']) expect((screen.queryByTestId(id) as HTMLButtonElement | null)?.disabled ?? true).toBe(true);
    expect(screen.queryByTestId('date-copy')).toBeNull();
  });
});

describe('shift, then Save this date', () => {
  it('moves every session and sends ONE programme write', async () => {
    await open(weekly, upcomingOf(weekly)[0]);
    fireEvent.click(screen.getByTestId('date-time'));
    const opts = await screen.findAllByTestId('time-option');
    fireEvent.click(opts.find((o) => o.textContent === '20:30')!);
    await waitFor(() => expect((screen.getByTestId('date-preview-bar-action') as HTMLButtonElement).textContent).toContain('Save this date'));
    fireEvent.click(screen.getByTestId('date-preview-bar-action'));
    await waitFor(() => expect(writes().length).toBeGreaterThan(0));
    const w = writes();
    expect(w).toHaveLength(1);
    const sessions = (w[0][1] as { p_sessions?: { start_time: string }[]; p_programme?: { start_time: string }[] });
    const list = (sessions.p_sessions ?? sessions.p_programme ?? Object.values(sessions).find(Array.isArray)) as { start_time: string }[];
    expect(list.map((x) => x.start_time)).toEqual(['20:30', '21:30']);
  });
});

describe('copy changes from another date', () => {
  it('lists other coming dates and fills the draft without sending', async () => {
    await open(weekly, upcomingOf(weekly)[0]);
    fireEvent.click(screen.getByTestId('date-copy'));
    const opts = await screen.findAllByTestId('copy-option');
    expect(opts.length).toBe(upcomingOf(weekly).length - 1);
    fireEvent.click(opts[0]);
    await waitFor(() => expect((screen.getByTestId('date-preview-bar-action') as HTMLButtonElement).disabled).toBe(false));
    expect(writes()).toEqual([]);
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
});

describe('one-off move to another day', () => {
  it('a bad day cannot be used; a good one is saved with Save this date', async () => {
    await open(oneOff, upcomingOf(oneOff)[0]);
    fireEvent.click(screen.getByTestId('date-move'));
    const input = await screen.findByTestId('date-move-input');
    fireEvent.change(input, { target: { value: '2026-10-01' } });
    expect((screen.getByTestId('date-move-done') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(input, { target: { value: '2026-12-24' } });
    expect((screen.getByTestId('date-move-done') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByTestId('date-move-done'));
    await waitFor(() => expect((screen.getByTestId('date-preview-bar-action') as HTMLButtonElement).disabled).toBe(false));
    expect(writes()).toEqual([]);
    fireEvent.click(screen.getByTestId('date-preview-bar-action'));
    await waitFor(() => expect(writes().length).toBe(1));
    const env = (writes()[0][1] as { p_envelope: { command: { kind: string; payload: { to_date: string } } } }).p_envelope.command;
    expect(env).toEqual({ kind: 'occurrence.move_date', payload: { to_date: '2026-12-24' } });
  });
});
