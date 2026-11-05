# Brief: register the P3_RULES_DB_URL secret on PR #1389 (p3-real-rules-check)

Lane: careful (hard-tier path). Model: Opus. Branch: claude/p3-real-rules-check (PR #1389 exists at head 585d5e82; check it out from origin, do not recreate). One deliverable, ONE final push.

## Why
CI job `unit (Europe/London, full)` fails on head 585d5e82: 5 failures, all in tests/automationRegister.test.ts, error `(a) secrets.P3_RULES_DB_URL is used in db-contract-check.yml but is not in the register`. The PR's --live step uses that secret; .github/automation/secrets-register.json has no row for it. Deterministic, not a flake, not red on main. Program lead decision 2026-11-05: option 1, add the register row.

## Left
1. Add the P3_RULES_DB_URL row to .github/automation/secrets-register.json with exactly the fields the existing rows use (read 2-3 rows and the register test first; rule (f) may also need an actual_scope entry: follow what the other optional/read-only secrets do). Plain description: not created yet, optional, read-only Postgres URL for the live refusal-code check, the step skips cleanly when empty; the owner creates it later. Then run tests/automationRegister.test.ts and every other check that reads the register (grep for secrets-register in scripts/ and tests/); all green before the push. Update the PR body: the earlier note saying the register entry needs the owner is now wrong; say the row is added and the secret itself is still Not verified (not created). Keep both PR-body check scripts at exit 0.

## Limits
No other change. Do not weaken any assertion, no `--no-verify`, never merge or approve (hard-tier: the lead sends the owner Approve). Final commit subject ends with the worker-done marker from your ticket. Report head SHA and the per-job CI table (unit London must be green).
