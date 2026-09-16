#!/usr/bin/env node
/**
 * Answers "did PR <n> merge, and is its remote branch still alive?" without
 * the traps documented in the memory file gh_merge_delete_branch_lies.md
 * (8-for-8 sightings as of 2026-09-01, #229 through #321):
 *
 *   - `gh pr view <n> --json state,mergedAt` has been observed to return
 *     OPEN/null for a PR that was already merged (#277).
 *   - `git merge-base --is-ancestor <tip> origin/main` correctly says NO for
 *     a squash merge, which reads as "not merged" but isn't (#302).
 *
 * FIRST DRAFT of this script (2026-09-15) answered the merge question via
 * `gh pr list --state merged --limit 300`, filtered by number in JS. Its own
 * xhigh /code-review live-tested that query against this repo and found it
 * silently truncates: this repo already has 301 merged PRs, so PR #2 fell
 * outside the 300-item page and the script reported it NOT MERGED -- the
 * exact class of wrong answer this tool exists to prevent, recreated by its
 * own pagination cap. Fixed by querying the single-PR REST resource directly
 * (`gh api repos/<owner>/<repo>/pulls/<n>`), which has no page size at all.
 * Re-verified live 2026-09-15: this endpoint correctly reports #2 (merged,
 * 2026-04-23), #434 (open, unmerged), and 404s cleanly for a nonexistent PR.
 *
 * That same review also found `git ls-remote --heads origin <branch>`
 * matches by ref-tail, not exact name -- verified live: `origin
 * contact-field-validation` (an unprefixed suffix) matched the real branch
 * `fix/contact-field-validation`, while `origin refs/heads/<name>` did not.
 * Fixed by anchoring the argument as `refs/heads/<branch>`, which requires an
 * exact match.
 *
 * This is a manual reporting tool, not a CI gate. Exit codes: 0 = answered
 * the question (merged or not); 1 = bad input (not a positive integer); 2 =
 * a `gh`/`git`/network invocation itself failed. It carries no mutation
 * canary because it asserts nothing that gates a build -- R4/R5 in
 * check-script-conventions.mjs apply to check-/lint-prefixed guards, which
 * this deliberately is not named as.
 */

import { execFileSync } from 'node:child_process';
import { isEntryPoint } from './lib/entry-point.mjs';

function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8' });
}

function getRepoSlug() {
  const { owner, name } = JSON.parse(run('gh', ['repo', 'view', '--json', 'owner,name']));
  return `${owner.login}/${name}`;
}

export class InvalidPrNumberError extends Error {}

export function checkPrMergeStatus(prNumber) {
  if (!/^[1-9][0-9]*$/.test(String(prNumber))) {
    throw new InvalidPrNumberError(`Expected a positive integer PR number, got: ${prNumber}`);
  }
  const n = Number(prNumber);

  const repoSlug = getRepoSlug();

  let pr;
  try {
    pr = JSON.parse(run('gh', ['api', `repos/${repoSlug}/pulls/${n}`]));
  } catch (err) {
    if (String(err.stderr ?? err.message).includes('Not Found')) {
      return { merged: false, state: 'NOT_FOUND', branchAlive: null, branch: null };
    }
    throw err;
  }

  if (!pr.merged) {
    return { merged: false, state: pr.state, branchAlive: null, branch: null };
  }

  const branch = pr.head.ref;
  const remoteRef = run('git', ['ls-remote', '--heads', 'origin', `refs/heads/${branch}`]).trim();

  return {
    merged: true,
    mergedAt: pr.merged_at,
    branch,
    branchAlive: remoteRef.length > 0,
  };
}

function main() {
  const prNumber = process.argv[2];
  if (!prNumber) {
    console.error('Usage: node scripts/gh-merge-status.mjs <pr-number>');
    process.exitCode = 1;
    return;
  }

  let result;
  try {
    result = checkPrMergeStatus(prNumber);
  } catch (err) {
    if (err instanceof InvalidPrNumberError) {
      console.error(`gh-merge-status: ${err.message}`);
      process.exitCode = 1;
      return;
    }
    console.error(`gh-merge-status: invocation failed -- ${err.message}`);
    process.exitCode = 2;
    return;
  }

  if (!result.merged) {
    console.log(`#${prNumber}: NOT MERGED (state: ${result.state})`);
    return;
  }

  const branchNote = result.branchAlive
    ? `branch "${result.branch}" is STILL ON origin -- delete with: git push origin --delete ${result.branch}`
    : `branch "${result.branch}" already deleted`;
  console.log(`#${prNumber}: MERGED at ${result.mergedAt} -- ${branchNote}`);
}

if (isEntryPoint(import.meta.url)) {
  main();
}
