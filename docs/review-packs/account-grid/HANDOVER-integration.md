# Handover: grid gate INTEGRATION (slice group PR-1 finish), branch `claude/account-grid`

Brief: `briefs/account-grid-integration.md` (branch `arc/briefs-dancer-rebuild`). This branch is the ONE Website PR
for the whole account system (owner decision 2026-10-15). It must NOT be merged yet: later slice groups land on it.

## What changed (files)
- Merged `origin/claude/account-grid-1a` (97ff59e) then `origin/claude/account-grid-1b` (7e722c2) onto `origin/main`
  (070c320). No conflict (no shared files).
- `scripts/check-journey-grid.mjs`: HARD link. The `--skip-if-absent` path and `JOURNEY_GRID_REQUIRED` are removed; a
  missing grid always exits 1 (passing the retired flag changes nothing). Baseline entries are now `{ id, reason }`;
  a bare id or an empty reason fails. `--write-baseline` writes only NON-exempt gaps (rows whose `built` is BUILT),
  keeps an existing reason per id, and gives a new id a placeholder reason naming the gap.
- `package.json`: `check:journey-grid` is `node scripts/check-journey-grid.mjs` (flag dropped).
- `scripts/__tests__/check-journey-grid.test.mjs`: skip test replaced by "retired flag no longer skips" and
  "package.json runs the check with no skip flag".
- `scripts/journey-grid-baseline.json`: 20 entries, each with a reason naming the PR that covers it.
- `docs/account-system/journey-grid.json` (+ regenerated `JOURNEY-GRID.md`): row `di.other-email` state
  "signed in as a different e-mail" -> "any signed in, as a different e-mail" (rule 1 failed on it; the meaning is unchanged).
- `scripts/prove-entry-point-dispatch.mjs`: `scripts/check-journey-grid.mjs` added to TARGETS (architecture-guard
  `prove:entry-point` exited 2 without it; 1a's miss).
- `scripts/pre-ship.mjs`: the two new lint-chain links added to CHECKS in chain order, band comment SIXTEEN -> EIGHTEEN
  (`tests/reviewScope.test.ts` failed 2 tests without it; 1a's miss).

## Baseline vs BASELINE-PROPOSAL.md
Exactly the 20 ids of the proposal's "BUILT but short of the rule" section (11 walk-missing + 9 nothing-at-all).
The proposal's "Exempt" rows (5 `ac.delete.*`, `dl.new.real-otp`, 4 `di.*`, `dp.erase-cancel-link`) are NOT in the
baseline: they are exempt by rule 3 (built != BUILT), so the writer leaves them out. 1a's original writer put all 31
uncovered ids in (exempt included); changed so that a row that becomes BUILT without coverage fails as NEW instead of
hiding in the baseline. No other difference. `check:journey-grid`: "OK: 85 rows, 31 known gap(s), baseline 20."

## Decisions and INTERFACE deviations
- Baseline schema changed from `["id", ...]` to `[{ "id", "reason" }]` because the brief requires a reason per entry.
  The grid schema (`version: 1`) is untouched.
- Fixed one grid row's `state` text (data, not a new row) so rule 1 passes.
- Fixed two 1a integration misses outside 1a's file list (TARGETS, pre-ship CHECKS): both are CI red otherwise.
- PR title/body: `bot-pr.yml` takes the title from the pushed head commit subject, so the title carries the done
  marker until edited. The intended body is `PR-BODY.md` in this folder.

## Shapes surveyed (prod, read-only, counts)
`auth.users`: 21 logins, 6 unconfirmed (= grid `S-UNCONF` 6, row `si.unconfirmed-later`), 0 deleted (= `S-ERASED` 0).
Every other row's `people` column is the plan branch's survey (no row in this part needed a new count).

## Red-first proof
- Mutant: restore the SKIP in `main()` (`--skip-if-absent` + no grid -> exit 0 "SKIP") and the flag in package.json.
  Self-test exit 1: `FAIL missing grid fails even with the retired --skip-if-absent flag (exit 0, want 1)`;
  node:test: `not ok 3 - the retired --skip-if-absent flag no longer skips`, `not ok 4 - package.json runs the check
  with no skip flag`, `not ok 5 - the built-in self-test ... is green`. Restored: self-test exit 0.
- New reason rule: self-test cases "baseline entry as a bare id (no reason) fails" and "... empty reason fails" (ok).
- `prove:entry-point` exit 2 and `reviewScope` 2 failures reproduced on this branch before the fix, green after.

## CI per-job (sandbox)
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

e2e, phone and build-spec runs were taken before the TARGETS / pre-ship fixes (those two files touch neither).

## 390x844 walk
No UI change in this part. The build-spec suite (production build, 390x844, axe) passed 52/52.

## Verified / Not verified
Verified: grid gate hard (red-first), baseline = proposal's 20 gaps with reasons, lint chain 18/18, tsc, build,
build specs, phone suite, e2e smoke, offline unit tests (bar 5 environmental, red on main too).
Not verified: live DB contract checks, live unit contract pass, types-drift, lighthouse (secrets / preview URL);
real-data-verified and phone-qa-section run only on the PR event; GitHub Actions results (may hit the billing block).

## Left / next
- Later slice groups (sign-in/sign-out/settings, delete/restore, dancer invite, e-mail code journeys, hardening) merge
  into this branch; each shrinks the baseline as it covers rows (the check fails if a covered id stays listed).
- Set the PR title to `feat(account): account system (Website)` and the body from `PR-BODY.md` if not already done.
- Optional (from 1b): build walks for claim card, invite dead token, dancer-link signed-in.
