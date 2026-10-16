# Handover: S0b core (`claude/org-r1-core`, ticket dt_1262ed1cd35c)

Brief: `arc/briefs-organiser-r1:docs/organiser-rebuild/briefs/S0b-core.md` (sha ad4ef2b). Base: `main` ecc3432.

## Done

| Pinned item | File(s) | Notes |
|---|---|---|
| 4.3 #3 Home jobs | `jobs/homeJobs.ts` | `JobKind`, `Job`, `homeJobs(home, requests, today)`, `seriesChip(series, today)` exactly as pinned. ONE private `seriesProblems()` + `problemLabel()` feeds both the Home row's `sub` and the chip, so a fact cannot read two ways. D37 order; `cancel` only when a live series has a scheduled upcoming date; problems by kind: `no_dates_left`, `join_request`, `stale_draft` (older than `STALE_DRAFT_DAYS = 7`, London calendar days from `created_at`), `no_cover`; paused/ended/archived never a problem row. No listed series means the first steps: `create_first_event` (gold), `add_cover`, `show_whatsapp`, `add_manager`. |
| 4.3 #4 Done | `flows/doneState.ts`, `flows/Done.tsx` | `DoneState { title, message, seriesId, next? }`, `goDone(navigate, state)`, `readDoneState`. One "Back to Home" button, plus "Put it back" (`NEXT_LABEL`) only when `next` is set (D61). No Undo. With no router state it goes Home (`Navigate replace`). **Not routed yet**: `ORG_PATHS.done` is S0a's route table; S0a/S1 mount `Done` (default export, lazy-ready). |
| 4.3 #5 date lists | `shared/dateList.ts` | `comingDates(series, today, limit = 14)` lists scheduled dates from today. `comingDays(series, today, days = 30, heldDates = [])` lists the next 30 days minus the days that already hold a date (scheduled or cancelled). `moreDatesCount()` gives "N more". `dayLabel()` gives "Friday 23 October". Everything is London wall clock (`addDaysToKey`, `weekdayOfKey`, `localAsZTime`). **Additive 4th arg** `heldDates`: `next_dates` carries only 3 dates, so a weekly series holds more days inside 30 than the home payload lists. S2/S3 must pass the workspace's dates (`useEventWorkspace`), or Add would offer a day that is already taken. |
| 4.3 #6 commands | `shared/seriesCommands.ts` | `occurrence.move_date` added to `OWNER_COMMAND_KINDS` + `SERVER_OWNER_KINDS` mirror. New: `moveDateCommand(toDate)`, `createDraftPayload(name, format)` (only `{name, format, timezone}`; `createSeriesCommand` adds `organiser_ids`, tested). `uncancelCommand` / `unskipDateCommand` / `lifecycleCommand({to})` documented per D46 / 4.11. |
| 4.3 #7 home_v1 v2 (Website half) | `shared/homeModel.ts` | `HomeSeriesFull` gains `default_cover_image_url`, `created_at`, `cancelled_upcoming_count`; `upcoming_count`/`next_dates` documented scheduled-only. `isListedSeries(s)` is THE archived predicate (used by homeJobs, dateList, attentionItems). `attentionItems` lost its review arms (rejected / in_review); it has no importer outside tests. |
| 4.3 #7 types regen | `src/integrations/supabase/types.ts` | **Unchanged, on purpose.** `organiser_home_v1` is typed `Returns: Json`, so v2's fields need no generated delta. `claude/org-r1-admin` does not exist yet (no A1a file to copy from, and A1a is not on the E2E project), so nothing new was regenerated. Re-run `npm run gen:types` against E2E after A1a lands (for A1's NEW RPCs such as the team browse). |
| 4.3 #8 support | `shared/support.ts` | `supportLinks()` reads `VITE_SUPPORT_WHATSAPP` / `VITE_SUPPORT_EMAIL`. A missing, blank or malformed value (not `https://wa.me/...` style, not an address) gives null, so the row hides (D7). |
| 4.3 #9 copy | `shared/copy.ts` | `WARN_DATE`, `WARN_END`, `VERSION_CONFLICT`, `handOverWarning()` (D14 verbatim). `VERSION_CONFLICT` is wired into `selfServeErrors.ts` `COMMAND_COPY` for `version_conflict` (R3-7). |
| 4.3 #11 runCommands | `shared/runCommands.ts`, `events/eventsApi.ts` | `useRunCommands`, `useEventWorkspace` (+ `eventWorkspaceQueryKey`, `fetchEventWorkspace`, which they need; keeping them in eventsApi would be a circular import) moved with identical bodies; eventsApi has ONE re-export line and lost only the moved code and its now-unused imports. Identity test: `eventsApi.useRunCommands === runCommands.useRunCommands`. |

