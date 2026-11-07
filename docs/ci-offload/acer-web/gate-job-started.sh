#!/bin/bash -p
# env_i_reexec (fix round 2, item 1): FIRST, before anything else runs, re-execute under
# `env -i` with a fixed PATH, a nonexistent HOME/XDG_CONFIG_HOME (old_git_home) and ONLY the
# values this hook reads, passed by name. That drops exported shell functions
# (BASH_FUNC_git%%, BASH_FUNC_rm%%), SHELLOPTS/BASHOPTS/PS4, LD_PRELOAD/LD_LIBRARY_PATH, every
# proxy and TLS variable (https_proxy, HTTPS_PROXY, ALL_PROXY, SSL_CERT_FILE, SSL_CERT_DIR,
# CURL_CA_BUNDLE, OPENSSL_CONF) and anything else a job env could plant.
#  - The marker is an ARGUMENT (--gate-reexec), not an env value: an env GATE_REEXEC=1 must not be
#    able to skip the re-exec (deviation from the brief's `[ -z "$GATE_REEXEC" ]`, on purpose).
#  - POSIXLY_CORRECT=1 is a plain assignment (no command an exported function can shadow); it
#    turns on posix mode, where the special builtin `exec` is found BEFORE any function named exec.
#    `[[ ]]` and `for` are keywords; env and bash are absolute paths.
#  - If the runner starts the hook as `bash <file>`, the shebang (and its `-p`) is not used; `-p`
#    matters only when the file is executed directly (not observed on a live runner). Residual: with SHELLOPTS=xtrace in the env, PS4 is still
#    expanded for the few lines above the exec (row ps4-stops-at-reexec proves it stops there).
POSIXLY_CORRECT=1
if [[ "${1:-}" != --gate-reexec ]]; then
  G_PASS=()
  for G_V in GITHUB_RUN_ID GITHUB_RUN_ATTEMPT GITHUB_JOB GITHUB_WORKFLOW_REF GITHUB_WORKFLOW_SHA \
      GITHUB_EVENT_PATH GITHUB_EVENT_NAME GITHUB_REPOSITORY GITHUB_ACTOR GITHUB_TRIGGERING_ACTOR GITHUB_REF \
      GATE_WAIT_S HOLDER_MAX_S SAFE_LOAD_MAX SAFE_MEM_MIN WEB_RUNNER_WATCH_PID; do
    [[ -n "${!G_V+x}" ]] && G_PASS+=("$G_V=${!G_V}")
  done
  exec /usr/bin/env -i PATH=/usr/sbin:/usr/bin:/sbin:/bin HOME=/nonexistent/ghrunner-gate XDG_CONFIG_HOME=/nonexistent/ghrunner-gate LC_ALL=C "${G_PASS[@]}" /bin/bash -p "$0" --gate-reexec "$@"
