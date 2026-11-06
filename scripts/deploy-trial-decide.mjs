#!/usr/bin/env node
// scripts/deploy-trial-decide.mjs -- "does this push to main need a deploy?"
// for .github/workflows/deploy-production-trial.yml (STEP 1 TRIAL of moving
// production deploys from Vercel's Git integration to GitHub Actions; see
// docs/ops/vercel-actions-deploy-trial.md).
//
// ONE RULE, NO COPY. The decision is the Vercel ignoreCommand's diff rule:
// a push deploys iff its diff touches BUILD_PATHS in scripts/vercel-ignore-build.sh.
// That literal is parsed by scripts/lib/buildRule.mjs (the module previewProbe
// already uses), so this script, previewProbe and the ignore script decide
// from the same list. A docs/ci/test/workflow-only merge -> no deploy.
//
// FAIL-SAFE, mirroring the ignore script: every "don't know" DEPLOYS -- no
// base (all-zero `before` on a new branch / force push), a base or head git
// cannot resolve, or git diff erroring. An EMPTY diff between two different
// commits skips (the ignore script's `git diff --quiet` exits 0 there too).
//
// ONE DIFFERENCE, stated: the ignore script's base is VERCEL_GIT_PREVIOUS_SHA
// (last SUCCESSFUL deployment); here it is the push's `before` sha. They agree
// unless the previous main deploy failed -- the trial comparison checklist
// in the ops doc records any disagreement.
//
//   node scripts/deploy-trial-decide.mjs --ref <ref> --base <sha> --head <sha>
//       prints deploy=true|false and reason=...; also appends to $GITHUB_OUTPUT
//   node scripts/deploy-trial-decide.mjs --survey <N>
//       first-parent log of HEAD: decide each of the last N commits vs its
//       parent and print a table plus the skip count (real-data evidence)
//
// Exit codes: 0 a decision was printed (either way), 2 bad arguments / cannot
// run (e.g. --survey outside a git checkout). Never 1: this is not a guard.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { isEntryPoint } from './lib/entry-point.mjs';
import { readBuildPaths, touchesBuildPaths } from './lib/buildRule.mjs';

export const DEPLOY_REF = 'refs/heads/main';
const ZERO_SHA = /^0+$/;

/**
 * Pure decision. `paths` is the changed-path list, or null when it could not be
 * computed (doubt -> deploy).
 * @returns {{deploy: boolean, reason: string}}
 */
export function decide({ ref, paths, specs = readBuildPaths() }) {
  if (ref !== DEPLOY_REF) return { deploy: false, reason: `ref '${ref}' is not ${DEPLOY_REF} (trial deploys main only)` };
  if (paths === null) return { deploy: true, reason: 'changed paths unknown (fail-safe)' };
  if (paths.length === 0) return { deploy: false, reason: 'empty diff' };
  if (touchesBuildPaths(paths, specs)) return { deploy: true, reason: 'a build path changed' };
  return { deploy: false, reason: `no build path changed (${paths.length} file(s): docs/ci/test/workflow only)` };
}

function gitIn(cwd) {
  return (args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
const git = gitIn(undefined);

/** Changed paths base..head, or null (with the reason) when git cannot say. */
export function changedPaths(base, head, run = git) {
  if (!base || ZERO_SHA.test(base)) return { paths: null, why: 'no base sha' };
  try {
    run(['rev-parse', '--verify', '--quiet', `${base}^{commit}`]);
    run(['rev-parse', '--verify', '--quiet', `${head}^{commit}`]);
  } catch (err) {
    return { paths: null, why: `cannot resolve base/head (${String(err.message).split('\n')[0]})` };
  }
  if (base === head) return { paths: null, why: 'base == head (redeploy)' };
  try {
    const out = run(['diff', '--name-only', '--no-renames', '--no-ext-diff', base, head]);
    return { paths: out.split('\n').filter(Boolean), why: '' };
  } catch (err) {
    return { paths: null, why: `git diff failed (${String(err.message).split('\n')[0]})` };
  }
}

function argVal(argv, name) {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
}

function survey(n, out, run) {
  const shas = run(['log', '--first-parent', `-${n}`, '--format=%H']).split('\n').filter(Boolean);
  let skipped = 0;
  for (const sha of shas) {
    const subject = run(['log', '-1', '--format=%s', sha]).trim();
    const { paths, why } = changedPaths(`${sha}^`, sha, run);
    const d = decide({ ref: DEPLOY_REF, paths });
    if (!d.deploy) skipped++;
    out(`${d.deploy ? 'DEPLOY' : 'SKIP  '}  ${sha.slice(0, 7)}  ${subject.slice(0, 70)}  -- ${d.reason}${why ? ` [${why}]` : ''}`);
  }
  out(`survey: ${skipped} of ${shas.length} commit(s) would SKIP the deploy (docs/ci-only); ${shas.length - skipped} would DEPLOY`);
  return { total: shas.length, skipped };
}

/** CLI entry. Returns the exit code. */
export function main(argv = process.argv.slice(2), { out = console.log, env = process.env, cwd } = {}) {
  const run = gitIn(cwd);
  const n = argVal(argv, '--survey');
  if (n !== undefined) {
    if (!/^[1-9]\d*$/.test(n)) { out('deploy-trial-decide: --survey needs a positive integer'); return 2; }
    try { survey(Number(n), out, run); } catch (err) { out(`deploy-trial-decide: survey cannot run: ${err.message}`); return 2; }
    return 0;
  }
  const ref = argVal(argv, '--ref');
  const base = argVal(argv, '--base') ?? '';
  const head = argVal(argv, '--head');
  if (!ref || !head) { out('usage: deploy-trial-decide.mjs --ref <ref> --base <sha> --head <sha> | --survey <N>'); return 2; }
  const { paths, why } = changedPaths(base, head, run);
  const d = decide({ ref, paths });
  const reason = why ? `${d.reason}: ${why}` : d.reason;
  out(`deploy=${d.deploy}`);
  out(`reason=${reason}`);
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `deploy=${d.deploy}\nreason=${reason.replace(/\n/g, ' ')}\n`);
  return 0;
}

if (isEntryPoint(import.meta.url)) process.exitCode = main();
