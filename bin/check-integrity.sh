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
    if ! command -v node >/dev/null 2>&1; then
        # `node --check` failing because node is ABSENT is not the helper being
        # corrupt, and this branch used to say it was -- CI went red naming a
        # tracked file that was perfectly fine. Say what actually happened, and
        # do NOT exit here: the guard still checks JSON, YAML, SQL and the byte
        # scans, and a real corruption found there must outrank a could-not-run.
        # The guard reports the unrun JS/TS phases itself and exits 2.
        echo "check-integrity: node is not on PATH -- the JS and TS parse phases cannot run." >&2
        echo "  The guard runs on regardless; it will report those phases as unchecked." >&2
    elif ! node --check "$HELPER_SRC" 2>/dev/null; then
        echo "check-integrity: TS parse helper is corrupt at $HELPER_SRC" >&2
        echo "  restore: git checkout HEAD -- scripts/_integrity_ts_parse.cjs" >&2
        exit 2
    fi
fi

# python3 is the guard's INTERPRETER. Probed for the same reason node is probed
# above, and it matters more: without it nothing runs at all, and `exec python3`
# on a missing interpreter makes bash exit 127. run-lint-chain.mjs's classify()
# maps everything that is not 0 or 2 to FAIL, so the tier prints "lint FAILED"
# and decideExit returns 1 -- a verdict about the TREE, delivered by a guard
# that never started. 2 is the code that says "could not check".
if ! command -v python3 >/dev/null 2>&1; then
    echo "check-integrity: python3 is not on PATH -- the guard cannot run at all." >&2
    echo "  Nothing was checked, and nothing here is a finding about your tree." >&2
    exit 2
fi

# Run from /tmp, pass through args
exec python3 "$GUARD_TMP" "$@"
