#!/usr/bin/env node
/**
 * pr-body-stub.mjs -- the ONE generator of the body the bot opens every
 * claude/** PR with (.github/workflows/bot-pr.yml).
 *
 * Why: the stub text used to live in three places that drifted (the checkers,
 * an inline array in bot-pr.yml, the orchestrator's tool). The bot body knew
 * only the real-data section, so every UI PR opened RED on phone-qa-section,
 * and workers wrote label shapes the checkers refuse. Here every heading, label
 * and the marker are IMPORTED from the two checkers; none is typed in this file
 * (tests/prBodyStub.test.ts reads this source and fails if one is).
 *
 * Both sections are set to the marker, so check-pr-real-data-verified.mjs and
 * check-pr-phone-qa.mjs both report PENDING (exit 3, a notice) -- never a pass.
 *
 *   BRANCH=claude/x node scripts/pr-body-stub.mjs     # prints the body
 *   node scripts/pr-body-stub.mjs --self-test
 *
 * Exit codes: 0 printed (or self-test passed), 1 self-test failed,
 * 2 cannot run: BRANCH unset or empty.
 */
import { isEntryPoint } from './lib/entry-point.mjs';
import * as realData from './check-pr-real-data-verified.mjs';
import * as phoneQa from './check-pr-phone-qa.mjs';

const SECTIONS = [realData, phoneQa];
const MARKER = realData.MARKER;
const plain = (heading) => heading.replace(/^#+\s*/, '');

/** @param {string} branch @returns {string} the whole bot PR body */
export function buildStub(branch) {
  const names = SECTIONS.map((s) => '"' + plain(s.HEADING) + '"').join(' and ');
  const lines = [
    'Opened by the bot for cloud branch `' + branch + '` so the owner can approve it. The session fills in this description.',
    // The marker itself is NOT repeated here: a body is "filled" only when it
    // carries no marker anywhere (~/.claude/bin/auto-merge.mjs refuses one).
    'Replace each placeholder line below in place; do not add a second copy of the ' + names + ' sections.',
    'The ' + names.split(' and ').pop() + ' section is checked only when a UI path changed (scripts/check-pr-phone-qa.mjs UI_PATH_RE).',
  ];
  for (const s of SECTIONS) {
    lines.push('', s.HEADING, ...s.LABELS.map((l) => '- ' + l + ': ' + MARKER));
  }
  lines.push('', 'Raised by .github/workflows/bot-pr.yml.');
  return lines.join('\n');
}

export function main(argv, env = process.env, log = console) {
  if (argv.includes('--self-test')) return selfTest(log) ? 0 : 1;
  const branch = typeof env.BRANCH === 'string' ? env.BRANCH.trim() : '';
  if (!branch) {
    log.error('BRANCH is not set: the workflow must pass the branch name in the environment.');
    return 2;
  }
  log.log(buildStub(branch));
  return 0;
}

function selfTest(log) {
  const body = buildStub('claude/self-test');
  const quiet = { log() {}, error() {} };
  const checks = [
    ['real-data parse is pending', realData.parse(body).pending === true && realData.parse(body).ok === false],
    ['phone-qa parse is pending', phoneQa.parse(body).pending === true && phoneQa.parse(body).ok === false],
    ['real-data main exits 3', realData.main([], { PR_BODY: body }, quiet) === 3],
    ['phone-qa main exits 3 on a UI PR', phoneQa.main([], { PR_BODY: body, PR_FILES: 'src/a.tsx' }, quiet) === 3],
    ['phone-qa main exits 0 on a docs PR', phoneQa.main([], { PR_BODY: body, PR_FILES: 'docs/a.md' }, quiet) === 0],
    ['both checkers share the marker', phoneQa.MARKER === realData.MARKER],
    ...SECTIONS.map((s) => [s.HEADING + ' once', body.split(s.HEADING).length - 1 === 1]),
    ...SECTIONS.flatMap((s) =>
      s.LABELS.map((l) => [l + ' once', body.split('\n').filter((x) => x.startsWith('- ' + l + ':')).length === 1]),
    ),
    ['no BRANCH is infrastructure (2)', main([], {}, quiet) === 2],
    ['BRANCH prints (0)', main([], { BRANCH: 'claude/x' }, quiet) === 0],
  ];
  const failed = checks.filter(([, ok]) => !ok);
  for (const [name] of failed) log.error('FAIL ' + name);
  if (failed.length) {
    log.error('FAIL self-test -- ' + failed.length + ' case(s).');
    return false;
  }
  log.log('PASS self-test -- ' + checks.length + ' cases.');
  return true;
}

if (isEntryPoint(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
