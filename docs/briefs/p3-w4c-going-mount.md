# Brief: P3 W4c organiser "Who is going" -- CONTINUATION (push ONLY branch claude/p3-w4c-going-mount)

START: create `claude/p3-w4c-going-mount` from `origin/claude/p3-w4c-going` (it carries the handover docs). Push ONLY the -mount branch; the old branch is frozen.

The id bridge now exists and is APPLIED on prod (admin #1157 merged 2026-10-30): `public.get_my_series_going_v1(p_series_id uuid)` returns jsonb. It looks up the series public id and returns the same payload/refusals as `get_my_event_going_v1` (contributor => not_organiser). Authenticated only. So NO parser change for publicEventId: call the series twin with the series id every P3 row already carries (`P3Row.id`, `WorkspaceSeries.id`).

Read first: `docs/handovers/p3-w4c-going.md` and `docs/handovers/going-p3-organiser.md` (mount code for GoingNightSummary / GoingPeopleSheet / GoingLoadState).

## Do
1. Prove the data source first: read-only SELECT on prod (project stsdtacfauprzrdebmzg) that get_my_series_going_v1 exists, its ACL, and its delegate; state it in the PR body. Never a write.
2. Add a client reader for `get_my_series_going_v1` (same response type as the event reader; reuse, do not copy).
3. Mount in P3 only when `organiserP3 && GOING_CHECKIN_ENABLED`: HomeScreen hero, DateSheet row (match `night.occurrence_id` to `WorkspaceDate.id`), StatsScreen By-event row. Contributor (`not_organiser`) renders nothing. Every state says what the person can do: no going, 1, many, >200, cancelled, load error (retry), switch off, P3 off.
4. Table-driven tests for every screen x every shape above (one shared mapping). Shape-survey counts on prod (series with going vs none; counts only).
5. `npm run check:bundle-budget` before/after: the PR adds 0 bytes to dancer-app first load. Sheets are portalled; opening one must not scroll the page; e2e at 390x844 asserts the sheet and buttons sit inside the viewport.
6. Run every CI job step in the sandbox; per-job table in the PR body; the PR body needs a `## Phone QA` section. Push once. Do not touch perf-budgets.json or vite.config.ts.

Handover doc on stop; end the final commit subject with the worker-done marker given in your prompt.
