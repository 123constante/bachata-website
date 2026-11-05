# Brief: fix the two red checks on PR #1308 (walk-p3-walklist-1)

Lane: normal (tests only). Model: Opus. Branch: claude/walk-p3-walklist-1 (PR #1308 exists; continue ON that branch, check it out from origin, do not recreate). Do NOT touch anything under docs/walk/ except to add one line to docs/walk/p3-walklist-1/HANDOVER.md saying what you changed.

## Why
Diagnosis 2026-11-05 on head 42418d0a (main is green, both reds are caused by this PR):
1. `unit (Europe/London, full)` fails: tests/walkGarbledHelper.test.ts, "walk-p3-walklist.spec.ts has no inline copy unless allowlisted": `import findGarbled from './helpers/garbled' instead of an inline regex`. tests/e2e/walk-p3-walklist.spec.ts carries its own inline mojibake regex.
2. `e2e-smoke` was CANCELLED at 30 min in step "Run E2E P3 walk specs (P3 flags on)". Main's whole E2E run is ~17.5 min, so the new spec hangs or is far too slow in CI (selector, sign-in or flag wait).

## Do (in this order, 3 deliverables)
1. In tests/e2e/walk-p3-walklist.spec.ts replace the inline regex with `import { findGarbled } from './helpers/garbled'` (read the helper and one other walk spec for the exact export and call shape; keep \u escapes, never pasted mojibake).
2. Find why the spec runs past 30 min in CI. Run it the way the workflow step does (read .github/workflows/e2e-smoke.yml; use the side laptop via `node ~/.claude/bin/laptop-walk.mjs`-style tooling if available to you, else reason from the spec and the step). If the spec needs a real organiser sign-in or live data that CI does not have, it is a local-walk-only artifact: remove it from the CI e2e list (package.json test:e2e and any workflow list) WITHOUT deleting the file, add a clear header comment saying it is local-walk-only, and make sure tests/walkGarbledHelper.test.ts still passes. If it can run in CI, give every wait an explicit short timeout so a miss fails fast (under 60 s per step) rather than hanging.
3. Run `npm run test:unit` (at least tests/walkGarbledHelper.test.ts and any test that lists e2e specs), `npm run check:mojibake`, and lint chain pieces that apply. Push once (subject without [skip preview] only if it is the final push; otherwise [skip preview]); end the last commit subject with the worker-done marker from your ticket.

Limits: no changes to src/**, no prod writes, never merge or approve. PR body already exists: only edit it if its claims are now wrong (run both check-pr scripts, exit 0). Report head SHA and per-job CI table.
