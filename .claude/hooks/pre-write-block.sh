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
if [ "$EXISTING_SIZE" -lt "$THRESHOLD" ] && [ "${CONTENT_LEN:-0}" -lt "$THRESHOLD" ]; then
    exit 0
fi

# Above the threshold and editing a source file → block, with a clear
# remediation message the agent can act on directly.
REL_PATH="$FILE_PATH"
DIR="$(dirname "$FILE_PATH")"
while [ "$DIR" != "/" ] && [ -n "$DIR" ]; do
    if [ -d "$DIR/.git" ]; then
        REL_PATH="${FILE_PATH#$DIR/}"
        break
    fi
    DIR="$(dirname "$DIR")"
done

cat >&2 <<MSG
=== PRE-WRITE BLOCK ===
Refusing $TOOL_NAME on $REL_PATH (existing=${EXISTING_SIZE} bytes,
new content=${CONTENT_LEN:-0} bytes, threshold=${THRESHOLD}).

Source files larger than 2 KB MUST be written via safe-write.py, which
defends against the Cowork mount's silent-truncation bug. Use this
pattern instead:

  WRITER=\$(mktemp /tmp/edit-XXXXXX.${EXT})
  cat > "\$WRITER" << 'EOF'
  …full intended file contents (not a diff)…
  EOF
  cat "\$WRITER" | python3 scripts/safe-write.py $REL_PATH

safe-write.py stages in /tmp, copies to the target, force-syncs the
mount, verifies the on-disk sha256 from a *separate* subprocess to
bypass kernel cache, and retries with backoff if the mount served stale
content. Exits non-zero on any unrecoverable corruption.

If you genuinely need to bypass this hook (rare — repair flows only):
  SAFEWRITE_HOOK_BYPASS=1 …

This block is enforced by .claude/hooks/pre-write-block.sh.
MSG

exit 2
