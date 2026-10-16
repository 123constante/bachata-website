# axe on every J row END (GAPS G-A2)

`tests/e2e-build/public-journeys.build.spec.ts` runs `@axe-core/playwright` (already a devDependency) on the END
screen of all 32 J rows (+ the 360x780 repeat) in the production build at 390x844, and fails on any
serious or critical violation. `AXE_KNOWN` in the spec lists tolerated rule ids per row (empty).

Result on this branch: 33 of 33 pass, and axe reported **no violation of any impact** on any END. So no row is
marked. (Measured with `AXE_LOG=<file>`, which writes every violation axe found, per row.)

Non-vacuity: with a `<button></button>` injected before the scan, `deep-link-app-signed-out` failed with
`button-name (critical): #mutant`; the mutant was reverted.

Limit: axe checks the END screen only, not the cards on the way, and cannot judge focus order. Keyboard-only
walks (G-A3) are not part of this slice.
