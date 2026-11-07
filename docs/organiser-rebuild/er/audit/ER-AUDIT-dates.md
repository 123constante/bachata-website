# ER-AUDIT: dates family (ER-C9 one date and bulk)

Ticket `dt_2e291ed31157`. Read-only audit per brief `ER-AUDIT.md` (sha 000dac1). No source edited; this file is the only change.

| Slice | Branch | Head audited | Base |
|---|---|---|---|
| ER-C9 one date + bulk | `claude/er-c9-dates` | `0a6fcce` (one commit on `claude/er-wave1` = S1 + UI + C4 + C5 merges) | `claude/er-wave1`, 18 commits behind `origin/main` (`3a21361`). A trial `git merge-tree` against main conflicts only in the Ember UI files (`ui/Chip.tsx`, `ui/DateChip.tsx`, `ui/ember.css`, `__tests__/ember.test.tsx`) from wave 1, not in C9's own files; `dates/index.tsx` merges cleanly. |

Owner decisions applied (2026-10-22, after the brief): untimed sessions are VALID on a live series (block only a half-filled time or end before start; next-day pairs fine; 223 untimed items in prod); the rebuild switch is PER EVENT; everyone on an event has full control of cancel one date and stop repeating.

## Verdict

**ER-C9: FIX (heavy; close to REBUILD on the copy part).** The slice is small (one pure file `dateChanges.ts`, additions to `index.tsx`, `DateSheet.tsx`, `useDateEditor.ts`) and the pieces that are right are well made: one "Save this date" that sends move, then venue, then programme with fresh versions between; untouched sends nothing (tested); the cancel reason list is read from the server table with no free text; "Cancel the event" wording on a one-off; date edits use date-level commands only, so the series' "Update live event" is never touched (rule 7). Pure tests catch mutations (5 of 5 probes went red). But: (1) **"Copy changes from another date" cannot save any date that holds an untimed or untitled session** (prod: 223 untimed, 239 untitled), proved with a probe: the copied rows fail `validateProgramme` with "Give this session a name." and "Enter a start time and an end time."; and even when it saves, it removes every series session on the target and re-adds them as date-only sessions, so the date is detached from the series for good; (2) rule 9 "Remove Take this date off" is NOT done (kept on purpose, `index.tsx:283`); (3) nothing is behind the rebuild switch: the date page is mounted for every organiser on `/change/:s/:o/lineup`, and the new time shift / move / copy live next to the OLD Change flow's own time / day / copy / take-off steps, which do the same jobs with different commands and different rules; (4) the D1 gaps "sessions and line-up for this date" and "different venue this date only" still use the old date session sheet and the old venue picker (C4 card / C5 picker not wired, parked). None of this needs a new architecture: the editor hook and the save chain stay; the copy rule, the one-off day picker, the take-off removal, the switch gating and the C4/C5 swap are local.

## 1. Mounted?

| Screen | Route | Behind `VITE_ORGANISER_REBUILD`? |
|---|---|---|
| Date page (`dates/index.tsx`) incl. new Night starts / Day / Copy / Cancel the event | `change/:seriesId/:occurrenceId/lineup` (`shell/OrganiserRoutes.tsx:110`), reached from `flows/change/WhatChanges.tsx:81` ("Sessions and line-up"), `WhichDate.tsx:64`, `flows/change/Time.tsx:52,161,188`, `events/EditorRows.tsx:38,86`, `events/ProgrammeSeries.tsx:139` | **NO.** `useRebuildSwitch` (`shell/rebuildSwitch.ts:18`) has no caller anywhere in `src/`. Merging C9 ships every change to every organiser at once. |
| DateSheet views `time`, `move`, `copy` | inside the date page | same: NO |
| Old one-date Change flow: `/time` (`occurrence.set_time`), `/day` (`Day.tsx`, list of valid days, `A1_APPLIED`), `/copy` (`Copy.tsx`, override keys only), `/off` (Take this date off) | `OrganiserRoutes.tsx:105-113` | still mounted for everyone, unchanged |

