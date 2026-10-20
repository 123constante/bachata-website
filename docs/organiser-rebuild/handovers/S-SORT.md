# S-SORT handover -- programme auto-sort follows the day-rollover rule

## Change
- `src/modules/organiser/events/programmeSeriesModel.ts` (`startMinutes`, used by `sortSessions`): sort key = minutes since midnight, +24h when the start hour is before `ROLLOVER_HOUR`. No start still last; ties stable; END time never used.
- `src/lib/programDayRollover.ts:20`: `ROLLOVER_HOUR` now `export`ed; no other line changed.
- Tests: `src/modules/organiser/events/__tests__/fixSw1.matrix.test.tsx` (8 new table rows, "S-SORT ...").
- Walk: `tests/e2e/walk-ssort.spec.ts` (throwaway, not in the gate), screenshot `docs/organiser-rebuild/walk-SORT/a-programme-overnight-sorted.png` (Warm up, Beginners, Social, After-party last; read by me).

## Red first
On the unfixed head: 6 failed / 2 passed of the 8 new rows (the 2 passes are the 08:00-first and overnight-END rows, which the old clock sort already satisfied).

## Mutation table
| Mutant | New-test result |
|---|---|
| remove the +24h rollover addition | 6 failed (red) |
| `< 7` instead of `ROLLOVER_HOUR` | 3 failed (red: the 07:59 rows) |
| real code | 69/69 pass |

## Rollover consistency
`node scripts/check-day-rollover-consistency-v1.mjs` -> exit 0, "day-rollover rule is consistent".

## Per-job (sandbox)
| Command | Result |
|---|---|
| `npx vitest run src/modules/organiser src/modules/admin-organisers` | exit 0: 121 files, 3468 passed, 2 skipped |
| `npm run build` (production) | exit 0 |
| `bash bin/check-integrity.sh` | exit 0, 0 issues (the file is not executable here, so `npm run check:integrity` gives exit 126: sandbox mode bit, not code) |
| `npm run lint` | 19 of 20 links green; only `check:integrity` red, for the 126 above, which then skipped eslint |
| `tsc --noEmit -p tsconfig.app.json` | 98 errors, identical count on the unchanged head (pre-existing, none in files I touched) |
| `node scripts/check-day-rollover-consistency-v1.mjs` | exit 0 |
| GitHub Actions | not run by me |

Walk build used `AW1_APPLIED=true` and `VITE_ENABLE_ORGANISER_SELF_SERVE=true` locally; the flip is NOT committed.

## Verified / Not verified
Verified: red-first, both mutations, existing organiser tests green (untouched programme stays clean), rollover script, prod-build walk at 390x844 on the mocked backend.
Not verified: GitHub Actions on this head; the real-data shape survey against prod (the change is a pure sort key); a real phone; the `check:integrity` npm wrapper (ran via bash instead); eslint link was skipped by the chain.
