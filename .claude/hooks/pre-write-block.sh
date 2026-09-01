#!/usr/bin/env bash
# .claude/hooks/pre-write-block.sh — PreToolUse hook for Edit/Write.
#
# Blocks raw Edit/Write on source files larger than 2 KB. The Cowork
# mount silently truncates writes >2 KB on a non-trivial fraction of
# attempts; safe-write.py defends against that, so we route every
# meaningful source-file write through it.
#
# Receives the tool invocation JSON on stdin. Exits 2 (block + surface
# message to the agent) when the rule fires; exits 0 otherwise.
#
# Allowed: small files, non-code files (anything outside the BLOCKED set
# below), and explicit overrides via the SAFEWRITE_HOOK_BYPASS env var
# (used by repair flows that need to clear a corruption before safe-write
# can run).

set -euo pipefail

# Bypass for repair flows that intentionally write directly (e.g.,
# bin/repair-corrupt.sh restoring from HEAD via git checkout).
if [ -n "${SAFEWRITE_HOOK_BYPASS:-}" ]; then
    exit 0
fi

PAYLOAD="$(cat)"

# Use Python because jq isn't always installed in the sandbox.
read -r TOOL_NAME FILE_PATH CONTENT_LEN < <(printf '%s' "$PAYLOAD" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    print(' '.join(['', '', '0']))
    sys.exit(0)
ti = data.get('tool_input', {}) or {}
fp = ti.get('file_path', '') or ''
content = ti.get('content') or ti.get('new_string') or ''
print(data.get('tool_name', ''), fp.replace(' ', '\\\\ '), len(content.encode('utf-8')))
")

# Defensive: empty payload or non-Edit/Write call → allow
if [ -z "$TOOL_NAME" ] || { [ "$TOOL_NAME" != "Edit" ] && [ "$TOOL_NAME" != "Write" ]; }; then
    exit 0
fi
if [ -z "$FILE_PATH" ]; then
    exit 0
fi

# Un-escape spaces from the python output
FILE_PATH="${FILE_PATH//\\ / }"

# Claude Code sends NATIVE WINDOWS paths (C:\dev\Website\src\pages\X.tsx).
# Bash eats the backslashes, so without this every derived value comes out
# mangled: the .git walk never matches, REL_PATH stays absolute, and the
# safe-edit command we print for the agent to run resolves to
# "C:devWebsitesrcpagesX.tsx" -- a recipe that cannot execute. Normalise
# to forward slashes once, here, after the space un-escape above.
FILE_PATH="${FILE_PATH//\\//}"

# Extension check — only enforce on source-code extensions where the
# corruption has caused build failures.
EXT="${FILE_PATH##*.}"
case ".${EXT,,}" in
    .ts|.tsx|.jsx|.js|.cjs|.mjs|.json|.sql|.yml|.yaml|.sh|.py)
        ;;
    *)
        exit 0
        ;;
esac

# Trivial files (small new file or small target) → allow Edit/Write.
# Threshold is 2 KB — the empirically-observed corruption floor.
THRESHOLD=2048
EXISTING_SIZE=0
if [ -f "$FILE_PATH" ]; then
    EXISTING_SIZE="$(wc -c < "$FILE_PATH" 2>/dev/null || echo 0)"
fi

# If neither the existing file nor the proposed content exceeds the
# threshold, the corruption class doesn't apply — let it through.
CONTENT_LEN="${CONTENT_LEN//[^0-9]/}"; CONTENT_LEN="${CONTENT_LEN:-0}"
EXISTING_SIZE="${EXISTING_SIZE//[^0-9]/}"; EXISTING_SIZE="${EXISTING_SIZE:-0}"
if [ "$EXISTING_SIZE" -lt "$THRESHOLD" ] && [ "${CONTENT_LEN:-0}" -lt "$THRESHOLD" ]; then
    exit 0
fi