fi
shift
# readonly_unset_guard (fix round 3): every VARIABLE unset in both hooks goes through g_unset_vars.
# BASHOPTS, SHELLOPTS, BASH_VERSINFO, EUID, PPID and UID are READONLY in bash; in posix mode
# (POSIXLY_CORRECT=1, set above) bash 5.3 makes a failed `unset` of a readonly name FATAL for a
# non-interactive shell, so the hook ended silently before writing any verdict (measured on the
# Dell: bash 5.3.9, every accept row red). So: no readonly name is ever listed (the env -i re-exec
# already drops SHELLOPTS/BASHOPTS from the environment), and each name is first unset in a
# SUBSHELL -- if that fails, fatally or not, only the subshell ends -- and only then in this shell.
# Rows readonly_unset_guard in test-gate-hooks.sh (fatal-unset emulation under `set -e`).
g_unset_vars() {
  for G_N in "$@"; do
    ( unset -v "$G_N" ) 2>/dev/null && unset -v "$G_N"
  done
  unset -v G_N
}
g_unset_vars G_PASS G_V
# unset_bash_func (second layer, for the case the re-exec ever did not happen): no function
# survives from the environment, and none of the loader / proxy / TLS / shell-option names stays.
# Still in posix mode here: `unset`/`export` are special builtins, found before any function; no
# `local` (a regular builtin a function could shadow); compgen's own shadow is removed first.
unset_bash_func() {
  unset -f compgen declare builtin command local unset 2>/dev/null
  for G_F in $(compgen -A function); do case "$G_F" in unset_bash_func|g_unset_vars) ;; *) unset -f "$G_F" ;; esac; done
  g_unset_vars BASH_ENV ENV PS4 CDPATH GLOBIGNORE LD_PRELOAD LD_LIBRARY_PATH LD_AUDIT \
    https_proxy HTTPS_PROXY http_proxy HTTP_PROXY ALL_PROXY all_proxy no_proxy NO_PROXY \
    SSL_CERT_FILE SSL_CERT_DIR CURL_CA_BUNDLE CURL_HOME OPENSSL_CONF OPENSSL_MODULES GATE_REEXEC
  export HOME=/nonexistent/ghrunner-gate XDG_CONFIG_HOME=/nonexistent/ghrunner-gate
  g_unset_vars G_F
}
unset_bash_func
g_unset_vars POSIXLY_CORRECT
# ACTIONS_RUNNER_HOOK_JOB_STARTED for a Website side-machine runner (acer-web, dell-web).
# Installed ROOT-OWNED, read-only to the service user (see the unit). Verdict line for the
# job's first step (scripts/ci/route-runner.mjs gate):  "<run_id> <attempt> <job> ok|refused <why>".
#
# 0. Identity (stage 3 fix round 2 item 1; wave 0: allow-list + event payload). A PR runs ITS
#    OWN copy of the workflow, so a PR could drop the route job and hard-code `runs-on: acer-web`.
#    This hook refuses (EXIT 1: the job fails before any step, the required hosted job runs the
#    check) unless ALL hold:
#      - the workflow (GITHUB_WORKFLOW_REF) is listed in workflows.allow (root-owned; missing
#        file = bom-check.yml only; any malformed line = refuse everything);
#      - that file at GITHUB_WORKFLOW_SHA is byte-identical (same git blob hash) to the file on
#        the remote main ref, both fetched fresh into a local mirror;
#      - the EVENT PAYLOAD (read_event_payload: the runner's own event.json at the pinned path
#        $WORK_DIR/_temp/_github_workflow/event.json, never a path or value from env) says:
#        repository = this repo; sender on the trust list; and EITHER a push of the main ref
#        whose `after` is GITHUB_WORKFLOW_SHA, OR a pull_request whose head repo is this repo,
#        whose author is on the trust list, whose merge commit (GITHUB_WORKFLOW_SHA) has the
#        payload head sha as its second parent, and whose diff against the base parent touches
#        no PROTECTED prefix;
#      - the env values that also exist (GITHUB_EVENT_NAME, GITHUB_REPOSITORY, GITHUB_ACTOR,
#        GITHUB_TRIGGERING_ACTOR, GITHUB_EVENT_PATH) AGREE with the above. Env can only narrow,
#        never widen (env-shadow-result in docs/handover/ci-offload-wave0.md).
#    TRUSTED / PROTECTED mirror TRUSTED_AUTHORS / PROTECTED_PREFIXES in scripts/ci/route-runner.mjs
#    (test-gate-hooks.sh fails if they disagree). Settings come ONLY from built-in defaults and the
#    root-owned config file (/etc/ghrunner-web/gate.conf, or `--conf FILE` for tests).
# 1. Workspace cleanup (item 8): previous jobs' checkouts and stale _temp entries; a fresh,
#    empty $WORK_DIR/_home (the job's HOME, see the unit); $WORK_DIR/_cache is kept.
# 2. Load gate: load1 <= SAFE_LOAD_MAX and MemAvailable >= SAFE_MEM_MIN MiB.
# 3. Walk lock: flock on $WALK_LOCK (default /var/lib/laptop-walk/walk.lock). The holder
#    (item 9) exits when the runner process dies or after HOLDER_MAX_S (cap 1800 s); if it
#    cannot write its pid file it releases the lock and the hook exits 1 (hosted fallback).
# Busy (load/lock) => "refused" + exit 0: a busy machine is not an error, the hosted job runs it.
# Waits up to GATE_WAIT_S (default 180 s; the routed job's timeout-minutes covers it).
set -u
# scrub_env (fix round 1, item 2): every external command (git, python3, timeout, awk, find, rm,
# setsid, flock) runs with a FIXED PATH and no GIT_* variable from the inherited environment, so
# nothing that reaches the hook's env (GIT_DIR, GIT_CONFIG_COUNT/KEY_n/VALUE_n insteadOf,
# GIT_EXEC_PATH, GIT_OBJECT_DIRECTORY, GIT_ALTERNATE_OBJECT_DIRECTORIES, GIT_REPLACE_REF_BASE, a
# planted PATH) can redirect the mirror fetch or forge the blob/diff answers. git reads no system
# or global config; replace refs are ignored. Row git-env-pollution in test-gate-hooks.sh.
scrub_env() {
  local v
  export PATH=/usr/sbin:/usr/bin:/sbin:/bin LC_ALL=C
  for v in $(compgen -e); do case "$v" in GIT_*) g_unset_vars "$v" ;; esac; done
  g_unset_vars BASH_ENV ENV LD_PRELOAD LD_LIBRARY_PATH PYTHONPATH PYTHONHOME
  export GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null GIT_TERMINAL_PROMPT=0 GIT_NO_REPLACE_OBJECTS=1
}
scrub_env
CONF=/etc/ghrunner-web/gate.conf
[ "${1:-}" = "--conf" ] && [ -n "${2:-}" ] && CONF=$2

