#!/usr/bin/env node
/**
 * CI-honesty guard over the guard scripts themselves.
 *
 * The arc that produced this file kept finding the same defect in different
 * costumes: a check that reports green without having checked anything. It is
 * the worst failure mode a CI suite has, because it is invisible -- a red check
 * gets fixed, a falsely-green one is trusted for months.
 *
 * Surveyed 2026-08-04 across the 81 scripts/check-*.mjs on bbb86e4:
 *   - 17 scripts had at least one path that exits 0 without asserting.
 *   - 1 of 81 (check-plan-hygiene.mjs) proved it can actually fail.
 * The sharpest example was check-sourcemap-debugids.mjs: when the live bundle
 * carried NO Sentry-tagged chunks -- the exact regression it guards -- it hit
 * a zero-sample branch and exited green. The guard inverted under its own
 * failure mode.
 *
 * The repo had already written both remedies down and then applied them almost
 * nowhere. This script promotes them from convention to contract:
 *   - scripts/lib/previewProbe.mjs :: assertMeasured() -- "a check must not
 *     report success without measuring what it promised" (4 consumers).
 *   - scripts/check-plan-hygiene.mjs self-test -- every rule proven in BOTH
 *     directions against tmpdir fixtures (1 consumer).
 *
 * FOUR RULE CLASSES (the four queued from admin docs/open-loops.md):
 *   R1 silent-skip     a green exit reachable from a missing secret, a walled
 *                      URL, an undeployed RPC, or an empty sample, with no
 *                      escalation env and no assertMeasured floor.
 *   R2 swallowed-error a catch with an empty body, or a .catch that returns a
 *                      default -- an unreadable file then scans clean.
 *   R3 exit-drift      the 0/1/2 contract: 0 pass, 1 contract violated,
 *                      2 infrastructure. Missing creds must be 2, not 1 or 0.
 *   R4 no-canary       a guard with no proof it can fail. Every script without
 *                      one is recorded in the allowlist, so retrofitting stays
 *                      a burn-down -- but a NEW script must carry one to pass.
 *
 * RATCHET. Today violations are frozen in
 * scripts/script-conventions-allowlist.json. The guard fails on a NEW
 * violation, on a COUNT INCREASE, and -- deliberately -- on a STALE entry, so
 * the allowlist can only ever shrink. Same shape as
 * scripts/rpc-typing-allowlist.json, which this mirrors on purpose.
 *
 * A ratchet is not an amnesty: an allowlisted script is still lying to you. The
 * allowlist is the burn-down list, and a re-baseline after a fix locks the win.
 *
 * Local:  node scripts/check-script-conventions.mjs
 *         node scripts/check-script-conventions.mjs --write      (re-baseline)
 *         node scripts/check-script-conventions.mjs --self-test  (prove rules)
 * CI:     .github/workflows/db-contract-check.yml -- no DB, no network, no env.
 *
 * Exit: 0 pass, 1 convention violated, 2 the guard could not run.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ALLOWLIST_PATH = 'scripts/script-conventions-allowlist.json';

/*
 * R4 used to be dropped here behind a CANARY_ADVISORY flag. That flag filtered
 * every R4 hit unconditionally, with no new-vs-pre-existing distinction, so the
 * rule could not fail for ANY script and its hits never reached the allowlist
 * either -- while the header claimed new scripts were held to it. R4 now goes
 * through the same ratchet as R1-R3: the ~80 canary-less scripts are recorded
 * as debt and pass, and a NEW script with no canary is an addition, which
 * fails. Retrofitting stays a burn-down; the allowlist is the record of it.
 */

/** Scripts that are themselves fixtures/tools, not guards. */
const NOT_A_GUARD = new Set([
  'check-script-conventions.mjs',
  'resolve-preview-url.mjs',
]);

