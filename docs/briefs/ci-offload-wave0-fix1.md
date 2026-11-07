# Brief: CI offload wave 0, fix round 1 (independent review of Website #1470 at 4bf0762fb: SAFE WITH FIXES)

Brief-version: 2
Branch: claude/ci-offload-wave0 (Website), the SAME branch and PR #1470: continue it, do not open a new one. Lane: careful, hard tier. Model: Opus. Push once, `[skip preview]`, no `src/`, no `.github/workflows/**`.
Read first: the review report (the lead pastes or points to it: `C:/tmp/review/pr1470.md`), and the PR's own `docs/handover/ci-offload-wave0.md`. Nothing runs on the Acer or Dell from this branch; never create or print a token.
Owner rules: the Dell/Acer helps but MUST NOT crash, hang or red a PR; repo is PUBLIC (the hook is the only access control).

## What main lacks
- the hook's protected-path rule safe against git path C-quoting: a PR touching `scripts/ci/é.mjs` or `.github/workflows/é.yml` must be refused -- grep: protected-nonascii
- the hook running git, python and coreutils with a fixed PATH and every GIT_ variable unset -- grep: scrub_env
- a test that sets GIT_DIR and GIT_CONFIG_COUNT/KEY_0/VALUE_0 in the job env and still gets the correct verdict -- grep: git-env-pollution
- one test row per protected prefix (`.github/`, `scripts/ci/`, `scripts/lib/`, `package.json`, `package-lock.json`) -- grep: protected-each-prefix
- a test and a guard for control characters (newline) inside event payload values -- grep: payload-control-char
- a test for the symlinked event.json refusal -- grep: symlink-event-json

## Files
docs/ci-offload/acer-web/gate-job-started.sh
docs/ci-offload/acer-web/test-gate-hooks.sh
docs/ci-offload/acer-web/workflows.allow (new)
docs/ci-offload/acer-web/provision-checklist.md (new)
docs/handover/ci-offload-wave0.md (new)
docs/ci-offload/acer-web/actions.runner.bachata-website.acer-web.service

## MUST-FIX (quote of the review; red test first, then the fix)
1. gate-job-started.sh around lines 187-193: the `protected` rule is bypassed by file name. `git diff --name-only` C-quotes non-ASCII or control-character paths (`.github/workflows/é.yml` prints as `".github/workflows/\303\251.yml"`), so `case "$f" in "$p"*)` does not match and a PR passes as touching no protected path. Fix: `git diff -z --name-only --no-renames` read with `read -r -d ''`. Add the table row `protected-nonascii`: a PR touching `scripts/ci/é.mjs` is refused. scripts/ci/route-runner.mjs does not have this flaw (API returns raw paths); keep the list-agreement test.
2. The hook runs every external command (git, python3, timeout, awk, find, rm) with the inherited environment and an unset PATH. Anything reaching the hook env (GIT_DIR, GIT_CONFIG_COUNT/KEY_0/VALUE_0 insteadOf, GIT_EXEC_PATH, GIT_OBJECT_DIRECTORY, GIT_REPLACE_REF_BASE, GIT_ALTERNATE_OBJECT_DIRECTORIES, PATH) can redirect or forge the mirror fetch and the blob/diff answers. Fix: a `scrub_env` step at the top: `export PATH=/usr/sbin:/usr/bin:/sbin:/bin`, unset every `GIT_*` variable (or run git through `env -i` with PATH, HOME=<state dir>, GIT_CONFIG_NOSYSTEM=1, GIT_CONFIG_GLOBAL=/dev/null). Add the row `git-env-pollution`: the job env sets GIT_DIR and GIT_CONFIG_* and the verdict is still correct, plus a mutant (remove `scrub_env`, a test must fail).

## Also fix (review nits, same PR; the lead wants them before waves 1-3)
3. Test rows: `protected-each-prefix` (one row per protected entry, not only `scripts/ci/`); `payload-control-char` (a newline inside a payload value must be rejected inside python, never inject a fake `P_SENDER=` line); `symlink-event-json`; a row for the allow-list parser whitespace case.
4. Allow-list parser: line 87 strips all whitespace, so `bom check.yml` is accepted as `bomcheck.yml` while the handover says spaces inside refuse. Refuse lines with inner whitespace (fail closed) and make the doc match.
5. `-c protocol.file.allow=always` is for tests only: pass it from a test-only env, not in production git calls.
6. `mirror.git` lives in a job-writable state dir: rebuild it in a fresh mktemp dir under `_work` each run (one shallow fetch), and delete `config` and `refs/replace` before use.
7. `GATE_WAIT_S` comes from env into `$(( ))`: apply the same digits-only guard as `HOLDER_MAX_S`.
8. PR base branch: require the payload's `pull_request.base.ref` equals main, or state the intent in the handover.
9. Doc nits: handover says `pull_request_target` is refused by `merge-head`; in code it is refused earlier by `event-agree`. Fix the wording.
10. Service unit hardening (cheap): IPAddressDeny also 0.0.0.0/8, 192.0.0.0/24, 198.18.0.0/15, 224.0.0.0/4, ff00::/8; add RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6, ProtectProc=invisible, ProcSubset=pid, LockPersonality=yes, RestrictNamespaces=yes. Keep NoNewPrivileges and ProtectSystem=strict. State in the handover that the job can read the runner credential files and that `_cache`, `_tool`, `_actions` persist across jobs: acceptable for trusted authors only.

## Do not touch
src/**, supabase/**, any `.github/workflows/**` file, the rules in scripts/ci/route-runner.mjs (read only), the admin repo and runners, Vercel settings.

## Verification (all before DONE)
- Run `docs/ci-offload/acer-web/test-gate-hooks.sh` and its `--mutants` mode in YOUR Linux sandbox and paste the real totals (the reviewer could not run them on Windows: no flock, setsid or /proc). If a case cannot run in your sandbox, say which and why; do not claim a count you did not see.
- After your push the LEAD runs the same script on the Dell/Acer through the normal side-host route (remote-test) and records the result; the owner Approve waits for it.
- bom-check required-check name unchanged; check-secrets-register and workflow-lint green; per-job CI table in the PR body; Verified / Not verified block.

## Stop and handover
Push once; `[worker-done <ticket>]` on the last commit; update `docs/handover/ci-offload-wave0.md` (what changed, totals, what is not verified). At 40% context stop with PARTIAL and a what-is-left list.
