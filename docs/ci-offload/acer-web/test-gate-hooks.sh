#!/usr/bin/env bash
# Shell test for gate-job-started.sh / gate-job-completed.sh (CI offload stage 3, fix round 2).
#   bash docs/ci-offload/acer-web/test-gate-hooks.sh            -> "PASS n cases", exit 0
#   HOOK_STARTED=/path/mutant.sh bash ...test-gate-hooks.sh     -> run against a hook mutant
# Needs git, flock, setsid (util-linux). Uses only a temp dir and a local file:// remote.
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
STARTED=${HOOK_STARTED:-$HERE/gate-job-started.sh}
COMPLETED=${HOOK_COMPLETED:-$HERE/gate-job-completed.sh}
T=$(mktemp -d); trap 'pkill -P $$ 2>/dev/null; [ -n "${W:-}" ] && kill "$W" 2>/dev/null; rm -rf "$T"' EXIT
fail=0; n=0
check() { n=$((n+1)); if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1: expected $3, got $2"; fail=$((fail+1)); fi; }
g() { git -c user.email=t@t -c user.name=t -c init.defaultBranch=main "$@"; }

# origin: main with the workflow; SAME = PR merge commit with an unrelated change; MUT = altered workflow
g init -q "$T/src"; mkdir -p "$T/src/.github/workflows"
printf 'name: BOM Check\njobs: {}\n' > "$T/src/.github/workflows/bom-check.yml"
g -C "$T/src" add -A; g -C "$T/src" commit -qm main
echo x > "$T/src/a.txt"; g -C "$T/src" add -A; g -C "$T/src" commit -qm same; SAME=$(g -C "$T/src" rev-parse HEAD)
g -C "$T/src" checkout -q -b mut HEAD~1
printf 'name: BOM Check\njobs: { evil: { runs-on: acer-web } }\n' > "$T/src/.github/workflows/bom-check.yml"
g -C "$T/src" add -A; g -C "$T/src" commit -qm mut; MUT=$(g -C "$T/src" rev-parse HEAD)
g -C "$T/src" checkout -q main
g clone -q --bare "$T/src" "$T/origin.git"; g -C "$T/origin.git" config uploadpack.allowAnySHA1InWant true
cat > "$T/gate.conf" <<EOF
REPO=o/r
WORKFLOW_PATH=.github/workflows/bom-check.yml
TRUSTED=kiki-claude-bot 123constante
REMOTE_URL=file://$T/origin.git
MIRROR=$T/mirror.git
MAIN_REF=refs/heads/main
EOF
sleep 600 & W=$!

reset() { rm -rf "$T/state" "$T/work"; mkdir -p "$T/state" "$T/work/_tool" "$T/work/_actions" "$T/work/_temp" "$T/work/r"; }
run() { # env overrides as args; prints exit code
  env -i PATH="$PATH" HOME="$T" GITHUB_RUN_ID=9 GITHUB_RUN_ATTEMPT=1 GITHUB_JOB=bom-check-routed \
    GITHUB_REPOSITORY=o/r GITHUB_EVENT_NAME=pull_request GITHUB_REF=refs/pull/1/merge \
    GITHUB_ACTOR=kiki-claude-bot GITHUB_TRIGGERING_ACTOR=kiki-claude-bot \
    GITHUB_WORKFLOW_REF="o/r/.github/workflows/bom-check.yml@refs/pull/1/merge" GITHUB_WORKFLOW_SHA="$SAME" \
    WEB_RUNNER_STATE_DIR="$T/state" WEB_RUNNER_WORK_DIR="$T/work" WALK_LOCK="$T/walk.lock" \
    SAFE_LOAD_MAX=999 SAFE_MEM_MIN=0 GATE_WAIT_S=0 WEB_RUNNER_WATCH_PID="$W" "$@" \
    bash "$STARTED" --conf "$T/gate.conf" >"$T/out" 2>&1; echo $?
}
word() { awk '{print $4}' "$T/state/gate-verdict" 2>/dev/null; }
lockfree() { ( flock -n 9 && echo free || echo held ) 9>>"$T/walk.lock"; }
done_hook() { env -i PATH="$PATH" GITHUB_REPOSITORY=o/r WEB_RUNNER_STATE_DIR="$T/state" WEB_RUNNER_WORK_DIR="$T/work" bash "$COMPLETED"; echo $?; }
waitfree() { for _ in $(seq 1 50); do [ "$(lockfree)" = free ] && break; sleep 0.1; done; lockfree; }

# 1. identical workflow -> ok, lock held; completed releases it and removes only the checkout
reset; touch -d '2 hours ago' "$T/work/_temp/old"; touch "$T/work/_temp/new"; mkdir "$T/work/stale-checkout"
check "identical workflow: exit 0" "$(run)" 0
check 'identical workflow: verdict ok' "$(word)" ok
check 'identical workflow: walk lock held' "$(lockfree)" held
check 'started cleanup: stale checkout removed' "$([ -e "$T/work/stale-checkout" ] && echo kept || echo gone)" gone
check 'started cleanup: old _temp entry removed' "$([ -e "$T/work/_temp/old" ] && echo kept || echo gone)" gone
check 'started cleanup: fresh _temp entry kept' "$([ -e "$T/work/_temp/new" ] && echo kept || echo gone)" kept
check 'started cleanup: _tool/_actions kept' "$([ -d "$T/work/_tool" ] && [ -d "$T/work/_actions" ] && echo kept)" kept
mkdir -p "$T/work/r/src"
check 'completed: exit 0' "$(done_hook)" 0
check 'completed: lock released' "$(waitfree)" free
check 'completed: checkout dir removed' "$([ -e "$T/work/r" ] && echo kept || echo gone)" gone
check 'completed: _temp/_actions/_tool kept' "$([ -d "$T/work/_temp" ] && [ -d "$T/work/_actions" ] && [ -d "$T/work/_tool" ] && echo kept)" kept

# 2. MUTANT: altered workflow blob must be refused
reset
check 'MUTANT altered workflow: refused (exit 1)' "$(run GITHUB_WORKFLOW_SHA="$MUT")" 1
check 'MUTANT altered workflow: verdict refused' "$(word)" refused
check 'MUTANT altered workflow: names IDENTITY' "$(grep -c IDENTITY "$T/out")" 1
check 'MUTANT altered workflow: lock never taken' "$(lockfree)" free
# 3-8. other identity refusals
reset; check 'untrusted actor: refused' "$(run GITHUB_ACTOR=mallory GITHUB_TRIGGERING_ACTOR=mallory)" 1
reset; check 'untrusted re-run actor: refused' "$(run GITHUB_TRIGGERING_ACTOR=mallory)" 1
reset; check 'other workflow file: refused' "$(run GITHUB_WORKFLOW_REF='o/r/.github/workflows/evil.yml@refs/pull/1/merge')" 1
reset; check 'other repo: refused' "$(run GITHUB_REPOSITORY=x/r)" 1
reset; check 'non-hex sha: refused' "$(run GITHUB_WORKFLOW_SHA='main')" 1
reset; check 'unknown sha: refused' "$(run GITHUB_WORKFLOW_SHA=0123456789abcdef0123456789abcdef01234567)" 1
reset; check 'push to a branch: refused' "$(run GITHUB_EVENT_NAME=push GITHUB_REF=refs/heads/x)" 1
reset; check 'pull_request_target: refused' "$(run GITHUB_EVENT_NAME=pull_request_target)" 1
reset; check 'env cannot widen the trust list' "$(run GITHUB_ACTOR=mallory GITHUB_TRIGGERING_ACTOR=mallory TRUSTED=mallory G_TRUSTED=mallory)" 1
reset; check 'push to main: ok' "$(run GITHUB_EVENT_NAME=push GITHUB_REF=refs/heads/main GITHUB_WORKFLOW_SHA="$(g -C "$T/src" rev-parse main)")" 0
done_hook >/dev/null; waitfree >/dev/null

# 9. holder exits when the watched (runner) process dies
reset; sleep 600 & W2=$!
check 'holder: ok' "$(run WEB_RUNNER_WATCH_PID=$W2)" 0
check 'holder: lock held while runner lives' "$(lockfree)" held
kill $W2; wait $W2 2>/dev/null
check 'holder: lock released when the runner dies' "$(sleep 1.5; waitfree)" free
# 10. holder cap
reset; check 'holder cap: ok' "$(run HOLDER_MAX_S=2)" 0
check 'holder cap: lock released after HOLDER_MAX_S' "$(sleep 3; waitfree)" free
# 11. pid file unwritable -> lock released, exit 1
reset; mkdir "$T/state/lock-holder.pid.tmp"
check 'pid file unwritable: exit 1' "$(run)" 1
check 'pid file unwritable: lock released' "$(waitfree)" free
# 12. walk lock busy -> refused BUSY, exit 0 (busy is not an error)
reset; exec 8>>"$T/walk.lock"; flock -n 8
check 'walk running: exit 0' "$(run)" 0
check 'walk running: verdict refused' "$(word)" refused
exec 8>&-

if [ "$fail" -gt 0 ]; then echo "FAIL $fail of $n"; exit 1; fi
echo "PASS $n cases"
