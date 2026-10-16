# REVIEW-S0b -- independent review of slice S0b (core)

Reviewer brief: `arc/briefs-organiser-r1:docs/organiser-rebuild/briefs/R-S0b.md` (sha f863e65). Ticket dt_90e703256bec.
Slice reviewed: `origin/claude/org-r1-core` @ `2275cdd` (base `main` ecc3432). One pass, effort xhigh. Reviewer changed no source file.
S0a's `shell/paths.ts` (`origin/claude/org-r1-shell`) laid over the tree for every run below, never committed.

## Verdict: 0 BLOCKING / 2 SHOULD / 9 NOTE

Every pinned interface (4.3 #3 #4 #5 #6 #8 #9 #11, Website half of #7) is implemented as pinned, the moved code is byte-identical, no protected file is touched, and all seven requested mutants turn the suite red. The two SHOULDs are about prod shapes that get a "Change a date" row with nothing to change behind it.

## Findings

### SHOULD-1 -- "Change a date" / "Add a date" offered when no series can take the job
- `src/modules/organiser/jobs/homeJobs.ts:102-103` shows `change` and `add` whenever the page has ANY non-archived series. A page whose series are all paused/ended (prod: **2 organisers**) or drafts only (prod: **1 organiser**) gets "1 Change a date, 2 Add a date" and no first steps. Paused/ended are server-locked (D6), so the Change list behind row 1 is empty: copy that points at a control that is not there (CLAUDE.md definition of done, 4.5 Consistency). The test pins this behaviour: `jobs/__tests__/homeJobs.matrix.test.ts:146` expects `['change', 'add']` for a paused+ended page.
- Why SHOULD, not BLOCKING: the pin text lists `change`/`add` unconditionally ("only `cancel` is conditional"), and the author flagged the reading. It is an owner/orchestrator call.
- Fix (one sentence): show `change` only when a live series has a scheduled upcoming date (the same test as `cancel`), `add` only when a live or draft series exists, and fall back to the first steps when neither holds, with the test at :146 updated to that expectation.

### SHOULD-2 -- no matrix row for a draft-only page (prod shape)
- `jobs/__tests__/homeJobs.matrix.test.ts`: the stale-draft rows (:99-110) put the drafts beside a live series (the stale row sits at index 3, after change/add/cancel). Prod has 1 organiser whose non-archived series are drafts (plus paused/ended) with no live one. No row asserts what that page sees.
- Fix: add a row "drafts only (one 9 days, one 2 days)" asserting the exact kinds/labels/`to`, decided together with SHOULD-1.

### NOTE-1 -- pinned type name `AccessRequest` does not exist
`homeJobs.ts:96` takes `IncomingAccessRequest[]` (`shared/teamModel.ts:87`), the type `fetchIncomingAccessRequests` returns. The pin's `AccessRequest` is not a type in the module (grep: only `MyAccessRequest` and `IncomingAccessRequest`). Correct choice; the orchestrator should amend the pin text for S1.

### NOTE-2 -- the handover's "drafts older than 7 days: 4" does not match the code's rule
The code counts London calendar days and lists a draft when age > 7. Prod today (London calendar days since `created_at`, non-template drafts): age 5:1, 7:2, 8:1, 23:1, so **2** drafts are stale by the code's rule, 2 sit exactly on the boundary. The author's 4 matches an interval rule (`now() - created_at > 7 days`). The code is right per pin; both shapes have rows (9 days, exactly 7 days at :107). Fix: correct the number in `handovers/S0b.md`.

### NOTE-3 -- `cancel` and `no_dates_left` rely on home_v1 v2 being on prod first
`homeJobs.ts:39` and `:104` read `upcoming_count` as scheduled-only (R3-3). Prod's current `organiser_home_v1` still counts cancelled dates, so until A1a is on prod the 1 live series with only cancelled coming dates would show "Cancel a date" and no `no_dates_left`. Correct per pin; it makes "A1a on prod before this UI ships" a hard deploy gate (R3-14). No code change.

### NOTE-4 -- `comingDays` default `heldDates = []` is wrong for weekly series
`shared/dateList.ts:67`: with the pinned 3-argument call, only `next_dates` (3 dates) are excluded, so a weekly series offers already-held days 22-30 days out. The author documents it; S2 (Move) and S3 (Add) briefs must say "pass the workspace's dates as `heldDates`". Orchestrator action, not a code change.

### NOTE-5 -- `supportLinks` accepts a WhatsApp URL with no number
`shared/support.ts:5`: `https://wa.me/` (bare) passes the regex (probe: `{"whatsapp":"https://wa.me/"}`). Fix: require a path segment after the host (`/[^\s/]+`).

### NOTE-6 -- `show_whatsapp` never drops off
`homeJobs.ts:84-85` reads a `whatsapp_url` that `organiser_home_v1` does not send, so every brand-new page keeps the step forever. Flagged by the author; A1 or S7 must name the source.

### NOTE-7 -- the `next` button's words are fixed
`flows/doneState.ts:17` `NEXT_LABEL = 'Put it back'` for ANY `next`. Right for R1 (one user, D61); a second user of `next` would show wrong words. If that ever happens, add `nextLabel` to `DoneState`.

### NOTE-8 -- `shared/runCommands.ts` imports an S5-owned file
`shared/runCommands.ts:5` imports `parseEventWorkspace`/`EventWorkspace` from `events/eventModel.ts`, which S5 owns. S5 must keep those two exports (no cycle today: eventModel does not import eventsApi/runCommands).

### NOTE-9 -- small items
- `events/eventsApi.ts:13` re-exports 4 names (also `eventWorkspaceQueryKey`, `fetchEventWorkspace`), not 2: needed, since the moved hooks use them and leaving them would make a cycle. Nothing else changed in the file (diff read: one line added, moved code and its now-unused imports removed).
- `copy.test.ts:38` asserts `<= 1` import site; S8 must tighten to `=== 1`. A re-export through a barrel would evade the regex.
- `selfServeErrors.ts:283` keeps a second `version_conflict` mapping (`PROGRAMME_VERSION_CONFLICT`, the event-truth programme editor, pre-existing on main). Not an R1 write screen, so R3-7 is met; flagged so S8's copy scan does not count it as a second R1 sentence.
- `src/integrations/supabase/types.ts` not regenerated: `organiser_home_v1` is `Returns: Json`, so v2 needs no delta. Accepted.

## Checks against the brief (command, result)

1. **Files touched** -- `git diff --name-only origin/main...origin/claude/org-r1-core`: 24 paths, all in the S0b Owns row, their tests, the handover and the strip patch. Protected grep (accountGate, account*, keyboard*, event-page, vite.config, calendar, scripts/check-*, db-contract-check, AnimatedRoutes, the 4.11 read-only shared files) -> no hit (grep exit 1). `events/eventsApi.ts`: one re-export line + removal of the moved code and its imports (`useQueryClient`, `ORGANISER_HOME_KEY`, `runSeriesCommand`, `seriesWorkspaceQueryKey`, `envelope`, `OwnerCommand`, `parseEventWorkspace`).
2. **4.3 #3** -- `JobKind`, `Job`, `homeJobs`, `seriesChip` match the pin (bar NOTE-1). ONE private mapping: `seriesProblems()` + `problemLabel()` (`homeJobs.ts:31, 52`) feed both the Home row `sub` and the chip; the labels "Needs dates", "Needs a cover", "Draft, N days" exist once (grep). D37 order: change, add, cancel, no_dates_left, join_request, stale_draft, no_cover (`:102-114`). `cancel` only with a live scheduled upcoming date (`:104`). Archived: `isListedSeries` (`homeModel.ts:47`) used in `homeJobs`, `seriesProblems`, `comingDates`, `attentionItems`. Paused/ended: never a problem row (`:37`). Stale: `> 7` London calendar days from `created_at` via `londonDateKey` + `londonDaysBetweenKeys` (UTC-noon key arithmetic). BST probe, today 2026-10-27 (GMT): created `2026-10-19T23:30Z` (London 20 Oct) -> "Draft, 7 days" (n); created `2026-10-19T22:59Z` (London 19 Oct) -> "Draft, 8 days" (bad). Correct. No listed series -> the four first steps (`:78-88`).
3. **4.3 #4** -- `DoneState {title, message, seriesId, next?}`, no `undo`. `Done.test.tsx`: one button "Back to Home"; two with `next`; no "undo" text; reload with no state -> `ORG_PATHS.home`. Every on-screen word names a control on screen.
4. **4.3 #5** -- `dateList.ts` uses only key helpers (`addDaysToKey`, `weekdayOfKey`) and `localAsZTime` (regex on the string). No `toISOString`, `getTimezoneOffset`, `Date.parse` (grep). Full weekday and month names. Probe from 2026-10-20 for 30 days: 30 rows, 30 distinct, "Sunday 25 October" once. Fixtures frozen 2026-10-20, straddling 25 Oct.
5. **#6/#8/#9** -- `occurrence.move_date` in `OWNER_COMMAND_KINDS` (`seriesCommands.ts:19`) and the mirror (`seriesCommands.test.ts:41`). `createDraftPayload` returns only `{name, format, timezone}` (4.11: `organiser_ids` added by `createSeriesCommand`, as for `createPayload`). `supportLinks` null for missing/blank/malformed (bar NOTE-5). Copy: `grep -cF` of each pinned sentence in `copy.ts` = 1 each (verbatim, D14 template included). `VERSION_CONFLICT` wired at `selfServeErrors.ts:132`. Added lines with non-ASCII bytes: 0. `npm run check:mojibake`: exit 0.
6. **runCommands** -- bodies of `eventWorkspaceQueryKey`, `fetchEventWorkspace`, `useEventWorkspace`, `useRunCommands` identical to the lines removed from main's `eventsApi.ts` (diff read side by side). Identity test `runCommands.test.tsx:23-24` uses `toBe` on the re-export, so a second copy fails it.
7. **Review strip** -- `git apply --check docs/organiser-rebuild/handovers/S0b-review-strip.patch`: exit 0 (whitespace warnings only: the deleted file is CRLF). Applied for real: `npx vitest run src/modules/organiser/shared` 34 files / 592 tests passed; afterwards no `useSendForReview` / `submitForReviewCommand` / "Send for review" left in the four owned files (2 comment-only mentions of `pending_review`, allowed by 4.11). Reversed cleanly. `submitForReviewCommand` carries `@deprecated` pointing at the patch (`seriesCommands.ts:241-244`).

## Mutation evidence (each alone, `npx vitest run src/modules/organiser/jobs src/modules/organiser/shared src/modules/organiser/flows`, reverted with `git checkout` after each)

Baseline: 36 files, **631 passed**.

| # | Mutant | Result |
|---|---|---|
| a | `STALE_DRAFT_DAYS = 6` | 1 failed: "a draft exactly 7 days old is not stale yet" `expected ['change','add','cancel',...(1)] to deeply equal ['change','add','cancel']` |
| b | `upcoming_count + cancelled_upcoming_count <= 0` | 2 failed: "all upcoming cancelled -> no_dates_left" `expected ['change','add'] to deeply equal ['change','add','no_dates_left']`; chip "live, all cancelled" `expected {label:'Live'} to deeply equal {label:'Needs dates'}` |
| c | `const listed = home.series` (archived filter off) | 1 failed: "a page holding only archived series gets the first steps" `expected 'change' to be 'create_first_event'` |
| d | chip: `const [first]: SeriesProblem[] = []` | 9 failed, e.g. "live, no cover" `expected {label:'Live',tone:'ok'} to deeply equal {label:'Needs a cover',tone:'bad'}` |
| e | `comingDays` drops `...heldDates` | 1 failed: "also skips the days the workspace holds past the first three" `expected ['2026-11-10','2026-11-17'] to deeply equal []` |
| f1 | `occurrence.move_date` removed from the test mirror | 1 failed: "matches the server constants exactly" `expected [...(12)] to deeply equal [...(11)]` |
| f2 | `occurrence.move_date` removed from `OWNER_COMMAND_KINDS` | 1 failed: same test, `(11)` vs `(12)` |
| g | `supportLinks`: `return v ? v : null` | 1 failed: "a value that is not a link or an address is treated as absent" `expected {whatsapp:'call Ricky',...}` |

No mutant survived. Note for (c): the 45/40 matrix row stays green under this mutant because `seriesProblems` also filters archived; the archived-only row is what catches it.

## Real-data shapes (prod `stsdtacfauprzrdebmzg`, SELECT only, counts only, 2026-10-16 ~14:50 UTC)

One aggregate over non-template `event_series_p5` x `event_occurrence_p5` (London today): non-archived **92** (live 66, ended 20, draft 5, paused 1); live with 0 scheduled coming dates **16**; of those, cancelled-only **1**; live with no cover **0**; drafts older than 7 London days **2** (see NOTE-2); organisers whose non-archived series are all paused/ended **2**; organisers with drafts but no live series **1**.

| Prod shape | Matrix row |
|---|---|
| live, 0 scheduled (16) | :82 |
| live, all coming cancelled (1) | :92 + chip |
| draft > 7 days (2) / exactly 7 (2) / younger (1) | :99, :107, chip rows :161-164 |
| live no cover (0 today) | :112 |
| paused/ended | :143 (pins SHOULD-1 behaviour), chip :165-166 |
| page with paused/ended only (2 orgs) | :143 (same; see SHOULD-1) |
| page with drafts, no live (1 org) | **no row** (SHOULD-2) |
| 45 series, 40 archived (R3-4) | :136 |

## CI job steps in the sandbox (S0a paths overlaid)

| Job | Command | Exit | Note |
|---|---|---|---|
| typecheck | `npm run typecheck` | 2 | 97 errors, none in a slice file. 96 are on files the slice does not touch (pre-existing on main: DancerDashboard, app/routes, calendar, `edit-in-place/__tests__/TeamPicker.test.tsx`...). 1 is `shell/tabs.ts` reading `ORG_PATHS.profile`, an overlay artefact (S0a deletes `tabs.ts`). Bare branch (no overlay): 122 errors = the same 96 + exactly 26 "missing key" errors on `ORG_PATHS` (done, cancelDate, newWhat, page, teamAdd, change, add, cancel, addEvent, cover) in `homeJobs.ts`, `doneState.ts` and their tests: EXPECTED. |
| unit-tests | `npm run test:unit` | 1 | 31 failed / 8556 passed (348 files), NONE in a file the slice touches. 16 = `organiser/__tests__/shell.test.tsx` (6) + `regression/today/account.today.test.tsx` (10): overlay artefacts (main's shell under S0a's paths); on the bare branch both files pass, 47/47. 10 = live-DB contract tests (`eventViewCompat`, `occurrenceProgram`, `publicEventPageLineup`): "Invalid API key" in the sandbox. 5 = `integrityCouldNotRun`: sandbox environment. |
| slice tests | `npx vitest run src/modules/organiser/jobs src/modules/organiser/shared src/modules/organiser/flows` | 0 | 36 files, 631 passed |
| lint chain | `npm run lint` | 1 | 17 of 18 links PASS, incl. `lint:architecture` (the earlier violation is fixed). The one red is `check:integrity` exit 126: ENVIRONMENTAL. Proof: `git ls-files -s bin/check-integrity.sh` -> mode `100644` (same on main); `architecture-guard.yml:38` runs `chmod +x bin/*.sh` first; `bash bin/check-integrity.sh` -> exit 0. |
| perf-budget | `npm run build` | 0 | production build, prerender ok |
| integrity | `npm run check:mojibake` | 0 | 1410 files, no cp1252 corruption |

## Verified
- Pinned interfaces, the one shared mapping, archived predicate usage, BST-edge day counting, London wall-clock date lists, verbatim copy, the command mirror, the byte-identical move, the strip patch applying and passing: read and run, outputs above.
- All 7 requested mutants (8 with f2) turn the suite red.
- Prod survey numbers 92 / 16 / 1 confirmed; drafts differ (NOTE-2).

## Not verified
- No browser walk at 390x844: Done is not mounted on a route in this slice.
- No run against the E2E project (A1a not applied there); home_v1 v2 fields are typed but not yet sent by any server.
- `test:e2e`, Lighthouse, `gen:types` (no Supabase access token in the sandbox), Vercel: not run.
- The strip patch was tested on `shared/**` only; the importer slices (S1, S4, S5, S7) are not merged, so the whole-tree result after the patch is not known.
- No real phone.
