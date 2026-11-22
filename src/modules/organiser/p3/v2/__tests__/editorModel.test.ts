import { describe, expect, it, vi } from 'vitest';
import {
  changeList, dateTagOf, eventChanges, isV2Format, lastDateProblem, nightFieldState, nightSessionsOff,
  removeOrganiser, removeSessionWarning, runPlan, sessionEnds, summaryOf, upcomingOf, writePlan, type EditorDraft, type WriteStep,
} from '../editorModel';

const base = { name: 'Bachata Tuesdays', about: 'Weekly social', venueId: 'v1' };
const days: Record<string, string> = { o1: '2026-11-24', o2: '2026-12-01' };
const dayOf = (id: string) => days[id] ?? id;
const dates = [{ id: 'o1', version: 3 }, { id: 'o2', version: 5 }];
const seriesCmd = { kind: 'series.upsert' as const, payload: { name: 'New' } };

describe('formats', () => {
  it.each([['recurring', true], ['one_off', true], ['festival', false], ['course', false], [null, false]])('%s -> %s', (f, on) => {
    expect(isV2Format(f)).toBe(on);
  });
});

describe('change list', () => {
  it('untouched draft and typing back to the saved value is no change', () => {
    expect(eventChanges(base, {})).toEqual([]);
    expect(eventChanges(base, { name: ' Bachata Tuesdays ' })).toEqual([]);
    expect(changeList(base, { event: {}, nights: { o1: {} } }, dayOf)).toEqual([]);
  });
  it('names event-wide first, then nights by date', () => {
    const d: EditorDraft = { event: { about: 'x', name: 'y' }, nights: { o2: { title: 'B' }, o1: { description: null } } };
    expect(changeList(base, d, dayOf)).toEqual(['Name', 'About', 'About this night (2026-11-24)', 'Name for this night (2026-12-01)']);
  });
  it('summary keeps to one short line', () => {
    expect(summaryOf([])).toBe('');
    expect(summaryOf(['Repeat'])).toBe('Repeat');
    expect(summaryOf(['Repeat', 'Name'])).toBe('Repeat and Name');
    expect(summaryOf(['Repeat', 'a', 'b', 'c', 'd', 'e', 'f', 'g'])).toBe('Repeat and 7 more');
  });
});

describe('write plan order', () => {
  it('event-wide, then night overrides by date; empty patches send nothing', () => {
    const plan = writePlan('s1', [seriesCmd], { event: {}, nights: { o2: { title: 'B' }, o1: { title: null }, o9: {} } }, dates, dayOf);
    expect(plan.map((s) => [s.target, s.id, s.version])).toEqual([['series', 's1', null], ['occurrence', 'o1', 3], ['occurrence', 'o2', 5]]);
    expect(plan[1].command).toEqual({ kind: 'occurrence.set_override', payload: { title: null } });
  });
  it('an untouched draft is an empty plan', () => {
    expect(writePlan('s1', [], { event: {}, nights: {} }, dates, dayOf)).toEqual([]);
  });
  it('drops a night the workspace no longer holds', () => {
    expect(writePlan('s1', [], { event: {}, nights: { gone: { title: 'x' } } }, dates, dayOf)).toEqual([]);
  });
});

describe('partial failure', () => {
  const plan: WriteStep[] = writePlan('s1', [seriesCmd], { event: {}, nights: { o1: { title: 'A' }, o2: { title: 'B' } } }, dates, dayOf);
  it('stops at the failing step and names it and what is left; series version chains', async () => {
    const send = vi.fn()
      .mockResolvedValueOnce({ new_version: 8 })
      .mockRejectedValueOnce(new Error('boom'));
    const r = await runPlan(plan, 0, 7, send);
    expect(r.done).toBe(1);
    expect(r.failed).toEqual(['2026-11-24', '2026-12-01']);
    expect(r.seriesVersion).toBe(8);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][1]).toBe(7);
  });
  it('a retry starts after the steps that landed', async () => {
    const send = vi.fn().mockResolvedValue({});
    const r = await runPlan(plan, 1, 8, send);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][0].id).toBe('o1');
    expect(r).toMatchObject({ done: 3, failed: [], error: null });
  });
});

