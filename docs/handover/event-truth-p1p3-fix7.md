# Handover: Website FIX-7 (second xhigh review, 12 findings)

Branch `arc/event-truth-p1p3-fix7`, from `origin/arc/event-truth-p1p3-fix6` (`9d528bf5`). No PR opened (per the brief).
Brief: `briefs/event-truth-p1p3-fix7.md` on `arc/briefs-event-truth` (sha 72b6f0d1).
`src/lib/eventCategory.ts` is byte-identical; no `src/components/calendar/**`, `EventCalendar.tsx` or `useCalendarEvents.tsx` touched.

## 1. Fixes, and which lines are NEW LOGIC

| # | fix | files | new logic |
|---|---|---|---|
| R1 | Search **Class** chip also matches stored `masterclass` and `workshop`; Workshop and Masterclass chips still match their own legacy rows. Client-only: the RPC filter is `es.category = ANY (p_category)` (read from prod `pg_get_functiondef` of `search_public_v5`/`v6`), so no RPC or calendar change was needed. | `src/lib/genreSynonyms.ts`, `src/pages/SearchResults.tsx` | `genreFilterTokens()` + `GENRE_FILTER_EXPANSION` (new); SearchResults passes `genreFilterTokens(ecat)` in place of `normalizeGenreToken` + Set |
| R2 | `chipHint(phase, busy, type, blocked)`: while blocked (Create disabled) the confirmed hint reads `Already chosen: your event is made with it. Open the event.` and the unconfirmed one `Not confirmed yet.` (the exit, the back link, is the existing `unconfirmedExitNote` under the block message). Busy and open hints unchanged. | `eventType.ts`, `NewEventPage.tsx` (passes `!!block`) | the two `blocked ?` branches |
| R3 | `typeSublabel` non-editable branch reads `hasSession`. With a session: `Set by its sessions.` Locked with none: `No session on its dates.` (new sentence). Unlocked with no upcoming date and none: the existing no-date sentences (now one helper `noDateSentence`, so the cancelled-only sentence is not copied). **Mapping:** the editor passes `hasSession` = `sessionDates(ws.hasSessions, listedUpcoming) > 0` when editable (unchanged), and the SAME `sessionDates` over EVERY date (`ws.dates`) when locked or no upcoming date. Reason: prod (2026-10-13) holds 658 ended/archived series, every series stores a category, and every ended non-festival/course series runs a series programme; upcoming-only would have flipped every ended series to "No session". | `eventType.ts`, `EventEditorPage.tsx` | `typeHasSession` in the editor; the 3 new lines at the top of the word branch of `typeSublabel` |
| R4 | **Not changed: owner fork** (section 4). | -- | -- |
| 5 | `eventTruth.matrix.test.tsx` `libSet` read through `const lib: readonly string[]`. Typecheck **96** (was 98). | test | -- |
| 6 | `check-event-truth-v1.mjs`: the verdict branch no longer appends the #780 hint on `category_drift`. The hint stays where the P0 payload shape is missing (no `added_sessions` / `added_session_count`): that payload already stops in CANNOT-MEASURE with it (self-tests 864/865 unchanged). Self-test 866 now pins drift on a P3 payload to `1:other`. | script | removal of the `drift ?` clause |
| 7 | `firstListedDate` JSDoc: the editor's `next` only; the create seeds the add_date reply's date (FIX-6 F-g). Dropped the vestigial "not a copy in newEvent.ts" case; relabelled the null case for the editor. | `seriesModel.ts`, `newEvent.seed.test.ts` | -- |
| 8 | `created` removed from `NewEventPage` (it was only set after `made` was already true). | `NewEventPage.tsx` | -- |
| 9 | Editor: `upcoming` and `listedUpcoming` (`!isCancelledDate`) are `useMemo`'d once; `listedCount` and `sessionDates` read it. `sessionDates` uses `isCancelledDate` (its parameter widened to `Pick<WorkspaceDate, 'lifecycle_status'>`). | `EventEditorPage.tsx`, `reviewModel.ts`, `seriesModel.ts` | -- |
| 10 | `createHint.test.ts`: the comment states the measured 90/90 lengths; "longest hint" asserts the max length is 90 and the set of longest hints is {Class, Party}, sorted, so Set order does not matter. | test | -- |

