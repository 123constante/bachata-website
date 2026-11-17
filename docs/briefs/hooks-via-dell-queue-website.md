# Brief: Website pre-push refuses cleanly when the Dell queue gives up (fast lane, one file)

Owner decision (click 2026-11-17): heavy checks never run on the 16 GB owner PC. `$HOME/.claude/bin/remote-test.mjs` (already updated, not part of this PR) now uses ONE shared queue across all windows and by default never falls back to the PC: Dell unreachable or a 25 min queue wait = exit 4 ("nothing ran"). Exit 3 only with `REMOTE_TEST_PC_FALLBACK=1`.

## Change (1 file: `.githooks/pre-push`, Website repo)
In step 1, the remote branch already handles rc 0 (pass), rc 3 (run here), other (red, `exit 1` with "Unit gate failed -- Fix the tests"). Add a case BEFORE the generic failure: when `rc` is 4, print `x Dell busy or offline: nothing ran, and it will not run on this PC. Retry the push later, or let CI prove it.` and `exit 1`. Keep rc 3 behaviour unchanged (only reachable with the fallback env). Do not touch the retry loop (rc 4 must not be retried: it already waited 25 min).

Also add one line to the comment block in that step noting exit 4. If a test pins the hook text (grep tests/ for `prePushRemoteUnitGate`), extend it with the rc 4 case.

## Boundaries
- Touch only `.githooks/pre-push` and its test. Do NOT edit `$HOME/.claude/**`. Bot-authored PR via `gh pr create`.
- PR body: "Not verified: the Dell path itself".
