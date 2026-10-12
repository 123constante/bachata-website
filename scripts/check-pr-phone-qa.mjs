#!/usr/bin/env node
/**
 * check-pr-phone-qa.mjs -- the PR-body half of the phone-qa-section check
 * (.github/workflows/phone-qa-section.yml). Modelled on
 * check-pr-real-data-verified.mjs.
 *
 * Rule (the owner's): nothing UI-facing reaches the owner as "please test" before
 * CI plus a MEASURED walk at phone size. On 2026-10-11 the owner found, on a phone,
 * a Save bar hidden behind the BottomNav and a low-contrast heading that no check
 * had looked at. The phone suite (phone-qa.yml) is the machine half; this is the
 * human half. A PR that changes a UI path must carry a section headed
 * "## Phone QA" with three labelled lines, each with real content:
 *
 *   Sizes checked: <viewport sizes, e.g. 390x844 and 360x640>   (needs a WxH)
 *   Walked: <what pages / flows were walked at those sizes>
 *   Not verified: <what was not checked>
 *
 * UI paths (UI_PATH_RE): src/** and app/** .tsx and .css (src/index.css
 * included; app/ holds the route shells, e.g. InitialVisiblePageTransition.tsx,
 * whose leftover filter caused #719), the tailwind config, index.html and
 * anything under public/. Every other PR passes without the
 * section (docs-only, CI-only, scripts, non-UI src .ts).
 *
 * parse(body) and touchesUi(files) are PURE so they are unit-testable:
 * tests/phoneQaSection.test.ts. The workflow passes the body through PR_BODY and
 * the changed paths (one per line, old AND new name of a rename) through
 * PR_FILES -- never interpolated into a shell command.
 *
 * Exit codes: 0 pass (or no UI path changed), 1 the PR body violates the format,
 * 2 cannot run: PR_BODY or PR_FILES unset, or PR_FILES empty (every PR changes at
 * least one file, so an empty list is a broken pipe, never "nothing to check").
 *
 *   PR_BODY="$BODY" PR_FILES="$FILES" node scripts/check-pr-phone-qa.mjs
 *   node scripts/check-pr-phone-qa.mjs --self-test
 */
import { isEntryPoint } from './lib/entry-point.mjs';

export const HEADING = '## Phone QA';
export const LABELS = ['Sizes checked', 'Walked', 'Not verified'];

/** The paths whose change can move pixels on a phone. */
export const UI_PATH_RE = /^(?:(?:src|app)\/.+\.(?:tsx|css)|tailwind\.config\.[^/]+|public\/.+|index\.html)$/;

export const FORMAT_HELP = [
  'Required format in the PR description (this PR changes UI paths):',
  '',
  HEADING,
  '- Sizes checked: <viewports, e.g. 390x844 and 360x640>',
  '- Walked: <pages and flows walked at those sizes, and how (phone suite, browser walk)>',
  '- Not verified: <what you did not check; "Nothing" needs 12+ chars of explanation>',
].join('\n');

const PLACEHOLDER_WORDS = ['n/a', 'na', 'none', 'todo', 'tbd', '-'];
const MIN_CHARS = 12;
const SIZE_RE = /\b\d{3,4}\s*[x\u00d7]\s*\d{3,4}\b/i;

const HEADING_RE = /^[ \t]{0,3}##[ \t]+phone[ \t]+qa[ \t]*#*[ \t]*$/i;
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
  const value = raw.replace(/^(?:\*\*|__)/, '').trim();
  const lower = value.toLowerCase();
  if (lower === '') return label + ': empty after the colon';
  if (PLACEHOLDER_WORDS.includes(lower.replace(/[.!]+$/, ''))) {
    return label + ': placeholder text ("' + value + '")';
  }
  if (label === 'Sizes checked') {
    return SIZE_RE.test(value) ? null : label + ': names no viewport size like 390x844 ("' + value + '")';
  }
  let rest = lower;
  if (label === 'Not verified') rest = rest.replace(/^\s*nothing\b/, ' ');
  if (stripPunct(rest).length < MIN_CHARS) {
    const why =
      label === 'Not verified' && /^\s*nothing\b/i.test(value)
        ? '"Nothing" must be followed by at least ' + MIN_CHARS + ' characters of explanation'
        : 'placeholder or too short (under ' + MIN_CHARS + ' characters of real content)';
    return label + ': ' + why + ' ("' + value + '")';
  }
  return null;
}

