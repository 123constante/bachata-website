#!/usr/bin/env node
// Source-hygiene guard: cp1252 round-trip corruption ("mojibake").
//
// WHY THIS EXISTS. CLAUDE.md's "HTML entities over raw Unicode" rule exists
// because the Cowork -> FUSE -> Windows pipeline can read a UTF-8 file as
// cp1252 and re-encode it, turning one character into two or three. The result
// is not a lint nit: it SHIPS. On 2026-07-24 a code review found
// ScheduleBlock.tsx line 406 rendering
//
//     Ã¢ËœÂ¦ Show        (a cp1252 round-trip of U+2726 "âœ¦")
//
// as literal garbage on the live event page, and nothing in CI had noticed.
// A repo-wide sweep found that one instance -- which is exactly the state in
// which a guard is cheap to add and worth keeping.
//
// SCOPE, deliberately narrow. This flags CORRUPTION only, not raw Unicode.
// The repo carries a lot of legitimate non-ASCII in comments (box-drawing
// rules, arrows, em dashes) that renders nowhere and harms nothing; failing on
// that would produce a guard people mute. Corruption has no legitimate use, so
// this one can stay hard.
//
// Local:  node scripts/check-mojibake.mjs
// CI:     part of `npm run lint`.

import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { isEntryPoint } from './lib/entry-point.mjs';

// '.claude' is in scope because .claude/settings.local.json is REWRITTEN by the
// harness on every permission grant, and that rewrite re-encodes untouched
// entries into literal mojibake. It happened twice in one session during
// supabase-defer P0 (#202), silently dropping two permission grants each time.
// The SHIP GATE caught it both times; this chain could not, because the guard
// could not see the directory. Detection only -- nothing here rewrites the file.
const ROOTS = ['src', 'app', 'scripts', 'tests', '.claude'];
const EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.html', '.json']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.vercel']);

// Machine-written, gitignored local state under .claude/ (see .gitignore). CI
// checks out none of these, so scanning them could only ever produce a local red
// that CI cannot reproduce -- which is how a guard gets muted. .review-stamp.json
// is the sharp one: it embeds arbitrary reviewer text, so a review that
// legitimately QUOTED mojibake would redden the tree for naming the thing.
const SKIP_FILES = new Set(['.review-stamp.json', '.review-mint-log.json', '.session-lock.json']);
const isGeneratedLocalState = (name) =>
  SKIP_FILES.has(name) || name.endsWith('-review-findings.json');
// This file is excluded from its own scan: the cp1252 detection alphabet
// below and the positive control further down are both, necessarily, literal
// mojibake. Scanning itself would make the guard permanently and uselessly red.
const SELF = 'check-mojibake.mjs';

// A UTF-8 lead byte mis-decoded as cp1252 becomes one of these...
const LEAD = 'ÂÃâ';
// ...followed by a continuation byte mis-decoded into the cp1252 high range.
// Listing the actual cp1252 mappings (rather than a blanket -ÿ)
// keeps legitimate accented prose from tripping the guard.
const CONT =
  '-¿ŒœŠšŸŽžƒˆ˜' +
  '–—‘’‚“”„†‡•…' +
  '‰‹›€™';
const MOJIBAKE = new RegExp(`[${LEAD}][${CONT}]`);

/**
 * Files a scan of `roots` would open. Takes its roots rather than closing over
 * ROOTS so the canary can assert WHAT is in scope -- proving the regex fires
 * says nothing about whether the guard ever looks at the directory that needs it.
 */
export function collectFiles(roots) {
  const files = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // a root that does not exist in this checkout is not an error
    }
    for (const e of entries) {
      if (SKIP_DIRS.has(e.name)) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (EXTS.has(extname(e.name)) && e.name !== SELF && !isGeneratedLocalState(e.name)) {
        files.push(p);
      }
    }
  };
  for (const r of roots) walk(r);
  return files;
}

/** Corrupted lines in one file's text. Pure, so the canary drives it directly. */
export function findHits(file, text) {
  const hits = [];
  if (!MOJIBAKE.test(text)) return hits; // fast path
  text.split(/\r?\n/).forEach((line, i) => {
    if (MOJIBAKE.test(line)) hits.push({ file, line: i + 1, text: line.trim().slice(0, 100) });
  });
  return hits;
}

// Self-test: prove the detector still fires on the exact sequence that shipped.
const CONTROL = 'âœ¦ Show';
/**
 * The detector must still fire on the sequence that shipped. Kept as a FUNCTION
 * rather than a top-level side effect: at module scope this ran on mere
 * `import` and killed the importing process through process.exit() -- the two
 * things the CLI guard and the exitCode convention at the foot of this file
 * exist to prevent, defeated by the block they were added alongside.
 *
 * The CONTROL declaration above deliberately stays where it is: it is literal
 * mojibake, and this file is edited over a mount that mangles exactly those
 * bytes, so it is never worth re-transporting to gain an indent level.
 */
function assertControl() {
  if (MOJIBAKE.test(CONTROL)) return 0;
  console.error('check-mojibake: detector failed its own positive control -- regex has regressed.');
  return 1;
}

