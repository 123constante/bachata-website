# Brief: Raise the phone-qa shard timeout from 15 to 20 minutes (review of #1461)
Brief-version: 2
Branch: claude/phone-qa-shards
Lane: careful, Sonnet. Repo 123constante/bachata-website. Continuation on open PR #1461; no new PR.

## Goal
Independent review of #1461: shard 3 ran 14m00s, shard 1 9m17s, shard 2 7m43s. Playwright shards split by file, not by duration, so a busy runner would hit the 15-minute cap, and the one auto-rerun has the same cap. Raise the shard job cap to 20 minutes.

## What main lacks
- extends: phone-qa shards via --shard flag -- #1461
- extends: phone-qa rerun workflow -- #1461

## Files
- .github/workflows/phone-qa.yml
- .github/workflows/phone-qa-rerun.yml (new)
- tests/automationFoundations.test.ts

## What to build
Narrow workflow exception for THIS branch only (owner click 2026-11-06, E3): workflow edits allowed only in .github/workflows/phone-qa.yml and phone-qa-rerun.yml on this branch; nothing else in .github/ may change.
1. In phone-qa.yml, the shard job `phone-qa`: `timeout-minutes: 15` -> `timeout-minutes: 20`. Update the comment next to it (around lines 62-67) to say why: shard 3 measured 14m00s on #1461, shard 1 9m17s, shard 2 7m43s; shards split by file not duration; the one auto-rerun has the same cap. Change nothing else (leave the other job's `timeout-minutes: 20` alone).
2. Fix any header or comment in phone-qa.yml or phone-qa-rerun.yml that states 15 minutes.
3. If tests/automationFoundations.test.ts or another test asserts `timeout-minutes: 15` for phone-qa, update the assertion (add to Files only if one exists; otherwise leave untouched).
4. Run the workflow lint and the related unit tests (tests/automationFoundations.test.ts).
5. Edit the PR #1461 body: keep every section, add the measured shard times (9m17s, 7m43s, 14m00s).

## Do NOT touch
EventCalendar.tsx, calendar/CalendarGrid.tsx, calendar/CalendarListView.tsx, calendar/DayDetailModal.tsx, calendar/calendarUtils.ts, useCalendarEvents.tsx (density-exempt calendar files), src/components/ui/dialog.tsx, supabase/**, migrations, scripts/**, .env*, runs-on, secrets, triggers, any `permissions` widening, any other workflow, any file not listed under Files.

## Done when
One bot push; last commit subject ends with the [worker-done ...] marker. PR #1461 stays hard tier: independent review + owner Approve at head.
