# Brief: e2e skipped-tests audit (item 2 of 4, e2e audit 2026-11-12)

Lane: careful. Class: AUDIT (read-only). One PR, docs only. Branch: claude/e2e-skipped-audit.

## Four lines
1. Who for: the owner (sole dev). A green e2e tick should not hide tests that quietly skip.
2. After: one report says, for every skipping spec under tests/e2e (incl. launch-walk, real-rpc), WHY it skips and in which CI job it does or does not run, with a verdict: fine / fix / delete.
3. How we know: a table with file:line per skip, the exact skip condition, the env var or flag that gates it, and whether CI sets it (read from .github/workflows and package.json).
4. Scope: report only. Do NOT change tests, configs, workflows or secrets; do not run suites needing real credentials.

## Build
- Start from `grep -nE "test\.skip|\.skip\(|test\.fixme|testInfo\.skip" tests/e2e -r` on current main (skips are per-test and conditional; count them, do not trust older counts: launch-walk 11, real-rpc 7 were grep counts).
- Per skip: condition (env, flag, viewport, missing fixture), which package.json script / workflow runs the spec (use scripts/check-e2e-spec-coverage.mjs MANUAL list from #1589), whether the gate is satisfied in CI.
- Group verdicts: unconditional skips (dead tests), credential-gated (expected manual), flag-gated, viewport-gated, flaky-quarantine.
- Output: `docs/audits/e2e-skipped-tests-2026-11-12.md` with a summary table at the top and a ranked "fix next" list (max 5).

## Acceptance contract
Person: owner. Journey: reads one page, knows which skips are legitimate and which hide real gaps. Data shape: ~87 specs, ~50 skip sites.
Every skip site in tests/e2e outside live/ appears once; no site missing (reviewer re-greps).

## Hand-off
PR body: Verified / Not verified (suites not run). Independent reviewer re-greps the skip sites against the table.
