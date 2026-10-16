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
Non-archived series 92. Live with 0 scheduled coming dates: **16**, of which 1 has only cancelled coming dates (R3-3 row). Live with 14+ scheduled: 30. Live with no cover: 0. Drafts stale by the code's rule (more than 7 London calendar days since `created_at`): **2**; exactly 7 days (on the boundary, not stale): 2; younger: 1 (reviewer's measured figure, REVIEW-S0b NOTE-2; the earlier "4" used an interval rule). Organisers whose non-archived series are all paused/ended: **2**; organisers with drafts and no live series: **1** (counts from REVIEW-S0b). Each shape is a matrix row in `jobs/__tests__/homeJobs.matrix.test.ts`; the clock is frozen at 2026-10-20 so fixtures straddle 2026-10-25 (R3-18).

## CI, run in the sandbox (per job)

Run on this branch + S0a's `shell/paths.ts` laid over the tree (uncommitted; the state the orchestrator merges into), 2026-10-16, Node in the cloud sandbox. Then the reds re-checked on this branch alone.

| Workflow / job | Command | Exit | Notes |
|---|---|---|---|
| typecheck | `npm run check:rpc-typing` | 0 | |
| typecheck | `npm run check:wallclock-brand` | 0 | |
| (not a CI step) | `npm run typecheck` (tsc) | 2 | ~97 errors pre-exist on `main` (app/, calendar, DancerDashboard...). After the fix commit, files touched here: **0 errors with S0a's paths.ts**; on this branch alone only the missing `ORG_PATHS` keys (S0a). |
| architecture-guard | `bin/check-integrity.sh` | 126 | sandbox: the script is not executable in this checkout (CI runs `chmod +x bin/*.sh` first). Not a code failure. |
| architecture-guard | `npm run check:legacy-tables` | 0 | |
| architecture-guard | `npm run check:legacy-program-rpcs` | 0 | |
| architecture-guard | `npm run lint:architecture` | 1 then **0** | 2 violations in `seriesCommands.r1.test.ts` (spelled the organiser key). Fixed in the final commit (key assembled, as createModel.test.ts does); re-run: passed. |
| architecture-guard | `AUDIT_STRICT=1 npm run check:images` | 0 | |
| unit-tests | `npm run check:dancer-area-isolation` | 0 | |
| unit-tests | `npm run test:unit` | 1 | 31 failed / 8556 passed. NONE in a file touched here: 13 are live-DB contract tests (`eventViewCompat`, `occurrenceProgram`, `publicEventPageLineup`; CI runs the offline arm without secrets), 5 `integrityCouldNotRun` (sandbox env), 16 `shell.test` + `account.today` that fail ONLY with the S0a overlay on main's shell (both pass, 47/47, on this branch as committed). |
| unit-tests | `npm run test:unit:timing` | 0 | |
| unit-tests | `npx vitest run src/modules/organiser` (branch alone) | 1 | 12 failed / 3201 passed: `homeJobs.matrix` (9) and `Done` (3) read `ORG_PATHS.change/add/cancel/done/...`, which only S0a defines. With S0a's paths: 631/631 in jobs/flows/shared. |
| perf-budget | `npm run build` | 0 | production build |
| perf-budget | `npm run check:bundle-budget` | 0 | |
| perf-budget | `npm run check:first-load-requests` | 0 | |
| perf-budget | `npm run check:chunk-cycles` | 0 | |
| perf-budget (lighthouse) | `check:lighthouse`, `check:doc-weight` | not run | needs a browser + preview server pass; nothing here is routed yet (Done is not mounted). |
| lint chain | `npm run lint` | 1 | 2 of 18 links: `check:integrity` (126, sandbox, see above) and `lint:architecture` (fixed, see above). The other 16 PASS. |
| e2e-smoke | `npm run test:e2e` | 1 | 145 passed, 3 failed with the overlay (`organiser-loop`, `dancer-home` "I organise events", `dancer-app/home-nights`). On this branch alone the same 3 specs: **20/20 passed**. |
| types-drift | `npm run gen:types` | not run | no Supabase access token in the sandbox; `types.ts` is unchanged here (see Done table). |
| real-data-verified / phone-qa | PR-body checks | n/a | no PR opened by this worker. |


## Verified / Not verified
**Verified:** every pinned S0b interface is implemented, with tests that are table-driven over the prod shapes (survey above) and a frozen clock straddling 25 October. The tests were red on values first, and each of 17 per-rule mutations turns them red. The production build and the perf budgets pass. The `eventsApi` re-export keeps S2/S3/S5 importers working (identity test).