describe('rules', () => {
  it('ends next day when end is at or before start', () => {
    expect(sessionEnds('21:00', '02:00')).toEqual({ end: '02:00', nextDay: true });
    expect(sessionEnds('21:00', '21:00')).toEqual({ end: '21:00', nextDay: true });
    expect(sessionEnds('19:00', '23:00')).toEqual({ end: '23:00', nextDay: false });
    expect(sessionEnds('19:00', null)).toEqual({ end: null, nextDay: false });
  });
  it('last date: today or later, on the repeat weekday', () => {
    // 2026-11-24 is a Tuesday (2)
    expect(lastDateProblem('2026-11-24', '2026-11-20', 2)).toBeNull();
    expect(lastDateProblem('2026-11-25', '2026-11-20', 2)).toMatch(/Tuesday/);
    expect(lastDateProblem('2026-11-17', '2026-11-20', 2)).toMatch(/today or later/);
    expect(lastDateProblem(null, '2026-11-20', 2)).toBeNull();
  });
  it('keeps at least one organiser and asks before removing yourself', () => {
    expect(removeOrganiser(['me'], 'me', 'me')).toBe('last');
    expect(removeOrganiser(['a'], 'a', 'me')).toBe('last');
    expect(removeOrganiser(['me', 'b'], 'me', 'me')).toBe('self');
    expect(removeOrganiser(['me', 'b'], 'b', 'me')).toBe('ok');
  });
  it('session removal warning counts the dates', () => {
    expect(removeSessionWarning(0)).toBeNull();
    expect(removeSessionWarning(1)).toBe('1 date has its own changes to this session. They will be removed.');
    expect(removeSessionWarning(3)).toBe('3 dates have their own changes to this session. They will be removed.');
  });
  it('per-night sessions are off for multi-day, cancelled and past dates', () => {
    const d = { occurrence_date: '2026-11-24', lifecycle_status: 'scheduled' };
    expect(nightSessionsOff(d, '2026-11-20', false)).toBeNull();
    expect(nightSessionsOff(d, '2026-11-20', true)).toMatch(/several days/);
    expect(nightSessionsOff({ ...d, lifecycle_status: 'cancelled' }, '2026-11-20', false)).toMatch(/cancelled/);
    expect(nightSessionsOff(d, '2026-11-25', false)).toMatch(/passed/);
  });
});

describe('dates and night rows', () => {
  const d = { lifecycle_status: 'scheduled', has_override: false, override_keys: [] as string[], session_overrides_count: 0, added_sessions_count: 0 };
  it('tags', () => {
    expect(dateTagOf(d, 'live')).toBeNull();
    expect(dateTagOf({ ...d, lifecycle_status: 'cancelled', has_override: true }, 'live')).toBe('cancelled');
    expect(dateTagOf(d, 'ended')).toBe('ended');
    expect(dateTagOf({ ...d, override_keys: ['title'] }, 'live')).toBe('changed');
    expect(dateTagOf({ ...d, added_sessions_count: 1 }, 'live')).toBe('changed');
  });
  it('upcoming is today on, soonest first', () => {
    const list = [{ occurrence_date: '2026-12-01' }, { occurrence_date: '2026-11-19' }, { occurrence_date: '2026-11-20' }];
    expect(upcomingOf(list, '2026-11-20').map((x) => x.occurrence_date)).toEqual(['2026-11-20', '2026-12-01']);
  });
  it('the draft beats what is saved', () => {
    expect(nightFieldState('title', [], undefined)).toBe('usual');
    expect(nightFieldState('title', ['title'], undefined)).toBe('changed');
    expect(nightFieldState('title', ['title'], { title: null })).toBe('usual');
    expect(nightFieldState('title', [], { title: 'x' })).toBe('changed');
  });
});
