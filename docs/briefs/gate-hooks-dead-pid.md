# Brief: P58: test-gate-hooks 'runner already gone' uses a PID that can never be live
Brief-version: 2
Branch: claude/gate-hooks-dead-pid
Lane: normal, Sonnet. Repo 123constante/bachata-website. One PR.

## Goal
Stop the flaky unit-shard failure "runner already gone: exit 1: expected 1, got 0" (tests/routeRunner.test.ts runs test-gate-hooks.sh; failed on #2503 run 46004648763 attempt 1). Cause: case 9b reaps `true & W3=$!; wait $W3` and reuses that PID; on a busy CI box the kernel can hand the PID to a new process before the hook checks /proc/$W3, so the hook sees a live runner.

## What main lacks
- the 9b case uses kernel pid_max as the dead PID, not a just-reaped one -- grep: pid_max

## Files
- docs/ci-offload/acer-web/test-gate-hooks.sh

## What to build
1. In docs/ci-offload/acer-web/test-gate-hooks.sh case 9b (line ~457-458), replace `true & W3=$!; wait $W3` with `W3=$(cat /proc/sys/kernel/pid_max)` plus a one-line comment: PIDs run 1..pid_max-1, so /proc/<pid_max> never exists; a just-reaped PID can be recycled under load (flake on #2503).
2. Change nothing else. Run `bash docs/ci-offload/acer-web/test-gate-hooks.sh` (or the routeRunner test) in the worker and paste the 9b lines.

## Do NOT touch
EventCalendar.tsx, calendar/CalendarGrid.tsx, calendar/CalendarListView.tsx, calendar/DayDetailModal.tsx, calendar/calendarUtils.ts, useCalendarEvents.tsx (density-exempt calendar files), src/components/ui/dialog.tsx, supabase/**, migrations, workflows, scripts/**, .env*, any file not listed under Files.

## Done when
One push; PR body has "## Verified on real data" (- Shapes surveyed: / - Checks run: / - NOT verified:) and "## Phone QA" (- Sizes checked: / - Walked: / - Not verified:); tests green; every CI job step that applies has been run and the per-job table is in the PR body; last commit subject ends with the [worker-done ...] marker. Docs-only or tests-only PR: delete the Phone QA section.