# Every PATH this hook writes or deletes comes from defaults + the conf file, never env (review
# round 2: an env path would let a job's own env: aim rm/mv anywhere BEFORE identity is proven).
STATE_DIR=/srv/ghrunner-web/state
WORK_DIR=/srv/ghrunner-web/runner/_work
WALK_LOCK=/var/lib/laptop-walk/walk.lock
GATE_WAIT_S=${GATE_WAIT_S:-180}
# Digits only (item 7): a value from env reaches $(( )), where a[$(cmd)] would run cmd.
case "$GATE_WAIT_S" in ''|*[!0-9]*) GATE_WAIT_S=180 ;; esac
[ "$GATE_WAIT_S" -gt 1800 ] && GATE_WAIT_S=1800
HOLDER_MAX_S=${HOLDER_MAX_S:-1800}
case "$HOLDER_MAX_S" in ''|*[!0-9]*) HOLDER_MAX_S=1800 ;; esac
[ "$HOLDER_MAX_S" -gt 1800 ] && HOLDER_MAX_S=1800
ID="${GITHUB_RUN_ID:-?} ${GITHUB_RUN_ATTEMPT:-?} ${GITHUB_JOB:-?}"

verdict() { printf '%s %s\n' "$ID" "$*" > "$VERDICT.tmp" 2>/dev/null && mv -f "$VERDICT.tmp" "$VERDICT" 2>/dev/null; echo "side-machine gate: $*"; }
refuse() { verdict "refused $*; the required hosted job runs the check"; exit 1; }
starttime() { awk '{print $22}' "/proc/$1/stat" 2>/dev/null; }

# ---- 0. identity --------------------------------------------------------------------------
G_REPO=123constante/bachata-website
# Mirrors of scripts/ci/route-runner.mjs TRUSTED_AUTHORS / PROTECTED_PREFIXES (space-separated).
G_TRUSTED="kiki-claude-bot 123constante"
G_PROTECTED=".github/ scripts/ci/ scripts/lib/ package.json package-lock.json"
G_ALLOW_FILE=/etc/ghrunner-web/workflows.allow
G_REMOTE=https://github.com/123constante/bachata-website.git
G_MAIN_REF=refs/heads/main
# TEST_FILE_PROTOCOL=1 (conf only, never env; test-gate-hooks.sh sets it): lets git fetch from the
# test's local file:// remote. Production gate.conf never sets it (item 5).
G_TEST_FILE_PROTOCOL=
# TEST_GIT_VERSION (conf only; tests): stands in for `git --version` output (row old-git).
G_TEST_GIT_VERSION=
if [ -r "$CONF" ]; then
  while IFS='=' read -r k v; do
    case "$k" in
      REPO) G_REPO=$v ;; TRUSTED) G_TRUSTED=$v ;; PROTECTED) G_PROTECTED=$v ;; ALLOW_FILE) G_ALLOW_FILE=$v ;;
      REMOTE_URL) G_REMOTE=$v ;; MAIN_REF) G_MAIN_REF=$v ;; TEST_FILE_PROTOCOL) G_TEST_FILE_PROTOCOL=$v ;;
      STATE_DIR) STATE_DIR=$v ;; WORK_DIR) WORK_DIR=$v ;; WALK_LOCK) WALK_LOCK=$v ;;
      TEST_GIT_VERSION) G_TEST_GIT_VERSION=$v ;;
    esac
  done < <(grep -E '^[A-Z_]+=' "$CONF")
