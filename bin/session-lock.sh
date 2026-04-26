#!/usr/bin/env bash
# bin/session-lock.sh — advisory lock for concurrent Cowork/Claude Code sessions.
#
# When two agent sessions edit the same repo simultaneously, in-flight writes
# can be silently truncated (the immediate root cause of the 2026-04-26
# corruption incident). This script provides an ADVISORY lock — it doesn't
# prevent writes, but it makes concurrent sessions visible.
#
# The lock file lives at .claude/.session-lock.json and contains:
#   { session_id, started_at_iso, stale_after_iso, pid, host, branch }
#
# Stale locks (older than --stale-hours, default 8) are auto-cleared with
# a warning so an orphan from a crashed session doesn't block forever.
#
# Usage:
#   bin/session-lock.sh acquire [--id <id>] [--stale-hours N] [--warn-only]
#   bin/session-lock.sh release [--id <id>]
#   bin/session-lock.sh check                  # exit 0 if free, 1 if held by another session
#   bin/session-lock.sh status                 # human-readable; always exits 0
#
# Flags:
#   --warn-only   acquire never fails — even if another session is active,
#                 print warning and exit 0 (used by SessionStart auto-hook).

set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
    echo "session-lock: not in a git repo" >&2
    exit 1
}
LOCK="$REPO_ROOT/.claude/.session-lock.json"
mkdir -p "$REPO_ROOT/.claude"

cmd="${1:-status}"
shift || true

session_id=""
stale_hours=8
warn_only=false
while [ "$#" -gt 0 ]; do
    case "$1" in
        --id) session_id="$2"; shift 2 ;;
        --stale-hours) stale_hours="$2"; shift 2 ;;
        --warn-only) warn_only=true; shift ;;
        *) echo "session-lock: unknown arg: $1" >&2; exit 1 ;;
    esac
done

[ -z "$session_id" ] && session_id="${COWORK_SESSION_ID:-${CLAUDE_SESSION_ID:-pid-$$}}"

now_iso="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
host="$(hostname 2>/dev/null || echo unknown)"
branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"

is_stale() {
    [ ! -f "$LOCK" ] && return 0
    local stale_iso
    stale_iso="$(python3 -c "import json,sys; print(json.load(open('$LOCK')).get('stale_after_iso',''))" 2>/dev/null)"
    [ -z "$stale_iso" ] && return 0
    python3 -c "
import datetime, sys
now = datetime.datetime.now(datetime.timezone.utc)
stale = datetime.datetime.fromisoformat('$stale_iso'.replace('Z', '+00:00'))
sys.exit(0 if now > stale else 1)
"
}

write_lock() {
    local stale_iso
    stale_iso="$(python3 -c "
import datetime
print((datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=$stale_hours)).strftime('%Y-%m-%dT%H:%M:%SZ'))
")"
    local tmpfile
    tmpfile="$(mktemp -t session-lock-XXXXXX.json)"
    cat > "$tmpfile" <<JSON
{
  "session_id": "$session_id",
  "started_at_iso": "$now_iso",
  "stale_after_iso": "$stale_iso",
  "pid": $$,
  "host": "$host",
  "branch": "$branch"
}
JSON
    cp "$tmpfile" "$LOCK"
    rm -f "$tmpfile"
    echo "$stale_iso"
}

case "$cmd" in
    acquire)
        if [ -f "$LOCK" ]; then
            existing_id="$(python3 -c "import json; print(json.load(open('$LOCK')).get('session_id',''))" 2>/dev/null || echo '')"
            if [ "$existing_id" = "$session_id" ]; then
                echo "session-lock: already held by this session ($session_id)"
                exit 0
            fi
            if is_stale; then
                echo "session-lock: clearing stale lock from session $existing_id" >&2
                rm -f "$LOCK"
            else
                echo "session-lock: WARNING — another Claude session is active in this repo:" >&2
                cat "$LOCK" >&2
                echo >&2
                echo "  Multi-file edits while another session is active risk losing work" >&2
                echo "  (later writes win). Either close the other session, work in a" >&2
                echo "  different folder/file area, or do small isolated changes only." >&2
                if [ "$warn_only" = "true" ]; then
                    exit 0
                fi
                echo "  (override with --warn-only to proceed anyway)" >&2
                exit 1
            fi
        fi
        stale_iso="$(write_lock)"
        echo "session-lock: acquired ($session_id, expires $stale_iso)"
        ;;

    release)
        if [ ! -f "$LOCK" ]; then
            echo "session-lock: no lock to release"
            exit 0
        fi
        existing_id="$(python3 -c "import json; print(json.load(open('$LOCK')).get('session_id',''))" 2>/dev/null || echo '')"
        if [ "$existing_id" != "$session_id" ] && [ -n "$existing_id" ]; then
            echo "session-lock: WARNING — releasing lock held by '$existing_id' (asked: '$session_id')" >&2
        fi
        rm -f "$LOCK"
        echo "session-lock: released"
        ;;

    check)
        if [ ! -f "$LOCK" ]; then
            exit 0
        fi
        if is_stale; then
            exit 0
        fi
        existing_id="$(python3 -c "import json; print(json.load(open('$LOCK')).get('session_id',''))" 2>/dev/null || echo '')"
        if [ "$existing_id" = "$session_id" ]; then
            exit 0
        fi
        echo "session-lock: held by '$existing_id'" >&2
        exit 1
        ;;

    status)
        if [ ! -f "$LOCK" ]; then
            echo "session-lock: free"
            exit 0
        fi
        echo "session-lock: held"
        cat "$LOCK"
        if is_stale; then
            echo "(stale — would be cleared on next acquire)"
        fi
        ;;

    *)
        echo "usage: $0 {acquire|release|check|status} [--id <id>] [--stale-hours N] [--warn-only]" >&2
        exit 1
        ;;
esac
