# Brief: independent review of PR #1799 (branch claude/home-polish)

You are a REVIEWER, not a builder. Do not push code to claude/home-polish. Push ONE docs file `docs/review/home-polish-1799.md` on your own branch (the one you are dispatched on) with the verdict, and end your final commit subject with the worker-done marker.

Read first: `docs/briefs/home-polish.md` (build brief) and `docs/briefs/home-polish-registry-row.md` (binding owner design). Review `git diff origin/main...origin/claude/home-polish`.

Check, in order:
1. Everything is behind flag `homePolish`, default OFF: with the flag off the homepage, BottomNav and routes behave exactly as on main.
2. Flag ON matches the registry row: chip row, Today tab, menu sheet with search, map strip option 3, no BottomNav. Menu rows DJs (`/djs`), Festivals, Cities/countries navigate to real routes.
3. Correctness: search debounce/cancel, focus handling, "fix" in-flight cancel, restore, 0-tonight chip, end-of-feed rows, no stale state across navigations.
4. Phone: tap targets use explicit px (html font is ~13.5px), no horizontal scroll at 390x844, no forbidden density changes (see CLAUDE.md "Density exclusions": EventCalendar, CalendarGrid, CalendarListView, DayDetailModal, calendarUtils, useCalendarEvents, shared ui/dialog.tsx must be untouched).
5. No migrations, no `*.sql`, no new network writes, no raw Unicode punctuation in JSX (use entities), no secrets.

Verdict: PASS, PASS WITH NITS, or BLOCK. Each finding: file:line, failure scenario, fix. Keep the doc under 60 lines.
