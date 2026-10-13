// Static import CYCLES between the client build's chunks.
//
// WHY THIS EXISTS (2026-10-13, PR #746): the Vercel preview threw
// "TypeError: le is not a function" on load. `vendor-ui` statically imported
// `vendor-ui-modal` (Radix Tooltip >= 1.4 calls `useFocusScopeBranch` from
// @radix-ui/react-focus-scope, which vite.chunks.ts files in the MODAL list)
// while `vendor-ui-modal` already imported fifteen names back from
// `vendor-ui`. Two chunks importing each other is legal ESM, but evaluation
// order then depends on which one the entry reaches first, and Radix ships
// esbuild's keepNames helper (`var le=(e,t)=>defineProperty(e,"name",...)`)
// as a `var` at the top of each chunk. When the modal chunk ran first and
// called a hoisted function of vendor-ui at top level, that function called
// `le` before vendor-ui's `var le` had been assigned. Nothing else in CI could
// see it: the build succeeds, the KB budgets stay green, and the crash depends
// on load order, so a change elsewhere in the app can flip it on or off.
//
// THE RULE: no chunk in build/client/assets may sit on a static import cycle.
// Every cycle is reported, not only vendor-* ones -- the hazard is the same
// for any pair of chunks with top-level code -- and the vendor-* pairs are
// named first because vite.chunks.ts is the usual cause. The fix is never in
// the app code: make the dependency one-directional in vite.chunks.ts (move
// the package the shell reaches into VENDOR_UI_SHELL_PACKAGES), re-measure.
//
// WHAT IS PARSED: the emitted files themselves, because the files are what the
// browser evaluates. Static edges only -- `import ... from "./x.js"`,
// `import "./x.js"`, `export ... from "./x.js"`. A dynamic `import("./x.js")` is
// lazy and cannot form an evaluation cycle.
//
// THE FLOOR IS THE MANIFEST, not a count. build/client/.vite/manifest.json
// records every chunk's static `imports`, and for each chunk it lists, the
// parsed edge set must EQUAL the manifest's. A parser that has partly stopped
// matching the output (a new import shape, a subdirectory, .mjs) would drop
// exactly the back-edge that closes a cycle while thousands of vendor-react
// edges still parse; a bare "at least one edge" floor reads that as PASS.
// Disagreement is exit 2, never a verdict. Chunks on disk that the manifest
// does not list (React Router's manifest-*.js, the maplibre worker) cannot be
// cross-checked, and the PASS line NAMES them rather than counting them in. Why not read the manifest ALONE:
// it is Vite's record of what it meant to emit, and the bytes are the subject.
//
//   npm run build
//   npm run check:chunk-cycles
//   npm run check:chunk-cycles:self-test   # proves the rules, no build
//
// Exit 0 pass, 1 cycle found, 2 cannot measure: no build/client/assets, no
// manifest, no .js chunks on disk or in the manifest, zero parsed edges, or a
// parsed edge set that disagrees with the manifest. Each must never read as
// "no cycles".
//
// The crash this catches is "<minified helper> is not a function": the
// helper's letter changes from build to build (`le` on the #746 preview, `pe`
// in the sandbox reproduction), so search for the class, not the name.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { isEntryPoint } from './lib/entry-point.mjs';

const ASSETS_DIR = path.join('build', 'client', 'assets');
const MANIFEST = path.join('build', 'client', '.vite', 'manifest.json');

// `import{a as b}from"./x.js"`, `import*as m from"./x.js"`, `import d,{e}from
// "./x.js"`, `import"./x.js"`, `export{a}from"./x.js"`, `export*from"./x.js"`.
// The lookbehind keeps `foo.import` / `$import` / `ximport` out; the `(` a
// dynamic import needs is not in any alternative, so `import("./x.js")` is
// never an edge.
const STATIC_EDGE =
  /(?<![\w$.])(?:import|export)\s*(?:(?:\{[^}]*\}|\*\s*(?:as\s+[\w$]+)?|[\w$]+(?:\s*,\s*(?:\{[^}]*\}|\*\s*as\s+[\w$]+))?)\s*from\s*)?["']\.\/([^"']+?\.js)["']/g;

/** Static sibling-chunk specifiers in one emitted chunk, de-duplicated. */
export function parseStaticEdges(source) {
  const out = new Set();
  for (const m of source.matchAll(STATIC_EDGE)) out.add(m[1]);
  return [...out];
}

/**
 * Every strongly connected component of size > 1, plus self-loops (Tarjan).
 * Each is returned sorted, and the list is sorted, so the report is stable.
 */
