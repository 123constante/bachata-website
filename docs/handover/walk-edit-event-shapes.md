# Walk B: a claimed organiser edits an existing event in P3, five shapes (REPORT ONLY)

Ticket dt_97f3c305fc66. Branch `claude/walk-edit-event-shapes`. Report only: no `src/**` change, no spec written (see "Phone spec" below). Date of walk: 2026-11-06.

## Not verified (read this first)

Real sign-in, a real save against prod, a real phone, any real account, a browser walk at 390x844. Code reading plus the existing vitest suites only. No write to prod. The Supabase connector was used for SELECT counts only.

## Brief vs main: names that do not exist

The brief names files and tests that are not on main. What was read instead:

- `p3/model/saveWords.ts`, `p3/model/scopeAsk.ts`, `screens/ScopeSheet.tsx`: **do not exist.** There is no "this date / all dates" scope sheet in the edit path (see finding 1). `saveModel.ts` is the save model.
- Tests `eventPage`, `editorStates`, `datesFix`, `keptEdit`, `archivedEvent`, `allDates100`: **do not exist by those names.** Real equivalents: `screens/__tests__/eventPage.matrix.test.tsx`, `eventPage.send.test.tsx`, `editScreens.send.test.tsx` (Details + Prices), `w3a.r3.test.tsx`, `dates.send.test.tsx` (All dates, incl. the 131-date cap), `screens.matrix.test.tsx`; `data/__tests__/*`; `model/__tests__/realShapes.test.ts`.
- `docs/review/audit-create-parity.md`: **not on main.** Festival/Course create claims below are therefore code-read only, not cited.

## Existing evidence, run on `main` (a661186)

`npx vitest run src/modules/organiser/p3/{screens,model,data}/__tests__`: **27 files, 1857 tests, all pass.** (`realShapes.test.ts`: 14 pass; it covers prod item types, HH:MM:SS times and untimed sessions, not edit screens.)

## Prod shape survey (counts only, `event_series_p5` x `event_occurrence_p5`, 2026-11-06)

| format | lifecycle | series | no dates | 1 date | 2-12 | 13-100 | >100 | has a cancelled date |
|---|---|---|---|---|---|---|---|---|
| one_off | archived | 636 | 298 | 338 | 0 | 0 | 0 | 0 |
| recurring | live | 44 | 0 | 0 | 10 | 33 | 1 | 22 |
| recurring | ended | 14 | 0 | 1 | 7 | 6 | 0 | 8 |
| recurring | archived | 12 | 1 | 2 | 3 | 6 | 0 | 0 |
| one_off | live | 11 | 0 | 11 | 0 | 0 | 0 | 0 |
| recurring | draft | 9 | 0 | 1 | 1 | 7 | 0 | 1 |
| course | ended | 8 | 0 | 0 | 8 | 0 | 0 | 0 |
| festival | live | 8 | 0 | 8 | 0 | 0 | 0 | 0 |
| course | live | 7 | 0 | 0 | 6 | 1 | 0 | 0 |
| one_off | draft | 5 | 2 | 2 | 1 | 0 | 0 | 0 |
| festival | archived | 5 | 0 | 5 | 0 | 0 | 0 | 0 |
| other (course archived/draft, festival draft, recurring/one_off paused) | | 5 | | | | | | |

What this says for P3 edit: the live, editable population is small (44 live recurring, 11 live one-off, 8 live festival, 7 live course, 14 drafts/paused). **33 of 44 live recurring series have 13-100 dates and 1 has more than 100** (the API cap). 22 of 44 live recurring have a cancelled date. Everything ended or archived (~700 rows) is locked by `eventLock`.

## The five shapes x four screens

Screens: **Event page** (EventPage.tsx), **Details** (DetailsScreen.tsx), **Prices** (PricesScreen.tsx), **Dates** (AllDatesScreen.tsx + DateSheet.tsx, the one-date edit). "Save" is the shared EditTray on Details and Prices.

How the edit path is built (from the code): Details and Prices always edit the **series defaults for every date** (`L.saveAll` = "Save for all dates", success toast "Saved for every date. Dancers see it now.", `labels.ts:96,259`). One date is changed only from the Dates screen / date sheet ("Change for this date", `DateSheet.tsx:143`). There is **no scope question** in the edit path at all: scope is chosen by which screen you open.