## LEFT: the review-era strip (needs the orchestrator; blocked by file ownership)

The brief asks S0b to strip review copy from `organiserStatus.ts`, `createModel.ts`, `selfServeErrors.ts`, to drop `submitForReviewCommand`, and to DELETE `shared/useSendForReview.ts`. I made that strip and tested it, then **took it back out of the branch**, because it breaks files that other slices own and delete:

- `useSendForReview` is imported by `home/OrganiserStatusCard.tsx` (S1), `profile/ReviewCard.tsx` (S7). `submitForReviewCommand` by `events/ReviewCard.tsx` (S5).
- `organiserStatus().canSendForReview/sendLabel` by `home/OrganiserStatusCard.tsx` (S1), `events/NewEventPage.tsx` (S4), `profile/reviewModel.ts` (S7); `followUpCommands(form, submit)` by `NewEventPage` (S4).
- Tests that pin the old flow: `__tests__/draftOrganiser.matrix.test.tsx`, `home/__tests__/*`, `profile/__tests__/*`, `events/__tests__/pages.test.tsx` (G1).

With the strip in, typecheck and about 10 test files went red (measured: "Failed to resolve import .../useSendForReview"). Waves 2-5 are cut from `feat/organiser-r1` AFTER S0b merges, so every later slice would start on a red tree.

**The strip is ready as a patch**: `docs/organiser-rebuild/handovers/S0b-review-strip.patch` (9 file diffs, tested green in isolation for `shared/**`). `submitForReviewCommand` stays for now, marked `@deprecated` and pointing at the patch.

**Ask (pick one):** (a) apply the patch on `feat/organiser-r1` right after S1 + S4 + S5 + S7 have merged (`git apply docs/organiser-rebuild/handovers/S0b-review-strip.patch`, then `npm run test:unit`), or (b) let S5 (the last slice to delete a review importer) apply it in its PR.

## Exact next steps
1. Orchestrator: merge S0a (`claude/org-r1-shell`) first. This branch imports `ORG_PATHS.change/add/cancel/addEvent/event/cover/newWhat/page/team/teamAdd/home/done/cancelDate` from S0a's `shell/paths.ts`, so on `main` alone `npm run typecheck` fails on exactly those keys (expected per brief 4.3 #3).
2. After A1a reaches the E2E project: `npm run gen:types`, commit the delta, and confirm `organiser_home_v1` sends `created_at` + `cancelled_upcoming_count` + scheduled-only counts (the client already reads them; missing fields degrade to "no problem rows" for drafts, and `cancelled_upcoming_count` is not read by homeJobs).
3. `show_whatsapp`: `organiser_home_v1` returns no WhatsApp field (prod `pg_proc` read 2026-10-16: no `whatsapp` key in its body, none on `organisers`). The step reads an optional `whatsapp_url` and shows until the server sends it. A1 or S7 decides the source.
4. The review strip (above).
5. S8 inherits `shared/__tests__/copy.test.ts` `importSites()`: it counts `WARN_DATE`/`WARN_END`/`handOverWarning` importers (0 today; assert `=== 1` once S3/S5/S6 land).

