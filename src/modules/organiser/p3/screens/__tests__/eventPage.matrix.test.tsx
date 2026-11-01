// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SHAPES, SHAPE_KEYS, TODAY, ws, type ShapeKey } from './wsFixtures';
import { STATUS_COPY, endPlan, eventPageOf, statusRows } from '../../data/eventPage';
import { CANCEL_WHY, L } from '../../model';
import { NO_SESSION_REASON } from '../../../events/lifecycleModel';
import { commandErrorMessage } from '../../../shared/selfServeErrors';
import { VERSION_CONFLICT } from '../../../shared/copy';
import { P3_PATHS } from '../../shell/paths';
import { parseEventWorkspace } from '../../../events/eventModel';

/*
 * W2a consistency matrix: the event page and its Status sheet x every prod shape
 * (wsFixtures.ts, read through the real parseEventWorkspace), plus the C3 probes that
 * apply here (selfcheck/C3-probes.mjs F13, #8c, R-pol-hide).
 */

const wsQ = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
const sent = vi.hoisted(() => ({ calls: [] as Array<{ commands: unknown[]; version: number | null }>, fail: null as unknown, next: 8 }));

vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-25' }));
vi.mock('../../../shared/runCommands', () => ({
  useEventWorkspace: () => wsQ.value,
  useRunCommands: () => async (commands: unknown[], version: number | null) => {
    sent.calls.push({ commands, version });
    if (sent.fail) throw sent.fail;
    return sent.next;
  },
  useSendOnce: () => async () => { throw new Error('Cancel the event is covered in cancelOneOff.matrix.test.tsx'); },
}));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ isPending: true, data: undefined }) }));

import { EventPage } from '../EventPage';

const ok = (k: ShapeKey) => ({ isPending: false, isError: false, data: ws(k), error: null, refetch: vi.fn() });

function show() {
  return render(
    <MemoryRouter initialEntries={[P3_PATHS.event('ser-1')]}>
      <Routes><Route path="/account/p3/events/:seriesId" element={<EventPage />} /></Routes>
    </MemoryRouter>,
  );
}

const openSheet = () => fireEvent.click(screen.getByTestId('p3-open-status'));
const row = (m: string) => screen.getByTestId(`p3-status-row-${m}`);

beforeEach(() => {
  sent.calls = [];
  sent.fail = null;
  sent.next = 8;
});
afterEach(cleanup);

/** What each shape's header must read: [status chip, kind chip, shape line, when line or null]. */
const HEAD: Record<ShapeKey, [string, string, string, string | null]> = {
  weekly: [L.live, 'Night', 'Weekly social', 'Next: Friday 30 October, Party 9pm, class from 8pm'],
  over100: [L.live, 'Night', 'Weekly social', 'Next: Tuesday 27 October, 9pm'],
  monthly: [L.live, 'Night', 'Monthly social', 'Next: Saturday 7 November, Party 9pm, class from 8pm'],
  custom: ['Nothing coming up', 'Night', 'Dates I pick', null],
  course: [L.live, 'Course', 'Course · 8 classes', 'Next: Wednesday 28 October, 7pm'],
  courseDone: [L.allDone, 'Course', 'Course · 8 classes', null],
  festival: [L.live, 'Festival', 'Festival', 'Next: Friday 20 November, Party 9pm, workshop from 2pm'],
  oneoff: [L.live, 'Night', 'One-off party', 'Next: Saturday 31 October, 9pm'],
  oneoffPast: [L.finished, 'Night', 'One-off party', null],
  tonight: [L.live, 'Night', 'Weekly social', 'Next: Tonight, 9pm'],
  paused: [L.hidden, 'Night', 'Weekly social', 'Next: Friday 30 October, Party 9pm, class from 8pm'],
  draft: [L.draftTag, 'Night', 'One-off party', null],
  draftReady: [L.draftTag, 'Night', 'Weekly social', 'Next: Thursday 29 October, 9pm'],
  ended: [L.finished, 'Night', 'Weekly social', null],
  archived: [L.removed, 'Night', 'Weekly social', null],
  noSessions: [L.live, 'Night', 'Weekly social', `Next: Tomorrow · ${L.noSessions}`],
  noTime: [L.live, 'Night', 'Weekly social', `Next: Saturday 31 October · ${L.noTime}`],
  emptyLineup: [L.live, 'Night', 'Weekly social', 'Next: Thursday 29 October, 9pm'],
};

