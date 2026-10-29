# Brief: bot PRs must not go red just because the body is still the stub (GUARD-CI, hard tier)

Owner 2026-10-29, after fast-lane PR #1148 went red on `real-data-verified`: "Why did you allow it to become red? We need a long-term solution." Choice made: pre-fill the template.

## Problem (facts)
- `.github/workflows/bot-pr.yml` (line ~52) opens every claude/** PR with the body "Opened by the bot ... The session fills in this description." That stub has no `## Verified on real data` section, so `real-data-verified` goes RED on the first CI run for any PR touching src/, app/ or api/. It turns green only after the body is edited (the workflow re-runs on edit).
- Parser: `scripts/check-pr-real-data-verified.mjs` (pure `parse(body)`, tests in `tests/realDataVerified.test.ts`). It already treats template phrases and placeholder words as unfilled.

## Build
1. `bot-pr.yml` opens the PR with a body that already contains the `## Verified on real data` section with the three labelled lines (Shapes surveyed / Checks run / NOT verified), each set to the marker `TO FILL`, plus the existing "Opened by the bot" lines. Keep the body passed via file, never interpolated into a shell command.
2. The checker distinguishes "marker present" (`TO FILL` on any of the three lines) from "violates the format". Marker present = report NEUTRAL (pending description): exit code 3 (new, documented in the header), workflow turns it into a notice and a non-failing result ("waiting for the description to be filled in"). Genuine format violations stay exit 1 / red.
3. A forgotten body must NEVER reach merge: the neutral state must not satisfy any merge path. Find every place that treats `real-data-verified` success/skipped as green (`bot-automerge.yml`, `~/.claude`-side pr-status is out of scope, branch-ruleset/required-check settings if any, `scripts/` audit guards) and make a body that still contains `TO FILL` block merge there. List the places you checked.
4. Tests (table-driven, red first): marker on one/two/three lines, marker mixed with real text, marker in a fenced code block, filled body, stub body from the OLD bot text (must stay red/violation), PR touching only docs (skipped as today). Add a mutation: remove the marker check and a test must fail. The pre-existing `--self-test` and CI guard conventions (`scripts/check-script-conventions.mjs`) must stay green.

## Rules
Hard-tier paths (workflow + scripts): the owner must APPROVE at PR head, then merge. One independent review (different model). Run every CI job step for this PR in your sandbox and put the per-job table in the PR body. Do not touch `.github/workflows/` files other than `bot-pr.yml` and, only if step 3 proves it necessary, `real-data-verified.yml` / `bot-automerge.yml`; say why in the PR body.

## Output
PR with the Verified-on-real-data block filled in (shapes = the 5 body shapes above on the live repo's last 20 bot PRs, read-only), handover `docs/handover/pr-stub-body-no-red.md`, last commit subject ending `[worker-done <ticket>]`.
