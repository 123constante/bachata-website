# Handover: slice 1b (grid + rows), branch `claude/account-grid-1b`

## Done
- `docs/account-system/` copied from `claude/account-system-plan`; `journey-grid.json` is now the file the check reads
  (schema `version: 1` unchanged; 85 rows). `JOURNEY-GRID.md` regenerated with `build_grid.py`.
- Deletion rows renamed per the owner decision: `ac.erase`, `ac.erase.sole-owner`, `ac.erase.admin`,
  `ac.erase.re-signup` replaced by `ac.delete.hide`, `.restore-30`, `.after-30`, `.refused-sole-owner`,
  `.admin-erase` (`built: PLANNED`, no refs, so they sit in the baseline). PLAN.md PR-5b line updated.
- Every `covered_by` ref resolved against `main` (script: J ids in `publicEntryJourneys.ts`, R titles in
  `tests/e2e-build/*.build.spec.ts`, E specs in `test:e2e`, U files exist). ~25 rows gained refs the #764 specs and
  the 13 extra J rows already provide; 3 stale refs fixed (`dl.new.closed-tab` U-with-anchor -> J
  `signin-unfinished-dancer`). Rows flipped `NOT BUILT` -> `BUILT` because #764 built them: `si.empty`,
  `ti.other-person`, `ac.signout.storage`. All 32 J ids are referenced by a row (rule 5 holds).
- axe on every J row END in `public-journeys.build.spec.ts` (+ `AXE_KNOWN`, `AXE_LOG`); see `AXE.md`. 0 violations.
- `BASELINE-PROPOSAL.md`: rows that cannot be covered yet, with the PR that covers each.
- No change under `src/`. `@axe-core/playwright` was already in devDependencies.

## Decisions and deviations
- Brief names kinds J/R/W; the committed JSON schema uses J/R/E/U/OTP (no W). Kept the JSON's kinds ("exactly as on
  the plan branch"); walks that are only screenshots are cited through their J id.
- Ratchet detail for 1a: `si.signup-refused` cites a file using `it.each(` (see BASELINE-PROPOSAL.md note).
- Template R title `si.org2` is `two-orgs+dancer: "Continue as..." ...` (expansion of the spec's `for` table).
- New specs for uncovered rows were NOT added (all remaining gaps need either OTP/PR-3 behaviour or a new fake);
  they are listed in BASELINE-PROPOSAL.md.

## Red-first
- axe mutant: `<button></button>` injected before the scan; `deep-link-app-signed-out` failed with
  `button-name (critical): #mutant`. Reverted. Spec not run against unfixed `src/` (no src change).

## CI per-job (sandbox)
| Command | Exit | Result |
|---|---|---|
| `npx playwright test --config playwright.build.config.ts tests/e2e-build/public-journeys.build.spec.ts` (production build, 390x844) | 0 | 33 passed incl. axe |
| `npx vitest run tests/journeys` | 0 | 75 passed |
| ref-resolver script (J/R/E/U) | 0 | 3 flagged, all resolver artefacts (template title, escaped quote, `it.each`) |
Not run: the full `npm run lint` chain, `pre-ship`, the other build specs (unchanged), `check:journey-grid`
(slice 1a, not on this branch).

## Verified / Not verified
Verified: refs resolve; 33 build walks green with axe; mutant red. Not verified: shape survey on prod (no row
needed a count), the lint chain end to end, keyboard-only walks (G-A3), a real phone.

## Left
- Integration: apply 1a, run `--write-baseline` once (should list the rows in BASELINE-PROPOSAL.md). Turn 1a's
  "grid file absent -> SKIP" into a hard fail now the file exists.
- Optional: build walks for the "walk missing" rows (claim card, invite dead token, dancer-link signed-in).
