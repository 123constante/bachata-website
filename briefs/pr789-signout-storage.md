# Brief: PR #789, sign-out leaves person A's data on the phone (race) + 2 isolation seams. One pass.

Repo: 123constante/bachata-website. Branch: `claude/dancer-journey-fixes` (PR #789, head `e92f315`). Push to THIS branch only.
Model: Opus. You are the only worker on this branch.

## The failure (real GitHub Actions, job phone-qa / build-smoke, head e92f315; it PASSED on 982d74f, so it is intermittent)
```
[build-390x844] tests/e2e-build/account-edges.build.spec.ts:28 "sign out then a different person signs up: no trace of A"
Error: storage keys still holding A after sign-out
+ "auth_last_email", "sb-phoneqafakenotaproject-auth-token", "auth_form_state_v1"
```
On a shared phone the next person could see the previous person's e-mail and form. The owner's words about this work:
"I am a beginner and you should be the professional." This is a privacy bug; it must be fixed by construction, not by a
retry or a longer wait in the test.

## Likely cause (verify, do not assume)
Review fix S7 changed `useSignOutToHome` so the 2 s cap is armed only after `navigate()` resolves; B1 routed every sign-out
through it. If navigation to home can happen before `supabase.auth.signOut()` and the local-key clearing finish, the
storage check races. Read the hook, its callers and `docs/handovers/dancer-journey-fixes.md` (B1, S7).

## Do
1. Make sign-out clear person A's local data BEFORE leaving the page, whatever the network does: the cap bounds the wait
   for the server call; the local clearing (the Supabase auth key, `auth_last_email`, `auth_form_state_v1`, and any other
   per-person key the spec lists) runs on success, failure AND timeout, then navigate. One shared list of per-person keys,
   no second copy.
2. Tests: a unit test that the keys are gone when navigate is called, for signOut resolving fast, slow (past the cap) and
   rejecting. Red-first on `e92f315`, paste the red. Then run the build-smoke spec
   `account-edges.build.spec.ts` with `--repeat-each=10 --retries=0` on a production build: 0 failures (paste the count).
   Do not weaken the spec's assertion.
3. dancer-area isolation is red on `vitest.config.ts` and `vitest.setup.ts` (test infrastructure the previous worker
   changed for the input-otp stub). Add both to `seams` in `scripts/dancer-area-isolation-allowlist.json` with seamNote
   "test setup for #789 (input-otp elementFromPoint stub)". Check + `--self-test` both exit 0.
4. Re-run: full `npm run test:unit` (no "Unhandled Errors"), the full build-smoke, the phone suite, e2e-smoke. Update the
   per-job table in the handover.

## Rules
- GitHub Actions may refuse jobs ("payments have failed / spending limit"): billing, not code.
- Plain git for read and push. NEVER `gh api`. No new PR, no labels, do not edit PR #789. Push ONCE at the end
  (each push builds a Vercel preview and Vercel is rate-limited today).
- Shell commands without variables, loops or `$(...)` where a plain command works.
- Never merge or approve. Never `--no-verify`. Supabase read-only.
- Do not touch organiser screens (organiser sign-outs belong to another session).
- Context: at 25% start nothing new; by 30% push + handover with `PARTIAL [worker-done <ticket>]`.

## Output
Single push; commit subject ends with `[worker-done <ticket>]`; handover section "Sign-out storage race" with cause, fix,
red-first output, the repeat-each count, per-job table.
