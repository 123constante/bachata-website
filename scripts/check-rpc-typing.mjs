/**
 * check-rpc-typing.mjs
 *
 * Systemic guardrail: forbids laundering a Supabase RPC call through an
 * `as never` / `as any` cast on the RPC name, e.g.
 *   supabase.rpc('get_calendar_events_v2' as never, args as never)
 *
 * Since the schema is regenerated from the live DB (types-drift.yml) every RPC
 * is in the typed `Database`, so the cast is obsolete AND actively harmful: it
 * collapses `data` to `never`/`any`, discarding the typed `Returns` and
 * defeating the WallClock brand (the type-checker sees nothing through `any`, so
 * check-wallclock-brand.mjs cannot catch a `new Date(row.start_time)` on an
 * untyped row). Every consumer should route through a typed boundary
 * (e.g. getCalendarEvents / parseCalendarEventRow in
 * src/integrations/supabase/eventRpcs.ts).
 *
 * A verified cast to the real generated shape
 * (`data as Database['public']['Functions']['<name>']['Returns']`) is fine —
 * only `as never` / `as any` on the RPC NAME are forbidden.
 *
 * This supersedes the single-RPC check-calendar-rpc-typing.mjs. The laundered
 * sites that exist today are frozen in scripts/rpc-typing-allowlist.json (a
 * snapshot ratchet). The gate FAILS when:
 *   - a NEW (file, rpc) laundering appears, or
 *   - an allowlisted (file, rpc) COUNT increases, or
 *   - an allowlisted entry is STALE (count dropped or file removed) — so the
 *     allowlist must shrink as RPCs are wrapped in typed boundaries.
 * `get_calendar_events_v2` is deliberately absent from the allowlist, so it
 * stays zero-tolerance.
 *
 * Regenerate the snapshot after a legitimate change with:
 *   node scripts/check-rpc-typing.mjs --write
 *
 * Scope: src/, app/, tests/, middleware.ts (excludes the generated types.ts).
 * Wired into: package.json `lint` and .github/workflows/typecheck.yml.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.cwd();

const SCAN_PATHS = ['src', 'app', 'tests', 'middleware.ts'];

const ALLOWLIST_PATH = 'scripts/rpc-typing-allowlist.json';

const ALLOWED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

const EXCLUDED_PATHS = [
  'supabase/migrations',
  'src/integrations/supabase/types.ts',
  'src/types/supabase.ts',
  'node_modules',
  'dist',
  '.next',
];

// Matches: rpc('get_calendar_events_v2' as never  /  rpc("name" as any
// Global + capture group so we can count every occurrence and name the RPC.
const LAUNDERED_RPC = /rpc\(\s*['"]([a-z0-9_]+)['"]\s+as\s+(?:never|any)\b/g;

const toPosixRelative = (absolutePath) =>
  path.relative(ROOT, absolutePath).split(path.sep).join('/');

const isExcluded = (relativePath) =>
  EXCLUDED_PATHS.some(
    (excluded) => relativePath === excluded || relativePath.startsWith(`${excluded}/`),
  );

const isScannableFile = (relativePath) => {
  if (isExcluded(relativePath)) return false;
  if (relativePath.endsWith('.d.ts')) return false;
  return ALLOWED_EXTENSIONS.has(path.extname(relativePath));
};

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

/**
 * Scan the tree and return a nested count map: { [relPath]: { [rpcName]: count } }.
 * Keys are sorted so the written allowlist is stable and diff-friendly.
 */
export async function scanTree(root = ROOT) {
  const allFiles = (
    await Promise.all(SCAN_PATHS.map((relPath) => collect(path.join(root, relPath))))
  ).flat();

  const map = {};
  for (const absolutePath of allFiles) {
    const relativePath = path.relative(root, absolutePath).split(path.sep).join('/');
    if (!isScannableFile(relativePath)) continue;

    const content = await fs.readFile(absolutePath, 'utf8');
    let match;
    LAUNDERED_RPC.lastIndex = 0;
    while ((match = LAUNDERED_RPC.exec(content)) !== null) {
      const rpc = match[1];
      map[relativePath] = map[relativePath] || {};
      map[relativePath][rpc] = (map[relativePath][rpc] || 0) + 1;
    }
  }
  return sortMap(map);
}

