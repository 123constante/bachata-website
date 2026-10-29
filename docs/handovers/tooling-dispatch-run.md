# Handover: tooling `dispatch-run` (ticket dt_d9325b711348)

Branch `claude/tooling-dispatch-run` (from `main` @ ada859c). Not for merge: the
orchestrator reviews and copies `scripts/tooling/dispatch-run/*` into `~/.claude/bin`.

## Done
- `scripts/tooling/dispatch-run/wait-done.mjs` -- git-based wait (Deliverable 1). Git runner,
  clock and sleep are injected; `--self-test` needs no git and no sleep. Self-contained
  (imports only `node:` built-ins). Also checks `origin` really is `<owner/name>`, and strips
  any `user:token@` from the URL before it could be printed.
- `scripts/tooling/dispatch-run/hold-rule.mjs` -- pure `holdDecision` (Deliverable 2), plus
  `makeHoldDecision({ rule4 })` so the self-test can mutate rule 4. No file, network or clock.
- `scripts/tooling/dispatch-run/SKILL.md` -- draft skill.
- Both files use an inline realpath-vs-realpath entry-point check (self-contained, and passes
  `check-script-conventions.mjs` R6; the repo's `scripts/lib/entry-point.mjs` would not survive
  the copy to `~/.claude/bin`).

## Decisions the orchestrator should check when integrating
- Terminal = `ROUTINE_RUN_STATUS_(SUCCEEDED|FAILED|CANCELLED|CANCELED|TIMED_OUT|EXPIRED)`,
  whatever `observed.source` says. The 30-minute clock starts at `terminal_since`, falling back
  to `observed.finished_at`; neither present -> blocks with "observe it with RemoteTrigger get".
- `status: 'finished'` entries are skipped (treated as not live). `prepared` with no
  observation blocks (rule 2).
- A `done_marker_at` that does not parse as a date counts as no marker.
- Rule 4 requires `worker_status === 'idle'` exactly; a marker with `running` still blocks.
- Fails closed: non-array entries, a non-object entry, missing repo/branch, or invalid `now`
  -> `allow: false`.
- wait-done: a "couldn't find remote ref" fetch error means "not pushed yet" and keeps waiting;
  any other fetch error is tolerated twice, the 3rd consecutive one is `ERROR` (exit 2).
- `ledger-sample.json`, named in the brief, is not on the brief branch, so the fixtures are built
  from the shape written in the brief, not from the sample.

## Self-test output: hold-rule.mjs (exit 0)

