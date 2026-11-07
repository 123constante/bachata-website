# ER-AUDIT: editor-cards family (ER-C4 sessions, ER-C5 venue)

Ticket `dt_b86dee9a645a`. Read-only audit per brief `ER-AUDIT.md` (sha 000dac1). No source edited.

| Slice | Branch | Head audited | Base |
|---|---|---|---|
| ER-C4 session card + sheet | `claude/er-c4-sessions` | `8a9e9c7` (C4 `2d08170` + ER-FIX-C4) | ER-S1 `de7d0b4` on `b098334` (17 commits behind `origin/main` `da22920`) |
| ER-C5 venue picker | `claude/er-c5-venue` | `d6b7e00` (C5 `fa85509` + ER-FIX-C5) | same |

## Verdicts

**ER-C4 sessions: FIX.** The model is sound and well split (pure `sessionsModel.ts`, one card, one sheet, `fromStored`/`toStored` on the prod row shape, per-field blocking like the writer, untouched Done sends nothing). It does NOT meet the owner decision that **untimed sessions are valid on a live series** (223 untimed items in prod): every untimed session is drawn as an error, in the danger colour, with the reason "Pick a start time" on every open, and two tests pin that behaviour (a mutation that stops flagging untimed turns 2 tests red). Once a start is picked there is no way back to "no set time". A stored row with a start but no end would show a false end in the select. The fixes are local to three files and their tests; nothing structural needs rebuilding.

**ER-C5 venue: FIX.** Client, postcode lookup, the similar-venue check, retries and the `existing:true` path are correct and well tested (44 tests, table-driven, mutation on `existing` goes red). The flow is four steps (search, details with a separate "Look up postcode" tap, "Is it one of these?", a confirm screen) where the approved prototype v7 has ONE "Add a new venue" sheet: name + postcode, the look-alike list inline, one primary "Add venue" disabled with the reasons "Type the name" / "Type the postcode" / "Check the list above" (prototype line 390/394/588). The prototype wins over the brief wording (ER-COMMON); the deviation is not recorded as one. Name minimum is 2 letters vs the prototype's 3. Collapse the steps; the client and model stay.

**Family-wide (integrator, not either slice): stale copies downstream.** `claude/er-c7-new`, `claude/er-c8-eventpage` and `claude/er-c10-festival` all carry the PRE-FIX copies of `sessions/**` (172 lines of `sessionsModel.ts` differ; no `fromStored`/`toStored`, no `SessionSheetFix` test) and of `venue/**` (`venueApi.ts` without the AS BUILT error mapping). Whichever merges last silently wins. Merge C4/C5 heads first, then rebase/merge C7/C8/C10 onto them taking the C4/C5 side of every `sessions/**` and `venue/**` hunk.

## 1. Mounted?

Neither slice is mounted by its own branch (by design: both are components with no route). Traced importers:

| Screen | Importers (route-reachable once those land behind `VITE_ORGANISER_REBUILD`) |
|---|---|
| `SessionSheet` / `SessionCard` / `sessionsModel` | C7 `flows/new/NewFlow.tsx:23-26`, `flows/new/model.ts:14`; C8 `events/EventPage.tsx:18-19`, `events/ProgrammeSheet.tsx:9`, `events/eventPageModel.ts:23`; C10 `events/festival/FestivalTimetable.tsx:4-6`, `FestivalNights.tsx:4`, `FestivalEdit.tsx:4`, `festivalModel.ts:20` |
| `VenuePicker` | C7 `flows/new/NewFlow.tsx:22`; C8 `events/EventPage.tsx:17` |
| One date (C9 `claude/er-c9-dates`) | imports NEITHER: D1 gap "sessions and line-up for this date only, different venue this date only" has no session card or new-venue picker there |
| Old change-venue flow (`flows/change/Venue.tsx`, mounted on main) | defines its OWN local `function VenuePicker` (line 23) with no "Add a new venue": D1 gap "venue change uses the same search + Add a new venue" is unmet until the rebuild switch is `*` and the old flow is deleted |

