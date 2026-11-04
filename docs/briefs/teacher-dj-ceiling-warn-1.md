# Teacher/DJ unassigned ceiling: roster growth warns, only lost assignments fail

Brief-version: 2

## What main lacks
- extends: scripts/check-teacher-dj-assignment-integrity.mjs gates on a hand-kept ceiling (BASELINE_TEACHERS_UNASSIGNED / BASELINE_DJS_UNASSIGNED, 34/10). Every time a new teacher or DJ joins without a lineup the check goes red on main and every open PR, and someone has to hand-edit the numbers (PR #1337 on 2026-11-04, #339 before it) -- scripts/check-teacher-dj-assignment-integrity.mjs
- extends: the script header says the real fix is "nobody lost an assignment", not a ceiling. Its history already splits the count into people created on or before the last re-baseline date and people created after -- scripts/check-teacher-dj-assignment-integrity.mjs

## Goal
Make growth from NEW people warn (exit 0, print the payload and a WARN line) and keep failing (exit 1) only when the count of people created on or before the baseline date, who hold no assignment, goes UP. Keep the existing dated-note convention: update the header note with today's date and why.

## Constraints
- Careful lane: read-only against the DB, no migration, no write to prod.
- Keep the exit-code contract and docs/ci-guard-notes.md #17 text in step with the new behaviour.
- Keep or add a self-test with a mutant: raising the pre-baseline unassigned count must go red; adding a new person after the baseline date must stay green.
- The pre-baseline cutoff date is a constant in the file; reuse the existing one from the 2026-07-24 re-baseline notes, do not invent a new one.
- Hard-tier path (scripts/): the PR waits for the owner's Approve at the head.

## Files
- scripts/check-teacher-dj-assignment-integrity.mjs
- scripts/__tests__/check-teacher-dj-assignment-integrity.test.mjs
- docs/ci-guard-notes.md

## Done when
- Self-test and unit test green, including the mutant.
- PR body has the Verified on real data block: the live teacher/DJ counts split pre/post baseline, read-only.
- Handover docs/handover/teacher-dj-ceiling-warn-1.md names what is verified and what is not.
