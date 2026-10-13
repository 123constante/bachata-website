import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The error reporter must never be first-load weight: every route budget in
 * perf-budgets.json was within 0.2 KB gz of its limit when it landed, and the
 * chunk ratchet counts requests. These pin the import shape that keeps it lazy.
 *
 * Source half (always runs): no file holds a VALUE import of the reporter, the
 * one dynamic import lives in the lazy loader, and the reporter imports nothing
 * (a shared static dep split lazyWithRetry / staleChunk into their own
 * first-load chunks while this was being built -- +1 request on every route).
 *
 * Build half (runs when build/client exists, as after `npm run build`): the
 * reporter is a dynamic entry and is in NO budgeted route's static closure.
 */
const ROOT = process.cwd();
const REPORTER = 'src/lib/clientErrorReporter.ts';
const LOADER = 'src/lib/reportClientErrorLazy.ts';

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === 'node_modules' || name === '__tests__') continue;
      out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(path.relative(ROOT, full).split(path.sep).join('/'));
    }
  }
  return out;
}

const REF_RE = /(?:^|\/|@\/lib\/|\.\/)clientErrorReporter['"]/;

type Edge = { file: string; kind: 'type' | 'static' | 'dynamic'; line: string };

/** Every import of the reporter in a source text (comments stripped first). */
function reporterEdges(file: string, text: string): Edge[] {
  const edges: Edge[] = [];
  const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const statements =
    code.match(/^\s*(?:import|export)\b[^;]*?\bfrom\s*['"][^'"]+['"]|\bimport\s*\(\s*['"][^'"]+['"]\s*\)/gm) ?? [];
  for (const raw of statements) {
    const st = raw.trim();
    if (!REF_RE.test(st)) continue;
    const line = st.replace(/\s+/g, ' ');
    if (/^import\s*\(/.test(st)) edges.push({ file, kind: 'dynamic', line });
    else if (/^(?:import|export)\s+type\b/.test(st)) edges.push({ file, kind: 'type', line });
    else edges.push({ file, kind: 'static', line });
  }
  return edges;
}

describe('error reporter stays off the first-load path (source graph)', () => {
  const files = [...sourceFiles(path.join(ROOT, 'src')), ...sourceFiles(path.join(ROOT, 'app'))];
  const edges = files.flatMap((f) => reporterEdges(f, readFileSync(path.join(ROOT, f), 'utf8')));

  it('finds the loader edge at all (the scan is not blind)', () => {
    expect(edges.some((e) => e.file === LOADER && e.kind === 'dynamic')).toBe(true);
  });

  it('no file imports the reporter statically (type-only imports are erased)', () => {
    expect(edges.filter((e) => e.kind === 'static')).toEqual([]);
  });

  it('the only dynamic import is the lazy loader', () => {
    expect(edges.filter((e) => e.kind === 'dynamic').map((e) => e.file)).toEqual([LOADER]);
  });

  it('the reporter itself imports nothing', () => {
    const text = readFileSync(path.join(ROOT, REPORTER), 'utf8').replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(text.match(/^\s*import\b.*$/gm) ?? []).toEqual([]);
    expect(text).not.toMatch(/\bimport\s*\(/);
  });

  it('entry.client does not reference it (its importer context split chunks)', () => {
    expect(readFileSync(path.join(ROOT, 'app/entry.client.tsx'), 'utf8')).not.toMatch(/clientErrorReporter|reportClientErrorLazy/);
  });

  it('the scanner itself catches a static import (mutation check)', () => {
    const mutant = 'import { reportClientError } from "@/lib/clientErrorReporter";\n';
    expect(reporterEdges('x.ts', mutant).map((e) => e.kind)).toEqual(['static']);
    expect(reporterEdges('x.ts', 'import type { ClientErrorKind } from "@/lib/clientErrorReporter";').map((e) => e.kind)).toEqual(['type']);
  });
});

const MANIFEST = path.join(ROOT, 'build/client/.vite/manifest.json');

describe.skipIf(!existsSync(MANIFEST))('error reporter stays off the first-load path (build manifest)', () => {
  type Node = { file: string; imports?: string[]; isDynamicEntry?: boolean };
  const manifest = existsSync(MANIFEST) ? (JSON.parse(readFileSync(MANIFEST, 'utf8')) as Record<string, Node>) : {};
  const budgets = JSON.parse(readFileSync(path.join(ROOT, 'perf-budgets.json'), 'utf8')) as {
    routes: Record<string, { entries: string[] }>;
  };
  const keyFor = (entry: string) =>
    manifest[entry] ? entry : Object.keys(manifest).find((k) => k.split('?')[0] === entry);

  it('is emitted as a dynamic entry', () => {
    expect(manifest[REPORTER]?.isDynamicEntry).toBe(true);
  });

  it.each(Object.keys(budgets.routes))('is not in the static first-load closure of %s', (route) => {
    const seen = new Set<string>();
    const walk = (k: string | undefined) => {
      if (!k || seen.has(k) || !manifest[k]) return;
      seen.add(k);
      for (const i of manifest[k].imports ?? []) walk(i);
    };
    for (const entry of budgets.routes[route].entries) walk(keyFor(entry));
    expect(seen.size).toBeGreaterThan(1);
    const reporterFile = manifest[REPORTER]?.file;
    expect([...seen].map((k) => manifest[k].file)).not.toContain(reporterFile);
  });
});
