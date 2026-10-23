# Brief: pre-push unit gate runs on the side laptop when it can (Website)

## Why (owner, 2026-10-23)
"I installed the side laptop ... I need it to be used as much as possible and leave this PC more free."
Measured: every `git push` from the owner's PC runs the full unit suite there (admin ~3,500 tests, Website
~12,000), minutes at all cores, with 5 Claude sessions open. The same suite now runs on the side laptop
through a helper the orchestrator built and proved on the owner's PC:
admin main 5ea5c22f green on the laptop in 87 s; Website main a48ccd35 gave the same single failure as
GitHub's own run on that commit (datesCard.consistency, already red on main).

## The helper (exists ONLY on the owner's PC; you cannot run it, do not copy it into the repo)
`node "$HOME/.claude/bin/remote-test.mjs" <repo-key> <40-char sha> -- <command...>`
- exit 0 = the command passed on the laptop; any exit other than 3 = the command failed there (block the push);
- exit **3** = "could not test on the laptop" (unreachable, send failed, install failed). The hook must then
  run the suite LOCALLY exactly as today. 3 never means pass.
- It tests the COMMIT (sent with git send-pack, which runs no hook), not the working tree.

## Change (step 1 "Unit gate" of `.githooks/pre-push` ONLY; steps 0, 2, 3 untouched)
1. Use the helper when ALL hold: `REMOTE_TEST` is not `off`; the file `$HOME/.claude/bin/remote-test.mjs`
   exists; and there is exactly ONE commit sha being pushed (Website: step 0 already refuses a ref that is not HEAD unless SHIP_GATE_ALLOW_UNSCOPED_REF=1. Use HEAD_SHA only when `unscoped` is empty and at least one branch ref is pushed; any unscoped ref let through by the override -> local).
   Repo key: `website`. Command: exactly today's step-1 command (`npm run test:unit:offline -- --reporter=dot`).
2. Otherwise, or when the helper exits 3: run today's local command unchanged.
3. Print one line saying which path ran: `> pre-push: unit gate on the side laptop (<sha8>)` or
   `> pre-push: unit gate here (<reason>: laptop off/unreachable | REMOTE_TEST=off | helper not installed | several refs)`.
4. Failure message and exit 1 unchanged on a red run, wherever it ran.
5. Keep the hook POSIX sh as today; no new dependencies; update the hook's header comment for step 1.

## Proof you must bring (table-driven, red first)
A test that runs the real hook script with a temp `HOME` holding a STUB `.claude/bin/remote-test.mjs`
(exits a chosen code and records its argv) and a stub for the local unit command (e.g. PATH-shimmed `npm`
that records it ran and exits a chosen code). Rows:
| stub helper | REMOTE_TEST | refs pushed | local suite | expect |
|---|---|---|---|---|
| exit 0 | unset | 1 | (not run) | push allowed, local NOT run, helper got key + sha + command |
| exit 1 | unset | 1 | (not run) | push refused |
| exit 3 | unset | 1 | green | local ran, allowed |
| exit 3 | unset | 1 | red | local ran, refused |
| absent | unset | 1 | green | local ran, allowed |
| exit 0 | off | 1 | green | helper NOT called, local ran |
| exit 0 | unset | 2 different shas | green | helper NOT called, local ran |
Run the table against the UNCHANGED hook first and record that the helper rows fail. Then a mutant: make
exit 3 count as pass -> the "exit 3 + local red" row must go red; roll the mutant back.
Add the test to the repo's existing unit suite (find where hook tests live; follow that pattern).

## Not in scope
Any other hook step, CI workflows, the helper itself, `--no-verify` (never).
Hook files are hard-tier: follow the repo's review-stamp rules for them.
