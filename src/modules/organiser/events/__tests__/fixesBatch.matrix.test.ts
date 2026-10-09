/**
 * The 2026-10-08 parity audit (G1, G2, G4, G5) and walk bugs 6, 7 and 8, over the
 * real organiser shapes (shapes.ts, prod survey 2026-10-08). Written against the
 * unfixed code first: every block here failed before its fix.
 */
import { describe, expect, it } from 'vitest';
import { TODAY, shapeByKey, workspaceOf } from '../../__tests__/shapes/shapes';
import { draftFromWorkspace, draftProblem, oneDateLoss, parseEventWorkspace, savePlan } from '../eventModel';
import { scheduleView } from '../schedule';
import { newEventCommands } from '../newEvent';
import { EVENT_TYPES, categoryLabel } from '../eventType';
import { eventReviewView } from '../reviewModel';
import { confirmCopy, saveBarState } from '@/modules/organiser/shared/editorGuards';
import { LINK_PROBLEM, linkProblem } from '@/modules/organiser/shared/linkRules';

const load = (key: string) => {
  const ws = parseEventWorkspace(workspaceOf(shapeByKey(key)));
  return { ws, draft: draftFromWorkspace(ws, TODAY) };
};
const kinds = (cmds: { kind: string }[]) => cmds.map((c) => c.kind);

