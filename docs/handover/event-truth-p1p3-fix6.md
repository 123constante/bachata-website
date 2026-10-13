# Handover: event-truth P1+P3 -- FIX-6 slice (after the xhigh review of fix-4)

Branch `arc/event-truth-p1p3-fix6`, from `origin/arc/event-truth-p1p3-fix4` (e647a587). Brief:
`arc/briefs-event-truth:briefs/event-truth-p1p3-fix6.md`. No PR opened, as the brief says. Written 2026-10-13 by the
cloud worker (scheduled routine, ticket dt_0da3c6665c1c). **Stopped at the 30% context gate: section 5 (the CI-step
table and pre-ship) has NOT been run. A follow-up session must run it before this branch is called ready.**

Commits: `5f6a5ed` red-first tests; `9c12bfa` source fixes; then a `vite.chunks.ts` comment (F-l); then this handover.

Rules held: `src/lib/eventCategory.ts` byte-identical; nothing under `src/components/calendar/**`, `EventCalendar.tsx`,
`useCalendarEvents.tsx`; no budget, pin or `vendor-ui*` change; no raw Unicode punctuation in source; every file over
2 KB written through `safe-edit.py` / `safe-write.py`. F-b, F-c and F-e are kept MINIMAL: the next arc replaces the
New event chips and the organiser Type row, so that code was fixed for correctness only, not polished.

## 1. Fixes, and which lines are NEW LOGIC

| fix | file | change |
|---|---|---|
| F-a | `scripts/check-event-truth-v1.mjs` | **NEW LOGIC** `ADMIN_780_FIRST = 'admin #780 (derived category) must be applied first'`. It is added to the series-entry message only when `added_sessions` is missing, to the totals message only when `added_session_count` is undefined, and to the VIOLATED output only when a `category_drift:` failure exists. Prod today (read-only check): `check_event_truth_v1` has no `added_sessions`, `_derive_series_category_v1` is absent, so #780 is NOT applied and CI #70 reds with that sentence. 5 new self-test cases (157/157). |
| F-b / F-c | `events/eventType.ts`, `EventEditorPage.tsx` | **NEW LOGIC** `TypeRowState.hasSession` = `sessionDates(ws.hasSessions, upcoming) > 0`, computed once (`withSessions`) and passed to BOTH the Type row and the review card (one mapping). Editable + stored word + no session: "No session yet. Add one to one of its dates and it is set from it." Editable + no word + a session (a performance only): "Its sessions set no type yet. Add a class or a party to one of its dates and it is set for you." |
| F-b fixture | `__tests__/shapes/shapes.ts` | `seriesProgramme` (defaults to true for live, paused and ended) feeds `workspaceOf().series.program`. Without it every fixture shape had NO session, which is not prod. Prod survey below: every live, paused and ended series has series items, and 4 of 5 drafts have none. The fixture change alone kept the old source green (81 files). |
| F-d | `app/lib/ogCardRender.ts` | **NEW LOGIC** `PILL_LABELS` is keyed on `CategoryWord`, and `ogPillLabel` = `wordForStored(type, type)` -> label. A stored workshop now reads CLASS (was WORKSHOP); masterclass reads MASTERCLASS; party is still PARTY; standard, social and unknown values show no pill. `app/` already imports `@/`, so it uses the one shared mapping and no mirrored table is needed. |
| F-e | `events/newEvent.ts`, `eventType.ts` | **NEW LOGIC (behaviour change, flag for the owner)** Every chip, Class included, lists ONE date (`series.add_date`). The 8-week weekly rule is gone. The brief offered this ("stop listing dates the chip does not fill"); seeding 8 dates would have cost 17 calls, against F-g. Class hint: "One date with a class session. Make it weekly later from Repeats. Add more sessions after." Repeats makes it weekly later, as it already does for Party. |
| F-g | `newEvent.ts` `listedOccurrenceId`, `NewEventPage.tsx` | **NEW LOGIC** The seed reads the add_date reply's `data.occurrence_id`. I confirmed in prod (read-only) that `_cmd_series_add_date_p5` returns `{occurrence_id}`, that `_command_result_ok_p5` wraps it as `data`, and that a replay returns the stored `response_payload`. Calls after create: 4 (create, date, get programme, set programme), down from 5, with no `admin_event_workspace_p5`. A reply without the id goes to the existing "first session was not added" error. The create no longer calls `firstListedDate`; the editor still does. |
| F-h | `NewEventPage.tsx` | **NEW LOGIC** A city lookup rejection becomes `CityLookupFailed`. The catch handles it FIRST: message "We could not look up your city; nothing was saved. Press Create to try again.", nothing sent, `sentRef` stays null (form never frozen). Note: with `venueCityName: null`, `resolveCreateCityId` cannot reject today, so this is defensive. |
| F-i | `EventEditorPage.tsx` | `listedCount = upcoming.filter((d) => !isCancelledDate(d)).length`, used by both `listingView` and the review card's `upcomingListed` (both hand-rolled copies on that list are gone). Other hand-rolled copies in `eventModel.ts`, `takenOff.ts`, `EventList.tsx` and `reviewModel.ts` are outside this finding and were left alone. |
| F-j | `shared/seriesCommands.ts` | `upsertCommand` destructures `category` unconditionally. `category` stays in `OWNER_UPSERT_KEYS`, commented SERVER-ONLY (the mirror test pins it to the server allowlist). |
| F-k | `__tests__/pages.test.tsx` | Both 20 ms sleeps are gone. A `HomeProbe` (a second observer of the same Home query, notified in the same batch) is waited on: `success:2026-10-09` after midnight, `error:` after the failed refetch. FIX-4's M1c and M2 were re-run on this and are still killed (Mk1, Mk2). |
| F-f | `eventTruth.matrix.test.tsx`, `docs/event-truth-table.md` | **Decision: pinned, not fixed** (calendar files are density-excluded). The `it.todo` became 2 real rows. The READER (`matchesCategory`) puts a masterclass item and a social item under no tab. The lib, and the guard's corpus case for the same item-only shape, give class+masterclass and party. Each row asserts all three, and the divergence itself. Queued under "Reader vs lib" in `docs/event-truth-table.md`. |
| F-l | `vite.chunks.ts` comment | **Measured** (script in section 4). `lib-event-rules` is in the root's static graph, so it is in the first load of ALL 83 client entries (every route module and lazy page). The first-load chunk + stylesheet count of each entry equals the merge-base 5e0ec4c build: 83/83. Limit: this is a count of the manifest's static closure, not a browser trace; a lazy page's parent route chunk is not added. |

