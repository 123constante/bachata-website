#!/usr/bin/env node
/**
 * install-hooks.js — point this clone's git at the tracked .githooks/ directory.
 *
 * Cross-platform replacement for bin/install-hooks.sh — runs anywhere Node runs
 * (Windows PowerShell, macOS, Linux). Used as the npm postinstall hook so
 * `npm install` automatically wires the pre-commit hook.
 *
 * Idempotent: safe to run multiple times. Never fails npm install — emits a
 * warning on error and exits 0 so the surrounding install isn't blocked.
 */

const { execSync } = require('child_process');

function run(cmd) {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

try {
    // Verify we're inside a git repo (skip silently if not — e.g. running in CI tarball)
    try {
        run('git rev-parse --git-dir');
    } catch {
        console.log('install-hooks: not a git working tree — skipping hook setup');
        process.exit(0);
    }

    run('git config --local core.hooksPath .githooks');
    console.log('✓ git hooks path set to .githooks (pre-commit will refuse null-byte corruption)');
} catch (err) {
    console.warn('install-hooks: warning — could not configure git hooks:', err.message);
    // Exit 0 anyway; failing npm install over an optional hook would be hostile
}
