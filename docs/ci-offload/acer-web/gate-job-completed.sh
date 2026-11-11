#!/bin/bash -p
# scrub_completed (fix round 2, item 1): the same env_i_reexec guard as gate-job-started.sh (read
# the comment there): re-run under `env -i` with a fixed PATH, a nonexistent HOME and ONLY
# GITHUB_REPOSITORY, so an exported function (BASH_FUNC_rm%%, BASH_FUNC_find%%, BASH_FUNC_kill%%),
# SHELLOPTS/PS4 or a loader variable cannot steer the rm -rf below. Marker = an argument, not env.
POSIXLY_CORRECT=1
if [[ "${1:-}" != --gate-reexec ]]; then
  G_PASS=()
  [[ -n "${GITHUB_REPOSITORY+x}" ]] && G_PASS+=("GITHUB_REPOSITORY=$GITHUB_REPOSITORY")
  exec /usr/bin/env -i PATH=/usr/sbin:/usr/bin:/sbin:/bin HOME=/nonexistent/ghrunner-gate XDG_CONFIG_HOME=/nonexistent/ghrunner-gate LC_ALL=C "${G_PASS[@]}" /bin/bash -p "$0" --gate-reexec "$@"
fi
shift
# readonly_unset_guard (fix round 3): same guard as gate-job-started.sh (read the comment there).
# No readonly name (BASHOPTS, SHELLOPTS, ...) is listed; each name is probed in a subshell first.
g_unset_vars() {
  for G_N in "$@"; do
    ( unset -v "$G_N" ) 2>/dev/null && unset -v "$G_N"
  done
  unset -v G_N
}
g_unset_vars G_PASS
# unset_bash_func, second layer (same as the started hook; still in posix mode).
unset -f compgen declare builtin command local unset 2>/dev/null
for G_F in $(compgen -A function); do [[ "$G_F" = g_unset_vars ]] || unset -f "$G_F"; done
g_unset_vars G_F BASH_ENV ENV PS4 CDPATH GLOBIGNORE LD_PRELOAD LD_LIBRARY_PATH LD_AUDIT
g_unset_vars POSIXLY_CORRECT
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