| # | case | result | reason |
|---|---|---|---|
| 1 | R1 empty ledger: branch free | PASS | branch free: 123constante/bachata-website#claude/x |
| 2 | R1 routine entry on the branch is ignored | PASS | branch free: 123constante/bachata-website#claude/x |
| 3 | R1 other branch never holds this one | PASS | branch free: 123constante/bachata-website#claude/x |
| 4 | R1 other repo never holds this one | PASS | branch free: 123constante/bachata-website#claude/x |
| 5 | R1 finished entry releases | PASS | branch free: 123constante/bachata-website#claude/x |
| 6 | R1 live worker on the branch blocks | PASS | dt_a on 123constante/bachata-website#claude/x last observed active/running via list_runs at 2026-10-29T11:50:00Z, no done marker: observe it with RemoteTrigger get |
| 7 | R2 never observed (running) blocks | PASS | dt_a on 123constante/bachata-website#claude/x was never observed: observe it with RemoteTrigger get |
| 8 | R2 never observed (prepared) blocks | PASS | dt_a on 123constante/bachata-website#claude/x was never observed: observe it with RemoteTrigger get |
| 9 | R2 never observed blocks even with a done marker | PASS | dt_a on 123constante/bachata-website#claude/x was never observed: observe it with RemoteTrigger get |
| 10 | R3 terminal SUCCEEDED + marker releases at once | PASS | branch free: 123constante/bachata-website#claude/x |
| 11 | R3 terminal no marker, 31 min ago releases | PASS | branch free: 123constante/bachata-website#claude/x |
| 12 | R3 terminal FAILED no marker, 31 min ago releases | PASS | branch free: 123constante/bachata-website#claude/x |
| 13 | R3 terminal no marker, 10 min ago blocks with wait time | PASS | dt_a on 123constante/bachata-website#claude/x is terminal (ROUTINE_RUN_STATUS_SUCCEEDED via get at 2026-10-29T11:50:00Z) without a done marker: wait until 2026-10-29T12:20:00.000Z |
| 14 | R3 terminal no marker, no terminal_since blocks | PASS | dt_a on 123constante/bachata-website#claude/x is terminal (ROUTINE_RUN_STATUS_SUCCEEDED via get at 2026-10-29T11:50:00Z) with no usable terminal_since: observe it with RemoteTrigger get |
| 15 | R4 marker + list_runs idle releases at once | PASS | branch free: 123constante/bachata-website#claude/x |
| 16 | R4 marker + idle releases even seconds after the marker | PASS | branch free: 123constante/bachata-website#claude/x |
| 17 | R4 marker but worker still running blocks | PASS | dt_a on 123constante/bachata-website#claude/x last observed active/running via list_runs at 2026-10-29T11:50:00Z, done marker present but worker not idle: observe it with RemoteTrigger get |
| 18 | R4 marker that is not a date does not count | PASS | dt_a on 123constante/bachata-website#claude/x last observed active/idle via list_runs at 2026-10-29T11:50:00Z, no done marker: observe it with RemoteTrigger get |
| 19 | R5 idle without marker blocks | PASS | dt_a on 123constante/bachata-website#claude/x last observed active/idle via list_runs at 2026-10-29T11:50:00Z, no done marker: observe it with RemoteTrigger get |
| 20 | R5 active/running without marker blocks | PASS | dt_a on 123constante/bachata-website#claude/x last observed active/running via list_runs at 2026-10-29T11:50:00Z, no done marker: observe it with RemoteTrigger get |
| 21 | R5 different ticket: A done+idle, B idle no marker -> B blocks | PASS | dt_b on 123constante/bachata-website#claude/x last observed active/idle via list_runs at 2026-10-29T11:50:00Z, no done marker: observe it with RemoteTrigger get |
| 22 | R5 both tickets done+idle release | PASS | branch free: 123constante/bachata-website#claude/x |
| 23 | R6 malformed ledger fails closed | PASS | ledger entries are not an array: re-read the ledger before dispatching |

mutant (rule 4 condition -> true): 6 case(s) red
  red: R1 live worker on the branch blocks
  red: R4 marker but worker still running blocks
  red: R4 marker that is not a date does not count
  red: R5 idle without marker blocks
  red: R5 active/running without marker blocks
  red: R5 different ticket: A done+idle, B idle no marker -> B blocks

hold-rule self-test: 23/23 pass; mutant KILLED

## Self-test output: wait-done.mjs (exit 0)

