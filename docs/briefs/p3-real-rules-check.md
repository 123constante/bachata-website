# Brief: P3 real-rules refusal check (docs-first, then one guard + one matrix test)

HELD: do not dispatch until claude/p3-status-real-reasons (ticket dt_db6910c85d9b) has merged; one worker at a time.

Lane: careful (reads the DB contract). Model: Opus. Goal (owner definition of done): a check against the LIVE server rules fails if any P3 screen shows a wrong or missing refusal reason; the 390x844 walk of every journey stays in WALKLIST and is not part of this brief.

## Aim (FIXLIST items still OPEN, quote ids)
F-10 (A-gate-3, fixed line, no way to act), F-11 (A-gate-4/11, ticket refusal says "That did not work"), F-15 (A-gate-10, discard-draft wrong generic error), F-08 remainder (A-gate-2, failed-read message), F-20 (A-gate-J8, manager/contributor lock without reason), F-46 (A-team-3, refused join request silent), F-40 (G-36, banned account no refusal copy), F-52, F-56 (A-team-10: contract says 42501, live is permission_denied P0001, no test), F-57. Do NOT fix the screens here; the check must make each of these fail red first, and the fixes follow in their own slices.

## What main lacks
- A script/test that reads refusal codes from the live RPC bodies and asserts mapped copy -- grep: `RAISE EXCEPTION` in scripts/check-*.mjs on origin/main returns nothing relevant (only 42501 classifiers in check-going-rpcs.mjs etc.)
- A table of screen x refusal reason that fails on a missing or wrong reason -- grep: `refusal` under src/modules/organiser/p3/**/__tests__ finds no screen x refusal matrix (only tests/e2e-phone/organiser-refusal-copy.phone.spec.ts, not in test:e2e gate)
- Coverage of codes outside onboarding_incomplete -- scripts/check-onboarding-write-doors.mjs (refusal-unmapped checks ONLY the /^onboarding_incomplete/ row, ERRORS_FILE line 51)
- Coverage of the catch-all: `/^permission_denied/` generic row (selfServeErrors.ts ~line 274) hides any unmapped code -- grep: `^permission_denied/, message: 'You cannot make that change` in src/modules/organiser/shared/selfServeErrors.ts
- A contract test for 42501 vs P0001 (F-56) -- grep: `isolation` in admin tests for apply_aggregate_write_p5 cross-page refusal (admin PR #1165 proves body only)

## What already exists (do not rebuild)
selfServeErrors.ts: selfServeErrorCopy / KNOWN_SELF_SERVE_CODES (COPY), COMMAND_COPY, commandErrorMessage, teamErrorMessage / TEAM_COPY, programmeErrorCopy. Unit tests: shared/__tests__/selfServeErrors.onboarding.test.ts, selfServeErrors.waveB0.test.ts, selfServe.test.ts (hand-written cases, not derived from the server). check-onboarding-write-doors.mjs runs in architecture-guard.yml (lines 91-92) and db-contract-check.yml (--live, ~1269-1270).

## Live-rules read
1. From admin repo origin/main supabase/migrations/*.sql (read-only, `git -C C:/dev/bachata-admin-11april show origin/main:...`): list every `RAISE EXCEPTION '<code>...'` / `USING ERRCODE` reachable from the P3 command doors: apply_aggregate_write_p5, _cmd_* (occurrence, series, tickets, repeat, status/lifecycle), _require_onboarding_complete_v1, _assert_can_edit_series_p5, remove_organiser_member_v1, redeem_organiser_invite_v1, claim_my_organisers_v1, _account_link_refusal_v1, programme/set_program commands. Take the LATEST definition of each function (later migration wins).
2. Prod read-only counts only (Supabase MCP stsdtacfauprzrdebmzg): `select proname from pg_proc` + `pg_get_functiondef` matched for the same RAISE strings, to confirm the snapshot equals live (count of codes in snapshot vs live; report any diff). No personal data, no writes.
3. Output a committed JSON snapshot `scripts/p3-refusal-codes.json` (code, door, errcode/SQLSTATE, source migration) -- drift between snapshot and live is the guard's red.

## Files
- NEW scripts/check-p3-refusal-reasons.mjs (+ --self-test canary, exit 0/1/2) and scripts/p3-refusal-codes.json
- NEW src/modules/organiser/p3/__tests__/refusal.screenMatrix.test.tsx (table: screen x refusal code -> rendered text)
- NEW src/modules/organiser/shared/__tests__/refusalCodes.live.test.ts (reads the JSON; for each code asserts commandErrorMessage / teamErrorMessage / programmeErrorCopy / selfServeErrorCopy returns non-empty copy that is NOT the generic fallback row, NOT "That did not work", and carries a next step)
- package.json scripts check:p3-refusal-reasons(:self-test); .github/workflows/db-contract-check.yml step (`- name: Run ...` style, live read) and architecture-guard.yml static step
- docs/ci-guard-notes.md entry; scripts/check-script-conventions.mjs baseline via `--write` after the change
- OFF LIMITS until the status fix merged (and edit only by additive allow-list entry after): src/modules/organiser/p3/data/eventPage.ts, p3/screens/StatusSheet.tsx, the commandErrorMessage mapping, eventPage.matrix tests. If a code fails only because of those, list it in a KNOWN_GAPS ratchet (shrink-only) instead of editing.

## How it fails
- Guard: red if a code in the live-derived snapshot has no specific row (falls to generic `permission_denied` or `ERROR_FALLBACK`), if snapshot differs from live (new/removed code), or if a ratchet entry no longer lacks copy (stale).
- Vitest: table screen x refusal; every P3 screen that sends a command (Details, Prices, DateSheet, StatusSheet, RepeatSheet, tickets TypeSheet, NewFlow/CreateFlow, Organisers/Team, onboarding, join) is rendered with each applicable refusal; fails on empty, generic or wrong-reason text, on text pointing at a control not on screen, and on a refusal with no actionable next step. Red first on F-10, F-11, F-15, F-46, F-40 (record the red run in the PR).
- Fix the F-56 contract line (P0001 permission_denied, not 42501) in CONTRACT.md.

## Conventions (read first)
docs/ci-guard-notes.md "Writing a new guard -- the six rules check-script-conventions.mjs enforces" (line ~333) and docs/testing-doctrine.md (canary/self-test rules, exit-code convention: 0 clean, 1 violation, 2 could not run; the lint chain runs every link). Website owns no migrations: do not add SQL. Source files over 2 KB via scripts/safe-edit.py / safe-write.py. HTML entities, no raw Unicode punctuation.

## Done
Shapes surveyed (counts), guard + vitest red-first then green, every CI job step run, per-job table in PR body, Verified / Not verified block (the 390x844 walk is Not verified here; WALKLIST owns it).
