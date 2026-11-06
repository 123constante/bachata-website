# Handover: p3-fix-cache (FIXLIST F-33, F-34)

Branch `claude/p3-fix-cache`, ticket dt_3c0cf785c306. Brief: `brief/p3-fix-cache:docs/briefs/p3-fix-cache.md`.

## Done

**F-33 (medium), stale public page and calendar after an organiser write.** Result: fixed for every P3 write path except the sessions file (#1208 owns it).
- One helper: `src/modules/organiser/shared/publicCache.ts` `invalidatePublicEventCaches(qc, seriesId)`.
  It marks stale every `['event-page-snapshot', <seriesId>, *]` entry (all dates of that series) and every `['calendar-events', ...]` range. staleTime is unchanged.
- Called from `shared/runCommands.ts` `useReload`, which covers `useSendOnce` and `useRunCommands` (StatusSheet, CancelEventSheet, Toast undo, EditTray: details and prices). Also called from `p3/data/dates.ts` `useSendPlan`, which covers DateSheet.
- The key roots live in the helper as strings. A first attempt put them in a new shared `src/lib/publicQueryKeys.ts`. The perf ratchet showed that module as one more first-load chunk on /event, /city, /parties and /classes, so it was reverted. Instead, `publicCache.test.tsx` pins the roots to `eventPageQueryKey`, `useCalendarEvents` and `seoLandingEventsKey`.
- Data source (read-only on prod): `event_view_p5` reads `event_series_p5.lifecycle_status`, and the page key's second part is the series UUID (`pages/EventPage.tsx` resolves slug to id before the query).

**F-34 (low), "See it as dancers see it".** Result: done.
- `publicPageOf(ws)` in `p3/data/eventPage.ts` is the one shared mapping. The link opens for `live` and `ended`, in the same tab, through `eventHref` (`src/lib/seo/eventHref.ts`).
- Draft, paused (Hidden), archived and any other status show the row disabled, with the reason beside it.
- `event_view_p5` also serves `paused`, but the owner copy calls that state "Hidden", so the link stays off for it. Prod: every live or ended series has a slug.
- The row is the first row of the edit-rows card on `p3/screens/EventPage.tsx`.

## Tests (new files only)
- `src/modules/organiser/shared/__tests__/publicCache.test.tsx`:
  - key roots;
  - the helper against 6 seeded keys;
  - every write hook (useSendOnce, useRunCommands, useSendPlan for series and date) on both ok and refused;
  - completeness: every file under `p3/` or `shared/runCommands.ts` that calls `runSeriesCommand`, `runOccurrenceCommand` or `saveOccurrenceProgramme` must call the helper, or be listed in EXEMPT with a reason.
- `src/modules/organiser/p3/screens/__tests__/dancerView.matrix.test.tsx`: EventPage for every prod shape in wsFixtures (18), plus the mapping itself.
- Red first:
  - F-33: with the fix stashed, 10 of 21 tests failed (every write-hook case and both completeness rows).
  - F-34: `Unable to find an element by: [data-testid="p3-dancer-view"]`.

## Left for the lead
- **F-33, `p3/data/sessions.ts:282-283` (`useDateSend`, owned by #1208):** add `invalidatePublicEventCaches(qc)` (r2: no series id) inside `reload()`, then remove `sessions.ts` from EXEMPT in `publicCache.test.tsx`. Once the EXEMPT entry is gone, the completeness test fails until the call is there. The every-date session path already goes through `useSendOnce` and is covered.
- Out of scope, noted: organiser profile, onboarding and door writes do not invalidate public pages. The organiser name can appear on an event page.

## Not verified
- No browser walk at 390x844 with the ACCOUNTS.md accounts (not done in this run). The lead's walk is the first visual check.
- `npm run test:e2e` was not run.
- 4 unit test files fail locally, all environment-related, none in files this PR touches:
  - 3 live-DB contract tests fail with "Invalid API key" (no DB key in this container).
  - `tests/integrityCouldNotRun.test.ts` fails because a global typescript at `/opt/node-tools` breaks its precondition.

## Round r2 (review `claude/review-1220-r1:docs/review/pr-1220-r1.md`, brief `brief/fix-1220-r2`, ticket dt_2baab86007d8)

The r1 notes above are kept as written; two of them were wrong and are corrected here.

- **F1 (fixed).** "The page key's second part is the series UUID" was wrong: the public page keys by `resolve_public_event_ref_v1`'s `COALESCE(legacy_event_id, id)`, which differs from the P5 id for 81 of 92 prod series, and the workspace carries no legacy id. The helper is now `invalidatePublicEventCaches(qc)` and marks the event-page ROOT stale, like the calendar root. The `seriesId` parameter is gone from every caller. Test: `pageOther` now expected stale, new row `pageLegacy` (`eventPageQueryKey('legacy-9', null)`) expected stale.
- **F2 (fixed).** `shared/useOwnerCommand.ts` `reload` calls the helper last. New `HOOKS` row `useOwnerCommand` (ok, refused).
- **F3 (fixed).** `flows/fix/CoverFlow.tsx`, `flows/new/NewFlow.tsx`, `flows/new/useNewSend.ts` call the helper after their invalidations. The widened grep also found two more senders the review did not list: `flows/change/Pick.tsx` (bulk move/cancel through `admin_bulk_occurrence_command_p5`) and `dates/useDateEditor.ts` (`saveOccurrenceProgramme`, its `invalidateAround`). Both now call the helper.
- **F4 (fixed).** `ROOTS` is `src/modules/organiser`. `SENDS` also matches `runBulkCommand(` and a quoted `'series_command_p5'`, `'occurrence_command_p5'` or `'admin_bulk_occurrence_command_p5'` (quoted, so a comment naming the RPC does not count). `EXEMPT`: `selfServeApi.ts` and `flows/change/bulkApi.ts` (transport), `repeat.ts` (dry run), `sessions.ts` (#1208, lead).
- **F5 (fixed).** Paused opens the link. The subline reads "Hidden from the calendar. The page still opens with past dates only." The owner copy at `eventPage.ts:209,281` is unchanged (out of scope).
- **F6 (fixed).** No slug: the row is off with "The page has no address yet." (no fallback to the P5 id).
- **F8.** The handover stays at `docs/handover-p3-fix-cache.md`.

Still left for the lead: the `p3/data/sessions.ts` call is now `invalidatePublicEventCaches(qc)` (no series id), then drop `sessions.ts` from `EXEMPT`.
