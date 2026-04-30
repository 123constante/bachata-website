#!/usr/bin/env node
/**
 * check-no-legacy-tables.mjs
 *
 * Build-time guardrail: fails if any production-code or test file references
 * legacy tables that have been retired. Any remaining reference will throw at
 * runtime once the DB drops the table.
 *
 * Scope: src/, middleware.ts, tests/
 * Exclusions:
 *   - supabase/migrations/      (historical SQL; kept for replay parity)
 *   - tests/_fixtures/          (legacy fixture data may legitimately quote)
 *   - tests/programSessionLinkProof.test.ts (anti-regression test that
 *     explicitly asserts new migrations do NOT touch EPL — it must mention
 *     the table name to do its job)
 *   - src/integrations/supabase/types.ts and src/types/supabase.ts
 *     (auto-generated from the live schema — the scan must catch app code,
 *     not the schema mirror itself)
 *
 * Wired into: package.json `lint` and .github/workflows/architecture-guard.yml.
 *
 * Patterns:
 *   - event_profile_link[s]?(_audit|_suggestions)?  — retired EPL tables
 *   - dj_profiles                                    — retired in favour of
 *     dancer_profiles + person_roles[djing] + dj_role_details, exposed via
 *     list_public_djs_v1 / get_public_dj_v1.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const SCAN_PATHS = [
  'src',
  'tests',
  'middleware.ts',
];

const ALLOWED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

const EXCLUDED_PATHS = [
  'supabase/migrations',
  'tests/_fixtures',
  'tests/programSessionLinkProof.test.ts',
  'src/integrations/supabase/types.ts',
  'src/types/supabase.ts',
  'node_modules',
  'dist',
  '.next',
];

const LEGACY_TABLE_PATTERN = /event_profile_link[s]?(_audit|_suggestions)?|dj_profiles/;

const toPosixRelative = (absolutePath) =>
  path.relative(ROOT, absolutePath).split(path.sep).join('/');

const isExcluded = (relativePath) =>
  EXCLUDED_PATHS.some((excluded) => relativePath === excluded || relativePath.startsWith(`${excluded}/`));

const collect = async (entryPath) => {
  let stat;
  try {
    stat = await fs.stat(entryPath);
  } catch {
    return [];
  }
  if (stat.isFile()) return [entryPath];
  if (!stat.isDirectory()) return [];

  const entries = await fs.readdir(entryPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(entryPath, entry.name);
      const relative = toPosixRelative(fullPath);
      if (isExcluded(relative)) return [];
      if (entry.isDirectory()) return collect(fullPath);
      return [fullPath];
    }),
  );
  return nested.flat();
};

const isScannableFile = (relativePath) => {
  if (isExcluded(relativePath)) return false;
  if (relativePath.endsWith('.d.ts')) return false;
  return ALLOWED_EXTENSIONS.has(path.extname(relativePath));
};

const run = async () => {
  const allFiles = (
    await Promise.all(SCAN_PATHS.map((relPath) => collect(path.join(ROOT, relPath))))
  ).flat();

  const violations = [];

  for (const absolutePath of allFiles) {
    const relativePath = toPosixRelative(absolutePath);
    if (!isScannableFile(relativePath)) continue;

    const content = await fs.readFile(absolutePath, 'utf8');
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (LEGACY_TABLE_PATTERN.test(line)) {
        violations.push({
          file: relativePath,
          line: index + 1,
          snippet: line.trim().slice(0, 160),
        });
      }
    });
  }

  if (violations.length > 0) {
    console.error('\nLegacy-table guardrail failed: retired-table references found.');
    console.error('Retired tables: event_profile_links* (use event_program_people),');
    console.error('dj_profiles (use list_public_djs_v1 / get_public_dj_v1 RPCs).\n');
    for (const v of violations) {
      console.error(`- ${v.file}:${v.line}  ${v.snippet}`);
    }
    console.error(`\nTotal violations: ${violations.length}`);
    process.exit(1);
  }

  console.log('Legacy-table guardrail passed (no retired-table references).');
};

run().catch((error) => {
  console.error('check-no-legacy-tables failed to run:', error);
  process.exit(1);
});