// ---------------------------------------------------------------------------
// Rule detection
//
// Regex-based, not AST-based. The scripts are formulaic (~55 share a
// copy-pasted skeleton), the patterns are distinctive, and a regex guard that
// ships beats an AST guard that does not. The cost is false positives, which
// the allowlist absorbs -- and every rule is proven in BOTH directions by the
// self-test, so a rule that silently stops matching is itself a failure.
//
// stripNoise below is a hand-rolled character scanner, NOT a regex, for two
// measured reasons. (1) The obvious regex for a quoted literal,
// /' (?: BS . | [^ BS '] )* '/, backtracks catastrophically on an apostrophe
// used in prose: it hung for over 120s on check-og-images.mjs. The scanner is
// linear. (2) This file is authored through a FUSE mount observed to silently
// eat literal backslashes inside heredocs, which corrupts such a pattern into
// one that still parses but means something else -- exactly how that hang was
// introduced. The scanner spells its one backslash as a char code instead.
// ---------------------------------------------------------------------------

/** Words after which a '/' opens a regex literal rather than dividing. */
const REGEX_LEAD_WORDS = new Set([
  'return', 'typeof', 'case', 'in', 'of', 'do', 'else', 'yield', 'await',
]);

/** Punctuation after which a '/' opens a regex literal. */
const REGEX_LEAD_PUNCT = '(,=:[!&|?{};+-*%^~<>';

function isWordChar(ch) {
  return /[A-Za-z0-9_$]/.test(ch);
}

/**
 * True when the '/' about to be read opens a regex literal rather than being a
 * division operator. Decided from the last significant character before it --
 * the standard heuristic, and sufficient for guard scripts.
 */
function opensRegex(lastSig, lastWord) {
  if (lastSig === '') return true;
  if (REGEX_LEAD_PUNCT.includes(lastSig)) return true;
  return REGEX_LEAD_WORDS.has(lastWord);
}

/**
 * Index just past the closing '/' of the regex literal starting at `start`, or
 * -1 if it does not close on this line (in which case the '/' was not a regex
 * after all). A '/' inside a [...] character class is literal, not the closer.
 */
function endOfRegex(src, start) {
  const BS = String.fromCharCode(92);
  const NL = String.fromCharCode(10);
  let k = start + 1;
  let inClass = false;

  while (k < src.length) {
    const ch = src[k];
    if (ch === NL) return -1;
    if (ch === BS) {
      k += 2;
      continue;
    }
    if (ch === '[') inClass = true;
    else if (ch === ']') inClass = false;
    else if (ch === '/' && !inClass) return k + 1;
    k += 1;
  }
  return -1;
}

/**
 * Strip block comments, line comments, string literals and regex literals, so
 * that PROSE about a green exit -- or a PATTERN describing one -- is never
 * mistaken for the real thing. Newlines are preserved inside blanked regions so
 * reported line numbers stay accurate.
 */
