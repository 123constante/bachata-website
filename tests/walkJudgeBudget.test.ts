// walkJudgeBudget.test.ts -- the judge's daily budget is a fail-closed decision.
// Table-driven: each row is a ledger + now (+ config) and the decision it must
// produce. Mutants run against this suite are listed in the PR body.
import { describe, it, expect } from 'vitest';
import { judgeBudgetDecision } from '../scripts/lib/walk-judge-budget.mjs';
import { JUDGE_CONFIG } from '../scripts/lib/walk-judge.mjs';

type Entry = { startedAt: unknown; endedAt: unknown; branch: unknown };
const NOW = '2026-11-06T12:00:00Z';
const B = 'claude/x';

/** n closed 10-minute runs today, one per hour from 00:00. */
const runs = (n: number): Entry[] =>
  Array.from({ length: n }, (_, i) => ({
    startedAt: `2026-11-06T${String(i).padStart(2, '0')}:00:00Z`,
    endedAt: `2026-11-06T${String(i).padStart(2, '0')}:10:00Z`,
    branch: B,
  }));

/** One closed run today lasting `minutes`, starting 01:00. */
const longRun = (minutes: number): Entry[] => [{
  startedAt: '2026-11-06T01:00:00Z',
  endedAt: new Date(Date.parse('2026-11-06T01:00:00Z') + minutes * 60000).toISOString(),
  branch: B,
}];

const throwing = { get startedAt(): string { throw new Error('boom'); }, endedAt: null, branch: B };

type Row = [string, unknown, unknown, unknown, boolean, RegExp | null, number | null, number | null];
// name, ledger, now, config (undefined = default), allow, reason pattern, dispatches, hours
const ROWS: Row[] = [
  ['empty ledger allows', [], NOW, undefined, true, null, 0, 0],
  ['7 dispatches allows (the eighth may go)', runs(7), NOW, undefined, true, null, 7, 70 / 60],
  ['8 dispatches holds', runs(8), NOW, undefined, false, /8 judge dispatches today/, 8, 80 / 60],
  ['9 dispatches holds', runs(9), NOW, undefined, false, /9 judge dispatches today/, 9, 90 / 60],
  ['2h59 runtime allows', longRun(179), NOW, undefined, true, null, 1, 179 / 60],
  ['3h00 runtime holds', longRun(180), NOW, undefined, false, /runtime hours today/, 1, 3],
  ['open entry at 15 minutes allows', [{ startedAt: '2026-11-06T11:45:00Z', endedAt: null, branch: B }], NOW, undefined, true, null, 1, 0.25],
  ['open entry over 15 minutes holds', [{ startedAt: '2026-11-06T11:44:00Z', endedAt: null, branch: B }], NOW, undefined, false, /still open after 16 minutes/, 1, 16 / 60],
  ['open entry counts runtime until now', [{ startedAt: '2026-11-06T09:00:00Z', endedAt: null, branch: B }], NOW, undefined, false, /runtime hours today/, 1, 3],
  ['midnight straddle counts only today’s minutes', [
    { startedAt: '2026-11-05T21:00:00Z', endedAt: '2026-11-06T00:30:00Z', branch: B },
  ], NOW, undefined, true, null, 0, 0.5],
  ['yesterday-only entries do not count', runs(0).concat(
    Array.from({ length: 9 }, (_, i) => ({ startedAt: `2026-11-05T0${i}:00:00Z`, endedAt: `2026-11-05T0${i}:50:00Z`, branch: B })),
  ), NOW, undefined, true, null, 0, 0],
  ['future-dated startedAt holds', [{ startedAt: '2026-11-06T13:00:00Z', endedAt: null, branch: B }], NOW, undefined, false, /startedAt is in the future/, null, null],
  ['future-dated endedAt holds', [{ startedAt: '2026-11-06T11:00:00Z', endedAt: '2026-11-06T12:30:00Z', branch: B }], NOW, undefined, false, /endedAt is in the future/, null, null],
  ['endedAt before startedAt holds', [{ startedAt: '2026-11-06T10:00:00Z', endedAt: '2026-11-06T09:00:00Z', branch: B }], NOW, undefined, false, /endedAt is before startedAt/, null, null],
  ['non-ISO startedAt holds', [{ startedAt: 'yesterday', endedAt: null, branch: B }], NOW, undefined, false, /startedAt is not an ISO/, null, null],
  ['zone-less startedAt holds', [{ startedAt: '2026-11-06T10:00:00', endedAt: '2026-11-06T10:05:00Z', branch: B }], NOW, undefined, false, /startedAt is not an ISO/, null, null],
  ['undefined endedAt holds (only null means open)', [{ startedAt: '2026-11-06T10:00:00Z', branch: B }], NOW, undefined, false, /endedAt is neither null/, null, null],
  ['missing branch holds', [{ startedAt: '2026-11-06T10:00:00Z', endedAt: '2026-11-06T10:05:00Z' }], NOW, undefined, false, /branch is missing/, null, null],
  ['non-object entry holds', [null], NOW, undefined, false, /ledger\[0\] is not an object/, null, null],
  ['non-array ledger holds', { length: 0 }, NOW, undefined, false, /ledger is not an array/, null, null],
  ['null ledger holds', null, NOW, undefined, false, /ledger is not an array/, null, null],
  ['missing now holds', [], undefined, undefined, false, /now is missing/, null, null],
  ['non-ISO now holds', [], 'Fri Nov 06 2026', undefined, false, /now is missing/, null, null],
  ['config with a non-number ceiling holds', [], NOW, { ...JUDGE_CONFIG.budget, judgeDispatchesPerDay: '8' }, false, /judgeDispatchesPerDay is not a finite positive number/, null, null],
  ['config with NaN runtime ceiling holds', [], NOW, { ...JUDGE_CONFIG.budget, judgeRuntimeHoursPerDay: NaN }, false, /judgeRuntimeHoursPerDay/, null, null],
  ['config null holds', [], NOW, null, false, /config is missing/, null, null],
  ['a throw inside the check holds', [throwing], NOW, undefined, false, /threw: boom/, null, null],
];

