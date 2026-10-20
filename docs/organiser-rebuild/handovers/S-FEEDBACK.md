# S-FEEDBACK handover (owner's comments on the review pack, PR #809)

Branch `claude/org-r1-integrate`, base a1178dbe, ONE push. Status: DONE (items 1-5 changed; item 6 needed no code, see below).

## Changes
| # | What | Where |
|---|---|---|
| 1 | Ends, Level, Instagram, Prices rows removed from the event page rows card; their `?edit=` screens deleted | `events/Details.tsx` (rows, `TEXT_FIELDS`, edit routing), `flows/event/eventSteps.ts` (`ExtraDetail`, `EXTRA_DETAILS`, `readExtra` gone) |
| 2 | Cover -> Flyer, one constant `FLYER_LABEL` / `FLYER_WORD` | new `shared/flyerLabel.ts`; used by `Details.tsx` row label, `jobs/homeJobs.ts` ("Needs a flyer"), `events/lifecycleModel.ts` ("a flyer"), `events/eventModel.ts` ("the flyer"), `flows/fix/coverModel.ts` ("Add a flyer", "Flyer added"), `flows/fix/CoverFlow.tsx` (alt), `ui/Cover.tsx` ("Change flyer", "No flyer yet") |
| 3 | Level chips: word only. One mapping (`LEVEL_LABEL`); `LEVEL_SHORT` and `levelShort` deleted | `shared/components/LevelText.tsx`, `shared/programmeModel.ts`, `events/programmeSeriesModel.ts` |
| 4 | Programme: arrows removed; `sortSessions` (earliest start first, no start last, stable ties, by START so overnight sorts by start). `moveSession` / `moveOff` deleted | `events/programmeSeriesModel.ts`, `events/ProgrammeSeries.tsx` |
| 5 | Finished / Nothing coming up: Pause and End hidden. Predicate `nothingComingUp` built on `seriesLife` | `shared/lifeLabel.ts`, `events/OneEvent.tsx` |
| 6 | Team full photos | no source change (see below); test added in `team/__tests__/Team.test.tsx` |

## Deleted (each one)
- `events/DetailsExtras.tsx` (EndEdit, PricesEdit screens): unreachable once the Ends and Prices rows left.
- The `?edit=ends`, `?edit=prices` branches in `Details.tsx`; `level` and `instagram` removed from the reachable `?edit=` fields. (They were query-param views of the details route, not route entries.)
- Tests: `pseries.parity` "C14 the usual end" and "C09b the price list" blocks; `fpar.review` section 13 (Prices and Ends blur); `pseries.walk` "Ends note" line; `s5.events` FIELDS `level` and `instagram`; sw1 "up / down" reorder pieces; `levelShort('open_level')` line.
- `parity-matrix.test.ts`: C09b, C10 (Instagram), C35 (Level) moved from MATCH/PARTIAL to DROPPED-BY-DECISION `S-FEEDBACK-1`; C14 keeps only the time send. Counts now match 43 / partial 10 / admin-only 8 / dropped 10.
- KEPT on purpose (brief: keep the data model): `seriesExtras.ts` (usualEnd, pricesCommand...), `eventModel` `level`/`instagram` fields and `detailCommand` support. They have no screen now; their model tests still pass. Say if you want them removed too.
- Saving an untouched event still sends nothing (untouched-Save tests green). Nothing pointed at the four rows (grep: no job, chip, hint or empty state names Ends/Level/Instagram/Prices).

## Item 2: user-visible "cover" hits found (case-insensitive grep over `src/modules/organiser`) and now Flyer
Details row label (x2: live + locked), "Needs a cover" chip (homeJobs), "a cover picture" (go-live reason, 3 reason strings), "the cover" (field label in conflict text), "Add a cover" (CoverFlow title), "Cover added" (Done), "Current cover" (alt), "Change cover" / "No cover yet" (`ui/Cover`). Left as is: routes (`/cover/:id`), testids (`org-detail-cover`, `cover-*`), DB keys, identifiers, and the new-event step title "Add a photo" / "Choose a photo" (already "photo", not "cover"). Tests updated to the new words.

## Item 4 decision (display vs saved)
Sort for DISPLAY always (`shown = sortSessions(draft)`); the draft itself keeps the stored order until the person edits, adds or removes something, and that edit stores the sorted order (ids kept, `sort_order` = new position). So an untouched programme is never dirty (tested: stored order late/early/no-time/tie, open + close, Save stays disabled "Nothing changed yet", nothing sent). Edge: if someone edits and then undoes the edit, a stored order that was not sorted stays "changed" (the sorted order differs). Overnight: plain start time, a 01:00 session sorts before 19:00 (no day-rollover shift); say if you want rollover applied.

