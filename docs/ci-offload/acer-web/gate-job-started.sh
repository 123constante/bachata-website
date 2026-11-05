#!/usr/bin/env bash
# Runs before EVERY job on the acer-web runner (ACTIONS_RUNNER_HOOK_JOB_STARTED).
# 1. Load gate: same thresholds as the Acer's walk/test gate (SAFE_LOAD_MAX,
#    SAFE_MEM_MIN in MiB available). 2. Shared lock /tmp/laptop-walk.lock, so a
#    CI job and a walk never run together. Waits up to GATE_WAIT_S, then exits 1:
#    the job goes RED (visible) instead of running on a busy machine.
# ASSUMPTION to verify on the Acer: walks take the lock with flock(1) on the
# same path. If they use another mechanism, change BOTH sides to one.
set -u
LOCK=/tmp/laptop-walk.lock
HOLDER_PID_FILE=/srv/ghrunner-web/hooks/lock-holder.pid
GATE_WAIT_S=${GATE_WAIT_S:-180}
deadline=$(( $(date +%s) + GATE_WAIT_S ))
while :; do
  load1=$(cut -d' ' -f1 /proc/loadavg)
  memavail=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)
  if awk -v l="$load1" -v m="${SAFE_LOAD_MAX:-3.0}" 'BEGIN{exit !(l<=m)}' \
     && [ "$memavail" -ge "${SAFE_MEM_MIN:-1500}" ]; then
    # Take the lock in a holder process that lives until gate-job-completed.sh.
    ( exec 9>>"$LOCK"; if flock -n 9; then echo $BASHPID > "$HOLDER_PID_FILE"; exec sleep 7200; fi ) &
    sleep 1
    if [ -s "$HOLDER_PID_FILE" ] && kill -0 "$(cat "$HOLDER_PID_FILE")" 2>/dev/null; then
      echo "acer-web gate: load1=$load1 memavail=${memavail}MiB, lock taken"
      exit 0
    fi
    echo "acer-web gate: $LOCK held (walk running), waiting"
  else
    echo "acer-web gate: load1=$load1 (max ${SAFE_LOAD_MAX:-3.0}) memavail=${memavail}MiB (min ${SAFE_MEM_MIN:-1500}), waiting"
  fi
  [ "$(date +%s)" -ge "$deadline" ] && { echo "acer-web gate: busy for ${GATE_WAIT_S}s, refusing the job"; exit 1; }
  sleep 10
done
