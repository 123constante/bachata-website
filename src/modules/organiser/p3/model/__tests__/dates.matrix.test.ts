import { describe, expect, it } from 'vitest';
import { DATE_CAP, DATE_WHY, L, addDateWhy, dateActions, dateMarks, pickDayProblem } from '..';
import type { DateAction, DateFacts, P3Kind, SeriesFacts } from '..';

/*
 * W2b: THE date rule set (model/dates.ts), kind x date state x list size. Each cell names
 * the actions that are ENABLED; every other row is listed greyed WITH a reason (never
 * hidden). Shapes from the read-only prod survey of 27 Oct 2026 (live + paused, counts
 * only): weekly 38 series (26 with over 30 coming, 1 over 100 stored, 7 cancelled coming,
 * 6 breaks coming, 1 own-time coming), monthly 6, course 6 (2 with none coming), custom 1,
 * festival 8 (at most 1 coming), one-off 12 (10 with none coming).
 */

const TODAY = '2026-10-25';
const KINDS: P3Kind[] = ['weekly', 'monthly', 'course', 'custom', 'oneoff', 'festival'];

type StateKey = 'coming' | 'today' | 'past' | 'cancelled' | 'skipped' | 'moved' | 'ownTime' | 'ownDetails' | 'added' | 'pastCancelled';
const STATES: Record<StateKey, DateFacts> = {
  coming: { date: '2026-10-30', state: 'scheduled', ruleDate: true, ownTime: false, ownDetails: false },
  today: { date: TODAY, state: 'scheduled', ruleDate: true, ownTime: false, ownDetails: false },
  past: { date: '2026-10-16', state: 'scheduled', ruleDate: true, ownTime: false, ownDetails: false },
  cancelled: { date: '2026-11-06', state: 'cancelled', ruleDate: true, ownTime: false, ownDetails: false },
  pastCancelled: { date: '2026-10-09', state: 'cancelled', ruleDate: true, ownTime: false, ownDetails: false },
  skipped: { date: '2026-11-13', state: 'skip', ruleDate: true, ownTime: false, ownDetails: false },
  moved: { date: '2026-11-21', state: 'scheduled', ruleDate: false, ownTime: false, ownDetails: false },
  ownTime: { date: '2026-11-20', state: 'scheduled', ruleDate: true, ownTime: true, ownDetails: false },
  ownDetails: { date: '2026-11-27', state: 'scheduled', ruleDate: true, ownTime: false, ownDetails: true },
  added: { date: '2026-12-02', state: 'cancelled', ruleDate: false, ownTime: false, ownDetails: false },
};

/** Only a weekly rule (weekly, course) generates rule dates (seriesModel.isRuleDate). */
const facts = (kind: P3Kind, s: StateKey): DateFacts => ({ ...STATES[s], ruleDate: (kind === 'weekly' || kind === 'course') && STATES[s].ruleDate });
const series = (kind: P3Kind, upcoming = 10, extra: Partial<SeriesFacts> = {}): SeriesFacts =>
  ({ kind, lifecycle: 'live', upcoming, ...(kind === 'oneoff' ? { oneOff: { ok: true, reason: null } } : {}), ...extra });
const enabled = (s: SeriesFacts, d: DateFacts) => dateActions(s, d, TODAY).filter((r) => r.reason === null).map((r) => r.action).sort();

const CORE: DateAction[] = ['bringBack', 'details', 'move', 'remove', 'skip', 'time'];

/** Remove is listed, never enabled: organisers never delete a date (owner answer 20; events/__tests__/moveNotRemove). */
const WEEKLY_COMING: DateAction[] = ['cancel', 'details', 'move', 'skip', 'time'];

/** Expected ENABLED actions per kind x state (list size 4-30, live). */
const EXPECT: Record<P3Kind, Record<StateKey, DateAction[]>> = {
  weekly: {
    coming: WEEKLY_COMING, today: WEEKLY_COMING, past: [], cancelled: ['bringBack'], pastCancelled: [], skipped: ['unskip'],
    moved: ['cancel', 'details', 'move', 'time'], ownTime: [...WEEKLY_COMING, 'resetNormal', 'resetTime'],
    ownDetails: [...WEEKLY_COMING, 'resetNormal'], added: ['bringBack'],
  },
  course: {} as Record<StateKey, DateAction[]>,
  monthly: {
    coming: ['cancel', 'details', 'move', 'time'], today: ['cancel', 'details', 'move', 'time'], past: [], cancelled: ['bringBack'],
    pastCancelled: [], skipped: [], moved: ['cancel', 'details', 'move', 'time'], ownTime: ['cancel', 'details', 'move', 'resetNormal', 'resetTime', 'time'],
    ownDetails: ['cancel', 'details', 'move', 'resetNormal', 'time'], added: ['bringBack'],
  },
  custom: {} as Record<StateKey, DateAction[]>,
  oneoff: {
    coming: ['cancelEvent', 'details', 'move', 'time'], today: ['cancelEvent', 'details', 'move', 'time'], past: [], cancelled: ['bringBack'],
    pastCancelled: [], skipped: [], moved: ['cancelEvent', 'details', 'move', 'time'], ownTime: ['cancelEvent', 'details', 'move', 'resetNormal', 'resetTime', 'time'],
    ownDetails: ['cancelEvent', 'details', 'move', 'resetNormal', 'time'], added: ['bringBack'],
  },
  // A festival's date takes occurrence.cancel (no format rule in _cmd_occurrence_cancel_p5;
  // the owner refusals are set_time and move_date only): review 1062 r1 finding 4.
  festival: {
    coming: ['cancel', 'details'], today: ['cancel', 'details'], past: [], cancelled: ['bringBack'], pastCancelled: [], skipped: [], moved: ['cancel', 'details'],
    ownTime: ['cancel', 'details', 'resetNormal'], ownDetails: ['cancel', 'details', 'resetNormal'], added: ['bringBack'],
  },
};
EXPECT.course = EXPECT.weekly;
EXPECT.custom = EXPECT.monthly;