export function findCycles(graph) {
  let index = 0;
  const idx = new Map();
  const low = new Map();
  const onStack = new Set();
  const stack = [];
  const sccs = [];
  const strong = (v) => {
    idx.set(v, index);
    low.set(v, index);
    index += 1;
    stack.push(v);
    onStack.add(v);
    for (const w of graph.get(v) ?? []) {
      if (!graph.has(w)) continue; // an edge to a file not in the set
      if (!idx.has(w)) {
        strong(w);
        low.set(v, Math.min(low.get(v), low.get(w)));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v), idx.get(w)));
      }
    }
    if (low.get(v) === idx.get(v)) {
      const scc = [];
      let w;
      do {
        w = stack.pop();
        onStack.delete(w);
        scc.push(w);
      } while (w !== v);
      const selfLoop = scc.length === 1 && (graph.get(v) ?? []).includes(v);
      if (scc.length > 1 || selfLoop) sccs.push(scc.sort());
    }
  };
  for (const v of [...graph.keys()].sort()) if (!idx.has(v)) strong(v);
  const isVendor = (scc) => scc.some((f) => f.startsWith('vendor-'));
  return sccs.sort((a, b) => Number(isVendor(b)) - Number(isVendor(a)) || a[0].localeCompare(b[0]));
}

/** The statement text of the static edge from `source` to `to`, for the report. */
export function edgeStatement(source, to) {
  for (const m of source.matchAll(STATIC_EDGE)) {
    if (m[1] === to) return m[0].length > 160 ? `${m[0].slice(0, 157)}...` : m[0];
  }
  return '(edge not found)';
}

/**
 * Manifest static imports as Map<chunk basename, basename[]>, from the parsed
 * manifest object. Only JS chunks; CSS is not an import edge.
 */
export function manifestEdges(manifest) {
  const out = new Map();
  for (const entry of Object.values(manifest)) {
    if (!entry?.file?.endsWith('.js')) continue;
    const to = (entry.imports ?? [])
      .map((k) => manifest[k]?.file)
      .filter((f) => f?.endsWith('.js'))
      .map((f) => path.basename(f));
    out.set(path.basename(entry.file), [...new Set(to)].sort());
  }
  return out;
}

/** Chunks whose parsed edges differ from the manifest's: [file, missing, extra]. */
export function edgeDisagreements(graph, fromManifest) {
  const out = [];
  for (const [file, want] of fromManifest) {
    if (!graph.has(file)) {
      out.push([file, ['(chunk file absent)'], []]);
      continue;
    }
    const got = graph.get(file);
    const missing = want.filter((f) => !got.includes(f));
    const extra = got.filter((f) => !want.includes(f));
    if (missing.length || extra.length) out.push([file, missing, extra]);
  }
  return out;
}

function defaultReadChunks() {
  if (!existsSync(ASSETS_DIR)) {
    throw Object.assign(new Error(`${ASSETS_DIR} does not exist -- run \`npm run build\` first.`), { infra: true });
  }
  const files = readdirSync(ASSETS_DIR).filter((f) => f.endsWith('.js'));
  return new Map(files.map((f) => [f, readFileSync(path.join(ASSETS_DIR, f), 'utf8')]));
}

function defaultReadManifest() {
  if (!existsSync(MANIFEST)) {
    throw new Error(`${MANIFEST} does not exist -- the client build emits it (vite.config.ts build.manifest).`);
  }
  return JSON.parse(readFileSync(MANIFEST, 'utf8'));
}

const KNOWN_FLAGS = ['--self-test'];

/**
 * THE EXIT OWNER. Its return value becomes process.exitCode, and the canary
 * drives THIS function, so the codes are measured rather than asserted (R5).
 */
