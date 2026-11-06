# Handover: p3-scope-ask-web (dt_c4a894798874)

Branch `claude/p3-scope-ask-web`. Flag `organiserP3` is OFF on prod; the old area is untouched. No migration, no new RPC, no dependency.

## Built
- `p3/model/scopeAsk.ts` (pure): `scopedChangesOf(plan, nameChanged)`, `needsScopeAsk`, `scopeChoices`, `previewLine`, `FIELD_WORD`, `previewKeysOf`.
- `p3/data/scopeAsk.ts`: `previewScope`, `sendScoped`, `buildScopedEnvelope`, `heldKey` (through `supabase.rpc`, narrow cast: the two RPCs are not in the generated types).
- `p3/screens/ScopeSheet.tsx`: the "Which dates?" Sheet + `useScopedRun` (holds the idempotency key across sheet close/reopen until success or Start again).
- Details and Prices: Save opens the sheet when a scoped field changed AND the event is not a one-date event; otherwise today's code path, unchanged.
- `model/saveWords.ts`: ONE added export `keptDatesLine`; existing strings untouched.

## Table of cases (what Save sends)
| scoped field changed | unscoped changed | future dates (preview) | sheet | choice -> write |
|---|---|---|---|---|
| no | any | any | none | today's `series.upsert` |
| yes | any | event has 1 date (workspace) | none | today's `series.upsert` |
| yes | any | preview says < 2 | opens, then closes at once | today's `series.upsert` |
| yes | no | >= 2 | yes | All N -> `series_scoped_change_p5` all_dates; one date -> this_date |
| yes | yes | >= 2 | yes, "Just one date" disabled with reason | All N -> today's single `series.upsert` (overrides kept by the data); no scoped call |
Venue without a city is treated as unscoped (stays in the upsert).

## Deviations to know
- The workspace page is checked first (`hasOneDate`); the preview's `totals.dates` decides after that, so a "2 dates in the list but 1 future" event opens the sheet for a moment and then saves as today.
- Two existing send-test servers (`editScreens.send.test.tsx`, `seriesGallery.matrix.test.tsx`) now answer the preview with one future date so their multi-date fixtures keep their "Save sends the upsert" meaning. `w3a.matrix` and `saveWords.matrix` untouched.
- Render tests use the venue (not a cover upload) as the scoped Details field; cover/gallery are covered in the model and data tables.
- Preview asks the venue as `venue_id` (the API says either key reports both).
- `this_date` success saves with the series version unchanged (`form.saved(null)`).
- The brief's files `docs/design/scope-ask-api.md` / db handover were read from the admin repo (not in this repo).

## Verified
- New tests: model 49 + 3 real shapes, data 10, render 9; red first (modules missing), then green.
- `npx vitest run src/modules/organiser/p3`: 88 files, 4987 passed, 2 skipped.
- `npx tsc --noEmit`: clean. `npm run lint`: 24 of 24 links green (eslint link informational). `npm run check:mojibake`: clean.

## Not verified
- Perf budget / architecture-guard / `check:legacy-*` / full `pre-ship` not run by this worker; Vercel/CI checks not seen. The sheet is a new import of two lazy P3 screens only.
- No real owner walk on prod-shaped data, no 390x844 / 320x568 browser walk, no preview on a series with 52+ dates, no phone.
- No `/code-review` round run (cloud worker).
