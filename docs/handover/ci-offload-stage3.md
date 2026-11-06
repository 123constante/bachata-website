# CI offload stage 3 -- handover (Website)

Ticket dt_6a900570b5d0. Brief: `brief/ci-offload-stage3:docs/briefs/ci-offload-stage3.md` (v1).
Branch `claude/ci-offload-stage3`, base origin/main 01914fa. Status: Part A wired (inert until the
owner registers the runner); baseline committed; Part B NOT built (see "Part B verdict").
Fix round 1 (dt_19750f4e085b, 2026-11-06): hosted fallback, positive trust allowlist, hardened
unit/hooks, guard rule (e-routed). The workflow half is PATCH A below (lead applies).
Fix round 2 (dt_2f8827503d6b, 2026-11-06): runner-side workflow identity check, watchdog removed,
structural guard; the workflow half is PATCH B (next section).

## Fix round 2 (brief `ci-offload-stage3-fix2.md` v2, ticket dt_2f8827503d6b): read this first

Review of #1402 at 1ba49bd46. Sections further down describe fix round 1; where they mention the
watchdog, `if: always()`, `docs/ci-offload/bom-check.yml` or a full `_work` wipe after every job,
this section supersedes them. The workflow half is **PATCH B** (end of this section; the lead
applies it, the worker cannot push `.github/workflows`).

| item | done | where | proof |
|---|---|---|---|
| 1 CRITICAL: PR's own workflow can hard-code `runs-on: acer-web` | job-started hook refuses (exit 1, job fails before any step, hosted answers) unless: event is `pull_request` or push to main; `GITHUB_ACTOR` and `GITHUB_TRIGGERING_ACTOR` on the trust list; `GITHUB_WORKFLOW_REF` = this repo's `.github/workflows/bom-check.yml`; the git blob of that file at `GITHUB_WORKFLOW_SHA` == the blob on `origin/main`, both fetched fresh into a local mirror. Settings come only from built-in defaults + root-owned `/etc/ghrunner-web/gate.conf`, never env. | `docs/ci-offload/acer-web/gate-job-started.sh` | `test-gate-hooks.sh`: 34 cases; MUTANT (altered workflow blob) refused + names IDENTITY; 9 more refusals (actor, re-run actor, workflow path, repo, non-hex/unknown sha, push to branch, pull_request_target, env cannot widen trust list) |
| 2 protected paths | `scripts/lib/`, `package.json`, `package-lock.json` added (`.github/automation/` already under `.github/`) | `PROTECTED_PREFIXES` | test: PR touching ONLY `scripts/lib/entry-point.mjs` -> untrusted -> hosted; `scripts/library.mjs` still trusted (no over-match) |
| 3 exit classes | only 1 = code-failure; 124/137 = busy-timeout; 2, 126, 127, 130, 139, 143, empty, non-numeric = `runner-error` -> hosted. `verdict` now always exits 0 (the verdict travels as an output + marker step, so a crashed node can never pose as a code failure) | `classifyExit()` | table test over 0,1,2,124,126,127,130,137,139,143 + garbage |
| 4 watchdog | GONE (no run cancel). Required `bom-check` does not `needs:` the routed job; it polls it (`route-runner.mjs await`): skip-pass only if the routed job succeeded AND its `BOM verdict: pass` marker step succeeded; red only if the routed job failed AND its `BOM verdict: code failure` marker failed; queued > 120 s, running > 660 s, refused, crashed, API errors -> runs the check hosted. No `if: always()`: `!cancelled()` | `awaitDecision()`, PATCH B | 15-row table + 4 `main(['await'])` cases (no POST ever sent) |
| 5 label empty | `route` has `if: vars.WEB_RUNNER_LABEL != ''`; routed job skips with it; `bom-check` (`!cancelled()`) runs hosted = the old single-job behaviour | PATCH B | YAML parsed; guard OK on it (below) |
| 6 guard parses `if:` | `parseExpr()` (tokeniser + precedence parser for `|| && ! == != ( ) calls`), `routeTrust()`: the expression must IMPLY push-to-main or (same-repo head AND `contains(fromJSON('<literal list>'), github.event.pull_request.user.login)` with the list inside `TRUSTED_AUTHORS`) on EVERY OR branch | `scripts/check-secrets-register.mjs` | self-test 41 cases incl. 13 structural mutants: `|| true` (outer and inside the group), negated trust, trust in one OR branch only, trust OR target, `!=`, author not allowlisted, list from a variable, wrong field, whole expression as a string literal, unparseable -> all exit 1; live `if:` and `${{ }}`-wrapped -> 0 |
| 7 duplicate YAML | `docs/ci-offload/bom-check.yml` deleted; the workflow is the only copy; test asserts the docs copy does not come back | `tests/routeRunner.test.ts` | |
| 8 completed hook | removes ONLY `_work/<repo>` (name validated; never `_temp`/`_actions`/`_tool`). Started hook (after identity) removes other top-level `_work` entries and `_temp` entries older than 60 min | both hooks | shell test: stale checkout + old `_temp` gone, fresh `_temp`, `_tool`, `_actions` kept |
| 9 lock holder | `exec sleep 7200` replaced: holder loops (`sleep 1` with the lock fd closed) and exits when the watched process (nearest `Runner.Worker` ancestor) dies or after `HOLDER_MAX_S` (default and hard cap 1800 s). Pid file unwritable -> holder exits 3 (lock released) -> hook refuses with exit 1 | `gate-job-started.sh` | shell test: lock held while the runner lives, released within 2 s of its death; released after a 2 s cap; unwritable pid file -> exit 1 + lock free; walk running -> refused BUSY, exit 0 |

**Deliberate deviation (item 8).** The brief says "move the FULL cleanup to job-started". Not
done literally: when the job-started hook runs, the runner has already downloaded THIS job's
actions into `_actions` and created its file-command files under `_temp`; wiping them there would
break the job. So job-started keeps `_actions`, `_tool` and fresh `_temp` entries. Needs owner /
lead confirmation on a live runner (Not verified below).

**Mutant results (run 2026-11-06 in this container).**
- Altered workflow blob (`jobs: { evil: { runs-on: acer-web } }`) at `GITHUB_WORKFLOW_SHA` -> hook exit 1, verdict `refused ... IDENTITY ...`, walk lock never taken.
- Hook mutant with the identity compare line deleted -> `test-gate-hooks.sh` FAILS (8 of 34, first: `MUTANT altered workflow: refused`). Also pinned in vitest (`runner hooks (shell test)`).
- Guard: 13 structural `if:` mutants all exit 1 (table above); route-runner self-test 14 cases.

### PATCH B (lead applies; replaces the routing part of PATCH A)

Changes `.github/workflows/bom-check.yml` only. Items 4 + 5: `route` skipped when the label is
empty; watchdog job removed; routed job gets two marker steps and never fails on its own; the
required `bom-check` no longer `needs:` the routed job, uses `!cancelled()` instead of
`always()`, polls with the BASE commit's `route-runner.mjs await` (`actions: read`), and only
checks out the PR head when it has to run the check itself. Proven here: `git apply --check`
clean on this branch; with it applied, `node scripts/check-secrets-register.mjs` = OK (1 routed
job trust-gated), YAML parses. Apply: save the block as `fix2.patch`, then
`git apply --ignore-whitespace fix2.patch`.

**Owner steps that go with PATCH B (not code):**
1. Org/repo runner group for `acer-web`/`dell-web`: restrict to **Selected workflows** =
   `123constante/bachata-website/.github/workflows/bom-check.yml@refs/heads/main`. This is the
   GitHub-side half of item 1 (the hook is the runner-side half; keep both).
2. Install `/etc/ghrunner-web/gate.conf` root-owned 0644 (keys `REPO`, `WORKFLOW_PATH`,
   `TRUSTED`, `REMOTE_URL`, `MIRROR`, `MAIN_REF`; defaults in the hook are already right for
   this repo, so the file is optional). `MIRROR` must be writable by the service user.