describe('G5: a recurring event with no rule and at most one date', () => {
  it('one date: single, and it can still be made weekly', () => {
    const { ws } = load('draft-norule-one');
    const v = scheduleView(ws.series, ws.dates);
    expect(v.mode).toBe('single');
    expect(v.repeatsReason).toBeNull();
  });

  it('one date: moving it adds the new date and takes the old one off', () => {
    const { ws, draft } = load('draft-norule-one');
    expect(draft.shape).toBe('single');
    const plan = savePlan(draft, { ...draft, startDate: '2026-10-24' }, ws, TODAY);
    expect(kinds(plan)).toEqual(['series.upsert', 'series.add_date', 'series.remove_date']);
  });

  it('one date: going weekly again sends the weekly rule from that date', () => {
    const { ws, draft } = load('draft-norule-one');
    const plan = savePlan(draft, { ...draft, shape: 'weekly', until: '2026-12-05' }, ws, TODAY);
    expect(plan).toEqual([{ kind: 'series.set_recurrence', payload: { mode: 'weekly', weekdays: [6], end: { kind: 'until_date', date: '2026-12-05' } } }]);
  });

  it('no date at all (the create rule failed): the weekly setup, and choosing an end sends the rule', () => {
    const { ws, draft } = load('draft-norule-empty');
    expect(scheduleView(ws.series, ws.dates).mode).toBe('weekly');
    expect(draft.shape).toBe('weekly');
    expect(draft.until).toBeNull();
    expect(savePlan(draft, draft, ws, TODAY)).toEqual([]);
    expect(kinds(savePlan(draft, { ...draft, until: '2026-12-03' }, ws, TODAY))).toEqual(['series.set_recurrence']);
  });

  it('several dates with no rule (an admin event) stay as they are', () => {
    const { ws } = load('live-norule-few');
    expect(scheduleView(ws.series, ws.dates).mode).toBe('fixed');
  });

  it('a one_off still cannot be made to repeat (the server needs format recurring)', () => {
    const { ws } = load('live-oneoff-upcoming');
    expect(scheduleView(ws.series, ws.dates).repeatsReason).toMatch(/can't be made to repeat/);
  });
});

describe('8: Starts on never shows a date that was taken off', () => {
  it('the first date taken off: Starts on is the first still-listed date', () => {
    const { draft } = load('draft-weekly-first-off');
    expect(draft.startDate).toBe('2026-10-17');
  });
  it.each(['live-weekly-until', 'draft-norule-one', 'live-oneoff-upcoming'])('%s keeps its stored start', (key) => {
    const { ws, draft } = load(key);
    expect(draft.startDate).toBe(ws.series.default_start_date);
  });
});

describe('7: weekly -> One date says how many dates go, before Save', () => {
  it.each([
    ['live-weekly-until', '2026-10-10', 5],
    ['live-weekly-until', '2026-10-09', 6],
    ['draft-weekly-first-off', '2026-10-17', 6],
  ] as const)('%s keeping %s: %i other dates go', (key, keep, n) => {
    const { ws, draft } = load(key);
    expect(oneDateLoss(ws, { ...draft, shape: 'single', startDate: keep }, TODAY)).toBe(n);
  });
  it('the confirm names the count and asks for the tick', () => {
    const c = confirmCopy('one_date', { subject: 'Sat 10 Oct', count: 5 });
    expect(c.consequence).toMatch(/5 other dates/);
    expect(c.confirmLabel).toBe('Yes, take off 5 other dates');
    expect(c.requireAck).toBe(true);
    expect(confirmCopy('one_date', { subject: 'Sat 10 Oct', count: 1 }).consequence).toMatch(/1 other date /);
  });
});

describe('G2 + G4: what the create sends for each type', () => {
  const cases = [
    { type: 'class', category: 'class', minutes: 120, schedule: 'series.set_recurrence' },
    { type: 'party', category: 'party', minutes: 300, schedule: 'series.add_date' },
    { type: 'workshop', category: 'workshop', minutes: 120, schedule: 'series.add_date' },
  ] as const;
  it.each(cases)('$type', ({ type, category, minutes, schedule }) => {
    const cmds = newEventCommands('Night', TODAY, 'org1', 'c1', type);
    const p = cmds.create.payload;
    expect(p.category).toBe(category);
    // Owners may not create a course; recurring with no rule is the owner's one-date shape.
    expect(p.format).toBe('recurring');
    expect(p.default_duration_minutes).toBe(minutes);
    expect(minutes).toBeGreaterThanOrEqual(1);
    expect(minutes).toBeLessThanOrEqual(1200);
    expect(cmds.schedule.kind).toBe(schedule);
    if (schedule === 'series.add_date') expect(cmds.schedule.payload).toEqual({ date: p.default_start_date });
  });
  it('offers exactly Class, Party, Course or workshop (no festival)', () => {
    expect(EVENT_TYPES.map((t) => t.label)).toEqual(['Class', 'Party', 'Course or workshop']);
  });
  it.each([['class', 'Class'], ['party', 'Party'], ['workshop', 'Course or workshop'], [null, 'Not set']] as const)('category %s reads %s', (c, label) => {
    expect(categoryLabel(c)).toBe(label);
  });
});

describe('G1: send for review', () => {
  const ready = { missing: [], upcomingListed: 3, datesWithSessions: 3, hasCover: true, organisers: [{ name: 'Org', lifecycle_status: 'live' }], dirty: false };
  it('a ready draft can be sent', () => {
    const v = eventReviewView({ status: 'draft', ...ready });
    expect(v).toMatchObject({ show: true, canSend: true, blockers: [] });
  });
  it.each([
    [{ missing: ['venue', 'city'] }, /a venue/],
    [{ missing: ['name'] }, /a name/],
    [{ upcomingListed: 0 }, /an upcoming date/],
    [{ organisers: [{ name: 'Org', lifecycle_status: 'pending_review' }] }, /Org is not live yet/],
    [{ dirty: true }, /Save your changes first/],
    [{ missing: null }, /Checking/],
  ] as const)('blocked with a reason: %o', (over, reason) => {
    const v = eventReviewView({ status: 'draft', ...ready, ...over });
    expect(v.canSend).toBe(false);
    expect(v.blockers.join(' ')).toMatch(reason);
  });
  it('in review: no button, says so', () => {
    const v = eventReviewView({ status: 'pending_review', ...ready });
    expect(v).toMatchObject({ show: true, canSend: false });
    expect(v.sentence).toMatch(/team is checking/);
  });
  it('changes needed: can send again', () => {
    expect(eventReviewView({ status: 'rejected', ...ready })).toMatchObject({ canSend: true, again: true });
  });
  it.each(['live', 'paused', 'ended', 'archived'])('%s: no review card', (status) => {
    expect(eventReviewView({ status, ...ready }).show).toBe(false);
  });
});

describe('6: one link rule for the sheet and for Save', () => {
  it.each([
    ['ticket', 'tickets.example', false], ['ticket', 'https://', false], ['ticket', 'https://tix.example/a', true], ['ticket', '', true],
    ['video', 'youtube', false], ['video', 'https://youtu.be/x', true],
    ['instagram', 'hello world', false], ['instagram', '@ritmo', true], ['instagram', 'instagram.com/ritmo', true], ['instagram', 'https://bit.ly/x', false],
    ['website', 'ritmo.example', true], ['website', 'not a site', false],
    ['facebook', 'ritmo.leeds', true], ['facebook', 'my page', false],
  ] as const)('%s %j ok=%s', (kind, value, ok) => {
    expect(linkProblem(kind, value) === null).toBe(ok);
  });
  it('Save refuses exactly what the sheet refuses, with the same words', () => {
    const { ws, draft } = load('live-weekly-until');
    expect(draftProblem({ ...draft, ticketUrl: 'tickets.example' }, ws, TODAY, draft)).toBe(LINK_PROBLEM.ticket);
    expect(draftProblem({ ...draft, videos: ['youtube'] }, ws, TODAY, draft)).toBe(LINK_PROBLEM.video);
    expect(draftProblem({ ...draft, ticketUrl: 'https://tix.example' }, ws, TODAY, draft)).toBeNull();
  });
});

describe('11: one save-bar rule', () => {
  it.each([
    [{ dirty: false }, { show: true, label: 'Saved', compact: true, disabled: true }],
    [{ dirty: true }, { show: true, label: 'Save changes', compact: false, disabled: false }],
    [{ dirty: false, locked: true }, { show: false }],
  ] as const)('%o', (input, out) => {
    expect(saveBarState(input)).toMatchObject(out);
  });
});
