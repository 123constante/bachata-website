import { describe, expect, it } from 'vitest';
import { OFFLINE_SAVE_MESSAGE, commandErrorMessage } from '../../../shared/selfServeErrors';
import { L } from '../labels';
import {
  REPEAT_COPY, REPEAT_FAIL, REPEAT_PROBLEM, REPEAT_WHY, addMonthsKey, blankDraft, courseFacts, courseLine, draftOfRule, parsePreview,
  previewCommand, previewFailure, previewLines, repeatAccess, repeatFailure, repeatPlan, repeatProblem, repeatSentence, repeatStart, rulePayload,
  storedRuleWords, type RepeatDraft, type RepeatFacts,
} from '../repeat';

/**
 * P3 W3c-1 Repeat: every prod shape x every kind of edit, through the ONE access mapping and the
 * ONE plan builder. Shapes from the read-only prod survey of 2026-10-28 (event_series_p5, counts
 * only; docs/design/w3c-1-repeat.md): recurring live weekly-none 25, weekly-until 3, monthly
 * nth_weekday-none 5, monthly weekday_except_last-after_count 1, custom 1, no rule 9; draft weekly
 * 7 (no interval key), no rule 1; paused weekly 1; ended no rule 13; archived weekly 7, monthly 2;
 * course live weekly after_count 6, draft weekly none 1, ended no rule 8; one_off 651; festival 13.
 */
const TODAY = '2026-10-28';

const W = (weekdays: number[], end: unknown, interval: number | undefined = 1) =>
  ({ mode: 'weekly', ...(interval === undefined ? {} : { interval }), weekdays, end });
const SHAPES: Record<string, RepeatFacts & { mode: 'edit' | 'disabled' | 'readonly' | 'none' }> = {
  noRule: { format: 'recurring', lifecycle: 'live', rule: null, mode: 'edit' },
  weeklyNone: { format: 'recurring', lifecycle: 'live', rule: W([5], { kind: 'none' }), mode: 'edit' },
  weeklyUntil: { format: 'recurring', lifecycle: 'live', rule: W([3], { kind: 'until_date', date: '2026-12-16' }), mode: 'edit' },
  weeklyUntilNoInterval: { format: 'recurring', lifecycle: 'live', rule: W([3], { kind: 'until_date', date: '2026-12-16' }, undefined), mode: 'edit' },
  weeklyCount: { format: 'recurring', lifecycle: 'archived', rule: W([2], { kind: 'after_count', count: 10 }), mode: 'readonly' },
  weeklyCountLive: { format: 'recurring', lifecycle: 'live', rule: W([2], { kind: 'after_count', count: 10 }), mode: 'edit' },
  monthlyNone: { format: 'recurring', lifecycle: 'live', rule: { mode: 'monthly', interval: 1, monthly: { kind: 'nth_weekday', nth: 1, weekday: 6 }, end: { kind: 'none' } }, mode: 'edit' },
  monthlyCount: { format: 'recurring', lifecycle: 'live', rule: { mode: 'monthly', interval: 1, monthly: { kind: 'day_of_month', day: 15 }, end: { kind: 'after_count', count: 6 } }, mode: 'edit' },
  monthlyMulti: { format: 'recurring', lifecycle: 'live', rule: { mode: 'monthly', interval: 1, monthly: { kind: 'multi_nth_weekday', nths: [3, 1], weekday: 5 }, end: { kind: 'none' } }, mode: 'edit' },
  monthlyAdminOnly: { format: 'recurring', lifecycle: 'live', rule: { mode: 'monthly', interval: 1, monthly: { kind: 'weekday_except_last', weekday: 3 }, end: { kind: 'after_count', count: 40 } }, mode: 'readonly' },
  custom: { format: 'recurring', lifecycle: 'live', rule: { mode: 'custom', dates: ['2026-11-01'] }, mode: 'readonly' },
  courseLive: { format: 'course', lifecycle: 'live', rule: W([3], { kind: 'after_count', count: 8 }), mode: 'disabled' },
  courseDraft: { format: 'course', lifecycle: 'draft', rule: W([3], { kind: 'none' }, undefined), mode: 'disabled' },
  courseEnded: { format: 'course', lifecycle: 'ended', rule: null, mode: 'readonly' },
  oneOff: { format: 'one_off', lifecycle: 'live', rule: null, mode: 'none' },
  oneOffDraft: { format: 'one_off', lifecycle: 'draft', rule: null, mode: 'none' },
  festival: { format: 'festival', lifecycle: 'live', rule: null, mode: 'none' },
  ended: { format: 'recurring', lifecycle: 'ended', rule: null, mode: 'readonly' },
  archived: { format: 'recurring', lifecycle: 'archived', rule: W([5], { kind: 'none' }), mode: 'readonly' },
  paused: { format: 'recurring', lifecycle: 'paused', rule: W([0], { kind: 'none' }), mode: 'edit' },
  draft: { format: 'recurring', lifecycle: 'draft', rule: W([4], { kind: 'none' }, undefined), mode: 'edit' },
  draftNoRule: { format: 'recurring', lifecycle: 'draft', rule: null, mode: 'edit' },
  pendingReview: { format: 'recurring', lifecycle: 'pending_review', rule: W([5], { kind: 'none' }), mode: 'readonly' },
};

