# CI offload wave 0 (groundwork) -- handover (Website)

Ticket dt_6fcc76e12c22. Brief: `brief/ci-offload-wave0:docs/briefs/ci-offload-wave0.md` v2
(blob 549f67bd). Branch `claude/ci-offload-wave0`, PR #1470. Builds on `docs/handover/ci-offload-stage3.md`.
Nothing here is live: no runner is registered by this PR, no workflow file is edited, no secret
or token is created or read. The lead's plans-folder files the brief lists (AUDIT / PILOT-FILES /
DESIGN-memory-slot-gate) were NOT reachable from this cloud worker; the work follows the brief text
and the stage 3 handover only.

## What changed

| file | change |
|---|---|
| `docs/ci-offload/acer-web/gate-job-started.sh` | identity section rewritten: allow-list, event payload, merge-commit and changed-files checks (below); `_home` emptied per job, `_cache` kept |
| `docs/ci-offload/acer-web/workflows.allow` (new) | the allow-list; ships with `bom-check.yml` only |
| `docs/ci-offload/acer-web/test-gate-hooks.sh` | table-driven: 313 cases + `--mutants` (36 mutants: 24 `#@rule` + 12 named; baseline `FAST=1` PASS 302; all caught). Re-measured 2026-11-08 on the unitfix branch, see "Unit file matches the live Acer" |
| `docs/ci-offload/acer-web/actions.runner.bachata-website.acer-web.service` | HOME / XDG / npm cache under `_work`, read-only `PLAYWRIGHT_BROWSERS_PATH`, `ExecStartPre` mkdir |
| `docs/ci-offload/acer-web/provision-checklist.md` (new) | what root installs; resolver check |

## Exact unit and user

- Unit: `/etc/systemd/system/actions.runner.bachata-website.acer-web.service` = the repo file
  (Dell: same file, `acer-web` -> `dell-web`). User/group `ghrunner-web`, supplementary group
  `laptop-walk`, no sudo, `NoNewPrivileges=yes`, `ProtectSystem=strict`, `ProtectHome=yes`.
- New env: `HOME=/srv/ghrunner-web/runner/_work/_home`,
  `XDG_CACHE_HOME=/srv/ghrunner-web/runner/_work/_cache`,
  `XDG_CONFIG_HOME=/srv/ghrunner-web/runner/_work/_home/.config`,
  `npm_config_cache=/srv/ghrunner-web/runner/_work/_cache/npm`,
  `PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright` (root-owned, read-only),
  `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`. `ReadWritePaths` unchanged (all of the above writable
  paths are already inside `_work`).
- Installed files: hooks in `/usr/local/lib/ghrunner-web/hooks/` (root 0755), allow-list at
  `/etc/ghrunner-web/workflows.allow` (root 0644), `gate.conf` at `/etc/ghrunner-web/gate.conf`.
  `gate.conf` key `WORKFLOW_PATH` (stage 3) is GONE; new keys `ALLOW_FILE`, `PROTECTED`.

## Allow-list format (`workflows.allow`)

One `.github/workflows/<name>.yml|.yaml` per line; blank lines and `#` comments (also trailing)
ignored; whitespace at the ends of a line (and a CR) is trimmed. Any other line (bare name, `..`,
whitespace INSIDE a name such as `bom check.yml`, anything) -> the hook refuses EVERY job (fail
closed; fix round 1: it used to strip inner spaces and read `bomcheck.yml`); an empty list likewise. Missing file -> `bom-check.yml` only. A listed workflow is
accepted only when its blob at `GITHUB_WORKFLOW_SHA` equals the blob on main, fetched fresh.
Waves 1-3 add one line per PR, each a review item.

## The hook's checks, in order (each a `#@rule` tag; every one has a refusal row + a mutant)

`allow-malformed`, `workflow-repo`, `workflow-unlisted`, `event-path`, `payload-control-char`,
`payload-missing`, `event-agree`, `event-kind`, `payload-repo`, `env-repo`, `sender`, `env-actor`,
`sha-format`, `push-ref`, `env-ref`, `push-after`, `head-repo`, `pr-author`, `head-sha-format`,
`base-ref`, `identity`, `merge-head`, `protected`; plus the untagged `scrub_env` step, which
`--mutants` also mutates (its call deleted). Not tagged: "cannot list changed files" (unreachable once `merge-head`
passed with a depth-2 fetch; kept as fail-closed) and the fetch/mirror failures (stage 3).

