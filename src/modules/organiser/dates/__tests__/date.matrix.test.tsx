// @vitest-environment jsdom
/**
 * F4 matrix: the date editor rendered for each real kind of date (shapes.ts,
 * from the prod survey) through the real programme / date / workspace parsers:
 * a past date, a cancelled date (running and ended event), a date with
 * sessions, a date with none, a date of an archived event. Rules: (1) the tag
 * says Cancelled or the event's lifecycle word; (3) every empty state says what
 * the person can do; (4) a control the server refuses for this date is disabled
 * WITH a reason (never offered as if it worked) and nothing is sent untouched;
 * (bar) a slim bar while nothing is unsaved.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  LIFECYCLE_WORD, TODAY, VENUES, dateViewOf, pastOf, programmeOf, shapeByKey, upcomingOf, workspaceOf, type SeriesShape, type ShapeDate,
} from '../../__tests__/shapes/shapes';

const rpc = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from } }));

import DatePage from '../index';

let s: SeriesShape;
let d: ShapeDate;
let withSessions: boolean;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T10:00:00Z`));
  rpc.mockReset();
  from.mockReset();
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'organiser_get_occurrence_programme_v1') return { data: programmeOf(s, d, withSessions), error: null };
    if (fn === 'event_view_p5') return { data: dateViewOf(s, d), error: null };
    if (fn === 'admin_event_workspace_p5') return { data: workspaceOf(s), error: null };
    if (fn === 'get_organiser_venue_options_v1') return { data: VENUES, error: null };
    return { data: null, error: { message: `unexpected ${fn}` } };
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function open(shape: SeriesShape, date: ShapeDate, sessions: boolean) {
  s = shape;
  d = date;
  withSessions = sessions;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/account/o/events/${s.id}/dates/${d.id}`]}>
        <Routes>
          <Route path="/account/o/events/:seriesId/dates/:occurrenceId" element={<DatePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByTestId('date-header');
  // The series read (name, lifecycle) and the date read land after the programme.
  await waitFor(() => expect(screen.getByTestId('date-span').textContent).toContain(s.name));
  if (d.status === 'cancelled') await screen.findByTestId('date-cancelled-note');
}

const live = shapeByKey('live-weekly-until');
const open_ = shapeByKey('live-weekly-open');
const picnic = shapeByKey('ended-picnic');
const endedUp = shapeByKey('ended-upcoming-cancelled');
const pending = shapeByKey('pending-weekly');
const archived = shapeByKey('archived-norule-past');

const CASES: [string, SeriesShape, ShapeDate, boolean][] = [
  ['past date, running event, with sessions', live, pastOf(live)[pastOf(live).length - 1], true],
  ['upcoming date with sessions', live, upcomingOf(live)[0], true],
  ['upcoming date with no sessions', pending, upcomingOf(pending)[0], false],
  ['cancelled upcoming date, running event', open_, upcomingOf(open_).find((x) => x.status === 'cancelled')!, true],
  ['cancelled upcoming date, ENDED event', endedUp, upcomingOf(endedUp)[0], true],
  ['past date of an ended event (Bachata Picnic shape)', picnic, pastOf(picnic)[pastOf(picnic).length - 1], true],
  ['past cancelled date of an ended event', picnic, pastOf(picnic).find((x) => x.status === 'cancelled')!, false],
  ['past date of an archived event, no sessions', archived, pastOf(archived)[0], false],
];

const isOn = (el: Element | null) => !!el && el.tagName === 'BUTTON' && !(el as HTMLButtonElement).disabled;
const sent = () => rpc.mock.calls.filter(([fn]) => ['organiser_set_occurrence_programme_v1', 'occurrence_command_p5', 'series_command_p5'].includes(fn));

describe.each(CASES)('%s', (_name, shape, date, sessions) => {
  const past = date.date < TODAY;
  const closed = shape.lifecycle === 'ended' || shape.lifecycle === 'archived';
  const cancelled = date.status === 'cancelled';

  it('(1) the tag says Cancelled or the event\'s lifecycle word', async () => {
    await open(shape, date, sessions);
    const want = cancelled ? 'Cancelled' : LIFECYCLE_WORD[shape.lifecycle];
    await waitFor(() => expect(screen.getByTestId('date-status').textContent).toBe(want));
  });

  it('(4) what the server refuses is disabled with a reason; untouched sends nothing', async () => {
    await open(shape, date, sessions);
    const page = screen.getByTestId('org-page-date');
    const venue = screen.getByTestId('date-venue');
    const cancel = screen.queryByTestId('date-cancel');
    const brk = screen.queryByTestId('date-break');
    const uncancel = screen.queryByTestId('date-uncancel');
    if (past || closed) {
      expect(isOn(venue)).toBe(false);
      expect(isOn(cancel)).toBe(false);
      expect(isOn(brk)).toBe(false);
      expect(isOn(uncancel)).toBe(false);
      expect(page.textContent).toMatch(past ? /already happened/ : /ended|archived/);
    } else if (cancelled) {
      expect(isOn(uncancel)).toBe(true);
    } else {
      expect(isOn(cancel)).toBe(true);
      expect(isOn(venue)).toBe(true);
    }
    // A locked date shows no save bar (saveBarState); otherwise it is disabled while untouched.
    const action = screen.queryByTestId('date-preview-bar-action') as HTMLButtonElement | null;
    if (past || closed) expect(action).toBeNull();
    else expect(action?.disabled).toBe(true);
    expect(sent()).toEqual([]);
  });

  it('(3) the schedule says what the person can do', async () => {
    await open(shape, date, sessions);
    const schedule = screen.getByTestId('date-schedule').parentElement!;
    if (!sessions) expect(within(schedule).getByTestId('date-schedule-empty')).toBeTruthy();
    const canAdd = !!screen.queryByTestId('date-add-session');
    expect(canAdd).toBe(!past && !closed && !cancelled);
    if (!canAdd) expect((screen.queryByTestId('date-locked-note') ?? screen.getByTestId('date-readonly-note')).textContent).toMatch(/\w+/);
  });

  it('(bar) nothing unsaved: a slim bar, no preview card', async () => {
    await open(shape, date, sessions);
    expect(screen.queryByTestId('date-preview-bar-preview')).toBeNull();
  });
});
