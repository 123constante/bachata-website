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

## 5. Checks

(filled below)

## 6. Queued (not in scope, untouched)

- `ogCardRender` masterclass pill row (pins a value the snapshot never emits).
- The atomic-create "altitude" finding (belongs to the new arc).
- R3 follow-up: `ws.dates` may be a capped window (`hasMore`); for a series with NO series programme whose only sessions are per-date on dates outside the window, the locked row would read "No session on its dates." Prod shape: every ended non-festival/course series has a series programme, so no live series meets it today.
