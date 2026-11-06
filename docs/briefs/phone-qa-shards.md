# Brief: Split the phone-qa job into 3 parallel shards and auto-rerun a timed-out shard once
Brief-version: 2
Branch: claude/phone-qa-shards
Lane: careful, Opus. Repo 123constante/bachata-website. One PR.

## Goal
phone-qa runs the whole phone suite in one hosted job (ubuntu-latest, timeout-minutes: 25) and is cancelled at the 25-minute limit on busy runs (#1459 run 42308541568: 25m16s, step "Run the phone suite" cancelled; #1445 the same; normal runs 14-21 min). Owner clicks 2026-11-06: split it into parallel shards, and re-run only a timed-out shard once, automatically. Real test failures must still stop the PR.

## What main lacks
- phone-qa shards via --shard flag -- grep: --shard=
- phone-qa rerun workflow -- grep: phone-qa-rerun

## Files
- .github/workflows/phone-qa.yml
- .github/workflows/phone-qa-rerun.yml (new)

## What to build
Narrow workflow exception for THIS branch only (owner click 2026-11-06, E3); nothing else in .github/ may change.
1. In phone-qa.yml, job `phone-qa`: add `strategy: { fail-fast: false, matrix: { shard: [1, 2, 3] } }`; run step becomes `npx playwright test --config playwright.phone.config.ts --shard=${{ matrix.shard }}/3`; `timeout-minutes: 15`. Keep runs-on ubuntu-latest, triggers, paths, concurrency, permissions, and every other step unchanged. No artifact upload step.
2. New phone-qa-rerun.yml: `on: workflow_run: workflows: ["Phone QA"], types: [completed]`; permissions `actions: write`, `contents: read` only. Job runs only when `github.event.workflow_run.conclusion == 'cancelled'` AND `github.event.workflow_run.run_attempt == 1` AND the run's head sha equals the PR's current head (a push cancels the older run through `concurrency: cancel-in-progress`; those must NOT be re-run). One step: `gh run rerun ${{ github.event.workflow_run.id }} --failed` with `GH_TOKEN: ${{ github.token }}`. Pin actions the way sibling workflows do. Keep the file's comment header explaining why.
3. Before pushing, read `scripts/check-workflow-artifact-policy.mjs`, `scripts/check-pr-phone-qa.mjs`, `.github/workflows/phone-qa-section.yml`, and `scripts/prove-entry-point-dispatch.mjs`; fix only what the rename to matrix jobs `phone-qa (1)`, `phone-qa (2)`, `phone-qa (3)` strictly breaks, and list each such file in the PR body (any file outside Files needs a line saying why; stop and say PARTIAL if more than two).
4. Prove the split loses no test: run `npx playwright test --config playwright.phone.config.ts --list` once and with `--shard=1/3`, `2/3`, `3/3`; the three shard totals must equal the full list. Put the four numbers in the PR body. Also run `actionlint` or the repo's workflow lint if present.
5. Real proof comes from the PR's own run (it touches the workflow, so it triggers): all three shards green, each under 15 minutes. Report the three durations.

## Do NOT touch
EventCalendar.tsx, calendar/CalendarGrid.tsx, calendar/CalendarListView.tsx, calendar/DayDetailModal.tsx, calendar/calendarUtils.ts, useCalendarEvents.tsx (density-exempt calendar files), src/components/ui/dialog.tsx, supabase/**, migrations, scripts/** (except as step 3 allows), .env*, runs-on, secrets, any trigger other than the new file's, any `permissions` widening, any other workflow, any file not listed under Files.

## Done when
One push; PR body has "## Verified on real data" (- Shapes surveyed: / - Checks run: / - NOT verified:) and the per-job table; NOT verified must say the timeout-rerun path was not exercised (needs a real cancellation). No "## Phone QA" section needed (workflow-only PR; the workflow changes itself runs the suite). Last commit subject ends with the [worker-done ...] marker. The PR is hard tier: independent review + owner Approve at head.
