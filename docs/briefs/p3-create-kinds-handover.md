# p3-create-kinds handover

**Done:** Course / Festival / Online in `p3/new/CreateFlow.tsx` are now enabled; a tap goes to the classic form
`/account/o/new/what?kind=<kind>[&o=<page>]`. Pill copy is "Opens the classic form" (`CLASSIC_FORM`, was `COMING_SOON`).
`kindTarget()` in `p3/new/model.ts` is the one mapping. `p3/shell/paths.ts` exports `CLASSIC_CREATE_PATH`,
`CLASSIC_CREATE_KINDS`, `isClassicCreateAllowed(pathname, search)` and `P3_PATHS.classicCreate` (slice 1 / p3-landing
imports these for its `/account/o/*` redirect exception).

**Finding:** the classic flow CANNOT preselect these kinds (it only knows `format=recurring|one_off`; its own model says
course/festival are never created in R1). `?kind=` is ignored there, so the person lands on the classic kind picker.

**Tests:** new `classicKinds.matrix.test.ts` (kind x page count x page named, allow-list cases); render tests for the three taps.
`npx vitest run src/modules/organiser`: 237 files pass. tsc clean.

**Not verified:** `check:bundle-budget` (needs `npm run build`; CreateFlow is lazy, paths.ts already in first load);
prod data-source read (no data read: pure routing); 390x844 browser walk; full CI job set; code review.
Pre-existing eslint error in `onboarding/OnboardingFlow.tsx:112` (not touched).
