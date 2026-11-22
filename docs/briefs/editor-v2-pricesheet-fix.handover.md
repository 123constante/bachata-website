# Handover: editor-v2 PriceSheet fix

## What changed
`src/modules/organiser/p3/v2/PriceSheet.tsx` (`NightPriceSheet`):
- `writeAll` takes `{ id, pence, before }[]` and rolls back from each entry's own `before`. It no longer reads `byId` for rollback.
- `saveTickets`: `before` read at tap time. Undo entries are `{ id, pence: before, before: written }`.
- `backTickets`: write entries `{ pence: null, before: nightPence }`. Undo entries `{ pence: nightPence, before: null }`.
- `backTickets` with `changed` true: if `onBack()` returns `{ok:false}` or throws, the cleared night prices are written back, then the failure is returned (its `error`, or `P.notSaved` on a throw). The success path is unchanged.

## Tests
New `src/modules/organiser/p3/v2/__tests__/priceSheetFix.test.tsx` covers D1a-c and D2a-d. D1a, D1b, D2a and D2b fail on the old code. D1c, D2c and D2d are regression tests. All of `src/modules/organiser/p3/v2` is green (37 files, 429 tests).

## Verified
- vitest on the v2 folder, run before and after the fix as above.
- tsc run on the branch head: 0 errors in branch files (tsconfig.app.json; 162 errors elsewhere, none in these files).
- `npm run check:mojibake`: clean.

## Not verified
- No live RPC calls and no production data shape survey (behaviour-only change, mocked `setNightPrice`).
- No browser walk (no visual change; flag `organiserEditorV2` stays off).
- `npm run pre-ship` and the other CI jobs not run locally.