Snapshot `editorOrder.matrix.test.tsx.snap`: 5 `org-row-type` lines changed, all the R3 false claim (3 archived shapes with no programme -> `No session on its dates.`, 2 draft-empty shapes -> `Add a session once a date is listed under When, and it is set for you.`). Nothing else in the snapshot moved.

## 2. Red-first (each new test run against `9d528bf5` code before the fix)

| fix | test | red on base |
|---|---|---|
| R1 | `genreSynonyms.test.ts` stored word x chip table | 5 failed (function missing) |
| R2 | `createHint.test.ts` phase x busy x block table | 3 failed |
| R3 | `eventTruth.matrix.test.tsx` oracle + new "ended with no session on any date" rows | 76 failed |
| 6 | `check-event-truth-v1 --self-test` case 866 | 156/157 (`got "1:admin #780"`) |

## 3. Mutation table (applied, run, restored)

| mutant | result |
|---|---|
| R1: `class` expansion without `workshop` | 1 failed |
| R2: `sent` ignores `blocked` | 2 failed |
| R3: `if (!canEdit) return 'Set by its sessions.'` (old) | 76 failed |
| R3: editor `typeHasSession = withSessions > 0` (upcoming-only) | 12 failed |
| 9: `sessionDates` stops filtering cancelled | 2 failed |
| 6: drift hint re-added (= base code) | self-test 156/157 |

## 4. R4: the owner fork (NOT guessed)

The Party create chip seeds a party session; the derived word is the lib's `night`.

| screen | reads | source |
|---|---|---|
| New event chip | **Party** | `EVENT_TYPES` in `eventType.ts` |
| editor Type row (and the e2e assertion) | **Night** | `categoryLabelFor` -> `CATEGORY_WORD_LABEL.night` in `src/lib/eventCategory.ts` (must not be edited) |
| ended event page | **night** ("community's own word") | `runNoun` -> `wordForStored` in `endedRun.ts` |
| OG card pill | **PARTY** | the OG event type |

One organiser-side function cannot give all four the same word without choosing **Party** or **Night**: making the Type row say Party means a second mapping beside the lib (the one-mapping rule), and making the chip say Night changes create copy. Owner question: *"Is the word for a party series **Party** or **Night** on the organiser screens (chip, Type row, ended page)?"* The next arc replaces the chips and the Type row, so it is the natural place to land the answer.

## 5. Checks (FIX-7 worker, 2026-10-13, on `c27e2ae` + this doc; Node 22; CI's `chmod +x bin/*.sh` applied, then reset, never committed)

GitHub Actions is unavailable (billing), so every no-secret step of every `pull_request` workflow was run here.

