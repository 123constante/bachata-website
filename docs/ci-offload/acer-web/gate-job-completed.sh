#!/usr/bin/env bash
# ACTIONS_RUNNER_HOOK_JOB_COMPLETED: release the walk lock, remove this job's checkout. Root-owned,
# read-only to the service user. Always exits 0 (a cleanup problem never reds a job).
# fix round 2 item 8: ONLY the checkout INSIDE _work/<repo> goes (the dir itself is kept). _temp and _actions are the runner's and it may
# still use them after this hook; stale ones are cleaned by gate-job-started.sh before a job.
# Paths from defaults + the root-owned conf (same file and keys as gate-job-started.sh), never
# env: this hook runs rm -rf. `--conf FILE` is for tests.
CONF=/etc/ghrunner-web/gate.conf
[ "${1:-}" = "--conf" ] && [ -n "${2:-}" ] && CONF=$2
STATE_DIR=/srv/ghrunner-web/state
WORK_DIR=/srv/ghrunner-web/runner/_work
if [ -r "$CONF" ]; then
  while IFS='=' read -r k v; do
    case "$k" in STATE_DIR) STATE_DIR=$v ;; WORK_DIR) WORK_DIR=$v ;; esac
  done < <(grep -E '^[A-Z_]+=' "$CONF")
fi
HOLDER_PID_FILE=$STATE_DIR/lock-holder.pid
if [ -s "$HOLDER_PID_FILE" ]; then
  read -r pid start < "$HOLDER_PID_FILE"
  # Kill only if it is still OUR holder (same start time): never a reused PID.
  if [ -n "${pid:-}" ] && [ "$(awk '{print $22}' "/proc/$pid/stat" 2>/dev/null)" = "${start:-x}" ]; then
    kill "$pid" 2>/dev/null
  fi
fi
rm -f "$HOLDER_PID_FILE" "$STATE_DIR/gate-verdict"
name=${GITHUB_REPOSITORY##*/}
case "$name" in
  ''|.|..|_tool|_temp|_actions|*/*) ;;
  *) [[ "$name" =~ ^[A-Za-z0-9._-]+$ ]] && [ -d "$WORK_DIR/$name" ] && find "${WORK_DIR:?}/$name" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null ;;
esac
exit 0
