# Editor v2 slice 1: save engine, handover

Branch `claude/editor-v2-s1c` (existing PR 1865). Flag `organiserEditorV2` stays OFF; zero migrations; SaveBar.tsx, screens, R4* untouched.

## Done
- `editorModel.ts`: `inverseOf(step, before)` plus the `StepBefore` type. Kinds with an inverse: series.upsert, series.set_recurrence, series.set_lifecycle, series.set_program, series.set_organisers, occurrence.set_override, occurrence.set_time (old times, or reset), occurrence.cancel (both ways), programme replace. Anything else, or a `before` that misses a sent key, returns null (toast without Undo). Each kind and its inverse is listed in the test.
- `saveNow.ts`: `useSaveNow(seriesId, seriesVersion)` wraps `useV2Save().run` (no second runner, `runHeld` keys kept). `saveNow(steps, before, label = 'Saved', {noUndo})` returns `{ok, error}`. Success shows the toast, with Undo only when every step has an inverse. Undo runs the inverses in reverse and shows "Undone" (no Undo). A failure shows no toast and returns the error text. A second tap during a run returns `ok:false, error:null`.
- `V2Toast.tsx`: portal to body, #1C1C1C, white 15px, radius 10, left/right 12, bottom 76, Undo min-height 36, border 1px #FFFFFF66, weight 600, 8000 ms with Undo and 2200 ms without, role=status, a new toast replaces the old and resets the timer, never takes focus.
- Tests: `__tests__/saveNow.test.ts` (inverse per kind and round trip, undoPlan order and versions, toast times, no-inverse, failure, double tap, 390x844 box math).

## How the next slice uses it
`const { saveNow, toast, onToastDone } = useSaveNow(id, version)`; render `<V2Toast toast={toast} onDone={onToastDone} />`; pass `before` as one entry per step (the values read before the write). Cancel night, bring back, cancel event, refund, copy link, switches: pass `{ noUndo: true }`.

## Left / next steps
- Nothing wires the engine yet (slices 2 and 16 own SaveBar and the screens), so no UI path changes and the flag-off app is untouched.
- Undo's occurrence version is estimated as step version + 1 per earlier write to that night; a refetched version would be safer once a screen calls this (a conflict shows "Couldn't undo").

## Verified / Not verified
- Verified: `npx vitest run src/modules/organiser/p3/v2` 88 passed; eslint on the v2 folder 0 errors; `check:mojibake` clean.
- tsc run on the pre-commit tree: 0 errors in branch files.
- Not verified: `check:bundle-budget` (needs a build; the new files have no importer, so zero bytes in /app first load by construction); browser walk (no screen uses it yet); real Undo against prod.

## TAP TABLE
| button | destination | prototype/OLD |
|---|---|---|
| Undo (toast) | last change put back, toast "Undone" | prototype (row 34) |
