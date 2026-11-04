Brief-version: 2

# autopilot-loop-r5: Website copy of the admin autopilot loop (ships OFF)

Lane: careful (workflow + scripts/ are hard-tier; the owner Approves at the PR head). Model: opus. One push, one PR.
Owner 2026-11-04: full automation is the top priority. Admin r3/r4/r4b/r4c are merged on 123constante/bachata-admin main;
the merge lane there is OFF (AUTOPILOT_MERGE_MODE unset). This slice ports the loop to THIS repo, OFF by default.

## What main lacks
- No hourly loop that adds run-ci, posts one owner ping per head and keeps PRs fresh in the Website repo -- grep: autopilot in .github/workflows (none on main)
- No Website copy of the merge-lane verdict (laneClass/mergeVerdict with the r4b/r4c refusals for agent-instruction paths) -- grep: autopilot-merge in scripts (none on main)
- No Website pack-comment helper that posts or edits ONE comment per head -- grep: autopilot-pack in scripts (none on main)
- extends: pr-status "red also on main" comparison exists only in ~/.claude tooling, not as a Website CI-side fact -- PR 1326 (automerge)

## Files
.github/workflows/autopilot.yml
scripts/autopilot-step.mjs
scripts/lib/autopilot.mjs
scripts/lib/autopilot-merge.mjs
scripts/lib/autopilot-pack.mjs
tests/autopilot.test.ts
tests/autopilotMerge.test.ts
tests/autopilotMutants.test.ts
tests/autopilotWorkflow.test.ts
docs/handover/autopilot-loop-r5.md

## Source to port (read first, do not edit admin)
Admin repo 123constante/bachata-admin, main. Fetch with plain git in a scratch clone (no gh api):
`.github/workflows/autopilot.yml`, `scripts/autopilot-step.mjs`, `scripts/lib/autopilot.mjs`, `scripts/lib/autopilot-merge.mjs`,
`scripts/lib/autopilot-pack.mjs`, `tests/autopilot*.test.ts` (incl. `autopilotTable.ts`, R4/R4B/R4C tables, mutants), and
`docs/handover/autopilot-loop-r3.md`, `-r4.md`, `-r4b.md`, `-r4c.md`, `docs/review/1217-r1.md`, `docs/review/1219*`.

## Requirements
1. Port with the Website's names: REPOS defaults to 123constante/bachata-website; Website hard-tier list = `.github/**`, `scripts/**`,
   `supabase/**`, `vercel.json`, `package.json` lockfiles, anything under `src/**` with a screen (tsx/css) is NOT mergeable by the lane
   (it needs a walk) -- the lane may only ever consider docs-only and tests-only PRs.
2. Same refusals as r4b + r4c, copied with their tables and mutants: agent-instruction paths at any depth (CLAUDE/AGENTS/GEMINI/SKILL
   names with suffix, `.claude/`, `.gemini/`, `.CursorRules`), labels case-insensitive, placeholder Verified unfilled, tests class by content.
3. Ships OFF: no variable, secret or label is written. The merge lane stays off unless AUTOPILOT_MERGE_MODE is set by the owner; the
   workflow default is dry-run. Cron hourly, plus workflow_dispatch. CI cap 25 per 24 h, bot-only run-ci counting (r3).
4. Vercel-safe: the loop must never add run-ci to a PR whose changed files are all under docs/ or are [skip preview]; honour
   `vercel.json` git.deploymentEnabled. It makes no deployment itself.
5. "Red also on main" comparison: if cheap, one function in `scripts/lib/autopilot.mjs` that compares each failing check name on the PR
   head with the latest main run of the same workflow; the pack comment prints `red also on main: yes/no`. Skip it (say so in the handover) if it exceeds about 60 lines.
6. Tests: table-driven, red first, the r4b/r4c mutants ported and all caught; `node scripts/check-workflow-artifact-policy.mjs`-style
   Website guards must pass (read `docs/ci-guard-notes.md` for the script conventions the new scripts need, incl. check-script-conventions).
7. Read-only dry run of the real `run()` against the live Website repo (GET-only fetch shim, as in admin r3) with a table in the handover.
8. Do NOT touch `perf-budgets.json`, `vite.config.ts` or any src/ file. Bundle budget is unaffected.

## Done when
Handover `docs/handover/autopilot-loop-r5.md` with Done / Verified / Not verified / Next; PR body per the prompt skeleton (docs/script
PR: delete the Phone QA section). Independent review follows (website-18); the owner Approves at the head; the owner sets the variable later.
