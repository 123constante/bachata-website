# Brief: independent review of Website PR #1157 (login audit L2 L3 L4 L6, invite-claim refusal screens) -- user-facing, normal lane

You did NOT build this (a Dell builder did). Review PR #1157 on `claude/login-fixes-l2-l6` (repo 123constante/bachata-website): read `docs/handovers/login-fixes-l2-l6.md` and the audit section FIX LATER (`git show origin/claude/p3-journey-audit:docs/audits/login-journeys-2026-10-29.md`). Change NO product code.

## Review for
1. Red first: check out the new test `src/modules/admin-organisers/join/__tests__/refusalMatrix.test.tsx` against the UNCHANGED source (main's joinModel/JoinScreens/joinCopy): do the L2/L3/L4/L6 rows fail there and pass on the branch? Report counts.
2. Every redeem refusal reason x screen: right copy, one next action, disabled controls say why, no copy pointing at a missing control. Is `unconfirmed_account` still safe to NOT sign the person out (any path that keeps a half-signed session)? rate_limited: truly no immediate retry; the code-send "wait a minute" retry unchanged?
3. Re-read the live redeem RPC body read-only on prod and list its real refusal reasons; any reason missing from the mapping table?
4. `tests/e2e-phone/invite-join.phone.spec.ts` check E8 change: still meaningful, not weakened?
5. Scope: nothing in Auth.tsx or sign-in landing; bundle: `npm run check:bundle-budget` main vs branch, zero bytes to /app first load. British English, entities not raw Unicode in JSX.

## Output
Docs-only `docs/reviews/login-fixes-l2-l6-r1.md` on `claude/review-login-fixes-l2-l6`: verdict PASS / PASS with should-fix / FIX FIRST, findings (BLOCK / SHOULD-FIX / NIT) with file:line and a concrete failing scenario per BLOCK, a Not verified section. Push once, subject ending `[worker-done review-login]`.
