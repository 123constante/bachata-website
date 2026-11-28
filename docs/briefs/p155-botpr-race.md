# Brief: P155 bot-pr: 422 PR already exists is a race, not a failure
Brief-version: 2
Branch: claude/p155-botpr-race
Lane: careful, Sonnet. Repo 123constante/bachata-website. One PR.
Size: 1 files, ~8 lines

## Goal
When a worker opens its own PR between bot-pr-adopt's check and the bot's POST, GitHub answers HTTP 422 "A pull request already exists for ...". The open-pr job then goes red, and merge-preflight (b) BLOCKs a clean PR (seen on admin#2598, job 140805938427). That 422 is a race, not a failure: handle it.

## What main lacks
- bot-pr.yml treats 422 'already exists' as a race and re-runs bot-pr-adopt into adopt-race.out -- grep: adopt-race.out

## Files
- .github/workflows/bot-pr.yml

## What to build
1. In `.github/workflows/bot-pr.yml`, open-pr step, add one `elif` branch after the existing `422 ... No commits between` branch and before the `else` error branch:
   `elif [ "$code" = "422" ] && grep -q "A pull request already exists" resp.json; then`
   - echo one line: a PR for $BRANCH was opened meanwhile (race); re-checking it.
   - re-run the decision once: `ADOPT_OUT=adopt-race.out node scripts/lib/bot-pr-adopt.mjs` (it skips a bot-authored PR and replaces an owner-authored one; a failed replace still exits 1 and the job stays red, which is right).
   - if `adopt-race.out` says `open` (list has not caught up), print `::warning::` that GitHub reports a PR but the list does not show it yet, the next push re-checks; exit 0. Write it so `set -euo pipefail` cannot trip on the test (use `if ...; then ...; fi`, not `[ ] && ...`).
2. Keep every other line unchanged. No new secret, no new permission, no new sparse-checkout path (bot-pr-adopt.mjs is already checked out).
3. Run the repo tests that read this workflow (`grep -rl bot-pr.yml tests scripts`) and the workflow lint/guard scripts the CI runs on workflow edits; list them in the PR body.

## Do NOT touch
EventCalendar.tsx, calendar/CalendarGrid.tsx, calendar/CalendarListView.tsx, calendar/DayDetailModal.tsx, calendar/calendarUtils.ts, useCalendarEvents.tsx (density-exempt calendar files), src/components/ui/dialog.tsx, supabase/**, migrations, any workflow other than .github/workflows/bot-pr.yml, scripts/** (incl. scripts/lib/bot-pr-adopt.mjs), .env*, any file not listed under Files.

## Done when
One push; PR body has "## Verified on real data" (- Shapes surveyed: / - Checks run: / - NOT verified:) and "## Phone QA" (- Sizes checked: / - Walked: / - Not verified:); tests green; every CI job step that applies has been run and the per-job table is in the PR body; last commit subject ends with the [worker-done ...] marker. Docs-only or tests-only PR: delete the Phone QA section.