fi
VERDICT=$STATE_DIR/gate-verdict
HOLDER_PID_FILE=$STATE_DIR/lock-holder.pid
# The runner writes the payload here at "Set up job", before this hook runs. Pinned, not env.
EVENT_FILE=$WORK_DIR/_temp/_github_workflow/event.json
rm -f "$VERDICT" 2>/dev/null

# old_git_home (fix round 2, item 2): GIT_CONFIG_GLOBAL=/dev/null is honoured only by git 2.32+.
# An older git would read $HOME/.gitconfig -- HOME is a nonexistent dir after the re-exec (the unit's
# HOME is _work/_home, which the PREVIOUS job could write) -- and still fail closed here.
G_GITV=${G_TEST_GIT_VERSION:-$(timeout 10 git --version 2>/dev/null)}
G_GITV=${G_GITV#git version }
G_GITMAJ=${G_GITV%%.*}; G_GITMIN=${G_GITV#*.}; G_GITMIN=${G_GITMIN%%.*}
if ! [[ "$G_GITMAJ" =~ ^[0-9]+$ && "$G_GITMIN" =~ ^[0-9]+$ ]] || [ "$G_GITMAJ" -lt 2 ] || { [ "$G_GITMAJ" = 2 ] && [ "$G_GITMIN" -lt 32 ]; }; then
  refuse "git ${G_GITV:-missing} is older than 2.32 (GIT_CONFIG_GLOBAL unsupported); upgrade git" #@rule old-git
fi

trusted() { local t; for t in $G_TRUSTED; do [ "${1,,}" = "${t,,}" ] && return 0; done; return 1; }

# Allow-list: one `.github/workflows/<name>.yml|yaml` per line; blank lines and `#` comments ok.
# Leading/trailing whitespace is trimmed; whitespace INSIDE a name refuses everything (item 4).
read_allow_list() {
  ALLOWED=
  if [ ! -e "$G_ALLOW_FILE" ]; then ALLOWED=.github/workflows/bom-check.yml; return 0; fi
  [ -r "$G_ALLOW_FILE" ] || return 1
  local line
  while IFS= read -r line || [ -n "$line" ]; do
    line=${line%$'\r'}; line=${line%%#*}
    line=${line#"${line%%[![:space:]]*}"}; line=${line%"${line##*[![:space:]]}"}
    [ -z "$line" ] && continue
    [[ "$line" =~ ^\.github/workflows/[A-Za-z0-9._-]+\.ya?ml$ ]] || return 1
    case "$line" in *..*) return 1 ;; esac
    ALLOWED="$ALLOWED $line"
  done < "$G_ALLOW_FILE"
  [ -n "$ALLOWED" ]
}

# Event payload -> P_KIND (push|pull_request|other) P_REPO P_SENDER P_REF P_AFTER P_AUTHOR
# P_HEAD_REPO P_HEAD_SHA P_BASE_REF. Every value is checked against a strict charset before it is
# used. Return 2 = a value holds a control character (a newline could forge a `P_SENDER=` line;
# python refuses it before printing anything: row payload-control-char). Neither the file nor its
# two parent dirs under _temp may be a symlink (row symlink-event-json).
read_event_payload() {
  local f=$1 out k v rc seen=" "
  [ -f "$f" ] && [ ! -L "$f" ] || return 1
  [ ! -L "$WORK_DIR/_temp" ] && [ ! -L "$WORK_DIR/_temp/_github_workflow" ] || return 1
  out=$(timeout 10 python3 -I -c '
import json, re, sys
try:
    d = json.load(open(sys.argv[1], encoding="utf-8"))
except Exception:
    sys.exit(1)
if not isinstance(d, dict):
    sys.exit(1)
def g(*path):
    x = d
    for p in path:
        x = x.get(p) if isinstance(x, dict) else None
    return x if isinstance(x, str) else ""
pr = d.get("pull_request")
if isinstance(pr, dict) and "number" in d:
    kind = "pull_request"
elif all(k in d for k in ("ref", "before", "after", "pusher")):
    kind = "push"
else:
    kind = "other"
for k, v in (("P_KIND", kind), ("P_REPO", g("repository", "full_name")), ("P_SENDER", g("sender", "login")),
             ("P_REF", g("ref")), ("P_AFTER", g("after")), ("P_AUTHOR", g("pull_request", "user", "login")),
             ("P_HEAD_REPO", g("pull_request", "head", "repo", "full_name")), ("P_HEAD_SHA", g("pull_request", "head", "sha")),
             ("P_BASE_REF", g("pull_request", "base", "ref"))):
    if re.search(r"[\x00-\x1f\x7f\u0080-\u009f\u2028\u2029]", v):
        sys.exit(2)
    if not re.fullmatch(r"[A-Za-z0-9._/@-]*", v):
        v = "?"
    print(k + "=" + v)
' "$f" 2>/dev/null); rc=$?
  [ "$rc" = 0 ] || { [ "$rc" = 2 ] && return 2; return 1; }
  P_KIND=; P_REPO=; P_SENDER=; P_REF=; P_AFTER=; P_AUTHOR=; P_HEAD_REPO=; P_HEAD_SHA=; P_BASE_REF=
  while IFS='=' read -r k v; do
    # Defence in depth: each key exactly once, known keys only.
    case "$seen" in *" $k "*) return 1 ;; esac; seen="$seen$k "
    [[ "$v" =~ ^[A-Za-z0-9._/@-]*$ ]] || v='?'
    case "$k" in
      P_KIND) P_KIND=$v ;; P_REPO) P_REPO=$v ;; P_SENDER) P_SENDER=$v ;; P_REF) P_REF=$v ;; P_AFTER) P_AFTER=$v ;;
      P_AUTHOR) P_AUTHOR=$v ;; P_HEAD_REPO) P_HEAD_REPO=$v ;; P_HEAD_SHA) P_HEAD_SHA=$v ;; P_BASE_REF) P_BASE_REF=$v ;;
      *) return 1 ;;
    esac
  done <<< "$out"
  [ -n "$P_KIND" ]
}

