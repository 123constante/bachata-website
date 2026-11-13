import { describe, expect, it } from 'vitest';
// @ts-expect-error plain .mjs helpers
import * as q from '../scripts/lib/queue.mjs';
// @ts-expect-error plain .mjs scripts
import { main as claimMain } from '../scripts/queue-claim.mjs';
// @ts-expect-error plain .mjs scripts
import { main as watchMain } from '../scripts/queue-watchdog.mjs';
// @ts-expect-error plain .mjs scripts
import { main as reportMain } from '../scripts/queue-daily-report.mjs';
// @ts-expect-error plain .mjs scripts
import { main as mergeMain } from '../scripts/queue-merge-decide.mjs';

const lab = (...n: string[]) => n.map((name) => ({ name }));

describe('queue helpers', () => {
  it('picks p1 over older p2 over unprioritised, oldest first within a tier', () => {
    const issues = [
      { number: 1, labels: lab('queue'), created_at: '2026-01-01' },
      { number: 2, labels: lab('queue', 'p2'), created_at: '2026-01-02' },
      { number: 3, labels: lab('queue', 'p1'), created_at: '2026-01-05' },
      { number: 4, labels: lab('queue', 'p1'), created_at: '2026-01-03' },
      { number: 5, labels: lab('queue', 'in-progress', 'p1'), created_at: '2026-01-01' },
      { number: 6, labels: lab('queue', 'p1'), created_at: '2026-01-01', pull_request: {} },
    ];
    expect(q.pickIssue(issues).number).toBe(4);
    expect(q.pickIssue([])).toBeNull();
  });
  it('caps Related at 3 and drops self', () => {
    expect(q.relatedOf('x\nRelated: #7 #8 #9 #10 #7', 1)).toEqual([7, 8, 9]);
    expect(q.relatedOf('Related: #1', 1)).toEqual([]);
    expect(q.relatedOf('none', 1)).toEqual([]);
  });
  it('globs cross folders only with **', () => {
    expect(q.globToRe('supabase/migrations/**').test('supabase/migrations/a/b.sql')).toBe(true);
    expect(q.globToRe('**/*price*').test('src/lib/Price.ts')).toBe(true);
    expect(q.globToRe('*.sql').test('a/b.sql')).toBe(false);
  });
  it('reservedReasons: globs and hard tier, docs clear', () => {
    const tier = (p: string) => (p.startsWith('.github/') ? 'hard' : null);
    expect(q.reservedReasons(['docs/a.md'], ['**/*price*'], tier)).toEqual([]);
    expect(q.reservedReasons(['.github/workflows/x.yml'], [], tier)).toHaveLength(1);
    expect(q.reservedReasons(['src/payout.ts'], ['**/*payout*'], tier)).toHaveLength(1);
  });
  it('sums run cost markers and reports the budget warning', () => {
    const t = q.sumCosts([q.costMarker({ costUsd: 1.5, inTok: 10, outTok: 5, turns: 3 }), 'noise', q.costMarker({ costUsd: 2, inTok: 1, outTok: 1, turns: 1 })]);
    expect(t).toEqual({ runs: 2, costUsd: 3.5, inTok: 11, outTok: 6 });
    expect(q.parseBudget('Daily budget (USD): 20')).toBe(20);
    expect(q.parseBudget('nothing')).toBeNull();
    const md = q.reportMarkdown({ date: 'd', merged: [], queued: [], ownerTurn: [], totals: t, budget: 3 });
    expect(md).toContain('WARNING');
    expect(q.reportMarkdown({ date: 'd', merged: [], queued: [], ownerTurn: [], totals: t, budget: null })).not.toContain('WARNING');
  });
  it('watchdog ratchet: second stall goes to the owner', () => {
    const base = { now: Date.parse('2026-11-13T12:00:00Z'), activeRuns: 0, redPrs: [] };
    const i = (stalls: number) => ({ number: 1, labels: lab('in-progress'), updated_at: '2026-11-13T09:00:00Z', stalls });
    expect(q.decideStalls({ ...base, issues: [i(0)] })[0].kind).toBe('requeue');
    expect(q.decideStalls({ ...base, issues: [i(1)] })[0].kind).toBe('owner-turn');
  });
});

describe('script canaries (exit codes)', () => {
  it('self-tests exit 0 and missing env exits 2', async () => {
    for (const m of [claimMain, watchMain, reportMain, mergeMain]) {
      expect(await m(['--self-test'], {}, {})).toBe(0);
      expect(await m([], {}, {})).toBe(2);
    }
  });
});
