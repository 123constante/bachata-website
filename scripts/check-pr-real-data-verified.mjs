#!/usr/bin/env node
/**
 * check-pr-real-data-verified.mjs -- the PR-body half of the real-data-verified
 * check (.github/workflows/real-data-verified.yml).
 *
 * Rule: nothing is declared ready before it is verified against the real SHAPES
 * of production data. The PR template section is an honour system; this makes it
 * enforced and visible. A PR body must carry a section headed
 * "## Verified on real data" with three labelled lines, each with real content:
 *
 *   Shapes surveyed: <what real data shapes you looked at>
 *   Checks run: <what you ran against them>
 *   NOT verified: <what you did not verify>
 *
 * parse(body) is PURE (no I/O) so it is unit-testable: tests/realDataVerified.test.ts.
 * The workflow passes the body through the PR_BODY env var -- never interpolated
 * into a shell command.
 *
 * Exit codes: 0 pass, 1 the PR body violates the format, 2 cannot run (no PR_BODY
 * variable at all -- an unset variable is infrastructure, not an empty body).
 *
 *   PR_BODY="$BODY" node scripts/check-pr-real-data-verified.mjs
 *   node scripts/check-pr-real-data-verified.mjs --self-test
 */
import { isEntryPoint } from './lib/entry-point.mjs';

export const HEADING = '## Verified on real data';
export const LABELS = ['Shapes surveyed', 'Checks run', 'NOT verified'];

export const FORMAT_HELP = [
  'Required format in the PR description:',
  '',
  HEADING,
  '- Shapes surveyed: <real production data shapes you looked at, e.g. (read-only, counts)>',
  '- Checks run: <what you ran against them>',
  '- NOT verified: <what you did not verify; "Nothing" needs 12+ chars of explanation>',
].join('\n');

// Phrases copied verbatim from the PR template; a line that is only these is unfilled.
const TEMPLATE_PHRASES = [
  '(read-only, counts)',
  '(matrix tests, every CI job step, browser walk at 390x844)',
  '(be honest)',
];
const PLACEHOLDER_WORDS = ['n/a', 'none', 'todo', 'tbd', '-'];
const MIN_CHARS = 12;

const HEADING_RE = /^[ \t]{0,3}##[ \t]+verified[ \t]+on[ \t]+real[ \t]+data[ \t]*#*[ \t]*$/i;
const ANY_HEADING_RE = /^[ \t]{0,3}#{1,6}(?:[ \t]|$)/;

const stripPunct = (s) => s.replace(/[\s\p{P}\p{S}]+/gu, ' ').trim();

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function labelValue(lines, label) {
  const re = new RegExp(
    '^[ \\t]*(?:[-*+][ \\t]+)?(?:\\*\\*|__)?' + escapeRe(label) + '(?:\\*\\*|__)?[ \\t]*:(?:\\*\\*|__)?(.*)$',
    'i',
  );
  const hits = lines.map((l) => re.exec(l)).filter(Boolean);
  return hits.length ? hits[0][1].trim() : null;
}

function contentProblem(label, raw) {
  if (raw === null) return label + ': line is missing';
  let value = raw.replace(/^(?:\*\*|__)/, '').trim();
  const lower = value.toLowerCase();
  if (lower === '') return label + ': empty after the colon';
  if (PLACEHOLDER_WORDS.includes(lower.replace(/[.!]+$/, ''))) {
    return label + ': placeholder text ("' + value + '")';
  }
  let rest = lower;
  for (const phrase of TEMPLATE_PHRASES) rest = rest.split(phrase.toLowerCase()).join(' ');
  if (label === 'NOT verified') rest = rest.replace(/^\s*nothing\b/, ' ');
  if (stripPunct(rest).length < MIN_CHARS) {
    const why =
      label === 'NOT verified' && /^\s*nothing\b/i.test(value)
        ? '"Nothing" must be followed by at least ' + MIN_CHARS + ' characters of explanation'
        : 'placeholder or too short (under ' + MIN_CHARS + ' characters of real content)';
    return label + ': ' + why + ' ("' + value + '")';
  }
  return null;
}

