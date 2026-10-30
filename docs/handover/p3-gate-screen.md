# Handover: P3-GATE, the A1 gate sheet and refusal routing

Branch `claude/p3-gate-screen` (from main 21364be). Brief `brief/p3-gate-screen`. Design record:
`docs/design/p3-gate-screen.md`.

## Done

- `src/modules/organiser/p3/onboarding/gate.ts`: a tiny store plus `useGatedCopy()` / `gatedCopy(e, copy)`, THE
  routing rule. An `onboarding_incomplete` refusal (`isOnboardingRefusal`) opens the gate with the page and codes its
  DETAIL names (`refusalFacts`) and returns null (no error line); anything else returns `copy(e)` unchanged. It never
  opens with no GateHost listening, from an unmounted screen, or for a screen the person has left.
- `GateHost.tsx` (mounted once in `P3Shell.tsx`) and `GateSheet.tsx` (lazy): "A few details first", body, "N
  things left" with one row per missing code, Continue to `p3StartReview(page)`, Not now. Loading, read failed
  (+ Try again) and admin (never shown) states; never "finished" for a refused write (the refusal's codes show). A
  page not the person's: Continue to their own details, or off with a reason. Leaving the screen closes it.
- `gateModel.ts` (pure): the sheet's facts from graceModel's ONE count and Review's ONE row mapping.
- `graceModel.ts`: `GraceStatus.missing` (the codes behind `left`) and `onboardingMissing(s)`; `left` is now
  `missing.length`, the same number as before.
- Wired: EditTray (`useSaveRun`), CancelEventSheet, Toast Undo, StatusSheet, DateSheet (`useGo`), SessionSheet,
  RepeatSheet (save and preview), and `data/sessions.ts` `useDateSend` (passes the refusal up unchanged).
- `scripts/lint-runtime-architecture.mjs`: `gate.ts` and its matrix allowed to read the refusal's `organiser_id`
  (the established boundary-parser allow-list).
- `screens/Sheet.tsx`: a sheet stack (only the topmost answers Escape) and a `useId` title id per sheet.
- Tests: `p3/onboarding/__tests__/gate.matrix.test.tsx` (surfaces x outcomes x status x role, data writes,
  a brace-matched scan of every catch in `p3/screens` with a self-test, gateView per shape, two pages one complete,
  copy rules). Red first: 54 of 166 failed against the unfixed screens. Review fix round:
  `gate.fixround.test.tsx`, 7 of 7 red against e984ac1. `tests/e2e/p3-gate-sheet.spec.ts` (real components via
  `tests/e2e/harness/gateHarness.tsx`) is in `test:e2e`; mutation-proven on `preventScroll`.
- Prod read-only SQL (2026-10-30): only `confirm_organiser_contact_v1` and `skip_organiser_about_v1` write
  `organiser_onboarding_progress` (0 rows); the status RPC and the gate's DETAIL shape are recorded in the PR.

## Left (not done, on purpose or out of scope)

1. **Entry gate** (A1's "any create/edit entry while status says incomplete"). Not built: the flag is OFF and 0
   people are complete, so it would hold everyone. When built it must read `gate_on` from the status read.
2. **Tickets** (`p3/tickets/*`): not routed. Their RPCs do not call the gate yet (scope S8); when S8 lands,
   wrap their catches with `gatedCopy` too.
3. **PlanStepError** (DateSheet's two-call composite): a refusal on the SECOND call would keep its "half
   reset" words and not open the gate. Not reachable today (the gate refuses the first call the same way).
4. Seen while testing, not fixed (outside this slice): a DIRTY EditTray unmounted by a route change under a plain
   `MemoryRouter` (no data router) hangs jsdom in a synchronous loop. The app uses the data router; worth a look by
   whoever owns `leaveGuard`.

## Next steps

- Owner phone check of the sheet at 390x844 with the P3 flag on (Part 2 of the e2e spec is the recipe).
- Before S7 (flag ON): shape survey of who is still incomplete; decide item 1 (entry gate).
- S8: route ticket refusals through `gatedCopy`.