describe('W2b date rules: kind x date state (enabled actions; the rest greyed with a reason)', () => {
  for (const kind of KINDS) {
    for (const st of Object.keys(STATES) as StateKey[]) {
      it(`${kind} x ${st}`, () => {
        const s = series(kind);
        const d = facts(kind, st);
        expect(enabled(s, d)).toEqual([...EXPECT[kind][st]].sort());
        for (const r of dateActions(s, d, TODAY)) {
          if (r.reason !== null) expect(r.reason.length).toBeGreaterThan(10);
          expect(r.title).toBe(L.dateAct[r.action][0]);
        }
      });
    }
  }
});

describe('never hidden: a stored date always lists the same rows; a break lists Put this week back', () => {
  it.each(KINDS)('%s', (kind) => {
    for (const st of ['coming', 'past', 'cancelled', 'moved'] as StateKey[]) {
      const rows = dateActions(series(kind), facts(kind, st), TODAY).map((r) => r.action);
      const first = STATES[st].state === 'cancelled' ? 'bringBack' : kind === 'oneoff' ? 'cancelEvent' : 'cancel';
      expect(rows).toEqual([first, 'move', 'time', 'details', 'skip', 'remove']);
    }
    expect(dateActions(series(kind), facts(kind, 'skipped'), TODAY).map((r) => r.action)).toEqual(['unskip']);
  });
  it('the undo rows show only when there is something to undo', () => {
    expect(dateActions(series('weekly'), STATES.ownTime, TODAY).map((r) => r.action)).toEqual(['cancel', 'move', 'time', 'resetTime', 'details', 'resetNormal', 'skip', 'remove']);
  });
});

describe('the greyed reasons say what to do instead', () => {
  const why = (kind: P3Kind, st: StateKey, a: DateAction, s: Partial<SeriesFacts> = {}) =>
    dateActions(series(kind, 10, s), facts(kind, st), TODAY).find((r) => r.action === a)?.reason;
  it.each([
    ['festival', 'coming', 'time', DATE_WHY.festivalTime],
    ['festival', 'coming', 'move', DATE_WHY.festivalMove],

    ['weekly', 'past', 'cancel', DATE_WHY.past],
    ['weekly', 'cancelled', 'move', DATE_WHY.cancelledFirst],
    ['weekly', 'moved', 'skip', DATE_WHY.offRule],
    ['weekly', 'coming', 'remove', DATE_WHY.noDelete],
    ['weekly', 'added', 'remove', DATE_WHY.noDelete],
    ['monthly', 'coming', 'skip', DATE_WHY.noPattern],
    ['custom', 'cancelled', 'remove', DATE_WHY.noDelete],
    ['oneoff', 'coming', 'skip', DATE_WHY.oneOffNoBreak],
    ['oneoff', 'coming', 'remove', DATE_WHY.oneOffRemove],
  ] as Array<[P3Kind, StateKey, DateAction, string]>)('%s x %s: %s', (kind, st, a, reason) => {
    expect(why(kind, st, a)).toBe(reason);
  });
  it('no programme times: Change the time has no series-wide grey (D8 makes the date its own time session; r1 finding 3)', () => {
    for (const kind of ['weekly', 'monthly', 'course', 'custom', 'oneoff'] as P3Kind[]) expect(why(kind, 'coming', 'time')).toBeNull();
    expect('noSessions' in DATE_WHY).toBe(false);
    expect(Object.values(DATE_WHY).some((w) => /add a session/i.test(w))).toBe(false);
  });
  it('a break at the date cap cannot come back (unskip delegates to add_date; r1 finding 2)', () => {
    expect(dateActions(series('weekly', DATE_CAP), STATES.skipped, TODAY)[0].reason).toBe(DATE_WHY.cap);
    expect(dateActions(series('weekly', DATE_CAP - 1), STATES.skipped, TODAY)[0].reason).toBeNull();
  });
  it('recurring with recurrence_rule null (ruleDate n/a): no "Not the usual day", skip says no pattern (r1 finding 5)', () => {
    const noRule: DateFacts = { ...STATES.coming, ruleDate: null };
    for (const kind of ['weekly', 'course'] as P3Kind[]) {
      expect(enabled(series(kind), noRule)).toEqual(['cancel', 'details', 'move', 'time']);
      expect(dateActions(series(kind), noRule, TODAY).find((r) => r.action === 'skip')?.reason).toBe(DATE_WHY.noPattern);
      expect(dateMarks(kind, noRule, { today: TODAY, hasOverride: false, sessionChanges: false }).tags).toEqual([]);
    }
  });
  it('an ended or removed event: every date action is closed', () => {
    for (const lifecycle of ['ended', 'archived']) {
      const rows = dateActions(series('weekly', 0, { lifecycle }), STATES.coming, TODAY);
      expect(rows.filter((r) => r.action !== 'remove' && r.action !== 'skip').every((r) => r.reason === DATE_WHY.closed)).toBe(true);
    }
  });
  it('a one-off: Cancel the event follows canCancelOneOff (its reason, or not on the calendar)', () => {
    expect(why('oneoff', 'coming', 'cancelEvent', { oneOff: { ok: false, reason: 'It is hidden.' } })).toBe('It is hidden.');
    expect(why('oneoff', 'coming', 'cancelEvent', { oneOff: null })).toBe(DATE_WHY.notLive);
  });
  it('a break off the rule cadence cannot come back as a break', () => {
    expect(dateActions(series('weekly'), { ...STATES.skipped, ruleDate: false }, TODAY)[0].reason).toBe(DATE_WHY.unskipOffRule);
  });
});

