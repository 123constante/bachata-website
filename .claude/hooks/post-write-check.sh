#!/usr/bin/env bash
# .claude/hooks/post-write-check.sh — Claude Code PostToolUse hook for
# Edit/Write operations. Runs the integrity-guard's per-file parse check
# on the file that was just written, and surfaces any failure to the
# agent so the next tool call can repair it via safe-write.py.
#
# Reads the tool invocation from stdin (Claude Code passes a JSON
# payload). On corruption, prints a diagnostic to stderr and exits 2,
# which surfaces the error in the agent's tool-call result.
#
# Skipped for files <2 KB (the corruption class only affects larger files).

set -euo pipefail

PAYLOAD="$(cat)"

FILE_PATH="$(printf '%s' "$PAYLOAD" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)
ti = data.get('tool_input', {}) or {}
print(ti.get('file_path', ''))
")"

[ -z "$FILE_PATH" ] && exit 0

# Claude Code sends NATIVE WINDOWS paths (C:\dev\Website\src\pages\X.tsx).
# Bash eats the backslashes, so the .git walk below never matches and the
# repair message quotes an absolute Windows path instead of the
# repo-relative one the recipe needs. Normalise to forward slashes first.
FILE_PATH="${FILE_PATH//\\//}"

[ ! -f "$FILE_PATH" ] && exit 0

SIZE="$(wc -c < "$FILE_PATH" 2>/dev/null || echo 0)"
[ "$SIZE" -lt 2048 ] && exit 0

# Terminate on a dirname FIXED POINT, not just on "/": on Windows paths
# (which the normalisation above now produces) dirname stabilises at the drive
# root -- dirname "C:" is "C:" forever -- so a `!= "/"` guard alone spins at
# 100% CPU for any file with no .git ancestor, hanging this hook with no
# timeout. Reachable via the declared scratchpad and C:	mp working
# directories. Same bug, same fix as safe-write.py's find_repo_root.
DIR="$(dirname "$FILE_PATH")"
REPO_ROOT=""
while [ "$DIR" != "/" ] && [ -n "$DIR" ]; do
    if [ -d "$DIR/.git" ]; then
        REPO_ROOT="$DIR"
        break
    fi
    PARENT="$(dirname "$DIR")"
    [ "$PARENT" = "$DIR" ] && break
    DIR="$PARENT"
done
[ -z "$REPO_ROOT" ] && exit 0

GUARD="$REPO_ROOT/scripts/integrity-guard.py"
[ ! -f "$GUARD" ] && exit 0

REL_PATH="${FILE_PATH#$REPO_ROOT/}"
# IMPORTANT: do not use `|| echo '{}'` here — the guard exits non-zero on
# corruption (which is the case we want to detect), and `||` would append
# {} to the real JSON output. Instead capture-or-empty, then default if
# empty.
OUTPUT="$(cd "$REPO_ROOT" && python3 "$GUARD" --no-self-check --json --files "$REL_PATH" 2>/dev/null)" || true
[ -z "$OUTPUT" ] && OUTPUT='{"issues": []}'

ISSUES_COUNT="$(printf '%s' "$OUTPUT" | python3 -c "
import json, sys
try:
    print(len(json.load(sys.stdin).get('issues', [])))
except Exception:
    print(0)
" 2>/dev/null)"

if [ "${ISSUES_COUNT:-0}" -gt 0 ]; then
    echo "=== POST-WRITE CORRUPTION DETECTED in $REL_PATH ===" >&2
    printf '%s' "$OUTPUT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for issue in data.get('issues', []):
    print(f\"  {issue.get('path')}:{issue.get('line')} [{issue.get('code','')}] {issue.get('reason','')}\")
" >&2
    cat >&2 <<'MSG'

The file you just wrote failed its parse check. This is almost always
the Cowork-mount silent-truncation bug.

Repair with the FULL-BODY path, NOT the surgical one: the on-disk base
is corrupt, so scripts/safe-edit.py would either refuse to match it or
patch garbage. Reconstruct the whole intended body, then:

Copy this block EXACTLY -- the heredoc terminator must stay at column 0:

WRITER=$(mktemp /tmp/repair-XXXXXX)
cat > "$WRITER" <<'BODY'
...full intended file contents (not a diff)...
BODY
cat "$WRITER" | PYTHONUTF8=1 python3 scripts/safe-write.py <relative-path>

Once the file parses again, ordinary edits go back through
scripts/safe-edit.py (surgical, hunk-only, stale-base-guarded).

DO NOT use Edit or Write to retry — they will corrupt again. Use
safe-write.py (full body) or safe-edit.py (surgical) above 2 KB.
MSG
    exit 2
fi

exit 0
