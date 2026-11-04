# join-gaps-1 handover (worker dt_9589cd720c9b, 2026-11-04)

Branch `claude/fix-join-gaps-1`, cut from main `8c60541` (#1304 merged, so the `OnboardingFlow.tsx` welcome line was in bounds).
No PR opened: the routine prompt names no PR step, and opening one is the orchestrator's call.

## Done
- Data proofs 1-3 + a fourth finding (bind is permanent): `INVENTORY.md`.
- Gap 2: `profile_incomplete` on the Join tap is never silent. Re-read incomplete -> About with "A few details are missing.
  Finish them, then join." (About's Continue is the one button; saving lands on the Join card). Re-read still complete ->
  "We couldn't join you yet" + Try again (redeems again).
- Gap 3: invite-only 403 split from blocked-domain 403 by text (prod hook bodies differ). Own screen naming the masked
  `email_hint`, "Use the email the invite was sent to" + WhatsApp. Blocked-domain words unchanged. The email step now
  shows "This invite was sent to d***@...". If the bind just tied the link (proof 4), or the refused email IS the invited
  one (review r1 F1), the screen offers only help + home: no "use another email" button that cannot work.
- Gap 4: `graceModel.timePromise(rowsLeft)` is the one source for the Home banner, the gate sheet and the welcome line.
- Tests: `join/__tests__/joinGaps.matrix.test.tsx` (19 rows; 11 red on unfixed code, output kept in the session),
  `p3/onboarding/__tests__/timePromise.matrix.test.ts` (31). Updated pins: joinJourney (person-bound "@" check, blocked
  domain uses a bound link), joinModel (403 mapping), gate.matrix and pageScreens.matrix (body text), phone spec E1.
- Review round 1 (independent agent): F1, F2, F3 fixed; F5 does not apply (GateSheet returns null for an admin).

## Left / next steps
- **Browser walk at 390x844 NOT done** (context budget). Walk: email step with/without hint; invite-only (hint, no hint +
  locked, typed = invited); blocked domain (hint, locked); About with the refusal notice; profile_stale; Home banner and
  gate sheet at 10, 6, 3, 0 rows; welcome line. Reuse `tests/e2e/walk-invite-recheck.spec.ts` from `claude/walk-invite-recheck-1`.
- `npm run check:bundle-budget` main vs branch: see the final report (run if missing).
- Review r1 F4 (older than this diff): bind succeeds, then the send fails on network / 429: Try again returns to the box with
  the preview still unbound in cache, so a different email gets `already_bound`. Fix idea: refetch the preview after a
  successful bind.
- **Server change needed (admin repo, not built):** bind the email only after a successful OTP send, or let a refused sign-up
  unbind it. Until then a typo'd or refused address on an unbound link spends the link.
- Admin app strings (invite creation, invite email) not inventoried: the admin repo is not reachable from this session.