read_allow_list || refuse "workflows allow-list $G_ALLOW_FILE unreadable or malformed" #@rule allow-malformed
WREF=${GITHUB_WORKFLOW_REF:-}
case "$WREF" in "$G_REPO/"*@*) ;; *) refuse "workflow ref ${WREF:-?} is not in $G_REPO" ;; esac #@rule workflow-repo
WPATH=${WREF#"$G_REPO/"}; WPATH=${WPATH%%@*}
listed=; for a in $ALLOWED; do [ "$a" = "$WPATH" ] && listed=1; done
[ -n "$listed" ] || refuse "workflow ${WPATH:-?} is not in the allow-list" #@rule workflow-unlisted

# Env may only agree: a GITHUB_EVENT_PATH other than the pinned file is refused, never followed.
[ -z "${GITHUB_EVENT_PATH:-}" ] || [ "$GITHUB_EVENT_PATH" = "$EVENT_FILE" ] || refuse "GITHUB_EVENT_PATH ${GITHUB_EVENT_PATH} is not $EVENT_FILE" #@rule event-path
read_event_payload "$EVENT_FILE"; prc=$?
[ "$prc" != 2 ] || refuse "event payload $EVENT_FILE has a control character in a value" #@rule payload-control-char
[ "$prc" = 0 ] || refuse "event payload $EVENT_FILE missing or unreadable" #@rule payload-missing
[ "${GITHUB_EVENT_NAME:-}" = "$P_KIND" ] || refuse "event ${GITHUB_EVENT_NAME:-?} (payload: $P_KIND) is not push/pull_request" #@rule event-agree
case "$P_KIND" in
  pull_request|push) ;;
  *) refuse "payload event $P_KIND is not push/pull_request" ;; #@rule event-kind