3. If the repo is private, the mirror fetch needs a read-only credential (fine-grained token,
   `contents:read`, this repo only) in the service user's git credential store; register it in
   `secrets-register.json` before use. Without it every job is refused -> hosted (safe, no gain).

```diff
diff --git a/.github/workflows/bom-check.yml b/.github/workflows/bom-check.yml
index af04c34..22c1617 100644
--- a/.github/workflows/bom-check.yml
+++ b/.github/workflows/bom-check.yml
@@ -1,15 +1,17 @@
 name: BOM Check
 
-# CI offload stage 3 (docs/handover/ci-offload-stage3.md). The required check `bom-check`
-# may run on a side machine (Acer/Dell) and FALLS BACK to GitHub-hosted whenever that
-# machine is off, busy, broken or its gate refuses: a side machine never reds or blocks a PR.
-#   route            hosted, seconds: scripts/ci/route-runner.mjs route (trust + runner online/idle)
-#   bom-check-routed side machine, only when route said self AND the trust if: holds
-#   bom-check-watch  hosted: cancels THIS run if bom-check-routed sits queued > 120 s
-#                    (that is why this is its own workflow: a cancel touches nothing else)
-#   bom-check        hosted, the REQUIRED name: skipped (= success) when the routed run passed,
-#                    red when it failed on code, otherwise runs the check itself.
-# Revert switch: delete the repo variable WEB_RUNNER_LABEL (unset = always hosted).
+# CI offload stage 3 (docs/handover/ci-offload-stage3.md). The required check `bom-check` may be
+# answered by a side machine (Acer/Dell); a side machine that is off, busy, broken or refused
+# NEVER reds or blocks a PR (owner rule 2026-11-06).
+#   route            hosted, seconds; SKIPPED when vars.WEB_RUNNER_LABEL is empty (= the old
+#                    single-job behaviour). route-runner.mjs route: trust + runner online/idle.
+#   bom-check-routed side machine, NOT required, nothing needs: it. Its job-started hook refuses
+#                    unless this file at GITHUB_WORKFLOW_SHA is byte-identical to main's.
+#   bom-check        hosted, the REQUIRED name, runs in parallel with the routed job: polls it
+#                    (route-runner.mjs await, no run cancel) and is red ONLY when the routed job
+#                    completed AND its code-failure marker step failed; otherwise it passes on
+#                    the routed pass, or runs the check itself.
+# Revert switch: delete the repo variable WEB_RUNNER_LABEL (unset = route skipped, always hosted).
 
 on:
   push:
@@ -26,6 +28,7 @@ permissions:
 
 jobs:
   route:
+    if: vars.WEB_RUNNER_LABEL != ''
     runs-on: ubuntu-latest
     timeout-minutes: 2
     permissions:
@@ -58,12 +61,13 @@ jobs:
 
   bom-check-routed:
     needs: route
-    # Trust is checked TWICE: by the route script and here (scripts/check-secrets-register.mjs
-    # rule (e-routed) fails if any of these conditions is removed).
+    # Trust is checked THREE times: route script, this if: (scripts/check-secrets-register.mjs
+    # rule (e-routed) parses it and fails unless it implies trust), and the runner's job-started
+    # hook (workflow blob == main's, actor on the trust list).
     if: needs.route.outputs.target == 'self' && ((github.event_name == 'push' && github.ref == 'refs/heads/main') || (github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository && contains(fromJSON('["kiki-claude-bot","123constante"]'), github.event.pull_request.user.login)))
     runs-on: ${{ needs.route.outputs.runner }}
-    # Budget: gate wait <= 180 s (job-started hook) + check <= 240 s (timeout(1) below) + slack.
-    # A timeout here is "runner busy", never a code failure: the hosted job re-runs it.
+    # Budget: gate wait <= 180 s (hook) + check <= 240 s (timeout(1) below) + slack. bom-check
+    # stops waiting after 660 s and runs hosted, so a slow side machine costs nothing but time.
     timeout-minutes: 10
     permissions:
       contents: read
@@ -75,7 +79,7 @@ jobs:
           persist-credentials: false
       - name: Gate verdict (load + walk lock, written by the job-started hook)
         id: gate
-        run: node scripts/ci/route-runner.mjs gate
+        run: node scripts/ci/route-runner.mjs gate || echo "proceed=false" >> "$GITHUB_OUTPUT"
       - name: Detect docs-only PR
         id: changes
         if: steps.gate.outputs.proceed == 'true'
@@ -88,20 +92,35 @@ jobs:
         if: steps.gate.outputs.proceed == 'true'
         env:
           DOCS_ONLY: ${{ steps.changes.outputs.docs_only }}
+        # Never fails: the verdict is an OUTPUT, read by the two marker steps below.
         run: |
           set +e
           if [ "$DOCS_ONLY" = "true" ]; then code=0; else timeout --kill-after=10 240 bash scripts/ci/bom-check.sh; code=$?; fi
           node scripts/ci/route-runner.mjs verdict "$code"
+          exit 0
+      # Marker steps: bom-check reads THEIR conclusions through the jobs API (names pinned in
+      # route-runner.mjs PASS_STEP / FAIL_STEP). Anything else (refused, crashed, busy) = hosted.
+      - name: 'BOM verdict: pass'
+        if: steps.check.outputs.verdict == 'pass'
+        run: echo "bom-check passed on the side machine"
+      - name: 'BOM verdict: code failure'
+        if: steps.check.outputs.verdict == 'code-failure'
+        run: |
+          echo "bom-check FAILED on the side machine: a code failure, not a runner problem."
+          exit 1
 
-  bom-check-watch:
+  bom-check:
     needs: route
-    if: needs.route.outputs.target == 'self'
+    # !cancelled(), not always(): runs when route is SKIPPED (label empty) or failed, so the
+    # required check is never skipped-as-success; it does not wait for the routed job.
+    if: ${{ !cancelled() }}
     runs-on: ubuntu-latest
-    timeout-minutes: 5
+    timeout-minutes: 15
     permissions:
       contents: read
-      actions: write
+      actions: read
     steps:
+      # The BASE commit's route script (same rule as route).
       - uses: actions/checkout@v7
         with:
           ref: ${{ github.event.pull_request.base.sha || github.sha }}
@@ -109,47 +128,35 @@ jobs:
           sparse-checkout: |
             scripts/ci
             scripts/lib
-      - name: Cancel this run if the side machine never picks the job up
+          path: base
+      - name: Wait for the side machine (poll only; never cancels)
+        id: fb
         env:
+          TARGET: ${{ needs.route.outputs.target }}
           GITHUB_TOKEN: ${{ github.token }}
           WATCH_JOB_NAME: bom-check-routed
           QUEUE_BUDGET_S: '120'
-        run: node scripts/ci/route-runner.mjs watch || true
-
-  bom-check:
-    needs: [route, bom-check-routed]
-    # always(): also runs after the watchdog cancels the run -- that IS the hosted fallback.
-    if: always() && !(needs.bom-check-routed.result == 'success' && needs.bom-check-routed.outputs.verdict == 'pass')
-    runs-on: ubuntu-latest
-    timeout-minutes: 5
-    permissions:
-      contents: read
-    steps:
-      - uses: actions/checkout@v7
-      - name: Fallback decision
-        id: fb
-        env:
-          TARGET: ${{ needs.route.outputs.target }}
-          ROUTED_RESULT: ${{ needs.bom-check-routed.result }}
-          ROUTED_VERDICT: ${{ needs.bom-check-routed.outputs.verdict }}
-        run: node scripts/ci/route-runner.mjs fallback || echo "action=run-hosted" >> "$GITHUB_OUTPUT"
+          TOTAL_BUDGET_S: '660'
+        run: node base/scripts/ci/route-runner.mjs await || echo "action=run-hosted" >> "$GITHUB_OUTPUT"
       - name: Routed run failed on code
         if: steps.fb.outputs.action == 'fail-code'
         run: |
           echo "bom-check FAILED on the side machine: a code failure, not a runner problem (see bom-check-routed)."
           exit 1
-
-      # Docs-only PRs skip the heavy steps below; the job still runs, so the
-      # required check keeps its name and reports success. Fail-safe: any error
-      # means docs_only=false (scripts/ci/docs-only.mjs).
+      - uses: actions/checkout@v7
+        if: steps.fb.outputs.action != 'fail-code' && steps.fb.outputs.action != 'skip-pass'
+        with:
+          path: head
+      # Docs-only PRs skip the heavy step; fail-safe: any error means docs_only=false.
       - name: Detect docs-only PR
         id: changes
-        if: steps.fb.outputs.action != 'fail-code'
+        if: steps.fb.outputs.action != 'fail-code' && steps.fb.outputs.action != 'skip-pass'
+        working-directory: head
         env:
           EVENT_NAME: ${{ github.event_name }}
           MERGE_SHA: ${{ github.sha }}
         run: node scripts/ci/docs-only.mjs --merge "$MERGE_SHA"
-
       - name: Check workflow files for BOM
-        if: steps.fb.outputs.action != 'fail-code' && steps.changes.outputs.docs_only != 'true'
+        if: steps.fb.outputs.action != 'fail-code' && steps.fb.outputs.action != 'skip-pass' && steps.changes.outputs.docs_only != 'true'
+        working-directory: head
         run: bash scripts/ci/bom-check.sh
```

