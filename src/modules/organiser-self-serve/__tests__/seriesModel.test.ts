import { describe, expect, it } from 'vitest';
import {
  basicsFormFromSeries,
  durationMinutes,
  endTime,
  formToDraft,
  isRuleDate,
  keepsOwnChanges,
  LIFECYCLE_NOTE,
  lifecycleActions,
  minutesBetween,
  parseDateDetail,
  parseWorkspace,
  removedUpcoming,
  scheduleSummary,
  scopeNote,
  timeSpanWarning,
  upcomingDates,
  type WorkspaceDate,
} from '../seriesModel';

const TODAY = '2026-10-04'; // a Sunday, in BST

// Shapes measured on the E2E project 2026-10-04 (admin_event_workspace_p5 and
// event_view_p5 as an owner, in a rolled-back transaction).
const workspaceRaw = {
  meta: { version: 3, has_more: false },
  series: {
    series: {
      id: 'ser-1', name: 'Sunday Class', slug: 'sunday-class', format: 'recurring', category: 'class',
      lifecycle_status: 'live', version: 3, default_venue_id: 'ven-1', default_city_id: 'city-1',
      default_local_start_time: '19:30:00', default_duration: '02:00:00', default_level: null,
      default_ticket_url: null, default_description: 'Weekly', default_cover_image_url: null,
      default_start_date: null, created_at: '2026-10-04T17:08:02+00:00',
      recurrence_rule: { end: { kind: 'none' }, mode: 'weekly', weekdays: [0] },
      removed_dates: ['2026-09-27', '2026-10-18'],
    },
    program: [{ day: { id: 'd' }, sections: [{ section: { id: 's' }, items: [{ item: { id: 'i', start_time: '19:30:00' }, people: [] }] }] }],
  },
  occurrences: [
    { id: 'o3', occurrence_date: '2026-10-25', lifecycle_status: 'scheduled', version: 1, has_override: false, session_overrides_count: 0, added_sessions_count: 0, materialised_start_utc: '2026-10-25T19:30:00+00:00' },
    { id: 'o2', occurrence_date: '2026-10-11', lifecycle_status: 'cancelled', version: 3, has_override: true, session_overrides_count: 0, added_sessions_count: 0, materialised_start_utc: '2026-10-11T19:30:00+00:00' },
    { id: 'o1', occurrence_date: '2026-10-04', lifecycle_status: 'scheduled', version: 2, has_override: false, session_overrides_count: 1, added_sessions_count: 0, materialised_start_utc: '2026-10-04T20:00:00+00:00' },
    { id: 'o0', occurrence_date: '2026-09-27', lifecycle_status: 'scheduled', version: 1, has_override: true, session_overrides_count: 0, added_sessions_count: 0, materialised_start_utc: '2026-09-27T19:30:00+00:00' },
  ],
};

describe('parseWorkspace', () => {
  it('reads the series, its programme and its dates', () => {
    const ws = parseWorkspace(workspaceRaw);
    expect(ws.series.name).toBe('Sunday Class');
    expect(ws.series.version).toBe(3);
    expect(ws.hasSessions).toBe(true);
    expect(ws.dates).toHaveLength(4);
    expect(ws.dates[1]).toMatchObject({ id: 'o2', lifecycle_status: 'cancelled', has_override: true, version: 3 });
  });

  it('a series without programme sessions cannot move a date time', () => {
    const raw = { ...workspaceRaw, series: { ...workspaceRaw.series, program: [] } };
    expect(parseWorkspace(raw).hasSessions).toBe(false);
  });

  it('degrades to empty on an unknown shape', () => {
    const ws = parseWorkspace(null);
    expect(ws.dates).toEqual([]);
    expect(ws.series.removed_dates).toEqual([]);
  });
});

describe('parseDateDetail', () => {
  it('reads overrides, effective values and the per-date time', () => {
    const d = parseDateDetail({
      event: { venue_id: 'ven-1', ticket_url: 'https://t', description: 'Bring water', cover_image_url: null, venue_id_override: null, ticket_url_override: 'https://t', description_override: 'Bring water', cover_image_url_override: null, cancellation_reason_label: 'Venue closed' },
      program: [{ start_time: '20:00:00', cancelled: false }],
      schedule: { timezone: 'UTC', local_start_time: '20:00:00', local_end_time: '22:30:00' },
      occurrence: { id: 'o1', date: '2026-10-11', version: 3, lifecycle_status: 'cancelled', materialised_start_utc: '2026-10-11T20:00:00+00:00' },
      added_sessions: [],
    });
    expect(d).toMatchObject({
      occurrenceId: 'o1', version: 3, cancelled: true, cancellationReason: 'Venue closed',
      start: '20:00', end: '22:30', descriptionOverride: 'Bring water', ticketUrlOverride: 'https://t',
      venueOverride: null, sessionCount: 1,
    });
  });
});

describe('times stay wall-clock', () => {
  it('reads the interval, adds it and wraps past midnight', () => {
    expect(durationMinutes('02:00:00')).toBe(120);
    expect(durationMinutes('1 day')).toBeNull();
    expect(endTime('19:30', 120)).toBe('21:30');
    expect(endTime('23:00', 180)).toBe('02:00');
    expect(minutesBetween('19:30', '21:30')).toBe(120);
    expect(minutesBetween('23:00', '02:00')).toBe(180);
    expect(minutesBetween('19:30', '19:30')).toBeNull();
  });

  it('the basics form shows start and end from the series, and the draft carries minutes', () => {
    const ws = parseWorkspace(workspaceRaw);
    const form = basicsFormFromSeries(ws.series);
    expect(form).toMatchObject({ startTime: '19:30', endTime: '21:30', venueId: 'ven-1', description: 'Weekly', level: '' });
    expect(formToDraft({ ...form, endTime: '22:00' }).durationMinutes).toBe(150);
    expect(formToDraft({ ...form, endTime: '' }).durationMinutes).toBeNull();
  });
});

