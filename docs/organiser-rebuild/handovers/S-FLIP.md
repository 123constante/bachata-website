# S-FLIP handover (branch claude/org-r1-flip-gates, base main 03f37b4)

## Change
- `shared/a1Gate.ts:2` A1_APPLIED = true (comment: 20261129060000/070000); `shared/parityGate.ts:6` AW1_APPLIED = true (20261129100000/110000). Gate files stay as rollback switches.
- `dates/index.tsx` SessionRow: removed row with `original.removed === true` reads "Removed from this date"; draft removal keeps "Comes off this date when you save"; Undo stays on both.
- NEW `shared/appliedMigrations.json` + `__tests__/gates.applied.test.ts` (guard).

## Tests touched
- NEW `dates/__tests__/removedCopy.test.tsx` (saved vs draft, table-driven).
- NEW `events/__tests__/lifecycleGate.test.ts` (keeps OFF-state coverage of goLiveReason via a1=false).
- `__tests__/consistency.dates.matrix.test.tsx`: `change-day` now expected present (was null) -- 10 rows.
- `__tests__/pseries.parity.test.tsx`: draft Go live reason now "To go live, ..." with no platform-update text.
- Other mocks (`pdates.flow` gate.a1 false/true, `change.flow`, `consistency.render`, `sw1.parity` gate) already pin explicitly; untouched.

## Red-first
- Copy fix on unfixed head: removedCopy 1 failed / 1 passed (saved row showed "Comes off this date when you save").
- Gate flip: with gates true and old tests, 11 failed (10 consistency.dates.matrix change-day, 1 pseries go-live reason) -> updated -> 0 failed.
- Guard on the unfixed head (gates false) would fail both gate rows; shown by mutation below.

## Mutation (guard)
| mutant | result |
|---|---|
| A1_APPLIED=false | gates.applied: 1 failed (A1 row) |
| AW1_APPLIED=false | gates.applied: 1 failed (AW1 row) |
| restored | green |

## Gated controls with the gate ON
Programme Save (disabled until an edit, screenshot), Go live, Move to another day, new-event Go live/draft note all switch with the constants. Remaining copy mentioning "next platform update" (`lifecycleModel` GO_LIVE_READY/A1_REASON, `new/model` DRAFT_*, PARITY_GATE_REASON) is only reachable when a gate is false; none shows when ON (checked by tests + walk).

## Per-job table (local; Actions not run)
| command | exit |
|---|---|
| `npx vitest run src/modules/organiser src/modules/admin-organisers` | 0 (124 files, 3484 passed, 2 skipped) |
| `npm run build` (VITE_ENABLE_ORGANISER_SELF_SERVE=true) | 0 |
| `npx tsc --noEmit -p tsconfig.app.json` | errors: 99 on main AND 99 here (pre-existing, none new) |
| `npm run lint` | 19 of 20 links PASS; `check:integrity` exit 126 (bin/check-integrity.sh not executable in this sandbox); eslint link skipped by the chain |
| playwright `tests/e2e/walk-flip.spec.ts` (throwaway, not in gate) | 0 |

## Screenshot
`docs/organiser-rebuild/walk-FLIP/01-programme-save-enabled.png` (390x844): read it; Save is enabled after a rename, no "Needs the next platform update" copy.

## Verified / Not verified
Verified: above, against route-mocked prod-shaped programmes.
Not verified: real prod walk of the unlocked controls (orchestrator's next step); check:integrity; GitHub Actions jobs; real-data shape survey of occurrence override rows (copy fix relies on `removed:true` on the reader, as in the existing wire shape).

## FIX round (S-FLIP-FIX)
- Changed: `tests/e2e/organiser-events.spec.ts:66` now expects the gate-ON wording "Choose a photo to go live." (= `coverStepReason(false, true)` in `flows/new/model.ts`). A literal, not an import: importing the model into a Playwright spec pulls in `integrations/supabase/client.ts` (`import.meta.env`) and the spec fails to load. The comment names the source.
- Other strings that only exist when a gate is false, checked in the `test:e2e` list and `tests/e2e/**organiser*`: none. Hits exist only in `walk-sw1`, `walk-p-series`, `walk-fix-sw1`, `walk-flip` (throwaway walk specs, NOT in the `test:e2e` list; not changed, they would need a gate-aware update if ever promoted).
- e2e counts (`npm run test:e2e`, dev server as in e2e-smoke.yml, VITE_ENABLE_ORGANISER_SELF_SERVE=true): before (GitHub) 1 failed (organiser-events:30) + known flake; after (sandbox) 156 passed, 1 skipped, 2 failed (`dancer-app/home-nights:75`, `organiser-home:55`); both re-run alone: 11 passed. No product copy or gate touched.
- Per-job table: Actions not run locally; see PR #869 checks after push.
- Verified: whole `test:e2e` list locally. Not verified: GitHub Actions on the new head; the 2 sandbox failures are attributed to load (pass on isolated rerun), not proven.
