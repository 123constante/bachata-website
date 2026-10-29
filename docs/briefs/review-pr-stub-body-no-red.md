# Brief: independent review of Website PR #1149 (bot PR body pre-fill + PENDING exit 3) -- CI guard, hard tier

You did NOT build this. Review PR #1149 on `claude/pr-stub-body-no-red` (repo 123constante/bachata-website). Read the builder handover `docs/handover/pr-stub-body-no-red.md` and the original brief `docs/briefs/pr-stub-body-no-red.md` (branch brief/pr-stub-body-no-red) first. Write findings only; change NO product code.

## Review for
1. Can a body still containing `TO FILL` EVER reach merge? Check every merge path: `bot-automerge.yml`, required checks, `scripts/` audit guards, `real-data-verified.yml` conclusion when exit 3 (neutral must not count as success anywhere that gates).
2. Checker `scripts/check-pr-real-data-verified.mjs`: marker on 1/2/3 lines, mixed with real text, inside fenced code, inline backticks, old stub body (must stay violation exit 1), docs-only skip. Any spelling that turns a forgotten marker into a pass (case, spacing, unicode)?
3. `bot-pr.yml`: body passed via file, no shell interpolation of untrusted text; PR title/branch injection safe.
4. Tests in `tests/realDataVerified.test.ts`: table-driven, red first, mutation (remove marker check -> a test fails). `check-script-conventions.mjs` still green.
5. Workflow edits limited to what the brief allows; reasons stated in PR body.

## Output
Docs-only file `docs/reviews/pr-stub-body-no-red-r1.md` on branch `claude/review-pr-stub-body-no-red`: verdict PASS / PASS with should-fix / FIX FIRST, numbered findings (BLOCK / SHOULD-FIX / NIT) with file:line and a concrete failing scenario per BLOCK, a Not verified section. Push once, subject ending `[worker-done <ticket>]`.