| # | case | result | output line (exit) |
|---|---|---|---|
| 1 | DONE on the first poll | PASS | `DONE dt_abc123 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa feat: x [worker-done dt_abc123]` (0) |
| 2 | PARTIAL is not reported as DONE | PASS | `PARTIAL dt_abc123 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa wip PARTIAL [worker-done dt_abc123]` (10) |
| 3 | marker found in the 8th newest commit | PASS | `DONE dt_abc123 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa x [worker-done dt_abc123]` (0) |
| 4 | another ticket's marker does not end the wait | PASS | `TIMEOUT dt_abc123 last=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` (11) |
| 5 | marker appears on a later poll | PASS | `DONE dt_abc123 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa done [worker-done dt_abc123]` (0) |
| 6 | branch not on origin yet: waits, then TIMEOUT last=none | PASS | `TIMEOUT dt_abc123 last=none` (11) |
| 7 | branch appears after missing-ref polls | PASS | `DONE dt_abc123 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa [worker-done dt_abc123]` (0) |
| 8 | 3 real fetch failures in a row -> ERROR | PASS | `ERROR git fetch failed 3x: fatal: unable to access: Connection reset` (2) |
| 9 | one transient fetch failure is survived | PASS | `DONE dt_abc123 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa [worker-done dt_abc123]` (0) |
| 10 | git log failure -> ERROR | PASS | `ERROR git log FETCH_HEAD failed: fatal: bad FETCH_HEAD` (2) |
| 11 | origin is another repo -> ERROR | PASS | `ERROR origin is https://github.com/x/other.git, not 123constante/bachata-website` (2) |
| 12 | origin URL credentials are never printed | PASS | `ERROR origin is https://github.com/x/other.git, not 123constante/bachata-website` (2) |
| 13 | no origin remote -> ERROR | PASS | `ERROR no origin remote in /home/user/bachata-website: no such remote` (2) |
| 14 | timeout is bounded: sleeps never pass the deadline | PASS | `TIMEOUT dt_abc123 last=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb` (11) |
| 15 | missing args -> ERROR | PASS | `ERROR usage: wait-done.mjs <owner/name> <branch> <ticket> [--timeout-min N] [--interval-s N] [--repo-dir P]` (2) |
| 16 | ticket with shell metachars -> ERROR | PASS | `ERROR bad ticket "x;rm"` (2) |
| 17 | branch starting with - -> ERROR | PASS | `ERROR unknown flag --upload-pack=x` (2) |
| 18 | negative timeout -> ERROR | PASS | `ERROR --timeout-min must be a positive number` (2) |
| 19 | default timeout is 55 min | PASS | `TIMEOUT dt_abc123 last=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb` (11) |
| 20 | git is called with args arrays, fetch -q origin <branch> | PASS | `DONE dt_abc123 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa [worker-done dt_abc123]` (0) |

mutant (PARTIAL reported as DONE): 1 case(s) red -> KILLED
mutant (TIMEOUT exits 0): 4 case(s) red -> KILLED
mutant (missing-ref treated as fatal): 1 case(s) red -> KILLED

wait-done self-test: 20/20 pass; mutants survived: 0

## Real-git smoke (this clone, 2026-10-29)

    $ node wait-done.mjs 123constante/bachata-website main dt_61b4dffc43bb --timeout-min 0.1 --interval-s 2
    PARTIAL dt_61b4dffc43bb 7ef968ad786d46bfcbdec95cc8037ce4324b324e feat(tickets): thank-you page reads order status, Confirmed only when paid; PARTIAL [worker-done dt_61b4dffc43bb] (#1121)   (exit 10)
    $ node wait-done.mjs 123constante/bachata-website main dt_nonexist --timeout-min 0.05 --interval-s 2
    TIMEOUT dt_nonexist last=ada859ca3bba787d0a12fc0e9eaf95bc66c7528f   (exit 11)
    $ node wait-done.mjs 123constante/bachata-website claude/no-such-branch-xyz dt_x --timeout-min 0.05 --interval-s 2
    TIMEOUT dt_x last=none   (exit 11)
    $ node wait-done.mjs other/repo main dt_x
    ERROR origin is https://github.com/123constante/bachata-website, not other/repo   (exit 2)

`node scripts/check-script-conventions.mjs` passes with both new files in the tree.

## Verified
- Both self-tests green, every case pinned (exit/allow, reason or line, blockedBy), mutants
  killed: hold-rule rule-4-forced-`true` turns 6 cases red; wait-done's 3 mutants are each killed.
- wait-done against real git in this sandbox's clone (above): PARTIAL, TIMEOUT with a sha,
  TIMEOUT last=none for a branch that does not exist, wrong-repo ERROR.

## Not verified
- Never run against the real orchestrator ledger, its gate, or `probeDoneMarkers` output.
- The hold rule is not wired into any gate (out of scope; the orchestrator does that).
- wait-done not run for its full 55 minutes, not on Windows, and not against a worker that
  pushes its done commit while it is waiting (that case is only covered by the fake-git test).
- No PR opened: the brief says this branch is never merged.

## Next steps (orchestrator)
1. Review both files; copy into `~/.claude/bin`.
2. Replace the gate's branch-hold logic with `holdDecision` (or port rule 4's `doneAndIdle`).
3. Swap the Monitor watcher for `wait-done.mjs` with a Bash timeout above `--timeout-min`.