export function main(argv = [], deps = {}) {
  const {
    readChunks = defaultReadChunks,
    readManifest = defaultReadManifest,
    log = console.log,
    logError = console.error,
  } = deps;
  const unknown = argv.filter((a) => a.startsWith('-') && !KNOWN_FLAGS.includes(a));
  if (unknown.length) {
    logError(`Unknown flag(s): ${unknown.join(', ')}. Known: ${KNOWN_FLAGS.join(', ')}`);
    return 1;
  }
  let chunks;
  let manifest;
  try {
    chunks = readChunks();
    manifest = readManifest();
  } catch (err) {
    logError(`check-chunk-cycles: cannot measure -- ${err.message}`);
    return 2;
  }
  if (chunks.size === 0) {
    logError('check-chunk-cycles: cannot measure -- the build emitted no .js chunks.');
    return 2;
  }
  const graph = new Map();
  let edges = 0;
  for (const [file, src] of chunks) {
    const to = parseStaticEdges(src).filter((t) => chunks.has(t));
    edges += to.length;
    graph.set(file, [...new Set(to)].sort());
  }
  // A cheap first floor before the real one (the manifest cross-check below):
  // a run that parsed ZERO edges cannot be a real build.
  if (edges === 0) {
    logError(
      `check-chunk-cycles: cannot measure -- ${chunks.size} chunks but 0 static ` +
        'import edges parsed. The emitted import syntax has changed; fix STATIC_EDGE.',
    );
    return 2;
  }
  const fromManifest = manifestEdges(manifest);
  if (fromManifest.size === 0) {
    logError('check-chunk-cycles: cannot measure -- the manifest lists no .js chunks to cross-check against.');
    return 2;
  }
  const disagree = edgeDisagreements(graph, fromManifest);
  if (disagree.length) {
    logError(
      `check-chunk-cycles: cannot measure -- the parsed edges disagree with ${MANIFEST} ` +
        `for ${disagree.length} chunk(s). MISSING edges mean STATIC_EDGE has stopped matching ` +
        'the emitted syntax (the parser is blind). EXTRA edges mean it matched text that is not ' +
        'an import (e.g. inside a string), or the manifest is stale against the files on disk ' +
        '(rebuild). A chunk marked absent is in the manifest but not in build/client/assets.',
    );
    for (const [file, missing, extra] of disagree.slice(0, 10)) {
      logError(`  - ${file}: missing [${missing.join(', ')}] extra [${extra.join(', ')}]`);
    }
    return 2;
  }
  const cycles = findCycles(graph);
  if (cycles.length === 0) {
    const unlisted = [...chunks.keys()].filter((f) => !fromManifest.has(f)).sort();
    log(
      `PASS check-chunk-cycles -- ${chunks.size} chunks, ${edges} static edges ` +
        `(equal to the manifest for all ${fromManifest.size} chunks it lists), no import cycle.` +
        (unlisted.length ? `\n  not in the manifest, edges parsed but not cross-checked: ${unlisted.join(', ')}` : ''),
    );
    return 0;
  }
  logError(`FAIL check-chunk-cycles -- ${cycles.length} static import cycle(s) between chunks:`);
  for (const scc of cycles) {
    logError(`  - ${scc.join(' <-> ')}`);
    for (const a of scc) {
      for (const b of graph.get(a)) {
        if (scc.includes(b)) logError(`      ${a} -> ${b}: ${edgeStatement(chunks.get(a), b)}`);
      }
    }
  }
  logError(
    '\nTwo chunks that import each other evaluate in whichever order the entry ' +
      'reaches them, so one of them runs top-level code against the other\'s ' +
      'still-unassigned `var`s ("TypeError: <minified helper> is not a function", PR #746).',
  );
  if (cycles.some((scc) => scc.every((f) => f.startsWith('vendor-')))) {
    logError(
      'A cycle made only of vendor-* chunks is a vite.chunks.ts problem, not an app-code one: ' +
        'make the dependency one-directional (the package the shell chunk reaches belongs in ' +
        'VENDOR_UI_SHELL_PACKAGES, not the modal list), then re-measure the budgets.',
    );
  }
  if (cycles.some((scc) => scc.some((f) => !f.startsWith('vendor-')))) {
    logError(
      'A cycle through an app chunk is usually two modules re-exporting each other, or a ' +
        'shared helper rollup placed in a route chunk: break the import loop in the source, ' +
        'or pin the shared module in vite.chunks.ts.',
    );
  }
  logError('See the header of scripts/check-chunk-cycles.mjs.');
  return 1;
}

