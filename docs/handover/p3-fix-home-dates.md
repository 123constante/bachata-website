# Handover: p3-fix-home-dates (FIXLIST F-16, F-27)

Branch `claude/p3-fix-home-dates`, ticket dt_0d3125ed3faa. Brief: `docs/briefs/p3-fix-home-dates.md` on `brief/p3-fix-home-dates`.

## Done

**F-27 DATES-100 -- fixed.**
- Live RPC body read (prod `stsdtacfauprzrdebmzg`, read-only): `admin_event_workspace_p5(p_series_id uuid, p_before date, p_limit int)`.
  `p_before` = dates strictly older, newest first; `p_limit` 1..200 (NULL = 100); `meta.has_more`, `meta.next_before`
  (the page's oldest date), `meta.total`, `meta.counts {upcoming, past, cancelled, changed, breaks}` over the whole series
  (table `event_occurrence_p5`, `event_series_p5.removed_dates`).
- `events/eventModel.ts` keeps `meta.counts` (`dateCounts`) and `meta.next_before` (`nextBefore`), both optional.
- `p3/data/olderDates.ts` (new): reads every older page at p_limit 200 until has_more is false; `withOlder` merges.
- `p3/data/dates.ts` `allDatesOf` counts: when the read is partial, Past = `meta.total` - stored coming dates + past
  breaks; Cancelled = `meta.counts.cancelled`; Own changes shows "N+" (server `changed` does not count own time).
- `AllDatesScreen.tsx`: note "Showing the newest 100 of 132 dates. Tap "Load older dates" to see the other 32." and
  a Load older dates button; error state with Try again.
- Test `p3/screens/__tests__/allDates100.matrix.test.tsx`: shapes 0, 1, 57 future, exactly 100, 101, 132 against a
  server emulator; partial counts equal full counts; 657-date paging at 200. Red on unfixed code:
  `132 (prod largest): expected [ 'past', 43 ] to deeply equal [ 'past', 75 ]`.

**F-16 HOME-COPY -- mapping landed, Home wiring LEFT FOR THE LEAD.**
- `p3/model/status.ts` `nextUpAdviceOf(rows)` -> `{ copy, action: 'events' | 'new' }` (live weekly without dates ->
  Events + add dates; draft / paused / review -> Events; live-past one-off or course -> Events, "cannot take new
  dates"; all ended -> Add an event). Test `p3/model/__tests__/nextUpAdvice.matrix.test.ts`.
- Why not wired: `p3/screens/__tests__/screens.matrix.test.tsx:96` (owned by open PR #1208) pins the buggy copy
  (`/Add dates/` for every live row, Events href always). Changing Home turns it red.
- Ready patch: `docs/handover/p3-fix-home-dates-F16-wiring.patch` (HomeScreen + screens.matrix edit + render matrix
  `homeNextUp.matrix.test.tsx`). Verified locally: with it applied, all 613 p3 screen tests pass; without the Home part
  the render matrix is red (`live-past one-off: expected 'Nothing coming upNone of your live ev...' to match /cannot take new dates/`).
  Apply after #1208 merges: `git apply docs/handover/p3-fix-home-dates-F16-wiring.patch`.

## Not verified
- Browser walk at 390x844 with ACCOUNTS.md accounts (no sign-in available to this worker); no screenshots.
- No e2e added (no new sheet). Bundle budget run on the branch only (green, dancer-app 371.8/374 KB), not on main.
- Door tests need `jsqr` in node_modules (`npm ci`); unrelated to this branch.

## Next steps
1. Lead dispatches the one independent review, then one fix round.
2. After #1208 merges: apply the F-16 patch, run `npx vitest run src/modules/organiser/p3`.
3. Walk All dates on the 132-date prod series and Home on a live-past one-off account at 390x844.

## Round r2 (ticket dt_477c630de496)

Done: F1 (older-read error note), F2/F3 (copy, tests, patch), F6 (50-page guard shows no button), F7 (comment). F4/F5/F8 are PR-body only.
Gates: typecheck 101 errors (baseline 106, none in touched files); lint 24/24; organiser vitest 222 files / 8435 passed; patch `git apply --check` exit 0 on main and on p3-create-event-build; build + bundle budget green (dancer-app 371.8 KB / 47 files).
Left: lead browser walk at 390x844; apply the F-16 wiring patch after #1208 merges.
