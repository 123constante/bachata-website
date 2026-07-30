#!/usr/bin/env bash
# bin/session-lock.sh - advisory session lock, manual CLI entry point.
#
# THIN WRAPPER since operating-model-v2 Phase 6: the implementation is
# scripts/hooks/session-lock.mjs (single-process Node - the shell version spawned
# ~4 python3 + 2 git per call, paid on every prompt once heartbeats landed). The
# hooks in .claude/settings.json call the .mjs directly; this wrapper exists so
# muscle memory and docs invoking `bin/session-lock.sh <cmd>` keep working.
#
# Subcommands: acquire | heartbeat | release | check | status
# Flags:       --id X | --stale-minutes N | --stale-hours H | --warn-only | --force
# See the .mjs header for semantics (heartbeat lifecycle, guarded release, 90-min
# staleness backstop).

set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/../scripts/hooks/session-lock.mjs" "$@"
