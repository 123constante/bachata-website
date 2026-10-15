# Handover: site-nav-top (PARTIAL)

## What changed
- `BottomNav.tsx`: sticky 46px row at top-[60px], md:hidden, 4 links 44px tall, active bar at bottom edge.
- `AppChrome.tsx`: BottomNav rendered right after the header spacer; bottom spacer replaced by a safe-area-only spacer.
- `index.css`: home map height subtracts 106px (60 header + 46 row), was 124px.
- Bottom-fixed bars now at the real bottom edge: `VenueStickyBar`, `EventStickyActionBar`, edit-in-place `layers.tsx` (BOTTOM_NAV_OFFSET) and `EditInPlaceLayer.tsx` spacer.
- Tests: `fixedLayers.test.tsx` updated + new pin (nav sticky, not fixed/bottom-0, between header and main); the two Save-bar e2e specs now assert the bar is clear below the row; new `tests/e2e-phone/site-nav-top.phone.spec.ts` (390x844 / 360x780; `SHOT_DIR=<dir>` writes screenshots).

## Decisions
- Row is md:hidden everywhere: the desktop header already carries the same links; a fixed desktop bottom bar would contradict "nothing fixed at the bottom".
- Header person icon / account menu / accountRouting.ts untouched.

## CI per-job (sandbox)
tsc clean; `npm run build` 0; check:bundle-budget, check:first-load-requests, lint:architecture, check:legacy-tables, check:legacy-program-rpcs, check:mojibake all 0; edit-in-place vitest 738 pass.
`npm run test:unit`: 15 fail in integrityCouldNotRun, eventViewCompat.contract, occurrenceProgram.contract, publicEventPageLineup.contract. First two fail identically on main; the contract ones need the live DB (not re-run on main).

## Not verified
- New phone spec NOT run to a result (dev-server warmup too slow). No screenshots, no measurements, no production-build browser walk.
- Not run: lighthouse/doc-weight, e2e-smoke, full phone-qa, seo/og checks.

## Next steps
1. `SHOT_DIR=$PWD/docs/review-packs/site-nav-top/after npx playwright test --config playwright.phone.config.ts site-nav-top --project phone-390x844`; fix failures.
2. Same on a main checkout into `before/`.
3. Production-build preview check at 390x844 and 360x780.
4. Remaining workflow steps; open PR (template, `## Verified on real data`, `## Phone QA`, per-job table, DECISIONS).