## Fix round 1 (brief `stage3-fix1.md` v1, ticket dt_19750f4e085b): what changed

Owner rule (2026-11-06): a side machine that is off, busy or broken must NEVER turn a PR red or
block a merge. Every unknown now ends on GitHub-hosted.

| item | done | where |
|---|---|---|
| 1 fallback | route job + routed job + watchdog + required hosted fallback | `scripts/ci/route-runner.mjs`, `.github/workflows/bom-check.yml` (PATCH A; docs copy deleted in fix round 2) |
| 2 trust | positive allowlist, checked twice (script + job `if:`) | `trustDecision()`, routed job `if:` |
| 3 hooks/permissions | hooks root-owned in `/usr/local/lib/ghrunner-web/hooks`, not writable; runner dir + credentials read-only; LAN egress denied; workspace wiped after every job | unit, `gate-job-completed.sh` |
| 4 lock holder | `setsid`, fds to /dev/null, pid file cleared first and written only by the holder, `pid starttime` checked before any kill, lock in `/var/lib/laptop-walk/walk.lock` | `gate-job-started.sh` |
| 5 service | `KillMode=control-group` + `ExecStopPost` clears state; `MemoryMax=4G` kept | unit |
| 6 timeout | gate (180 s, hook) and check (240 s, `timeout(1)`) budgets separate, job 10 min; a timeout is verdict `busy-timeout` -> "RUNNER BUSY (not a code failure)" annotation -> hosted re-run | routed job, `classifyExit()` |
| 7 guard | `check-secrets-register.mjs` rule (e-routed): an expression `runs-on` needs all three trust conditions in the job `if:` and no `pull_request_target`/`workflow_run`; self-test has a mutant per condition | `scripts/check-secrets-register.mjs` |
| 8 handover | this file; Dell section below | |

Also found and fixed: the BOM check used `xxd`, and without `xxd` it read every file as clean
(fail open; seen in this container). `scripts/ci/bom-check.sh` uses `od` (coreutils) and is
proven both ways (clean tree exit 0; a BOM fixture exit 1).

## Fallback design (item 1)

`.github/workflows/bom-check.yml` (new, its own workflow: the watchdog may cancel the run and
that must not touch masking-check / notification-check). `bom-check` leaves `workflow-lint.yml`.
The required context name stays `bom-check` (`required-jobs.json`, ruleset fixture unchanged).

| job | runs on | does |
|---|---|---|
| `route` | ubuntu-latest, ~10 s | checks out the PR **base** sha (sparse `scripts/ci`, `scripts/lib`), runs `route-runner.mjs route`: label from `vars.WEB_RUNNER_LABEL` (comma list allowed, e.g. `acer-web,dell-web`, first idle wins); `self` only if trusted AND a runner with the label is `online` AND `busy:false`. Any error, missing script, missing token -> `hosted`. Never red. |
| `bom-check-routed` | `needs.route.outputs.runner` | only if route said `self` AND the trust `if:` holds. Step 1 reads the gate verdict the hook wrote; refused/missing/stale -> skips, exit 0. Check runs under `timeout 240`; outputs `verdict=pass|busy-timeout|code-failure`; red only on code-failure. |
| `bom-check-watch` | ubuntu-latest | only when routed: polls the run's jobs; if `bom-check-routed` is still `queued` after 120 s (runner went offline/busy after routing), cancels THIS run. |
| `bom-check` (REQUIRED) | ubuntu-latest | `if: always() && !(routed success && verdict pass)`. Skipped (= Success for a required check) when the side machine passed; red with "code failure, not a runner problem" when it failed on code; otherwise runs the check itself. `always()` makes it run after the watchdog's cancel too. |

Outcome table (all pinned in `tests/routeRunner.test.ts`, 64 cases):

| situation | required `bom-check` |
|---|---|
| variable unset / untrusted / API error / no token / offline / busy at route time | runs hosted |
| routed, gate refused (busy 180 s, walk running) | routed job green-skipped, hosted runs |
| routed, check over 240 s | `busy-timeout`, hosted runs |
| routed, runner dies / job timeout / hook crash | routed result failure with no verdict, hosted runs |
| routed, never picked up | watchdog cancels at 120 s, hosted runs (bounded, never 24 h) |
| routed, passed | skipped = Success (no hosted minutes) |
| routed, real BOM found | red, message says code failure |

Cost note: the watchdog bills one hosted minute per routed run, so for the 1-minute pilot job the
saving is zero; the pattern pays for itself on the stage 4 jobs (e2e 17 min, phone-qa 20 min).

## Trust (item 2) and residual risk

Self-hosted only for: `push` to `refs/heads/main`; or `pull_request` where
`head.repo.full_name == github.repository` AND the author is `kiki-claude-bot` or `123constante`
AND no changed file is under `.github/` or `scripts/ci/` (files read from the API; unreadable
list -> hosted). Everything else, including `pull_request_target`, `workflow_run`, schedules,
pushes to other branches, runs hosted. The route script is taken from the PR **base**, so a PR
cannot change the rule that routes it; the job `if:` repeats the first two conditions.

Residual risk, in plain words: anyone who can push a branch to this repo AND open the PR as one
of the two allowlisted accounts can run code of their choice on the side machine. That code runs
as an unprivileged user with no sudo, no access to `/home`, `/root` or the admin runners, no
write access to the hooks or the runner credentials, no LAN access, 4 GB memory, and its files
are wiped after the job. It CAN reach the internet, read the job's own read-only `GITHUB_TOKEN`,
and keep a process alive until the job ends (the service kills the cgroup on stop). It cannot
change the routing, the workflow or the guard without touching `.github/` or `scripts/ci/`,
which always routes hosted. If the bot account were compromised, the side machine is exposed to
the extent above; the switch is still: delete `WEB_RUNNER_LABEL`.

## The runner (exact, Acer)

| item | value |
|---|---|
| name / labels | `acer-web` / `self-hosted` + `acer-web` |
| user | `ghrunner-web` (system user, nologin, no sudo), supplementary group `laptop-walk` |
| runner dir | `/srv/ghrunner-web/runner` (root-owned after config; only `_work`, `_diag` writable) |
| state dir | `/srv/ghrunner-web/state` (ghrunner-web 0700): `gate-verdict`, `lock-holder.pid` |
| hooks | `/usr/local/lib/ghrunner-web/hooks/*.sh` root:root 0755 |
| walk lock | `/var/lib/laptop-walk/walk.lock`, dir root:laptop-walk 2775 (setgid, NOT sticky /tmp) |
| unit | `docs/ci-offload/acer-web/actions.runner.bachata-website.acer-web.service` |