## 2. Plan rules owned (prototype v7 + PLAN rule sheet)

| Rule | Verdict | Where |
|---|---|---|
| 3 (session part: type, name default per kind, start-end, length, level, line-up search existing profiles only) | PASS | `sessionsModel.ts:80-88,153-157`, `SessionCard.tsx:110-128,201-221` |
| 3 "Recent (last 3 used)" | PARTIAL: kept in the caller's state only (`SessionSheet.tsx:29-30,90`); not remembered across sheets/visits unless the caller persists it | |
| 21 Start + End, end lists only later times, wrap marked "next day" | PASS for timed sessions (`sessionsModel.ts:132-141`, `NEXT_DAY` `:78`); FAIL for start-only rows (F-C4-3) | |
| 22 one or more sessions, "Add another session" starts where the previous ends, time order | PASS on add (`:248-257`); PARTIAL: list is not re-sorted while editing a start, only on add/Done (`SessionSheet.tsx:53`) | |
| 25 same component everywhere, all fields, remove | PASS (component); "+ Add a session" on the event page is C8's | |
| 27 six kinds, showcase = `performance`, level only Class + Masterclass, line-up label per kind | PASS (`event-rules.json` via `eventRules.ts`; `kindFromStored` `:292-295`); performer/judge search uses the `teaching` role (`:368`), documented | |
| 28 quick lengths 45/1h/1h30/2h/Other, default 1 h, end shown as a time, Other opens the end list | PASS (`:98-99,151,193-201`, `SessionCard.tsx:140-170`) | |
| 28 stored impossible lengths untouched | PASS: over-cap end kept selectable, "Over 12 hours" shown, Done not blocked (`:131,283`) | |
| 29 new venue: Add only under results after typing, prefilled, postcode lookup, "Is it one of these?" must tap a venue or "No, it's a new venue", server dup returns existing | PASS on behaviour (`VenuePicker.tsx:156-161,80-131,193-211`); FAIL on shape vs prototype (one sheet) F-C5-1 | |

## 3. Server as built (ER-INTERFACE AS BUILT; AD1 handover not readable from this sandbox)

