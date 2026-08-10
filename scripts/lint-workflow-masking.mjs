#!/usr/bin/env node
// Masking tripwire for GitHub Actions workflows -- NARROW BY DESIGN.
//
// The dead-Lighthouse incident: a job that could not run AT ALL reported SUCCESS
// on 13 consecutive PRs because a job-level `continue-on-error: true` masked its
// failure -- a dead check was indistinguishable from a passing one. This lint
// catches a REPEAT of that exact spelling: every literal `continue-on-error: true`
// line must carry a `soft-signal:` justification in the comment block immediately
// above it (or trailing on the same line). An unjustified one fails the check.
//
// WHAT IT DOES NOT CATCH -- do not read a green run here as "masking is now
// impossible". This is a single per-line regex, not a YAML parser, so it is blind
// to other VALID spellings of the same directive (each verified against the
// actions/runner YAML reader + the workflow schema): the `${{ }}` expression form
// (an official GHA docs example), `True`/`TRUE` (the reader accepts them; this
// regex is case-sensitive), a plain `true` on the line AFTER the key, and
// anchor/alias (`&x true` ... `*x`, on github.com since 2025-09-18) at both the
// anchor and the alias site. It only reads .github/workflows, so a local composite
// action's `runs.steps[*].continue-on-error` is out of scope. And it says nothing
// about non-YAML masking -- `|| true` / `set +e` / a trailing `exit 0` in a `run:`
// block, or an `if:` that silently never fires. None of those exist in the tree
// today; this guard would not notice if one arrived.
//
// continue-on-error is legitimate for a genuinely optional, already-MEASURED
// signal (e.g. a warn-only budget during a bake -- perf-budget.yml). The intended
// invariant is that a check which FAILED TO MEASURE must not look green. Two
// honest limits on that invariant, so this comment does not overclaim as the
// previous one did:
//   - It is NOT enforced on the script side. previewProbe's assertMeasured() is an
//     opt-in helper, not a structural guarantee -- check-doc-weight,
//     check-lighthouse, check-og-images, check-sourcemap-debugids and check-seo
//     call it (5); any new deployed-URL check can still skip it. Counting by
//     grep overcounts: check-bundle-budget defines its OWN local assertMeasured
//     with a different signature and does not consume this one. The fail-loud
//     contract is a convention where invoked, not a repo-wide guarantee.
//   - There is ONE sanctioned case where an UNMEASURED check still goes green: a
//     positively-proven Deployment Protection wall on a PR preview skips with a
//     ::warning:: (perf-budget.yml documents this; no code change can open a wall).
// So treat this lint as one layer of defence-in-depth against the specific 2026
// regression, not as a proof that no check can be masked green.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = '.github/workflows';
const files = readdirSync(DIR).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));

let violations = 0;
for (const f of files) {
  const path = join(DIR, f);
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*continue-on-error:\s*true\s*(#.*)?$/.test(lines[i])) continue;

    // Justified if `soft-signal:` is on the same line, or anywhere in the
    // contiguous comment block immediately above (blank lines allowed between
    // the comment and the directive). Stop at the first real code line so a
    // justification for some OTHER directive can't be borrowed.
    let justified = /soft-signal:/.test(lines[i]);
    for (let j = i - 1; j >= 0 && !justified; j--) {
      const t = lines[j].trim();
      if (t === '') continue;
      if (t.startsWith('#')) {
        if (/soft-signal:/.test(t)) justified = true;
        continue;
      }
      break;
    }

    if (!justified) {
      console.error(`${path}:${i + 1}: continue-on-error with no "soft-signal:" justification`);
      violations += 1;
    }
  }
}

if (violations) {
  console.error(`\n${violations} unjustified continue-on-error use(s).`);
  console.error('A job/step that cannot MEASURE must fail loudly, not be masked. If this');
  console.error('continue-on-error softens a genuinely optional, already-measured signal,');
  console.error('add a "# soft-signal: <reason>" comment in the block directly above it.');
  process.exit(1);
}
console.log(`Workflow masking lint: ${files.length} files scanned, no unjustified continue-on-error.`);