Install (as `ci`, which has sudo; the registration token comes from the owner by the private
route and is never written in the repo or chat):

```
sudo groupadd --system laptop-walk
sudo useradd --system --create-home --home-dir /srv/ghrunner-web --shell /usr/sbin/nologin ghrunner-web
sudo usermod -aG laptop-walk ghrunner-web; sudo usermod -aG laptop-walk ci   # + whoever runs walks
sudo install -d -o root -g laptop-walk -m 2775 /var/lib/laptop-walk
sudo install -d -o ghrunner-web -g ghrunner-web -m 0700 /srv/ghrunner-web/state
sudo install -d -o ghrunner-web -g ghrunner-web -m 0755 /srv/ghrunner-web/runner
# download + verify the actions/runner tarball into /srv/ghrunner-web/runner (same version as the admin runners)
sudo -u ghrunner-web /srv/ghrunner-web/runner/config.sh --unattended --disableupdate \
  --url https://github.com/123constante/bachata-website --token "<from owner>" \
  --name acer-web --labels acer-web --runnergroup Default --work _work
sudo -u ghrunner-web mkdir -p /srv/ghrunner-web/runner/_work /srv/ghrunner-web/runner/_diag
# lock the runner binaries + credentials: root owns everything except _work and _diag
sudo chown -R root:ghrunner-web /srv/ghrunner-web/runner && sudo chmod -R g-w,o-rwx /srv/ghrunner-web/runner
sudo chown -R ghrunner-web:ghrunner-web /srv/ghrunner-web/runner/_work /srv/ghrunner-web/runner/_diag
sudo chmod 0640 /srv/ghrunner-web/runner/.credentials /srv/ghrunner-web/runner/.credentials_rsaparams /srv/ghrunner-web/runner/.runner
sudo install -d -o root -g root -m 0755 /usr/local/lib/ghrunner-web/hooks
sudo install -o root -g root -m 0755 gate-job-started.sh gate-job-completed.sh /usr/local/lib/ghrunner-web/hooks/
sudo install -m 0644 actions.runner.bachata-website.acer-web.service /etc/systemd/system/
sudo sed -i 's/\r$//' /etc/systemd/system/actions.runner.bachata-website.acer-web.service /usr/local/lib/ghrunner-web/hooks/*.sh  # repo checks these out CRLF
sudo systemctl daemon-reload && sudo systemctl enable --now actions.runner.bachata-website.acer-web.service
```

`--disableupdate`: the runner cannot rewrite its own binaries (they are read-only). GitHub stops
sending jobs to a runner more than 30 days behind; when that happens the route reads it as
offline-or-busy and everything runs hosted (safe), and `ci` updates the tarball by hand. Do NOT
use `svc.sh install` (it writes a unit without the caps).

