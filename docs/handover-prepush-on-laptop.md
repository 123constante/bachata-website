# Handover: pre-push unit gate on the side laptop (Website)

Brief: `brief/prepush-on-laptop:briefs/prepush-on-laptop.md` (blob 7cab11ec). Ticket dt_84891b578bad.

## Done
- `.githooks/pre-push` step 1 ONLY: it uses `$HOME/.claude/bin/remote-test.mjs website <HEAD sha> -- npm run test:unit:offline -- --reporter=dot`
  when REMOTE_TEST is not `off`, the helper file exists, no unscoped ref went through, HEAD resolves and at least one
  `refs/heads/*` ref is pushed (main counts too). Helper exit 0 = pass; 3 = run the local command unchanged; anything else = the
  same failure message + exit 1. One line says which path ran. Steps 0, 2 and 3 are untouched; still POSIX sh, no new dependencies.
- `tests/prePushRemoteUnitGate.test.ts`: the brief's 7-row table. It runs the real hook in a temp repo with a stub helper in a temp
  HOME and a PATH-shimmed `npm`.
  - Red first: against the unchanged hook, 7/7 rows failed.
  - Mutant (helper exit 3 counted as a pass): the two exit-3 rows went red, including "exit 3 + local red". Rolled back; 7/7 green.

## Verified (in the cloud container)
- New test 7/7 green; `sh -n` on the hook; `bash bin/check-integrity.sh` reports 0 issues; `tsc --noEmit` is clean; `npm run lint`
  has 19/20 links green. The only red link is `check:integrity` exit 126, because `bin/check-integrity.sh` is not executable in
  this container (also on main). The script passes when run with bash.
- Full `test:unit:offline`: 12362 passed. 6 failed, all also red on main a48ccd3:
  - `datesCard.consistency` (known red on main, per the brief)
  - 5 x `integrityCouldNotRun`, caused only by this container's `NODE_PATH=/usr/local/lib/node_modules_global` (green with `NODE_PATH=`).

## Not verified
- The real helper on the owner's PC or the laptop (it cannot run here). Run one real `git push` on the PC and look for the
  `unit gate on the side laptop (xxxxxxxx)` line.
- The test on Windows Git Bash. It uses `sh` and an extensionless `npm` shim on PATH, which Git Bash should resolve.

## Next
- The hook is a HARD-tier file. Get the owner's PR approval or review stamp per the ship-gate rules.