/** @param {string[]} files @returns {string[]} the changed paths that are UI paths */
export function uiPaths(files) {
  return files.filter((f) => UI_PATH_RE.test(f));
}

/** @param {string[]} files */
export function touchesUi(files) {
  return uiPaths(files).length > 0;
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
    return { ok: false, problems: ['Section "' + HEADING + '" appears ' + starts.length + ' times; keep exactly one'] };
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
  if (typeof env.PR_FILES !== 'string') {
    log.error('PR_FILES is not set: the workflow must pass the changed paths in the environment.');
    return 2;
  }
  const files = env.PR_FILES.split('\n').map((f) => f.trim()).filter(Boolean);
  if (files.length === 0) {
    log.error('PR_FILES is empty: a PR always changes at least one file, so the file list did not arrive.');
    return 2;
  }
  const ui = uiPaths(files);
  if (ui.length === 0) {
    log.log('phone-qa-section: OK -- no UI path changed (' + files.length + ' files), the section is not required.');
    return 0;
  }
  const { ok, problems } = parse(env.PR_BODY);
  if (ok) {
    log.log('phone-qa-section: OK -- "' + HEADING + '" section is filled in (' + ui.length + ' UI paths changed).');
    return 0;
  }
  log.error('phone-qa-section: FAIL -- ' + ui.length + ' UI path(s) changed, e.g. ' + ui.slice(0, 3).join(', '));
  for (const p of problems) log.error('  - ' + p);
  log.error('\n' + FORMAT_HELP);
  return 1;
}

const FILLED = [
  HEADING,
  '- Sizes checked: 390x844 and 360x640',
  '- Walked: organiser page as owner, Save bar up, scrolled top to bottom',
  '- Not verified: iOS safe-area inset (Chromium cannot emulate it)',
].join('\n');

function selfTest(log) {
  const cases = [
    ['filled section passes', FILLED, true],
    ['null body fails', null, false],
    ['body without the section fails', 'Summary only', false],
    ['size line without a WxH fails', FILLED.replace('390x844 and 360x640', 'phone sizes'), false],
    ['placeholder walked line fails', FILLED.replace('organiser page as owner, Save bar up, scrolled top to bottom', 'n/a'), false],
    ['missing Not verified line fails', FILLED.split('\n').slice(0, 3).join('\n'), false],
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
  const scope = [
    ['src tsx is UI', ['src/components/BottomNav.tsx'], true],
    ['src/index.css is UI', ['src/index.css'], true],
    ['tailwind config is UI', ['tailwind.config.ts'], true],
    ['public asset is UI', ['public/og/default.png'], true],
    ['docs only is not UI', ['docs/a.md', 'README.md'], false],
    ['app route tsx is UI', ['app/InitialVisiblePageTransition.tsx'], true],
    ['src ts is not UI', ['src/lib/utils.ts'], false],
    ['CI only is not UI', ['.github/workflows/phone-qa.yml', 'tests/e2e-phone/helpers.ts'], false],
  ];
  for (const [name, files, want] of scope) {
    if (touchesUi(files) !== want) {
      failed++;
      log.error('FAIL scope ' + name + ': expected ' + want);
    }
  }
  // Exit-code owner driven end to end, each branch pinned (R5).
  const quiet = { log() {}, error() {} };
  const UI = 'src/components/BottomNav.tsx';
  const exits = [
    ['no PR_BODY is infrastructure (2)', main([], { PR_FILES: UI }, quiet), 2],
    ['no PR_FILES is infrastructure (2)', main([], { PR_BODY: FILLED }, quiet), 2],
    ['empty PR_FILES is infrastructure (2)', main([], { PR_BODY: FILLED, PR_FILES: '\n' }, quiet), 2],
    ['UI change without the section is a violation (1)', main([], { PR_BODY: 'nothing here', PR_FILES: UI }, quiet), 1],
    ['UI change with the section passes (0)', main([], { PR_BODY: FILLED, PR_FILES: UI }, quiet), 0],
    ['non-UI change without the section passes (0)', main([], { PR_BODY: 'nothing here', PR_FILES: 'docs/a.md' }, quiet), 0],
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
  log.log('PASS self-test -- ' + (cases.length + scope.length + exits.length) + ' cases, both directions.');
  return true;
}

if (isEntryPoint(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
