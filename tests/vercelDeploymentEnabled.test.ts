// vercel.json git.deploymentEnabled -- which branches get a Vercel deployment
// at all. Table-driven against the REAL vercel.json, with Vercel's documented
// matching rules (docs: project-configuration/git-configuration):
//   - keys are minimatch globs (`*` does not cross `/`);
//   - a branch no key matches deploys (the default is true);
//   - a branch several keys match deploys if AT LEAST ONE of them is true, so a
//     `true` entry always wins over a `false` one (not "most specific wins").
// Policy (docs/pr-batching-policy.md): a deployment exists only for main,
// feat/* integration branches and bot/dependabot PRs; worker slice branches
// (claude/*) and brief branches (arc/briefs-*) get none.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import minimatch from 'minimatch';
import { deploymentEnabledByTable } from '../scripts/lib/vercel-deploys.mjs';

const vercel = JSON.parse(readFileSync(resolve(__dirname, '..', 'vercel.json'), 'utf8'));
const rules: Record<string, boolean> = vercel.git?.deploymentEnabled ?? {};

/** Vercel's decision for one branch name. */
export function deploys(branch: string, table: Record<string, boolean> = rules): boolean {
  const hits = Object.entries(table).filter(([glob]) => minimatch(branch, glob));
  if (hits.length === 0) return true;
  return hits.some(([, on]) => on === true);
}

describe('vercel.json git.deploymentEnabled (real file)', () => {
  it.each([
    ['main', true],
    ['feat/organiser-rebuild', true],
    ['feat/account', true],
    ['dependabot/npm_and_yarn/vite-6.4.1', true],
    ['bot/types-refresh', true],
    ['arc/organiser-r1', true],
    ['claude/vercel-slice-budget', false],
    ['claude/organiser-r1-slice-3', false],
    ['claude/done-dt_623ecd04d2d8', false],
    ['claude/review-pr-802', false],
    ['arc/briefs-organiser-r1', false],
  ] as const)('%s -> deploys %s', (branch, want) => {
    expect(deploys(branch)).toBe(want);
  });

  it('the only `true` keys are the keep-on branches (a stray true would re-enable claude/*)', () => {
    const on = Object.keys(rules).filter((k) => rules[k] === true).sort();
    expect(on).toEqual(['feat/*', 'main']);
  });
});

describe('the matcher follows Vercel (any true wins; no match = deploy)', () => {
  it.each([
    [{ 'experiment-*': false, '*-dev': true }, 'experiment-my-branch-dev', true],
    [{ 'experiment-*': false }, 'experiment-x', false],
    [{ 'claude/*': false }, 'claude/a/b', true],
    [{}, 'anything', true],
  ] as const)('%j / %s -> %s', (table, branch, want) => {
    expect(deploys(branch, table as Record<string, boolean>)).toBe(want);
  });
});

// The autopilot (scripts/lib/autopilot.mjs) runs with Node built-ins only, so it carries its own
// matcher (scripts/lib/vercel-deploys.mjs). It must agree with the minimatch reference above.
describe('scripts/lib/vercel-deploys.mjs agrees with deploys() (minimatch)', () => {
  const tables: Record<string, boolean>[] = [
    rules,
    { 'experiment-*': false, '*-dev': true },
    { 'claude/*': false },
    { 'claude/*': true, 'claude/x*': false },
    { 'claude/**': false, main: true },
    { 'release/v?': false },
  ];
  const branches = ['main', 'feat/a', 'claude/x', 'claude/a/b', 'arc/briefs-r5', 'arc/briefs-r5/x',
    'experiment-my-branch-dev', 'experiment-x', 'release/v1', 'release/v10', 'mainline', 'x.main'];
  for (const table of tables) {
    it.each(branches)(`%s against ${JSON.stringify(table)}`, (branch) => {
      expect(deploymentEnabledByTable(branch, table) ?? true).toBe(deploys(branch, table));
    });
  }
});