/** Each shape's Status sheet: move -> null (enabled) or the reason it is greyed. Order matters. */
const ROWS: Record<ShapeKey, Array<[string, string | null]>> = {
  weekly: [['hide', null], ['draft', STATUS_COPY.backDraftWhy], ['end', null], ['stop', null], ['remove', null]],
  over100: [['hide', null], ['draft', STATUS_COPY.backDraftWhy], ['end', null], ['stop', null], ['remove', null]],
  monthly: [['hide', null], ['draft', STATUS_COPY.backDraftWhy], ['end', null], ['stop', null], ['remove', null]],
  custom: [['hide', null], ['draft', STATUS_COPY.backDraftWhy], ['end', null], ['remove', null]],
  course: [['hide', null], ['draft', STATUS_COPY.backDraftWhy], ['end', null], ['stop', STATUS_COPY.courseStop], ['remove', null]],
  courseDone: [['hide', null], ['draft', STATUS_COPY.backDraftWhy], ['end', null], ['stop', STATUS_COPY.courseStop], ['remove', null]],
  festival: [['hide', null], ['draft', STATUS_COPY.backDraftWhy], ['end', STATUS_COPY.neverRan], ['remove', null]],
  oneoff: [['hide', null], ['draft', STATUS_COPY.backDraftWhy], ['end', STATUS_COPY.neverRanOneOff], ['cancel', null], ['remove', null]],
  oneoffPast: [['hide', null], ['draft', STATUS_COPY.backDraftWhy], ['end', null], ['cancel', CANCEL_WHY.passed], ['remove', null]],
  tonight: [['hide', null], ['draft', STATUS_COPY.backDraftWhy], ['end', null], ['stop', null], ['remove', null]],
  paused: [['show', null], ['end', STATUS_COPY.neverRan], ['stop', null], ['remove', null]],
  draft: [['live', STATUS_COPY.noComingDate], ['remove', null]],
  draftReady: [['live', null], ['remove', null]],
  ended: [['reopen', STATUS_COPY.endedWhy]],
  archived: [['reopen', STATUS_COPY.archivedWhy]],
  noSessions: [['hide', null], ['draft', STATUS_COPY.backDraftWhy], ['end', STATUS_COPY.neverRan], ['stop', null], ['remove', null]],
  noTime: [['hide', null], ['draft', STATUS_COPY.backDraftWhy], ['end', STATUS_COPY.neverRan], ['stop', null], ['remove', null]],
  emptyLineup: [['hide', null], ['draft', STATUS_COPY.backDraftWhy], ['end', STATUS_COPY.neverRan], ['stop', null], ['remove', null]],
};