**laptop-safe.mjs / the walk tooling must take `flock` on `/var/lib/laptop-walk/walk.lock`**
(not `/tmp/laptop-walk.lock`: with `fs.protected_regular=1` a second user cannot open another
user's file in sticky `/tmp`, so one side would silently skip the lock). Change both in one go.

## Routing and revert

- ON: set repo variable `WEB_RUNNER_LABEL=acer-web` (later `acer-web,dell-web`), AND create the
  secret `WEB_RUNNER_READ_TOKEN` (fine-grained PAT, this repo only, Administration: read; register
  entry in PATCH A). Without the token every run is hosted (safe, by test).
- OFF (the revert, no push): delete `WEB_RUNNER_LABEL`.
- The daily "delete the variable when the runner reads offline" rule is no longer needed for
  safety (offline -> hosted by itself); keep it only as hygiene.

## The Dell (item 8)

Same service, own label, no Docker: the Dell takes the jobs that need only node (unit, tsc,
build, bom-check). Differences from the Acer, nothing else:

- name/label `dell-web`; unit file = the Acer unit with `acer-web` -> `dell-web` in the
  Description and file name (`actions.runner.bachata-website.dell-web.service`);
  `config.sh ... --name dell-web --labels dell-web`.
- the same user/dirs/hooks/lock layout; `SAFE_LOAD_MAX`/`SAFE_MEM_MIN` set to the Dell's own walk
  gate values; `MemoryMax` to what the Dell can spare (keep 4G if it has 8 GB+).
- `InaccessiblePaths`: list the Dell's real other-runner/user dirs.
- routing: set `WEB_RUNNER_LABEL=acer-web,dell-web`; the route script picks the first online+idle
  one, else hosted. No workflow change.
- a job that needs Playwright browsers (stage 4 e2e, phone-qa) must NOT be routed to the Dell
  until browsers are installed there; give such a job its own variable/label list.

## PATCHES (the lead applies; the sandbox cannot push `.github/`)

PATCH A, against this branch's head. It (1) removes `bom-check` from `workflow-lint.yml`
(dropping the old negative-guard version too), (2) adds `.github/workflows/bom-check.yml`
(the docs copy it duplicated was deleted in fix round 2, item 7), (3) adds the `WEB_RUNNER_READ_TOKEN`
register entry (`exists: false`, dated reasons), (4) adds `bom-check.yml` to the workflow subset
in `tests/automationFoundations.test.ts` (must land together with the workflow file).

Apply: save the block below as `fix1.patch`, then `git apply --ignore-whitespace fix1.patch`
(the repo checks files out CRLF; the patch is LF). Proven here on a clean checkout of this
branch: applies; then `node scripts/check-secrets-register.mjs` = OK (1 routed job trust-gated),
and `tests/automationFoundations.test.ts` + `tests/automationRegister.test.ts` = 151 passed.
Mutant: delete `&& github.event.pull_request.head.repo.full_name == github.repository` from the
routed job `if:` -> the guard exits 1 naming that condition (run, output in the PR).

The automation allow-list guard (`check-automation-workflow-allowlist.mjs`) will want
`bom-check.yml` (and still `workflow-lint.yml`) allow-listed or an owner Approve at head.
`.github/automation/secrets-register.json` and `scripts/check-secrets-register.mjs` are guard
paths: owner Approve at head.

```diff
diff --git a/.github/automation/secrets-register.json b/.github/automation/secrets-register.json
index 7a17a2e..54522c1 100644
--- a/.github/automation/secrets-register.json
+++ b/.github/automation/secrets-register.json
@@ -666,6 +666,37 @@
       "absent_readers": {
         "db-contract-check.yml": "measured 2026-11-05: step 73 passes secrets.P3_RULES_DB_URL and, when it is empty, prints one SKIP line and exits 0 before --live runs; no such secret exists in this repo"
       }
+    },
+    {
+      "name": "WEB_RUNNER_READ_TOKEN",
+      "kind": "pat",
+      "class": "automation",
+      "role": "ci-offload route (read runner status)",
+      "exists": false,
+      "acts_as": null,
+      "acts_as_state": "to record",
+      "owner_login": "123constante",
+      "identity_check": "user",
+      "required_minimum_scope": [
+        "administration:read"
+      ],
+      "contract_text": "CI offload stage 3: fine-grained PAT on 123constante/bachata-website ONLY, Administration: read (the only permission that lists self-hosted runners), nothing else; read by the hosted `route` job of bom-check.yml, which checks out the BASE commit (never PR code); not exposed to fork PRs by GitHub. Absent = every routed job runs hosted.",
+      "actual_scope": "NOT VERIFIED",
+      "expiry": null,
+      "contract_readers": [
+        "bom-check.yml"
+      ],
+      "readers_allowed": [
+        "bom-check.yml"
+      ],
+      "grandfathered": {},
+      "untrusted_trigger_grandfathered": {
+        "bom-check.yml": "2026-11-06: read only by the hosted route job, which checks out the PR BASE sha (sparse scripts/ci, scripts/lib), runs no PR code, and the token can only read runner status (docs/handover/ci-offload-stage3.md, Trust)"
+      },
+      "note": "not created yet (2026-11-06); the owner creates it when the side-machine pilot starts",
+      "absent_readers": {
+        "bom-check.yml": "2026-11-06: route-runner.mjs handles an empty RUNNER_READ_TOKEN as 'API error -> hosted' (tests/routeRunner.test.ts)"
+      }
     }
   ]
 }
diff --git a/.github/workflows/bom-check.yml b/.github/workflows/bom-check.yml
new file mode 100644
index 0000000..af04c34
--- /dev/null
+++ b/.github/workflows/bom-check.yml
@@ -0,0 +1,155 @@
+name: BOM Check
+
+# CI offload stage 3 (docs/handover/ci-offload-stage3.md). The required check `bom-check`
+# may run on a side machine (Acer/Dell) and FALLS BACK to GitHub-hosted whenever that
+# machine is off, busy, broken or its gate refuses: a side machine never reds or blocks a PR.
+#   route            hosted, seconds: scripts/ci/route-runner.mjs route (trust + runner online/idle)
+#   bom-check-routed side machine, only when route said self AND the trust if: holds
+#   bom-check-watch  hosted: cancels THIS run if bom-check-routed sits queued > 120 s
+#                    (that is why this is its own workflow: a cancel touches nothing else)
+#   bom-check        hosted, the REQUIRED name: skipped (= success) when the routed run passed,
+#                    red when it failed on code, otherwise runs the check itself.
+# Revert switch: delete the repo variable WEB_RUNNER_LABEL (unset = always hosted).
+
+on:
+  push:
+    branches: [main, master]
+  pull_request:
+    branches: [main, master]
+
+concurrency:
+  group: bom-check-${{ github.event_name == 'pull_request' && github.head_ref || github.run_id }}
+  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
+
+permissions:
+  contents: read
+
+jobs:
+  route:
+    runs-on: ubuntu-latest
+    timeout-minutes: 2
+    permissions:
+      contents: read
+      pull-requests: read
+    outputs:
+      target: ${{ steps.route.outputs.target }}
+      runner: ${{ steps.route.outputs.runner }}
+    steps:
+      # The BASE commit's route script, never the PR's: a PR cannot change its own routing.
+      - uses: actions/checkout@v7
+        with:
+          ref: ${{ github.event.pull_request.base.sha || github.sha }}
+          persist-credentials: false
+          sparse-checkout: |
+            scripts/ci
+            scripts/lib
+      - name: Route (self-hosted only when trusted AND online AND idle)
+        id: route
+        env:
+          WEB_RUNNER_LABEL: ${{ vars.WEB_RUNNER_LABEL }}
+          RUNNER_READ_TOKEN: ${{ secrets.WEB_RUNNER_READ_TOKEN }}
+          GITHUB_TOKEN: ${{ github.token }}
+          EVENT_NAME: ${{ github.event_name }}
+          HEAD_REPO: ${{ github.event.pull_request.head.repo.full_name }}
+          PR_AUTHOR: ${{ github.event.pull_request.user.login }}
+          PR_NUMBER: ${{ github.event.pull_request.number }}
+        # A missing/broken script (e.g. the base predates it) means hosted, never red.
+        run: node scripts/ci/route-runner.mjs route || { echo "target=hosted"; echo "runner=ubuntu-latest"; } >> "$GITHUB_OUTPUT"
+
+  bom-check-routed:
+    needs: route
+    # Trust is checked TWICE: by the route script and here (scripts/check-secrets-register.mjs
+    # rule (e-routed) fails if any of these conditions is removed).
+    if: needs.route.outputs.target == 'self' && ((github.event_name == 'push' && github.ref == 'refs/heads/main') || (github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository && contains(fromJSON('["kiki-claude-bot","123constante"]'), github.event.pull_request.user.login)))
+    runs-on: ${{ needs.route.outputs.runner }}
+    # Budget: gate wait <= 180 s (job-started hook) + check <= 240 s (timeout(1) below) + slack.
+    # A timeout here is "runner busy", never a code failure: the hosted job re-runs it.
+    timeout-minutes: 10
+    permissions:
+      contents: read
+    outputs:
+      verdict: ${{ steps.check.outputs.verdict }}
+    steps:
+      - uses: actions/checkout@v7
+        with:
+          persist-credentials: false
+      - name: Gate verdict (load + walk lock, written by the job-started hook)
+        id: gate
+        run: node scripts/ci/route-runner.mjs gate
+      - name: Detect docs-only PR
+        id: changes
+        if: steps.gate.outputs.proceed == 'true'
+        env:
+          EVENT_NAME: ${{ github.event_name }}
+          MERGE_SHA: ${{ github.sha }}
+        run: node scripts/ci/docs-only.mjs --merge "$MERGE_SHA"
+      - name: Check workflow files for BOM (budget 240 s)
+        id: check
+        if: steps.gate.outputs.proceed == 'true'
+        env:
+          DOCS_ONLY: ${{ steps.changes.outputs.docs_only }}
+        run: |
+          set +e
+          if [ "$DOCS_ONLY" = "true" ]; then code=0; else timeout --kill-after=10 240 bash scripts/ci/bom-check.sh; code=$?; fi
+          node scripts/ci/route-runner.mjs verdict "$code"
+
+  bom-check-watch:
+    needs: route
+    if: needs.route.outputs.target == 'self'
+    runs-on: ubuntu-latest
+    timeout-minutes: 5
+    permissions:
+      contents: read
+      actions: write
+    steps:
+      - uses: actions/checkout@v7
+        with:
+          ref: ${{ github.event.pull_request.base.sha || github.sha }}
+          persist-credentials: false
+          sparse-checkout: |
+            scripts/ci
+            scripts/lib
+      - name: Cancel this run if the side machine never picks the job up
+        env:
+          GITHUB_TOKEN: ${{ github.token }}
+          WATCH_JOB_NAME: bom-check-routed
+          QUEUE_BUDGET_S: '120'
+        run: node scripts/ci/route-runner.mjs watch || true
+
+  bom-check:
+    needs: [route, bom-check-routed]
+    # always(): also runs after the watchdog cancels the run -- that IS the hosted fallback.
+    if: always() && !(needs.bom-check-routed.result == 'success' && needs.bom-check-routed.outputs.verdict == 'pass')
+    runs-on: ubuntu-latest
+    timeout-minutes: 5
+    permissions:
+      contents: read
+    steps:
+      - uses: actions/checkout@v7
+      - name: Fallback decision
+        id: fb
+        env:
+          TARGET: ${{ needs.route.outputs.target }}
+          ROUTED_RESULT: ${{ needs.bom-check-routed.result }}
+          ROUTED_VERDICT: ${{ needs.bom-check-routed.outputs.verdict }}
+        run: node scripts/ci/route-runner.mjs fallback || echo "action=run-hosted" >> "$GITHUB_OUTPUT"
+      - name: Routed run failed on code
+        if: steps.fb.outputs.action == 'fail-code'
+        run: |
+          echo "bom-check FAILED on the side machine: a code failure, not a runner problem (see bom-check-routed)."
+          exit 1
+
+      # Docs-only PRs skip the heavy steps below; the job still runs, so the
+      # required check keeps its name and reports success. Fail-safe: any error
+      # means docs_only=false (scripts/ci/docs-only.mjs).
+      - name: Detect docs-only PR
+        id: changes
+        if: steps.fb.outputs.action != 'fail-code'
+        env:
+          EVENT_NAME: ${{ github.event_name }}
+          MERGE_SHA: ${{ github.sha }}
+        run: node scripts/ci/docs-only.mjs --merge "$MERGE_SHA"
+
+      - name: Check workflow files for BOM
+        if: steps.fb.outputs.action != 'fail-code' && steps.changes.outputs.docs_only != 'true'
+        run: bash scripts/ci/bom-check.sh
diff --git a/.github/workflows/workflow-lint.yml b/.github/workflows/workflow-lint.yml
index b0081dd..4e5427e 100644
--- a/.github/workflows/workflow-lint.yml
+++ b/.github/workflows/workflow-lint.yml
@@ -18,54 +18,6 @@ concurrency:
   cancel-in-progress: ${{ github.event_name == 'pull_request' }}
 
 jobs:
-  bom-check:
-    # CI offload stage 3 pilot (docs/handover/ci-offload-stage3.md). Routed by
-    # the repo variable WEB_RUNNER_LABEL: unset (today) = hosted ubuntu-latest;
-    # set to `acer-web` = the one self-hosted Website runner on the Acer.
-    # DELETING the variable is the revert switch (no push, no deploy).
-    # A fork PR is never routed to the self-hosted runner: the label applies
-    # only when the event is not a pull_request, or the PR head is this repo.
-    # This job uses no secrets and only a read token.
-    runs-on: ${{ (vars.WEB_RUNNER_LABEL != '' && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository)) && vars.WEB_RUNNER_LABEL || 'ubuntu-latest' }}
-    # A job queued for an offline self-hosted runner waits up to 24 h; this
-    # caps the run itself. The queue rule (delete the variable when the runner
-    # reads offline) is in the handover.
-    timeout-minutes: 5
-    permissions:
-      contents: read
-    steps:
-      - uses: actions/checkout@v7
-
-      # Docs-only PRs skip the heavy steps below; the job still runs, so the
-      # required check keeps its name and reports success. Fail-safe: any error
-      # means docs_only=false (scripts/ci/docs-only.mjs).
-      - name: Detect docs-only PR
-        id: changes
-        env:
-          EVENT_NAME: ${{ github.event_name }}
-          MERGE_SHA: ${{ github.sha }}
-        run: node scripts/ci/docs-only.mjs --merge "$MERGE_SHA"
-
-      - name: Check workflow files for BOM
-        if: steps.changes.outputs.docs_only != 'true'
-        run: |
-          FAILED=0
-          for f in .github/workflows/*.yml .github/workflows/*.yaml; do
-            [ -f "$f" ] || continue
-            # Detect standard BOM (ef bb bf) or double-encoded BOM (c3 af ...)
-            FIRST=$(head -c 3 "$f" | xxd -p)
-            if [ "$FIRST" = "efbbbf" ] || echo "$FIRST" | grep -q "^c3af"; then
-              echo "BOM detected in $f (first bytes: $FIRST)"
-              FAILED=1
-            fi
-          done
-          if [ "$FAILED" = "1" ]; then
-            echo ""
-            echo "Fix: strip the BOM and re-write via safe-write.py --lf"
-            exit 1
-          fi
-          echo "No BOMs found in .github/workflows/"
-
   masking-check:
     # Guards against the dead-Lighthouse failure mode: a check masked green by an
     # unjustified continue-on-error. Every continue-on-error must carry a
diff --git a/tests/automationFoundations.test.ts b/tests/automationFoundations.test.ts
index 471cd6c..bb84ff4 100644
--- a/tests/automationFoundations.test.ts
+++ b/tests/automationFoundations.test.ts
@@ -174,7 +174,7 @@ describe('MUTANT: a mergePr that skips the re-read merges at an A17 head (the ru
 const WF = path.join(ROOT, '.github/workflows');
 const readTree = () => {
   const workflows: Record<string, string> = {};
-  for (const f of ['architecture-guard.yml', 'unit-tests.yml', 'workflow-lint.yml', 'typecheck.yml', 'perf-budget.yml', 'e2e-smoke.yml', 'phone-qa.yml', 'types-drift.yml', 'owner-approval.yml']) workflows[f] = readFileSync(path.join(WF, f), 'utf8');
+  for (const f of ['architecture-guard.yml', 'unit-tests.yml', 'workflow-lint.yml', 'bom-check.yml', 'typecheck.yml', 'perf-budget.yml', 'e2e-smoke.yml', 'phone-qa.yml', 'types-drift.yml', 'owner-approval.yml']) workflows[f] = readFileSync(path.join(WF, f), 'utf8');
   return workflows;
 };
 const drive = async (argv: string[], read: () => unknown) => {
```

**Until PATCH A is applied this branch's `secrets-register` check is RED on purpose:** the new
rule (e-routed) sees the branch's current `workflow-lint.yml` `bom-check` (expression `runs-on`,
no trust `if:`) -- exactly the gap the review found.
Same cause, same cure: 5 tests in `tests/automationRegister.test.ts` ("the real register over
the real workflows is green" family) fail on this branch as pushed and pass with PATCH A applied.

## Eligibility table (brief A5)

Generated mechanically from `.github/workflows/*.yml` at 01914fa + this PR (script: parse each job,
collect `secrets.X` in the job and workflow-level env/defaults, job or workflow `permissions`,
triggers, checkout ref). "default" permissions = the repo's default token setting, which is not
readable from the files: treat as possibly write, so every routed job gets an explicit
`permissions: contents: read`. "needs fork guard" = no secrets, read-only, no
`pull_request_target`/`workflow_run`, but triggered by `pull_request` without the
`head.repo.full_name == github.repository` condition yet. A reviewer re-derives with
`grep -n 'secrets\.\|pull_request_target\|workflow_run\|permissions' .github/workflows/*.yml`.

| job | workflow | secrets.* read | token permissions | pull_request_target / workflow_run | fork PR code | checkout ref | eligible |
|---|---|---|---|---|---|---|---|
| integrity | architecture-guard.yml | none | default | no | PR (fork PR code reachable) | default | yes, needs fork guard |
| identity | automation-identity-check.yml | BOT_PR_TOKEN AUTOMERGE_TOKEN | contents:read | no | no PR trigger | main | NO |
| guard | automation-pause-guard.yml | none | contents:read issues:write pull-requests:write | no | no PR trigger | main | NO |
| disarm | automation-pause-guard.yml | none | contents:read issues:write pull-requests:write | no | no PR trigger | main | NO |
| expiry | automation-token-expiry.yml | none | contents:read issues:write | no | no PR trigger | main | NO |
| arming | autopilot.yml | none | contents:read issues:write | no | no PR trigger | main | NO |
| autopilot | autopilot.yml | BOT_PR_TOKEN AUTOMERGE_TOKEN | contents:read issues:write pull-requests:write actions:write checks:read statuses:read | no | no PR trigger | ${{ github.event.repository.default_branch }} | NO |
| announce-failure | autopilot.yml | none | contents:read issues:write | no | no PR trigger | none | NO |
| decide | bot-automerge.yml | BOT_PR_TOKEN | contents:read pull-requests:write issues:read | prt | no PR trigger | main | NO |
| open-pr | bot-pr.yml | BOT_PR_TOKEN | contents:read | no | no PR trigger | ${{ github.event.repository.default_branch }} | NO |
| canary | ci-budget-guard.yml | none | contents:read | no | no PR trigger | default | YES |
| measure | ci-budget-guard.yml | CI_BUDGET_GITHUB_TOKEN | contents:read | no | no PR trigger | default | NO |
| purge | cloudflare-purge-on-deploy.yml | CLOUDFLARE_API_TOKEN CLOUDFLARE_ZONE_ID | contents:read deployments:read | no | no PR trigger | none | NO |
| live-db-gate | db-contract-check.yml | none | contents:read | no | PR (fork PR code reachable) | default | yes, needs fork guard |
| contract-check | db-contract-check.yml | VITE_SUPABASE_URL VITE_SUPABASE_PUBLISHABLE_KEY P3_RULES_DB_URL | contents:read issues:write | no | PR (fork PR code reachable) | default | NO |
| enable | dependabot-automerge.yml | GITHUB_TOKEN | contents:write pull-requests:write issues:read | no | PR (fork PR code reachable) | main | NO |
| decide | deploy-production-trial.yml | none | contents:read | no | no PR trigger | default | YES |
| deploy-preview | deploy-production-trial.yml | VERCEL_TOKEN VERCEL_ORG_ID VERCEL_PROJECT_ID | contents:read | no | no PR trigger | default | NO |
| canary | deployment-storage-check.yml | none | contents:read issues:write | no | no PR trigger | default | NO |
| measure | deployment-storage-check.yml | VERCEL_TOKEN | contents:read issues:write | no | no PR trigger | default | NO |
| e2e-smoke | e2e-smoke.yml | none | default | no | PR (fork PR code reachable) | default | yes, needs fork guard |
| canary | firewall-drift-check.yml | none | contents:read issues:write | no | no PR trigger | default | NO |
| measure | firewall-drift-check.yml | VERCEL_TOKEN | contents:read issues:write | no | no PR trigger | default | NO |
| gsc-check | gsc-health-check.yml | GSC_SERVICE_ACCOUNT_KEY | contents:read issues:write | no | no PR trigger | default | NO |
| canary | io-health-guard.yml | none | contents:read issues:write | no | no PR trigger | default | NO |
| poll | io-health-guard.yml | IO_HEALTH_SECRET | contents:read issues:write | no | no PR trigger | default | NO |
| live-qa | live-qa.yml | SUPABASE_ACCESS_TOKEN SLACK_WEBHOOK_URL | contents:read issues:write | no | no PR trigger | default | NO |
| no-preview-reason | og-image-check.yml | none |  | no | PR (fork PR code reachable) | none | yes, needs fork guard |
| og-check | og-image-check.yml | CI_BYPASS_HEADER | contents:read issues:write | no | PR (fork PR code reachable) | default | NO |
| og-preview | og-image-check.yml | GITHUB_TOKEN VERCEL_AUTOMATION_BYPASS_SECRET | contents:read deployments:read | no | PR (fork PR code reachable) | default | NO |
| audit | owner-approval.yml | GITHUB_TOKEN | contents:read pull-requests:read issues:write | no | no PR trigger | default | NO |
| no-preview-reason | perf-budget.yml | none |  | no | PR (fork PR code reachable) | none | yes, needs fork guard |
| bundle-budget | perf-budget.yml | none | default | no | PR (fork PR code reachable) | default | yes, needs fork guard |
| lighthouse | perf-budget.yml | GITHUB_TOKEN VERCEL_AUTOMATION_BYPASS_SECRET | contents:read deployments:read | no | PR (fork PR code reachable) | default | NO |
| doc-weight | perf-budget.yml | GITHUB_TOKEN VERCEL_AUTOMATION_BYPASS_SECRET | contents:read deployments:read | no | PR (fork PR code reachable) | default | NO |
| phone-qa-section | phone-qa-section.yml | none | contents:read pull-requests:read | no | PR (fork PR code reachable) | default | yes, needs fork guard |
| phone-qa | phone-qa.yml | none | contents:read | no | PR (fork PR code reachable) | default | yes, needs fork guard |
| build-smoke | phone-qa.yml | none | contents:read | no | PR (fork PR code reachable) | default | yes, needs fork guard |
| probe-new-deployment | post-merge-prod-alarm.yml | VERCEL_AUTOMATION_BYPASS_SECRET | contents:read issues:write pull-requests:write |  workflow_run | no PR trigger | none | NO |
| brake | post-merge-prod-alarm.yml | GITHUB_TOKEN | contents:read issues:write pull-requests:write |  workflow_run | no PR trigger | main | NO |
| mergeable | pr-mergeable-guard.yml | GITHUB_TOKEN | contents:read pull-requests:read checks:read statuses:write | no | no PR trigger | default | NO |
| smoke | prod-smoke.yml | CI_BYPASS_HEADER | contents:read issues:write | no | no PR trigger | default | NO |
| real-data-verified | real-data-verified.yml | none | contents:read pull-requests:read | no | PR (fork PR code reachable) | default | yes, needs fork guard |
| monitor | sentry-monitor.yml | SENTRY_READ_TOKEN SENTRY_UPLOAD_TOKEN SENTRY_WRITE_TOKEN | contents:read | no | no PR trigger | default | NO |
| no-preview-reason | seo-check.yml | none |  | no | PR (fork PR code reachable) | none | yes, needs fork guard |
| seo-check | seo-check.yml | CI_BYPASS_HEADER | contents:read issues:write | no | PR (fork PR code reachable) | default | NO |
| seo-preview | seo-check.yml | GITHUB_TOKEN VERCEL_AUTOMATION_BYPASS_SECRET | contents:read deployments:read | no | PR (fork PR code reachable) | default | NO |
| sitemap-submit | sitemap-submit.yml | CI_BYPASS_HEADER GSC_SERVICE_ACCOUNT_KEY | contents:read issues:write | no | no PR trigger | default | NO |
| sweep | stale-bot-pr-sweep.yml | BOT_PR_TOKEN | contents:read issues:read pull-requests:write | no | no PR trigger | main | NO |
| report | stale-wip-report.yml | GITHUB_TOKEN | contents:read pull-requests:read | no | no PR trigger | default | NO |
| no-preview-reason | synthetic-ssr-monitor.yml | none |  | no | PR (fork PR code reachable) | none | yes, needs fork guard |
| synthetic | synthetic-ssr-monitor.yml | SLACK_WEBHOOK_URL | contents:read issues:write | no | PR (fork PR code reachable) | default | NO |
| synthetic-preview | synthetic-ssr-monitor.yml | GITHUB_TOKEN VERCEL_AUTOMATION_BYPASS_SECRET | contents:read deployments:read | no | PR (fork PR code reachable) | default | NO |
| wallclock-brand | typecheck.yml | none | default | no | PR (fork PR code reachable) | default | yes, needs fork guard |
| autoheal | types-drift-autoheal.yml | TYPES_BOT_TOKEN SUPABASE_ACCESS_TOKEN | contents:read | no | no PR trigger | main | NO |
| types-drift | types-drift.yml | SUPABASE_ACCESS_TOKEN | default | no | PR (fork PR code reachable) | default | NO |
| unit | unit-tests.yml | VITE_SUPABASE_URL VITE_SUPABASE_PUBLISHABLE_KEY | contents:read | no | PR (fork PR code reachable) | default | NO |
| dancer-area-isolation | unit-tests.yml | none | contents:read | no | PR (fork PR code reachable) | default | yes, needs fork guard |
| digest | weekly-digest.yml | GSC_SERVICE_ACCOUNT_KEY VITE_SUPABASE_URL VITE_SUPABASE_PUBLISHABLE_KEY ADMIN_READ_TOKEN GITHUB_TOKEN | contents:read issues:write | no | no PR trigger | default | NO |
| bom-check | workflow-lint.yml | none | contents:read | no | PR, fork-guarded | default | YES |
| masking-check | workflow-lint.yml | none | default | no | PR (fork PR code reachable) | default | yes, needs fork guard |
| notification-check | workflow-lint.yml | none | default | no | PR (fork PR code reachable) | default | yes, needs fork guard |

## Part B verdict: NOT built (cost rule), numbers below

Baseline (`docs/handover/ci-offload-stage3-baseline.md`, PR runs on 2026-11-05): unit London full median
561 s = 10 billed min; e2e-smoke median 1012 s = 17 billed min; hosted billed minutes per PR median
65.5 (8 PRs, range 24-111); 460 PRs merged in the last 30 days.

The split could not be measured as the brief asks (scratch branch + workflow_dispatch): this worker may
push only `claude/ci-offload-stage3`. Estimate instead, per job billed = ceil(minutes), with per-piece
overhead (checkout, setup-node, npm upgrade, `npm ci` about 75 s, plus Playwright install for e2e):

| piece set | overhead per piece | billed min after | billed min before | delta |
|---|---|---|---|---|
| unit 3 shards + aggregator | 90-120 s | 3x5 + 1 = 16 | 10 | +6 |
| e2e 3 shards + P3 piece + aggregator | 90-150 s | 4x6..7 + 1 = 25..29 | 17 | +8..+12 |
| total per PR | | | 65.5 | +14..+18 = **+21%..+27%** |

That sits at or over the 25% ceiling before counting the separate live-DB gate job, so under "cost
first" the split is not worth building blind. If the lead still wants it, the next step is ONE
measured dispatch run on a scratch branch the lead names (the worker cannot create one).

## Stage 4 proposal: move eligible jobs to the Acer instead (order = minutes saved per PR)

| job | workflow | billed min/PR (baseline) | what it needs first |
|---|---|---|---|
| phone-qa | phone-qa.yml | 20 | fork guard in runs-on, `permissions: contents: read`, Playwright browsers on the Acer, memory check vs 4 GB |
| e2e-smoke | e2e-smoke.yml | 17 | same; P3 step too; artifacts upload is fine (read token) |
| build-smoke | phone-qa.yml | 6 | fork guard, explicit read permissions |
| bundle-budget | perf-budget.yml | 2 | fork guard, explicit read permissions |
| integrity, masking-check, notification-check, wallclock-brand, dancer-area-isolation, real-data-verified, phone-qa-section, no-preview-reason x4 | various | about 1 each | fork guard, explicit read permissions |

phone-qa + e2e-smoke alone are 37 of 65.5 billed minutes per PR (56%); at 460 PRs/month that is about
17,000 hosted minutes a month. NOT eligible while they read secrets: `unit` (London full;
`VITE_SUPABASE_*`), `contract-check`, every deploy/prod/monitor job (see table). A single runner
doing one job at a time cannot absorb 460 PRs x 37 min (about 280 h a month, about 9 h a day): stage 4
must measure Acer wall time for e2e and decide between one runner (queueing) or a hosted fallback.

## What is left (owner / lead)

1. LEAD: apply PATCH A on this branch (section PATCHES), push, re-run checks.
2. OWNER: Approve at head (guard paths: secrets register + its checker; workflow allow-list for
   `bom-check.yml`/`workflow-lint.yml`).
3. OWNER: runner registration token for `acer-web` (private route; repo Settings, Actions,
   Runners, New self-hosted runner, the `--token` value; valid 1 h), then `ci` installs per
   "The runner (exact)". Same later for `dell-web`.
4. OWNER: create `WEB_RUNNER_READ_TOKEN` (fine-grained PAT, this repo only, Administration:
   read), flip the register entry to `exists: true` and drop its `absent_readers`.
5. On the Acer: point laptop-safe.mjs / the walk tooling at `/var/lib/laptop-walk/walk.lock`;
   set `SAFE_LOAD_MAX`/`SAFE_MEM_MIN` to the walk gate's values; fix `InaccessiblePaths`; set
   `IPAddressAllow` for a LAN DNS resolver if there is one.
6. Pilot proof (none possible without a runner): (a) one routed pass -> `bom-check` skipped =
   Success; (b) start a walk, then a routed run -> gate refused, `bom-check` ran hosted, green;
   (c) stop the service right after routing -> watchdog cancels at ~120 s and `bom-check` runs
   hosted (this proves the `always()`-after-cancel behaviour, not yet seen live);
   (d) `systemctl restart` mid-job -> no `sleep`/node left (`systemd-cgls`), lock free.
7. Pilot 7 days / 20 routed runs, then `docs/handover/ci-offload-stage3-result.md`.
8. Billing: real Actions usage still NOT read (no gh api in workers).

## Verified / Not verified (fix round 1)

Verified (cloud container, this branch):
- `tests/routeRunner.test.ts` 64 cases: online/idle -> self; online/busy, offline, API error,
  label unset, untrusted, files unreadable, no token -> hosted; every fallback outcome; gate
  verdict ok/refused/stale/missing; exit 124/137 -> busy-timeout; watchdog cancels when queued
  past budget, never when started. `route-runner.mjs --self-test` PASS.
- `check-secrets-register.mjs --self-test` 28 cases incl. one mutant per trust condition and a
  `pull_request_target` mutant; on this branch as pushed the guard FAILS on the old
  `workflow-lint.yml` route (the gap); with PATCH A applied it passes; mutant on the real patched
  file -> exit 1.
- PATCH A applies with `git apply --ignore-whitespace` on a clean checkout; with it applied:
  `lint-workflow-masking`, `check-required-jobs`, `check-workflow-artifact-policy`,
  `check-workflow-log-secrets`, `lint-workflow-notification` all OK; automation tests 707 passed.
- Hooks, in the container with temp dirs: free lock -> `ok` verdict, holder in its own session
  with fds 0-2 on /dev/null, a walk cannot `flock -n`; completed hook releases it and wipes
  `_work` except `_tool`; walk holding the lock -> `refused`, exit 0, and `route-runner gate`
  reads `proceed=false`; load over max -> refused, exit 0; a pid file naming an unrelated
  process with a wrong start time -> that process is NOT killed.
- `bom-check.sh`: clean tree exit 0, BOM fixture exit 1 (and the old `xxd` fail-open seen).
- `systemd-analyze verify` on the unit: only complaint is the absent `run.sh`.

Not verified:
- Nothing on the Acer or Dell (no runner registered): hook env (`GITHUB_RUN_ID`/`GITHUB_JOB`
  visible to job hooks -- if not, every routed job reads a stale verdict and runs hosted: safe
  but useless), `KillMode=control-group` cleanup, `IPAddressDeny`, read-only runner dir with
  `--disableupdate`, `PrivateTmp`.
- That a job with `if: always()` runs after the watchdog's run cancel (documented GitHub
  behaviour; pilot proof 6c).
