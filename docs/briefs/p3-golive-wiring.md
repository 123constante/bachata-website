# BRIEF: wire Go live in the P3 onboarding (Website, Opus builds, normal lane; save path = Opus per model table)

Branch `claude/p3-golive-wiring`, repo bachata-website. One slice, one final push plus an early checkpoint ([skip preview]). Start only when Batch A (`claude/p3-login-deadends`) is merged or its branch is not touched by this one (it is disjoint: auth routing + join screens).

## Source of truth
- Audit: branch `claude/p3-journey-audit`, `docs/audits/login-journeys-2026-10-29.md`, GAP F3 and Journey 3 step 10.
- Prototype spec (owner approved): `docs/design/onboarding-prototype.md` on main (screen 21 Review, screen 22 You're live, "sent for review" copy). Mood playful, progress shows %, flags for nationality; no new mockups.
- Today: `src/modules/organiser/p3/onboarding/pageApi.ts` has `GoLiveApi` and the stub `GO_LIVE_NOT_DEPLOYED` (`deployed:false`, `complete()` throws). `OnboardingFlow.tsx` uses `goLive = GO_LIVE_NOT_DEPLOYED` as its default prop (line ~87); `ReviewScreen` (~772) calls `goLive.complete(orgId)`; `pageModel.ts` has `goLiveState`, `reviewCopy`, `GO_LIVE_NOT_YET`.

## Owner words
"Production grade from the moment they click sign in ... to the end." The last onboarding screen must work: a person who finished every step presses Go live and sees the truth.

## Do
1. Prove the data source first: read the LIVE body of `complete_organiser_onboarding_v1` (Supabase read-only) and state its exact result shape and ACL in the PR body. Known from the audit: owner-only; returns `incomplete` with `missing[]`, `invalid_state`, `not_found`-type refusals; draft/rejected goes to `pending_review` when `_city_requires_review_p5(city)` else `live`; already live/pending_review is a no-op ok. Do not guess shapes.
2. Real `GoLiveApi` implementation calling the RPC (POST via the supabase client, typed through the existing rpc-typing pattern; `npm run check:rpc-typing` must pass), `deployed: true`. Make `complete()` RETURN the outcome (`live` | `pending_review`) instead of void, and update the interface, the flow and every fake in the tests.
3. Review screen handles EVERY server answer with a next action: `incomplete` (list what is missing with a button that jumps to that step), `invalid_state`, not-owner / not-signed-in, network failure (retry, nothing lost), already live (go straight to the Live screen), and `pending_review` (the "sent for review" copy that already exists in `reviewCopy`: show it, not "You're live").
4. Live screen (22) reachable only after a real success; for `pending_review` show the review variant, never a fake "You're live". Buttons: view your page, share link, go to home; each target must exist with the flag combinations used (organiserP3 + organiserSelfServe both on there).
5. Double-tap safe: Go live disabled while in flight; a second call is a no-op on the server but the UI must not show two results.
6. Table-driven consistency test: every server answer x every Review state x flag on/off for `deployed`; no copy pointing at a missing control; Review and Live agree with `goLiveState` (one shared mapping). Red first: show the new tests failing against the stub.
7. Walk (harness) at 390x844 and 320x568, light and dark: Review ready, Review incomplete, Review pending_review, Live, Live review variant, error + retry. Screenshots into `docs/handovers/p3-golive-wiring/`.
8. HARD RULE: never call the real RPC against production from tests or walks (it would publish a real page). Mocks only. The owner phone test is the final check.

## Standing header lines
- Zero bytes to the /app first load: `npm run check:bundle-budget` on main and branch identical; never edit perf-budgets.json or vite.config.ts.
- Overlay geometry: sheets/toasts inside 390x844, no page scroll on open.
- Run every CI job step that applies (read `.github/workflows`), per-job table in the PR body, Verified / Not verified block (Not verified: real-device keyboard behaviour, real review path on prod data: 0 of 319 cities require review today).
- No raw Unicode punctuation in JSX; large files via `scripts/safe-edit.py` / `safe-write.py`.

## Do not
Touch the database or admin repo, flags or defaults, `.github/workflows`, sign-in routing (F4) or the dead-end fixes (F1/F2). New gaps go in the handover under "Fix later", not into this slice.

## Hand-off
PR body with Verified / Not verified and per-job table; handover `docs/handovers/p3-golive-wiring.md`. Context cap 50%; PARTIAL marker if needed. Review after: a different model than the builder (model table: Opus build, user-facing, so Fable); the orchestrator dispatches it.