describe('page model x every shape', () => {
  it.each(SHAPE_KEYS)('%s header', (k) => {
    const v = eventPageOf(ws(k), TODAY);
    const [status, kind, shape, when] = HEAD[k];
    expect(v.status.label).toBe(status);
    expect(v.kindWord).toBe(kind);
    expect(v.shape).toBe(shape);
    expect(v.when).toBe(when);
  });

  it.each(SHAPE_KEYS)('%s: no page text carries a raw time, an ISO date or the word pause', (k) => {
    const v = eventPageOf(ws(k), TODAY);
    const text = JSON.stringify([v.name, v.shape, v.status.label, v.when, v.coming.map((c) => c.label), v.comingMore, v.partial]);
    expect(text).not.toMatch(/\d{2}:\d{2}|\d{4}-\d{2}-\d{2}|pause/i);
  });

  it('131 dates: "100 of 131", never a made-up total, and the coming count is from the dates read', () => {
    const v = eventPageOf(ws('over100'), TODAY);
    expect(v.partial).toBe('This page lists the newest 100 of 131 dates.');
    expect(v.coming).toHaveLength(6);
    expect(v.comingMore).toBe('and 51 more dates coming up');
  });

  it('a read with no total says so without a number', () => {
    const raw = structuredClone(SHAPES.over100) as { meta: Record<string, unknown> };
    delete raw.meta.total;
    const v = eventPageOf(parseEventWorkspace(raw), TODAY);
    expect(v.partial).toBe('This page lists the newest 100 dates; older ones are not shown.');
  });

  it('a read holding only coming dates lists none and says more are coming than it can list', () => {
    const w = ws('over100');
    const v = eventPageOf({ ...w, dates: w.dates.filter((d) => d.occurrence_date >= TODAY) }, TODAY);
    expect(v.coming).toEqual([]);
    expect(v.when).toBeNull();
    expect(v.comingMore).toMatch(/^More than \d+ dates are coming up/);
  });

  it('a cancelled coming date is listed as cancelled; a date with its own changes is marked', () => {
    const c = eventPageOf(ws('weekly'), TODAY).coming;
    expect(c.find((x) => x.label === 'Friday 6 November')?.cancelled).toBe(true);
    expect(c.find((x) => x.label === 'Friday 13 November')?.changed).toBe(true);
  });

  it('a festival keeps its programme days; its header starts on day 1', () => {
    const v = eventPageOf(ws('festival'), TODAY);
    expect(v.days.map((d) => d.label)).toEqual(['Day 1', 'Day 2']);
    expect(v.days[1].sessions[0].title).toBe('Musicality');
  });

  it('roles map to C3 nouns; a role C3 has no word for (mc) is not shown under a wrong one', () => {
    const v = eventPageOf(ws('weekly'), TODAY);
    expect(v.days[0].sessions.map((s) => s.people.map((p) => `${p.name}:${p.role}`))).toEqual([['Marco & Elena:teach'], ['DJ Kizzy:dj']]);
    expect(eventPageOf(ws('festival'), TODAY).days[0].sessions[0].people).toEqual([{ name: 'Pao Pao Army', role: 'perform' }]);
  });
});

describe('Status sheet rows x every shape', () => {
  it.each(SHAPE_KEYS)('%s', (k) => {
    expect(statusRows(ws(k), TODAY).map((r) => [r.move, r.reason])).toEqual(ROWS[k]);
  });

  it('a draft with dates but no sessions says to add one', () => {
    const w = ws('draftReady');
    expect(statusRows({ ...w, hasSessions: false }, TODAY)[0].reason).toBe(NO_SESSION_REASON);
  });

  it('a draft with dates and sessions but no cover says to add one (the server go-live gate needs it)', () => {
    const w = ws('draftReady');
    expect(statusRows({ ...w, series: { ...w.series, default_cover_image_url: null } }, TODAY)[0].reason).toBe(STATUS_COPY.noCover);
  });

  it('a weekly read holding only coming dates cannot offer the keep list', () => {
    const w = ws('over100');
    const rows = statusRows({ ...w, dates: w.dates.filter((d) => d.occurrence_date >= TODAY) }, TODAY);
    expect(rows.find((r) => r.move === 'stop')?.reason).toBe(STATUS_COPY.tooManyDates);
  });

  it('every greyed row says why; every enabled row says what it does', () => {
    for (const k of SHAPE_KEYS) {
      for (const r of statusRows(ws(k), TODAY)) {
        if (r.reason) expect(r.reason.length).toBeGreaterThan(10);
        else expect(r.sub?.length ?? 0).toBeGreaterThan(10);
      }
    }
  });

  it('no row copy is a promise of a later update', () => {
    const all = JSON.stringify(STATUS_COPY);
    expect(all).not.toMatch(/coming in the next update|next platform update|coming soon/i);
  });
});