describe('judgeBudgetDecision: table', () => {
  it.each(ROWS)('%s', (_name, ledger, now, config, allow, reason, dispatches, hours) => {
    const d = config === undefined ? judgeBudgetDecision(ledger, now) : judgeBudgetDecision(ledger, now, config);
    expect(d.allow).toBe(allow);
    expect(d.action).toBe(allow ? 'allow' : 'hold-and-alert');
    if (allow) expect(d.reasons).toEqual([]);
    else {
      expect(d.reasons.length).toBeGreaterThan(0);
      expect(d.reasons.join(' | ')).toMatch(reason as RegExp);
    }
    if (dispatches !== null) expect(d.dispatchesToday).toBe(dispatches);
    if (hours !== null) expect(d.runtimeHoursToday).toBeCloseTo(hours, 9);
  });
});

describe('judgeBudgetDecision: contract', () => {
  it('defaults to JUDGE_CONFIG.budget', () => {
    expect(judgeBudgetDecision(runs(8), NOW).allow).toBe(false);
    expect(judgeBudgetDecision(runs(8), NOW, { ...JUDGE_CONFIG.budget, judgeDispatchesPerDay: 9 }).allow).toBe(true);
  });
  it('JUDGE_CONFIG names this module as the enforcer', () => {
    expect(JUDGE_CONFIG.budget.dailyTotalEnforcedIn).toBe('scripts/lib/walk-judge-budget.mjs');
  });
  it('counts the UTC day of now, not a rolling 24h', () => {
    const lateYesterday = Array.from({ length: 8 }, (_, i) => ({
      startedAt: `2026-11-05T23:0${i}:00Z`, endedAt: `2026-11-05T23:0${i}:30Z`, branch: B,
    }));
    expect(judgeBudgetDecision(lateYesterday, '2026-11-06T00:05:00Z').allow).toBe(true);
    expect(judgeBudgetDecision(lateYesterday, '2026-11-05T23:59:00Z').allow).toBe(false);
  });
  it('never throws, whatever it is given', () => {
    const inputs: unknown[] = [undefined, null, 0, 'x', {}, [], [1], [[]], Symbol('s')];
    for (const l of inputs) for (const n of inputs) {
      expect(() => judgeBudgetDecision(l, n)).not.toThrow();
      expect(judgeBudgetDecision(l, n).allow).toBe(false);
    }
  });
});
