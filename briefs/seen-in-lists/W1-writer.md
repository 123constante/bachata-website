# Brief W1: Website writer for "seen in lists" (normal lane, no DB change, no visible change)

Repo: 123constante/bachata-website. Branch `claude/seen-in-lists-web` off `main`. ONE push, one PR (bot author).
No visible change (Design Gate exempt; say so in the PR). The DB half is LIVE on prod (admin #984, merged and
applied 2026-10-24; migration `supabase/migrations/20261210000000_event_impressions_daily_v1.sql` in
123constante/bachata-admin, read its header for the contract).

## The RPC (pinned; do not change)
`record_list_impressions_v1(p_event_ids uuid[], p_surface text, p_viewer_session_id text, p_user_agent text DEFAULT NULL)`
returns `{ok:true, counted:n}` or `{ok:false, reason}` (never raises for bad input). At most 60 ids per call.
Ids may be the series id or its public_event_id (the cards' event_id). Only live series count; others are ignored.
Surfaces, exactly: `home, city, search, more_events, organiser, calendar, tonight, festivals, venue, profile`.
Regenerate or hand-add its entry in `src/integrations/supabase/types.ts` (match the generated shape).

## Decided (do not re-open)
1. One shared hook, e.g. `src/lib/listImpressions.ts` + `useListImpression(surface)` returning a ref/callback a card
   wrapper attaches. A card counts when >= 50% of it is visible for >= 1 s (IntersectionObserver, threshold 0.5,
   timer per element, cancelled when it leaves).
2. De-dupe per page load: each (surface, event id) counts at most once per mount of a list page.
3. Batch: queue ids per surface; ONE rpc call per surface per flush, chunks of <= 60. Flush on
   `visibilitychange` -> hidden, `pagehide`, route change/unmount, and a 5 s idle debounce. Never one call per card.
4. Same gating as `src/modules/event-page/useRecordEventView.ts`: skip `navigator.webdriver`, skip with no
   `getViewerSession()` (`src/lib/viewerSession.ts`), pass `navigator.userAgent`. Errors are swallowed (fire and forget).
   Respect `flags.enableEventTracking` too if it is false (same kill switch), PLUS a new flag
   `listImpressions` (`VITE_ENABLE_LIST_IMPRESSIONS`) in `src/lib/featureFlags.ts`: `true` in `.env.development`
   and `.env.production` (owner approved the build; the flag is the off switch).
5. Wire the ten surfaces (file list from the migration header; confirm each still renders cards there):
   home, city list, search results, More events (`MoreEventsSection.tsx`), organiser page (`OrganiserProfile.tsx`),
   calendar list (`CalendarListView.tsx`), `Tonight.tsx` (incl. city tonight), `FestivalHub.tsx`, `VenueEntity.tsx`
   what's-on list, `DJProfile.tsx` + `TeacherProfile.tsx` upcoming lists. Use the id the card already has; no new reads.
6. Do not slow the page: no layout change, no extra render per card beyond the observer, bundle growth stated.

## Tests (red first)
- Unit: threshold/1 s rule (fake timers + mocked IntersectionObserver), de-dupe, 60-chunking, flush on hidden,
  webdriver skip, no session skip, flag off = zero calls, one call per surface per flush.
- Table-driven: every one of the ten surfaces is wired (a test per surface that renders the list with 2 cards and
  asserts one batched call with that surface name and both ids).
- Phone e2e at 390x844 on one list page: scroll, wait 1 s, hide the page, assert exactly one rpc with the seen ids
  (intercept the request; do NOT write to prod from tests).

## Real-data check (required in the PR)
On a build against prod data, open home, one city list and tonight at 390x844 with Playwright, INTERCEPT the
`record_list_impressions_v1` request and ABORT it (no prod write), scroll, hide the page, and record each payload:
surface, number of ids, that every id is a real live series (read-only SQL against `event_series_p5` by `id` or
`public_event_id`, `lifecycle_status`). Report the numbers. Real counts are checked by the orchestrator after merge.

Run every CI job step locally per the workflows and put the per-job table in the PR body. Handover note:
`docs/session-handover-<date>-seen-in-lists-web.md`.