/** @param {string | null | undefined} body @returns {{ok: boolean, problems: string[]}} */
export function parse(body) {
  if (typeof body !== 'string' || body.trim() === '') {
    return { ok: false, problems: ['PR description is empty: the "' + HEADING + '" section is missing'] };
  }
  // Comments first: a valid-looking section inside <!-- --> is invisible to
  // reviewers and must not count. CRLF normalised so $-anchored matches hold.
  const text = body.replace(/\r\n?/g, '\n').replace(/<!--[\s\S]*?-->/g, '');
  const lines = text.split('\n');
  const starts = [];
  lines.forEach((l, i) => {
    if (HEADING_RE.test(l)) starts.push(i);
  });
  if (starts.length === 0) {
    return { ok: false, problems: ['Section "' + HEADING + '" is missing'] };
  }
  if (starts.length > 1) {
    return {
      ok: false,
      problems: ['Section "' + HEADING + '" appears ' + starts.length + ' times; keep exactly one'],
    };
  }
  const from = starts[0] + 1;
  let to = lines.length;
  for (let i = from; i < lines.length; i++) {
    if (ANY_HEADING_RE.test(lines[i])) {
      to = i;
      break;
    }
  }
  const section = lines.slice(from, to);
  const problems = [];
  for (const label of LABELS) {
    const p = contentProblem(label, labelValue(section, label));
    if (p) problems.push(p);
  }
  return { ok: problems.length === 0, problems };
}

export function main(argv, env = process.env, log = console) {
  if (argv.includes('--self-test')) return selfTest(log) ? 0 : 1;
  if (typeof env.PR_BODY !== 'string') {
    log.error('PR_BODY is not set: the workflow must pass the PR description in the environment.');
    return 2;
  }
  const { ok, problems } = parse(env.PR_BODY);
  if (ok) {
    log.log('real-data-verified: OK -- "' + HEADING + '" section is filled in.');
    return 0;
  }
  log.error('real-data-verified: FAIL');
  for (const p of problems) log.error('  - ' + p);
  log.error('\n' + FORMAT_HELP);
  return 1;
}

const FILLED = [
  HEADING,
  '- Shapes surveyed: events table, 412 rows, null venue_id in 9 (read-only, counts)',
  '- Checks run: matrix tests plus a browser walk at 390x844',
  '- NOT verified: behaviour with more than 1000 occurrences per series',
].join('\n');

function selfTest(log) {
  const cases = [
    ['filled section passes', FILLED, true],
    ['null body fails', null, false],
    ['missing section fails', 'Summary only', false],
    ['placeholder line fails', FILLED.replace('events table, 412 rows, null venue_id in 9 (read-only, counts)', 'n/a'), false],
    ['missing line fails', FILLED.split('\n').slice(0, 3).join('\n'), false],
    ['commented-out section fails', '<!--\n' + FILLED + '\n-->', false],
    ['doubled section fails', FILLED + '\n\n' + FILLED, false],
    ['CRLF body passes', FILLED.replace(/\n/g, '\r\n'), true],
  ];
  let failed = 0;
  for (const [name, body, want] of cases) {
    const got = parse(body).ok;
    if (got !== want) {
      failed++;
      log.error('FAIL ' + name + ': expected ok=' + want + ', got ' + got);
    }
  }
  // Exit-code owner driven end to end, each branch pinned (R5).
  const quiet = { log() {}, error() {} };
  const exits = [
    ['no PR_BODY is infrastructure (2)', main([], {}, quiet), 2],
    ['bad body is a violation (1)', main([], { PR_BODY: 'nothing here' }, quiet), 1],
    ['good body passes (0)', main([], { PR_BODY: FILLED }, quiet), 0],
  ];
  for (const [name, got, want] of exits) {
    if (got !== want) {
      failed++;
      log.error('FAIL ' + name + ': expected ' + want + ', got ' + got);
    }
  }
  if (failed) {
    log.error('FAIL self-test -- ' + failed + ' case(s).');
    return false;
  }
  log.log('PASS self-test -- ' + (cases.length + exits.length) + ' cases, both directions.');
  return true;
}

if (isEntryPoint(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
