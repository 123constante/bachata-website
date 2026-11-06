#!/usr/bin/env bash
# ACTIONS_RUNNER_HOOK_JOB_STARTED for a Website side-machine runner (acer-web, dell-web).
# Installed ROOT-OWNED, read-only to the service user (see the unit). It NEVER fails the
# job: it always exits 0 and writes a verdict line the job's first step reads
# (scripts/ci/route-runner.mjs gate):  "<run_id> <attempt> <job> ok|refused <why>".
# refused / missing / stale verdict => the job skips its work, exits 0, and the required
# hosted job re-runs the check (owner rule 2026-11-06: a busy machine never reds a PR).
#
# 1. Load gate: load1 <= SAFE_LOAD_MAX and MemAvailable >= SAFE_MEM_MIN MiB.
# 2. Walk lock: flock on $WALK_LOCK (default /var/lib/laptop-walk/walk.lock, a setgid
#    group-writable dir, NOT sticky /tmp where fs.protected_regular blocks a second user
#    from opening the file). laptop-safe.mjs and the walk tooling MUST use the same path.
# Waits up to GATE_WAIT_S (default 180 s; the routed job's timeout-minutes covers it).
STATE_DIR=${WEB_RUNNER_STATE_DIR:-/srv/ghrunner-web/state}
VERDICT=${WEB_RUNNER_GATE_FILE:-$STATE_DIR/gate-verdict}
HOLDER_PID_FILE=$STATE_DIR/lock-holder.pid
WALK_LOCK=${WALK_LOCK:-/var/lib/laptop-walk/walk.lock}
GATE_WAIT_S=${GATE_WAIT_S:-180}
ID="${GITHUB_RUN_ID:-?} ${GITHUB_RUN_ATTEMPT:-?} ${GITHUB_JOB:-?}"

verdict() { printf '%s %s\n' "$ID" "$*" > "$VERDICT.tmp" 2>/dev/null && mv -f "$VERDICT.tmp" "$VERDICT" 2>/dev/null; echo "side-machine gate: $*"; }
starttime() { awk '{print $22}' "/proc/$1/stat" 2>/dev/null; }

rm -f "$VERDICT" 2>/dev/null
# A holder left by an earlier job (completed hook did not run): release it, but only if
# that PID is still the process we started (same start time), never a reused PID.
if [ -s "$HOLDER_PID_FILE" ]; then
  read -r opid ostart < "$HOLDER_PID_FILE"
  [ -n "${opid:-}" ] && [ "$(starttime "$opid")" = "${ostart:-x}" ] && kill "$opid" 2>/dev/null
fi
rm -f "$HOLDER_PID_FILE"

deadline=$(( $(date +%s) + GATE_WAIT_S ))
while :; do
  load1=$(cut -d' ' -f1 /proc/loadavg)
  memavail=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)
  if awk -v l="$load1" -v m="${SAFE_LOAD_MAX:-3.0}" 'BEGIN{exit !(l<=m)}' \
     && [ "${memavail:-0}" -ge "${SAFE_MEM_MIN:-1500}" ]; then
    # Detached holder (own session, no inherited fds): it is the ONLY writer of the pid file,
    # and writes it only after flock succeeded. "pid starttime" guards against PID reuse.
    setsid bash -c '
      exec 9>>"$1" || exit 1
      flock -n 9 || exit 1
      printf "%s %s\n" "$$" "$(awk "{print \$22}" /proc/$$/stat)" > "$2.tmp" && mv -f "$2.tmp" "$2"
      exec sleep 7200' _ "$WALK_LOCK" "$HOLDER_PID_FILE" </dev/null >/dev/null 2>&1 &
    for _ in 1 2 3 4 5 6 7 8 9 10; do [ -s "$HOLDER_PID_FILE" ] && break; sleep 0.2; done
    if [ -s "$HOLDER_PID_FILE" ]; then
      read -r hpid hstart < "$HOLDER_PID_FILE"
      if [ "$(starttime "$hpid")" = "$hstart" ]; then
        verdict "ok load1=$load1 memavail=${memavail}MiB lock=$WALK_LOCK"
        exit 0
      fi
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
