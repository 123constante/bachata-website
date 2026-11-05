#!/usr/bin/env bash
# Runs after EVERY job (ACTIONS_RUNNER_HOOK_JOB_COMPLETED): release the walk lock.
HOLDER_PID_FILE=/srv/ghrunner-web/hooks/lock-holder.pid
[ -s "$HOLDER_PID_FILE" ] && kill "$(cat "$HOLDER_PID_FILE")" 2>/dev/null
rm -f "$HOLDER_PID_FILE"
exit 0