describe('dates and scope', () => {
  const ws = parseWorkspace(workspaceRaw);
  const upcoming = upcomingDates(ws.dates, TODAY);

  it('lists today onwards, oldest first', () => {
    expect(upcoming.map((d) => d.id)).toEqual(['o1', 'o2', 'o3']);
  });

  it('a date with an override, a session time, an added session or a cancellation keeps its own changes', () => {
    const plain: WorkspaceDate = { id: 'x', occurrence_date: TODAY, lifecycle_status: 'scheduled', version: 1, has_override: false, session_overrides_count: 0, added_sessions_count: 0, materialised_start_utc: null };
    expect(keepsOwnChanges(plain)).toBe(false);
    expect(keepsOwnChanges({ ...plain, has_override: true })).toBe(true);
    expect(keepsOwnChanges({ ...plain, session_overrides_count: 1 })).toBe(true);
    expect(keepsOwnChanges({ ...plain, added_sessions_count: 2 })).toBe(true);
    expect(keepsOwnChanges({ ...plain, lifecycle_status: 'cancelled' })).toBe(true);
  });

  it('the scope note names the dates that keep their changes', () => {
    const note = scopeNote(upcoming, TODAY);
    expect(note.count).toBe(2);
    expect(note.text).toContain('A change here applies to every future date.');
    expect(note.text).toContain('Tonight (own changes) and Sun 11 Oct (cancelled)');
    expect(scopeNote([], TODAY)).toEqual({ count: 0, text: 'A change here applies to every future date. No date has its own changes yet.' });
  });

  it('only the weekly rule dates can be a break', () => {
    expect(isRuleDate('2026-10-11', ws.series)).toBe(true); // a Sunday
    expect(isRuleDate('2026-10-13', ws.series)).toBe(false); // a Tuesday
    expect(isRuleDate('2026-09-27', ws.series)).toBe(false); // before the anchor (created_at)
    expect(isRuleDate('2026-10-11', { ...ws.series, recurrence_rule: null })).toBe(false);
    expect(isRuleDate('2026-10-11', { ...ws.series, recurrence_rule: { mode: 'weekly', weekdays: [0], interval: 2 } })).toBe(false);
    expect(isRuleDate('2026-11-01', { ...ws.series, recurrence_rule: { mode: 'weekly', weekdays: [0], end: { kind: 'until_date', date: '2026-10-25' } } })).toBe(false);
  });

  it('only future dates taken off can be put back', () => {
    expect(removedUpcoming(ws.series, TODAY)).toEqual(['2026-10-18']);
  });

  it('summarises the schedule', () => {
    expect(scheduleSummary(ws.series)).toBe('Weekly · Sundays · 19:30–21:30');
    expect(scheduleSummary({ ...ws.series, format: 'one_off', recurrence_rule: null, default_duration: null })).toBe('One-off · 19:30');
  });
});

describe('lifecycleActions', () => {
  it('offers pause, resume and archive as the server allows an owner', () => {
    expect(lifecycleActions('live').map((a) => a.to)).toEqual(['paused', 'archived']);
    expect(lifecycleActions('paused').map((a) => a.to)).toEqual(['live', 'archived']);
    expect(lifecycleActions('draft').map((a) => a.to)).toEqual(['archived']);
    for (const status of ['pending_review', 'rejected', 'ended', 'archived']) {
      expect(lifecycleActions(status)).toEqual([]);
    }
    expect(lifecycleActions('live').find((a) => a.to === 'archived')?.confirm).toBe(true);
  });
});

describe('LIFECYCLE_NOTE (S1)', () => {
  it('tells the owner a paused page is hidden and Resume puts it back', () => {
    expect(LIFECYCLE_NOTE.paused).toMatch(/hidden/);
    expect(LIFECYCLE_NOTE.paused).toMatch(/Resume/);
    expect(LIFECYCLE_NOTE.paused).not.toMatch(/stays up/);
    expect(LIFECYCLE_NOTE.live).not.toMatch(/keeps the page/);
  });
});

describe('timeSpanWarning (S6)', () => {
  it('warns on the walk case: 21:15 to 21:00 is 23 h 45 min', () => {
    expect(timeSpanWarning('21:15', '21:00')).toMatchObject({ minutes: 23 * 60 + 45, duration: '23 h 45 min', endsNextDay: true });
  });
  it('lets a normal overnight party through (22:00 to 02:00 is 4 h)', () => {
    expect(timeSpanWarning('22:00', '02:00')).toBeNull();
    expect(timeSpanWarning('23:00', '05:30')).toBeNull();
  });
  it('lets a normal same-day slot through, and exactly 12 h', () => {
    expect(timeSpanWarning('19:00', '22:00')).toBeNull();
    expect(timeSpanWarning('10:00', '22:00')).toBeNull();
  });
  it('warns just past 12 h, on the same day too', () => {
    expect(timeSpanWarning('09:00', '21:15')).toMatchObject({ duration: '12 h 15 min', endsNextDay: false });
  });
  it('has nothing to say without a usable end', () => {
    expect(timeSpanWarning('21:15', '')).toBeNull();
    expect(timeSpanWarning('', '21:00')).toBeNull();
    expect(timeSpanWarning('21:15', '21:15')).toBeNull();
  });
});
