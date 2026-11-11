# Handover: p3-dates-conflict-nit-1

Walk nit from PR #1316: on a save version conflict the date sheet stacked the generic "Someone changed this first. Check it." (`p3-sheet-error`) over the W-35 `ConflictNote`.

## Fix
`DateSheet.tsx` `useGo` remembers the message a version conflict left in `error` and returns `sheetError` (null while `conflict` and `error` is that same message). Only the Name/Photos/Price field sheets and the About/Ticket sheet use `sheetError`, since those are the sheets that show `ConflictNote`. Confirm/cancel/move sheets still show the generic line. A failed Start again sets a different message, which still shows. `VERSION_CONFLICT` untouched; `DateFieldSheets.tsx` unchanged (it receives the already-filtered `error`).

## Red first (current main, new cells)
```
Tests  5 failed | 51 passed (56)
FAIL W-35 ... > conflict          expected <p class="p3-error"> to be null
FAIL one-message > name / conflict, about / conflict, ticket / conflict, photos / conflict
```
## Tests
`datesFix.matrix.test.tsx`: Name, About, Ticket, Photos x {conflict, offline, refused}; conflict shows `p3-conflict-why` and no `p3-sheet-error` / "Check it"; offline/refused keep `p3-sheet-error`.

## Not verified
Price sheet has no direct cell (needs a valid price draft); it shares `FieldSheet`/`sheetError` with Name and Photos. No browser picture (the lead walks).

## Gates (all green)
vitest src/modules/organiser: 250 files, 10281 passed, 4 skipped. npm run lint: 24 of 24 links (eslint informational). check:integrity ok. check:mojibake ok.