Rules reused, not re-invented: `G_TRUSTED` / `G_PROTECTED` in the hook mirror `TRUSTED_AUTHORS` /
`PROTECTED_PREFIXES` in `scripts/ci/route-runner.mjs` (read only, unchanged); the first rows of
`test-gate-hooks.sh` fail if they ever disagree. The hook cannot import the `.mjs` (it must not
run code from the job's checkout, and node is not guaranteed before the job's setup-node).
Protected paths are now checked ON THE RUNNER too: the hook diffs the PR merge commit against its
first parent (base) in its own mirror -- no API token needed.

## Task 2 result (`env-shadow-result`)

**Not testable without a registered runner.** Whether a workflow's job-level `env:` can shadow
`GITHUB_ACTOR` / `GITHUB_EVENT_NAME` / `GITHUB_REPOSITORY` inside the job-started hook cannot be
reproduced in a shell; GitHub's docs say `GITHUB_*` defaults cannot be overwritten, but that is
not proven here for hooks. What IS proven (shell tests, rows `event-path`, `sender`,
`event-agree`, `pr-author`, `head-repo`, `merge-head`, `push-after`): the decision no longer
depends on those env values being honest.

- Event, sender, repository, PR author, PR head repo and head sha are read by
  `read_event_payload` from the runner's own `event.json` at the PINNED path
  `$WORK_DIR/_temp/_github_workflow/event.json` (from `gate.conf`, never env). A
  `GITHUB_EVENT_PATH` naming any other file is refused, not followed.
- Env values that also exist must AGREE with the payload (narrowing only): a trusted-looking env
  with an untrusted payload sender or author is refused.
- `GITHUB_WORKFLOW_SHA` is tied to the payload: for a push it must be the payload's `after`; for a
  PR it must be a merge commit whose second parent is the payload's head sha.

Residual (needs the live check from stage 3, owner step 4 below): `GITHUB_WORKFLOW_REF` (which
workflow file is running) exists only in env; if it could be shadowed, a PR's own workflow could
claim to be `bom-check.yml`. Also `pull_request` and `pull_request_target` payloads have the same
shape; a `pull_request_target` run is refused by `event-agree` (env `GITHUB_EVENT_NAME` is
`pull_request_target`, which never equals the payload kind `pull_request`), before any git work. Were
the env name shadowed to `pull_request`, `merge-head` would still refuse it: its workflow sha is a
base commit, not a merge commit. Every routed workflow must keep `pull_request`, never
`pull_request_target` (check-secrets-register already flags the latter).

## Fix round 3 (ticket dt_85ef609034b6; brief `brief/ci-offload-wave0-fix3` v2, the Dell measurement of f53f5c2d1)

Measured by the arc lead on the real Dell (bash 5.3.9, git 2.53.0, python 3.14.4, uutils
env/timeout/sort/stat): `FAIL 147 of 240`; every accept row had an EMPTY verdict. Cause: the
posix-mode prologue ran `unset ... BASHOPTS ...`; BASHOPTS/SHELLOPTS are readonly, and bash 5.3
in posix mode treats a failed unset of a readonly name as fatal, so the hook ended silently.
The review reports under `C:/tmp/review/` were NOT reachable from this cloud worker.

