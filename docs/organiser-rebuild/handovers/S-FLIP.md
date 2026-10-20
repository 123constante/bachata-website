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