Legend: T = a test drives this exact shape on this screen. R = code-read only. ? = unknown.

| shape | Event page | Details | Prices | Dates / one date |
|---|---|---|---|---|
| one-off | T (`eventPage.matrix` `oneoff`, `oneoffPast`) | R | R | T (`dates.send`/`w3b2` use one-offs) |
| weekly, 13 dates | R (13 is not a fixture; `weekly`/`tonight` have 4-6, `over100` has 100 of 131) | R (default fixture is weekly with ZERO dates) | R (same) | T for 100-of-131; 13-date list itself R |
| ended series | T (`eventPage.matrix` `ended`) | T (`editScreens.send` ended/archived lock) | R (lock is the same `useEditLock`; test only on Details) | R (`dateFieldsWhy` / `isClosed` path; `dates.data` has 1 ended case) |
| draft | T (`draft`, `draftReady`) | R | R | R (`draft` has no dates; "Add a date" path T in `dates.send`? not confirmed: ?) |
| festival | T (`festival`) | R | T (`editScreens.send` "a festival offers its ticket link only") | T (`w3b2`: festival dates / `dateFieldsFestival`) |

**Coverage count: 20 cells. 9 tested (T), 10 code-read only (R), 1 unknown (?).**
Tested: one-off x Event page, one-off x Dates, weekly(100-of-131) x Dates, ended x Event page, ended x Details, draft x Event page, festival x Event page, festival x Prices, festival x Dates. Unknown: draft x Dates (add-a-date on a zero-date draft).

**The gap list (core output): no test drives Details or Prices on a one-off, a 13-date weekly, a draft, or (Details only) a festival. Details and Prices tests all run on one fixture: live, weekly, zero dates, version 7.** Every one of those fixtures differs from the shape that failed on 2026-10-08 (series with real dates).

## Dead ends, worst first ("would an organiser give up here")

1. **Ended and archived events are a wall with a phone number on it.** `eventLock` (`shared/eventState.ts:55`): "This event has ended, so it can't be changed here. To run it again, ask the Bachata Calendar team." Details, Prices and every date sheet are greyed (T for Details; Save shows the reason, `EditTray.tsx:230`). Prod has ~700 archived/ended series (14 ended recurring, 8 ended courses, 636 archived one-offs). For a team that wants 10 organisers to update an event themselves, an organiser whose series ended last month and who wants to run it again has no self-serve path. The Event page offers a "reopen" status move (`eventPage.ts:195`, StatusMove has `reopen`), but whether it is offered for an ended series by an organiser was not checked: ?. Check this first; if it is not offered, this is the top dead end.
2. **"Save for all dates" and "Saved for every date" on a one-off or a draft with no dates** (`labels.ts:96,259`). Not blocking, but the words are wrong for 11 live one-offs, 8 live festivals and 2 date-less drafts, and they imply a choice that is not there. R only. Also, nothing on Details/Prices says that a date with its own change ("Own changes", `has_override`) will **not** pick up the new name/place/price. grep of `labels.ts` and the Details/Prices screens finds no such note. On the 22 live recurring series that have per-date changes, an organiser changes the venue "for every date", sees "Saved for every date", and some dates still show the old venue. This is the likeliest "it didn't work" moment. R only; needs a test with `has_override` dates (`SHAPES.weekly` has one at 2026-11-13).
3. **Zero-test coverage for the 13-100-date recurring series on Details/Prices (33 of 44 live recurring).** The 2026-10-08 failure class. Code read of Details/Prices found no date-count logic in them (they edit series defaults only), so the "One date on a 13-date series" bug cannot recur on these two screens; the risk is on the Event page "Coming up" (R, `eventPage.matrix` has `over100` and 4-6 date shapes only) and Repeat/Dates sheets.
4. **Prices locked when the team set the list up.** `pricesLock` (`seriesExtras.ts:98`): "This price list was set up by the Bachata Calendar team, so it can't be changed here. Ask ...". Rows are hidden, only "how to pay" is editable (T, `editScreens.send` line ~256). Clear reason, but still a stop. Number of prod series hitting it not surveyed: ? (would need a `passes` shape query).
5. **Festival: programme and per-date name/photos/prices are team-only.** `Sessions` shows rows read-only and `L.festivalAsk` "Ask us to change the programme" (`labels.ts:210`); `dateFieldsFestival` (`labels.ts:321`). Add-a-date is refused with `festivalOne` (`dates.ts`). Details works, Prices offers ticket link only (T). All 8 live festivals land here. The copy names a control that exists (ask the team), so no missing-control copy; it is a dead end by design.
6. **Date cap.** `addDateWhy`: at 100+ coming dates "No date can be added ... Cancel or remove one first" (T in `dates.send`). One live series is over 100 in prod. Explained, disabled with a reason. Fine.
7. **Profile lock** on Details/Prices when the organiser's profile is unfinished: link "Complete your profile" shown (`DetailsScreen.tsx`, `PricesScreen.tsx`; T in `w3a.r3`). Explained and has a control. Fine.
8. **Draft with zero dates / empty name** (2 one-off drafts have no dates): Details shows an empty name with `problems.name` after touch (R); Event page `draft` fixture is T. Whether Details can be saved for a nameless draft and what "Put it live" requires: not walked (?).
9. **Weekly series: the "Repeats" row and Details "kind" card** (`p3-d-kind`, "Worked out from your sessions. Change a session to change it", `labels.ts:258`) point at the session sheet on the Event page. That control exists for non-festival kinds (`p3-open-session`), but not for a festival, where the kind card hint is then misleading (R, `detailsKindHint` has no festival variant).
10. **Untouched Save**: no dead end. `trayLines` turns "changes the builder normalises away" into zero lines, Save off with "Nothing changed yet", nothing sent (T: `editScreens.send` "untouched ... nothing sent"). Listed so the answer to the brief's question is on record: **an untouched Save sends nothing, tested on the default live-weekly fixture only.**

