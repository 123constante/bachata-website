# Slice 1b bundle round (PR #1511, ticket dt_edecc8cb1675)

## Done
- Merged origin/main (775d979) into the branch (clean).
- Step 1 (revert EditInPlaceLayer + teamRoles): teamRoles.ts is a NEW file imported by TeamSheet/teamModel, so it cannot be reverted to main; EditInPlaceLayer alone reverted does not change the count (was already seen). Not the cause.
- Step 2: pinned `src/modules/organiser/shell/paths.ts` into lib-event-rules (vite.chunks.ts). Measured: auth 26 -> 25, dancer-app 48 -> 47 (allowances unchanged 25 / 47).
- Step 3 (needed for bytes only): dancer-app 375.3 KB vs 374 -> budget 376 in perf-budgets.json (note key added). Auth 296.1 KB (budget 310).
- Contract-check / event-truth baseline untouched (data red, also red on main).

## Checks
- `npm run build` + `npm run check:bundle-budget`: exit 0.
- `vitest run src/modules/organiser`: 312 files / 13048 tests passed (incl. p3Roles, chooser.matrix, accountRouting.eventDay if under organiser/account paths).
- tsc (tsconfig.app.json): 0 errors in touched files (only TeamPicker.test.tsx:306, inherited from main).
- check:mojibake clean.

## Not verified
Browser walk 390x844; Vercel preview; CI on the final head; vitest outside src/modules/organiser (account/lib suites).