- That GitHub reports a skipped required job as Success for this ruleset (documented; pilot 6a).
- The workflow itself has never run (cannot push `.github/` from the sandbox).


## Verified / Not verified (fix round 2, dt_2f8827503d6b)

Verified (this container, 2026-11-06):
- `npx vitest run tests/routeRunner.test.ts tests/automationFoundations.test.ts tests/automationRegister.test.ts` = 3 files, 247 tests passed (routeRunner 96, incl. the shell hook test and its mutant).
- `node scripts/check-secrets-register.mjs` = OK (40 workflows, 1 routed job trust-gated); `--self-test` 41 cases PASS; `node scripts/ci/route-runner.mjs --self-test` 14 cases PASS.
- `bash docs/ci-offload/acer-web/test-gate-hooks.sh` = PASS 34 cases (real git over a local `file://` remote, real `flock`/`setsid`); hook mutant without the identity compare = FAIL 8 of 34.
- PATCH B: `git apply --check` clean; guard OK and YAML parses with it applied (then reverted; `.github/workflows` untouched by this round).
- `npm run lint` = 34 of 34 links green (eslint informational, as documented).
- No real-data shapes apply: CI-only change, no UI, no DB read.

Not verified (needs a live runner / the lead):
- That the runner passes `GITHUB_WORKFLOW_REF`, `GITHUB_WORKFLOW_SHA`, `GITHUB_TRIGGERING_ACTOR` to the job-started hook's environment (documented for hooks, not observed here). If any is missing, the hook refuses -> hosted (fails safe, but no offload).
- That `Runner.Worker` is an ancestor of the hook process (else the holder falls back to the 1800 s cap only; it logs that).
- That `_actions` / `_temp` are populated before the job-started hook (the reason for the item 8 deviation).
- Fetch by sha of a PR merge commit from github.com (fallback: fetch `GITHUB_REF`, then compare the sha).
- PATCH B on GitHub itself: the `await` poll against the real jobs API, step names in the API, and `!cancelled()` with a skipped `route` (needs the lead to apply it and a run with and without `WEB_RUNNER_LABEL`).
- The "Selected workflows" runner-group restriction (owner step 1).
