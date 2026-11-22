# Editor v2 slice 7a handover (Session sheet)

## Built
- `v2/SessionSheetV2.tsx` (new): controlled `SessionSheetV2` plus exported `groupsFor`, `lostOnTypeChange`, `timesProblem`.
- `v2/PeopleGroup.tsx` (new): label, chips with x, "None yet", search + Add, or read-only.
- `v2/copy.ts` (+23): `V2.session` block incl. toast builders `savedNight`, `savedEvery`, `savedOneOff`.
- `v2/v2.css` (+17): `.flab .fld .chipsw .tchip .pchip .pickrow .pickres .pickopt .two .err`, sheet `.grp` padding reset. `.warn`, `.btn.dan`, `.hint` already existed.
- `__tests__/session.test.tsx` (20 tests). NOT wired into EditorV2 / NightV2 / ProgrammeSheet (7b does that).

## Deviations and assumptions
- Performance "Dancers": SHOW ONLY (owner click 2026-11-22): no x, no Add, hint "The team adds performers."
- Party with old dancers: chips shown with NO x (the writer refuses removing non-teaching/djing roles; `removePerson` returns the row unchanged), no picker, hint shown. Differs from prototype SH-SES-11 "with x".
- A STORED session's type chips are locked (`setSessionType` leaves a stored type alone); the pressed chip shows, others are disabled. New sessions change type freely.
- Type change removes nothing until Done; the warning is derived from the current type, so switching back clears it. Done drops editable people the type lost via `removePerson` (stored ones become `removed`, added ones go) and levels for non-Class/Masterclass.
- `open_level` stays on the session untouched; only the 4 chips are offered. Lost-levels warning ignores `open_level`.
- Picker: plain text input (min 2 chars via `PEOPLE_SEARCH_MIN`), result list, tap one then Add; not debounced.
- `ctx` and `dayLabel` are accepted but unused in 7a (7b uses them for toast wording).

## TAP TABLE (proven by component tests; screen walk in 7b)
| # | Button | Destination | prototype/OLD |
|---|---|---|---|
| 43 | Class / Masterclass / Party / Performance | same sheet redrawn, warning when people no longer fit | prototype |
| 44 | Beginner / Improver / Intermediate / Advanced | same sheet, chip toggled | prototype |
| 45 | Add | same sheet, person chip | prototype |
| 46 | x (Remove name) | same sheet, chip gone | prototype |
| 47 | Done | error and stays open, else `onDone(row)` | prototype |
| 48 | Remove this one | `onRemove(row)`; disabled at count<=1 | prototype |

## Props contract for 7b
`{ row: DraftSession | null; count: number; ctx: 'night'|'usual'; dayLabel: string; onDone(row); onRemove(row); onClose() }`. Always rendered open (parent mounts/unmounts it). No saving; parent owns toast (`V2.session.saved*`) and Undo.

## Verified / Not verified
- Verified: `vitest run src/modules/organiser/p3/v2`: 12 files, 156 pass (20 new). `check:mojibake` clean. eslint: 0 errors.
- tsc -p tsconfig.app.json run: 0 errors in files I touched.
- Not verified: 390x844 walk (not wired), prod shape survey, pre-ship, /code-review. Flag OFF; no PR (per brief).