const baseOf = (f: RepeatFacts): RepeatDraft => draftOfRule(f.rule) ?? blankDraft(5);
const EDITS: Record<string, (d: RepeatDraft) => RepeatDraft> = {
  untouched: (d) => ({ ...d }),
  one: (d) => (d.freq === 'weekly' ? { ...d, weekdays: [...new Set([...d.weekdays, 1])].sort() } : { ...d, interval: 2 }),
  several: (d) => ({ ...d, weekdays: d.freq === 'weekly' ? [1, 5] : d.weekdays, interval: 2, end: 'after_count', count: 12 }),
  invalid: (d) => ({ ...d, weekdays: d.freq === 'weekly' ? [1] : d.weekdays, end: 'until_date', until: '' }),
  overCap: (d) => ({ ...d, weekdays: d.freq === 'weekly' ? [1] : d.weekdays, end: 'after_count', count: 501 }),
};

describe('W3c-1 matrix: every shape x every edit', () => {
  for (const [name, shape] of Object.entries(SHAPES)) {
    const access = repeatAccess(shape);
    it(`${name}: access is ${shape.mode}, and a non-edit says why`, () => {
      expect(access.mode).toBe(shape.mode);
      if (access.mode === 'edit') expect(access.why).toBeNull();
      else expect(access.why).toMatch(/\.$/);
    });
    for (const [edit, apply] of Object.entries(EDITS)) {
      it(`${name} x ${edit}`, () => {
        const base = baseOf(shape);
        const draft = apply(base);
        const plan = repeatPlan(access, base, draft, TODAY);
        const problem = repeatProblem(draft, TODAY);
        if (access.mode !== 'edit' || edit === 'untouched') { expect(plan).toEqual([]); return; }
        if (edit === 'invalid') { expect(problem).toBe(REPEAT_PROBLEM.noUntil); expect(plan).toEqual([]); return; }
        if (edit === 'overCap') { expect(problem).toBe(REPEAT_FAIL.count_over_cap); expect(plan).toEqual([]); return; }
        // a no-rule series opens with no day: "one" picks Monday, the first change that can be sent
        expect(problem).toBeNull();
        expect(plan).toHaveLength(1);
        expect(plan[0]).toEqual({ kind: 'series.set_recurrence', payload: rulePayload(draft) });
        expect(plan[0].payload).not.toHaveProperty('dry_run');
      });
    }
  }
});

describe('RED FIRST: an untouched save sends nothing', () => {
  it.each(Object.keys(SHAPES))('%s: opening and saving at once sends nothing', (name) => {
    const s = SHAPES[name];
    expect(repeatPlan(repeatAccess(s), baseOf(s), baseOf(s), TODAY)).toEqual([]);
  });
  it('a stored weekly rule with no interval key opens as every week (1) and still sends nothing', () => {
    const base = draftOfRule(W([4], { kind: 'none' }, undefined))!;
    expect(base.interval).toBe(1);
    expect(repeatPlan({ mode: 'edit', why: null }, base, { ...base, weekdays: [4] }, TODAY)).toEqual([]);
  });
  it('a stored monthly rule with several weeks given in any order opens untouched', () => {
    const base = baseOf(SHAPES.monthlyMulti);
    expect(base.nths).toEqual([1, 3]);
    expect(repeatPlan({ mode: 'edit', why: null }, base, { ...base, nths: [3, 1] }, TODAY)).toEqual([]);
  });
  it('a change put back by hand sends nothing', () => {
    const base = baseOf(SHAPES.weeklyNone);
    const back = { ...base, weekdays: [5], interval: 1, count: 99 }; // count only matters for after_count
    expect(repeatPlan({ mode: 'edit', why: null }, base, back, TODAY)).toEqual([]);
  });
});

