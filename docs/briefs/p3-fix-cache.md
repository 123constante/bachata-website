# Brief: p3-fix-cache -- FIXLIST F-33 (stale public page and calendar after an organiser write) and F-34 (see it as dancers see it)

Branch `claude/p3-fix-cache` from origin/main. Model Opus (cache invalidation is a data-integrity path). Lane normal (no DB change).

## Shared rules for every P3 fix slice (program lead 2026-10-31)
- Context cap 35%: push + `PARTIAL [worker-done <ticket>]` if you cannot finish. Stopping rule: one independent review (the lead dispatches it), one fix round, then the lead walks at 390x844.
- Source of truth for each row: `docs/design/p3-acceptance/FIXLIST.md` (on main after #1216 merges; until then read it from `origin/claude/p3-fixlist`), the audit it cites, and `CONTRACT.md` in the same folder. Quote the row id in every commit and in the PR body with its result.
- FILES OWNED BY ANOTHER OPEN PR (#1208 create-event): do NOT edit `p3/data/sessions.ts`, `p3/screens/RepeatSheet.tsx`, `p3/screens/parts.tsx`, `p3/screens/__tests__/screens.matrix.test.tsx`, `p3/shell/P3Routes.tsx`, `p3/shell/P3Shell.tsx`, `p3/shell/paths.ts`, `p3/new/**`, `p3/you/surface.tsx`, `package.json`. Put new tests in NEW test files. If a fix needs one of those files, stop that row, write it under "Left for the lead" in the PR body, and do the rest.
- Table-driven vitest for every screen x shape the row names (prod shapes in INVENTORY.md; counts only). One shared mapping for any fact shown on more than one screen. No copy pointing at a control that is not on screen. Every empty or error state says what the person can do. Red first: run the new test against the unfixed code and paste the red line in the PR body.
- Standing lines: prove the data source first (read the live RPC body read-only on prod and name the table/column); zero bytes to the dancer-app first load (`npm run check:bundle-budget` on main and on the branch; never edit perf-budgets.json or vite.config.ts); sheets and toasts are portalled, opening one must not scroll the page; an e2e at 390x844 asserts the boxes sit inside the viewport when you add a sheet.
- Run every CI job step that applies (read `.github/workflows`), fill the PR body template incl. Verified / Not verified and the per-job table. Walk your screens at 390x844 with the ACCOUNTS.md test accounts; list the screenshots in the PR body. HTML entities, never raw Unicode punctuation. Full weekday names. Compact density (.claude/rules/design-density.md).
- Commit subjects `fix(p3): ...`; the final one ends `[worker-done <ticket>]`.

## F-33 (medium) `event-page/useEventPageQuery.ts:391`, `hooks/useCalendarEventsRpc.ts:31`, `p3/data/dates.ts:339-342`
(`p3/data/sessions.ts:282-283` is owned by #1208: list it under "Left for the lead", do not edit it.)
What is wrong: the public event page and the calendar keep React Query data for 1 h in the same tab; a P3 write (status, dates, details, prices, cancel) does not invalidate them, so an organiser who opens the public page after a change sees the old data.
Fix: ONE invalidation helper (keys for the event page by series or public id, and for the calendar) called from every P3 mutation success path except the sessions file. A table-driven test that every P3 mutation hook in scope calls it: enumerate the hooks by grep and assert the list is complete, so a new hook without it fails the test. Do not lower staleTime globally (perf budgets).

## F-34 (low) `p3/screens/EventPage.tsx:153-154`
Add a "See it as dancers see it" link to the public event page (same tab, through the public URL builder the share action already uses; never hand-roll the path). Shown only when a public page can exist (live or ended); otherwise disabled with the reason beside it.
