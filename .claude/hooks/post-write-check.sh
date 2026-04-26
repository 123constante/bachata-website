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
[ ! -f "$FILE_PATH" ] && exit 0

SIZE="$(wc -c < "$FILE_PATH" 2>/dev/null || echo 0)"
[ "$SIZE" -lt 2048 ] && exit 0

DIR="$(dirname "$FILE_PATH")"
REPO_ROOT=""
while [ "$DIR" != "/" ] && [ -n "$DIR" ]; do
    if [ -d "$DIR/.git" ]; then
        REPO_ROOT="$DIR"
        break
    fi
    DIR="$(dirname "$DIR")"
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
the Cowork-mount silent-truncation bug. To repair:

  1. Reconstruct the intended content into a /tmp file
  2. cat /tmp/<file> | python3 scripts/safe-write.py <relative-path>

DO NOT use Edit or Write to retry — they will corrupt again. Use
safe-write.py for files larger than 2 KB.
MSG
    exit 2
fi

exit 0