export function stripNoise(src) {
  const BS = String.fromCharCode(92); // backslash, spelled out -- see note above
  const NL = String.fromCharCode(10);
  const out = [];
  let i = 0;
  let state = 'code'; // code | block | line | tmpl | sq | dq
  let quote = '';
  let lastSig = ''; // last non-space code char -- regex-vs-division
  let lastWord = ''; // and the identifier it ended -- for `return /re/`

  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];

    if (state === 'code') {
      if (c === '/' && next === '*') {
        state = 'block';
        out.push('  ');
        i += 2;
        continue;
      }
      // A // that is not part of a :// URL scheme.
      if (c === '/' && next === '/' && src[i - 1] !== ':') {
        state = 'line';
        out.push('  ');
        i += 2;
        continue;
      }
      // A regex literal is data, exactly like a string, so blank its interior.
      // Without this a character class such as ['"] drops the scanner into
      // string state and silently blanks the rest of that line from every rule.
      if (c === '/' && opensRegex(lastSig, lastWord)) {
        const end = endOfRegex(src, i);
        if (end > 0) {
          out.push('/');
          for (let k = i + 1; k < end - 1; k++) out.push(' ');
          out.push('/');
          lastSig = '/';
          lastWord = '';
          i = end;
          continue;
        }
      }
      if (c === '`' || c === "'" || c === '"') {
        state = c === '`' ? 'tmpl' : c === "'" ? 'sq' : 'dq';
        quote = c;
        out.push(c);
        i += 1;
        continue;
      }
      out.push(c);
      if (c.trim() !== '') {
        lastSig = c;
        lastWord = isWordChar(c) ? lastWord + c : '';
      }
      i += 1;
      continue;
    }

    if (state === 'block') {
      if (c === '*' && next === '/') {
        state = 'code';
        out.push('  ');
        i += 2;
        continue;
      }
      out.push(c === NL ? NL : ' ');
      i += 1;
      continue;
    }

    if (state === 'line') {
      if (c === NL) {
        state = 'code';
        out.push(NL);
        i += 1;
        continue;
      }
      out.push(' ');
      i += 1;
      continue;
    }

    // Inside a string literal. A backslash escapes exactly one character, so an
    // apostrophe in prose can never run away -- this is the linear-time
    // replacement for the regex that caught fire on check-og-images.mjs.
    if (c === BS) {
      out.push(' ');
      if (i + 1 < src.length) out.push(src[i + 1] === NL ? NL : ' ');
      i += 2;
      continue;
    }
    if (c === quote) {
      state = 'code';
      quote = '';
      out.push(c);
      i += 1;
      continue;
    }
    // An unterminated literal must not swallow the rest of the file: a raw
    // newline inside a non-template quote means the author never closed it.
    if (c === NL && state !== 'tmpl') {
      state = 'code';
      quote = '';
      out.push(NL);
      i += 1;
      continue;
    }
    out.push(c === NL ? NL : ' ');
    i += 1;
  }

  return out.join('');
}

/**
 * Conditions meaning "we could not check", as opposed to "we checked and it is
 * fine". Each key is a distinct diagnosis, so the allowlist records WHY a
 * script is exempt rather than merely that it is.
 */
const SKIP_TRIGGERS = [
  { key: 'missing-secret', re: /if\s*\(\s*!\s*(?:token|key|apiKey|secret|creds?|serviceAccount)\b/i },
  // Both spellings, and this is not defensive padding -- it is a bug this rule
  // actually had. When check-og-images.mjs and check-seo.mjs moved from calling
  // previewIsWalled() directly to calling the skipIfWalledPreview() wrapper, the
  // skip construct did not change by one character, but the identifier no longer
  // contained the substring this regex looks for, so R1 went blind and the
  // ratchet reported the debt PAID. A rule keyed on a NAME is only as durable as
  // that name: any future wrapper needs a case here and a self-test beside it.
  { key: 'walled-preview', re: /(?:previewIsWalled|skipIfWalledPreview)\s*\(/ },
  { key: 'undeployed-rpc', re: /42883/ },
  { key: 'empty-sample', re: /(?:probed|compared|checked|sampled|measured|found)\s*===\s*0/ },
  { key: 'empty-sample', re: /\.length\s*===\s*0|!\w+\.length\b/ },
];

/** An escalation hatch makes a skip honest: CI can force it to fail. */
const ESCALATION = /REQUIRE_|_ENFORCE\b|STRICT\b|assertMeasured\s*\(/;

export function findSilentSkips(src) {
  const code = stripNoise(src);
  const hits = [];
  const lines = code.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const greenExit = /process\.exit\(\s*0\s*\)/.test(lines[i]);
    const bareReturn = /^\s*return\s*;/.test(lines[i]);
    if (!greenExit && !bareReturn) continue;

    const window = lines.slice(Math.max(0, i - 12), i + 1).join('\n');
    // The hatch has to guard THIS skip. Tested against the whole file it
    // disarmed the rule wholesale: one REQUIRE_ token on an unrelated branch
    // hid every other silent skip in the same script -- including the zero-
    // sample green exit in check-sourcemap-debugids.mjs that motivated R1.
    if (ESCALATION.test(window)) continue;
    for (const trigger of SKIP_TRIGGERS) {
      if (!trigger.re.test(window)) continue;
      hits.push({ rule: 'R1', kind: trigger.key, line: i + 1 });
      break;
    }
  }
  return hits;
}

export function findSwallowedErrors(src) {
  const code = stripNoise(src);
  const hits = [];
  const lines = code.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    // A catch whose body is empty: the next non-blank line closes the block.
    if (/catch\s*(?:\([^)]*\))?\s*\{\s*$/.test(lines[i])) {
      const next = lines[i + 1] ?? '';
      // When the very next line closes the block the body is already known to
      // be empty, so there is nothing left to "handle". The old 3-line window
      // read PAST that brace, letting unrelated following code -- a throw, an
      // exit -- suppress a real hit in a ratchet meant only ever to tighten.
      if (/^\s*\}/.test(next)) {
        hits.push({ rule: 'R2', kind: 'empty-catch', line: i + 1 });
      }
    }
    // Single-line empty catch.
    if (/catch\s*(?:\([^)]*\))?\s*\{\s*\}/.test(lines[i])) {
      hits.push({ rule: 'R2', kind: 'empty-catch', line: i + 1 });
    }
    // A .catch that substitutes a default value for the error.
    if (/\.catch\s*\(\s*\(\s*\w*\s*\)\s*=>\s*(?:\[\s*\]|null|undefined|\{\s*\})\s*\)/.test(lines[i])) {
      hits.push({ rule: 'R2', kind: 'swallowing-catch', line: i + 1 });
    }
  }
  return hits;
}