function runScan() {
  const control = assertControl();
  if (control) return control;

  const files = collectFiles(ROOTS);

  // POSITIVE ASSERTION. "Found no corruption" and "never opened a file" are
  // otherwise indistinguishable, both exiting 0. A guard whose whole purpose is
  // to end a silent failure must not have one of its own: if the roots are
  // renamed or the extension list drifts, that is a broken guard, not a pass.
  if (files.length === 0) {
    console.error(`check-mojibake: scanned 0 files under ${ROOTS.join(', ')} -- cannot verify.`);
    return 1;
  }

  const hits = [];
  for (const f of files) {
    let text;
    try {
      text = readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    hits.push(...findHits(f, text));
  }

  if (hits.length) {
    console.error(`\ncp1252 corruption found in ${hits.length} line(s):\n`);
    for (const h of hits) console.error(`  ${h.file}:${h.line}\n      ${h.text}`);
    console.error(
      '\nThese are UTF-8 characters that were read as cp1252 and re-encoded. They render as\n' +
        'garbage in the browser. Replace with an HTML entity in JSX text (&mdash;, &hellip;,\n' +
        '&#10022;) or a \\u escape inside a string/template literal, then re-write the file via\n' +
        'scripts/safe-write.py. See CLAUDE.md, "HTML entities over raw Unicode".\n',
    );
    return 1;
  }

  console.log(`check-mojibake: ${files.length} files scanned, no cp1252 corruption.`);
  return 0;
}

// ---------------------------------------------------------------------------
// Canary (rule R4 of check-script-conventions.mjs -- a guard with no proof it
// can fail is not a guard). The CONTROL above proves the REGEX still fires; it
// says nothing about whether the scan looks anywhere useful, and the scope is
// the whole substance of widening ROOTS to .claude. These cases prove the scope.
//
// The corrupt fixture is built from code points rather than written literally:
// this file is edited over a mount whose transport is exactly what mangles these
// bytes, and a fixture that silently decayed would assert nothing. E2 9C A6 is
// UTF-8 for U+2726; read as cp1252 it becomes U+00E2 U+0153 U+00A6 -- the
// sequence that shipped to the live event page in ScheduleBlock.tsx.
// ---------------------------------------------------------------------------

function selfTest() {
  const CORRUPT = String.fromCharCode(0x00e2, 0x0153, 0x00a6) + ' Show';
  const cases = [
    ['a corrupt line is reported', () => findHits('f.json', CORRUPT).length, 1],
    ['a clean ASCII line is not', () => findHits('f.json', '"Bash(git status)"').length, 0],
    [
      'the corrupt line carries its 1-based number',
      () => findHits('f.json', 'clean line\n' + CORRUPT)[0].line,
      2,
    ],
    ['.claude is in the scanned roots', () => ROOTS.includes('.claude'), true],
    [
      '.claude/settings.local.json is actually collected',
      () => collectFiles(['.claude']).some((f) => f.endsWith('settings.local.json')),
      true,
    ],
    // Driven through the predicate directly, NOT through collectFiles. The
    // obvious spelling -- assert collectFiles(['.claude']) omits
    // .review-stamp.json -- passes vacuously wherever that file does not exist,
    // which is every CI checkout (it is gitignored). It would have gone green in
    // CI with the skip logic deleted outright.
    ['generated local state is skipped', () => isGeneratedLocalState('.review-stamp.json'), true],
    ['the session lock is skipped', () => isGeneratedLocalState('.session-lock.json'), true],
    [
      'a per-review findings file is skipped by suffix',
      () => isGeneratedLocalState('pr-202-review-findings.json'),
      true,
    ],
    [
      'settings.local.json is NOT skipped -- it is the whole point',
      () => isGeneratedLocalState('settings.local.json'),
      false,
    ],
    ['the positive control still fires', () => assertControl(), 0],
    ['a root that does not exist is not an error', () => collectFiles(['no-such-dir']).length, 0],
  ];

  let failed = 0;
  for (const [name, run, expected] of cases) {
    let actual;
    try {
      actual = run();
    } catch (err) {
      actual = `unexpected throw: ${err.message}`;
    }
    const ok = Object.is(actual, expected);
    if (!ok) failed++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}`);
    if (!ok) {
      console.log(`          expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  }
  if (failed) {
    console.error(`\nFAIL self-test -- ${failed} of ${cases.length} case(s).`);
    return 1;
  }
  console.log(`\nPASS self-test -- ${cases.length} cases, both directions.`);
  return 0;
}

// process.exitCode rather than process.exit(): on Linux an exit() straight after
// a large stdout write truncates it, which is invisible on Windows and cost this
// repo a guard that printed 194 of 904 lines in CI.
// Only act as a CLI when invoked as one -- the same guard, and for the same
// reason, as check-script-conventions.mjs. This module exports its helpers now;
// unguarded, merely importing one would scan the tree and set process.exitCode.
// Realpath-to-realpath (scripts/lib/entry-point.mjs). The string compare it
// replaces made the scan exit 0 having read no files at all through a junction.
if (isEntryPoint(import.meta.url)) {
  const argv = process.argv.slice(2);
  const KNOWN_FLAGS = ['--self-test'];
  const unknown = argv.filter((a) => !KNOWN_FLAGS.includes(a));
  if (unknown.length) {
    console.error(
      `check-mojibake: unknown flag(s) ${unknown.join(' ')}. Known: ${KNOWN_FLAGS.join(', ')}.`,
    );
    process.exitCode = 1;
  } else {
    process.exitCode = argv.includes('--self-test') ? selfTest() : runScan();
  }
}