esac
[ "$P_REPO" = "$G_REPO" ] || refuse "payload repo ${P_REPO:-?} is not $G_REPO" #@rule payload-repo
[ "${GITHUB_REPOSITORY:-}" = "$G_REPO" ] || refuse "repo ${GITHUB_REPOSITORY:-?} is not $G_REPO" #@rule env-repo
trusted "$P_SENDER" || refuse "payload sender ${P_SENDER:-?} is not on the trust list" #@rule sender
for who in "${GITHUB_ACTOR:-}" "${GITHUB_TRIGGERING_ACTOR:-${GITHUB_ACTOR:-}}"; do
  trusted "$who" || refuse "actor ${who:-?} is not on the trust list" #@rule env-actor
done
WSHA=${GITHUB_WORKFLOW_SHA:-}
[[ "$WSHA" =~ ^[0-9a-f]{40}$ ]] || refuse "GITHUB_WORKFLOW_SHA ${WSHA:-unset} is not a commit sha" #@rule sha-format
if [ "$P_KIND" = push ]; then
  [ "$P_REF" = "$G_MAIN_REF" ] || refuse "push to ${P_REF:-?} (only $G_MAIN_REF)" #@rule push-ref
  [ "${GITHUB_REF:-}" = "$G_MAIN_REF" ] || refuse "env ref ${GITHUB_REF:-?} disagrees with the payload ($P_REF)" #@rule env-ref
  [ "$P_AFTER" = "$WSHA" ] || refuse "push head ${P_AFTER:-?} is not the workflow commit $WSHA" #@rule push-after
else
  [ "$P_HEAD_REPO" = "$G_REPO" ] || refuse "PR head ${P_HEAD_REPO:-?} is not $G_REPO" #@rule head-repo
  trusted "$P_AUTHOR" || refuse "PR author ${P_AUTHOR:-?} not on the allowlist" #@rule pr-author
  [[ "$P_HEAD_SHA" =~ ^[0-9a-f]{40}$ ]] || refuse "payload head sha ${P_HEAD_SHA:-?} is not a commit sha" #@rule head-sha-format
  # Item 8: only PRs INTO main run here (the protected-path diff is against main's side).
  [ "refs/heads/$P_BASE_REF" = "$G_MAIN_REF" ] || refuse "PR base ${P_BASE_REF:-?} is not ${G_MAIN_REF#refs/heads/}" #@rule base-ref
fi

# Mirror (item 6): a FRESH bare repo per run in a mktemp dir under _work (removed on exit, and by
# step 1 below), never a dir an earlier job could have written. Its config is replaced by a fixed
# one and refs/replace + hooks are deleted before the one shallow fetch.
G_GITOPT=(-c core.hooksPath=/dev/null -c protocol.allow=never -c protocol.https.allow=always)
[ "$G_TEST_FILE_PROTOCOL" = 1 ] && G_GITOPT+=(-c protocol.file.allow=always)
G_MIRROR=$(mktemp -d "$WORK_DIR/_gate-mirror.XXXXXX" 2>/dev/null) || refuse "cannot create a mirror dir under $WORK_DIR"
trap 'rm -rf "$G_MIRROR"' EXIT
mgit() { timeout 60 git "${G_GITOPT[@]}" -C "$G_MIRROR" "$@"; }
timeout 30 git init -q --bare "$G_MIRROR" >/dev/null 2>&1 || refuse "cannot create mirror $G_MIRROR"
rm -rf "$G_MIRROR/config" "$G_MIRROR/hooks" "$G_MIRROR/refs/replace"
printf '[core]\n\trepositoryformatversion = 0\n\tbare = true\n' > "$G_MIRROR/config" || refuse "cannot write mirror config"
# depth 2: a PR merge commit's parents (base, head) are needed for the head and changed-files checks.
if ! mgit fetch -q --no-tags --depth=2 "$G_REMOTE" "+$G_MAIN_REF:refs/gate/main" "+$WSHA:refs/gate/run" >/dev/null 2>&1; then
  # A server that refuses fetch-by-sha: fetch the event ref instead (strict charset; the result
  # must still BE $WSHA, checked next).
  GREF=${GITHUB_REF:-none}; [[ "$GREF" =~ ^refs/[A-Za-z0-9._/-]+$ ]] || GREF=refs/none
  mgit fetch -q --no-tags --depth=2 "$G_REMOTE" "+$G_MAIN_REF:refs/gate/main" "+$GREF:refs/gate/run" >/dev/null 2>&1 || refuse "cannot fetch workflow commit $WSHA"
