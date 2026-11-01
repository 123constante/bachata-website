# Brief: fix-join-outcomes-r1 (invite join page: honest outcomes + clear Send my code)

Lane: normal (no DB change). Model: Sonnet. Branch: claude/fix-join-outcomes-r1. One PR.
Stopping rule: one independent review (Opus), one fix round, then the orchestrator walk.

## Owner words (why)
Owner 2026-11-01 via the session in charge of organiser onboarding: the organiser path from the invite link must be easy with no problems; "the platform future depends on it". On the phone a wrong account saw "PAUSED. We couldn't join your profiles automatically. We've told Ricky" (screenshot 21:38). Prod showed NO attempt row for that invite, so "we've told Ricky" was false.

## Prove the data source first (read-only, state it in the PR)
- Read the live body of `redeem_organiser_invite_v1` (pg_proc, prod `stsdtacfauprzrdebmzg`). Facts already read: an open invite bound to another proven email answers `email_mismatch` (with `invite_email_hint`) BEFORE any write and records nothing; an unproven mailbox answers `email_unproven`; only a person-bound invite whose claim did not link answers `not_linked`, and only then is an `organiser_invite_redeem_attempts` row (outcome `not_linked`) written (skipped when the caller's latest row for that invite is `not_linked` and under 5 minutes old).
- Files: `src/modules/admin-organisers/join/JoinPage.tsx` (verify-code handler, ~lines 195-225: the person-bound branch calls `attemptRedeem` and, for ANY outcome that is not `done`, calls `fail('claim', { kind: 'not_linked' })`), `joinModel.ts` (`attemptRedeem` outcome kinds), `JoinScreens.tsx` (`StopScreen`: not_linked, wrong_account, email_unproven, rate_limited, refused), `joinCopy.ts`, `EmailStep` (the "Send my code" button, copy `JOIN_COPY.email`, `JOIN_COPY...why`).

## Build
1. After sign-in with a person-bound invite whose claim is `no_match`/`ambiguous`, map the redeem outcome with the SAME mapping the join tap uses (`switch (outcome.kind)` in `join()`): `not_linked` -> not_linked screen; `wrong_account` -> wrong-account screen with the email hint; `email_unproven`, `rate_limited`, `profile_incomplete`, `dead`, `refused`, `sign_in`, network `failed` -> their own screens. Share one function between the two call sites; do not copy the switch. "We've told <inviter>" appears ONLY for the `not_linked` outcome.
2. "Send my code": while the email is empty or malformed the button is currently disabled and reads as faded amber with a grey line under it. Keep one visible reason line directly under the button, make the button keep full contrast, and on tap with an empty or bad email show the existing bad-shape error instead of doing nothing (so the button is never a dead control). Do not change the OTP request itself.
3. Table-driven test (one shared mapping): every redeem outcome x {after sign-in, join tap} -> the screen it shows, asserting the text never claims an action that did not happen (no "we've told" unless `not_linked`), every screen has one primary action, and an untouched Send-my-code tap sends nothing.

## Hard limits
- Zero bytes to the `/app` first load (`npm run check:bundle-budget` on main and the branch).
- Overlay/geometry: no new overlay; run the join e2e at 390x844.
- Tests first (red against unfixed code), then the fix. Never edit `perf-budgets.json`, `vite.config.ts`, `scripts/onboarding-write-doors.json`.
- Do not touch the gate (`organiser_onboarding_gate`), the server, any migration, or P3 files.
- Copy: HTML entities (`&rsquo;`), full weekday names, British English.

## Definition of done (PR body)
Shapes: counts only (open invites by kind bound/person-bound/unbound from prod, read-only). Per-job CI table. Phone QA section with 390x844 steps. A Verified / Not verified block. Handover `docs/handover/fix-join-outcomes-r1.md`.
