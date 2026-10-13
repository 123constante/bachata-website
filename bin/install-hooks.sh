#!/usr/bin/env bash
# install-hooks.sh — point this clone's git at the tracked .githooks/ directory.
# Idempotent: safe to run multiple times.
#
# Usage:  bash bin/install-hooks.sh

set -e
REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

git config --local core.hooksPath .githooks
echo "✓ git hooks path set to .githooks (pre-commit will refuse null-byte corruption)"