**Not verified:**
- Done is not mounted on a route, so there was no browser walk at 390x844. S0a/S1 mount it.
- No real-RPC run against the E2E project. A1a is not applied there; `claude/org-r1-admin` does not exist yet.
- `organiser_home_v1` v2 fields (`created_at`, `cancelled_upcoming_count`, scheduled-only counts) are typed on the client but not yet sent by the server.
- `types.ts` was not regenerated.
- The review-era strip is NOT on this branch; it is a ready patch (see LEFT).
- No real phone.
- Vercel: not touched (nothing to deploy from a slice branch).

## F-S0b fix pass (ticket dt_8a2e7f9f3cd3)

Changes: `jobs/homeJobs.ts` (Change/Add rule, SHOULD-1), `jobs/__tests__/homeJobs.matrix.test.ts` (rows updated + three new rows, SHOULD-2), `shared/support.ts` + `shared/__tests__/support.test.ts` (bare `https://wa.me/` rejected, NOTE-5), this file (NOTE-2 figure). Owner-default decisions (orchestrator): (1) `change` only when a LIVE series has a scheduled upcoming date (same test as `cancel`); (2) `add` only when a LIVE or DRAFT series exists; (3) when neither shows, the four first steps, dropping off by their own rules; (4) `no_dates_left`, `join_request`, `stale_draft`, `no_cover` keep D37 order, unaffected.

What the rule gives (asserted exactly, kinds + titles + sub + `to` + tone, clock frozen 2026-10-20, dates straddle 2026-10-25, chip asserted from both sides):
- drafts only (9 days + 2 days; prod 1 org): `1 add`, `2 stale_draft "Old draft" / "Draft, 9 days" -> ORG_PATHS.event(id)`. No change, no cancel, and NO first steps, because `add` shows (decision 2 + 3). Chips: "Draft, 9 days" bad, "Draft, 2 days" n.
- paused + ended only (prod 2 orgs): the four first steps (New event, Add a photo, Show your WhatsApp, Add a manager). Chips Paused / Ended, n.
- paused + one live with a scheduled date: change, add, cancel as before. Chips Paused n, Live ok.
- Changed old rows: live with 0 scheduled and live all-cancelled now give `add, no_dates_left` (no Change: there is no scheduled date to change). The paused+ended row at the old :146 now asserts no problem rows; the exact first-steps expectation is the new row.

RED first (old code, new tests): 5 failed / 36 passed in `npx vitest run src/modules/organiser/jobs src/modules/organiser/shared/__tests__/support.test.ts`:
```
live with 0 scheduled upcoming -> add + no_dates_left ...   expected [ [ 1, 'change', ...(4) ], ...(2) ] to deeply equal [ ...(2) ]
all upcoming cancelled -> no_dates_left                     expected [ 'change', 'add', 'no_dates_left' ] to deeply equal [ 'add', 'no_dates_left' ]
drafts only (one 9 days, one 2 days) -> add + stale_draft    received [1,"change","Change a date",undefined,"/account/o/change","plain"], [2,"add",...], [3,"stale_draft","Old draft","Draft, 9 days",...]
paused + ended only -> the four first steps                  received [1,"change","Change a date",...], [2,"add","Add a date",...]; expected create_first_event, add_cover, show_whatsapp, add_manager
supportLinks: wa.me with no number                          expected { whatsapp: 'https://wa.me/', ...(1) } to deeply equal { whatsapp: null, ...(1) }
```
After the fix: 36 files / **635 passed**.

Mutation: only the new `change` condition reverted (`if (hasComingDate)` removed before the change push) -> 3 failed / 632 passed: "live with 0 scheduled", "all upcoming cancelled", "drafts only" (all `expected [ [ 1, 'change', ...`). The paused+ended row stays green under this one mutant because it is guarded by the fallback branch (neither change nor add); it goes red against the old code (above). Restored after.

CI steps in the sandbox, S0a `shell/paths.ts` overlaid (not committed):

| Job | Command | Exit | Note |
|---|---|---|---|
| slice tests | `npx vitest run src/modules/organiser/jobs src/modules/organiser/shared src/modules/organiser/flows` | 0 | 36 files, 635 passed |
| eslint (changed files) | `npx eslint src/modules/organiser/jobs src/modules/organiser/shared/support.ts src/modules/organiser/shared/__tests__/support.test.ts` | 0 | |
| integrity | `npm run check:mojibake` | 0 | |
| lint chain | `npm run lint` | 1 | 17/18 PASS; the red is `check:integrity` exit 126, ENVIRONMENTAL (file mode 100644 in git; `bash bin/check-integrity.sh` exits 0) |
| typecheck | `npm run typecheck` | 2 | 97 errors, same count as the review; none in `jobs/` or `shared/support*` (pre-existing on main + the `shell/tabs.ts` overlay artefact) |
| perf-budget (build) | `npm run build` | 0 | production build + prerender ok |

Not run: full `npm run test:unit` (unchanged files; review table stands), `test:e2e`, Lighthouse, a browser walk (Home is not mounted in this slice), a real phone, GitHub Actions. Not verified against the E2E project.