function selfTest() {
  const cases = [];
  const add = (name, run, expected) => cases.push({ name, run, expected });

  // --- parser ---
  add('minified named import is an edge', () => parseStaticEdges('import{r as f,j as A}from"./vendor-react-X.js";'), ['vendor-react-X.js']);
  add('helper vars BEFORE the import still parse (esbuild prologue)', () => parseStaticEdges('var a=1;import{b as c}from"./vendor-ui-modal-B.js";'), ['vendor-ui-modal-B.js']);
  add('side-effect import is an edge', () => parseStaticEdges('import"./a.js";'), ['a.js']);
  add('namespace import is an edge', () => parseStaticEdges('import*as m from"./a.js";'), ['a.js']);
  add('default+named import is an edge', () => parseStaticEdges('import d,{e}from"./a.js";'), ['a.js']);
  add('re-export is an edge', () => parseStaticEdges('export{a as b}from"./a.js";export*from"./b.js";'), ['a.js', 'b.js']);
  add('dynamic import is NOT an edge', () => parseStaticEdges('const m=()=>import("./lazy.js");'), []);
  add('a property named import is NOT an edge', () => parseStaticEdges('x.import"./a.js"'), []);
  add('a non-relative specifier is NOT an edge', () => parseStaticEdges('import{a}from"react";'), []);
  add('duplicates collapse', () => parseStaticEdges('import"./a.js";import{b}from"./a.js";'), ['a.js']);

  // --- cycle finder ---
  const g = (o) => new Map(Object.entries(o));
  add('acyclic graph has no cycles', () => findCycles(g({ a: ['b'], b: ['c'], c: [] })), []);
  add('two chunks importing each other is a cycle', () => findCycles(g({ 'vendor-ui': ['vendor-ui-modal'], 'vendor-ui-modal': ['vendor-ui'] })), [['vendor-ui', 'vendor-ui-modal']]);
  add('a three-chunk loop is ONE cycle', () => findCycles(g({ a: ['b'], b: ['c'], c: ['a'] })), [['a', 'b', 'c']]);
  add('a self-import is a cycle', () => findCycles(g({ a: ['a'] })), [['a']]);
  add('vendor cycles are listed first', () => findCycles(g({ a: ['b'], b: ['a'], 'vendor-x': ['vendor-y'], 'vendor-y': ['vendor-x'] }))[0], ['vendor-x', 'vendor-y']);
  add('edgeStatement prints a namespace edge, not a zero count', () => edgeStatement('import*as m from"./a.js";', 'a.js'), 'import*as m from"./a.js"');
  add('edgeStatement prints a side-effect edge', () => edgeStatement('import"./a.js";', 'a.js'), 'import"./a.js"');

  // --- manifest cross-check ---
  const MF = {
    'app/entry.tsx': { file: 'assets/entry.js', imports: ['_r', '_s.css'] },
    _r: { file: 'assets/vendor-react-1.js' },
    '_s.css': { file: 'assets/s.css' },
  };
  add('manifestEdges maps keys to basenames and drops CSS', () => [...manifestEdges(MF)], [['entry.js', ['vendor-react-1.js']], ['vendor-react-1.js', []]]);
  add('agreement is no disagreement', () => edgeDisagreements(g({ 'entry.js': ['vendor-react-1.js'], 'vendor-react-1.js': [] }), manifestEdges(MF)), []);
  add('a dropped back-edge is a disagreement, named', () => edgeDisagreements(g({ 'entry.js': [], 'vendor-react-1.js': [] }), manifestEdges(MF)), [['entry.js', ['vendor-react-1.js'], []]]);
  add('an EXTRA parsed edge is a disagreement, named', () => edgeDisagreements(g({ 'entry.js': ['vendor-react-1.js'], 'vendor-react-1.js': ['entry.js'] }), manifestEdges(MF)), [['vendor-react-1.js', [], ['entry.js']]]);
  add('a manifest chunk absent on disk is a disagreement', () => edgeDisagreements(g({ 'entry.js': ['vendor-react-1.js'] }), manifestEdges(MF)), [['vendor-react-1.js', ['(chunk file absent)'], []]]);

  // --- THE EXIT-CODE CONTRACT ITSELF (main() drives process.exitCode) ---
  const run = (argv, deps) => {
    const lines = [];
    const code = main(argv, { log: (s) => lines.push(s), logError: (s) => lines.push(s), readManifest: () => manifestOf(deps.readChunks), ...deps });
    return { code, said: lines.join('\n') };
  };
  const codeAnd = (r, needle) => `${r.code}|${r.said.includes(needle) ? 'said' : 'SILENT<<' + r.said.slice(0, 160) + '>>'}`;
  const chunks = (o) => () => new Map(Object.entries(o));
  // A manifest that AGREES with the fixture chunks (derived from the parser),
  // so the main() cases below exercise the verdict, not the cross-check.
  const manifestOf = (read) => {
    let m;
    try {
      m = read();
    } catch {
      return {};
    }
    return Object.fromEntries(
      [...m].map(([f, src]) => [f, { file: `assets/${f}`, imports: parseStaticEdges(src).filter((t) => m.has(t)) }]),
    );
  };
  const OK = chunks({
    'entry.js': 'import{a}from"./vendor-react-1.js";import{b}from"./vendor-ui-1.js";',
    'vendor-react-1.js': 'export{x as a};',
    'vendor-ui-1.js': 'import{a}from"./vendor-react-1.js";',
    'vendor-ui-modal-1.js': 'import{a}from"./vendor-react-1.js";import{u,v}from"./vendor-ui-1.js";',
  });
  // The #746 shape: the shell chunk imports the modal chunk back.
  const CYCLE = chunks({
    'vendor-react-1.js': '',
    'vendor-ui-1.js': 'var Ao=Object.defineProperty,le=(e,t)=>Ao(e,"name",{value:t});import{At as u}from"./vendor-ui-modal-1.js";',
    'vendor-ui-modal-1.js': 'import{a}from"./vendor-react-1.js";import{u,v}from"./vendor-ui-1.js";',
  });
  add('PASS: one-directional vendor chunks -> 0', () => codeAnd(run([], { readChunks: OK }), 'no import cycle'), '0|said');
  add('FAIL: vendor-ui <-> vendor-ui-modal -> 1, named', () => codeAnd(run([], { readChunks: CYCLE }), 'vendor-ui-1.js <-> vendor-ui-modal-1.js'), '1|said');
  add('FAIL message points at vite.chunks.ts', () => codeAnd(run([], { readChunks: CYCLE }), 'VENDOR_UI_SHELL_PACKAGES'), '1|said');
  add('a dynamic back-edge is NOT a cycle -> 0', () => codeAnd(run([], { readChunks: chunks({ 'a.js': 'import"./b.js";', 'b.js': 'const l=()=>import("./a.js");' }) }), 'no import cycle'), '0|said');
  add('unknown flag -> 1', () => codeAnd(run(['--nope'], { readChunks: OK }), 'Unknown flag(s)'), '1|said');
  add('no build directory -> 2', () => codeAnd(run([], { readChunks: () => { throw new Error('build/client/assets does not exist'); } }), 'cannot measure'), '2|said');
  add('zero chunks -> 2', () => codeAnd(run([], { readChunks: chunks({}) }), 'no .js chunks'), '2|said');
  add('chunks but ZERO parsed edges -> 2, never a green', () => codeAnd(run([], { readChunks: chunks({ 'a.js': 'x', 'b.js': 'y' }) }), '0 static import edges'), '2|said');
  add('no manifest -> 2', () => codeAnd(run([], { readChunks: OK, readManifest: () => { throw new Error('manifest.json does not exist'); } }), 'cannot measure'), '2|said');
  add('a manifest with no JS chunks -> 2', () => codeAnd(run([], { readChunks: OK, readManifest: () => ({}) }), 'lists no .js chunks'), '2|said');
  // The partial-blindness case the floor exists for: the parser misses the
  // shell -> modal back-edge (here: the manifest knows an edge the bytes do
  // not show in a parseable form). It must be 2, not a PASS on a half graph.
  add('parser drops an edge the manifest has -> 2, never a PASS', () => {
    const read = OK;
    const m = manifestOf(read);
    m['vendor-ui-1.js'].imports.push('vendor-ui-modal-1.js');
    return codeAnd(run([], { readChunks: read, readManifest: () => m }), 'disagree with');
  }, '2|said');
  add('a chunk the manifest does not list is NAMED on PASS', () => {
    const m = manifestOf(OK);
    delete m['entry.js'];
    return codeAnd(run([], { readChunks: OK, readManifest: () => m }), 'not cross-checked: entry.js');
  }, '0|said');
  add('a vendor-only cycle names vite.chunks.ts', () => codeAnd(run([], { readChunks: CYCLE }), 'is a vite.chunks.ts problem'), '1|said');
  add('an app-chunk cycle does NOT forbid the app-code fix', () => codeAnd(run([], { readChunks: chunks({ 'r.js': 'import"./s.js";', 's.js': 'import"./r.js";' }) }), 'break the import loop in the source'), '1|said');

  let failed = 0;
  for (const c of cases) {
    let actual;
    try {
      actual = c.run();
    } catch (err) {
      actual = `THREW: ${err.message}`;
    }
    if (JSON.stringify(actual) !== JSON.stringify(c.expected)) {
      failed += 1;
      console.error(`FAIL ${c.name}\n  expected ${JSON.stringify(c.expected)}\n  actual   ${JSON.stringify(actual)}`);
    }
  }
  if (failed) {
    console.error(`FAIL self-test -- ${failed} of ${cases.length} case(s).`);
    return false;
  }
  console.log(`PASS self-test -- ${cases.length} cases; every exit code driven through main().`);
  return true;
}

// process.exitCode rather than process.exit(): exit() right after a large log
// truncates the pipe in Linux CI.
if (isEntryPoint(import.meta.url)) {
  const argv = process.argv.slice(2);
  process.exitCode = argv.includes('--self-test') ? (selfTest() ? 0 : 1) : main(argv);
}
