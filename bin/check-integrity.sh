#!/usr/bin/env bash
# bin/check-integrity.sh — sealed wrapper around scripts/integrity-guard.py.
#
# This is the ONLY supported entry point for the integrity check. It:
#   1. Locates the repo root (via git).
#   2. Copies the guard script to /tmp (Linux-native FS, immune to the
#      Cowork mount truncation bug).
#   3. Verifies the script's sha256 against the committed pin in
#      .integrity-guard.sha256. If mismatch, aborts — the guard may be
#      corrupted.
#   4. Runs the guard from /tmp, passing through any args.
#
# Why this matters: the guard script lives on the same Windows mount as
# the rest of the repo and could itself be silently truncated. Running it
# from /tmp + sha-pinning means a corrupted guard cannot pass clean.
#
# Pre-commit hook, CI, and `npm run check:integrity` all call this wrapper.
# Never call scripts/integrity-guard.py directly.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$REPO_ROOT" ]; then
    echo "check-integrity: not in a git repo" >&2
    exit 3
fi

GUARD_SRC="$REPO_ROOT/scripts/integrity-guard.py"
HELPER_SRC="$REPO_ROOT/scripts/_integrity_ts_parse.cjs"
PIN_FILE="$REPO_ROOT/.integrity-guard.sha256"

if [ ! -f "$GUARD_SRC" ]; then
    echo "check-integrity: scripts/integrity-guard.py missing" >&2
    exit 3
fi

# Copy guard + helper to /tmp (Linux-native — no mount corruption possible)
GUARD_TMP="$(mktemp -t integrity-guard-XXXXXX.py)"
cp "$GUARD_SRC" "$GUARD_TMP"
trap 'rm -f "$GUARD_TMP"' EXIT

# Verify pin BEFORE running the guard. The guard does its own self-check
# too, but doing it here protects against the case where the in-repo guard
# was corrupted such that its own self-check is bypassed.
if [ -f "$PIN_FILE" ]; then
    EXPECTED="$(awk '{print $1}' "$PIN_FILE")"
    ACTUAL="$(sha256sum "$GUARD_TMP" | awk '{print $1}')"
    if [ "$EXPECTED" != "$ACTUAL" ]; then
        echo "check-integrity: GUARD SHA MISMATCH" >&2
        echo "  expected: $EXPECTED" >&2
        echo "  actual:   $ACTUAL" >&2
        echo "  the integrity guard may be corrupted." >&2
        echo "  restore: git checkout HEAD -- scripts/integrity-guard.py" >&2
        echo "  or, if the change is intentional: bin/integrity-pin.sh" >&2
        exit 2
    fi
else
    echo "check-integrity: no .integrity-guard.sha256 pin yet — run bin/integrity-pin.sh" >&2
fi

# The guard helper (TS parser) lives in repo too; the guard reads it from
# repo_root, so we don't need to copy it. But we should at least sanity-check
# it parses as JS before relying on it.
if [ -f "$HELPER_SRC" ]; then
    if ! node --check "$HELPER_SRC" 2>/dev/null; then
        echo "check-integrity: TS parse helper is corrupt at $HELPER_SRC" >&2
        echo "  restore: git checkout HEAD -- scripts/_integrity_ts_parse.cjs" >&2
        exit 2
    fi
fi

# Run from /tmp, pass through args
exec python3 "$GUARD_TMP" "$@"
