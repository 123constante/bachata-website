#!/usr/bin/env bash
# ACTIONS_RUNNER_HOOK_JOB_STARTED for a Website side-machine runner (acer-web, dell-web).
# Installed ROOT-OWNED, read-only to the service user (see the unit). Verdict line for the
# job's first step (scripts/ci/route-runner.mjs gate):  "<run_id> <attempt> <job> ok|refused <why>".
#
# 0. Identity (fix round 2 item 1). A PR runs ITS OWN copy of the workflow, so a PR could drop
#    the route job and hard-code `runs-on: acer-web`. This hook refuses (EXIT 1: the job fails
#    before any step, the required hosted job runs the check) unless ALL hold:
#      - event is pull_request, or push to the main ref;
#      - GITHUB_ACTOR and GITHUB_TRIGGERING_ACTOR are on the trust list;
#      - GITHUB_WORKFLOW_REF names this repo's allowed workflow file;
#      - that file at GITHUB_WORKFLOW_SHA is byte-identical (same git blob hash) to the file on
#        the remote main ref, both fetched fresh into a local mirror.
#    These settings come ONLY from built-in defaults and the root-owned config file
#    (/etc/ghrunner-web/gate.conf, or `--conf FILE` for tests); never from the environment,
#    which a job could influence.
# 1. Workspace cleanup (item 8): previous jobs' checkouts and stale _temp entries.
# 2. Load gate: load1 <= SAFE_LOAD_MAX and MemAvailable >= SAFE_MEM_MIN MiB.
# 3. Walk lock: flock on $WALK_LOCK (default /var/lib/laptop-walk/walk.lock). The holder
#    (item 9) exits when the runner process dies or after HOLDER_MAX_S (cap 1800 s); if it
#    cannot write its pid file it releases the lock and the hook exits 1 (hosted fallback).
# Busy (load/lock) => "refused" + exit 0: a busy machine is not an error, the hosted job runs it.
# Waits up to GATE_WAIT_S (default 180 s; the routed job's timeout-minutes covers it).
set -u
CONF=/etc/ghrunner-web/gate.conf
[ "${1:-}" = "--conf" ] && [ -n "${2:-}" ] && CONF=$2

# Every PATH this hook writes or deletes comes from defaults + the conf file, never env (review
# round 2: an env path would let a job's own env: aim rm/mv anywhere BEFORE identity is proven).
STATE_DIR=/srv/ghrunner-web/state
WORK_DIR=/srv/ghrunner-web/runner/_work
WALK_LOCK=/var/lib/laptop-walk/walk.lock
GATE_WAIT_S=${GATE_WAIT_S:-180}
HOLDER_MAX_S=${HOLDER_MAX_S:-1800}
case "$HOLDER_MAX_S" in ''|*[!0-9]*) HOLDER_MAX_S=1800 ;; esac
[ "$HOLDER_MAX_S" -gt 1800 ] && HOLDER_MAX_S=1800
ID="${GITHUB_RUN_ID:-?} ${GITHUB_RUN_ATTEMPT:-?} ${GITHUB_JOB:-?}"

verdict() { printf '%s %s\n' "$ID" "$*" > "$VERDICT.tmp" 2>/dev/null && mv -f "$VERDICT.tmp" "$VERDICT" 2>/dev/null; echo "side-machine gate: $*"; }
refuse() { verdict "refused $*; the required hosted job runs the check"; exit 1; }
starttime() { awk '{print $22}' "/proc/$1/stat" 2>/dev/null; }

# ---- 0. identity --------------------------------------------------------------------------
G_REPO=123constante/bachata-website
G_WORKFLOW=.github/workflows/bom-check.yml
G_TRUSTED="kiki-claude-bot 123constante"
G_REMOTE=https://github.com/123constante/bachata-website.git
G_MIRROR=/srv/ghrunner-web/state/mirror.git
G_MAIN_REF=refs/heads/main
if [ -r "$CONF" ]; then
  while IFS='=' read -r k v; do
    case "$k" in
      REPO) G_REPO=$v ;; WORKFLOW_PATH) G_WORKFLOW=$v ;; TRUSTED) G_TRUSTED=$v ;;
      REMOTE_URL) G_REMOTE=$v ;; MIRROR) G_MIRROR=$v ;; MAIN_REF) G_MAIN_REF=$v ;;
      STATE_DIR) STATE_DIR=$v ;; WORK_DIR) WORK_DIR=$v ;; WALK_LOCK) WALK_LOCK=$v ;;
    esac
  done < <(grep -E '^[A-Z_]+=' "$CONF")
