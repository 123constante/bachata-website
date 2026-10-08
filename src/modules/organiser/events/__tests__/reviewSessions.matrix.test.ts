import { describe, expect, it } from 'vitest';
import { TODAY, shapeByKey, workspaceOf } from '../../__tests__/shapes/shapes';
import { parseEventWorkspace } from '../eventModel';
import { upcomingDates } from '@/modules/organiser/shared/seriesModel';
import { NO_SESSION_REASON, eventReviewView, sessionDates } from '../reviewModel';

// Owner, 2026-10-08: Send for review stays off until at least one session sits on
// at least one upcoming listed date, the admin editor's publish rule (admin
// lib/programTreeContentValidation.ts, #711): series programme items OR a per-date
// added session. Prod survey (2026-10-08, counts): organiser drafts are recurring
// class/party with per-date added sessions only; one pending_review class had NO
// session anywhere (the case this closes).

type Kind = 'class' | 'party' | 'workshop';
type Sessions = 'none' | 'series-item' | 'per-date';

/** admin_event_workspace_p5 for an organiser draft of `kind` with `sessions`. */
function workspace(kind: Kind, sessions: Sessions, opts: { addedOn?: 'next' | 'past' | 'cancelled' } = {}) {
  const raw = workspaceOf(shapeByKey('draft-norule-one'));
  raw.series.series.category = kind;
  raw.series.series.type = kind;
  if (kind === 'class') {
    // A class is created weekly: add a past date and a cancelled upcoming one too.
    raw.occurrences.push(
      { ...raw.occurrences[0], id: 'past', occurrence_date: '2026-10-01', lifecycle_status: 'scheduled' },
      { ...raw.occurrences[0], id: 'off', occurrence_date: '2026-10-24', lifecycle_status: 'cancelled', has_override: true },
    );
  }
  if (sessions === 'series-item') {
    (raw.series as { program: unknown }).program = [
      { sections: [{ items: [{ item: { title: 'Party', start_time: '1970-01-01T20:00:00', end_time: '1970-01-01T23:00:00' } }] }] },
    ];
  }
  if (sessions === 'per-date') {
    const id = opts.addedOn === 'past' ? 'past' : opts.addedOn === 'cancelled' ? 'off' : raw.occurrences[0].id;
    const d = raw.occurrences.find((o) => o.id === id);
    if (!d) throw new Error(`no date ${id}`);
    d.added_sessions_count = 1;
  }
  return parseEventWorkspace(raw);
}

function review(kind: Kind, sessions: Sessions, dirty = false, opts: { addedOn?: 'next' | 'past' | 'cancelled' } = {}) {
  const ws = workspace(kind, sessions, opts);
  const upcoming = upcomingDates(ws.dates, TODAY);
  return eventReviewView({
    status: 'draft',
    missing: [],
    upcomingListed: upcoming.filter((d) => d.lifecycle_status !== 'cancelled').length,
    datesWithSessions: sessionDates(ws.hasSessions, upcoming),
    organisers: [{ name: 'Org', lifecycle_status: 'live' }],
    dirty,
  });
}

describe('Send for review needs a session on an upcoming listed date', () => {
  const kinds: Kind[] = ['class', 'party', 'workshop'];
  const cases: Array<[Sessions, boolean, boolean]> = [
    // sessions, unsaved edits, can send
    ['none', false, false],
    ['none', true, false],
    ['series-item', false, true],
    ['series-item', true, false],
    ['per-date', false, true],
    ['per-date', true, false],
  ];
  for (const kind of kinds) {
    it.each(cases)(`${kind}: sessions %s, unsaved %s -> can send %s`, (sessions, dirty, canSend) => {
      const v = review(kind, sessions, dirty);
      expect(v.canSend).toBe(canSend);
      expect(v.blockers.includes(NO_SESSION_REASON)).toBe(sessions === 'none');
      expect(v.blockers.includes('Save your changes first.')).toBe(dirty);
    });
  }

  it('the reason reads exactly as the owner asked', () => {
    expect(NO_SESSION_REASON).toBe('Add at least one session first.');
    expect(review('party', 'none').blockers).toEqual([NO_SESSION_REASON]);
  });

  it('a session only on a past date does not count', () => {
    const v = review('class', 'per-date', false, { addedOn: 'past' });
    expect(v.canSend).toBe(false);
    expect(v.blockers).toContain(NO_SESSION_REASON);
  });

  it('a session only on a cancelled date does not count', () => {
    const v = review('class', 'per-date', false, { addedOn: 'cancelled' });
    expect(v.canSend).toBe(false);
    expect(v.blockers).toContain(NO_SESSION_REASON);
  });

  it('no upcoming date: asks for the date, not also for a session', () => {
    const v = eventReviewView({
      status: 'draft', missing: [], upcomingListed: 0, datesWithSessions: 0,
      organisers: [{ name: 'Org', lifecycle_status: 'live' }], dirty: false,
    });
    expect(v.canSend).toBe(false);
    expect(v.blockers).toEqual(['To send it, add an upcoming date.']);
  });

  it('sessionDates counts every listed upcoming date when the series programme has a session', () => {
    const ws = workspace('class', 'series-item');
    expect(sessionDates(ws.hasSessions, upcomingDates(ws.dates, TODAY))).toBe(1);
    const per = workspace('class', 'per-date');
    expect(sessionDates(per.hasSessions, upcomingDates(per.dates, TODAY))).toBe(1);
    const none = workspace('class', 'none');
    expect(sessionDates(none.hasSessions, upcomingDates(none.dates, TODAY))).toBe(0);
  });
});
