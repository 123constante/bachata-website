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

const ROOTS = ['src', 'app', 'scripts', 'tests'];
const EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.html', '.json']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.vercel']);
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

const files = [];
function walk(dir) {
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
    else if (EXTS.has(extname(e.name)) && e.name !== SELF) files.push(p);
  }
}
for (const r of ROOTS) walk(r);

// POSITIVE ASSERTION. "Found no corruption" and "never opened a file" are
// otherwise indistinguishable, both exiting 0. A guard whose whole purpose is
// to end a silent failure must not have one of its own: if the roots are
// renamed or the extension list drifts, that is a broken guard, not a pass.
if (files.length === 0) {
  console.error(`check-mojibake: scanned 0 files under ${ROOTS.join(', ')} -- cannot verify.`);
  process.exit(1);
}

// Self-test: prove the detector still fires on the exact sequence that shipped.
const CONTROL = 'âœ¦ Show';
if (!MOJIBAKE.test(CONTROL)) {
  console.error('check-mojibake: detector failed its own positive control -- regex has regressed.');
  process.exit(1);
}

const hits = [];
for (const f of files) {
  let text;
  try {
    text = readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  if (!MOJIBAKE.test(text)) continue; // fast path
  text.split(/\r?\n/).forEach((line, i) => {
    if (MOJIBAKE.test(line)) hits.push({ file: f, line: i + 1, text: line.trim().slice(0, 100) });
  });
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
  process.exit(1);
}

console.log(`check-mojibake: ${files.length} files scanned, no cp1252 corruption.`);
