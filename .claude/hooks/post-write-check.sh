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
# timeout. Reachable via the declared scratchpad and C:/tmp working
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
# {} to the real JSON output. Capture the output and the status separately.
# The guard's stderr is KEPT, for the reason bin/repair-corrupt.sh keeps the
# wrapper's: it is where the actionable cause lives. Sending it to /dev/null
# left this hook telling an AGENT to "fix the tooling (node / PyYAML)" while
# discarding the traceback, the SyntaxError or the ImportError that says WHICH.
# The same defect this change fixed in the sibling consumer, in the consumer an
# agent actually reads.
GUARD_ERR="$(mktemp -t postwrite-guard-err-XXXXXX)"
trap 'rm -f "$GUARD_ERR"' EXIT
set +e
OUTPUT="$(cd "$REPO_ROOT" && python3 "$GUARD" --no-self-check --json --files "$REL_PATH" 2>"$GUARD_ERR")"
GUARD_STATUS=$?
set -e

# Two counts, never one. The guard reports "this file is corrupt" and "I could
# not check this file" as separate facts, and this hook's response to the first
# is DESTRUCTIVE: it tells the agent to reconstruct the whole file body from
# memory and overwrite the original. Acting on a could-not-run (a 10s
# `node --check` timeout on this mount is entirely plausible) would mean
# overwriting a HEALTHY file, which is strictly worse than the fail-open that
# preceded it. `-1 -1 -1` is the unparseable/crashed case: a guard that could not
# speak is NOT a clean file, so it lands in the advisory branch, never in
# silence and never in the destructive one.
# THREE numbers, and the third is not decoration. The guard silently drops any
# --files entry that does not resolve inside the repo root, and then reports
# considered:0, issues:[], exit:0 -- a perfect clean bill of health for a file it
# never opened. Reachable whenever the REL_PATH stripping below does not match
# (a symlinked or realpath-differing repo root, a doubled slash), which is a
# fail-open sitting inside the consumer this change rewrote to remove
# fail-opens. A zero goes to the advisory branch, never to silence.
COUNTS="$(printf '%s' "$OUTPUT" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    issues = data.get('issues', [])
except Exception:
    print('-1 -1 -1'); sys.exit(0)
cnr = [i for i in issues if i.get('could_not_run')]
print(f'{len(issues) - len(cnr)} {len(cnr)} ' + str(data.get('considered', -1)))
" 2>/dev/null)" || COUNTS=''
[ -z "$COUNTS" ] && COUNTS='-1 -1 -1'
CORRUPT_COUNT="$(printf '%s' "$COUNTS" | cut -d' ' -f1)"
CNR_COUNT="$(printf '%s' "$COUNTS" | cut -d' ' -f2)"
CONSIDERED="$(printf '%s' "$COUNTS" | cut -d' ' -f3)"

if [ "${CORRUPT_COUNT:-0}" -gt 0 ]; then
    echo "=== POST-WRITE CORRUPTION DETECTED in $REL_PATH ===" >&2
    printf '%s' "$OUTPUT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for issue in data.get('issues', []):
    if issue.get('could_not_run'):
        continue
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

if [ "${CNR_COUNT:-0}" -ne 0 ] || [ "${GUARD_STATUS:-0}" -gt 1 ] || [ "${CONSIDERED:--1}" -lt 1 ]; then
    # ADVISORY ONLY, and exit 0 on purpose. Nothing here is evidence about the
    # file that was just written: the guard could not look at it. Exiting 2
    # would surface a repair instruction for a healthy file, which is the one
    # outcome worse than the silence this branch replaced. So: say it, do not
    # act on it, and do not block. CI is where an unrunnable parser goes red.
    echo "post-write-check: the parse check for $REL_PATH COULD NOT RUN (guard exit ${GUARD_STATUS:-?})." >&2
    echo "  This file was NOT verified. It is not known to be corrupt, and not known to be clean." >&2
    echo "  Do NOT rewrite it on the strength of this message. Fix the tooling instead." >&2
    # The guard's own stderr, capped: it names WHICH tool failed, which
    # "fix the tooling (node / PyYAML)" never could. Capped because a full-tree
    # traceback in an agent's tool result buries the three lines above it.
    if [ -s "$GUARD_ERR" ]; then
        echo "  --- what the guard said ---" >&2
        head -c 4000 "$GUARD_ERR" | sed 's/^/  /' >&2
    fi
    exit 0
fi

exit 0