export function findExitDrift(src) {
  const code = stripNoise(src);
  const hits = [];
  const lines = code.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    // A missing-credential branch is infrastructure: it must exit 2.
    if (/if\s*\(\s*!\s*url\s*\|\|\s*!\s*key\s*\)/.test(lines[i])) {
      const body = lines.slice(i, i + 6).join('\n');
      const isTwo = /process\.exit\(\s*2\s*\)/.test(body);
      const isOther = /process\.exit\(\s*[013-9]\s*\)/.test(body);
      if (!isTwo && isOther) hits.push({ rule: 'R3', kind: 'creds-not-exit-2', line: i + 1 });
    }
  }
  return hits;
}

export function findMissingCanary(src) {
  // Identifiers, against STRIPPED source. Tested against the raw text a script
  // that merely mentions "self-test" in a comment or a --help string satisfied
  // the rule without carrying a canary at all.
  if (/selfTest|SELF_?TEST/.test(stripNoise(src))) return [];
  return [{ rule: 'R4', kind: 'no-canary', line: 0 }];
}

export function scanSource(src) {
  return [
    ...findSilentSkips(src),
    ...findSwallowedErrors(src),
    ...findExitDrift(src),
    ...findMissingCanary(src),
  ];
}

/**
 * Collapse to { file: { "R1:empty-sample": n } } -- line-independent, so
 * reformatting a script does not churn the allowlist.
 */