e2e and fakes: `organiserFake.ts` add_date now answers `{occurrence_id}`, and its workspace reports `program` and per-date
`added_sessions_count` the way the server does (both were hard-coded empty). `organiser-events.spec` and `organiser-loop.spec`
expect 1 date. `organiser-real-rpc.spec` (live-only, not in the gate) expects `recurrence_rule` null.

## 2. Red-first

The test commit `5f6a5ed` was run on e647a587's source (worktree): **51 failed + 7 snapshot rows / 776**, across all 5
files. The red rows: F-b and F-c (matrix and rendered rows), F-d (workshop, masterclass), F-e (class add_date, refused-date
copy), F-g (3 chips x reply id plus the call count, and the shared-helper test), F-h. The guard's F-a cases were run on the
old guard before the fix: 3 red / 156. Not red-first, because they are refactors: F-i, F-j, F-k (covered by the mutants below).

## 3. Mutation table (applied, run, restored with `git checkout`; `git diff --quiet` was true after each)

All **19 killed**: Ma1-Ma4 (F-a: each sentence branch, and drift forced true), Mb1-Mb2 and Mc1-Mc2 (F-b/F-c: rule and page
wiring), Md1 (raw pill map), Me1 (class back to weekly), Mg1 (workspace read re-added), Mg2 (reply id ignored), Mh1-Mh2
(F-h branch, catch removed), Mi1 (cancelled not filtered), Mj1 (no strip), Mk1-Mk2 (FIX-4 M1c and M2 under the waitFor
tests), Mf1 (corpus social set emptied). Log: rows "Mx: killed (exit 1; ...)". No survivors and no equivalents.

## 4. Real data (read-only SELECT, prod `stsdtacfauprzrdebmzg`, counts only)

Non-festival, non-course series, by lifecycle, with a category, series items, an upcoming listed date, and a session on one:
live 52/52 have series items; paused 1/1; ended 13/13; **draft: 4 with a category and no session on any upcoming date
(the F-b shape)**, 1 with items; archived: mixed. **Performance-only (F-c): 0 today.** #780: not applied.

F-l method: `node measure.mjs <base build> <head build>`. It takes each manifest key with `isEntry`/`isDynamicEntry`,
takes the static `imports` closure from `entry.client` + `root` + the entry, and counts js files plus css. The base was
built in a worktree at 5e0ec4c (node_modules symlinked; hashed keys matched by prefix).

## 5. Checks (FIX-6b worker, 2026-10-13, on `4198ffd`; Node 22, `NODE_PATH` unset; unit legs under the offline stub)

GitHub Actions is unavailable (billing), so every no-secret step was run here. CI's `chmod +x bin/*.sh` was applied first and
the modes restored afterwards (not committed).

| workflow / job | step | exit | note |
|---|---|---|---|
| architecture-guard `integrity` | `bin/check-integrity.sh` | 0 | 1448 files, 0 issues |
| | `check:legacy-tables` / `check:legacy-program-rpcs` / `lint:architecture` | 0 / 0 / 0 | |
| | `AUDIT_STRICT=1 check:images` | 0 | |
| | `check:image-widths:self-test` + guard | 0 / 0 | |
| | `check:plan-hygiene:self-test` | 0 | |
| | `check:workflow-artifact-policy:self-test` + guard | 0 / 0 | |
| | `check:mojibake:self-test` / mojibake `git grep` | 0 / no match (pass) | |
| | `prove:entry-point:self-test` + sweep | 0 / 0 | 41 entry points proven |
| typecheck.yml | `check:rpc-typing` / `check:wallclock-brand` | 0 / 0 | |
| unit-tests.yml (London, full) | `test:unit:offline` | **0** | 270 files, 6402 passed, 25 skipped |
| | `test:unit:timing` | 0 | 65 passed |
| unit-tests.yml (New_York / Sydney, 9-file list) | `vitest run --no-file-parallelism <9 files>` | 0 / 0 | 213 / 213 |
<!-- ROWS -->

## 6. Verified / Not verified

**Verified:** F-a to F-k against tests that were red on e647a587 (except the refactors); 19/19 mutants killed; the prod shapes
in section 4; F-l on all 83 entries; the organiser e2e above.
**Not verified:** section 5 checks and pre-ship; tsc/typecheck ratchet; lint; the live #70 run (no creds here; prod lacks
#780, so it is expected red with the new sentence); the real-RPC spec (live only); a phone walk (self-serve OFF in prod).
**Owner call:** F-e changes the Class chip from 8 weekly dates to one date (reversible; the next arc replaces the chips anyway).
