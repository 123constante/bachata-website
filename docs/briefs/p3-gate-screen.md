# Brief: P3 A1 gate screen + refusal routing (build, careful lane)

Branch: `claude/p3-gate-screen` (from main). Model: Opus, careful lane, NO database change. Marker `[worker-done p3-gate-screen]`.

Read first: `git show origin/claude/audit-organiser-remaining:docs/scoping/organiser-remaining.md` (Q3 row "A1 gate screen", D8, slice 4), `docs/plans/onboarding-arc.md` Appendix A (screen A1 spec), `src/modules/organiser/shared/selfServeErrors.ts` (`isOnboardingRefusal`, `ONBOARDING_REFUSAL`).

Problem: when an event write is refused with `onboarding_incomplete`, P3 shows only the copy "Finish your details first..." as a save error with NO control that goes there (copy points at a missing control). `isOnboardingRefusal` has no caller outside tests. The server gate flag `organiser_onboarding_gate` is OFF and stays OFF; this makes the Website ready before it is switched on.

Build: the "A few details first" gate screen per the plan's A1 spec (mount as a sheet if possible so you do not touch `P3Routes.tsx`/`paths.ts`/`surface.tsx`; a sibling worker owns those files). Route every refusal from `EditTray.tsx`, `CancelEventSheet.tsx`, `Toast.tsx` and `p3/data/*` writes through it. It must offer a Continue control into `/account/p3/start` for the right page (`?o=`), and a way to dismiss. Read-only: prove the data source first (who writes `organiser_onboarding_progress`, what `organiser_onboarding_status_v1` returns) with SELECT/pg_proc reads on prod.

Tests (table-driven, red first): every write surface x refusal / not-refusal x manager vs owner x contributor; no copy that points at a missing control; the Continue target per shape. 390x844 e2e with a flowing clock: the sheet and its buttons sit inside the viewport, opening it does not scroll the page (`focus({ preventScroll: true })`).

Standing rules: zero bytes to /app first load (`npm run check:bundle-budget` before/after; never edit perf-budgets.json or vite.config.ts). Compact density, explicit px tap targets (>= 44px). Design Gate: write `docs/design/<pr>.md`. PR body needs Verified on real data and a Phone QA section naming 390x844. Stopping rule: one independent review, one fix round.
