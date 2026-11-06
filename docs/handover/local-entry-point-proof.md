# Handover: local-entry-point-proof (Website)

Brief: `brief/local-entry-point-proof:docs/briefs/local-entry-point-proof.md` (v2).
Branch: `claude/local-entry-point-proof`. Ticket dt_ef34bce2cec3. HARD-tier (`scripts/**`):
needs the owner's Approve at head; the worker never approves or merges.

## Done
- `scripts/prove-entry-point-dispatch.mjs`: `assertTargetsCover` is exported (body unchanged).
  New `checkTargetsCoverage(root, cover, targets)` returns `{code, lines}`: 0 all dispatchers
  listed; 1 an unlisted dispatcher (each line names the file and says "add it to TARGETS in
  scripts/prove-entry-point-dispatch.mjs"); 2 cannot run (scripts/ missing or unreadable, a
  listed TARGET gone from disk, or the walk threw). No child processes; ~0.3 s wall incl. node start.
  New `--coverage-only` flag (and `npm run prove:entry-point:coverage`). Default run and
  `--self-test` paths unchanged; TARGETS unchanged; CI steps unchanged.
- `scripts/pre-ship.mjs`: `entryPointCoverageResult()` runs FIRST (before the CHECKS loop),
  in-process, via a dynamic import, so a load fault or throw is a FAIL row, not a crash.
  Exit 2 is a FAIL too. Dry-run lists it. Not a CHECKS entry (CHECKS prefix must equal LINKS).
- `tests/entryPointCoverage.test.ts`: fake trees (listed = green, unlisted dispatcher = red and
  named, import-only = green, missing scripts/ = 2, gone TARGET = 2, walk throw = 2) plus a
  real-tree case. The real-tree case means pre-push's unit gate (`.githooks/pre-push` step 1)
  also goes red on an unlisted dispatcher, so `ship-gate.mjs` was NOT changed (one place).

## Acceptance evidence
1. Mutation: `scripts/zz-probe.mjs` with `isEntryPoint(import.meta.url)` ->
   `npm run pre-ship` exit 1:
   ```
   FAIL prove:entry-point:coverage
        | Entry-point coverage: FAILED -- these files dispatch via isEntryPoint(import.meta.url) but are not in TARGETS:
        |   scripts/zz-probe.mjs  -- add it to TARGETS in scripts/prove-entry-point-dispatch.mjs
   [FAIL] prove:entry-point:coverage -- every isEntryPoint dispatcher under scripts/ is in the entry-point proof's TARGETS
   ```
   (that run was before the move to run-first; the row content is the same).
   Removed -> `PASS prove:entry-point:coverage` and `[PASS]` row. pre-ship overall still exits 1
   in this cloud box because of `test:unit` only -- see Not verified.
2. `npm run prove:entry-point:self-test` and `npm run prove:entry-point` exit 0.
3. New unit test on unmodified main: 9/9 failed (`assertTargetsCover is not a function`);
   after: 12/12 pass.
4. Every architecture-guard.yml step run locally: all exit 0 (table in the PR body).
   `npm run lint` exit 0. `npx tsc --noEmit -p .`: 0 errors.

## Review
`/code-review` (medium, one round = CI-guard rule). Fixed: missing-TARGET mirror, docblock
placement, run-first, dynamic import, throw -> FAIL row. Skipped on purpose: (a) refactoring
main() to reuse `checkTargetsCoverage` -- the brief requires the default run byte-identical, so
the same condition is exit 2 in the full proof and exit 1 in `--coverage-only`; (b) a
`--self-test` case for `checkTargetsCoverage` -- would change the self-test output the brief
says stays unchanged; vitest covers it.

## Not verified
- pre-ship green end-to-end: in this cloud box `test:unit` fails 15 tests in 4 files
  (`eventViewCompat.contract`, `occurrenceProgram.contract`, `publicEventPageLineup.contract`,
  `integrityCouldNotRun`). The same 15 fail on unmodified origin/main here (no live-DB env /
  sandbox), so the e2e smoke step was skipped by pre-ship.
- `.githooks/pre-push` itself was not exercised: hooks are not executable in this clone.
  ship-gate.mjs was run by hand (GREEN).
- Windows / junction behaviour of the new path not run (Linux only).

## Next steps
- Owner review + Approve at head. CI `architecture-guard.yml` remains the backstop.
