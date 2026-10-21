# ER-C6 (website-screen): public facts on the event page and the calendar

Branch `claude/er-c6-public` from `claude/er-s1-rules`. Rule 18; D1 gaps "Public side". Read ER-COMMON. Read `src/modules/event-page/CLAUDE.md` first (BentoPage.tsx is the real render; `sections/` is mostly dead: prove an importer exists before editing).

Show on the PUBLIC event page and the calendar day row: payment line (from `payment_methods` codes; NO line at all when none), times from sessions, level, cancelled date with its reason (stays visible as Cancelled), festival party hours per day, artists as line-up, "Timetable coming soon" when a festival has no workshops, and "By <owner>, <co-organisers>" (accepted only). Existing stored values (price list, event Instagram): keep showing what is stored (default; park the question).

Calendar exclusion files (`CalendarListView.tsx`, `DayDetailModal.tsx`, `calendarUtils.ts`): CONTENT strings and data mapping only; owner allowed content, never layout or density. Do not touch `EventCalendar.tsx`, `CalendarGrid.tsx`, `ui/dialog.tsx`. Public layout is unchanged.

Tests: table over event shapes (all formats x cancelled x no payment x festival with/without workshops). Check the perf budgets (`perf-budgets.json`) and SEO/OG checks that apply. Touches: `src/modules/event-page/**`, `src/components/calendar/CalendarListView.tsx`, `src/components/calendar/DayDetailModal.tsx`, `src/components/calendar/calendarUtils.ts`.