# Above the threshold and editing a source file → block, with a clear
# remediation message the agent can act on directly.
REL_PATH="$FILE_PATH"
# Terminate on a dirname FIXED POINT, not just on "/": on Windows paths
# (which the normalisation above now produces) dirname stabilises at the drive
# root -- dirname "C:" is "C:" forever -- so a `!= "/"` guard alone spins at
# 100% CPU for any file with no .git ancestor, hanging this hook with no
# timeout. This is the ORDINARY path, not an edge case: the test below is
# [ -d "$DIR/.git" ], and in a linked git worktree .git is a FILE, so it
# never matches and EVERY file in the worktree walks to the fixed point.
# Also reachable via the declared scratchpad and C:/tmp working
# directories. Same bug, same fix as safe-write.py's find_repo_root.
DIR="$(dirname "$FILE_PATH")"
while [ "$DIR" != "/" ] && [ -n "$DIR" ]; do
    if [ -d "$DIR/.git" ]; then
        REL_PATH="${FILE_PATH#$DIR/}"
        break
    fi
    PARENT="$(dirname "$DIR")"
    [ "$PARENT" = "$DIR" ] && break
    DIR="$PARENT"
done

# Existing files get the SURGICAL recipe first: it transports the hunk
# instead of the whole body, which is the difference between ~2 KB and
# ~275 KB of round-trip for a 137 KB page. New files have no base to
# patch, so they go straight to the full-body path below.
SURGICAL_HINT=""
if [ -f "$FILE_PATH" ]; then
    SURGICAL_HINT="$(cat <<HINT
SURGICAL path -- preferred, because $REL_PATH already exists.
Transports only the hunk, and refuses every way the mount can hand you
a stale base:

Copy the block below EXACTLY. The heredoc terminator and the @@ marker
lines MUST stay at column 0 -- indent them and bash never closes the
heredoc, and safe-edit's marker anchors stop matching:

PATCH=\$(mktemp /tmp/hunk-XXXXXX.txt)
cat > "\$PATCH" <<'HUNK'
@@SAFE-EDIT-OLD@@
...the exact existing text, unique in the file...
@@SAFE-EDIT-NEW@@
...its replacement...
@@SAFE-EDIT-END@@
HUNK
PYTHONUTF8=1 python3 scripts/safe-edit.py $REL_PATH < "\$PATCH"

Stage the payload in a file; never pipe a producer straight in. Every
success prints a result sha256 -- chain the next edit on this file with
--expect-base-sha <that sha> so a concurrent clobber fails loudly
instead of silently reverting your earlier edit. Non-zero exits: 1 bad
payload, 2 base never settled, 3 usage/no-op, 4 zero/duplicate/mixed
match, 5 write path rejected it, 6 base-sha mismatch. All of them mean
fall back to the full-body path below.

HINT
)"
    # $() strips trailing newlines; restore the paragraph break so the
    # hint does not run into the FULL-BODY heading below.
    SURGICAL_HINT="$SURGICAL_HINT

"
fi

cat >&2 <<MSG
=== PRE-WRITE BLOCK ===
Refusing $TOOL_NAME on $REL_PATH (existing=${EXISTING_SIZE} bytes,
new content=${CONTENT_LEN:-0} bytes, threshold=${THRESHOLD}).

Source files larger than 2 KB MUST go through a guarded write path,
which defends against the Cowork mount's silent-truncation bug.

Exit 0 is not always "checked", on EITHER path below. READ STDERR even
on success: when the syntax check could not run -- no typescript
installed, no node on PATH, no repo root above the target -- the write
is KEPT and mount-verified, exit stays 0, and "PARSE CHECK DID NOT RUN"
says so there. It means nothing parsed your file, so nothing would have
caught a syntax error. safe-edit delegates the check to safe-write and
prints "parse-check delegated" either way, so on the surgical path
stderr is the ONLY signal.

${SURGICAL_HINT}FULL-BODY path (new files, whole-file rewrites, and any
safe-edit refusal):

WRITER=\$(mktemp /tmp/edit-XXXXXX.${EXT})
cat > "\$WRITER" <<'EOF'
  …full intended file contents (not a diff)…
EOF
cat "\$WRITER" | PYTHONUTF8=1 python3 scripts/safe-write.py $REL_PATH

safe-write.py stages in /tmp, copies to the target, force-syncs the
mount, verifies the on-disk sha256 from a *separate* subprocess to
bypass kernel cache, and retries with backoff if the mount served stale
content. Exits non-zero on any unrecoverable corruption.

If you genuinely need to bypass this hook (rare — repair flows only):
  SAFEWRITE_HOOK_BYPASS=1 …

This block is enforced by .claude/hooks/pre-write-block.sh.
MSG

exit 2
