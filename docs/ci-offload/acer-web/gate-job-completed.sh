#!/usr/bin/env bash
# ACTIONS_RUNNER_HOOK_JOB_COMPLETED: release the walk lock, remove this job's checkout. Root-owned,
# read-only to the service user. Always exits 0 (a cleanup problem never reds a job).
# fix round 2 item 8: ONLY _work/<repo> goes. _temp and _actions are the runner's and it may
# still use them after this hook; stale ones are cleaned by gate-job-started.sh before a job.
STATE_DIR=${WEB_RUNNER_STATE_DIR:-/srv/ghrunner-web/state}
HOLDER_PID_FILE=$STATE_DIR/lock-holder.pid
WORK_DIR=${WEB_RUNNER_WORK_DIR:-/srv/ghrunner-web/runner/_work}
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
  *) [[ "$name" =~ ^[A-Za-z0-9._-]+$ ]] && [ -d "$WORK_DIR/$name" ] && rm -rf "${WORK_DIR:?}/$name" 2>/dev/null ;;
esac
exit 0
