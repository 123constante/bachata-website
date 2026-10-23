# Brief: Going P0.5 -- calendar list still shows "N going" while Going is switched off

Lane: FAST-sized but run by a worker (owner: no code on their PC). Model: Sonnet. Branch `claude/going-calendar-leak` from origin/main.
Arc plan: ARC "GOING" (owner approved 2026-10-23). Owner approval of that plan is the required OK to touch the calendar files
(normally density-excluded in CLAUDE.md). Change ONLY the going-count gating; no layout/density change.

## The failure
Owner decision 2026-10-18: hide Going completely (`src/lib/goingCheckin.ts`, `GOING_CHECKIN_ENABLED = false`).
But `src/components/EventCalendar.tsx` (~line 151-181) still fetches `get_event_attendance_counts_by_range` and
`src/components/calendar/CalendarListView.tsx` (~line 145-153) still renders "{n} going". The check that would have caught it:
a test over EVERY surface that renders a going count, asserting nothing when the switch is false.

## Task
1. RED FIRST: a test that renders CalendarListView (and EventCalendar's mapping) with events carrying goingCount > 0 and the
   switch false -> no "going" text; run it on unfixed code, record that it fails.
2. Fix: when `GOING_CHECKIN_ENABLED` is false, EventCalendar does not fetch counts (query `enabled: false`) and the list view
   renders no count. When true, behaviour exactly as today (test both).
3. Grep the whole of `src/` for any OTHER place that renders a going/attendee count not behind the switch; list them in the
   handover (fix them only if each is a one-line gate; otherwise list).
4. Run every CI job step that applies (read .github/workflows), per-job table in the PR body, `## Verified on real data`
   section (Shapes surveyed / Checks run / NOT verified). Handover `docs/handovers/going-calendar-leak.md`.
Do NOT push again after your final commit + handover.