describe('list size: the date cap (30 coming) and Add a date', () => {
  const SIZES = [0, 2, 10, 31, 101];
  it.each(KINDS)('%s', (kind) => {
    for (const n of SIZES) {
      const why = addDateWhy(series(kind, n));
      if (kind === 'festival') expect(why).toBe(DATE_WHY.festivalOne);
      else if (kind === 'oneoff') expect(why).toBe(DATE_WHY.oneOffAdd);
      else expect(why).toBe(n >= DATE_CAP ? DATE_WHY.cap : null);
      const back = dateActions(series(kind, n), facts(kind, 'cancelled'), TODAY)[0];
      expect(back.reason).toBe(n >= DATE_CAP ? DATE_WHY.cap : null);
    }
  });
  it('ended: no adding', () => {
    expect(addDateWhy(series('weekly', 2, { lifecycle: 'ended' }))).toBe(DATE_WHY.closed);
  });
});

describe('a picked day (Move, Add)', () => {
  const taken = new Set(['2026-10-30']);
  it.each([
    ['', L.datePick.choose], ['2026-10-24', L.datePick.past], ['2026-10-30', L.datePick.taken], ['2026-10-25', null], ['2026-12-01', null],
  ] as Array<[string, string | null]>)('%s', (day, problem) => {
    expect(pickDayProblem(day, TODAY, taken)).toBe(problem);
  });
});

describe('the ONE tag mapping (Coming rows and All dates)', () => {
  const m = (kind: P3Kind, st: StateKey, hasOverride = false, sessionChanges = false) =>
    dateMarks(kind, facts(kind, st), { today: TODAY, hasOverride, sessionChanges });
  it.each([
    ['weekly', 'coming', false, false, [], false],
    ['weekly', 'past', false, false, [L.done], false],
    ['weekly', 'cancelled', true, false, [L.cancelled], false],
    ['weekly', 'skipped', false, false, [L.skipped], false],
    ['weekly', 'moved', false, false, [L.notUsualDay], false],
    ['weekly', 'ownTime', false, false, [L.ownTime], true],
    ['weekly', 'ownDetails', true, false, [L.ownChanges], true],
    ['weekly', 'coming', false, true, [L.ownChanges], true],
    ['monthly', 'moved', false, false, [], false],
    ['festival', 'coming', true, false, [L.ownChanges], true],
  ] as Array<[P3Kind, StateKey, boolean, boolean, string[], boolean]>)('%s x %s (override %s, sessions %s)', (kind, st, o, sc, tags, own) => {
    expect(m(kind, st, o, sc)).toEqual({ tags, own });
  });
});

describe('labels', () => {
  it('every action has a title and a line, from L', () => {
    for (const [a, [t, s]] of Object.entries(L.dateAct)) {
      expect(t.length, a).toBeGreaterThan(3);
      expect(s.length, a).toBeGreaterThan(3);
    }
    expect(L.dateAct.skip[0]).toBe(L.skip);
    expect(L.dateAct.unskip[0]).toBe(L.unskip);
    expect(L.dateAct.bringBack[0]).toBe(L.bringItBack);
    expect(L.dateAct.resetNormal[0]).toBe(L.resetDate);
    expect(L.dateAct.cancelEvent[0]).toBe(L.cancelEvent);
  });
  it('Remove is never enabled, on any kind or state', () => {
    for (const kind of KINDS) for (const st of Object.keys(STATES) as StateKey[]) {
      expect(enabled(series(kind), facts(kind, st))).not.toContain('remove');
    }
  });
  it('every action exists in the rule set', () => {
    expect(Object.keys(L.dateAct).sort()).toEqual([...CORE, 'cancel', 'cancelEvent', 'resetNormal', 'resetTime', 'unskip'].sort());
  });
});
