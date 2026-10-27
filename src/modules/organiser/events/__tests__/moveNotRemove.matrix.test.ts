/**
 * Wave B0: organisers never delete dates (owner answer 20). savePlan moved its two
 * series.remove_date senders to occurrence.move_date, and falls back to adding the
 * new date (never removing one) when the old date cannot move. One row per date
 * shape; written against the unfixed code first (every move row failed there).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { draftFromWorkspace, parseEventWorkspace, savePlan } from '../eventModel';
import { TODAY, rawWorkspace } from './fixtures';

type Occ = { id: string; occurrence_date: string; lifecycle_status: string; version: number };
const occ = (id: string, date: string, status = 'scheduled', version = 4): Occ => ({ id, occurrence_date: date, lifecycle_status: status, version });

const oneOff = (start: string, occs: Occ[]) =>
  parseEventWorkspace(rawWorkspace({ format: 'one_off', recurrence_rule: null, default_start_date: start }, occs));
const oneDateRecurring = (start: string, occs: Occ[]) =>
  parseEventWorkspace(rawWorkspace({ format: 'recurring', recurrence_rule: null, default_start_date: start }, occs));

const NEW = '2026-10-24';
const upsert = (startDate: string) => ({ kind: 'series.upsert', payload: { name: 'Friday Party', default_start_date: startDate } });
const move = (id: string, to: string, version = 4) => ({ kind: 'occurrence.move_date', payload: { to_date: to }, occurrence: { id, version } });
const add = (date: string) => ({ kind: 'series.add_date', payload: { date } });

// shape, workspace, then what moving the start date to NEW sends.
const MOVE_ROWS: Array<[string, ReturnType<typeof oneOff>, unknown[]]> = [
  ['one-off, future scheduled date: the date itself moves', oneOff('2026-10-17', [occ('o1', '2026-10-17')]), [upsert(NEW), move('o1', NEW)]],
  ['one-off, past date: it stays as history, the new date is added', oneOff('2026-10-01', [occ('o1', '2026-10-01')]), [upsert(NEW), add(NEW)]],
  ['one-off, cancelled date: it stays cancelled, the new date is added', oneOff('2026-10-17', [occ('o1', '2026-10-17', 'cancelled')]), [upsert(NEW), add(NEW)]],
  ['one-off, an added date already on the new day: nothing moves, nothing goes', oneOff('2026-10-17', [occ('o2', NEW), occ('o1', '2026-10-17')]), [upsert(NEW)]],
  ['one-off, a cancelled date on the new day: nothing moves (the server would refuse date_taken)', oneOff('2026-10-17', [occ('o2', NEW, 'cancelled'), occ('o1', '2026-10-17')]), [upsert(NEW)]],
  ['recurring with one date (no rule): the date moves', oneDateRecurring('2026-10-17', [occ('o1', '2026-10-17', 'scheduled', 7)]), [upsert(NEW), move('o1', NEW, 7)]],
];

describe('savePlan never sends series.remove_date: moving the date of a one-date event', () => {
  it.each(MOVE_ROWS)('%s', (_label, ws, expected) => {
    const base = draftFromWorkspace(ws, TODAY);
    expect(base.shape).toBe('single');
    expect(savePlan(base, { ...base, startDate: NEW }, ws, TODAY)).toEqual(expected);
  });

  it.each(MOVE_ROWS)('%s: an untouched save sends nothing', (_label, ws) => {
    const base = draftFromWorkspace(ws, TODAY);
    expect(savePlan(base, base, ws, TODAY)).toEqual([]);
  });
});

describe('one date -> weekly from a new start: the old date moves onto the start BEFORE the rule', () => {
  const rule = (weekday: number, until: string) => ({ kind: 'series.set_recurrence', payload: { mode: 'weekly', weekdays: [weekday], end: { kind: 'until_date', date: until } } });

  it('off the new weekday: move first, then the weekly rule (the moved day is then on the rule path)', () => {
    const ws = oneDateRecurring('2026-10-17', [occ('o1', '2026-10-17')]); // a Saturday
    const base = draftFromWorkspace(ws, TODAY);
    const plan = savePlan(base, { ...base, shape: 'weekly', startDate: '2026-10-23', until: '2026-12-04' }, ws, TODAY);
    expect(plan).toEqual([upsert('2026-10-23'), move('o1', '2026-10-23'), rule(5, '2026-12-04')]);
  });

  it('a later start on the same weekday still moves the old date (it would sit before the rule starts)', () => {
    const ws = oneDateRecurring('2026-10-17', [occ('o1', '2026-10-17')]);
    const base = draftFromWorkspace(ws, TODAY);
    const plan = savePlan(base, { ...base, shape: 'weekly', startDate: NEW, until: '2026-12-05' }, ws, TODAY);
    expect(plan).toEqual([upsert(NEW), move('o1', NEW), rule(6, '2026-12-05')]);
  });

  it('same start date: the date is already on the path, only the rule is sent', () => {
    const ws = oneDateRecurring('2026-10-17', [occ('o1', '2026-10-17')]);
    const base = draftFromWorkspace(ws, TODAY);
    expect(savePlan(base, { ...base, shape: 'weekly', until: '2026-12-05' }, ws, TODAY)).toEqual([rule(6, '2026-12-05')]);
  });

  it('a cancelled old date is left as it is (only the rule)', () => {
    const ws = oneDateRecurring('2026-10-17', [occ('o1', '2026-10-17', 'cancelled')]);
    const base = draftFromWorkspace(ws, TODAY);
    const plan = savePlan(base, { ...base, shape: 'weekly', startDate: '2026-10-23', until: '2026-12-04' }, ws, TODAY);
    expect(plan).toEqual([upsert('2026-10-23'), rule(5, '2026-12-04')]);
  });
});

describe('no organiser code sends series.remove_date', () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) return f === '__tests__' ? [] : files(p);
      return /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) ? [p] : [];
    });

  it('the only mention left is the server allowlist mirror', () => {
    const hits = files(join(process.cwd(), 'src/modules')).filter((p) => readFileSync(p, 'utf8').includes('series.remove_date'));
    expect(hits.map((p) => p.slice(p.indexOf('src/')))).toEqual(['src/modules/organiser/shared/seriesCommands.ts']);
    const mirror = readFileSync(join(process.cwd(), 'src/modules/organiser/shared/seriesCommands.ts'), 'utf8');
    expect(mirror.match(/series\.remove_date/g)).toHaveLength(1);
  });
});