describe('RED FIRST: a course shows the editor disabled, saying what to do instead', () => {
  it.each(['courseLive', 'courseDraft'])('%s', (name) => {
    const a = repeatAccess(SHAPES[name]);
    expect(a).toEqual({ mode: 'disabled', why: REPEAT_WHY.course });
    expect(a.why).toContain('Change its dates directly');
    // the copy names a control the event page shows (its Coming up list)
    expect(a.why).toContain(L.comingUp);
    const base = baseOf(SHAPES[name]);
    expect(repeatPlan(a, base, { ...base, interval: 2 }, TODAY)).toEqual([]);
  });
  it('class n of N and the last class come from the workspace meta, never course_total_sessions', () => {
    const ws = {
      classCount: 8, lastClassDate: '2026-12-16', series: { removed_dates: ['2026-11-04'] },
      dates: ['2026-10-07', '2026-10-14', '2026-10-21', '2026-10-28', '2026-11-04', '2026-11-11'].map((d) => ({ occurrence_date: d, lifecycle_status: d === '2026-10-21' ? 'cancelled' : 'scheduled' })),
    };
    const c = courseFacts(ws, TODAY);
    expect(c).toEqual({ classCount: 8, lastClassDate: '2026-12-16', next: { n: 3, date: '2026-10-28' } });
    expect(courseLine(c, TODAY)).toBe('Class 3 of 8 is next, Wednesday 28 October. Last class Wednesday 16 December.');
    expect(courseLine({ classCount: 8, lastClassDate: '2026-08-26', next: null }, TODAY)).toBe('8 classes, none still to come. Last class Wednesday 26 August.');
  });
  it('an older read with no meta counts the dates itself', () => {
    const c = courseFacts({ classCount: null, lastClassDate: null, series: { removed_dates: [] }, dates: [{ occurrence_date: '2026-11-04', lifecycle_status: 'scheduled' }] }, TODAY);
    expect(c).toEqual({ classCount: 1, lastClassDate: '2026-11-04', next: { n: 1, date: '2026-11-04' } });
  });
});

describe('RED FIRST: each failure code is one sentence saying what to do', () => {
  const err = (message: string, code = '22023') => ({ code, message, details: null, hint: null });
  it.each([
    ['count_over_cap', 'invalid_recurrence_payload: count_over_cap: the rule makes more than 500 dates'],
    ['count_over_cap', 'invalid_recurrence_payload: count_over_cap'],
    ['interval_out_of_range', 'invalid_recurrence_payload: interval_out_of_range'],
    ['until_too_far', 'invalid_recurrence_payload: until_too_far'],
    ['mode_not_allowed', 'invalid_recurrence_payload: mode_not_allowed'],
    ['course_needs_count', 'invalid_transition: course_needs_count'],
    // apply_aggregate_write_p5's two end.date gates, verbatim from prod (read 2026-10-28; dry runs too)
    ['until_before_start', 'permission_denied: series.set_recurrence end.date must not be before the start date'],
    ['start_too_old', 'permission_denied: series.set_recurrence end.date needs a start date no earlier than 12 months ago'],
  ] as const)('%s <- "%s"', (code, message) => {
    const text = repeatFailure(err(message, code.endsWith('_count') || code.startsWith('until_b') || code.startsWith('start') ? 'P0001' : '22023'));
    expect(text).toBe(REPEAT_FAIL[code]);
    expect(text).not.toMatch(/invalid_|_/);
    expect(text).toMatch(/\b(Pick|Change|Ask|Choose|ask)\b/);
    // never the shared R1 one-weekday line, which points at a "first date" control this sheet has not got
    expect(text).not.toMatch(/one weekday/);
    expect(text).not.toBe(commandErrorMessage(err(message, 'P0001')));
  });
  it('the seven sentences are all different', () => {
    expect(new Set(Object.values(REPEAT_FAIL)).size).toBe(7);
  });
  it('course_needs_count is matched only as its anchored code (review F9)', () => {
    const e = err('something about course_needs_count', 'P0001');
    expect(repeatFailure(e)).toBe(commandErrorMessage(e));
  });
  it('a version conflict and a refusal keep the shared copy', () => {
    for (const e of [err('version_conflict: expected 7, found 8', 'P0001'), err('permission_denied: series.set_recurrence', 'P0001'), new TypeError('Failed to fetch')]) {
      expect(repeatFailure(e)).toBe(commandErrorMessage(e));
    }
  });
  it('a failed dry run never says the save-offline line; a refusal keeps its sentence (review F4)', () => {
    const offline = new TypeError('Failed to fetch');
    expect(previewFailure(offline)).toBe(REPEAT_COPY.previewOffline);
    expect(previewFailure(offline)).not.toBe(OFFLINE_SAVE_MESSAGE);
    expect(REPEAT_COPY.previewOffline).toContain(REPEAT_COPY.retry);
    const refused = err('invalid_recurrence_payload: until_too_far');
    expect(previewFailure(refused)).toBe(REPEAT_FAIL.until_too_far);
    expect(repeatFailure(offline)).toBe(OFFLINE_SAVE_MESSAGE);
  });
});

