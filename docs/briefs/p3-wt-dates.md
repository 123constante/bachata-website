# Brief: DATES-100 + CACHE (F-27, F-33)

Repo bachata-website, branch claude/p3-wt-dates, lane normal, Opus (data integrity, cache). No DB change; if the fix needs one, STOP and say so in the handover.

Read first: `docs/design/p3-acceptance/FIXLIST.md` F-27, F-33; `AUDIT-team.md` A-team-4; `AUDIT-public.md` A-public-7.

## Standing header (do not skip)
- Prove the data source first: read the live RPC behind "All dates" (body via pg_proc, read-only prod) and state its row cap and how a page/offset is passed. State which query keys feed the event page and calendar.
- Zero bytes to the /app first load (`npm run check:bundle-budget` main vs branch). Never edit `perf-budgets.json` / `vite.config.ts`.
- Stopping rule: one independent review, one fix round, then the orchestrator walk.

## Scope (ONLY these rows)
- F-27: "All dates" must reach every date (Load more or paging), and the Past/All counts must be true. Prod has a series with 132 dates (shape survey: dates per series, buckets <=100, 101-200, >200; counts only).
- F-33: after a change in the organiser area, the public event page and the calendar in the SAME tab show fresh data (targeted invalidation of the exact query keys after the organiser save paths in `p3/data/dates.ts` and `p3/data/sessions.ts`). Do not shorten global stale times.
- DENSITY EXCLUSION: do NOT edit `src/components/EventCalendar.tsx`, `components/calendar/*`, `src/hooks/useCalendarEvents.tsx`. Invalidate calendar queries by key from the organiser side only; if the calendar hook file must change, STOP and note it in the handover.
- Do NOT touch `EventPage.tsx` (another worker owns it), routing, or gate files.

## Checks
1. Shape survey as above. 2. Table-driven vitest: series with 0, 1, 99, 100, 101, 132, 250 dates x {All, Upcoming, Past} -> correct counts, nothing silently dropped, empty states say what the person can do; invalidation test: each organiser save path invalidates the public event + calendar keys (and nothing broader). Red first. 3. Run every CI job step locally or on the side laptop, per-job table in PR body. 4. PR body lines `- Shapes surveyed:`, `- Checks run:`, `- NOT verified:`, section `## Phone QA`. 5. Early checkpoint push; handover `docs/handover/p3-wt-dates.md`.