| Item | Verdict |
|---|---|
| `owner_create_venue_draft_v1(p_name,p_postcode,p_lat,p_lng,p_address,p_area)` -> `{venue_id, existing}` | PASS (`venueApi.ts:56-69`), keys exact |
| `owner_similar_venues_v1(p_name,p_postcode)` -> `{venues:[{venue_id,name,postcode}]}` | PASS (`:44-54`), malformed rows dropped |
| Rate limit 5 a day | Mapped to `rate_limited` by message prefix + code 54000 (`:33-38`). The 54000 code is the worker's reading of AD1; not in ER-INTERFACE: NOT verified |
| Exact duplicate costs no allowance / returns existing | PASS: a retried Add after a lost answer comes back `existing:true` and the venue is picked = retry shows success |
| Server not landed (`PGRST202`) | PASS: "Adding a venue is not available yet. Pick an existing venue for now." |
| Sessions: no RPC in C4 (the writer is the caller's). `toStored` emits the `event_series_program_item_p5` shape (`type,title,start_time,end_time,room,level_keys`) | PASS for the model; end-to-end save NOT verified (no caller on this branch) |

## 4. Shapes

The Supabase connector needs owner authorisation in this session, so I could NOT run a fresh survey. Shapes below are from the ER-FIX-C4 handover survey (2026-10-21) and the plan.

| Shape | C4 handles? |
|---|---|
| untimed party 220 / class 3 (223) | Loads, renames and saves without blocking, BUT shown as an error (F-C4-1); cannot be set back to untimed (F-C4-2) |
| start set, end null (count unknown) | FALSE end displayed (F-C4-3) |
| no title 239 | PASS: kind name shown, saved back as null unless edited (`titleWasNull`) |
| class/masterclass with no level 142 | PASS: level optional, never blocks |
| null room 552 | PASS |
| over 12 h (7-9 classes) | PASS: kept, "Over 12 hours", not blocked |
| `show` legacy kind 1 | PASS: kept as is; no kind chip is selected and the label is the raw key `show` (minor) |
| festival 14 sessions | PASS `MAX_SESSIONS = 14`; at the cap "Add another session" disappears with no reason (F-C4-6) |
| venues 66 (24 published, 31 dancer_ready, 11 draft) | C5 PASS: `get_organiser_venue_options_v1` lists drafts; empty search shape says "No venue matches" + Add; offline load has Retry |

## 5. Tests

| Run (sandbox, `TZ=Europe/London`) | Result |
|---|---|
| C4 `npx vitest run src/modules/organiser/sessions` | 4 files, 155 passed |
| C4 sessions + `shared/__tests__` | 41 files, 824 passed |
| C5 `npx vitest run src/modules/organiser/venue` | 1 file, 44 passed |
| eslint `sessions/` | **1 error**: `SessionSheetFix.test.tsx:111` `no-control-regex` (F-C4-8) |
| eslint `venue/` | 0 |
| `tsc -p tsconfig.app.json` errors in `sessions/` / `venue/` | 0 / 0 |
| `npm run lint:architecture` C4 / C5 | 0 / 0 |

Mutation probes (each reverted):
- End list includes the start itself (`m = 0`): 7 red. Tests can fail. Good.
- Stop flagging untimed as an issue (the owner-decision behaviour): 2 red (`SessionSheetFix` C4-3, `sessionsFix` "untimed party (220 rows)"). These tests PIN the wrong behaviour and must be rewritten with the fix.
- `existing` always false: 1 red. Good.

Not vacuous overall; table-driven over kinds x lengths x wrap x levels (`sessionsModel.test.ts`, rules written out independently) and stored shapes (`sessionsFix.test.ts`). Gap: no start-only row, no search-error case, no re-sort-while-editing case.

## 6. Design (from code; no browser walk: no route mounts either slice on its own branch)

- Tap targets: Chip `min-h-[44px]`, selects/inputs `h-[48px]`, Remove/Add a room `min-h-[44px]`, venue rows `min-h-[56px]`. PASS. Explicit px throughout. PASS.
- Entities: no raw non-ASCII in either slice's source (a test enforces it). PASS.
- Density: 2-col Start/End grid, `p-[12px]`, 13-16px text. PASS.
- One primary per screen: PASS (sheet Done; venue one primary per step).
- Disabled-with-reason: Done (footer reason), venue Next ("Venue name needed"), Look up ("Full UK postcode needed"). FAIL for the session cap (hidden) and last-session Remove (hidden).
- OSM map iframe (`VenuePicker.tsx:180`): third-party embed, not seen rendered. NOT verified.
- Contrast, clipping, sideways scroll at 390x844: NOT verified (no screen to walk).

## 7. Dead code and duplication

- `SessionIssue.code 'level'` and `listIssues` are dead (kept per "ADD, never remove"). Minor.
- `flows/change/Venue.tsx:23` local `VenuePicker` duplicates the new picker's job without Add a new venue (see 1).
- Stale `sessions/**` / `venue/**` copies on C7/C8/C10 (see Verdicts).
- `postcode.ts` `bad` message: the Look up button is disabled until the postcode is shaped, so `failure === 'bad'` is unreachable from the screen (`VenuePicker.tsx:173,185`). Minor.

## Findings

| id | sev | file:line | what | failing scenario | fix in words |
|---|---|---|---|---|---|
| F-C4-1 | major | `sessionsModel.ts:277`, `SessionCard.tsx:66,223-227` | An untimed session always produces the issue "Pick a start time", drawn in `--danger` with `aria-live` | Organiser opens the sessions of any of the live series holding the 223 untimed items: every untimed party reads as broken; screen readers announce an error on open. Owner decision: untimed is VALID on a live series | Treat untimed as a state, not an issue: show a quiet "No set time" in the Start select/placeholder and no reason line; keep `start` issue only for a NEW session with no start (if new untimed is not allowed). Rewrite the 2 tests that pin the old text |
| F-C4-2 | major | `sessionsModel.ts:120,177`; `SessionCard.tsx:133` | The "Pick a start" option only exists while untimed, and `setStart('')` is ignored | Organiser taps Start on an untimed party by mistake, picks 21:00: there is no way back to untimed except Close (losing every other edit in the sheet) | Keep a "No set time" option in Start for sessions loaded untimed (and, if the owner allows, for all non-lesson kinds); selecting it clears start and end |
| F-C4-3 | major (if any row exists) | `sessionsModel.ts:289,300-301`; `SessionCard.tsx:150` | A row with `start_time` set and `end_time` null loads as start `20:00`, end `''`; the controlled `<select value="">` has no `''` option so the browser shows the FIRST end option (20:15) | Screen shows "20:15" while the draft has no end and the card says "Session times are wrong"; picking 20:15 fires no change | Survey the count; in `fromStored` treat a half-timed row as untimed, or add a "Pick an end" placeholder when `end` is empty; add the shape to `sessionsFix.test.ts` |
| F-C4-4 | major | `SessionCard.tsx:76-79,207-209` | A failed line-up search resolves to `[]` and shows "No one called X. Only people with a profile can be added." | Phone offline or RPC error: organiser is told their teacher has no profile and may give up or ask them to make one | Keep an error flag; show "Search failed" with Retry |
| F-C4-5 | minor | `SessionSheet.tsx:53,79` | Sessions are not re-sorted when a start changes; only on add/Done | Move "Session 2" to 19:00: it stays second until Done, then jumps (rule 22 "listed in time order") | Sort on every change (stable by id) or on blur |
| F-C4-6 | minor | `SessionSheet.tsx:94-98`; `SessionCard.tsx:103` | At `MAX_SESSIONS` the Add button disappears; with one session Remove disappears; no reason | Festival day with 14 sessions: no hint why no more can be added | Render disabled with "14 is the most" / keep Remove hidden only if the owner wants zero-session days refused, else disabled "One session needed" |
| F-C4-7 | minor | `SessionCard.tsx:189-191`, `sessionsModel.ts:216` | The room "Remove" on ANY card clears the room on EVERY session, no confirm | One tap wipes stored rooms on all sessions of the date | Label it "Remove rooms" visibly (aria-label already says so) or confirm when >1 session has a room |
| F-C4-8 | minor | `__tests__/SessionSheetFix.test.tsx:111` | eslint `no-control-regex` error | `pre-ship`'s ship-scoped eslint ratchet can refuse the push of the file | Use a `\u0000`-free check (e.g. `[...src].some(c => c.charCodeAt(0) > 127)`) |
| F-C4-9 | minor | `sessionsModel.ts:80,292-295` | Legacy kind `show` (1 row) gets label `show`, no chip selected, `defaultName` = `show` | Opening that one session shows a lower-case raw key | Map unknown kinds to a "Showcase"-style label for display only; keep the stored type |
| F-C4-10 | minor | `SessionSheet.tsx:54-58` | Escape/Close drops edits without a "leave unsaved changes?" check (D1 gap "leaving with unsaved changes") | Organiser edits 3 sessions, swipes the sheet away: all lost | Confirm on close when `!untouched` |
| F-C5-1 | major | `VenuePicker.tsx:24,166-221` | Four steps vs prototype v7's ONE "Add a new venue" sheet (name + postcode + inline look-alikes + one "Add venue" with reasons) | Organiser needs Add a new venue -> Look up postcode -> Next -> (Is it one of these?) -> Add venue: 4-5 taps and 3 screen swaps where the approved design has 1 | Rebuild the add view as one sheet per prototype lines 390-394/588: look up the postcode automatically when it is shaped, show look-alikes inline, one primary disabled with "Type the name" / "Type the postcode" / "Check the list above"; keep `venueApi`, `postcode`, `venueSearch` as they are |
| F-C5-2 | minor | `VenuePicker.tsx:181-182`, `venueSearch.ts:4` | Name minimum 2 letters; prototype 3 (`nvBlock` `< 3`) | A 2-letter name passes here, would not in the design | Use 3 for the name; keep 2 for showing Add under results if the owner prefers |
| F-C5-3 | minor | `VenuePicker.tsx:119-125` | `existing:true` picks the venue silently | Organiser typed a "new" venue that already existed: no word that the existing one was used | Toast or line "Already on Bachata Calendar: picked it" |
| F-C5-4 | minor | `VenuePicker.tsx:138-140` | With 1 letter and no match, "No venue matches X." and no Add, no hint | Organiser types "B" with no hit, sees no way forward | Add "Type 2+ letters to add a venue" or show Add from 1 letter disabled with that reason |
| F-C5-5 | minor | `postcode.ts:57-60` | `p_address` is "Ward, District" (postcodes.io has no street) and is stored as the venue ADDRESS | Public/admin show "Spitalfields and Banglatown, Tower Hamlets" as the address of a draft venue | Send an empty address (area already goes to `neighbourhood`) or add an optional street line |
| F-FAM-1 | major | C7/C8/C10 branches, `sessions/**`, `venue/**` | Pre-fix copies of both slices ride on three downstream branches | Merge order C4 -> C8 reverts every ER-FIX-C4/C5 fix (untouched-Done, `fromStored`, AS BUILT errors) | Integrator: merge C4/C5 first; downstream branches take the C4/C5 side of those paths; a diff-empty check of `sessions/**` and `venue/**` before each merge |
| F-FAM-2 | major | C9 `claude/er-c9-dates` | One date uses neither the session sheet nor the venue picker | D1 gaps "sessions and line-up for this date only" / "different venue this date only" with Add a new venue are not built with the shared components | C9 owner: mount `SessionSheet` and `VenuePicker` in the one-date screen |

## Full control (owner decision 2026-10-22)

Searched both slices for `owner`, `isOwner`, `co-organis`, `permission`: **no owner-only copy, disabled state or hidden control** in `sessions/**` or `venue/**`. Neither slice touches cancel, stop repeating or the organiser list. The only "owner" strings are comments about the site owner's rule decisions and the RPC name `owner_create_venue_draft_v1` (server name, not copy). Nothing to flag.

Retries are success: neither slice calls invite or cancel. The analogous retry, a repeated "Add venue" after a lost answer, returns `existing:true` and is shown as success (the venue is picked). PASS.

## REBUILD would need

Not proposed. Both are FIX. If the owner chooses to rebuild C5's add view, tell the worker: build to prototype v7 lines 390-394 and 588 (ONE sheet), reuse `venueApi.ts`, `postcode.ts`, `venueSearch.ts` unchanged, keep all 44 tests' client cases.

## Verified

- Read both branches at the heads above, the briefs ER-C4/C5/COMMON/INTERFACE/AUDIT, PLAN rules 3/21/22/25/27/28/29, D1 gaps, prototype v7 strings.
- Ran the family tests (155 + 44 passed; 824 with shared), eslint, tsc, `lint:architecture`; three mutation probes as listed.
- Traced every importer of both slices across all `claude/er-*` branches.

## Not verified

- Fresh prod shape survey: the Supabase connector was not authorised in this session (counts above come from the ER-FIX-C4 handover). The start-only row count (F-C4-3) is unknown.
- Admin AD1/AD2 handovers (no admin repo access here): the 54000 rate-limit code is unconfirmed.
- 390x844 browser walk, contrast, clipping, the OSM iframe: no route mounts either slice on its own branch.
- Full `npm run lint` / build / unit suite on these branches (only the family pieces above).
- End-to-end save of sessions or venue creation: server not landed on prod.
