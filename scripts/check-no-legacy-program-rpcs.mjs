#!/usr/bin/env node
/**
 * check-no-legacy-program-rpcs.mjs
 *
 * Phase 5.6 cutover guardrail: fails if any production-code or test file
 * adds a new call to the retired event-read RPCs. Callers must use
 * event_view_p5 with the appropriate compat shape (admin commit 141a6ab
 * for legacy_compat; admin migration 20260601030000 for snapshot_compat).
 *
 * Retired RPC handles (calls only — comments / docs may still mention
 * them historically):
 *   - get_event_program_v1        → event_view_p5({series_id}, legacy_compat)
 *   - get_occurrence_program_v1   → event_view_p5({occurrence_id}, legacy_compat)
 *   - get_event_page_snapshot_v2  → event_view_p5({series_id[,occurrence_id]}, snapshot_compat)
 *
 * The pattern matches quoted occurrences (i.e. real RPC calls or generated
 * type entries), so free-text mentions inside // comments / docstrings pass
 * through. Generated supabase types and the contract tests are
 * allow-listed because they must reference the names to do their job.
 *
 * Wired into: package.json `lint` and .github/workflows/architecture-guard.yml.
 *
 * Retires alongside the legacy RPCs at §5.10.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const SCAN_PATHS = ['src', 'tests', 'middleware.ts'];

const ALLOWED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

const EXCLUDED_PATHS = [
  'supabase/migrations',
  'tests/_fixtures',
  // The pre-existing contract test on the legacy RPCs themselves —
  // it must mention them by name to test them. Retires at §5.10.
  'tests/occurrenceProgram.contract.test.ts',
  // Phase 5.6 compat-vs-legacy parity test — mentions both RPC names
  // in the assertion strings.
  'tests/eventViewCompat.contract.test.ts',
  // Generated from the live schema; the scan must catch app code, not
  // the schema mirror itself.
  'src/integrations/supabase/types.ts',
  'src/types/supabase.ts',
  'node_modules',
  'dist',
  '.next',
];

const FORBIDDEN_RPC_PATTERN = /['"`](get_event_program_v1|get_occurrence_program_v1|get_event_page_snapshot_v2)['"`]/;

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
      if (FORBIDDEN_RPC_PATTERN.test(line)) {
        violations.push({
          file: relativePath,
          line: index + 1,
          snippet: line.trim().slice(0, 160),
        });
      }
    });
  }

  if (violations.length > 0) {
    console.error('\nLegacy-event-RPC guardrail failed: retired RPC call(s) found.');
    console.error('Retired (Phase 5.6 cutover):');
    console.error('  • get_event_program_v1        → event_view_p5(legacy_compat)');
    console.error('  • get_occurrence_program_v1   → event_view_p5(legacy_compat)');
    console.error('  • get_event_page_snapshot_v2  → event_view_p5(snapshot_compat)\n');
    for (const v of violations) {
      console.error(`- ${v.file}:${v.line}  ${v.snippet}`);
    }
    console.error(`\nTotal violations: ${violations.length}`);
    process.exit(1);
  }

  console.log('Legacy-event-RPC guardrail passed (no retired-RPC calls).');
};

run().catch((error) => {
  console.error('check-no-legacy-program-rpcs failed to run:', error);
  process.exit(1);
});