## Item 5 decision
"Nothing coming up" follows `seriesLife` exactly, which counts cancelled upcoming dates as upcoming (the Home list's upcoming_count does the same). So a live series whose only upcoming dates are cancelled is NOT idle and keeps Pause / End (shape `live-norule-cancelled-only` in the matrix). Only Pause and End hide; Stop repeating / Change the day / Make it weekly rows (not named in the brief) are unchanged. See it live stays.

## Item 6: photos
Nothing to fix in code: `team/browseApi.ts` already reads `photo_url`, `team/Avatar.tsx` already draws the photo (initials when null or broken), and the full-team state only dims/disables the button. The S-POLISH screenshot simply had `photo_url: null` for every mocked face. New test pins photo-vs-initials on a full team (at 20 and after server `team_full`), faces disabled, message and invite row unchanged: it passed on the unfixed head too. Read-only prod check (SELECT on pg_proc): `organiser_team_search_people_v1` returns `photo_url`; `organiser_team_v1` has no photo field; **`organiser_team_browse_people_v1` does not exist on prod yet**, so real faces on the browse wall depend on that RPC shipping with `photo_url` in each row (ask of the admin repo: `organiser_team_browse_people_v1` rows `{profile_id, display_name, photo_url, fact, can_add}`). The member list on the Team screen (`organiser_team_v1`) has no photo (initials) until the admin repo adds `photo_url` there.

## Red first
New/changed tests against the unfixed behaviour files (source stashed, new shared helpers kept): **95 failed | 3239 passed** across 14 files (Details rows, flyer words, level chips, arrows, order, finished buttons). After: **Test Files 121 passed, Tests 3460 passed | 2 skipped** (`npx vitest run src/modules/organiser src/modules/admin-organisers`). The photo test is green on both (no behaviour change needed).

## Mutations
| Mutation | Result |
|---|---|
| sort comparator reversed (4) | 16 red (fixSw1 + sw1.parity) |
| `nothingComingUp` always true (5) | 12 red (lifeLabel matrix) |
| LevelText shows a code beside the word (3) | 6 red |
Arrows-back mutation not run (covered by `queryByTestId('prog-up')` null assertions, checked by hand only).

## Checks (local; GitHub Actions not consulted)
| Command | Exit |
|---|---|
| `npx vitest run src/modules/organiser src/modules/admin-organisers` | 0 (121 files, 3460 tests) |
| `npm run lint` | link `check:integrity` exit 126 (no exec bit in sandbox, as in S-POLISH); `bash bin/check-integrity.sh` ok (1985 files); the other 19 links PASS; eslint link skipped by the chain |
| `npx eslint` on changed files | sw1.parity.test.tsx 10 `no-explicit-any` errors, same count as the base file; none new |
| `tsc --noEmit -p tsconfig.app.json` | errors only in untouched files (app/routes/organiser.tsx, TeamPicker.test, NewPageFlow.test, breadcrumbs); none in files I changed |
| `VITE_ENABLE_ORGANISER_SELF_SERVE=true npm run build` | 0 |
| Playwright `walk-sfeedback.spec.ts` on a prod build (AW1 gate flipped locally to edit the programme, REVERTED before commit) | 5 passed |
Not run: e2e-smoke gate, db-contract-check, check:og, check:images AUDIT_STRICT, pre-ship, `/code-review`.

## Screenshots `docs/organiser-rebuild/walk-SFB/` (all read)
a-event-page-rows (no Ends/Level/Instagram/Prices; Flyer row), b-session-sheet-chips (Beginner / Improver / Intermediate / Advanced / Open level), c1-programme-sorted-no-arrows, c2-programme-two-entered-out-of-order (Warm up first, Late drill last; sheet mid-close at the bottom), d1 finished past-dates-only (only See it live), d2 nothing-coming-up, d3 ended unchanged, d4 live full set, e-team-full-photos (two photos, one initials, all dimmed, "This team is full (20)", invite row live).

## Verified / Not verified
Verified: all of the above on the mocked backend at 390x844, prod build.
Not verified: a real phone, real Supabase answers (no shape survey beyond the function-definition check; no live data), real photo URLs, the programme save on a live server (AW1 gate still off in the committed code), the Friday event with 2 dates keeping their own changes (the fake has no per-date overrides; the by-id round trip is covered by the existing FIX-INT4 / fixSw1 tests, which pass), a "team of 20" with real members' faces, GitHub Actions.