describe('a last date before the first date is said before anything is sent (review F3)', () => {
  const d: RepeatDraft = { ...blankDraft(5), weekdays: [5], end: 'until_date', until: '2026-12-01' };
  it.each([
    ['future first date, last date before it', { default_start_date: '2026-12-10', created_at: '2026-10-01T10:00:00Z' }, REPEAT_FAIL.until_before_start],
    ['future first date, last date on it', { default_start_date: '2026-12-01', created_at: null }, null],
    ['past first date', { default_start_date: '2026-09-01', created_at: null }, null],
    ['no default_start_date: created_at is the anchor', { default_start_date: null, created_at: '2026-12-05T23:30:00Z' }, REPEAT_FAIL.until_before_start],
    ['neither carried', { default_start_date: null, created_at: null }, null],
  ] as const)('%s', (_n, s, want) => {
    const start = repeatStart(s);
    expect(repeatProblem(d, TODAY, start)).toBe(want);
    const base = blankDraft(5);
    expect(repeatPlan({ mode: 'edit', why: null }, base, d, TODAY, start)).toHaveLength(want ? 0 : 1);
  });
  it('a past last date still says pastUntil first', () => {
    expect(repeatProblem({ ...d, until: '2026-10-01' }, TODAY, '2026-12-10')).toBe(REPEAT_PROBLEM.pastUntil);
  });
});

describe('payloads match the live owner rule (_owner_rule_problem_p5)', () => {
  const d = blankDraft(5);
  it.each([
    ['weekly two days every 2 weeks', { ...d, weekdays: [5, 1], interval: 2 }, { mode: 'weekly', interval: 2, weekdays: [1, 5], end: { kind: 'none' } }],
    ['monthly day', { ...d, freq: 'monthly', monthBy: 'day', day: 15, end: 'after_count', count: 6 }, { mode: 'monthly', interval: 1, monthly: { kind: 'day_of_month', day: 15 }, end: { kind: 'after_count', count: 6 } }],
    ['monthly one week', { ...d, freq: 'monthly', monthBy: 'nth', nths: [-1], weekday: 6 }, { mode: 'monthly', interval: 1, monthly: { kind: 'nth_weekday', nth: -1, weekday: 6 }, end: { kind: 'none' } }],
    ['monthly several weeks', { ...d, freq: 'monthly', monthBy: 'nth', nths: [-1, 1], weekday: 5, end: 'until_date', until: '2027-06-30' }, { mode: 'monthly', interval: 1, monthly: { kind: 'multi_nth_weekday', nths: [1, -1], weekday: 5 }, end: { kind: 'until_date', date: '2027-06-30' } }],
  ] as const)('%s', (_n, draft, payload) => {
    expect(rulePayload(draft as RepeatDraft)).toEqual(payload);
    expect(previewCommand(draft as RepeatDraft)).toEqual({ kind: 'series.set_recurrence', payload: { ...payload, dry_run: true } });
  });
  it('the last date is at most 24 months from today (Postgres month arithmetic, day clamped)', () => {
    expect(addMonthsKey(TODAY, 24)).toBe('2028-10-28');
    expect(addMonthsKey('2026-02-28', 24)).toBe('2028-02-28');
    expect(addMonthsKey('2028-02-29', 12)).toBe('2029-02-28');
    const at = (until: string) => repeatProblem({ ...d, weekdays: [5], end: 'until_date', until }, TODAY);
    expect(at('2028-10-28')).toBeNull();
    expect(at('2028-10-29')).toBe(REPEAT_FAIL.until_too_far);
    expect(at('2026-10-27')).toBe(REPEAT_PROBLEM.pastUntil);
    expect(at(TODAY)).toBeNull();
  });
  it.each([
    [{ weekdays: [] }, REPEAT_PROBLEM.noDay],
    [{ weekdays: [5], interval: 5 }, REPEAT_FAIL.interval_out_of_range],
    [{ weekdays: [5], end: 'after_count', count: 0 }, REPEAT_PROBLEM.count],
    [{ weekdays: [5], end: 'after_count', count: Number.NaN }, REPEAT_PROBLEM.count],
    [{ weekdays: [5], end: 'after_count', count: 500 }, null],
    [{ freq: 'monthly', monthBy: 'nth', nths: [] }, REPEAT_PROBLEM.noWeek],
    [{ freq: 'monthly', monthBy: 'day', day: 32 }, REPEAT_PROBLEM.badDay],
  ] as const)('problem %j', (patch, want) => {
    expect(repeatProblem({ ...d, ...(patch as Partial<RepeatDraft>) }, TODAY)).toBe(want);
  });
});