fi
VERDICT=$STATE_DIR/gate-verdict
HOLDER_PID_FILE=$STATE_DIR/lock-holder.pid

rm -f "$VERDICT" 2>/dev/null
case "${GITHUB_EVENT_NAME:-}" in
  pull_request) ;;
  push) [ "${GITHUB_REF:-}" = "$G_MAIN_REF" ] || refuse "push to ${GITHUB_REF:-?} (only $G_MAIN_REF)" ;;
  *) refuse "event ${GITHUB_EVENT_NAME:-?} is not push/pull_request" ;;
esac
[ "${GITHUB_REPOSITORY:-}" = "$G_REPO" ] || refuse "repo ${GITHUB_REPOSITORY:-?} is not $G_REPO"
for who in "${GITHUB_ACTOR:-}" "${GITHUB_TRIGGERING_ACTOR:-${GITHUB_ACTOR:-}}"; do
  ok=; for t in $G_TRUSTED; do [ "${who,,}" = "${t,,}" ] && ok=1; done
  [ -n "$ok" ] || refuse "actor ${who:-?} is not on the trust list"
done
case "${GITHUB_WORKFLOW_REF:-}" in
  "$G_REPO/$G_WORKFLOW@"*) ;;
  *) refuse "workflow ${GITHUB_WORKFLOW_REF:-?} is not $G_REPO/$G_WORKFLOW" ;;
esac
WSHA=${GITHUB_WORKFLOW_SHA:-}
[[ "$WSHA" =~ ^[0-9a-f]{40}$ ]] || refuse "GITHUB_WORKFLOW_SHA ${WSHA:-unset} is not a commit sha"
mgit() { timeout 60 /usr/bin/env git -c protocol.file.allow=always -C "$G_MIRROR" "$@"; }
if [ ! -d "$G_MIRROR" ]; then
  timeout 30 /usr/bin/env git init -q --bare "$G_MIRROR" >/dev/null 2>&1 || refuse "cannot create mirror $G_MIRROR"
fi
mgit fetch -q --no-tags --depth=1 "$G_REMOTE" "+$G_MAIN_REF:refs/gate/main" >/dev/null 2>&1 || refuse "cannot fetch $G_MAIN_REF"
if ! mgit fetch -q --no-tags --depth=1 "$G_REMOTE" "+$WSHA:refs/gate/run" >/dev/null 2>&1; then
  mgit fetch -q --no-tags --depth=1 "$G_REMOTE" "+${GITHUB_REF:-none}:refs/gate/run" >/dev/null 2>&1 || refuse "cannot fetch workflow commit $WSHA"
fi
[ "$(mgit rev-parse -q --verify 'refs/gate/run^{commit}' 2>/dev/null)" = "$WSHA" ] || refuse "fetched commit is not $WSHA"
main_blob=$(mgit rev-parse -q --verify "refs/gate/main:$G_WORKFLOW" 2>/dev/null)
run_blob=$(mgit rev-parse -q --verify "refs/gate/run:$G_WORKFLOW" 2>/dev/null)
[ -n "$main_blob" ] || refuse "$G_WORKFLOW missing on $G_MAIN_REF"
[ "$run_blob" = "$main_blob" ] || refuse "IDENTITY: $G_WORKFLOW at $WSHA (${run_blob:-missing}) differs from $G_MAIN_REF ($main_blob)"
echo "side-machine gate: identity ok ($G_WORKFLOW blob $main_blob, actor ${GITHUB_ACTOR:-?})"

# ---- 1. workspace cleanup (moved here from the completed hook, item 8) ----------------------
# Keep _tool (setup-node cache, pinned actions only), _actions, _temp, _PipelineMapping and
# _work/<repo>: by the time this hook runs, "Set up job" has already created THIS job's
# workspace dir, mapping, actions and file-command files (review round 2). The previous job's
# checkout inside _work/<repo> is removed by gate-job-completed.sh.
# _temp entries older than 60 min belong to earlier jobs and go.
REPO_DIR=${G_REPO##*/}
if [ -d "$WORK_DIR" ]; then
  find "$WORK_DIR" -mindepth 1 -maxdepth 1 ! -name _tool ! -name _actions ! -name _temp ! -name _PipelineMapping ! -name "$REPO_DIR" -exec rm -rf {} + 2>/dev/null
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