export function tally(hits) {
  const out = {};
  for (const h of hits) {
    const k = h.rule + ':' + h.kind;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

async function scanTree(root) {
  const dir = path.join(root, 'scripts');
  const names = (await fs.readdir(dir))
    .filter((n) => /^(check|lint)-.*\.mjs$/.test(n) && !NOT_A_GUARD.has(n))
    .sort();

  const actual = {};
  for (const name of names) {
    const src = await fs.readFile(path.join(dir, name), 'utf8');
    const hits = scanSource(src);
    const counts = tally(hits);
    if (Object.keys(counts).length > 0) actual['scripts/' + name] = counts;
  }
  return actual;
}

export function diffAgainstAllowlist(actual, allow) {
  const additions = [];
  const increases = [];
  const stale = [];

  for (const file of Object.keys(actual)) {
    for (const rule of Object.keys(actual[file])) {
      const a = actual[file][rule];
      const allowed = allow[file]?.[rule] ?? 0;
      if (allowed === 0) additions.push({ file, rule, actual: a, allowed: 0 });
      else if (a > allowed) increases.push({ file, rule, actual: a, allowed });
    }
  }
  for (const file of Object.keys(allow)) {
    for (const rule of Object.keys(allow[file])) {
      const allowed = allow[file][rule];
      const a = actual[file]?.[rule] ?? 0;
      if (a < allowed) stale.push({ file, rule, actual: a, allowed });
    }
  }
  return { additions, increases, stale };
}

// ---------------------------------------------------------------------------
// Self-test -- every rule proven in BOTH directions.
//
// This guard demands a canary of every other script, so it holds itself to it
// first. A rule that cannot fire is not a rule; a rule that always fires is not
// one either. Each case asserts a violating source DOES trip it and a clean
// source does NOT.
// ---------------------------------------------------------------------------
function selfTest() {
  const cases = [];
  const add = (name, fn, expected) => cases.push({ name, fn, expected });
  const src = (...lines) => lines.join('\n');

  // --- R1 silent-skip: positive ---
  add(
    'R1 fires: green exit after an empty-sample check',
    () => findSilentSkips(src('const rows = await q();', 'if (rows.length === 0) {', '  warn();', '  process.exit(0);', '}')).length,
    1,
  );
  add(
    'R1 fires: green exit when a token is missing',
    () => findSilentSkips(src('if (!token) {', '  warn();', '  process.exit(0);', '}')).length,
    1,
  );
  add(
    'R1 fires: bare return after a walled-preview probe',
    () => findSilentSkips(src('if (await previewIsWalled(BASE)) {', '  warn();', '  return;', '}')).length,
    1,
  );
  // The regression that motivated widening the trigger: wrapping the same probe
  // in a helper renamed the identifier out of the rule's sight, the construct
  // untouched, and R1 fell silent on two real call sites. A rule keyed on a name
  // needs a case per name, or the next wrapper repeats it.
  add(
    'R1 fires through the skipIfWalledPreview wrapper too',
    () => findSilentSkips(src('if (await skipIfWalledPreview(BASE)) {', '  return;', '}')).length,
    1,
  );
  // --- R1: negative ---
  add(
    'R1 silent: the same skip carrying a REQUIRE_ escalation',
    () => findSilentSkips(src('if (!token) {', '  if (process.env.REQUIRE_TOKEN) process.exit(1);', '  process.exit(0);', '}')).length,
    0,
  );
  add(
    'R1 silent: a plain success exit',
    () => findSilentSkips(src('report();', 'process.exit(0);')).length,
    0,
  );
  add(
    'R1 silent: a comment describing the old bug',
    () => findSilentSkips(src('// on rows.length === 0 we used to exit green -- fixed', 'assertRows(rows);')).length,
    0,
  );

  // --- R2 swallowed-error: positive ---
  add('R2 fires: single-line empty catch', () => findSwallowedErrors('try { read(); } catch {}').length, 1);
  add(
    'R2 fires: catch block with an empty body',
    () => findSwallowedErrors(src('try {', '  read();', '} catch (e) {', '}')).length,
    1,
  );
  add(
    'R2 fires: a .catch substituting a default',
    () => findSwallowedErrors('const x = await readdir(d).catch(() => []);').length,
    1,
  );
  // --- R2: negative ---
  add(
    'R2 silent: a catch that rethrows',
    () => findSwallowedErrors(src('try {', '  read();', '} catch (e) {', '  throw e;', '}')).length,
    0,
  );
  add(
    'R2 silent: a catch that exits',
    () => findSwallowedErrors(src('try {', '  read();', '} catch (e) {', '  process.exit(2);', '}')).length,
    0,
  );

  // --- R3 exit-drift: both directions ---
  add(
    'R3 fires: missing creds exiting 1 instead of 2',
    () => findExitDrift(src('if (!url || !key) {', '  report();', '  process.exit(1);', '}')).length,
    1,
  );
  add(
    'R3 silent: missing creds exiting 2',
    () => findExitDrift(src('if (!url || !key) {', '  report();', '  process.exit(2);', '}')).length,
    0,
  );

  // --- R4 no-canary: both directions ---
  add('R4 fires: a script with no canary', () => findMissingCanary('const x = 1;').length, 1);
  add('R4 silent: a script carrying one', () => findMissingCanary('function selfTest() {}').length, 0);
  add(
    'R4 fires: prose MENTIONING a self-test is not a canary',
    () => findMissingCanary(src('// remember to run the self-test here', 'const x = 1;')).length,
    1,
  );

  // --- Canaries for the three scanner defects found in review ---
  add(
    'stripNoise: a quote inside a regex class does not blank the line',
    () => (stripNoise(`const re = /['"]/; process.exit(0);`).includes('process.exit(0)') ? 1 : 0),
    1,
  );
  // The hatch is judged over R1's own 12-line window, so an escalation sitting
  // NEXT to a skip is still taken to guard it -- deliberate. What must not
  // happen is a token 50 lines away silencing the whole file, which is how
  // check-sourcemap-debugids.mjs hid its zero-sample green exit.
  add(
    'R1 fires: an escalation ELSEWHERE in the file does not disarm the rule',
    () =>
      findSilentSkips(
        src(
          'if (process.env.REQUIRE_TOKEN) enforce();',
          ...Array(14).fill('const filler = 1;'),
          'const checked = probe();',
          'if (checked === 0) process.exit(0);',
        ),
      ).length,
    1,
  );
  add(
    'R2 fires: an empty catch followed by an unrelated exit',
    () =>
      findSwallowedErrors(src('try {', '  read();', '} catch (e) {', '}', 'if (bad) process.exit(1);'))
        .length,
    1,
  );

  // --- Ratchet semantics: the stale case is what keeps it shrinking ---
  add(
    'ratchet: a new violation is an addition',
    () => diffAgainstAllowlist({ 'a.mjs': { 'R1:empty-sample': 1 } }, {}).additions.length,
    1,
  );
  add(
    'ratchet: a count increase fails',
    () => diffAgainstAllowlist({ 'a.mjs': { 'R1:empty-sample': 2 } }, { 'a.mjs': { 'R1:empty-sample': 1 } }).increases.length,
    1,
  );
  add(
    'ratchet: a FIXED violation fails as stale, forcing a re-baseline',
    () => diffAgainstAllowlist({}, { 'a.mjs': { 'R1:empty-sample': 1 } }).stale.length,
    1,
  );
  add(
    'ratchet: an exact match passes',
    () => {
      const d = diffAgainstAllowlist({ 'a.mjs': { 'R1:empty-sample': 1 } }, { 'a.mjs': { 'R1:empty-sample': 1 } });
      return d.additions.length + d.increases.length + d.stale.length;
    },
    0,
  );

  // --- The guard must survive its own rules ---
  add('self: stripNoise blanks a block comment', () => stripNoise('/* x */a').trim(), 'a');
  add('self: stripNoise keeps real code', () => stripNoise('exit(0);'), 'exit(0);');

  let failed = 0;
  for (const c of cases) {
    let got;
    try {
      got = c.fn();
    } catch (error) {
      got = 'threw: ' + error.message;
    }
    const ok = got === c.expected;
    if (!ok) failed++;
    const detail = ok ? '' : '  (expected ' + JSON.stringify(c.expected) + ', got ' + JSON.stringify(got) + ')';
    console.log((ok ? 'ok  ' : 'FAIL') + '  ' + c.name + detail);
  }

  if (failed > 0) {
    console.error('\nFAIL self-test -- ' + failed + ' of ' + cases.length + ' case(s).');
    return false;
  }
  console.log('\nPASS self-test -- ' + cases.length + ' cases, every rule proven in both directions.');
  return true;
}

// ---------------------------------------------------------------------------

export async function run({ write = false, root = ROOT } = {}) {
  const actual = await scanTree(root);
  const allowlistAbs = path.join(root, ALLOWLIST_PATH);

  if (write) {
    const sorted = {};
    for (const f of Object.keys(actual).sort()) {
      sorted[f] = {};
      for (const r of Object.keys(actual[f]).sort()) sorted[f][r] = actual[f][r];
    }
    await fs.writeFile(allowlistAbs, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
    const total = Object.values(sorted).reduce(
      (s, rs) => s + Object.values(rs).reduce((a, b) => a + b, 0),
      0,
    );
    console.log('Wrote ' + ALLOWLIST_PATH + ' (' + total + ' violation(s) across ' + Object.keys(sorted).length + ' script(s)).');
    return { ok: true, written: true };
  }

  let allow = {};
  try {
    allow = JSON.parse(await fs.readFile(allowlistAbs, 'utf8'));
  } catch (error) {
    console.error('Script-conventions guard: cannot read ' + ALLOWLIST_PATH + ' (' + error.message + ').');
    console.error('Generate it with: node scripts/check-script-conventions.mjs --write');
    return { ok: false, infra: true };
  }

  const { additions, increases, stale } = diffAgainstAllowlist(actual, allow);

  if (additions.length === 0 && increases.length === 0 && stale.length === 0) {
    const owed = Object.values(allow).reduce((s, rs) => s + Object.values(rs).reduce((a, b) => a + b, 0), 0);
    console.log('Script-conventions guard passed (' + owed + ' known violation(s) still owed in ' + ALLOWLIST_PATH + ').');
    return { ok: true };
  }

  if (additions.length > 0) {
    console.error('\nScript-conventions guard FAILED: a NEW guard script can report green without checking.\n');
    console.error('  R1 silent-skip     add an escalation env (REQUIRE_*/*_ENFORCE) or assertMeasured(),');
    console.error('                     or fail instead of skipping. See scripts/lib/previewProbe.mjs.');
    console.error('  R2 swallowed-error rethrow, exit 2, or record the failure. A file that could not');
    console.error('                     be read has not been checked.');
    console.error('  R3 exit-drift      0 pass / 1 contract violated / 2 infrastructure.');
    console.error('  R4 no-canary       prove it fails: see check-plan-hygiene.mjs.\n');
    for (const v of additions) console.error('  + ' + v.file + '  ' + v.rule + '  (x' + v.actual + ')');
  }
  if (increases.length > 0) {
    console.error('\nScript-conventions guard FAILED: more violations than the allowlist permits.\n');
    for (const v of increases) {
      console.error('  ^ ' + v.file + '  ' + v.rule + '  (' + v.actual + ' > allowed ' + v.allowed + ')');
    }
  }
  if (stale.length > 0) {
    console.error('\nScript-conventions guard FAILED: stale allowlist entries (a violation was fixed -- good!).');
    console.error('Shrink the allowlist to lock in the win:  node scripts/check-script-conventions.mjs --write\n');
    for (const v of stale) {
      console.error('  - ' + v.file + '  ' + v.rule + '  (' + v.actual + ' < allowed ' + v.allowed + ')');
    }
  }
  console.error('');
  return { ok: false };
}

// Only act as a CLI when actually invoked as one. Unguarded, the top-level
// scan plus process.exit ran on mere `import`, so a spec that pulled in one of
// the exports above scanned all 83 guards and then killed the test runner.
const IS_CLI =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (IS_CLI) {
  const argv = process.argv.slice(2);
  const KNOWN_FLAGS = ['--write', '--self-test'];
  const unknown = argv.filter((a) => !KNOWN_FLAGS.includes(a));
  if (unknown.length > 0) {
    console.error('Unknown flag(s): ' + unknown.join(', ') + '. Known: ' + KNOWN_FLAGS.join(', '));
    process.exit(2);
  }

  if (argv.includes('--self-test')) {
    process.exit(selfTest() ? 0 : 1);
  }

  const result = await run({ write: argv.includes('--write') });
  process.exit(result.ok ? 0 : result.infra ? 2 : 1);
}