describe('words', () => {
  const d = blankDraft(5);
  it.each([
    [{ weekdays: [5] }, 'Every Friday, keeps going.'],
    [{ weekdays: [0, 3, 1], interval: 2 }, 'Every 2 weeks on Monday, Wednesday and Sunday, keeps going.'],
    [{ weekdays: [2], end: 'after_count', count: 1 }, 'Every Tuesday, stops after 1 time.'],
    [{ weekdays: [2], end: 'until_date', until: '2027-01-08' }, 'Every Tuesday, last date Friday 8 January 2027.'],
    [{ freq: 'monthly', monthBy: 'day', day: 22 }, 'Every month on the 22nd, keeps going.'],
    [{ freq: 'monthly', monthBy: 'nth', nths: [3, 1], weekday: 6, interval: 3 }, 'Every 3 months on the first and third Saturday, keeps going.'],
  ] as const)('%j', (patch, want) => {
    expect(repeatSentence({ ...d, ...(patch as Partial<RepeatDraft>) }, TODAY)).toBe(want);
  });
  it('read-only patterns still read as words', () => {
    expect(storedRuleWords(SHAPES.custom.rule, TODAY)).toBe('Dates you pick');
    expect(storedRuleWords(SHAPES.monthlyAdminOnly.rule, TODAY)).toBe('Every Wednesday except the last one of the month.');
    expect(storedRuleWords(null, TODAY)).toBe('Doesn’t repeat');
    expect(storedRuleWords(SHAPES.weeklyUntil.rule, TODAY)).toBe('Every Wednesday, last date Wednesday 16 December.');
  });
});

describe('the dry-run preview (series.set_recurrence dry_run answer)', () => {
  const raw = {
    recurrence_rule: {}, materialise: null, dry_run: true, date_cap: { cap: 30, upcoming: 30, held_back: 22 }, dates_considered: 60,
    will_add: ['2026-11-02', '2026-11-09'], will_remove: ['2026-11-06'], will_cancel_booked: ['2026-11-13'], keeps_own_changes: ['2026-11-20', '2026-11-27'],
    next_8: ['2026-10-30', '2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30', '2026-12-07', '2026-12-14', '2026-12-21'],
  };
  it('reads every count and keeps 8 dates', () => {
    expect(parsePreview(raw)).toEqual({ next: raw.next_8.slice(0, 8), added: 2, removed: 1, cancelledBooked: 1, keeps: 2, heldBack: 22, cap: 30 });
  });
  it('says each line, the removals in red', () => {
    expect(previewLines(parsePreview(raw))).toEqual([
      { key: 'added', tone: 'note', text: '2 dates added.' },
      { key: 'removed', tone: 'danger', text: 'This removes 1 date already on the calendar.' },
      { key: 'booked', tone: 'danger', text: '1 date has bookings, so it is cancelled instead of removed.' },
      { key: 'keeps', tone: 'note', text: '2 dates keep their own changes.' },
      { key: 'cap', tone: 'note', text: 'Only the next 30 dates are listed now. The other 22 are added as those pass.' },
    ]);
  });
  it('a change that moves no date says so; a missing or null answer reads as none', () => {
    expect(previewLines(parsePreview({ ...raw, will_add: [], will_remove: [], will_cancel_booked: [], keeps_own_changes: [], date_cap: null })))
      .toEqual([{ key: 'same', tone: 'note', text: 'No dates are added or removed.' }]);
    expect(parsePreview(null)).toEqual({ next: [], added: 0, removed: 0, cancelledBooked: 0, keeps: 0, heldBack: null, cap: null });
  });
});