describe('the page x every shape', () => {
  it.each(SHAPE_KEYS)('%s renders its header, sessions, coming dates and about', (k) => {
    wsQ.value = ok(k);
    show();
    const [status, kind] = HEAD[k];
    expect(screen.getByTestId('p3-status').textContent).toBe(status);
    expect(screen.getByTestId('p3-kind').textContent).toBe(kind);
    expect(screen.getByTestId('p3-sessions')).toBeTruthy();
    expect(screen.getByTestId('p3-coming')).toBeTruthy();
    expect(screen.getByTestId('p3-about')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}|pause/i);
  });

  it('0 sessions: the empty state says what to do', () => {
    wsQ.value = ok('noSessions');
    show();
    const e = screen.getByTestId('p3-sessions-empty');
    expect(e.textContent).toContain(L.noSessions);
    // W2d: the sessions are edited here now; the empty state says what to do and the Add button is on the page
    expect(e.textContent).toContain('Add the first one.');
    expect((screen.getByTestId('p3-add-session') as HTMLButtonElement).disabled).toBe(false);
  });

  it('an empty line-up reads "No line-up yet"; a session with no time reads "No time yet"', () => {
    wsQ.value = ok('emptyLineup');
    show();
    expect(screen.getByTestId('p3-lineup').textContent).toBe(L.noLineup);
    cleanup();
    wsQ.value = ok('noTime');
    show();
    expect(screen.getByTestId('p3-session').textContent).toContain(L.noTime);
  });

  it('nothing coming up on a live event: add a date or end it, with the Add a date control (W2b: in P3, not a link out)', () => {
    wsQ.value = ok('custom');
    show();
    const e = screen.getByTestId('p3-coming-empty');
    expect(e.textContent).toContain('Add a date so dancers can find it, or end it');
    expect((screen.getByTestId('p3-add-date') as HTMLButtonElement).disabled).toBe(false);
  });

  it('a finished event says its past dates stay (no "add a date" nag)', () => {
    wsQ.value = ok('ended');
    show();
    expect(screen.getByTestId('p3-coming-empty').textContent).toContain('This has finished.');
  });

  it('empty About rows read "Not set yet"', () => {
    wsQ.value = ok('draft');
    show();
    expect(screen.getByTestId('p3-about').textContent?.match(new RegExp(L.notSet, 'g'))?.length).toBe(4);
    expect(screen.getByTestId('p3-event-name').textContent).toBe(L.noName);
  });

  it('probe F13: ONE status row "Live · Hide or end it"; the sheet words are not on the page', () => {
    wsQ.value = ok('weekly');
    show();
    expect(screen.getByTestId('p3-open-status').textContent).toMatch(/^Live · Hide or end it/);
    expect(screen.queryByText(L.hide)).toBeNull();
  });
});

describe('the read states each say what the person can do', () => {
  const states: Array<[string, Record<string, unknown>, string, RegExp]> = [
    ['loading', { isPending: true, isError: false }, 'p3-event-loading', /Loading the event/],
    ['not yours', { isPending: false, isError: true, error: { message: 'permission_denied: not an editor of series x', code: 'P0001' } }, 'p3-event-notyours', /See your events/],
    ['not found', { isPending: false, isError: true, error: { message: 'series_not_found: x', code: 'P0001' } }, 'p3-event-notfound', /See your events/],
    ['bad id', { isPending: false, isError: true, error: { message: 'invalid input syntax for type uuid: "abc"', code: '22P02' } }, 'p3-event-notfound', /See your events/],
    ['offline', { isPending: false, isError: true, error: new TypeError('Failed to fetch') }, 'p3-event-error', /Try again/],
  ];
  it.each(states)('%s', (_n, q, id, what) => {
    wsQ.value = { refetch: vi.fn(), ...q };
    show();
    expect(screen.getByTestId(id).textContent).toMatch(what);
    expect(document.body.textContent).not.toMatch(/permission_denied|series_not_found|uuid/);
  });
});

