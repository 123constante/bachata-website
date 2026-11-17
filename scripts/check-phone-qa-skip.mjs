#!/usr/bin/env node
/**
 * Guard: Phone QA must keep skipping its heavy steps on PRs the phone suite cannot see.
 *
 * WHY. #1746 added `if: steps.changes.outputs.e2e_skip != 'true'` to the install,
 * build and Playwright steps of .github/workflows/phone-qa.yml so docs/supabase/.claude
 * PRs finish in about a minute instead of 8. Nothing enforced it: one later edit that
 * adds a new heavy step (or drops the `if:`) silently brings the wait back.
 *
 * RULES, per job in phone-qa.yml:
 *   S1  a step `id: changes` that runs scripts/ci/docs-only.mjs must exist
 *   S2  every step AFTER it whose run/uses is heavy (npm ci, npm install -g, npm run build,
 *       playwright, actions/setup-node) carries an `if:` mentioning steps.changes.outputs.e2e_skip
 *
 * Static: no network, no secrets. `--self-test` runs a mutant that must be refused.
 */
import { readFileSync } from 'node:fs';
import { isEntryPoint } from './lib/entry-point.mjs';

const FILE = '.github/workflows/phone-qa.yml';
const HEAVY = /(npm ci|npm install|npm run build|playwright|actions\/setup-node)/;
// A heavy step is gated by the e2e_skip output directly, or by the "mode" step that folds it in
// (ci-speed: "Decide the phone-suite mode", rule S3 pins that fold).
const SKIP_IF = /if:[^\n]*steps\.(changes\.outputs\.e2e_skip|mode\.outputs\.(run|mode))/;

export function splitSteps(text) {
  // Steps start at a "- name:" or "- uses:" or "- run:" list item inside a steps: block.
  const lines = text.split(/\r?\n/);
  const jobs = [];
  let cur = null;
  let step = null;
  for (const line of lines) {
    if (/^ {2}[A-Za-z0-9_-]+:\s*$/.test(line) && !/^ {2}(on|jobs|env|permissions|concurrency):/.test(line)) {
      cur = { name: line.trim().slice(0, -1), steps: [] };
      jobs.push(cur);
      step = null;
      continue;
    }
    if (!cur) continue;
    if (/^ {6}- /.test(line)) {
      step = { text: line };
      cur.steps.push(step);
    } else if (step && /^ {8}/.test(line)) {
      step.text += '\n' + line;
    } else if (step && line.trim() !== '' && !/^\s*#/.test(line)) {
      step = null;
    }
  }
  return jobs.filter((j) => j.steps.length);
}

export function check(text) {
  const problems = [];
  const jobs = splitSteps(text);
  if (jobs.length === 0) problems.push('no jobs parsed: parser is blind');
  for (const job of jobs) {
    const idx = job.steps.findIndex((s) => /id:\s*changes/.test(s.text) && /docs-only\.mjs/.test(s.text));
    if (idx < 0) {
      if (job.steps.some((s) => HEAVY.test(s.text))) problems.push(`${job.name}: S1 no "id: changes" step running docs-only.mjs`);
      continue;
    }
    const gate = job.steps.slice(idx + 1).find((s) => /id:\s*mode/.test(s.text));
    if (job.steps.slice(idx + 1).some((s) => /steps\.mode\./.test(s.text)) && !(gate && /steps\.changes\.outputs\.e2e_skip/.test(gate.text))) {
      problems.push(`${job.name}: S3 steps gate on steps.mode but the "id: mode" step does not read steps.changes.outputs.e2e_skip`);
    }
    for (const s of job.steps.slice(idx + 1)) {
      if (HEAVY.test(s.text) && !SKIP_IF.test(s.text)) {
        const label = (s.text.match(/name:\s*(.+)/) || [, s.text.split('\n')[0]])[1].trim();
        problems.push(`${job.name}: S2 heavy step "${label}" has no e2e_skip condition`);
      }
    }
  }
  return problems;
}

// The canary drives main() itself, so its exit code is the one under test.
function selfTest(text) {
  const quiet = { write() {} };
  if (main([], text, quiet) !== 0) { process.stdout.write('self-test: real file already red\n'); return 1; }
  const mutant = text.replace(/ {8}if: steps\.mode\.outputs\.run == 'true'\r?\n( {8}run: npm ci)/, '$1');
  if (mutant === text) { process.stdout.write('self-test: mutant did not apply (npm ci step shape changed)\n'); return 1; }
  if (main([], mutant, quiet) !== 1) { process.stdout.write('self-test: mutant NOT refused: guard is blind\n'); return 1; }
  process.stdout.write('self-test ok: real file clean, mutant refused\n');
  return 0;
}

// main() owns the exit code: its return value becomes process.exitCode.
export function main(argv = [], text = readFileSync(FILE, 'utf8'), out = process.stdout) {
  if (argv.includes('--self-test')) return selfTest(text);
  const p = check(text);
  out.write(p.length ? ['FAIL', ...p, ''].join('\n') : 'phone-qa skip guard ok\n');
  return p.length ? 1 : 0;
}

if (isEntryPoint(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
