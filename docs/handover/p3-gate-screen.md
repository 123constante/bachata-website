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

## Continuation 2026-10-30: merge of main (branch `claude/p3-gate-screen-2`, replaces PR #1205)

Brief: `brief/p3-gate-screen-rebase2`. Made `claude/p3-gate-screen-2` from `origin/claude/p3-gate-screen` (225e365) and
merged `origin/main` (886f935, which includes #1202 shell exits and #1200 grace banner) with a merge commit. No rebase, no force push.

**Conflicted files (1):**
- `src/modules/organiser/p3/theme/p3.css`: both sides added rules after `.p3-grace-acts`. Kept both: main's
  `.p3-grace-acts .p3-btn` rule (#1200, the 44px Continue link on the grace banner) first, then this branch's
  `.p3-gate-go` / `.p3-gate-row` rules. The selectors don't overlap: `.p3-gate-go` isn't inside `.p3-grace-acts`.

Git merged these without conflicts and both sides' changes are present: `P3Shell.tsx`, `P3Routes.tsx`, `paths.ts`,
`you/surface.tsx`, `flows/new/NewFlow.tsx`, plus #1202's new exits tests.

**Cover "Go live" (#1202) vs the gate: no double-handling.** `NewFlow`'s `goLive` checks `profileQuestionsLeft`
BEFORE it sends any write. When questions are left, P3 goes to `p3StartReview` and the live write is never sent, so
there is no refusal for the gate to catch. The gate only handles writes the server already refused, and `NewFlow`
doesn't use it. The #1202 pre-check wins: it acts first and stops the refusal from ever happening. If the pre-check
read fails, the server decides and `NewFlow` shows its own error line, as it did before this branch. New row in
`gate.matrix.test.tsx` ("Cover Go live with profile questions left (#1202) ...") pins the order (check, then
Review, then write) and checks that `NewFlow` has no gate calls.

**Checks run locally (after merge):**
- `npx vitest run src/modules/organiser`: 219 files passed, 8391 tests passed, 2 skipped. (The first run had
  2 files fail to load because `jsqr` was missing from a stale `node_modules`. They passed after `npm ci`.)
- `npm run build`: OK. `npm run check:bundle-budget`: OK, dancer-app 371.8 KB of 374 KB. I did not run a main
  build to measure the byte delta. It should be 0 because the branch only changes `src/modules/organiser/**`,
  tests, docs, `package.json` (e2e list) and the architecture lint script, and no organiser module is in the
  dancer-app graph. This is inferred, not measured.
- `npm run lint:architecture`: passed. `npm run check:onboarding-write-doors`: 0 violations (1 expected-pending WARN
  for `admin_bulk_occurrence_command_p5`, which is already on main).
- `tests/e2e/p3-gate-sheet.spec.ts` with both flags: the first (cold) run had 2 of 5 fail ("light, 10 items" and
  "light, 1 item"). The failure text was lost when the rerun overwrote `test-results`. Two reruns after that: 5/5
  and 5/5. Treat this as possibly flaky on a cold dev server. Not investigated.
- No dev server left running.

**Not verified:** CI on the new PR (needs the orchestrator to open it), phone walk, dancer-app byte delta against a
main build.

**PR body:** there's no PR for this branch yet (the orchestrator closes #1205 and opens a new one). Body text to use:

> Merges current main into the A1 gate sheet branch (continuation of #1205). One conflict, in `p3.css`; both sides
> kept (the #1200 grace Continue rule and the gate sheet rules). The #1202 Cover go-live pre-check sends people to
> P3 Review before any write, so a refusal never reaches the gate; a new `gate.matrix` row pins that.
> Verified: organiser vitest (219 files), build, bundle budget, architecture lint, onboarding write doors, gate e2e
> (5/5 twice; one cold run had 2 failures). Not verified: phone walk, CI, dancer-app byte delta vs a main build.
