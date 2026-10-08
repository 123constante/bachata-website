/**
 * F4: one lifecycle word / tone for every organiser screen, and the locks that
 * mirror what the server refuses an owner (see eventState.ts header).
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import { LIFECYCLE_LABEL } from '../selfServeApi';
import { LIFECYCLE_WORD, dateLock, dateTag, endedOnLabel, eventLock, isClosed, lifecycleTag, ownerWeeklyRule } from '../eventState';

const TODAY = '2026-10-08';

describe('lifecycle words and tags', () => {
  it('are the same words the old module used (one source of truth, pinned)', () => {
    expect(LIFECYCLE_WORD).toEqual(LIFECYCLE_LABEL);
  });

  it.each([
    ['live', 'Live', 'live'], ['draft', 'Draft', 'draft'], ['pending_review', 'In review', 'draft'], ['rejected', 'Changes needed', 'draft'],
    ['paused', 'Paused', 'neutral'], ['ended', 'Ended', 'neutral'], ['archived', 'Archived', 'neutral'],
  ])('%s reads %s', (status, label, tone) => {
    expect(lifecycleTag(status)).toEqual({ label, tone });
    expect(dateTag(status, 'scheduled')).toEqual({ label, tone });
    expect(dateTag(status, 'cancelled')).toEqual({ label: 'Cancelled', tone: 'neutral' });
  });
});

describe('locks', () => {
  it('ended and archived events are closed; the copy says who can help, never a control that is not there', () => {
    expect(isClosed('ended')).toBe(true);
    expect(isClosed('archived')).toBe(true);
    expect(eventLock('ended')).toBe("This event has ended, so it can't be changed here. To run it again, ask the Bachata Calendar team.");
    expect(eventLock('archived')).toMatch(/archived.*Bachata Calendar team/);
    for (const s of ['live', 'draft', 'pending_review', 'rejected', 'paused']) expect(eventLock(s)).toBeNull();
  });

  it.each([
    ['live', '2026-10-10', null],
    ['live', TODAY, null],
    ['live', '2026-10-03', /already happened/],
    ['paused', '2026-10-03', /already happened/],
    ['ended', '2026-10-10', /has ended/],
    ['ended', '2026-09-05', /already happened and the event has ended/],
    ['archived', '2026-09-05', /already happened and the event is archived/],
  ])('a %s event, date %s', (status, date, want) => {
    const lock = dateLock(status, date, TODAY);
    if (want === null) expect(lock).toBeNull();
    else expect(lock).toMatch(want);
  });

  it("says when an ended event ended ('Ended on Sat 5 Sep')", () => {
    expect(endedOnLabel('ended', '2026-09-05', '2026-10-08')).toBe('Ended on Sat 5 Sep');
    expect(endedOnLabel('ended', null, '2026-10-08')).toBeNull();
    expect(endedOnLabel('live', '2026-09-05', '2026-10-08')).toBeNull();
  });
});

describe('the one rule the owner screens edit', () => {
  it.each([
    ['weekly, end none', 'recurring', { mode: 'weekly', interval: 1, weekdays: [6], end: { kind: 'none' } }, true],
    ['weekly, no interval key', 'recurring', { mode: 'weekly', weekdays: [3], end: { kind: 'none' } }, true],
    ['weekly, until_date', 'recurring', { mode: 'weekly', interval: 1, weekdays: [4], end: { kind: 'until_date', date: '2026-12-17' } }, true],
    ['weekly, after_count', 'recurring', { mode: 'weekly', interval: 1, weekdays: [0], end: { kind: 'after_count', count: 16 } }, true],
    ['every 2 weeks', 'recurring', { mode: 'weekly', interval: 2, weekdays: [6] }, false],
    ['two weekdays', 'recurring', { mode: 'weekly', interval: 1, weekdays: [2, 4] }, false],
    ['monthly', 'recurring', { mode: 'monthly', interval: 1, monthly: { kind: 'nth_weekday', nth: 1, weekday: 5 }, end: { kind: 'none' } }, false],
    ['custom', 'recurring', { mode: 'custom', dates: ['2026-07-03'] }, false],
    ['no rule', 'recurring', null, false],
    ['a course with a weekly rule', 'course', { mode: 'weekly', interval: 1, weekdays: [2] }, false],
    ['a one_off', 'one_off', null, false],
  ])('%s', (_name, format, rule, editable) => {
    expect(!!ownerWeeklyRule({ format, recurrence_rule: rule })).toBe(editable);
  });
});