| workflow / job | step | exit | note |
|---|---|---|---|
| architecture-guard `integrity` | `bin/check-integrity.sh`, `check:legacy-tables`, `check:legacy-program-rpcs`, `lint:architecture` | 0 each | |
| | `AUDIT_STRICT=1 check:images`; `check:image-widths:self-test` + guard; `check:plan-hygiene:self-test`; `check:workflow-artifact-policy:self-test` + guard | 0 each | |
| | `check:mojibake:self-test` / mojibake `git grep` | 0 / no match | |
| | `prove:entry-point:self-test` + sweep | 0 | |
| typecheck.yml | `check:rpc-typing` / `check:wallclock-brand` | 0 / 0 | `tsc` count **96** (was 98; target met) |
| unit-tests.yml London (full) | `test:unit:offline` | **0** with `NODE_PATH` unset: 270 files, 6435 passed, 16 skipped | With the container's `NODE_PATH=/usr/local/lib/node_modules_global` set, `tests/integrityCouldNotRun.test.ts` reds 5 ("typescript resolved in the temp repo -- precondition gone"): environment-only (the fix-6 run also unset it; CI has no such NODE_PATH); that file passes 67/67 without it. |
| | `test:unit:timing` | 0 | 65 passed |
| unit-tests.yml New_York / Sydney (9-file list) | `vitest run --no-file-parallelism <9 files>` | 0 / 0 | 213 / 213 |
| perf-budget.yml `bundle-budget` | both self-tests / `build` / `check:bundle-budget` / `check:first-load-requests` | 0 each | all 6 prerendered routes equal their pin. Lighthouse and doc-weight need a Vercel deploy: not run. |
| db-contract-check.yml (no-secret) | `ci-live-db-gate.mjs --self-test` + gate, `check-migration-stamps`, `check-script-conventions.mjs` (+ its self-test), all 12 distinct `--self-test` commands in the workflow (`check-event-truth-v1` 157/157) | 0 each | |
| | `check-event-truth-v1.mjs` LIVE | **not run** | Read-only `pg_proc` on prod: `check_event_truth_v1()` still has no `added_session` (P0; admin #780 not applied), so the live run takes the unchanged CANNOT-MEASURE path that names #780 (self-tests 864/865 hold it), the same expected red as fix-6. Not run to avoid handling a key. |
| e2e-smoke.yml (workflow env, `CI=true`) | full `npm run test:e2e` | **0** | **88 passed, 1 skipped, 4 flaky** (failed once, passed on retry): `dancer-home.spec.ts:105`, `auth-magic-link-returnto.spec.ts:88` + `:113` (baseline) and **`dancer-home.spec.ts:150`** ("I organise events" opens the unchanged onboarding) -- not in the baseline list, but the same spec file as the baseline flake, and nothing in this diff touches dancer home, onboarding or `tests/e2e`. No hard failure. |
| `npm run lint` (chain) | | 0 | 16 of 16 links green |
| `npm run pre-ship` | all | **1** | Every repo check PASS; typecheck ratchet PASS at 96 (baseline 106); scoped eslint 40 files, 0 errors; build/bundle/first-load PASS. **The one FAIL is `test:unit`: 10 red, all live-DB `*.contract.test.ts` against the offline stub** (`eventViewCompat` 5, `publicEventPageLineup` 3, `occurrenceProgram` 2), inside the baseline 12. pre-ship SKIPPED its e2e leg (because of those) and `check:plan-hygiene` (no plans dir); both covered above. |

**Hooks:** `.githooks/*` is mode 100644, so pre-commit/pre-push did not run ("hook ignored"); their checks ran by hand above. No `--no-verify`.

**Result: no NEW hard red. One new e2e flake (`dancer-home.spec.ts:150`, passed on retry) outside the diff.**

## 6. Verified / Not verified

**Verified:** every fix's new test red on `9d528bf5` code and green after; every mutant in section 3 reds; R1's RPC semantics (`= ANY (p_category)`) and stored category counts (party 709, class 28, workshop 6) read from prod; R3's mapping checked against prod lifecycle x format x category counts (every series has a category; 658 ended/archived); typecheck 96; every CI step above.

**Not verified:** no browser walk at 390x844 (the changes are copy and one search filter array; the e2e organiser specs passed in the full list); the live `check-event-truth-v1` run (prod is still P0); Lighthouse / doc-weight (need a deploy); `/code-review` was not run (no live user to type it); R2's new blocked copy and R3's new sentence `No session on its dates.` are worker wordings the owner has not seen.

## 6. Queued (not in scope, untouched)

- `ogCardRender` masterclass pill row (pins a value the snapshot never emits).
- The atomic-create "altitude" finding (belongs to the new arc).
- R3 follow-up: `ws.dates` may be a capped window (`hasMore`); for a series with NO series programme whose only sessions are per-date on dates outside the window, the locked row would read "No session on its dates." Prod shape: every ended non-festival/course series has a series programme, so no live series meets it today.
