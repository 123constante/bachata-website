# Brief: tooling skill `dispatch-run` = (1) a git-based "worker done" wait script, (2) a tested pure hold rule (the orchestrator wires it into its gate)
Branch: claude/tooling-dispatch-run (from main). Builder: Opus (the patch touches a gate). Lane: careful. Do NOT open a merge-ready PR to main: push the branch, [skip preview] on every commit, final commit subject ends "[worker-done <ticket>]". The orchestrator reviews and copies files into ~/.claude/bin; this branch is never merged. Context cap 30%.

## No reference files (owner decision 2026-10-29: the repo is public, no local tool source is published)
You cannot see the orchestrator's local tools. Build both deliverables as self-contained Node ESM files with injected dependencies and your own self-test (a table of cases, each able to fail, plus a mutant check), under scripts/tooling/dispatch-run/. The orchestrator integrates the pure rule into its local gate file after review.

## What actually went wrong (verified 2026-10-28/29, do not re-derive)
A. WATCHERS EXPIRE. Monitor `watch-workers.mjs --only <ticket> | grep <ticket>` with persistent:true still expired after 5 minutes four times; each expiry costs an orchestrator turn. A git-based wait that ends on the worker's final commit (subject contains "[worker-done <ticket>]" on origin/<branch>) with a long timeout worked: `until git fetch -q origin <branch> && git log -1 --format=%s FETCH_HEAD | grep -q "worker-done <ticket>"; do sleep 60; done`.
B. THE BRANCH HOLD. A finished builder (final commit pushed, done_marker_at stamped correctly by probeDoneMarkers, session idle) still blocked a fix-round dispatch on the same branch. The ledger entry stayed status "running". The gate said "last observed active/idle ... via list_runs. Observe it first: RemoteTrigger get". Only a `get` observation returns ROUTINE_RUN_STATUS_SUCCEEDED; `list_runs` returns status "active" / worker_status "idle" for a worker that has finished its turn, and the gate records that as the observation, which never counts as done. So the orchestrator had to guess the cure (a `get`). See ledger-sample.json: entry 1 has done_marker_at and observed.status SUCCEEDED; entry 2 shows the sequence.

## Deliverable 1: scripts/tooling/dispatch-run/wait-done.mjs
CLI: node wait-done.mjs <owner/name> <branch> <ticket> [--timeout-min 55] [--interval-s 60]. Fetches with plain `git fetch -q origin <branch>` in the cwd repo (or --repo-dir), checks the newest 8 commits' subjects for "[worker-done <ticket>]" or "PARTIAL [worker-done <ticket>]"; prints exactly one line then exits: `DONE <ticket> <sha> <subject>` (exit 0), `PARTIAL <ticket> <sha> <subject>` (exit 10), `TIMEOUT <ticket> last=<sha>` (exit 11), `ERROR <reason>` (exit 2). Never loops forever (timeout default 55 min), never runs a shell string (execFileSync args arrays), never prints anything but that line on success. Inject the git runner and the clock so the self-test needs no git or sleep.

## Deliverable 2: scripts/tooling/dispatch-run/hold-rule.mjs, a PURE function with tests (no file or network access)
Export `holdDecision(entries, { repo, branch }, now)` where `entries` are ledger entries shaped like:
`{ ticket, kind:'worker', repo, branch, status:'prepared'|'running'|'finished', done_marker_at?: ISO string, observed?: { at: ISO, source:'list_runs'|'get', status: 'active'|'ROUTINE_RUN_STATUS_SUCCEEDED'|'ROUTINE_RUN_STATUS_FAILED'|..., worker_status?: 'running'|'idle', finished_at?: ISO }, terminal_since?: ISO }`.
It returns `{ allow: boolean, reason: string, blockedBy?: ticket }`. Rules (existing behaviour you must keep, plus one change):
1. At most one live worker per repo+branch. An entry with kind 'routine' is ignored.
2. An entry that was NEVER observed (no `observed`) blocks, always (owner rule: unobserved rows held branches forever).
3. An entry observed terminal (status SUCCEEDED/FAILED/CANCELLED..., via `get`) releases the branch 30 minutes after `terminal_since`... UNLESS it has `done_marker_at`, in which case it releases immediately (this one already exists in the real gate; keep it).
4. THE CHANGE: an entry with `done_marker_at` set AND `observed.worker_status === 'idle'` (a `list_runs` observation of a worker that has finished its turn; `status` stays 'active' for it) is released immediately, without needing a `get` or the 30 minutes. Today it stays blocked, which forced a pointless extra observation.
5. An entry with NO done marker and observed active/running/idle still blocks. A done marker belonging to a DIFFERENT ticket never releases this one (the marker is per ticket, already encoded by the entry's own field).
6. The reason strings must say exactly what to do next ("observe it with RemoteTrigger get", "wait until <time>", "branch free").
Tests: every rule above in both directions, the five cases in rules 2, 4, 5 and a different-ticket case, plus a mutant check inside the self-test (replace rule 4's condition with `true` and show at least 2 cases go red). Output the self-test table to docs/handovers/tooling-dispatch-run.md.

## Out of scope (do not build)
Reading or patching any local tool file, anything that tries to call RemoteTrigger from a script (it is an in-session tool with in-process OAuth; scripts cannot create or run triggers), auto-approving anything, any change to board-gate, any dispatch wrapper. dispatch-one.mjs and dispatch-worker.mjs `prepare` stay the only entry to the ledger.

## Done
Branch has wait-done.mjs with its self-test, hold-rule.mjs with its self-test, a SKILL.md draft (how to wait for a worker: one line, the exit codes, and the hold rule in two sentences), and docs/handovers/tooling-dispatch-run.md with the pasted self-test output and an honest Verified / Not verified (never run against the real ledger or real GitHub). Hard limits as every worker: plain git for your own branch, no --no-verify, no merge/approve, Supabase untouched, never print secrets.
