# Brief: CI offload wave 0, fix round 2 (second independent review of Website #1470 at 1b6ac93c2: SAFE WITH FIXES, no must-fix open)

Brief-version: 2
Branch: claude/ci-offload-wave0 (Website), the SAME branch and PR #1470: continue it, do not open a new one. Lane: careful, hard tier. Model: Opus. Push once, `[skip preview]`, no `src/`, no `.github/workflows/**`.
Read first: the second review `C:/tmp/review/pr1470-fix1.md` (the lead of this arc points to it) and the first review `C:/tmp/review/pr1470.md`; the PR's `docs/handover/ci-offload-wave0.md`.
State measured so far: on the Dell (Linux) at 1b6ac93c2 the suite gives PASS 144 cases and all 24 mutants caught. Keep both green and extend them. Nothing runs on the Acer or Dell from this branch; never create or print a token.
Owner rules: the Dell/Acer helps but MUST NOT crash, hang or red a PR; the repo is PUBLIC and the hook is the only access control; fail closed.

## What main lacks
- the hook re-executing itself under `env -i` with a fixed PATH and HOME so shell-level channels cannot reach it -- grep: env_i_reexec
- unsetting or ignoring exported shell functions and loader/proxy/TLS variables that survive `unset GIT_*` (BASH_FUNC_*, SHELLOPTS, PS4, BASHOPTS, LD_PRELOAD, LD_LIBRARY_PATH, https_proxy, HTTPS_PROXY, ALL_PROXY, SSL_CERT_FILE, SSL_CERT_DIR, CURL_CA_BUNDLE, OPENSSL_CONF) -- grep: unset_bash_func
- a git-version and HOME/XDG guard so an older git cannot read the previous job's gitconfig -- grep: old_git_home
- the same scrub in the job-completed hook -- grep: scrub_completed
- mutants for the `-z` diff, the event.json symlink checks and the allow-list regex -- grep: mutant_z_diff

## Files
docs/ci-offload/acer-web/gate-job-started.sh
docs/ci-offload/acer-web/gate-job-completed.sh
docs/ci-offload/acer-web/test-gate-hooks.sh
docs/ci-offload/acer-web/provision-checklist.md (new)
docs/handover/ci-offload-wave0.md (new)
docs/ci-offload/acer-web/actions.runner.bachata-website.acer-web.service

## Fix, in this order (red test first, each with a row asserting the reason text and a mutant)
1. Residual env channels (reproduced by the reviewer): exported functions (`BASH_FUNC_git%%`, `BASH_FUNC_rm%%`) override git and rm; SHELLOPTS and PS4 and LD_PRELOAD act before the script starts; https_proxy, SSL_CERT_FILE, CURL_CA_BUNDLE and OPENSSL_CONF survive and can forge the https fetch. Fix: a first-lines guard `if [ -z "${GATE_REEXEC:-}" ]; then exec env -i PATH=/usr/sbin:/usr/bin:/sbin:/bin HOME=<state dir> GATE_REEXEC=1 /bin/bash "$0" "$@"; fi` (name the guard `env_i_reexec`; keep the values the hook legitimately needs, passed explicitly, and the runner's own variables it reads such as GITHUB_EVENT_PATH). Do the same for `gate-job-completed.sh` (`scrub_completed`). Also unset the names listed above as a second layer (`unset_bash_func`). Test rows: each listed variable set in the environment still gives the correct verdict (accept for a legitimate bom-check run, refuse for a bad one); a mutant removing the re-exec must fail the suite.
2. Old git: `GIT_CONFIG_GLOBAL` needs git 2.32 or newer. Add a version check line to the checklist and to the hook (refuse with a clear reason below 2.32), and set HOME and XDG_CONFIG_HOME to a nonexistent or empty state directory (`old_git_home`). Row: a fake old git version string is refused.
3. Shebang: use an absolute `#!/bin/bash` (not `env bash`) in both hooks so PATH cannot choose the interpreter.
4. Mutants: add automatic mutants for the `-z` diff (replace with plain `--name-only`), the event.json symlink checks, and the allow-list regex; each must make the suite fail. Name them in the `--mutants` list (`mutant_z_diff` and siblings).
5. Service unit: reviewer notes `AF_NETLINK` is not in RestrictAddressFamilies (unproven need); document in the handover that if the runner or git fails to start, `AF_NETLINK` is the first thing to try, and keep ProcSubset out (it would hide /proc/loadavg). Keep NoNewPrivileges and ProtectSystem=strict.
6. Handover and checklist: record the new totals you see in YOUR Linux sandbox (paste real numbers; say what could not run).

## Do not touch
src/**, supabase/**, any `.github/workflows/**` file, scripts/ci/route-runner.mjs rules (read only), the admin repo and runners, Vercel settings.

## Verification (all before DONE)
- test-gate-hooks.sh and `--mutants` in your Linux sandbox with the real totals; state any case you could not run. After your push the owner of the arc runs the same on the Dell and records the numbers; the owner Approve waits for it.
- bom-check required-check name unchanged; check-secrets-register and workflow-lint green; per-job CI table in the PR body; Verified / Not verified block.

## Stop and handover
Push once; `[worker-done <ticket>]` on the last commit; update `docs/handover/ci-offload-wave0.md`. At 40% context stop with PARTIAL and a what-is-left list.