The switch itself (`rebuildSwitch.ts:7-13`) is keyed on organiser PAGE ids, not on events. Owner decision: the switch is PER EVENT. That is the rules-shell family's to fix, but the dates screens cannot be gated correctly until it is (they would need the series id, which the date page has).

## 2. Plan rules owned (PLAN rule sheet + D1 gaps + prototype v7)

| Rule | Verdict | Where |
|---|---|---|
| 7 date edits never touch "Update live event"; one date = open that date | PASS: only `occurrence.*` commands and the occurrence programme writer (`useDateEditor.ts:150-205`) | |
| 8 one date's time = shift all its sessions | PASS on the model (`dateChanges.ts:14-21`; untimed stay untimed; past-midnight wraps 23:30-01:00 +60 -> 00:30-02:00). FAIL on the shape vs prototype: prototype v7 has an inline "Night starts" select in the date sheet labelled "(usual)" (proto 575, 609); C9 opens a second sheet of 17 buttons labelled "(now)" and re-bases on every open. NOT verified: whether the date's own start (`event_occurrence_p5` start used by calendar cards) follows a session shift, because the shift goes through the programme writer, not `occurrence.set_time`. | `DateSheet.tsx` TimeView; `index.tsx:206-214` |
| 9a cancel with a reason, server list, stays visible as Cancelled | PASS: reasons from `cancellation_reasons` (`selfServeApi.ts:265`), chips only, test pins the five labels; cancelled date keeps "Put this date back on" | `DateSheet.tsx` cancel view |
| 9b Remove "Take this date off" | **FAIL**: still on the date page (`index.tsx:283`, `date-break`) and on the Change flow (`flows/change/WhatChanges.tsx:44-51`, `/off` route). The C9 handover says "unchanged" on purpose; the brief said REMOVE. | |
| 9c bulk cancel/move stays as today (move = time AND venue) | PASS (untouched `flows/change/Pick.tsx`; tests pass) | |
| D1 one date: sessions and line-up for this date only | PARTIAL: old date session sheet, not C4 `SessionCard` (parked by C9). Judged against `ER-AUDIT-editor-cards.md`: neither the C4 card nor the C5 picker is imported by C9 (that audit's table, row "One date"). | |
| D1 add a session to this date only | PASS on wording (`index.tsx:260`); FAIL with the untimed decision: a new session must have both times (`programmeModel.ts:253` + `:437`) | |
| D1 different venue this date only | PARTIAL: old venue row, no "Add a new venue" (C5 picker not used) | `index.tsx:197-204` |
| D1 copy changes from another date | **FAIL** (F-C9-1, F-C9-2, F-C9-5) | `dateChanges.ts:40-52`, `useDateEditor.ts:210-223` |
| D1 one-off: move to another day | PARTIAL: works and is saved by Save this date (tested); FAIL design bar "pickers allow only valid values": free `<input type=date>` with an error line (prototype: a select of the next 30 days, proto 607) | `DateSheet.tsx` MoveView |
| D1 tag "Own changes" / "Own times" | PASS on the model (pure table test); NOT verified on prod shapes (handover: no survey of dates with own sessions) | `dateChanges.ts:55-65` |
| D1 APPROVED: one "Save this date", disabled "No changes" when untouched | PASS (`saveBarState` label, matrix test "untouched") | |
| One-off "Cancel the event" | PARTIAL: words right; it sends `occurrence.cancel` (date cancel), where prototype 613/618 is the event END ("It comes off the calendar."). Parked by C9 as cost "large". Result: the one-off stays `live` with 0 coming dates and joins the "live, no coming date" bucket (18 in prod) and Home "Needs dates". | `index.tsx` cancelTitle, `dateChanges.ts:68-71` |

## 3. Server as built

| Item | Verdict |
|---|---|
| `occurrence.move_date {to_date}` | PASS (`seriesCommands.ts:248`; matrix test checks the envelope). The old `Day.tsx` gates it on `A1_APPLIED`; the date page's new Day row does NOT read `A1_APPLIED`, so the rollback switch no longer covers every move control (minor). |
| `occurrence.set_override` venue (city with venue) | PASS (`venueOverridePatch`) |
| programme writer `organiser_set_occurrence_programme_v1` with version re-read after a move | PASS in code (`useDateEditor.ts:158-172`); end-to-end NOT verified |
| `occurrence.cancel` with a `cancellation_reasons` label | PASS; error "cancellation_reasons label" mapped to "Choose a reason." |
| AS BUILT: cancel a one-off is OWNER TEAM ONLY (`permission_denied: <kind> is for the owner organiser's team only`) | **Conflicts with the owner decision** (everyone has full control). The screen does not hide it (good), but a co-organiser who taps "Cancel the event" will get the generic `/^permission_denied/` text "You cannot make that change here. Ask the Bachata Calendar team." (`selfServeErrors.ts:189`): wrong and blames the wrong party. Needs the server changed (admin), not a client gate. |
| Retry of a cancel whose answer was lost | NOT handled as success: the retry sends the old `version` and whatever the server answers (conflict / already cancelled) is shown as an error (`useDateEditor.ts:226-243`). |

## 4. Shapes

The Supabase connector needs owner authorisation in this session, so no fresh survey ran. Counts below are from the C9 handover (2026-10-21, `event_occurrence_p5`, date >= today) and the plan.

| Shape | Handled? |
|---|---|
| recurring scheduled 1776 / cancelled 51 | PASS (matrix: recurring; cancelled shows "Put this date back on") |
| one_off scheduled 3 | PASS words + move; cancel semantics see section 2 |
| festival day 6 (median 6 sessions, max 14) | PASS cancel words; shift via programme (festival `set_time` is refused, so this is the only time control that works for a festival day) |
| course 19 | no course-specific test; treated as recurring. NOT verified |
| untimed sessions 223 (party 220, class 3) | Load and save untouched: PASS. Night starts row shows "No times yet", disabled: PASS. **Copy from a date with any untimed session: blocked (F-C9-1).** Adding an untimed session: blocked (F-C9-4). |
| untitled sessions 239 | **Copy blocked** ("Give this session a name.", F-C9-1) |
| past date / ended / archived | PASS: lock note, controls disabled (matrix "past one-off") |
| dates with own venue / own sessions | NOT surveyed (handover); `ownTag` tested on built shapes only |
| two-organiser events 6, co-organiser seat | No owner-only UI in `dates/**` (PASS). Server refuses one-off cancel for co (section 3) |
| no coming date except this one (copy sources empty) | Copy row hidden: PASS; helper empty text exists |

## 5. Tests

| Run (sandbox, `TZ=Europe/London`, on `0a6fcce`) | Result |
|---|---|
| `npx vitest run src/modules/organiser/dates` | 11 files, 198 passed |
| `npx eslint src/modules/organiser/dates` | exit 0 |
| `npx tsc --noEmit -p tsconfig.app.json`, errors in `organiser/dates` | 0 |
| `npm run lint:architecture` | passed |
| non-ASCII in `dates/*.ts*` | none |

Mutation probes on `dateChanges.ts` (each reverted): copy keeps old sessions -> 1 red; ownTag always null -> 3 red; shift leaves end -> 2 red; copy from a cancelled date -> 1 red; move to a past day -> 2 red. The pure tests can fail.

Gaps (where a wrong implementation still passes): the copy matrix test (`dateChanges.matrix.test.tsx:98-107`) only checks the draft fills and nothing is sent; it never saves, never uses an untimed/untitled source, never checks the payload. No test for the shift reaching the date's own start. No co-organiser shape. No one-off cancel payload test. Shape table has one-off / recurring / festival-day / past; missing cancelled-date and course rows in the new matrix.

## 6. Design (from code only; no browser walk: no signed-in organiser session in this sandbox)

- Tap targets: time options 48px, copy options 52px, rows 52px, date input 48px: PASS, explicit px.
- Entities: no raw non-ASCII: PASS (`&rsquo;` used).
- Helper paragraphs added against the design bar ("no helper paragraphs"): "Every session on this date moves with it.", "The times stay. Save this date to move it.", the copy paragraph (`DateSheet.tsx` TimeView/MoveView/CopyView). Minor.
- Cancel needs a reason AND an acknowledgement tick; prototype 603 needs the reason only. Minor.
- Contrast, clipping, sideways scroll at 390x844: NOT verified.

## 7. Dead code and duplication

- **Two "copy changes" with different rules**: `flows/change/Copy.tsx` + `changeModel.ts:278 copySources` (override keys: venue, note, picture, ticket; only dates with own changes enabled) vs `dates/dateChanges.ts:74 copySources` + `copyRowsFrom` (sessions + venue; every coming date). Same label "Copy changes from another date" on both screens (`WhatChanges.tsx:40`, `index.tsx:270`). Prototype 605: only dates with own changes, not cancelled.
- **Two "move to another day"**: `flows/change/Day.tsx` (list of valid days, A1 gated, any format) vs date page Day row (free date input, one-off only, not A1 gated).
- **Two "change the time"**: `flows/change/Time.tsx` (`occurrence.set_time`, still a free time input the plan wants gone, PLAN line 8) vs date page "Night starts" (session shift).
- **Two "Take this date off"**: date page + Change flow (both should go, rule 9).
- Three cancel-reason pickers (`dates/DateSheet.tsx`, `flows/cancel/Confirm.tsx:96`, `flows/change/Pick.tsx:35`) share the fetcher and key: acceptable.
- No new dead files.

## Findings

| id | sev | file:line | what | failing scenario | fix in words |
|---|---|---|---|---|---|
| F-C9-1 | blocker | `dates/dateChanges.ts:40-52`; `shared/programmeModel.ts:253,437` | Copied sessions become NEW rows, and a new row is validated for title and both times | Organiser copies a Friday whose party is untimed and untitled (prod shape: 223 untimed, 239 untitled): Save this date is refused with "Give this session a name." and "Enter a start time and an end time." Probe proved it on `0a6fcce`. | Copy must carry the session as it is: untimed stays untimed, null title stays null (default name shown). Either validate copied rows like stored rows, or copy as session overrides on the series sessions rather than new rows. Add the shape to the matrix and run it red first. |
| F-C9-2 | major | `dates/dateChanges.ts:40-52` | Copy removes every series session on the target and re-adds the source's as date-only sessions | Copy an "As usual" date onto another: the target becomes "Own changes" for ever, stops following series edits ("Update live event" skips it, rule 7), and people in roles an organiser cannot add are silently dropped (`isEditableRole` filter) | Copy only what differs: if the source has no own sessions, copying means "back to the series sessions" (undo own changes); if it has, copy its overrides/added sessions, keep series sessions where they match. Keep non-editable people. |
| F-C9-3 | major | `dates/index.tsx:281-285`; `flows/change/WhatChanges.tsx:44-51` | "Take this date off" still offered | Rule 9 says remove it; organisers keep two ways to drop a date, one without a reason or a Cancelled trace | Remove the row from the date page; remove the `/off` row and route behind the switch |
| F-C9-4 | major | `shared/programmeModel.ts:437` (used by `dates/index.tsx` validation) | "Add a session to this date" cannot be saved without both times | Owner decision: untimed is valid. An organiser adding a party with "times TBC" is blocked | Block only a half-filled time or end before start (next day fine); same rule as the C4 fix (editor-cards F-C4-1/2) |
| F-C9-5 | major | `shell/OrganiserRoutes.tsx:110`; `shell/rebuildSwitch.ts:18` | Nothing in the dates family reads the rebuild switch, and the switch is per organiser page, not per event | Merge C9: every organiser gets the new date page controls at once while the old Change flow's time/day/copy/off still sit one tap away with different rules | Rules-shell: make the switch per event (series id list). Dates: show the new controls only when the switch is on for this series; hide the Change flow duplicates when it is on |
| F-C9-6 | major | `dates/index.tsx` cancelTitle; `dateChanges.ts:68-71` | One-off "Cancel the event" sends `occurrence.cancel`; prototype ends the event | The one-off stays `live` with no coming date, shows up as "Needs dates" on Home | Send the event-level end/cancel the prototype means, with the reason; needs the server to let every organiser on the event do it (section 3). Park for owner if the server will not change |
| F-C9-7 | major | `shared/selfServeErrors.ts:189` | AS BUILT owner-team-only refusal mapped to the generic "Ask the Bachata Calendar team." | Co-organiser taps "Cancel the event" on a one-off: wrong reason shown. Owner decision says this must work | Server change (admin): drop the owner-team check for cancel a one-off and stop repeating. Until then map the text to a plain line, never a hidden control |
| F-C9-8 | major | `dates/DateSheet.tsx` MoveView | One-off move uses a free date input with error lines | Organiser picks a past day / same day and gets an error, against "pickers allow only valid values" | A list of the next 30 days minus taken days, as `flows/change/Day.tsx` `moveDays` already builds; reuse it |
| F-C9-9 | major (not verified) | `dates/useDateEditor.ts:186-200` | Time shift goes through the programme writer only | If the occurrence's own start is not recomputed from sessions, the calendar card keeps the old time while the sessions move | Check on admin how `organiser_set_occurrence_programme_v1` treats the occurrence start; if it does not follow, send `occurrence.set_time` with the shift (not festival) |
| F-C9-10 | minor | `dates/useDateEditor.ts:226-243` | A retried cancel is not success | Answer lost, organiser taps again: error shown though the date is cancelled | Treat "already cancelled"/version conflict on a cancel as success after a re-read shows Cancelled |
| F-C9-11 | minor | `dates/index.tsx:216-224` | New Day row ignores `A1_APPLIED` | Rollback switch set false: Change flow hides Move, date page still offers it | Read `A1_APPLIED` in both |
| F-C9-12 | minor | `dates/DateSheet.tsx` TimeView | Night starts is a second sheet with "(now)" instead of the prototype's inline select "(usual)" | Two taps more than v7; after one shift, "(now)" no longer shows the usual time | Inline select in the date sheet, base on the series usual start |
| F-C9-13 | minor | `dates/DateSheet.tsx` | Helper paragraphs; reason + tick where v7 needs reason only | Extra reading/taps on phone | Drop the paragraphs; drop the tick or record the difference |
| F-C9-14 | minor | `dates/dateChanges.ts:74-78` | Copy lists every coming date; prototype lists only dates with own changes | Long list of "As usual" dates for a weekly with 30 coming dates | Filter to own-changes dates (as the prototype and `Copy.tsx` do) |

## Full control (owner-only that still says or enforces it)

- `dates/**`: no owner-only copy, disabled state or hidden control. PASS.
- `flows/change/WhatChanges.tsx:18` and `Copy.tsx:23`, `Pick.tsx:26`: comments say "owner/manager"; code does not gate on it. Comments only.
- SERVER (AS BUILT, admin AD1): cancel a one-off and stop repeating are owner-team-only. This enforces owner-only against the owner decision; the date page's "Cancel the event" will be refused for a co-organiser (F-C9-7). Needs owner/admin.

## Verified / Not verified

Verified (sandbox, on `0a6fcce`): dates tests 198/198; 5 mutation probes red; probe test proving F-C9-1 (deleted after the run); eslint dates 0; tsc errors in dates 0; architecture guard passed; routes traced by grep; no `useRebuildSwitch` caller.

Not verified: prod shape survey (Supabase connector not authorised in this session; numbers are from the C9 handover); browser walk at 390x844; end-to-end server round trip; whether a session shift moves the occurrence start; AD1/AD2 handovers (admin repo not in this session's scope: judged from ER-INTERFACE AS BUILT); full `npm run lint` chain, `npm run build`, e2e (not run for a read-only audit).
