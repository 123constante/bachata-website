#!/usr/bin/env node
// Masking guard for GitHub Actions workflows.
//
// The dead-Lighthouse incident: a job that could not run AT ALL reported SUCCESS
// on 13 consecutive PRs because a job-level `continue-on-error: true` masked its
// failure -- a dead check was indistinguishable from a passing one. This lint
// makes that impossible to reintroduce silently: every `continue-on-error: true`
// must carry a `soft-signal:` justification in the comment block immediately
// above it (or trailing on the same line). An unjustified one fails the check.
//
// continue-on-error is legitimate for a genuinely optional, already-MEASURED
// signal (e.g. a warn-only budget during a bake). It must never be the reason a
// check that failed to measure looks green -- that is what the previewProbe
// fail-loud contract enforces on the script side; this lint enforces the intent
// on the workflow side.

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
