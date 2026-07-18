#!/usr/bin/env node
/**
 * check-calendar-rpc-typing.mjs
 *
 * Build-time guardrail: fails if any production-code or test file calls the
 * calendar RPC `get_calendar_events_v2` through an `as never` / `as any` cast on
 * the RPC name. Since Phase 2 (c93fb83) regenerated the Supabase schema, that RPC
 * is in the typed `Database`, so the cast is obsolete AND actively harmful: it
 * turns `data` into `never`/`any`, discarding the typed `Returns` and defeating
 * the WallClock brand (a type-checker sees nothing through `any`, so
 * check-wallclock-brand.mjs cannot catch a `new Date(row.start_time)` on an
 * untyped row). Every consumer must route through the typed+branded
 * getCalendarEvents / parseCalendarEventRow boundary in
 * src/integrations/supabase/eventRpcs.ts.
 *
 * A verified cast to the real generated shape
 * (`data as Database['public']['Functions']['get_calendar_events_v2']['Returns']`)
 * is allowed -- only `as never` / `as any` are forbidden.
 *
 * Scope: src/, tests/, middleware.ts (excludes the auto-generated types.ts).
 * Wired into: package.json `lint` and .github/workflows/typecheck.yml.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const SCAN_PATHS = ['src', 'tests', 'middleware.ts'];

const ALLOWED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

const EXCLUDED_PATHS = [
  'supabase/migrations',
  'src/integrations/supabase/types.ts',
  'src/types/supabase.ts',
  'node_modules',
  'dist',
  '.next',
];

// Matches: rpc('get_calendar_events_v2' as never  /  rpc("get_calendar_events_v2" as any
const LAUNDERED_CALENDAR_RPC = /get_calendar_events_v2['"]\s+as\s+(never|any)\b/;

const toPosixRelative = (absolutePath) =>
  path.relative(ROOT, absolutePath).split(path.sep).join('/');

const isExcluded = (relativePath) =>
  EXCLUDED_PATHS.some(
    (excluded) => relativePath === excluded || relativePath.startsWith(`${excluded}/`),
  );

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
      if (LAUNDERED_CALENDAR_RPC.test(line)) {
        violations.push({
          file: relativePath,
          line: index + 1,
          snippet: line.trim().slice(0, 160),
        });
      }
    });
  }

  if (violations.length > 0) {
    console.error('\nCalendar-RPC typing guard failed: get_calendar_events_v2 called through an obsolete `as never`/`as any` cast.');
    console.error('Route the call through getCalendarEvents / parseCalendarEventRow');
    console.error('(src/integrations/supabase/eventRpcs.ts) so `data` keeps its typed, branded Returns.\n');
    for (const v of violations) {
      console.error(`- ${v.file}:${v.line}  ${v.snippet}`);
    }
    console.error(`\nTotal violations: ${violations.length}`);
    process.exit(1);
  }

  console.log('Calendar-RPC typing guard passed (no laundered get_calendar_events_v2 calls).');
};

run().catch((error) => {
  console.error('check-calendar-rpc-typing failed to run:', error);
  process.exit(1);
});
