# REVIEW-S5 -- independent review of slice S5 (My events, one event, Details, pause / end / repeats / put back)

Reviewer worker, ticket dt_3bfe3226ff8d, brief `briefs/R-S5.md` (sha 12276311). Slice branch
`claude/org-r1-events` @ **5bb70a1** (PR #811), base `claude/org-r1-integrate` @ fe2de2b. One pass;
findings go back to the S5 slice in one fix pass. I changed no source file.

## Verdict: 0 BLOCKING / 3 SHOULD / 7 NOTE

The pinned interface holds: every action sends exactly ONE command of the pinned kind with
`expected_version`, an untouched Save sends nothing, the course rows are disabled with the reason,
`WARN_END` has one importer, there is no Undo, and the chip is Home's own mapping. All six mutations
went red. The SHOULDs are a latent data-loss path at the 100-row read cap, an empty state on the
ended shape (20 prod series) that says nothing the person can do, and an untested venue write.

## Findings

### SHOULD-1 -- Stop repeating builds its keep list from a read that holds only the NEWEST 100 dates
`src/modules/organiser/events/eventModel.ts:338` (`stopKeepingCommand`), also `flows/event/EventStep.tsx:54`
and `flows/event/EndStep.tsx:20` (the counts).
- **Why:** `admin_event_workspace_p5` (prod source, read 2026-10-17) returns `ORDER BY occurrence_date DESC LIMIT 100`.
  When a series has more than 100 coming dates, the dates missing from the read are the **soonest**
  ones. `keep_occurrence_ids` then leaves them out, and `_cmd_series_stop_repeating_p5` deletes every
  unbooked scheduled date after today that is not in the list. So "Stop repeating" would delete the
  next few weeks while the screen says "N dates stay". The End line ("N coming dates come off") and the
  Stop line under-count in the same case. `moreLabel` already detects this exact state ("100+") but the
  step does not use it.
- **Reach today:** no prod series has 100 or more coming dates (survey below: max bucket 30-99), and owner
  creation caps at 30. An admin-made series can go past it. Latent, so SHOULD, not BLOCKING.
- **Fix:** when `ws.hasMore` and every date in the read is still to come (the "100+" state), show the Stop
  row (and the `?do=stop` step) disabled with a reason, and word the End line without a number.
- **Evidence it is untested:** no fixture has `hasMore` with a stop or end step. Mutation (e) below only
  proves an EMPTY keep list is caught, not a truncated one.

### SHOULD-2 -- An ended event's one-event screen: "No coming dates" with nothing to do and no reason
`src/modules/organiser/events/OneEvent.tsx:77-84`; walk screen `walk-S5/04-ended.png`.
- **Why:** for `ended` (20 prod series, 2 of them cancelled-only), `canAddTo` is false, so the card shows
  only "No coming dates". There is no lock line, no "Ended on ..." and no action, so the screen breaks
  the CLAUDE.md rule that every empty state says what the person can do. Details shows `eventLock`
  for the same event, so the two screens read differently. A paused event with 0 coming dates gets the
  same bare card (no prod shape today).
- **Fix:** under the title, render `eventLock(status)` (and `endedOnLabel`) for ended or archived events,
  the line Details already uses. For paused with no coming date, say "Resume it to add dates".

### SHOULD-3 -- The venue row's write is untested (sends on change, untouched sheet sends nothing)
`src/modules/organiser/events/Details.tsx:80-93` (`onSheet`); `events/__tests__/s5.events.test.tsx` has no venue send case.
- **Why:** the brief's table asks for "each details field" plus "untouched Save sends nothing". Venue is
  the only field that writes on sheet close, and it is the only one without a test either way. Mutating
  the `draft.venueId === ws.series.default_venue_id` guard is not caught by any S5 test.
- **Fix:** add two cases. Pick another venue and close: ONE `series.upsert {name, default_venue_id[, default_city_id]}`
  with `expected_version`. Open and close untouched: zero commands.

### NOTE-1 -- W1 (coming-date time vs Details time) is a FIXTURE artifact, not a prod inconsistency
Prod stores `event_occurrence_p5.materialised_start_utc` as wall-clock-as-Z. On coming scheduled dates
before 2026-12-01 (BST dates are those before 25 October):

| dates | n | London-converted HH:MM = `default_local_start_time` | UTC HH:MM = `default_local_start_time` |
|---|---|---|---|
| BST (before 25 Oct) | 54 | 0 | 54 |
| GMT | 219 | 218 | 218 |

`localAsZTime` reads the UTC HH:MM, so on prod the coming-date rows and Details both read 20:00. The
e2e fake (`tests/e2e/helpers/organiserFake.ts:300`, also ~321 and ~337) writes `T19:00:00+00:00` for a
20:00 night, which prod never does. **Fix (S5):** make the fake write `T20:00:00+00:00` and re-shoot
`02`/`08`. The shared mapping holds: the chip is `jobs/homeJobs.seriesChip` on both My events
(`EventList.tsx:18`) and the one-event title (`OneEvent.tsx:167`), with no second copy (mutation (f)).

### NOTE-2 -- `detailCommand`'s own "unchanged -> null" guard is masked by the button gate
Removing only `if (!detailChanged(...)) return null;` (`eventModel.ts`) leaves all 28 S5 tests green. The
button's `aria-disabled` gate still blocks the send, so behaviour holds today, but the second layer
has no test. Add a pure `detailCommand(ws, f, detailValue(ws, f)) === null` case for each field.

### NOTE-3 -- Idempotency reuse is not tested in S5
S5 sends through S3's `useFlowSend`, which reuses the key per command signature and is tested in
`flows/add|cancel|change/__tests__`. That coverage is acceptable. If S5 ever sends outside that hook, add a
retry-same-key case.

### NOTE-4 -- Change the day: an untouched Save ("Pick another day") is not covered by a test
`EventStep.tsx` DayStep. The button is gated, but no case clicks it unchanged and asserts zero commands.

### NOTE-5 -- Small screen issues
- The Cover row stays a live link on a locked (ended) Details screen (`Details.tsx:117`), while every
  other row there is read-only.
- The "Event not found" branch (`OneEvent.tsx:160`) is effectively unreachable. A bad id raises
  `series_not_found`, so `ws.isError` shows the generic retry error instead.

### NOTE-6 -- Survey re-run differs by one in one bucket
Live recurring with 0 coming dates: **6** now vs the handover's 5. In both counts 1 of them is cancelled-only.
Every other bucket matches (table below). Probably a series changed during the day. No action.

### NOTE-7 -- tsc count in this sandbox is 110 on BOTH base and head
The handover says 96. Parity is what matters: there are no new errors and none in S5 files. The three
organiser-named errors (`app/routes/organiser.tsx`, `edit-in-place/TeamPicker.test.tsx`,
`pages/OrganiserProfile.tsx`) are on base too.

## 1. Files and merge
```
$ git diff --name-only origin/claude/org-r1-integrate...origin/claude/org-r1-events   (walk-S5/*.png omitted)
docs/organiser-rebuild/handovers/S5.md
src/modules/organiser/events/{Details,EventList,OneEvent,index}.tsx, eventModel.ts, eventsApi.ts
src/modules/organiser/events/{EventEditorPage,ReviewCard}.tsx, reviewModel.ts      (deleted)
src/modules/organiser/events/__tests__/... (old editor tests deleted; s5.events, s5.scan added; takenOff, eventTruth, fixesBatch edited)
src/modules/organiser/flows/event/{EndStep,EventStep,parts}.tsx, eventSteps.ts, index.ts, useEventSend.ts
src/modules/organiser/shell/OrganiserRoutes.tsx, shell/__tests__/routes.test.tsx   (declared out-of-row)
tests/e2e/helpers/organiserFake.ts, tests/e2e/organiser-{date,events,layout,legacy-redirects}.spec.ts  (declared in Continuation)
$ git diff --stat ...  -- events/EditorRows.tsx events/EditorGroup.tsx events/EditorSheet.tsx src/components/calendar src/components/EventCalendar.tsx src/hooks/useCalendarEvents.tsx src/modules/organiser/shared vite.config.ts
(empty)  -> protected / event-truth / density-exempt / READ-ONLY shared files untouched
$ git merge --no-commit --no-ff origin/claude/org-r1-events   (scratch branch from org-r1-integrate fe2de2b)
Automatic merge went well; stopped before committing as requested   (integrate is an ancestor: clean)
```

## 2. Pinned commands (code + tests)
| Action | Command sent (one) | Test |
|---|---|---|
| Pause / Resume | `series.set_lifecycle {to:'paused'|'live'}` | CASES pause/resume |
| End | `series.end_run {}` or `{today_session}` when a not-cancelled date is today; Send disabled "Say if tonight runs" until answered | CASES end + "End with a date tonight" |
| Change the day | `series.set_recurrence` = stored rule with only `weekdays` replaced; disabled "Only a weekly event changes its day here" for monthly (6 prod) / custom (1 prod) | CASES change the day |
| Stop repeating | `series.stop_repeating {keep_occurrence_ids: every coming scheduled date in the read}` (see SHOULD-1) | CASES stop repeating |
| Put back | links S3's put-back screen (ONE `occurrence.cancel {cancelled:false}` there), disabled with `RESTORE_CAP_NOTE` at the cap | C45 + cap test |
| Unskip | `series.unskip_date {date}` | taken-off test |
| Details text fields | `series.upsert {name, <key>}` for name/time/level/music/tickets/instagram/about. Prod `_cmd_series_upsert_p5` reads every key (checked) | FIELDS table |
| Venue | `series.upsert {name, default_venue_id[, default_city_id]}` on sheet close | **none** (SHOULD-3) |
| Untouched Save | nothing sent, aria-disabled "Nothing changed yet" | mutation (b) |
| Course | stop + day rows `aria-disabled`, reason "A course keeps its weeks"; `?do=stop` shows the reason only (walk 14) | mutation (c) |
| "100+" | `ws.hasMore && every date >= today` | "100+" test |
| `WARN_END` | importers: `flows/event/EndStep.tsx` only (`shared/copy.ts` defines it) | s5.scan |
| Undo | none in OneEvent / Details / flows/event; each case asserts `queryByText(/undo/i)` is null | CASES |

## 4. Real-data shapes (prod `stsdtacfauprzrdebmzg`, SELECT only, counts only, 2026-10-17)
Non-archived series by lifecycle x format x coming scheduled dates:

| lifecycle | format | 0 | 1-3 | 4-14 | 15-29 | 30-99 | 100+ | notes |
|---|---|---|---|---|---|---|---|---|
| live | recurring | 6 | 4 | 4 | 3 | **27** | 0 | 1 cancelled-only (0 bucket); 1 with a cancelled date (30-99); 1 series >100 dates in total (coming < 100, so the DESC read holds every coming date) |
| live | course | 2 | 3 | 1 | | | | all with a rule (weekly, `after_count`) |
| live | festival | 1 | 6 | | | | | |
| live | one_off | 8 | 2 | | | | | |
| paused | recurring | | | | | 1 | | with a cancelled date |
| draft | recurring | 1 | 2 | 2 | | 1 | | |
| ended | recurring / course | 12 / 8 | | | | | | **20** ended; 2 cancelled-only |

Rule shapes (live/paused): weekly end none 27, weekly until_date 2, course weekly after_count 6, monthly 6, custom 1.

Walk per shape (code + screens):
- live recurring 30-99: dates, "N more", cancelled date with Put it back off + cap note (walk 02), Pause/End/Change the day/Stop. Sane.
- cancelled-only: "No coming dates" + Add a date (live). Sane.
- festival: no day/stop rows (not `recurring`/`course`); End is shown. Sane.
- course: day and stop disabled with the reason. Sane.
- monthly/custom: day disabled with the pattern reason; stop enabled. Sane.
- paused: Resume/End/day/stop. Sane.
- **ended: SHOULD-2.**
- No copy points at a control that is not on screen: checked for End ("Say if tonight runs" sits under the two choices), the cap note and the course reason.

## 5. Tests that can fail
`npx vitest run src/modules/organiser/events src/modules/organiser/flows/event src/modules/organiser/shell` -> **14 files, 742 tests, all passed** (exit 0).

Each mutation was applied with `perl -pi`, run, then reverted with `git checkout`. `git status` was clean after.

**(a) two commands on a single-step action**: `useEventSend` sends twice:
```
FAIL s5.events.test.tsx > C42-C44 ... > 'pause' / 'resume' / 'end' / 'change the day' / 'stop repeating'
AssertionError: expected [ ...(2) ] to have a length of 1 but got 2
FAIL ... > End with a date tonight asks first and sends today_session
FAIL s5.events.test.tsx > C37 details ... > 'name' / 'time' / 'level' ...      (13 failed)
```
**(b) untouched Save sends an upsert**: button reason `!changed ? ... : problem` -> `problem`, plus the `detailCommand` null guard removed:
```
FAIL ... > an untouched Save is disabled and sends nothing
AssertionError: expected null to be 'true'
```
The same mutation with the test's `aria-disabled` line removed, to prove the send assertion itself bites:
```
AssertionError: expected [ { fn: 'series_command_p5', ...(1) } ] to have a length of +0 but got 1
```
(Model guard alone removed: 28/28 green, see NOTE-2.)

**(c) course stop row enabled** (`eventSteps.ts` stop -> `{reason:null}`):
```
FAIL ... > a course cannot stop repeating: the row is disabled with the reason (R3-1)
AssertionError: expected null to be 'true'      Tests 1 failed | 676 passed
```
**(d) End no longer requires the tonight answer** (`EndStep` reason -> null):
```
FAIL ... > End with a date tonight asks first and sends today_session
AssertionError: expected null to be 'true'      Tests 1 failed | 676 passed
```
**(e) stop_repeating keeps nothing** (`stopRepeatingCommand([])`):
```
FAIL ... > 'stop repeating'
AssertionError: expected { kind: 'series.stop_repeating', ...(1) } to deeply equal { ... }      1 failed | 676 passed
```
**(f) chip mapping duplicated with a different label** (EventList maps "Needs dates" -> "No dates"):
```
FAIL ... C33 My events > a live event with no coming date reads "Needs dates", as on Home
AssertionError: expected 'No dates' to be 'Needs dates'      1 failed | 676 passed
```

## 6. CI steps (sandbox, head 5bb70a1)
| Step | Command | Exit | Note |
|---|---|---|---|
| typecheck | `npx tsc -p tsconfig.app.json --noEmit` | 2 | 110 errors on head, **110 on base fe2de2b** (worktree); none in S5 files (NOTE-7) |
| unit-tests | `npm run test:unit` | 1 | head: 15 failed / 8035 passed, in 4 files: `eventViewCompat.contract` (5), `integrityCouldNotRun` (5), `occurrenceProgram.contract` (2), `publicEventPageLineup.contract` (3). **base fe2de2b: the same 4 files, 15 tests**: confirmed identical |
| lint | `npm run lint` (bin/*.sh chmod +x locally, reverted) | 0 | |
| build | `npm run build` | 0 | |
| mojibake | `npm run check:mojibake` | 0 | |
| architecture-guard | `npm run lint:architecture` | 0 | |
| integrity: images | `AUDIT_STRICT=1 npm run check:images` | 0 | |

Could not run, or not run: types-drift (live DB); e2e-smoke (not in this brief's list; the author's run is
in the handover); perf-budget (not in the list); a real phone.

## 7. Walk screenshots (`walk-S5/`, 390x844)
- `04-ended`: bare "No coming dates" with no reason (SHOULD-2).
- `02-weekly-40`, `08-friday`: times read 19:00 because of the fake (NOTE-1). On prod the same rows read 20:00.
- `02`: the long title truncates to "Thursday Sensual S..." beside the chip. Acceptable; the full name is in the header.
- `11-do-end`: the line, the warning, the two tonight choices and the off Send with "Say if tonight runs" fit on one screen.
- `14-course-do-stop`: a direct `?do=stop` on a course shows the reason only, with no button. Correct.
- Nothing cramped, and no control under 44px in what I looked at (the layout spec also asserts this).

## Verified / Not verified
- **Verified:** the file list, protected files untouched and a clean trial merge; every pinned command,
  read in the code and in the tests; six mutations red, then reverted; the S5 suites green; tsc parity
  with base; `test:unit` reds identical to base (same 4 files and 15 tests); lint, build, mojibake,
  architecture and images at 0; the prod survey re-run; the prod workspace RPC order and cap (SHOULD-1);
  prod `materialised_start_utc` convention (NOTE-1); prod upsert keys; prod rule shapes; the walk
  screenshots.
- **Not verified:** a real phone or Vercel preview; e2e (not re-run); types-drift; `series.end_run` and
  `series.set_recurrence` effects on real rows (SELECT-only); the venue sheet's write on a device.
