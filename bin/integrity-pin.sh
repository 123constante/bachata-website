#!/usr/bin/env bash
# bin/integrity-pin.sh — pin the current integrity-guard.py sha256.
#
# Run this whenever you intentionally modify scripts/integrity-guard.py.
# It writes the new sha256 to .integrity-guard.sha256 (which must be
# committed alongside the script change).

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
GUARD="$REPO_ROOT/scripts/integrity-guard.py"
PIN="$REPO_ROOT/.integrity-guard.sha256"

if [ ! -f "$GUARD" ]; then
    echo "integrity-pin: scripts/integrity-guard.py not found" >&2
    exit 1
fi

# Sanity: verify the guard at least parses as Python before pinning a
# corrupted version
if ! python3 -c "import ast; ast.parse(open('$GUARD').read())" 2>/dev/null; then
    echo "integrity-pin: REFUSING — scripts/integrity-guard.py does not parse as Python" >&2
    echo "  fix the script before pinning, or restore from git" >&2
    exit 1
fi

SHA="$(sha256sum "$GUARD" | awk '{print $1}')"
echo "$SHA  scripts/integrity-guard.py" > "$PIN"
echo "integrity-pin: locked $SHA"
echo "  written to: $PIN"
echo "  remember to commit $PIN alongside the script change"