const sortMap = (map) => {
  const out = {};
  for (const file of Object.keys(map).sort()) {
    out[file] = {};
    for (const rpc of Object.keys(map[file]).sort()) out[file][rpc] = map[file][rpc];
  }
  return out;
};

/**
 * Compare the actual scan against the allowlist snapshot.
 * Returns { additions, increases, stale } — each a list of {file, rpc, actual, allowed}.
 */
export function diffAgainstAllowlist(actual, allow) {
  const additions = [];
  const increases = [];
  const stale = [];

  for (const file of Object.keys(actual)) {
    for (const rpc of Object.keys(actual[file])) {
      const a = actual[file][rpc];
      const allowed = allow[file]?.[rpc] ?? 0;
      if (allowed === 0) additions.push({ file, rpc, actual: a, allowed: 0 });
      else if (a > allowed) increases.push({ file, rpc, actual: a, allowed });
    }
  }
  for (const file of Object.keys(allow)) {
    for (const rpc of Object.keys(allow[file])) {
      const allowed = allow[file][rpc];
      const a = actual[file]?.[rpc] ?? 0;
      if (a < allowed) stale.push({ file, rpc, actual: a, allowed });
    }
  }
  return { additions, increases, stale };
}

export async function run({ write = false, root = ROOT } = {}) {
  const actual = await scanTree(root);
  const allowlistAbs = path.join(root, ALLOWLIST_PATH);

  if (write) {
    await fs.writeFile(allowlistAbs, `${JSON.stringify(actual, null, 2)}\n`, 'utf8');
    const total = Object.values(actual).reduce(
      (sum, rpcs) => sum + Object.values(rpcs).reduce((s, n) => s + n, 0),
      0,
    );
    console.log(`Wrote ${ALLOWLIST_PATH} (${total} laundered site(s) across ${Object.keys(actual).length} file(s)).`);
    return { ok: true, written: true };
  }

  let allow = {};
  try {
    allow = JSON.parse(await fs.readFile(allowlistAbs, 'utf8'));
  } catch (error) {
    console.error(`RPC-typing guard: cannot read ${ALLOWLIST_PATH} (${error.message}).`);
    console.error('Generate it with: node scripts/check-rpc-typing.mjs --write');
    return { ok: false };
  }

  const { additions, increases, stale } = diffAgainstAllowlist(actual, allow);

  if (additions.length === 0 && increases.length === 0 && stale.length === 0) {
    console.log('RPC-typing guard passed (no new `rpc(... as never|any)` laundering).');
    return { ok: true };
  }

  if (additions.length > 0) {
    console.error('\nRPC-typing guard FAILED: new `rpc(<name> as never|any)` laundering.');
    console.error('Route the call through a typed boundary so `data` keeps its generated Returns');
    console.error('(see src/integrations/supabase/eventRpcs.ts). Do not add `as never`/`as any`.\n');
    for (const v of additions) console.error(`  + ${v.file}  ${v.rpc}  (x${v.actual})`);
  }
  if (increases.length > 0) {
    console.error('\nRPC-typing guard FAILED: more laundered calls than the allowlist permits.\n');
    for (const v of increases) console.error(`  ^ ${v.file}  ${v.rpc}  (${v.actual} > allowed ${v.allowed})`);
  }
  if (stale.length > 0) {
    console.error('\nRPC-typing guard FAILED: stale allowlist entries (a laundered call was removed — good!).');
    console.error('Shrink the allowlist to lock in the win:  node scripts/check-rpc-typing.mjs --write\n');
    for (const v of stale) console.error(`  - ${v.file}  ${v.rpc}  (${v.actual} < allowed ${v.allowed})`);
  }
  console.error('');
  return { ok: false };
}

// CLI entry — guarded so importing this module (e.g. from a test) does not run it.
// No shebang: a `#!/usr/bin/env node` first line makes the file unparseable when
// Vitest inlines it for an import (see #117 / wallClockBrandGate.test.ts).
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  run({ write: process.argv.includes('--write') })
    .then((result) => process.exit(result.ok ? 0 : 1))
    .catch((error) => {
      console.error('check-rpc-typing failed to run:', error);
      process.exit(1);
    });
}