## Brief questions answered

- Is there a one-date / all-dates ask when needed? **No ask exists.** Scope is the screen you open. Risk is finding 2 (silent exception for dates with own changes), not a missing question.
- Does an untouched Save send nothing? **Yes (T), one fixture.**
- Does any copy point at a missing control? None found for the screens read; the one candidate is finding 9 (festival kind hint), R only.
- Is every disabled control explained? Edit tray: yes (`p3-save-why`, T for lock and bad link). Add session / add date: yes (`addWhy`, T). Festival rows: explained by `festivalAsk`. Details fields under lock: greyed, reason in a banner (T).

## Festival and Course

- **Festival** edit: Details yes; Prices ticket link only (T); sessions read-only; dates cannot be added; per-date name/photos/prices team-only (code: `EventPage.tsx` `Sessions`, `dateFieldsWhy`, `addDateWhy`). Create-side "Coming soon" claims could not be cited: `docs/review/audit-create-parity.md` is not on main. Not guessed.
- **Course** edit: treated as a normal multi-date series by the code read (`kindOf` -> `course`; status word "All classes done" when finished). No course-specific edit test on Details/Prices. 7 live and 8 ended in prod. Only the status mapping is T (`screens.matrix` `course`, `courseDone`).

## Phone spec

Not written. No existing phone spec reaches these shapes, and `tests/e2e-phone/fakeSupabase.mjs` would need workspace-RPC fixtures per shape; that is a separate slice, and nothing was run in a browser here. The recommended first tests are in "Next steps".

## Next steps (ranked, for a follow-up brief)

1. Add vitest: Details and Prices on `oneoff`, a 13-date weekly with a `has_override` date, `draft`, `festival` (Details), `course`; assert the save sends one `series.upsert` and the copy. Fills the 10 R cells.
2. Decide the "dates with their own changes" note on Details/Prices (finding 2) and test it against `SHAPES.weekly`.
3. Confirm in `StatusSheet.tsx` / `eventPage.ts` whether an organiser can reopen an ended series (finding 1).
4. Wording: "Save for all dates" for one-off/draft.

tsc run on this commit: not applicable, no `.ts`/`.tsx` touched (docs only).

DONE