## Decisions taken inside the pins (flag if wrong)
- `change` and `add` show whenever the page has a listed series; only `cancel` is conditional (pin text). A page of drafts only still sees "Change a date".
- `join_request`: one row per open request, title "Wants to join", sub = the requester's email, `to` = `ORG_PATHS.team` (S6 owns the C16 route; repoint when it exists).
- `stale_draft` goes to `ORG_PATHS.event(id)`. `no_dates_left` goes to `ORG_PATHS.addEvent(id)` (C15 = Add with the event chosen). `no_cover` goes to `ORG_PATHS.cover(id)`. `add_cover` and `show_whatsapp` go to `ORG_PATHS.page`.
- If a series has both no dates and no cover, both rows show on Home and the chip shows the first one ("Needs dates").
- Chip labels: Live (ok), Needs dates / Needs a cover / Draft, N days (older than 7: bad), Draft / Draft, 1 day / Draft, N days (n), Paused, Ended (n).

## RED first (values, not module-not-found)

Run 1 (no modules): only "Failed to load url ../homeJobs" (which, per 4.11, proves nothing). Run 2, against empty stubs (`homeJobs` returns `[]`, `seriesChip` returns `{label:'',tone:'n'}`, `supportLinks` returns `'x'`, `Done` renders null):
```
Tests  42 failed | 11 passed (53)
AssertionError: expected { label: '', tone: 'n' } to deeply equal { label: 'Draft, 9 days', tone: 'bad' }
AssertionError: expected { label: '', tone: 'n' } to deeply equal { label: 'Needs dates', tone: 'bad' }
AssertionError: expected undefined to deeply equal { kind: 'no_cover', n: 4, ... }
AssertionError: expected undefined to deeply equal { kind: 'join_request', n: 4, ... }
AssertionError: expected undefined to be 'create_first_event'
AssertionError: expected { whatsapp: 'x', email: 'x' } to deeply equal { whatsapp: null, email: null }
seriesCommands mirror: expected [ 'occurrence.cancel', ...(11) ] to deeply equal [ 'occurrence.cancel', ...(12) ]
```

### One mutation per rule (each applied alone, suite run, reverted)
```
stale 7->6 days: 1 failed | 33 passed
cancel shown without a scheduled date: 2 failed | 32 passed
no_dates_left counts cancelled (R3-3): 2 failed | 32 passed
archived predicate off (R3-4): 2 failed | 38 passed
paused listed as a problem (D6): 1 failed | 33 passed
no_cover rule dropped: 5 failed | 29 passed
consumer half away: Home row stops using the shared label: 5 failed | 29 passed
chip half away: chip ignores the problems: 9 failed | 25 passed
D37 order: join before no dates: 6 failed | 28 passed
first step does not drop off (photo): 1 failed | 33 passed
comingDays keeps taken days: 3 failed | 4 passed
comingDates keeps cancelled: 1 failed | 6 passed
version_conflict copy unwired (R3-7): 1 failed | 2 passed
support: dead link allowed (D7): 1 failed | 2 passed
Done: no-state reload stays: 1 failed | 3 passed
move_date dropped from the mirror: 1 failed | 15 passed
createDraftPayload sends a start date: 1 failed | 3 passed
```

## Real-data shape survey (prod `stsdtacfauprzrdebmzg`, read-only, counts only, 2026-10-16)
Non-archived series 92. Live with 0 scheduled coming dates: **16**, of which 1 has only cancelled coming dates (R3-3 row). Live with 14+ scheduled: 30. Live with no cover: 0. Drafts older than 7 days: 4; 7 days or newer: 1. Each shape is a matrix row in `jobs/__tests__/homeJobs.matrix.test.ts`; the clock is frozen at 2026-10-20 so fixtures straddle 2026-10-25 (R3-18).

## CI, run in the sandbox (per job)

CI_TABLE

## Verified / Not verified
CI_VERIFIED