fi
mgit rev-parse -q --verify 'refs/gate/main^{commit}' >/dev/null 2>&1 || refuse "cannot fetch $G_MAIN_REF"
[ "$(mgit rev-parse -q --verify 'refs/gate/run^{commit}' 2>/dev/null)" = "$WSHA" ] || refuse "fetched commit is not $WSHA"
main_blob=$(mgit rev-parse -q --verify "refs/gate/main:$WPATH" 2>/dev/null)
run_blob=$(mgit rev-parse -q --verify "refs/gate/run:$WPATH" 2>/dev/null)
[ -n "$main_blob" ] || refuse "$WPATH missing on $G_MAIN_REF"
[ "$run_blob" = "$main_blob" ] || refuse "IDENTITY: $WPATH at $WSHA (${run_blob:-missing}) differs from $G_MAIN_REF ($main_blob)" #@rule identity
if [ "$P_KIND" = pull_request ]; then
  head2=$(mgit rev-parse -q --verify 'refs/gate/run^2' 2>/dev/null)
  [ "$head2" = "$P_HEAD_SHA" ] || refuse "workflow commit $WSHA is not the merge of PR head $P_HEAD_SHA (2nd parent ${head2:-none})" #@rule merge-head
  # -z (item 1): raw NUL-separated names. Without it git C-quotes a non-ASCII or control-char
  # path (".github/workflows/\303\251.yml" in quotes), which no prefix matches (row protected-nonascii).
  mgit diff -z --name-only --no-renames 'refs/gate/run^1' 'refs/gate/run' > "$G_MIRROR/changed" 2>/dev/null || refuse "cannot list the PR's changed files"
  while IFS= read -r -d '' f; do
    [ -z "$f" ] && continue
    for p in $G_PROTECTED; do
      case "$f" in "$p"*) refuse "PR touches $(printf '%q' "$f") (protected paths always run hosted)" ;; esac #@rule protected
    done
  done < "$G_MIRROR/changed"
fi
echo "side-machine gate: identity ok ($WPATH blob $main_blob, $P_KIND by ${P_SENDER:-?})"

