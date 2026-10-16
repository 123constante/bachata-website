# feat(account): account system (Website)
**DO NOT MERGE: one PR in progress.** Later slice groups land on this branch before it is ready.

## Summary
The whole Website side of the account system ships as this ONE PR (owner decision 2026-10-15).

### Done: grid gate
- `docs/account-system/journey-grid.json` (85 rows) is on the branch with real `covered_by` refs; deletion rows renamed
  to hide + 30-day restore (`ac.delete.*`, PLANNED); axe on every J row END in the build specs.
- `scripts/check-journey-grid.mjs` (rules 1-5) runs in the lint chain and pre-ship. The link is HARD: no grid file = exit 1.
- Ratchet baseline `scripts/journey-grid-baseline.json`: 20 known gaps, each `{ id, reason }` naming the PR that covers it.
  A new uncovered row fails; a baseline id that is now covered fails.

### Still to come
sign-in, sign-out, settings, delete/restore, dancer invite, e-mail code journeys, hardening.

## Scope
Tests, docs and CI scripts only. No change under `src/`. No migration. No production behaviour change.

## Supabase Source of Truth
N/A: no schema or RPC change. One read-only count query on prod (below).

## Privacy Gates (Hard Requirement)
N/A: no public read path changed; no phone/whatsapp field touched.

## Visibility & Access
N/A: no route or access change.

## UX & System Consistency
N/A: no UI change in this part.

## Validation Evidence
Red-first: restoring the old SKIP (mutant) turns the self-test red ("missing grid fails even with the retired
--skip-if-absent flag (exit 0, want 1)") and 3 node:test cases red; restored, all green.
Details: `docs/review-packs/account-grid/HANDOVER-integration.md`.

## QA Examples (Must Fail / Must Pass)
### Must fail examples
- Grid file absent (with or without `--skip-if-absent`); a baseline entry with no reason; a dangling ref; an uncovered BUILT row not in the baseline.
### Must pass examples
- The repo as pushed: "OK: 85 rows, 31 known gap(s), baseline 20."

## Reviewer Sign-off
- [ ] Explicit reviewer approval recorded: "No public phone/whatsapp exposure." (no such path touched)

## CI per job (sandbox run; billing rule applies to GitHub runs)
| Job (workflow/job) | Command | Exit | Result |
|---|---|---|---|
| architecture-guard/integrity | `bin/check-integrity.sh` (after `chmod +x bin/*.sh`, as CI does) | 0 | PASS |
| architecture-guard/integrity | `check:legacy-tables`, `check:legacy-program-rpcs`, `lint:architecture` | 0 | PASS |
| architecture-guard/integrity | `AUDIT_STRICT=1 npm run check:images` | 0 | PASS |
| architecture-guard/integrity | image-widths, plan-hygiene, workflow-artifact-policy, mojibake (self-tests + guards) | 0 | PASS |
| architecture-guard/integrity | `prove:entry-point:self-test`, `prove:entry-point` | 0 | PASS: 44 entry points (was exit 2 before `check-journey-grid.mjs` joined TARGETS; fixed here) |
| db-contract-check | `ci-live-db-gate` (+self-test), `check-migration-stamps`, `check-script-conventions` (+self-test), guest-list self-test | 0 | PASS |
| db-contract-check | `precheck-supabase-secrets` + live `check-*.mjs` | 2 | NOT RUN: no Supabase secrets in the sandbox |
| e2e-smoke | `npm run test:e2e` (`CI=true`) | 0 | PASS: 147 passed, 1 flaky (auth-magic-link-returnto:88, passed on retry), 1 skipped |
| perf-budget/bundle | 3 canaries, `npm run build`, `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` | 0 | PASS |
| perf-budget/lighthouse | `check:lighthouse`, `check:doc-weight` | 1 | NOT RUN: needs a Vercel preview URL |
| phone-qa/phone | `npx playwright test --config playwright.phone.config.ts` | 0 | PASS: 188 passed, 74 skipped |
| phone-qa/build | `npm run build` (fake Supabase), `npx playwright test --config playwright.build.config.ts` | 0 | PASS: 52 passed (incl. axe on every J row END) |
| typecheck | `check:rpc-typing`, `check:wallclock-brand`; `npx tsc --noEmit -p .` | 0 | PASS |
| types-drift | `gen:types` + diff | - | NOT RUN: needs `SUPABASE_ACCESS_TOKEN` |
| unit-tests (London) | `npm run test:unit:offline` | 1 | 8284 passed, 5 failed: all in `tests/integrityCouldNotRun.test.ts`, which fails identically on `origin/main` in this sandbox (typescript resolvable from the temp dir; environmental). `tests/reviewScope.test.ts` was red (2) before pre-ship CHECKS got the two new links; fixed here, 137/137 |
| unit-tests (London) | `npm run test:unit:timing` | 0 | PASS: 65 |
| unit-tests (New_York, Sydney) | tz vitest list | 0 | PASS: 213 each |
| unit-tests (live) | `npm run test:unit` | - | NOT RUN: needs Supabase secrets |
| unit-tests/dancer-area-isolation | self-test + check | 0 | PASS |
| workflow-lint | BOM loop, masking, notification (self-test + guard) | 0 | PASS |
| real-data-verified, phone-qa-section | `check-pr-*.mjs` | 2 | NOT RUN: need `PR_BODY` from the PR event (phone-qa self-test PASS) |
| (lint chain) | `npm run lint` | 0 | PASS: 18/18 links incl. `check:journey-grid:self-test` and `check:journey-grid`; trailing eslint informational, red as on main |
| (new check) | `npm run check:journey-grid`; `node --test scripts/__tests__/check-journey-grid.test.mjs` | 0 | PASS: "OK: 85 rows, 31 known gap(s), baseline 20."; node:test 7/7 |

## DECISIONS
- Baseline entries became `{ id, reason }` (brief: every entry carries a reason); grid schema unchanged.
- `--write-baseline` leaves exempt (not BUILT) rows out, so the baseline holds exactly BASELINE-PROPOSAL.md's 20 gaps.
- Grid row `di.other-email` state reworded to start with `any` so rule 1 passes (meaning unchanged).
- Added `check-journey-grid.mjs` to prove-entry-point TARGETS and the two links to pre-ship CHECKS (CI red otherwise).

## Verified on real data
- Shapes surveyed: read-only counts. prod `auth.users` 21 logins, 6 unconfirmed (grid `S-UNCONF` 6, row `si.unconfirmed-later`), 0 deleted (`S-ERASED` 0); other rows' `people` counts come from the plan's survey.
- Checks run: every PR job step runnable in the sandbox (table above); build specs at 390x844 on a production build with axe, 52/52; phone suite 188 passed.
- NOT verified: live DB contract checks, live unit contract pass, types-drift and lighthouse (need secrets or a preview URL); GitHub Actions results themselves; a real phone.

## Phone QA
- Sizes checked: 390x844 (build specs and phone suite, unchanged UI); no UI change in this part.
- Walked: no UI change in this part; the existing phone suite (playwright.phone.config.ts) and build specs ran green.
- Not verified: a real phone (no UI change to check).
