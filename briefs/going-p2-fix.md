# Brief: Going P2 fix round on PR #992 (review + owner decisions). Then hand back for the walk.

Model: Opus. Branch `claude/going-p2-website` (PR #992, head `0051c372`). Work on it directly, push ONCE at the end.
Read: `docs/handovers/going-p2-website.md`, `docs/handovers/going-p2-critique.md`, and the review: `git show origin/claude/going-p2-review:docs/reviews/going-p2-review.md` (rows referenced as R#).

## Owner decisions 2026-10-23 (binding)
- Calendar edits in `EventCalendar.tsx` + `CalendarListView.tsx` APPROVED (count source + chip colour). ADD: hide the going count on cancelled rows (`goingCount > 0 && !event.isCancelled`, or the file's own cancelled flag). Touch nothing else in calendar files.
- Review rows R1-R5 (visible removals of the old lists with the switch OFF) are ACCEPTED as built.
- R6 dashboard (`src/components/profile/DancerDashboard.tsx`) must be TIDIED: show the completion % ONCE (no repeated bar/number); a clean tile layout with no lone tile (re-flow what is left to fill the row; compact density per `.claude/rules/design-density.md`); and every dancer's completion % must be the SAME number main showed for the same profile (use main's function as the test oracle, table-driven over profile shapes; if main's 5th step was the going/events step, keep it counted the way main did, without calling any old RPC).

## Fix list
1. R7: a test that runs a real Vite build of a tiny entry with the repo's `define` under `VERCEL_ENV=production` + the preview flag set, and asserts the switch folds to `false`; and the preview + flag case folds to `true`.
2. RENAME the preview override: `VITE_GOING_PREVIEW=1` -> `VITE_ENABLE_GOING_PREVIEW=true` (the orchestrator's preview tool passes only `VITE_ENABLE_*=true|false` per build). Rule unchanged: ON only when `VERCEL_ENV === 'preview'` AND that flag is `true`. Update tests, docs, and the handover's owner steps (there is now NO Vercel dashboard step).
3. R9: `REQUIRE_GOING_PEOPLE=1` turns PEOPLE_SKIP / GOING_NEXT_SKIP into exit 2 (default off; document when to set it).
4. R10: `tests/client/festivalHubGoing.test.tsx:164` asserts the real per-night text.
5. R11: widen `check-going-legacy-rpcs.mjs` names (unversioned + `_vN` variants, case-insensitive), canary updated with a mutant per new name.
6. R12: `tests/client/goingHidden.test.tsx:143` uses `/attendance/`.
7. R13: when `get_my_going_v1` errors, the viewer's going is unknown (loading/error with retry), never `false`.
8. R14: delete `src/modules/event-page/sections/EventAttendanceSection.tsx` (prove 0 importers).
9. R8: you cannot edit workflows. In the handover give TWO exact YAML steps for the orchestrator/owner: the `db-contract-check.yml` going-rpcs step (exists) and a `check:going-legacy-rpcs` (self-test, then check) step for a pull_request workflow such as `architecture-guard.yml`.
Red first for each behaviour fix. Table-driven where there are shapes.

## Finish
Every CI job step that applies, run in your sandbox; per-job table. Update the PR body (you can edit it with `gh pr edit 992 --body-file`): keep the builder's content, and ADD the sections `## Phone QA` and `## Verified on real data`. Phone QA = your 390x844 harness shots per surface (and say the orchestrator's live preview walk is still to come). Verified on real data = the shape counts used (prod, read-only) + an honest Not verified list. Update `docs/handovers/going-p2-website.md` with a "Fix round" section (what changed, decisions, the two YAML steps). Final commit subject ends `[worker-done <ticket>]`.
