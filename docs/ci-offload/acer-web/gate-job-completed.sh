#!/usr/bin/env bash
# ACTIONS_RUNNER_HOOK_JOB_COMPLETED: release the walk lock, clean the workspace. Root-owned,
# read-only to the service user. Always exits 0 (a cleanup problem never reds a job).
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
# Ephemeral workspace: nothing a job wrote survives into the next job (checkout, node_modules,
# _temp). _tool (setup-node cache) is kept; it is written only by pinned actions.
if [ -d "$WORK_DIR" ]; then
  find "$WORK_DIR" -mindepth 1 -maxdepth 1 ! -name _tool -exec rm -rf {} + 2>/dev/null
fi
exit 0
