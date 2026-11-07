# Brief: organiser-stats-v2-share-card continuation 2 (two must-fix from the independent review)
Brief-version: 2
Branch: claude/organiser-stats-v2-share-card
Lane: normal, Opus. Continuation of PR #1428. Screen change, no migration, no hard-tier path. Repo 123constante/bachata-website. Same PR, same branch.

## Goal
Fix the two must-fix findings of the independent review (report: C:/tmp/review/pr1428.md, head 1923600d8) and nothing else. (1) The Stats share link must resolve for every live event. (2) A refused analytics read must hide the new tiles, not replace the whole Stats screen with an error whose Retry can never succeed.

## What main lacks
- a share link that is built from the public event reference (slug, or legacy_event_id ?? id), not the series id -- grep: publicEventRef
- a refusal-tolerant Stats screen: a refused analytics read keeps the existing views and hides the new tiles, no Retry -- grep: analyticsHidden

## Files
- src/modules/organiser/p3/data/home.ts
- src/modules/organiser/p3/data/analyticsV2.ts (new) -- exists on the PR branch only
- src/modules/organiser/p3/screens/ShareLinkCard.tsx (new) -- exists on the PR branch only
- src/modules/organiser/p3/screens/StatsScreen.tsx
- src/modules/organiser/p3/data/__tests__/analyticsV2.test.ts (new) -- exists on the PR branch only
- src/modules/organiser/p3/screens/__tests__/statsShare.matrix.test.tsx (new) -- exists on the PR branch only
- a new test file next to the home tests for the public ref (src/modules/organiser/p3/data/__tests__/publicEventRef.test.ts)
- a short handover under docs/tickets/ (new)

## Must-fix 1, quoted from the review
"share link uses the SERIES id (P3Row.id = s.id, home.ts:93), not publicEventId (legacy_event_id ?? id). ... Prove on prod (read-only) ... add a test. Better: link with the canonical id/slug the resolver returns, so legacy events cannot 404."
PROD PROOF ALREADY TAKEN (2026-11-07, read-only, public.event_series_p5, lifecycle_status='live', 70 series): resolve_public_event_ref_v1(series id) resolves for 12 of 12 unbridged series and for 0 of 58 bridged series (legacy_event_id not null). So today's link 404s for 58 of 70 live events. resolve_public_event_ref_v1(slug) resolves for 70 of 70, and COALESCE(legacy_event_id, id) resolves for 70 of 70. All 70 live series have a slug. The resolver matches a uuid only on legacy_event_id, or on id when legacy_event_id is null.
organiser_home_v1 builds two `'slug'` keys (one for the series row x.slug, one for the organiser op.slug): read its definition (select pg_get_functiondef) to confirm which key is the series slug and where it sits in the payload. Do NOT trust this brief for the payload path; check.

## Must-fix 2, quoted from the review
"StatsScreen.tsx (error branch ~line 64) + analyticsV2.ts fetchPageAnalytics: 'one refused series refuses the lot'. The RPC is owner/manager only; a team member who is not a manager (or a mixed-role scope) gets the whole Stats screen replaced by 'couldn't load your views' with a Retry that can never succeed. ... Treat a refusal (code present) as 'analytics hidden for your role': keep views, hide the new tiles, no retry."

## What to build
0. Write INVENTORY.md first (in docs/tickets/ handover or PR body, not the repo root): every state of the Stats screen and share card with file:line (loading, error, empty, ended-only, live, switched-off, no-code, refused, two pages) and which test covers it. Report the coverage count (states covered / total) at the end. Build only after it exists.
1. git fetch origin main; git merge origin/main if the branch is behind; keep both sides.
2. Share link: add `publicEventRef: string` to P3Row, built in one place (home.ts row builder) from the series slug when the payload carries it (non-empty), else `legacy_event_id ?? id` if the payload carries legacy_event_id, else STOP and report PARTIAL with what you grepped (a migration would be needed: admin repo, careful lane; do not add one and do not guess). ShareLinkCard passes `next.publicEventRef`. Rename shareLinkOf's second parameter to `publicEventRef` so the series id cannot be passed by habit.
3. Refusal: in fetchPageAnalytics, a server refusal (an error WITH a code) must resolve to a "hidden" result instead of throwing; keep retrying only code-less network errors as today. StatsScreen: when analytics is hidden, render the existing views as before, hide the new tiles and the share link card's analytics-dependent parts, show no Retry for it. views.isError or scope.home.isError still show the existing error card with Retry. Note for a mixed-role page: if any series is refused, hide the new tiles for the whole page (never show a partial sum as the page total). The refused state must not block loading of the existing views (the review nit: render views first when analytics is slow).
4. Tests, table-driven, red first (run against the unfixed code and say so): link target for {bridged, unbridged, empty-string slug, slug with spaces/unicode} x {slug present, slug absent}; the link never contains the series id of a bridged series; a source-scan test that nothing under src/modules/organiser/p3 builds `/event/` from a bare `.id`; fetchPageAnalytics refusal x {42501, other coded error, no code} x {one series, mixed}; StatsScreen with analytics refused shows the views and no `p3-stats-error`.
5. Cheap review nits while there (same files only): clear the "Link copied." note when the state changes; check the disabled button's contrast is at least 4.5 and fix the colour token use if not.
6. Checks: tsc 0 errors in touched files; vitest src/modules/organiser/p3; npm run check:mojibake. Use &mdash;/&rsquo; entities, no raw Unicode punctuation. Files over 2 KB go through scripts/safe-edit.py. PR body labels exact: update "Verified on real data" with the prod proof above (re-run the same read-only query yourself, counts only) and "Phone QA" honestly.
7. Push ONCE at the end with the [worker-done ...] marker.

## Do NOT touch
EventCalendar.tsx, calendar/CalendarGrid.tsx, calendar/CalendarListView.tsx, calendar/DayDetailModal.tsx, calendar/calendarUtils.ts, useCalendarEvents.tsx (density-exempt calendar files), src/components/ui/dialog.tsx, supabase/**, migrations, workflows, scripts/**, .env*, any file not listed under Files.

## Done when
One push; branch merges cleanly with main; every CI job step that applies has been run and the per-job table is in the PR body; the PR body has "## Verified on real data" (- Shapes surveyed: / - Checks run: / - NOT verified:) and "## Phone QA" (- Sizes checked: / - Walked: / - Not verified:); the pack at 1923600d is superseded and must be rebuilt after this lands; last commit subject ends with the [worker-done ...] marker.