describe('the Status sheet sends only what was chosen', () => {
  it.each(SHAPE_KEYS)('%s: opened and closed untouched sends nothing', (k) => {
    wsQ.value = ok(k);
    show();
    openSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByTestId('p3-sheet')).toBeNull();
    expect(sent.calls).toEqual([]);
  });

  it.each(SHAPE_KEYS)('%s: a greyed row is disabled and sends nothing when tapped', (k) => {
    wsQ.value = ok(k);
    show();
    openSheet();
    for (const [move, reason] of ROWS[k]) {
      const b = row(move) as HTMLButtonElement;
      expect(b.disabled).toBe(reason !== null);
      if (reason) {
        expect(b.textContent).toContain(reason);
        fireEvent.click(b);
      }
    }
    expect(sent.calls).toEqual([]);
  });

  it('Escape and the scrim close it without sending', () => {
    wsQ.value = ok('weekly');
    show();
    openSheet();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('p3-sheet')).toBeNull();
    openSheet();
    fireEvent.click(document.querySelector('.p3-scrim')!);
    expect(screen.queryByTestId('p3-sheet')).toBeNull();
    expect(sent.calls).toEqual([]);
  });

  it('probe R-pol-hide / #8c: Hide sends set_lifecycle paused at the shown version; the toast says Hidden; Undo sends live at the NEW version', async () => {
    wsQ.value = ok('weekly');
    show();
    openSheet();
    expect(row('hide').textContent).toContain('Dancers can’t see it until you show it again. Dates kept.');
    await act(async () => { fireEvent.click(row('hide')); });
    expect(sent.calls).toEqual([{ commands: [{ kind: 'series.set_lifecycle', payload: { to: 'paused' } }], version: 7 }]);
    expect(screen.getByTestId('p3-toast').textContent).toMatch(/^Hidden/);
    await act(async () => { fireEvent.click(screen.getByTestId('p3-undo')); });
    expect(sent.calls[1]).toEqual({ commands: [{ kind: 'series.set_lifecycle', payload: { to: 'live' } }], version: 8 });
    expect(screen.getByTestId('p3-toast').textContent).toBe('Undone.');
  });

  it('Show it again sends set_lifecycle live, with Undo', async () => {
    wsQ.value = ok('paused');
    show();
    openSheet();
    await act(async () => { fireEvent.click(row('show')); });
    expect(sent.calls[0].commands).toEqual([{ kind: 'series.set_lifecycle', payload: { to: 'live' } }]);
    expect(screen.getByTestId('p3-toast').textContent).toMatch(/showing again/i);
    expect(screen.getByTestId('p3-undo')).toBeTruthy();
  });

  it('Put it live sends set_lifecycle live, no Undo (live -> draft is not an owner move)', async () => {
    wsQ.value = ok('draftReady');
    show();
    openSheet();
    await act(async () => { fireEvent.click(row('live')); });
    expect(sent.calls[0].commands).toEqual([{ kind: 'series.set_lifecycle', payload: { to: 'live' } }]);
    expect(screen.queryByTestId('p3-undo')).toBeNull();
  });

  it('End it with no date today: the last night and the dates that go; sends end_run with no today_session', async () => {
    wsQ.value = ok('weekly');
    show();
    openSheet();
    fireEvent.click(row('end'));
    expect(screen.queryByTestId('p3-end-question')).toBeNull();
    expect(screen.getByTestId('p3-end-last').textContent).toBe('Friday 23 October');
    expect(screen.getByTestId('p3-end-going').textContent).toBe(
      'These dates coming up will go (9): Friday 30 October, Friday 13 November, Friday 20 November, Friday 27 November and 5 more.');
    fireEvent.click(screen.getByText('Keep it going'));
    expect(sent.calls).toEqual([]);
    openSheet();
    fireEvent.click(row('end'));
    await act(async () => { fireEvent.click(screen.getByTestId('p3-end-confirm')); });
    expect(sent.calls[0].commands).toEqual([{ kind: 'series.end_run', payload: {} }]);
  });

  it('End it with a date today: no default answer, carry on is off until answered; each answer is sent', async () => {
    for (const [label, answer, last] of [['Yes, it ran', 'ran', 'Sunday 25 October'], ['No', 'not_running', 'Sunday 18 October']] as const) {
      sent.calls = [];
      wsQ.value = ok('tonight');
      show();
      openSheet();
      fireEvent.click(row('end'));
      const go = screen.getByTestId('p3-end-confirm') as HTMLButtonElement;
      expect(go.disabled).toBe(true);
      expect(go.textContent).toBe('Answer the question to carry on');
      fireEvent.click(screen.getByText(label));
      expect(screen.getByTestId('p3-end-last').textContent).toBe(last);
      await act(async () => { fireEvent.click(screen.getByTestId('p3-end-confirm')); });
      expect(sent.calls[0].commands).toEqual([{ kind: 'series.end_run', payload: { today_session: answer } }]);
      cleanup();
    }
  });

  it('Stop repeating: every coming date ticked to start; unticking one leaves it out of keep_occurrence_ids', async () => {
    wsQ.value = ok('monthly');
    show();
    openSheet();
    fireEvent.click(row('stop'));
    expect(screen.getByTestId('p3-stop-count').textContent).toBe('Every date coming up is kept.');
    fireEvent.click(screen.getByLabelText('Saturday 7 November'));
    expect(screen.getByTestId('p3-stop-count').textContent).toBe('1 date comes off the calendar.');
    await act(async () => { fireEvent.click(screen.getByTestId('p3-stop-confirm')); });
    expect(sent.calls[0].commands).toEqual([{ kind: 'series.stop_repeating', payload: { keep_occurrence_ids: ['o-2026-12-05'] } }]);
  });

  it('Stop repeating never lists today (the server never touches it)', () => {
    wsQ.value = ok('tonight');
    show();
    openSheet();
    fireEvent.click(row('stop'));
    expect(screen.queryByLabelText('Sunday 25 October')).toBeNull();
    expect(screen.getByLabelText('Sunday 1 November')).toBeTruthy();
  });

  it('Remove asks first, then sends set_lifecycle archived', async () => {
    wsQ.value = ok('draft');
    show();
    openSheet();
    fireEvent.click(row('remove'));
    expect(sent.calls).toEqual([]);
    await act(async () => { fireEvent.click(screen.getByTestId('p3-remove-confirm')); });
    expect(sent.calls[0].commands).toEqual([{ kind: 'series.set_lifecycle', payload: { to: 'archived' } }]);
  });
});

