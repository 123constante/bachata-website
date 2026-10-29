---
name: dispatch-run
description: Wait for a dispatched cloud worker to finish (by git, not a watcher) and decide whether its branch is free for the next dispatch.
---

# dispatch-run (draft)

## Wait for a worker

One line, run in a clone of the worker's repo, with a long Bash timeout (it ends on its own):

    node wait-done.mjs <owner/name> <branch> <ticket> [--timeout-min 55] [--interval-s 60] [--repo-dir <path>]

It polls `git fetch -q origin <branch>` and reads the newest 8 subjects for
`[worker-done <ticket>]`. It prints exactly one line:

| exit | line | meaning / next step |
|---|---|---|
| 0  | `DONE <ticket> <sha> <subject>` | worker finished; review the branch |
| 10 | `PARTIAL <ticket> <sha> <subject>` | worker stopped at its context gate; read its handover, dispatch the next round |
| 11 | `TIMEOUT <ticket> last=<sha\|none>` | no marker yet; run it again (last=none: branch never pushed) |
| 2  | `ERROR <reason>` | bad args, origin is another repo, or git fetch failed 3x in a row |

A branch that does not exist on origin yet is not an error; it keeps waiting.
Use this instead of a Monitor watcher (those expired after ~5 minutes).

## Hold rule

`holdDecision(entries, { repo, branch }, now)` from `hold-rule.mjs` allows a
dispatch only when no other non-routine, unfinished ledger entry holds the same
repo+branch; a never-observed entry always holds it. An entry is released by a
done marker plus either a terminal `get` observation or a `list_runs`
`worker_status: 'idle'` observation (no extra `get` needed), or, with no marker,
30 minutes after `terminal_since`; every refusal names its next step.

Self-tests: `node wait-done.mjs --self-test`, `node hold-rule.mjs --self-test`.