# ---- 1. workspace cleanup (moved here from the completed hook, item 8) ----------------------
# Keep _tool (setup-node cache, pinned actions only), _actions, _temp, _PipelineMapping, _cache and
# _work/<repo>: by the time this hook runs, "Set up job" has already created THIS job's
# workspace dir, mapping, actions and file-command files (review round 2). The previous job's
# checkout inside _work/<repo> is removed by gate-job-completed.sh.
# _temp entries older than 60 min belong to earlier jobs and go.
REPO_DIR=${G_REPO##*/}
if [ -d "$WORK_DIR" ]; then
  find "$WORK_DIR" -mindepth 1 -maxdepth 1 ! -name _tool ! -name _actions ! -name _temp ! -name _PipelineMapping ! -name _cache ! -name "$REPO_DIR" -exec rm -rf {} + 2>/dev/null
  # _home was just removed with the rest: every job starts with an empty HOME (no planted .npmrc,
  # .gitconfig or shell rc from an earlier job). _cache (npm/XDG caches) is kept on purpose.
  mkdir -p "$WORK_DIR/_home" "$WORK_DIR/_cache" 2>/dev/null
  [ -d "$WORK_DIR/_temp" ] && find "$WORK_DIR/_temp" -mindepth 1 -maxdepth 1 -mmin +60 -exec rm -rf {} + 2>/dev/null
fi

# ---- 2/3. load gate + walk lock ------------------------------------------------------------
# A holder left by an earlier job (completed hook did not run): release it, but only if
# that PID is still the process we started (same start time), never a reused PID.
if [ -s "$HOLDER_PID_FILE" ]; then
  read -r opid ostart < "$HOLDER_PID_FILE"
  [ -n "${opid:-}" ] && [ "$(starttime "$opid")" = "${ostart:-x}" ] && kill "$opid" 2>/dev/null
fi
rm -f "$HOLDER_PID_FILE"

# The process the holder outlives no longer than: the nearest Runner.Worker ancestor (the job),
# else none (then only the HOLDER_MAX_S cap applies). WEB_RUNNER_WATCH_PID: tests only.
WATCH_PID=${WEB_RUNNER_WATCH_PID:-}
if [ -z "$WATCH_PID" ]; then
  p=$PPID
  for _ in 1 2 3 4 5 6 7 8; do
    [ -n "$p" ] && [ "$p" -gt 1 ] 2>/dev/null || break
    [ "$(cat "/proc/$p/comm" 2>/dev/null)" = "Runner.Worker" ] && { WATCH_PID=$p; break; }
    p=$(awk '{print $4}' "/proc/$p/stat" 2>/dev/null)
  done
fi
[ -n "$WATCH_PID" ] || echo "side-machine gate: no Runner.Worker ancestor found; holder capped at ${HOLDER_MAX_S}s only"

deadline=$(( $(date +%s) + GATE_WAIT_S ))
while :; do
  load1=$(cut -d' ' -f1 /proc/loadavg)
  memavail=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)
  if awk -v l="$load1" -v m="${SAFE_LOAD_MAX:-3.0}" 'BEGIN{exit !(l<=m)}' \
     && [ "${memavail:-0}" -ge "${SAFE_MEM_MIN:-1500}" ]; then
    # Detached holder (own session, no inherited fds): the ONLY writer of the pid file, written
    # only after flock succeeded. Exit 1 = lock busy; exit 3 = pid file unwritable (lock released).
    setsid -w bash -c '
      exec 9>>"$1" || exit 1
      flock -n 9 || exit 1
      { printf "%s %s\n" "$$" "$(awk "{print \$22}" /proc/$$/stat)" > "$2.tmp" && mv -f "$2.tmp" "$2"; } 2>/dev/null || exit 3
      st() { awk "{print \$22}" "/proc/$1/stat" 2>/dev/null; }
      wstart=; [ -n "$3" ] && wstart=$(st "$3")
      [ -n "$3" ] && [ -z "$wstart" ] && exit 4
      end=$(( $(date +%s) + $4 ))
      while [ "$(date +%s)" -lt "$end" ]; do
        [ -n "$3" ] && [ "$(st "$3")" != "$wstart" ] && break
        sleep 1 9>&-
      done
      read -r a _ < "$2" 2>/dev/null; [ "${a:-}" = "$$" ] && rm -f "$2"
      exit 0' _ "$WALK_LOCK" "$HOLDER_PID_FILE" "$WATCH_PID" "$HOLDER_MAX_S" </dev/null >/dev/null 2>&1 &
    hp=$!
    for _ in $(seq 1 20); do [ -s "$HOLDER_PID_FILE" ] && break; kill -0 "$hp" 2>/dev/null || break; sleep 0.1; done
    if [ -s "$HOLDER_PID_FILE" ]; then
      read -r hpid hstart < "$HOLDER_PID_FILE"
      if [ "$(starttime "$hpid")" = "$hstart" ]; then
        verdict "ok load1=$load1 memavail=${memavail}MiB lock=$WALK_LOCK"
        exit 0
      fi
    fi
    if ! kill -0 "$hp" 2>/dev/null; then
      wait "$hp"; rc=$?
      [ "$rc" = 3 ] && refuse "cannot write holder pid file $HOLDER_PID_FILE (lock released)"
      [ "$rc" = 4 ] && refuse "runner process $WATCH_PID already gone (lock released)"
    else
      kill "$hp" 2>/dev/null
    fi
    echo "side-machine gate: $WALK_LOCK held (walk running), waiting"
  else
    echo "side-machine gate: load1=$load1 (max ${SAFE_LOAD_MAX:-3.0}) memavail=${memavail}MiB (min ${SAFE_MEM_MIN:-1500}), waiting"
  fi
  if [ "$(date +%s)" -ge "$deadline" ]; then
    verdict "refused RUNNER BUSY for ${GATE_WAIT_S}s (load1=$load1 memavail=${memavail}MiB); re-run hosted"
    exit 0
  fi
  sleep 10
done
