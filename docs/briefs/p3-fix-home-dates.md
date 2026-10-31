# Brief: p3-fix-home-dates -- FIXLIST F-16 (Home copy) and F-27 (All dates over 100)

Branch `claude/p3-fix-home-dates` from origin/main. Model Opus (F-27 is paging/data logic). Lane normal (no DB change).

## Shared rules for every P3 fix slice (program lead 2026-10-31)
- Context cap 35%: push + `PARTIAL [worker-done <ticket>]` if you cannot finish. Stopping rule: one independent review (the lead dispatches it), one fix round, then the lead walks at 390x844.
- Source of truth for each row: `docs/design/p3-acceptance/FIXLIST.md` (on main after #1216 merges; until then read it from `origin/claude/p3-fixlist`), the audit it cites, and `CONTRACT.md` in the same folder. Quote the row id in every commit and in the PR body with its result.
- FILES OWNED BY ANOTHER OPEN PR (#1208 create-event): do NOT edit `p3/data/sessions.ts`, `p3/screens/RepeatSheet.tsx`, `p3/screens/parts.tsx`, `p3/screens/__tests__/screens.matrix.test.tsx`, `p3/shell/P3Routes.tsx`, `p3/shell/P3Shell.tsx`, `p3/shell/paths.ts`, `p3/new/**`, `p3/you/surface.tsx`, `package.json`. Put new tests in NEW test files. If a fix needs one of those files, stop that row, write it under "Left for the lead" in the PR body, and do the rest.
- Table-driven vitest for every screen x shape the row names (prod shapes in INVENTORY.md; counts only). One shared mapping for any fact shown on more than one screen. No copy pointing at a control that is not on screen. Every empty or error state says what the person can do. Red first: run the new test against the unfixed code and paste the red line in the PR body.
- Standing lines: prove the data source first (read the live RPC body read-only on prod and name the table/column); zero bytes to the dancer-app first load (`npm run check:bundle-budget` on main and on the branch; never edit perf-budgets.json or vite.config.ts); sheets and toasts are portalled, opening one must not scroll the page; an e2e at 390x844 asserts the boxes sit inside the viewport when you add a sheet.
- Run every CI job step that applies (read `.github/workflows`), fill the PR body template incl. Verified / Not verified and the per-job table. Walk your screens at 390x844 with the ACCOUNTS.md test accounts; list the screenshots in the PR body. HTML entities, never raw Unicode punctuation. Full weekday names. Compact density (.claude/rules/design-density.md).
- Commit subjects `fix(p3): ...`; the final one ends `[worker-done <ticket>]`.

## F-16 HOME-COPY (high) -- `p3/screens/HomeScreen.tsx:15-20,109-113,169-176`, `p3/model/status.ts`
What is wrong: Home says "None of your live events has a date coming up. Add dates" beside events tagged "Finished", where dates cannot be added (prod shape: 9 live-but-past one-offs, 5 courses). The all-ended copy says "Add an event" but Home has no Add an event control.
Fix: one shared mapping (lifecycle x has-future-date x format) -> the next-up copy plus the ONE control that works for it (an Events link when dates cannot be added; the New event entry the shell already has for the all-ended case; never name a control that is not on screen). Table-driven test over every prod shape in INVENTORY.md: ended, live-past one-off, live-past course, live weekly with future dates, archived, draft, 0 events.

## F-27 DATES-100 (medium) -- `p3/data/eventPage.ts:119`, `p3/screens/AllDatesScreen.tsx:43`
What is wrong: `fetchSeriesWorkspace` sends no `p_limit` / `p_before`, so All dates shows the newest 100 with no Load more; the Past and All counts come from the loaded list (1 prod series has 132 dates; max future 57).
Fix: read the live RPC body first and state what paging it supports; page with Load more (or load all when the server allows it); take counts from the server summary, never from the loaded slice. Test the shapes 0, 1, 57 future, exactly 100, 101, 132 (fixtures), and that the counts match the server total. The screen must say when more exist and what to tap.
