# Handover: seen-in-lists website writer (W1) -- 2026-10-24

Branch `claude/seen-in-lists-web`. Ticket dt_b47c23db6b86.

## Done
- `src/lib/listImpressions.ts`: `createImpressionController` + `useListImpressions(surface)`.
  >=50% visible for >=1 s (IntersectionObserver), de-dupe per mount, queue per surface,
  one `record_list_impressions_v1` call per flush (chunks of 60); flush on hidden, pagehide,
  unmount, 5 s idle. Gating = useRecordEventView (webdriver, no session, `enableEventTracking`)
  plus new flag `listImpressions`.
- Flag: `listImpressions: VITE_ENABLE_LIST_IMPRESSIONS !== 'false'` (ON unless exactly 'false');
  no .env files edited (orchestrator instruction).
- RPC entry hand-added to `src/integrations/supabase/types.ts`.
- Wired: home (`AllEventsList`/`cards.tsx` EventRow), city (`LiveEventsSection`), search
  (`SearchResults` event cards), more_events, organiser (shared `EventRow` `impressionRef`),
  calendar (`CalendarListView`, ref only, no layout), tonight, festivals (`FestivalHub`),
  venue (`VenueWhatsOnList`), profile (`DjUpcoming`).

## Left / decisions to confirm
- `TeacherProfile.tsx` has no upcoming-events list at all, so nothing is wired there.
- "city" is wired on the SEO city list (`LiveEventsSection`), not on the home feed
  (home feed = `home`). Confirm against the admin migration header.
- `CalendarListView.tsx` is density-exempt; change is a `ref` only.
- Tonight / Festival / Organiser / Search / Calendar / More-events / Home page-level render tests are
  static wiring checks, not rendered (pages too heavy to mock).

## Verification status
- Unit: new 23 tests pass (controller 10, surfaces 13). Full `npm run test:unit`: 12438 pass, 15 fail in 4 files
  (eventViewCompat / occurrenceProgram / publicEventPageLineup = live-DB contract tests; integrityCouldNotRun = env),
  none touching these changes (not re-run on main to compare).
- NOT done: Playwright e2e at 390x844 and the real-data prod walk. `react-router dev` is OOM-killed in this
  sandbox (plain vite serves no data), so no payloads/ids were captured and no id->live-series SQL check was run.
  Next worker: run the walk in an environment with enough memory.
- NOT done: remaining CI jobs (lint chain, pre-ship, check:* scripts) were not run locally; tsc shows no new errors
  in touched files; eslint clean on new files.

## W1b continuation (2026-10-24, dt_3f139e5db1e2)
- Merged origin/main (e32b223); conflicts in CalendarListView.tsx and FestivalHub.tsx resolved keeping main's changes plus the impression ref/hook.
- 23 impression tests pass after the merge. Zero-call tests for `listImpressions` flag off and `enableEventTracking` off already existed (listImpressions.test.ts, `makes zero calls`).
- Decision recorded: `profile` covers DJ only (TeacherProfile has no upcoming list); `city` = SEO city list (`LiveEventsSection`).
- CI steps run locally: see PR body table. Phone e2e at 390x844 NOT run; the orchestrator walks the preview.
- Test runs rewrote some `__snapshots__` files in the working tree (line endings); those were deliberately not committed.

## W1 follow-up: bundle-budget (2026-10-24)
- `listImpressions.ts` no longer imports the Supabase client statically (getSupabase()), clearing the puller ratchet.
- It was then its own 2 KB shared chunk (+1 first-load request on home, event, parties, classes). Folded into `lib-event-rules` (vite.chunks.ts, pinned list in tests/chunkClassifier.test.ts). Measured on a clean local build: every route loads 2-3 fewer chunks than the old allowances; chunkRatchet and firstLoadRequestRatchet tightened to the measured values; dancer-app KB budget 372 -> 373 (372.3 measured).
- Local: check:bundle-budget, check:first-load-requests, check:chunk-cycles all pass. CI is the final word (local KB reads 0.2-0.4 above CI).