describe('each refusal reads as plain copy, never server text', () => {
  const refusals: Array<[string, string]> = [
    ['invalid_payload: today_session_required: this series has a date today (2026-10-25) that is not cancelled.', 'This event has a date today. Say whether tonight happened, then end it.'],
    ['invalid_transition: series 0b6c has no night this platform can evidence, so there is no date to say it ran until.', 'We have no record of a night this event ran, so it cannot be ended. Remove it instead, or ask the Bachata Calendar team.'],
    ['invalid_transition: course 0b6c is live. A course must keep a schedule while it is live or paused.', 'A course keeps its dates while it runs. End it when the last class is done.'],
    ["invalid_transition: series 0b6c is 'draft'. Only a live or paused series can be ended.", 'Only a live or hidden event can be ended. Reload the page to see it as it is now.'],
    ['invalid_transition: series 0b6c is not a ruled recurring series (format=recurring, has_rule=false)', 'This event does not repeat, so there is nothing to stop. Reload the page to see it as it is now.'],
    ['invalid_transition: series 0b6c has format one_off. Only a recurring series or a course follows a recurrence rule.', 'This event does not repeat, so there is nothing to stop. Reload the page to see it as it is now.'],
    ['lifecycle_transition_denied: live -> draft', 'That status change is not available for this event right now.'],
    ['permission_denied: series.set_lifecycle draft -> live needs a ready series: readiness ok, a cover image and an upcoming scheduled date', 'It is not ready to go live yet: it needs a cover photo, a date coming up and its details. Add them in the current organiser area, then put it live.'],
    ['publish_blocked: missing venue', 'This event needs more details before it can go live again. Ask the Bachata Calendar team.'],
    ['version_conflict: expected 7 got 9', VERSION_CONFLICT],
  ];
  it.each(refusals)('%s', (message, copy) => {
    expect(commandErrorMessage({ message, code: 'P0001' })).toBe(copy);
  });

  it('a refusal in the sheet shows the plain copy and keeps the sheet open', async () => {
    sent.fail = { message: refusals[1][0], code: 'P0001' };
    wsQ.value = ok('oneoffPast');
    show();
    openSheet();
    fireEvent.click(row('end'));
    await act(async () => { fireEvent.click(screen.getByTestId('p3-end-confirm')); });
    expect(screen.getByTestId('p3-sheet-error').textContent).toBe(refusals[1][1]);
    expect(document.body.textContent).not.toMatch(/invalid_transition|evidence/);
  });

  it('a refused Hide shows the copy in the sheet and no toast', async () => {
    sent.fail = { message: 'lifecycle_transition_denied: live -> paused', code: 'P0001' };
    wsQ.value = ok('weekly');
    show();
    openSheet();
    await act(async () => { fireEvent.click(row('hide')); });
    expect(screen.getByTestId('p3-sheet-error').textContent).toBe('That status change is not available for this event right now.');
    expect(screen.queryByTestId('p3-toast')).toBeNull();
  });
});

describe('end plan', () => {
  it('a date today asks; none does not', () => {
    expect(endPlan(ws('tonight'), TODAY).tonight).toBe(true);
    expect(endPlan(ws('weekly'), TODAY).tonight).toBe(false);
  });
});
