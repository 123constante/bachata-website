#!/usr/bin/env node
/**
 * Post-decommission arc-closeout check.
 *
 * Verifies that Website/supabase/migrations/ does NOT exist.
 * The folder was deleted in May 2026 when migration authority was
 * consolidated into the admin repo (admin commit b0c8c4f5).
 * Its re-appearance would mean an agent or contributor has violated
 * the contract documented in CLAUDE.md § "Migration authority (mandatory)"
 * and supabase/README.md.
 *
 * "0 orphans"  — no Website migrations waiting to be ported (folder is gone).
 * "0 backlog"  — confirmed via admin dry-run: all ported migrations are
 *                applied to prod; see .github/workflows/db-contract-check.yml
 *                job history for the post-arc green run.
 *
 * No Supabase credentials required — pure filesystem check.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');

if (existsSync(MIGRATIONS_DIR)) {
  console.error('FAIL: supabase/migrations/ exists — migration authority violation.');
  console.error('');
  console.error('This folder must not exist in the Website repo.');
  console.error('Migrations belong in the admin repo (bachata-admin-11april).');
  console.error('See CLAUDE.md § "Migration authority (mandatory)" and supabase/README.md.');
  process.exit(1);
}

console.log('OK: supabase/migrations/ absent — 0 orphans, 0 backlog (arc verified clean).');
