# Handover: fix-join-first-batch (dt_470a05958451)

PR #1291 (branch `claude/fix-join-first-batch`). Slices B, R, U are built and tested. No DB change was needed (see INVENTORY.md "Server answer").

## Done
- B: `GRACE_BODY` (graceModel.ts) on Home's banner. "works as usual" removed (0 hits in src/).
- R: `p3/onboarding/returnTo.ts` (validate + `withBack` + `finishLabel`). GateHost passes `at`, GateSheet's Continue carries `&back=`, and OnboardingFlow's Review/Live end with "Back to your event" when 0 are left.
- U: JoinPage/joinModel/JoinScreens/inviteModel: a used link that is yours → your page's home (replace). Signed out → "You already joined / Sign in to continue." + Sign in. Other account → different-account copy + switch.
- Red-first matrix (fails on the unfixed code, passes on the fix), one independent review, and one fix round (5 fixes).
- CI steps run locally (typecheck, architecture-guard, lint chain, unit, build + bundle budget). The table is in the PR body.

## Left (next steps)
1. **Browser walk at 390x844** of the banner, gate → Review → "Back to your event", and `/invite/:token` used × {signed out, redeemer, other}. Save pictures under `docs/walk/fix-join-first-batch/`. Not done: worker context limit.
2. Run `npm run test:e2e` and `npm run test:e2e:p3` (not run here).
3. Shape survey of organisers by `left` count (needs a session to call `organiser_onboarding_status_v1`).
4. Known gaps (accepted, see PR "Not verified"):
   - `back` is lost on round trips to /app or the dancer profile.
   - Back from the event can land on the finished Review.
   - On a used link, a same-name page counts as membership.
5. Housekeeping: the worker's first red-first run left a stray copy of `returnTo.ts` at `/rt.ts` in the sandbox root. The sandbox safety check blocked removing it. It is outside the repo and harmless.
