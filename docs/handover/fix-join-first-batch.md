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
   - ~~On a used link, a same-name page counts as membership.~~ Fixed in fix round 1291-r1 (F1).
5. Housekeeping: the worker's first red-first run left a stray copy of `returnTo.ts` at `/rt.ts` in the sandbox root. The sandbox safety check blocked removing it. It is outside the repo and harmless.

## Fix round 1291-r1 (dt_fce3ceb41e8d; review `claude/review-1291-r1` docs/reviews/1291-r1.md)
- F1: `JoinPage.tsx` -- on a used link, redeem answering `dead` (e.g. `{ok:false, reason:'used'}`) is FINAL: `member = false`, the other-account dead screen at once, no navigation. The page-list (`ownPageForName`) fallback stays only when redeem came back `profile_incomplete` / failed / network.
  The `redeemer (...)` matrix cell now stubs the profile-gate RAISE (`redeemError = { message: 'profile_incomplete' }`); new same-name cell (`mine-not-the-invites`) -> dead, stays on /invite.
- F3: used link + server `used` + a never-settling `fetchOrganiserHome` reaches dead inside 1 s; with the profile-gate refusal the 1.5 s give-up still applies (on a used link it now counts once redeem has come back). Harness: `h.homeHang`.
- F4: `['Salsa', null]` in `inviteModel.test.ts` (kills the startsWith mutant).
- F2: the three e2e `href` assertions are exact strings (`&back=%2Faccount%2Fp3%2Fevents%2Fx` for the harness; `encodeURIComponent('/account/p3/events/' + FRIDAY)` for Part 2 and overlays).
- F7: F-08 marked copy-fixed by #1291 in FIXLIST.md, FLIP-READINESS.md, AUDIT-gate.md (end date / failed-read message still open, owner decision 3).
- Red first: the 3 new journey cells failed on 655c43f9 (`expected 'checking' to be 'dead'`); green after the fix.
- Run locally: vitest `src/modules/admin-organisers` + `src/modules/organiser/p3` 5132 passed; p3-gate-sheet + p3-gate-overlays (P3 flags on) 7/7 green (the first run had 2 failures on a cold dev server; two re-runs green); `check:bundle-budget` (see PR).
- Not mine: F5 (PR body line) and F6 (contract-check re-run) are the orchestrator's.
- Still left: items 1 and 3 above (390x844 browser walk, organiser shape survey).
