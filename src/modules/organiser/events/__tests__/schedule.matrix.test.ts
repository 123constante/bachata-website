/**
 * F4 matrix (pure): for EVERY real series shape (shapes.ts, from the prod survey)
 * the Date card's pattern and mode, and the exact commands a save sends:
 * untouched sends nothing, a name edit sends only the name, an ended or
 * archived event sends nothing whatever is in the draft, and a date field the
 * screen does not draw for a shape is never sent.
 */
import { describe, expect, it } from 'vitest';
import { SHAPES, TODAY, shapeByKey, workspaceOf, type SeriesShape } from '../../__tests__/shapes/shapes';
import { draftFromWorkspace, draftProblem, parseEventWorkspace, savePlan } from '../eventModel';
import { datesPattern, rulePattern, scheduleView } from '../schedule';

const load = (s: SeriesShape) => {
  const ws = parseEventWorkspace(workspaceOf(s));
  return { ws, draft: draftFromWorkspace(ws, TODAY) };
};

const PATTERN: Record<string, string> = {
  'ended-picnic': 'Every Saturday',
  'ended-upcoming-cancelled': 'Every Saturday',
  'ended-course': 'Every Tuesday',
  'live-weekly-open': 'Every Saturday',
  'live-weekly-over100': 'Every Saturday',
  'live-weekly-until': 'Every Saturday',
  'live-weekly-aftercount': 'Every Saturday',
  'draft-weekly-nointerval': 'Every Saturday',
  'pending-weekly': 'Every Saturday',
  'paused-weekly': 'Every Saturday',
  'live-monthly-nth': 'The first Friday of each month',
  'archived-monthly-dom': 'The 18th of each month',
  'live-custom': 'On chosen dates',
  'live-norule-few': 'Every Saturday',
  'live-norule-cancelled-only': 'Every Saturday',
  'live-norule-lapsed': 'Every Saturday',
  'live-oneoff-past': 'One date',
  'live-oneoff-upcoming': 'One date',
  'live-course': 'Every Tuesday',
  'live-festival': 'Festival, 3 days',
  'archived-oneoff-empty': 'One date',
  'archived-norule-past': 'Every Saturday',
};
const MODE: Record<string, string> = {
  'live-weekly-open': 'weekly', 'live-weekly-over100': 'weekly', 'live-weekly-until': 'weekly', 'live-weekly-aftercount': 'weekly',
  'draft-weekly-nointerval': 'weekly', 'pending-weekly': 'weekly', 'paused-weekly': 'weekly',
  'live-oneoff-past': 'single', 'live-oneoff-upcoming': 'single',
};

describe.each(SHAPES.map((s) => [s.key, s] as const))('shape %s', (key, s) => {
  it('the Date card reads the true pattern and the right mode', () => {
    const { ws } = load(s);
    const view = scheduleView(ws.series, ws.dates);
    expect(view.pattern).toBe(PATTERN[key]);
    expect(view.mode).toBe(MODE[key] ?? 'fixed');
    if (view.mode !== 'weekly') expect(view.repeatsReason ?? view.reason).toMatch(/Bachata Calendar team/);
  });

  it('untouched: nothing is sent', () => {
    const { ws, draft } = load(s);
    expect(savePlan(draft, draft, ws, TODAY)).toEqual([]);
    expect(draftProblem(draft, ws, TODAY, draft)).toBeNull();
  });

  it('a name edit: only the name (ended / archived: nothing)', () => {
    const { ws, draft } = load(s);
    const plan = savePlan(draft, { ...draft, name: 'New name' }, ws, TODAY);
    if (s.lifecycle === 'ended' || s.lifecycle === 'archived') expect(plan).toEqual([]);
    else expect(plan).toEqual([{ kind: 'series.upsert', payload: { name: 'New name' } }]);
  });

  it('date fields the screen does not draw for this shape are never sent', () => {
    const { ws, draft } = load(s);
    const moved = { ...draft, startDate: '2026-11-01', shape: 'weekly' as const, until: '2026-12-27' };
    const kinds = savePlan(draft, moved, ws, TODAY).map((c) => c.kind);
    const mode = scheduleView(ws.series, ws.dates).mode;
    if (s.lifecycle === 'ended' || s.lifecycle === 'archived' || mode === 'fixed') expect(kinds).toEqual([]);
    if (mode === 'single') expect(kinds).not.toContain('series.set_recurrence');
  });
});

describe('the owner\'s Bachata Picnic shape: an untouched save of an ended recurring series', () => {
  it('sends NOTHING, even if a stale draft differs', () => {
    const { ws, draft } = load(shapeByKey('ended-picnic'));
    expect(savePlan(draft, draft, ws, TODAY)).toEqual([]);
    expect(savePlan(draft, { ...draft, name: 'x', styles: [], shape: 'single', until: '2026-12-01' }, ws, TODAY)).toEqual([]);
  });
});

describe('more than 30 upcoming dates stored', () => {
  it('a name edit still saves (the cap is checked only when the dates change)', () => {
    const { ws, draft } = load(shapeByKey('live-weekly-open'));
    expect(draftProblem({ ...draft, name: 'Renamed' }, ws, TODAY, draft)).toBeNull();
    expect(draftProblem({ ...draft, until: '2027-09-25' }, ws, TODAY, draft)).toMatch(/more than 30/);
  });
});

describe('patterns for rule shapes not in the survey', () => {
  it.each([
    [{ mode: 'weekly', interval: 2, weekdays: [6] }, 'Every 2 weeks on Saturday'],
    [{ mode: 'weekly', interval: 1, weekdays: [2, 4] }, 'Every Tuesday and Thursday'],
    [{ mode: 'monthly', interval: 1, monthly: { kind: 'nth_weekday', nth: -1, weekday: 0 } }, 'The last Sunday of each month'],
    [{ mode: 'monthly', interval: 2, monthly: { kind: 'day_of_month', day: 1 } }, 'The 1st of every 2 months'],
    [{ mode: 'monthly', interval: 1, monthly: { kind: 'day_of_month', day: 22 } }, 'The 22nd of each month'],
    [{ mode: 'yearly' }, null],
    [null, null],
  ])('%j', (rule, want) => {
    expect(rulePattern(rule)).toBe(want);
  });

  it('dates with no common weekday read as set one by one', () => {
    const d = (date: string) => ({ id: date, occurrence_date: date, lifecycle_status: 'scheduled', version: 1, has_override: false, session_overrides_count: 0, added_sessions_count: 0, materialised_start_utc: null });
    expect(datesPattern([d('2026-10-10'), d('2026-10-15')])).toBeNull();
    expect(scheduleView({ format: 'recurring', lifecycle_status: 'live', recurrence_rule: null }, [d('2026-10-10'), d('2026-10-15')]).pattern).toBe('Dates set one by one');
  });
});