| item | change | test rows / mutants |
|---|---|---|
| 1 `readonly_unset_guard` | both hooks: every VARIABLE unset goes through `g_unset_vars`, which unsets each name first in a subshell `( unset -v "$G_N" ) 2>/dev/null && unset -v "$G_N"` (a fatal or non-fatal failure ends only the subshell). BASHOPTS removed from both lists (SHELLOPTS, BASH_VERSINFO, EUID, PPID, UID were never listed); the env -i re-exec already drops them from the environment. `unset -f` (functions) is unchanged: an env-imported function is never readonly. | section 7: static (no variable `unset` outside `g_unset_vars`; no readonly name -- the bash's own `readonly -p` list plus the six above -- ever handed to unset; the probe line present) per hook; **fatal-unset emulation**: a copy of each hook with `set -e` over its posix-mode prologue (the bash 5.3 behaviour: any failed unset ends the script), run as `bash` AND `bash --posix` with `BASHOPTS`, `SHELLOPTS` and `POSIXLY_CORRECT=1` exported by the caller: legitimate bom-check run ok, altered workflow IDENTITY-refused, mallory sender refused, completed hook exit 0 + checkout removed; `g_unset_vars` alone under `bash --posix -e` with a readonly name survives. RED on f53f5c2d1: 20 rows, incl. the accept rows with an empty verdict (the Dell symptom reproduced). Mutants `readonly_unset_guard`, `readonly_unset_guard_completed` (probe removed), `readonly_unset_guard_name`, `readonly_unset_guard_name_completed` (BASHOPTS back in a bare unset). |
| 2 `baseline_green_gate` | `--mutants` first runs the UNMUTATED suite with `FAST=1`; red -> prints `FAIL baseline red` + its first FAIL lines and exits 1 before any mutant. A mutant counts as caught only when a FAIL line (not the tally) names it: the `#@rule` tag for rule mutants, a stated reason for named mutants (`env_i_reexec*` -> `env-channel`, `scrub_completed`, `mutant_z_diff` -> `protected-nonascii`, `mutant_symlink_file`/`_dir` -> `symlink-event-json: file`/`dir`, `mutant_allow_regex` -> `allow-malformed`, the four new ones -> `readonly_unset_guard`). Any other red = `FAIL mutant X: suite red, but no FAIL line names ...`. | `--mutants` |
| 3 `uutils` audit | no option change was needed: every external command already used only options GNU coreutils and uutils both accept (table below). | section 8: per hook, a row per GNU-only / differing option that must NOT appear (`timeout -k/-s/--`, `env -S/-u/--`, `sort`, `sort -V`, `stat`, `readlink`, `realpath`, `date -d/--`, `head -c`, `tail -n +`, `mktemp --/-t`, `install`, `cut --`, `touch -d`, `seq -`), plus the exact forms used, run with the local tools; an `info toolchain:` line records bash/env/timeout versions |

External commands in the two hooks, with every option they use (after `env -i`, PATH=/usr/sbin:/usr/bin:/sbin:/bin):

| command | options used | GNU / uutils |
|---|---|---|
| `env` (`/usr/bin/env`) | `-i NAME=VALUE ... /bin/bash -p FILE --gate-reexec ARGS` | POSIX `-i`; both |
| `timeout` | `timeout N cmd` (N = 10, 30, 60; no `-k`, `-s`, `--foreground`) | both |
| `mktemp` | `-d DIR/_gate-mirror.XXXXXX` | both |
| `date` | `+%s` | both (`%s` is not POSIX, but both implement it) |
| `cut` | `-d' ' -f1` | POSIX; both |
| `seq` | `seq 1 20` | both |
| `sleep` | `0.1`, `1`, `10` (fractional) | both |
| `rm` / `mv` / `mkdir` / `cat` / `kill` | `-f`, `-rf` / `-f` / `-p` / none / `-0`, plain | POSIX; both |
| `sort`, `stat`, `head`, `tail`, `readlink`, `install` | not used | - |
| `printf`, `read`, `compgen`, `unset`, `export`, `flock`-fd redirections | bash builtins | - |
| `awk` | `-v`, programs only | GNU gawk on the Dell |
| `grep` | `-E` | GNU on the Dell |
| `find` | `-mindepth 1 -maxdepth 1 ! -name X -exec rm -rf {} +`, `-mmin +60` | GNU findutils on the Dell (not POSIX-only; GNU there) |
| `setsid` / `flock` | `-w` / `-n` | util-linux |
| `git` | `--version`, `init -q --bare`, `-c k=v -C DIR fetch -q --no-tags --depth=2`, `rev-parse -q --verify`, `diff -z --name-only --no-renames` | git 2.32+ (checked) |
| `python3` | `-I -c` | any python 3 |

The test file itself (not the hooks) uses `touch -d '2 hours ago'`, `pkill -P`, `xargs`, `sed -E`;
if the Dell's uutils `touch` ever rejects that date form, only that one cleanup row changes.

### Verified / Not verified -- fix round 3 (this sandbox: Linux, GNU bash 5.2.21, GNU coreutils 9.4, git 2.43.0, root)

Verified:
- `bash docs/ci-offload/acer-web/test-gate-hooks.sh` -> **PASS 313 cases** (was 240); the same
  suite run as `POSIXLY_CORRECT=1 bash ...` -> PASS 313, and as `bash --posix ...` -> PASS 313.
  `FAST=1` -> PASS 302 (the baseline `--mutants` now runs first).
- Red first: the new suite (`FAST=1`) against the f53f5c2d1 hooks -> 20 FAIL rows, all
  `readonly_unset_guard`. The fatal-unset copies of the old hooks ended silently with an EMPTY
  verdict on the legitimate bom-check run, which is the Dell symptom.
- `--mutants` (one full run, 36 mutants): `ok baseline green: PASS 302 cases`. 34 were caught by a
  FAIL line naming their rule, including all 4 new `readonly_unset_guard*` mutants and all 24
  `#@rule` mutants. The other 2, `env_i_reexec` and `scrub_completed`, made the suite red, but the
  FAIL line came from `ps4-stops-at-reexec`, not from the reason first stated (`env-channel` /
  `scrub_completed`). As root, bash ignores an inherited PS4 and the second-layer scrub removes
  exported functions, so that row is the one that catches a missing re-exec here. Their stated
  reason is now `reexec`. Both mutants were re-run alone with `FAST=1` after that change: each
  is red with a FAIL line naming `reexec`. A full `--mutants` re-run after the change was NOT
  done (about 40 min here): expected `PASS all 36`, for the Dell run to confirm.
- `npx vitest run tests/routeRunner.test.ts` -> 96 passed. `check-secrets-register` OK (41
  workflows, 0 self-hosted); `lint-workflow-masking`, `check-workflow-log-secrets`,
  `lint-workflow-notification` exit 0; `check:mojibake` clean; `npx tsc --noEmit -p .` exit 0
  (no TS file touched). No `src/**`, `supabase/**`, `.github/workflows/**` or `route-runner.mjs`
  change; the `bom-check` required-check name is unchanged.

Not verified (fix round 3):
- **This sandbox is GNU bash 5.2.21 + GNU coreutils 9.4, not bash 5.3 + uutils.** Bash 5.2 does
  NOT treat a failed readonly unset as fatal in posix mode, so the bash 5.3 behaviour is only
  EMULATED here (`set -e` over the prologue). The uutils rows are static greps, plus the forms the
  hooks use run with GNU tools. Building bash 5.3 here failed: the ftp.gnu.org / GitHub source
  downloads were refused by the proxy (403).
- NOTHING ran on the Acer or the Dell. The arc lead re-runs the suite and `--mutants` on the Dell
  and records the totals; this worker claims no Dell numbers.
- GitHub PR checks for this push were not read back before this worker stopped.
- The review reports under `C:/tmp/review/` were unreachable.

## Fix round 2 (ticket dt_38826cd4e624; brief `brief/ci-offload-wave0-fix2` v2, blob 350b9a28, second review of 1b6ac93c2: SAFE WITH FIXES)

The review reports (`C:/tmp/review/pr1470-fix1.md`, `C:/tmp/review/pr1470.md`) were NOT reachable
from this cloud worker; the work follows the brief's quotes of them.

| item | change | test rows / mutants |
|---|---|---|
| 1 env channels | `env_i_reexec`: the hook's first lines re-execute it as `/usr/bin/env -i PATH=/usr/sbin:/usr/bin:/sbin:/bin HOME=/nonexistent/ghrunner-gate XDG_CONFIG_HOME=(same) LC_ALL=C <the 16 values it reads, by name> /bin/bash -p "$0" --gate-reexec "$@"`. Drops `BASH_FUNC_*`, `SHELLOPTS`, `BASHOPTS`, `PS4`, `LD_PRELOAD`, `LD_LIBRARY_PATH`, every proxy / TLS variable. `POSIXLY_CORRECT=1` (a plain assignment) first, so the special builtin `exec` beats an exported function named `exec` (reproduced: without it `BASH_FUNC_exec%%` hijacks the exec). Second layer `unset_bash_func` (all functions unset, the listed names unset, HOME re-pinned). Same in `gate-job-completed.sh` (`scrub_completed`). | `env-channel <NAME>` accept + IDENTITY-refuse for each of 17 channels (`BASH_FUNC_git%%`, `BASH_FUNC_rm%%`, `BASH_FUNC_timeout%%`, SHELLOPTS, PS4, BASHOPTS, LD_PRELOAD, LD_LIBRARY_PATH, https_proxy, HTTPS_PROXY, ALL_PROXY, SSL_CERT_FILE, SSL_CERT_DIR, CURL_CA_BUNDLE, OPENSSL_CONF, HOME, XDG_CONFIG_HOME); `timeout+git` and `timeout+python3` function pairs (RED on 1b6ac93c2: the old hook said `identity ok` for an altered workflow and for a mallory payload); `GATE_REEXEC=1` cannot skip; `ps4-stops-at-reexec` started + completed (xtrace from env: nothing traced after the exec line); `scrub_completed` (exported find/rm never run, checkout still removed). Mutants `env_i_reexec`, `env_i_reexec+scrub_env`, `env_i_reexec+unset_bash_func`, `scrub_completed` |
| 2 old git | `#@rule old-git`: refuse below git 2.32 (parsed from `git --version`; conf-only `TEST_GIT_VERSION` stands in for tests); HOME / XDG_CONFIG_HOME nonexistent (`old_git_home`) | `old-git` 2.31.1 / 1.99.9 / garbage refused, 2.32.0 / 3.0.1 accepted; `env-channel HOME` with an insteadOf `.gitconfig` |
| 3 shebang | `#!/bin/bash -p` in both hooks | - |
| 4 mutants | named mutants beside the `#@rule` ones: `mutant_z_diff` (plain `--name-only`), `mutant_symlink_file`, `mutant_symlink_dir`, `mutant_allow_regex` (regex -> `.`) | `--mutants` |
| 5 unit | comment: AF_NETLINK NOT added (need unproven); FIRST thing to try if the runner or git fails to start; ProcSubset stays out; NoNewPrivileges / ProtectSystem=strict kept | not testable here |
| 6 checklist | git 2.32+ row with the check command; `/bin/bash` + `/usr/bin/env` row; direct HTTPS (hook ignores proxies and TLS env) with an `env -i git ls-remote` check | - |

Deviations, on purpose:
- Re-exec marker is an ARGUMENT (`--gate-reexec`), not `GATE_REEXEC` in env as the brief sketched:
  an env value is exactly the channel being closed, so `GATE_REEXEC=1` in the env would skip the
  re-exec (row `env-channel GATE_REEXEC=1 + forging git`).
- `scrub_env` and `unset_bash_func` alone are now redundant behind the re-exec, so their mutants
  are run TOGETHER with the re-exec mutant (each alone would survive by design).

Residual (stated): when the runner starts the hook as `bash <file>` the shebang's `-p` is not
used, so LD_PRELOAD (loaded into that first bash) and SHELLOPTS/PS4 act on the lines ABOVE the
exec (PS4 from env is honoured for the non-root runner user; bash ignores it as root, as in the
cloud sandbox). Everything after the exec, including every git, python3 and rm, runs clean. A
failed exec (no `/usr/bin/env`) exits non-zero: fail closed (the completed hook then exits non-zero
too, its only non-0 path). The hook ignores proxies: the box needs direct HTTPS to github.com.

If the runner service or the hook's git fails after install: try `AF_NETLINK` in
`RestrictAddressFamilies` first (unit comment), never ProcSubset; keep NoNewPrivileges and
ProtectSystem=strict.

### Verified / Not verified -- fix round 2 (this sandbox: Linux, git 2.43.0, GNU bash 5.2.21, python3, running as root)

Verified:
- `bash docs/ci-offload/acer-web/test-gate-hooks.sh` -> **PASS 240 cases** (was 144).
- `bash docs/ci-offload/acer-web/test-gate-hooks.sh --mutants` -> **31 of 32 caught in the full run** (24 `#@rule` mutants incl. the new `old-git`, plus `env_i_reexec`, `env_i_reexec+scrub_env`, `env_i_reexec+unset_bash_func`, `scrub_completed`, `mutant_z_diff`, `mutant_symlink_file`, `mutant_symlink_dir`). The 32nd, `mutant_allow_regex`, reported "no change made": its FIND began with `^`, which the mutate helper reads as exact-line mode. The FIND was fixed after the run, and the identical mutant (`[[ "$line" =~ ^. ]]`) run alone with `FAST=1 HOOK_STARTED=<mutant>` is caught (`allow-malformed: bare file name`). A full `--mutants` re-run after that fix was NOT done (about 40 min here): expected PASS all 32, for the Dell run to confirm.
- Red first: the new suite (FAST=1) against the 1b6ac93c2 hooks -> FAIL 19 of 229 (holder rows skipped): the
  `timeout+git` / `timeout+python3` forge rows, `ps4-stops-at-reexec` x2, `scrub_completed` (an
  exported `find` ran and the checkout was NOT removed), every `old-git` row.
- `npx vitest run tests/routeRunner.test.ts` -> 96 passed. `check-secrets-register` OK (41
  workflows, 0 self-hosted runners); `lint-workflow-masking`, `check-workflow-log-secrets`,
  `lint-workflow-notification` exit 0; `check:mojibake` clean.
- No `src/**`, `supabase/**`, `.github/workflows/**` or `route-runner.mjs` change; `bom-check`
  required-check name unchanged.
- tsc run on 7a072c0: 0 errors in branch files (`npx tsc --noEmit -p .` exit 0; no TS file touched).
- PR #1470 (same PR, continued); body updated with the fix round 2 rows.

Not verified (fix round 2):
- GitHub PR checks for the final push: not read back before this worker stopped (see the PR checks tab).
- NOTHING ran on the Acer or the Dell: the arc owner runs the suite and `--mutants` there and records
  the numbers; Approve waits for that. In particular the PS4-from-env case as a NON-root user was
  not run here (root sandbox; bash drops an inherited PS4 for root).
- How the live runner starts the hook (`bash <file>` vs executing it) is not observed; the
  re-exec works either way, only the shebang `-p` differs.
- systemd did not load the unit (no systemd here); AF_NETLINK need unproven.
- The review reports under `C:/tmp/review/` (unreachable).

## Fix round 1 (ticket dt_1d521ee39f9f; brief `brief/ci-offload-wave0-fix1` v2, review of 4bf0762fb)

The review report itself (`C:/tmp/review/pr1470.md`) was NOT reachable from this cloud worker; the
work follows the brief's quotes of it.

| item | change | test rows |
|---|---|---|
| 1 MUST | changed files read with `git diff -z --name-only --no-renames` + `read -r -d ''`; a C-quoted non-ASCII / control-char name used to match no prefix (proved: the old hook said `identity ok` for all three rows) | `protected-nonascii` x3 (`scripts/ci/<e-acute>.mjs`, `.github/workflows/<e-acute>.yml`, tab in a `scripts/lib/` name) |
| 2 MUST | `scrub_env` first: `PATH=/usr/sbin:/usr/bin:/sbin:/bin`, `LC_ALL=C`, every `GIT_*` unset, `BASH_ENV`/`ENV`/`LD_PRELOAD`/`LD_LIBRARY_PATH`/`PYTHONPATH`/`PYTHONHOME` unset, then `GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null GIT_TERMINAL_PROMPT=0 GIT_NO_REPLACE_OBJECTS=1`; git also runs with `core.hooksPath=/dev/null`, `protocol.allow=never` + `protocol.https.allow=always` | `git-env-pollution` (GIT_DIR/OBJECT_DIRECTORY/EXEC_PATH/REPLACE_REF_BASE set: still ok; GIT_CONFIG_COUNT/KEY_0/VALUE_0 insteadOf to an evil origin whose main has the altered workflow: still IDENTITY-refused), `path-pollution` (a forging `python3` first on PATH); mutant `scrub_env` |
| 3 | rows per protected prefix, payload control chars, symlinked event.json | `protected-each-prefix` x5, `payload-control-char` x2 (python exits 2 on any control char before printing; bash also refuses a repeated or unknown key), `symlink-event-json` (file, and the `_github_workflow` dir) |
| 4 | allow-list: trim the ends only; inner whitespace refuses | `allow-malformed: whitespace inside a name`, `allow-list: leading/trailing whitespace and CRLF trimmed` |
| 5 | `protocol.file.allow=always` only when `gate.conf` has `TEST_FILE_PROTOCOL=1` (conf, not env: `scrub_env` would drop any GIT_CONFIG_* and env must not widen). Production `gate.conf` never sets it | the whole suite (it needs it) |
| 6 | the mirror is a fresh `mktemp -d $WORK_DIR/_gate-mirror.XXXXXX` per run (removed on exit and by step 1's cleanup); after `git init` its `config` is replaced by a fixed 3-line one and `hooks/`, `refs/replace` deleted; ONE shallow fetch (`--depth=2`, main + the workflow sha), fallback fetch by the event ref (charset-checked) only if fetch-by-sha fails. `gate.conf` key `MIRROR` is gone | every accept row |
| 7 | `GATE_WAIT_S` digits only (else 180), cap 1800 | `gate-wait-injection` (`x[$(touch ...)]` used to RUN in the old hook) |
| 8 | PR payload `pull_request.base.ref` must be `main` (`MAIN_REF` without `refs/heads/`) | `base-ref` |
| 9 | wording on `pull_request_target` (above) | - |
| 10 | unit: `IPAddressDeny` adds `0.0.0.0/8 192.0.0.0/24 198.18.0.0/15 224.0.0.0/4 ff00::/8`; `RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6`, `ProtectProc=invisible`, `LockPersonality=yes`, `RestrictNamespaces=yes`; `NoNewPrivileges`/`ProtectSystem=strict` kept. **`ProcSubset=pid` NOT set** (deviation, on purpose): it hides `/proc/loadavg` and `/proc/meminfo`, which the hook's load gate reads, so every job would wait out `GATE_WAIT_S` and run hosted | not testable here (no systemd) |

Also fixed: test row `workflows.allow in the repo` failed on every checkout (the repo checks the
file out CRLF via `.gitattributes`; the row now strips CR like the hook does). That made the
plain suite exit 1, so `tests/routeRunner.test.ts` "test-gate-hooks.sh passes" could not pass on
4bf0762fb either.

**Trust boundary (stated, as the review asked):** a routed job runs as `ghrunner-web` and CAN READ
the runner's credential files (`.runner`, `.credentials`, `.credentials_rsaparams`), and
`_work/_cache`, `_work/_tool` and `_work/_actions` persist across jobs (a job can plant content
there for the next one). That is acceptable ONLY because the hook admits nothing but trusted
authors' same-repo PRs into main / pushes to main of allow-listed workflows byte-identical to
main's, never touching a protected path. Do not widen the trust list or allow-list without
re-reading this.

Install note: the unit, `gate.conf` and checklist are CRLF in a checkout; install with
`tr -d '\r'` (provision-checklist.md says so). A CRLF `gate.conf` fails closed (every job refused).

## Memory (task 4; admin files not touched)

Joining admin's memory gate, proposal for the owner/lead:
1. Own lane label: this runner keeps its own label (`acer-web` / `dell-web`); admin's runners and
   this one never share a label, so admin's routing never hands this runner an admin job.
2. One job at a time: a self-hosted runner runs one job; plus the shared walk lock
   (`/var/lib/laptop-walk/walk.lock`) the hook already takes, so a Website job never overlaps the
   laptop walk / admin jobs that take the same lock, and the load + `MemAvailable >= 1500 MiB`
   gate (same values as admin's `laptop-safe.mjs`).
3. `MemoryMax=4G` stays until the owner reads the Acer's RAM (`free -m`) AND wave 1 measures the
   routed job's peak (`systemctl show -p MemoryPeak` after a run); raise only then, leaving at
   least `SAFE_MEM_MIN` + the admin runners' caps free.
4. If admin's DESIGN-memory-slot-gate adds a slot file, the hook's step 2 is where this runner
   would take a slot; not built here (no design text was reachable).

## Owner steps after merge (ask for the token ONLY after this PR has merged)

1. Provision as root: `docs/ci-offload/acer-web/provision-checklist.md` sections 1-4 (incl. the
   resolver check).
2. Install: hooks + `workflows.allow` + `gate.conf` (keys above) root-owned; the unit file;
   `systemctl daemon-reload`.
3. Register the runner: GitHub -> repo Settings -> Actions -> Runners -> New self-hosted runner
   gives a registration token valid about **1 hour**; run `config.sh --url ... --token <it>
   --labels acer-web --disableupdate --unattended` as `ghrunner-web` within that hour; never paste
   the token anywhere else. Then `systemctl enable --now`.
4. Live env-shadow check (stage 3 open item): a scratch workflow (NOT allow-listed) with job
   `env: GITHUB_ACTOR: x, GITHUB_EVENT_NAME: push, GITHUB_WORKFLOW_REF: ...` on `runs-on: acer-web`
   must show "refused" in the hook log; record what the hook saw.
5. Set `WEB_RUNNER_LABEL=acer-web` only after 1-4.

## Verified / Not verified -- fix round 1 (this sandbox: Linux, git 2.43.0, python3, util-linux flock/setsid, /proc)

Verified:
- `bash docs/ci-offload/acer-web/test-gate-hooks.sh` -> **PASS 144 cases** (was 103 of 104: the CRLF row).
- `bash docs/ci-offload/acer-web/test-gate-hooks.sh --mutants` -> **PASS all 24 mutants caught**
  (23 `#@rule` tags + `scrub_env`).
- Red first: the new suite against the OLD hook (4bf0762fb, with a `MIRROR=` conf line so it can
  run) -> FAIL 32 of 144; every new row red, incl. real bypasses: `protected-nonascii` x3,
  `payload-control-char` x2, `path-pollution`, `git-env-pollution` insteadOf, `base-ref`,
  `symlink-event-json` (dir), `gate-wait-injection` (the command ran).
- `npx vitest run tests/routeRunner.test.ts` -> 96 passed.
- No `src/**`, `supabase/**`, `.github/workflows/**` or `scripts/ci/route-runner.mjs` change;
  `bom-check` required-check name unchanged.

Not verified (fix round 1):
- NOTHING ran on the Acer or the Dell: the lead runs the same script there (remote-test) before the
  owner's Approve. Unit hardening not loaded by systemd (`systemd-analyze verify` not run; no systemd
  here); `RestrictAddressFamilies` / `RestrictNamespaces` effect on a real routed job unproven.
- The review report file `C:/tmp/review/pr1470.md` (unreachable from the cloud).

## Verified / Not verified -- wave 0 (4bf0762fb; superseded counts above)

Verified (this sandbox, Linux, git 2.x, python3):
- `bash docs/ci-offload/acer-web/test-gate-hooks.sh` -> PASS 104 cases at that commit (current: PASS 313).
- `bash docs/ci-offload/acer-web/test-gate-hooks.sh --mutants` -> PASS all 21 mutants caught at that commit (current: PASS all 36).
- `npx vitest run tests/routeRunner.test.ts` -> 96 passed (incl. the shell-test + IDENTITY-mutant cases).
- No `.github/workflows/**`, `src/**`, `supabase/**`, `vite.config.ts` or `route-runner.mjs` change;
  the `bom-check` required-check name is unchanged (workflow untouched).

- tsc run on a850696: 0 errors in branch files (no TS file touched).
- `npm run lint` chain exit 0; `check-secrets-register`, `lint-workflow-masking`, `check:mojibake` clean.

Not verified:
- GitHub PR checks: not read back by this worker before stopping (see the PR checks tab).
- NOTHING ran on a real runner, the Acer or the Dell. The unit was not loaded by systemd
  (`systemd-analyze verify` not run here). The real `event.json` path and shape on a live runner
  (`_temp/_github_workflow/event.json`) are from runner behaviour, not observed here.
- Task 2 env shadowing (above). The `--mutants` mode is not in CI (about 75 s); vitest runs the
  plain suite plus the IDENTITY mutant.
- The lead's plans-folder documents (unreachable); findings A-O not cross-checked.

## Unit file matches the live Acer (2026-11-08, ticket dt_a5439a904b8f, branch `claude/ci-offload-unitfix`)

Brief: `brief/ci-offload-unitfix:docs/briefs/ci-offload-unitfix.md`. Nothing installed or run on any machine.

- Unit: `ExecStart=/srv/ghrunner-web/runner/bin/runsvc.sh` (run.sh copies run-helper.sh into the
  runner dir, read-only under `ProtectSystem=strict`) and `RestrictSUIDSGID=no` (tar fails with ENOSYS
  under it on Ubuntu 26.04, proven by bisect). Owner-approved 2026-11-08; this is what the Acer's
  drop-in `override.conf` already sets. `NoNewPrivileges=yes` and `ProtectSystem=strict` stay.
  Once the repo unit is installed, the drop-in is redundant but harmless.
- `provision-acer-web.sh`: unit sha256 (CRLF-stripped) now
  `e383f73831473b0ad9c7efbd9ef303aa87c638198b7d373ddc679bf00f231af4`. Hooks, `workflows.allow` and
  `test-gate-hooks.sh` are unchanged, and so are their sums.
- **COMMIT pin NOT bumped** (a PR cannot contain its own merge sha). Next step: a one-line PR setting
  `COMMIT=` to this PR's merge commit. Do NOT re-run `provision-acer-web.sh` before that bump: at the old
  pin, step 2's checksum STOPS it (fails safe, but cannot provision).
- `provision-checklist.md` section 7: repo secret `WEB_RUNNER_READ_TOKEN` (fine-grained PAT, this repo,
  Administration: Read-only, 90-day expiry) + repo variable `WEB_RUNNER_LABEL=acer-web`.

Verified (this sandbox, Linux, GNU bash/coreutils): `test-gate-hooks.sh` PASS 313 cases;
`--mutants` `ok baseline green: PASS 302 cases` then `PASS all 36 mutants caught`, exit 0 (including
`env_i_reexec` and `scrub_completed`, caught by `ps4-stops-at-reexec`); `bash -n` on the script; the
script's sums block passes `sha256sum -c` on all 5 committed files (CRLF-stripped).

Not verified: nothing ran on the Acer or the Dell; `systemd-analyze verify` not run (no systemd here);
bash 5.3 + uutils not available here.
