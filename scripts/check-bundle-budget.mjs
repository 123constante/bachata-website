#!/usr/bin/env node
// First-load JS budget guard + tracked-chunk attribution (perf programme,
// Pillar D -- "stays fast").
//
// Reads the CLIENT build manifest (build/client/.vite/manifest.json -- emitted
// because vite.config.ts sets build.manifest for the client build only), walks
// the STATIC import graph from each budgeted route's entry modules (dynamic
// imports are lazy-loaded, so they are not first-load bytes), gzips every
// reached JS chunk, and compares each route's total against the committed
// budgets in perf-budgets.json.
//
// Budgets are calibrated to measured post-Phase-1 reality plus ~10% headroom.
// If this trips, either a heavy dependency crept into the first-load graph
// (fix the import) or the growth is deliberate (raise the budget in the same
// PR and justify it in the PR description).
//
// ATTRIBUTION (report-only; added by P0 of the supabase-defer arc). A route
// total says a chunk is expensive; it never says WHO dragged it in. For the
// chunk named in perf-budgets.json `attribution.trackedChunkName` this also
// reports, per route: the count of first-load chunks holding a DIRECT static
// edge to it, a shortest path from a route entry to each, and -- from the
// sourcemap -- the first-party modules bundled INSIDE each puller. That count
// is the arc's work-list: it shrinks by one per phase, and 0 pullers (the
// tracked chunk drops out of the graph entirely) is the completion proof.
//
// A manifest node's `imports` array is DIRECT static edges, not a transitive
// preload closure -- verified at 138390a, do not re-derive: across all 192
// importing nodes of the client build, every declared import also appears as a
// specifier in the emitted chunk (0 phantoms). The check that looks like it
// disagrees is counting `from "./x.js"` occurrences: Rollup emits a
// side-effect-only edge as a bare `import"./x.js";` with no `from`, which is
// exactly how root.tsx and home.tsx hold vendor-supabase. Count those too
// before concluding an edge is phantom.
//
// The sourcemap names a puller chunk's CONTENTS, not the edge itself. A chunk
// listing four modules holds the import in one of them; which one needs a
// mappings decode, which this deliberately does not do. It is a shortlist that
// turns an opaque hash (_lazyWithRetry-CGot3tv9.js) into something greppable.
//
// MODULE-LEVEL EDGES (report-only; added after P4). The shortlist above is
// where chunk-level attribution stops, and that gap got filled by
// `grep -rl integrations/supabase/client` -- which answered "is this the last
// edge?" wrongly three times, twice about edges the arc plan had already
// recorded as out of scope. So this also walks the SOURCE import graph from the
// same route entries and names every MODULE holding a direct static edge to
// perf-budgets.json `attribution.trackedModule`. That list is the work-list a
// phase can act on: each row is an import to delete. grep cannot produce it,
// because the three misses were a barrel re-export, a provider three components
// deep, and a loader helper -- none of which name the target module.
//
// The module list is a CEILING and the puller count stays the truth: the walk
// counts a value-position import even when every binding happens to be a type
// (P4's `import { User, Session }` trap), because the syntax does not say
// whether TypeScript will elide it. The two numbers are also not comparable in
// size -- one counts chunks, the other modules. What they are good for is
// contradicting each other: tracked chunk IN a route's graph with an EMPTY
// module list is the walk having gone blind, and hard-fails.
//
// The two zero states are NOT the same and must never share a code path:
//   * tracked chunk present in the manifest, absent from a route's graph
//     -> 0 pullers, green. This is the goal.
//   * tracked chunk absent from the MANIFEST -> hard fail. The manualChunks
//     group was renamed or removed in vite.config.ts and the tracker went
//     blind while still printing a reassuring 0.
// A rule keyed on a name is only as durable as that name -- the same failure
// rule R1 of check-script-conventions.mjs exists to catch.
//
//   npm run build                            # the manifest is a build artifact
//   npm run check:bundle-budget
//   npm run check:bundle-budget:self-test    # proves the rules, needs no build
//
// Exit 1 if any route is over budget, or on a misconfiguration. The puller
// COUNT is report-only and never changes the exit code; a malformed attribution
// block is a misconfiguration and does. The bundle-budget job BLOCKS.

import { readFileSync, existsSync, statSync, appendFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const CLIENT_DIR = path.join(ROOT, 'build', 'client');
const MANIFEST_PATH = path.join(CLIENT_DIR, '.vite', 'manifest.json');
const BUDGETS_PATH = path.join(ROOT, 'perf-budgets.json');

// React Router's Vite plugin registers each route module under a querystring
// variant of its source path. perf-budgets.json lists plain source paths;
// resolve both forms here so the JSON stays readable.
const RR_ROUTE_SUFFIX = '?__react-router-build-client-route';

/** A contract violation, as opposed to a crash. Carried to the exit handler. */
class CheckFailure extends Error {}

const fail = (msg) => {
  throw new CheckFailure(msg);
};

// ---------------------------------------------------------------------------
// Graph. Pure -- every function takes its manifest, so the canary drives them
// with fixtures instead of a 226-node build artifact.
// ---------------------------------------------------------------------------

export function resolveKey(manifest, entry) {
  if (manifest[entry]) return entry;
  const rrKey = `${entry}${RR_ROUTE_SUFFIX}`;
  if (manifest[rrKey]) return rrKey;
  const near = Object.keys(manifest).filter((k) =>
    k.includes(path.posix.basename(entry)),
  );
  fail(
    `perf-budgets.json entry "${entry}" is not in the client manifest. ` +
      'Was the file renamed/moved? Update perf-budgets.json to match.' +
      (near.length ? `\n  Near-matches: ${near.join(', ')}` : ''),
  );
}

/**
 * Manifest nodes reachable from `entries` via STATIC imports, plus the parent
 * link that first reached each one. Breadth-first, so those links describe a
 * SHORTEST path -- a depth-first walk would report a true but needlessly long
 * chain and make the work-list read as bigger than it is.
 */
export function reachableWithPaths(manifest, entries) {
  const parent = new Map();
  const seen = new Set();
  const queue = entries.map((e) => resolveKey(manifest, e));
  for (const key of queue) if (!parent.has(key)) parent.set(key, null);

  let head = 0;
  while (head < queue.length) {
    const key = queue[head++];
    if (seen.has(key)) continue;
    seen.add(key);
    for (const imp of manifest[key].imports ?? []) {
      if (!manifest[imp]) {
        fail(
          `manifest node "${key}" imports "${imp}", which the manifest does not ` +
            'define. The build artifact is inconsistent; re-run `npm run build`.',
        );
      }
      if (!parent.has(imp)) parent.set(imp, key);
      queue.push(imp);
    }
  }
  return { seen, parent };
}

/** Shortest chain from a route entry to `key`, per the BFS parent links. */
export function pathTo(parent, key) {
  const chain = [];
  let cur = key;
  while (cur !== undefined && cur !== null) {
    chain.unshift(cur);
    cur = parent.get(cur);
  }
  return chain;
}

/**
 * The one manifest node whose chunk name is `name`. Loud on zero (the group was
 * renamed away, so this tracker is measuring nothing) and loud on more than one
 * (ambiguous, so a count would silently pick a side).
 */
export function resolveTrackedKey(manifest, name) {
  const matches = Object.keys(manifest).filter((k) => manifest[k].name === name);
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) {
    fail(
      `attribution.trackedChunkName "${name}" matches no chunk in the client ` +
        'manifest. This is a MISCONFIGURATION, not a success: the manualChunks ' +
        'group in vite.config.ts was renamed or removed, so the attribution ' +
        'count would read 0 for every route while measuring nothing. A tracked ' +
        "chunk that merely left a route's first-load graph is reported as " +
        '0 pullers with the chunk still present in the manifest -- that is the ' +
        'goal state, and it reaches this script by a different path.',
    );
  }
  fail(
    `attribution.trackedChunkName "${name}" is ambiguous -- ${matches.length} ` +
      `manifest nodes carry it: ${matches.join(', ')}.`,
  );
}

/** Reachable nodes holding a DIRECT static edge to the tracked chunk. */
export function findPullers(manifest, seen, trackedKey) {
  return [...seen]
    .filter((k) => k !== trackedKey && (manifest[k].imports ?? []).includes(trackedKey))
    .sort();
}

// ---------------------------------------------------------------------------
// REQUIRED first-load edges -- the inverse rule (supabase-defer arc, P5).
//
// Every other rule in this file asks whether weight has stayed OUT of a route's
// first-load graph. This one asks whether a module has stayed IN, because on
// the auth path the deferral this arc exists to create is a BUG: client.ts sets
// `detectSessionInUrl: true`, so auth-js parses the magic-link fragment at
// CONSTRUCTION. Construct it lazily on /auth/callback and the parse moves after
// the router mounts; if anything rewrites the URL first the session is lost and
// the user is told their link expired. Eager construction there is a
// correctness requirement wearing a bundling costume.
//
// It is asserted at CHUNK level, deliberately, and not with the module walk
// below. The walk is a documented CEILING -- it counts an import whose bindings
// are all types -- and for a rule phrased as "this edge must still exist", a
// ceiling fails in the one direction that must never happen: it would keep
// reporting the edge after the real one had gone, i.e. a silent green over a
// lost session. The manifest graph is the build-level ground truth and cannot
// over-report.
//
// A module with no manifest node of its own hard-fails rather than being read
// as absent. That state means the chunking changed under this rule (the module
// was inlined into a parent), which a human must look at -- it is NOT evidence
// the edge went away, and quietly treating it as a regression would send the
// reader hunting for a deleted import that still exists.
// ---------------------------------------------------------------------------

/**
 * Required edges that are NOT satisfied, as printable rows. Pure: takes its
 * manifest and its config, so the canary drives it without a build.
 *
 * Returns [] when every requirement holds. Anything non-empty is a hard fail --
 * unlike the attribution above, this rule sets the exit code.
 */
/**
 * The requiredFirstLoad block must EXIST and be non-empty.
 *
 * Without this, `budgets.requiredFirstLoad ?? []` turned a deleted key -- or a
 * rename, or a merge conflict dropping it -- into a vacuous green: no rows
 * checked, "None declared." in the step summary, exit 0, and the eager client
 * edge free to disappear with magic links breaking in production and nothing
 * saying so. That is exactly the silent-skip shape rule R1 of
 * check-script-conventions.mjs names, and every sibling block in this file
 * (assertRoutesDeclared, assertAttribution, assertMeasured) is already defended
 * against it. This was the one exception, guarding the one failure that is
 * invisible from the outside.
 */
export function assertRequiredDeclared(required) {
  if (!Array.isArray(required) || required.length === 0) {
    fail(
      'perf-budgets.json declares no requiredFirstLoad edges. This guard exists ' +
        'because the auth path must keep constructing the Supabase client EAGERLY ' +
        '(detectSessionInUrl parses the magic-link fragment at construction), and ' +
        'an empty block would report success while checking nothing. If the rule ' +
        'is genuinely obsolete, delete this assert in the same PR and say why.',
    );
  }
}

export function findMissingRequiredEdges(manifest, required, routes) {
  const rows = [];
  for (const { route, module, why } of required) {
    const declared = routes[route];
    if (!declared) {
      fail(
        `requiredFirstLoad names the route "${route}", which is not declared in ` +
          'perf-budgets.json `routes`. The rule has no entry modules to walk from, ' +
          'so it would silently check nothing. Add the route or fix the name.',
      );
    }
    if (!manifest[module]) {
      fail(
        `requiredFirstLoad requires "${module}" in the first-load graph of ` +
          `"${route}", but that module has no node of its own in the client ` +
          'manifest. It was most likely inlined into a parent chunk by a chunking ' +
          'change. That is NOT the same as the edge being gone, so this is a ' +
          'hard failure asking for a human, not a regression report.',
      );
    }
    const { seen } = reachableWithPaths(manifest, declared.entries);
    if (!seen.has(module)) rows.push({ route, module, why });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Sourcemap module naming
// ---------------------------------------------------------------------------

// Vite writes POSIX separators, but a map produced by another tool may not.
// Built via fromCharCode rather than written literally: this repo is edited
// over a FUSE mount whose heredoc transport collapses a doubled backslash to
// one, which would silently change what this class matches. See CLAUDE.md,
// file-write safety.
const BACKSLASH = String.fromCharCode(92);
// Trims a query suffix rather than rejecting the source outright. Vite spells
// an asset or route module as `src/brand/logo.png?url` or
// `app/root.tsx?__react-router-build-client-route`, and an anchored [^?]+$
// cannot match any of them at any offset -- so the module silently left the
// contents shortlist instead of being named. Character classes stand in for
// escaped slashes for the same mount reason as BACKSLASH above.
const FIRST_PARTY = /(?:^|[/])((?:src|app)[/][^?]+?)(?:[?]|$)/;

/** First-party modules bundled INTO a chunk, read off its sourcemap sources. */
export function sourceModulesFromMap(map) {
  const found = new Set();
  for (const raw of map?.sources ?? []) {
    const norm = String(raw).split(BACKSLASH).join('/');
    if (norm.includes('node_modules/')) continue;
    const hit = FIRST_PARTY.exec(norm);
    if (hit) found.add(hit[1]);
  }
  return [...found].sort();
}

const NODE_MODULE = /node_modules\/((?:@[^/]+\/)?[^/]+)\//;

/**
 * npm packages bundled INTO a chunk. The fallback for a puller with no
 * first-party sources at all -- "no first-party modules" is true but useless,
 * whereas the package list says what the chunk actually is.
 */
export function packagesFromMap(map) {
  const found = new Set();
  for (const raw of map?.sources ?? []) {
    const hit = NODE_MODULE.exec(String(raw).split(BACKSLASH).join('/'));
    if (hit) found.add(hit[1]);
  }
  return [...found].sort();
}

/**
 * Long lists are capped, and the cap SAYS how many it dropped. A silent
 * truncation reads as "that is all of them", which is how a bounded report
 * turns into a wrong one.
 */
export function capped(items, limit = 12) {
  if (items.length <= limit) return items.join(', ');
  return `${items.slice(0, limit).join(', ')} (+${items.length - limit} more)`;
}

/** One line describing what a puller chunk holds. */
export function describeContents({ modules, packages, note }) {
  if (note) return note;
  if (modules.length) return capped(modules);
  if (packages.length) return `vendor only -- ${capped(packages)}`;
  return 'no named sources';
}

/**
 * vite.config.ts sets sourcemap: "hidden", so every chunk has a .map beside it.
 * A missing or unreadable one is reported inline rather than swallowed -- but
 * it cannot change a verdict, because attribution is report-only.
 */
const contentsCache = new Map();
function readChunkContents(chunkFile) {
  // Cached for the same reason gzipBytes is: root and the shared chunks are
  // pullers on EVERY route, and a route-module sourcemap runs to megabytes.
  if (contentsCache.has(chunkFile)) return contentsCache.get(chunkFile);

  const mapPath = path.join(CLIENT_DIR, `${chunkFile}.map`);
  let result;
  if (!existsSync(mapPath)) {
    result = { modules: [], packages: [], note: 'no sourcemap beside this chunk' };
  } else {
    try {
      const map = JSON.parse(readFileSync(mapPath, 'utf8'));
      result = { modules: sourceModulesFromMap(map), packages: packagesFromMap(map), note: null };
    } catch (err) {
      result = { modules: [], packages: [], note: `sourcemap unreadable -- ${err.message}` };
    }
  }
  contentsCache.set(chunkFile, result);
  return result;
}

// ---------------------------------------------------------------------------
// Module graph.
//
// WHY THIS EXISTS. Everything above reports PULLER CHUNKS. A chunk name says
// weight is here; it never says which import to delete, so "is this the last
// edge?" got answered by `grep -rl integrations/supabase/client` instead -- and
// that answer was wrong three times running, twice about edges the arc had
// already written down as out of scope (searchClickTelemetry as "search-only",
// resolvePublicEventRef as "detail-loader-only"; both sit on home's first-load
// path through root.tsx's SearchProvider and home.tsx's detailLoader). grep
// finds direct importers of a string. It cannot follow a barrel re-export, a
// provider three components deep, or a loader helper, which is exactly where
// all three misses lived. This walks the SOURCE import graph from the same
// route entries and names every MODULE holding a direct static edge to the
// tracked module.
//
// A CEILING, NOT THE TRUTH. The walk counts a value-position import even when
// every binding it names happens to be a type: that is precisely the edge P4's
// `import { User, Session }` trap describes, and whether TypeScript elides it
// is not decidable from the syntax. So this list can be LONGER than the real
// edge set, never shorter. The puller count above stays the build-level ground
// truth, and the two are printed together on purpose -- the pairing is itself a
// check. Tracked chunk IN a route's graph with an EMPTY module list means the
// walk went blind (an alias it cannot resolve, an extension it does not try),
// and that hard-fails rather than printing the reassuring 0 that started this.
//
// Report-only in the other direction, deliberately: the module COUNT never sets
// the exit code. Turning it into a ratchet is P6's job, and a guard that starts
// enforcing on the same PR that starts measuring has no baseline to enforce
// against.
// ---------------------------------------------------------------------------

// A trailing `?url` / `?raw` / `?worker` is Vite asking for a different
// REPRESENTATION of a module, not a different module. Left on, every asset
// import resolves to nothing and reads as a hole in the walk.
export function stripQuery(spec) {
  const q = spec.indexOf('?');
  return q === -1 ? spec : spec.slice(0, q);
}

// Only these two forms can name a first-party module. A bare specifier is
// node_modules, which cannot hold a first-party edge and is not a hole.
export function isFirstPartySpec(spec) {
  return spec.startsWith('@/') || spec.startsWith('.');
}

// STATIC forms only:
//   import x from 'm' / import {a} from 'm' / import * as x from 'm'
//   import def, {a} from 'm' / import type {T} from 'm'
//   export {a} from 'm' / export * from 'm' / export * as ns from 'm'
//   import 'm'                                  (side-effect only)
//
// The clause between the keyword and `from` is matched as an import CLAUSE
// GRAMMAR, not as "any run of text ending at the next from". The permissive
// version spanned whole statements: an `export type Foo = { ... }` with no
// trailing semicolon, sitting above a real import, let the match open at
// `export`, close at that import's `from`, and read the whole thing as
// type-only -- silently dropping a live edge AND its entire subtree, with
// nothing landing in `unresolved` to say so. Undercounting is the one direction
// this walk must never fail in, so the clause may only be the shapes above.
//
// A leading block comment is allowed before the keyword: `/* c */ import x from
// 'm'` is an ordinary edge, and requiring `[ \t]*` after the newline dropped it.
//
// KNOWN OVER-REPORT, accepted rather than fixed: an import commented OUT with a
// block comment still matches. Removing it needs a stateful comment stripper,
// and a stripper that mistakes a regex literal's stray quote for a string
// swallows real code after it -- trading a visible over-report for a silent
// undercount, which is the wrong trade for this guard. It surfaces as a
// work-list row that cannot be deleted, so check whether the line is commented
// out before believing it. The BLIND message names this case too.
//
// `import(` is excluded by the negative lookahead: a dynamic import is the lazy
// edge this whole arc is trying to create, so counting it would make every
// converted call site look unconverted.
const FROM_IMPORT =
  /(?:^|[;}\n])[ \t]*(?:[/][*][\s\S]*?[*][/][ \t]*)*(import|export)\b(?!\s*\()((?:\s+type\b)?\s*(?:[A-Za-z_$][\w$]*\s*,\s*)?(?:\*(?:\s*as\s+[A-Za-z_$][\w$]*)?|\{[^{}]*\}|[A-Za-z_$][\w$]*)\s*)from\s*['"]([^'"]+)['"]/g;
const BARE_IMPORT =
  /(?:^|[;}\n])[ \t]*(?:[/][*][\s\S]*?[*][/][ \t]*)*import\s+['"]([^'"]+)['"]/g;

// What this parser can speak. Anything else reached by an import (a stylesheet,
// an asset) is a leaf: real in the graph, but it holds no further edges.
const PARSEABLE = /[.](?:ts|tsx|js|jsx|mjs|cjs)$/;

// A UTF-8 BOM occupies index 0, so `^` can no longer reach the first statement
// and the file's FIRST import disappears -- and because the statement never
// matches at all, nothing lands in `unresolved` and the BLIND guard cannot
// fire. 18 files in this repo carry a BOM (PowerShell writes them; loadArcState
// carries its own test for the same thing), two of them inside the walked
// graph. Built via fromCharCode for the same mount reason as BACKSLASH above.
const BOM = String.fromCharCode(0xfeff);

/** Static specifiers in one module's source, with statement-level type-ness. */
export function parseStaticSpecifiers(source) {
  const src = source.charCodeAt(0) === 0xfeff ? source.slice(BOM.length) : source;
  const out = [];
  for (const m of src.matchAll(FROM_IMPORT)) {
    // `import type {A} from` and `export type {A} from` are erased before the
    // bundler sees them. `import {type A, B} from` is NOT: it is a value
    // import whose bindings happen to be types, and it keeps the edge open.
    out.push({ spec: m[3], typeOnly: /^\s*type\b/.test(m[2]) });
  }
  for (const m of src.matchAll(BARE_IMPORT)) {
    out.push({ spec: m[1], typeOnly: false });
  }
  return out;
}

/**
 * Modules reachable from `entries` via STATIC imports, breadth-first, with the
 * parent link that first reached each -- so `pathTo` reports a SHORTEST chain,
 * for the same reason reachableWithPaths does it at chunk level.
 *
 * `readSource` and `resolveSpec` are injected rather than reaching for `fs`,
 * so every rule below is fixture-drivable in the canary.
 */
export function walkModuleGraph({ entries, readSource, resolveSpec }) {
  const parent = new Map();
  const edges = new Map();
  const seen = new Set();
  const unresolved = [];
  const queue = [...entries];
  for (const e of entries) parent.set(e, null);

  // PARSED, not seen. `seen` is the visited-set and grows before the file is
  // read, so counting it let three unreadable entries still score 3 and the
  // measured-anything floor below could never fire for a real route.
  let parsed = 0;
  let head = 0;
  while (head < queue.length) {
    const file = queue[head++];
    if (seen.has(file)) continue;
    seen.add(file);

    // A .css or .png reached by an asset import is a real graph node and a real
    // dead end -- reading it as UTF-8 and regex-scanning it finds nothing, but a
    // binary read is not free and not honest about what this parser handles.
    if (!PARSEABLE.test(file)) continue;

    const source = readSource(file);
    if (source === null) {
      // Named by its PARENT, not blamed on perf-budgets.json: only a root of
      // the walk is an entry, and sending the reader to the config for a
      // mid-graph read failure costs them the actual file.
      unresolved.push({ from: parent.get(file) ?? '(entry)', spec: file });
      continue;
    }
    parsed++;

    for (const { spec, typeOnly } of parseStaticSpecifiers(source)) {
      if (typeOnly) continue;
      const bare = stripQuery(spec);
      const resolved = resolveSpec(bare, file);
      if (resolved === null) {
        // A first-party specifier that resolves to nothing is a HOLE: the walk
        // silently stops following a real edge. A bare specifier is not.
        if (isFirstPartySpec(bare)) unresolved.push({ from: file, spec: bare });
        continue;
      }
      if (!edges.has(file)) edges.set(file, new Set());
      edges.get(file).add(resolved);
      if (!parent.has(resolved)) parent.set(resolved, file);
      queue.push(resolved);
    }
  }
  return { seen, parsed, parent, edges, unresolved };
}

// The one alias this repo has: `@` -> ./src, declared identically in
// vite.config.ts `resolve.alias` and tsconfig.json `paths`. Read from neither
// on purpose -- parsing a TS config to learn one mapping trades a hole the
// canary can prove (a specifier that resolves to nothing is counted and
// reported) for one it cannot.
const ALIAS_PREFIX = '@/';
// Vite's own order. `''` first so an explicit `./x.css` or `./x.png` resolves
// as itself rather than falling through to a same-named `.ts`.
const SOURCE_EXTS = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '/index.ts', '/index.tsx', '/index.js'];

const toPosix = (p) => p.split(path.sep).join('/');

/**
 * Filesystem-backed specifier resolution, repo-relative POSIX in and out.
 * Filesystem-bound, so -- like readChunkContents -- it is NOT canary-covered;
 * the rules it feeds are, because walkModuleGraph takes it as an argument.
 */
export function makeFsResolver(root) {
  return (spec, fromFile) => {
    let base;
    if (spec.startsWith(ALIAS_PREFIX)) {
      base = path.join(root, 'src', spec.slice(ALIAS_PREFIX.length));
    } else if (spec.startsWith('.')) {
      base = path.resolve(path.dirname(path.join(root, fromFile)), spec);
    } else {
      return null; // bare specifier -- node_modules, not a first-party edge
    }
    for (const ext of SOURCE_EXTS) {
      const candidate = base + ext;
      // isFile, not merely exists: `@/lib/seo` names a DIRECTORY, and treating
      // it as the module would stop the walk one step before the barrel
      // re-export that actually holds the edge.
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        return toPosix(path.relative(root, candidate));
      }
    }
    return null;
  };
}

/** Repo-relative source text, or null when the file cannot be read. */
export function makeFsReader(root) {
  return (file) => {
    try {
      return readFileSync(path.join(root, file), 'utf8');
    } catch {
      return null;
    }
  };
}

/** Walked modules holding a DIRECT static edge to `trackedModule`. */
export function findModuleEdges(edges, trackedModule) {
  return [...edges]
    .filter(([from, tos]) => from !== trackedModule && tos.has(trackedModule))
    .map(([from]) => from)
    .sort();
}

// ---------------------------------------------------------------------------
// Sizing
// ---------------------------------------------------------------------------

const gzCache = new Map();
function gzipBytes(file) {
  if (!gzCache.has(file)) {
    let bytes;
    try {
      bytes = readFileSync(path.join(CLIENT_DIR, file));
    } catch (err) {
      // Same class as the dangling-import branch in reachableWithPaths, and it
      // earns the same diagnosis rather than a raw ENOENT stack: the manifest
      // names a file this build did not write.
      fail(
        `the manifest lists "${file}", which is not on disk (${err.code ?? err.message}). ` +
          'The build artifact is inconsistent; re-run `npm run build`.',
      );
    }
    gzCache.set(file, gzipSync(bytes).length);
  }
  return gzCache.get(file);
}

const kb = (bytes) => bytes / 1024;
const fmtKB = (bytes) => `${kb(bytes).toFixed(1)} KB`;
// Rounds BEFORE testing the sign, so a delta of -0.04 KB prints "0.0" rather
// than "-0.0" -- a minus sign on an unchanged number reads as a win.
const signed = (n, digits) => {
  const rounded = Number(n.toFixed(digits));
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(digits)}`;
};

// ---------------------------------------------------------------------------
// Measured-anything floors. A guard that measures NOTHING must not report
// "budgets respected" -- the silent-green failure mode rule R1 of
// check-script-conventions.mjs exists to catch, named after the assertMeasured()
// in scripts/lib/previewProbe.mjs that R1's docstring cites as the convention.
// Pure and exported so the canary can drive both directions from fixtures.
// ---------------------------------------------------------------------------

/** perf-budgets.json must declare at least one route to enforce. */
export function assertRoutesDeclared(routes) {
  const names = Object.keys(routes ?? {});
  if (!names.length) {
    fail(
      'perf-budgets.json declares no routes under `routes`, so this guard would ' +
        'enforce nothing while still printing "All first-load JS budgets ' +
        'respected." Restore the route budgets, or retire this check in a PR ' +
        'that says why.',
    );
  }
  return names;
}

/** A budgeted route must resolve to at least one first-load JS chunk. */
export function assertMeasured(route, files) {
  if (!files.length) {
    fail(
      `route "${route}" measured NOTHING -- its entries resolved to zero ` +
        'first-load JS chunks, so its budget is vacuous and would pass whatever ' +
        'the bundle weighs. Fix `entries` in perf-budgets.json.',
    );
  }
  return files.length;
}

/** The attribution block is a committed part of this guard, not an extra. */
export function assertAttribution(budgets) {
  const attribution = budgets?.attribution;
  if (!attribution || !attribution.trackedChunkName) {
    fail(
      'perf-budgets.json has no attribution.trackedChunkName. Attribution is a ' +
        'committed part of this guard, not an optional extra -- dropping the key ' +
        'would switch the arc work-list off silently. Restore it, or remove the ' +
        'attribution block deliberately in a PR that says why.',
    );
  }
  return attribution;
}

/**
 * The module walk needs a target, and it is NOT the tracked chunk: a chunk is a
 * build artifact with no import statement to delete. This names the first-party
 * module that leads into it -- for vendor-supabase, the generated client.
 */
export function assertTrackedModule(attribution) {
  const target = attribution?.trackedModule;
  if (typeof target !== 'string' || !target) {
    fail(
      'perf-budgets.json has no attribution.trackedModule. The module-level edge ' +
        'report needs a first-party module to walk TO -- the tracked CHUNK cannot ' +
        'serve, because no import statement names a chunk. Restore it, or remove ' +
        'the module report deliberately in a PR that says why.',
    );
  }
  return target;
}

/**
 * Alias keys declared in vite.config.ts `resolve.alias`, or null if that block
 * is not in the shape this can read.
 */
export function aliasKeysFrom(viteSource) {
  const block = /alias\s*:\s*\{([^{}]*)\}/.exec(viteSource);
  if (!block) return null;
  return [...block[1].matchAll(/["']?([\w@~$./-]+)["']?\s*:/g)].map((m) => m[1]).sort();
}

/**
 * makeFsResolver knows exactly one alias, and isFirstPartySpec decides what
 * counts as a HOLE from the same one-alias assumption -- so a second alias
 * would not merely go unresolved, it would be classified as node_modules and
 * every import through it would leave the walk with nothing recorded. That is
 * the reassuring 0 this whole report exists to stop, arriving by a route the
 * BLIND guard cannot see. A comment asserting "the one alias this repo has" is
 * not a check; this is.
 */
export function assertKnownAliases(keys) {
  if (keys === null) {
    fail(
      'vite.config.ts has no `resolve.alias` block this guard can read. The ' +
        'module walk resolves `@/` on the strength of that block, so an ' +
        'unreadable one means its resolution rules are unverified. Restore the ' +
        'block, or teach aliasKeysFrom the new shape.',
    );
  }
  const unknown = keys.filter((k) => k !== '@');
  if (unknown.length) {
    fail(
      `vite.config.ts declares alias(es) this guard does not resolve: ${unknown.join(', ')}. ` +
        'Every import through them would vanish from the module walk WITHOUT ' +
        'being recorded as a hole -- isFirstPartySpec would read them as ' +
        'node_modules. Teach makeFsResolver and isFirstPartySpec the new alias ' +
        'before adding it.',
    );
  }
  return keys;
}

/**
 * The module walk's own measured-anything floor, in three distinct failures
 * because they send the reader to three different files.
 *
 * The third is the one this whole report exists for. "Tracked chunk is in the
 * route's first-load graph, and the source walk found nothing holding it there"
 * is not a clean bill of health -- it is the walk having gone blind while
 * printing a 0 that reads exactly like the goal state. That silent green, from
 * a grep rather than a walk, is what put three wrong edge-lists into this arc.
 */
export function assertModuleWalkSaw(route, { trackedInGraph, walked, edgeCount, unresolved }) {
  if (walked < 2) {
    fail(
      `route "${route}": the module walk saw NOTHING -- ${walked} module(s) from ` +
        'its entries. perf-budgets.json `entries` must name real source files ' +
        '(they are shared with the chunk-level walk, so check that first).',
    );
  }
  if (unresolved?.length) {
    const shown = unresolved.slice(0, 8).map((u) => `${u.spec} (from ${u.from})`);
    fail(
      `route "${route}": the module walk is BLIND -- ${unresolved.length} ` +
        'first-party specifier(s) resolved to no file on disk, so the walk stopped ' +
        'following real edges and its count is an undercount:\n    ' +
        shown.join('\n    ') +
        (unresolved.length > 8 ? `\n    (+${unresolved.length - 8} more)` : '') +
        '\n  Check the line first: an import commented OUT with a block comment ' +
        'still matches (a known over-report of the parser), and that is not a ' +
        'resolver bug. Otherwise teach makeFsResolver the alias or extension -- ' +
        'do not lower the bar.',
    );
  }
  if (trackedInGraph && edgeCount === 0) {
    fail(
      `route "${route}": the tracked chunk IS in the first-load graph, yet the ` +
        'module walk found no module holding a static edge to the tracked module. ' +
        'Those two cannot both be true: either the walk is not reaching the code ' +
        'that holds the edge, or the edge enters through node_modules and this ' +
        'report cannot see it. A 0 here reads identically to the goal state, so ' +
        'it fails rather than being believed.',
    );
  }
  return edgeCount;
}

/**
 * A baseline row must carry every number the delta line prints. A missing field
 * renders as "NaN", which reads like a measurement rather than a hole in the
 * baseline -- so it is a misconfiguration, not a report-only nicety.
 */
export function assertBaselineRow(route, base) {
  for (const field of ['firstLoadGzipKB', 'chunks', 'pullers']) {
    if (typeof base[field] !== 'number' || Number.isNaN(base[field])) {
      fail(
        `attribution.baseline.routes["${route}"].${field} must be a number ` +
          `(got ${JSON.stringify(base[field])}). The delta line would print "NaN" ` +
          'and read as a measured result.',
      );
    }
  }
  return base;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  if (!existsSync(MANIFEST_PATH)) {
    fail(
      `No client manifest at ${path.relative(ROOT, MANIFEST_PATH)}. ` +
        'Run `npm run build` first (vite.config.ts emits the manifest for the client build).',
    );
  }

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  const budgets = JSON.parse(readFileSync(BUDGETS_PATH, 'utf8'));

  const attribution = assertAttribution(budgets);

  const trackedName = attribution.trackedChunkName;
  const trackedModule = assertTrackedModule(attribution);
  if (!existsSync(path.join(ROOT, trackedModule))) {
    fail(
      `attribution.trackedModule "${trackedModule}" is not a file in this repo. ` +
        'The module-level edge report would walk to a target nothing can import ' +
        'and print 0 edges for every route -- which reads as the goal state. ' +
        'Point it at the module that leads into the tracked chunk.',
    );
  }
  const VITE_CONFIG = path.join(ROOT, 'vite.config.ts');
  if (!existsSync(VITE_CONFIG)) {
    fail(
      'vite.config.ts is missing, so the module walk cannot confirm that `@/` is ' +
        'still the only alias its resolver has to know.',
    );
  }
  assertKnownAliases(aliasKeysFrom(readFileSync(VITE_CONFIG, 'utf8')));
  const readSource = makeFsReader(ROOT);
  const resolveSpec = makeFsResolver(ROOT);
  const trackedKey = resolveTrackedKey(manifest, trackedName);
  const trackedGz = gzipBytes(manifest[trackedKey].file);
  const baseRoutes = attribution.baseline?.routes ?? {};
  const baseCommit = attribution.baseline?.commit ?? 'none recorded';
  const baseTrackedKB = attribution.baseline?.trackedChunkGzipKB;

  console.log('');
  console.log(
    `tracked chunk "${trackedName}" -> ${manifest[trackedKey].file} (${fmtKB(trackedGz)} gz)`,
  );
  // The tracked chunk's OWN weight is DIFFED, not merely recorded beside a live
  // number. A @supabase minor that grows it is precisely the regression
  // .github/dependabot.yml's carve-out leans on this job to name.
  if (typeof baseTrackedKB === 'number') {
    console.log(
      `  vs baseline: ${baseTrackedKB} KB -> ${signed(kb(trackedGz) - baseTrackedKB, 1)} KB`,
    );
  }
  console.log(`baseline commit: ${baseCommit}`);

  let anyOver = false;
  const budgetRows = [
    '## First-load JS budgets',
    '',
    '| Route | First-load JS (gzip) | Budget | Status |',
    '|---|---|---|---|',
  ];
  const attrRows = [
    '',
    `## First-load pullers of \`${trackedName}\` (${fmtKB(trackedGz)} gz)`,
    '',
    '| Route | Pullers now | Baseline | Puller chunks |',
    '|---|---|---|---|',
  ];
  const moduleRows = [
    '',
    `## Modules holding a static edge to \`${trackedModule}\``,
    '',
    'Source-level ceiling, report-only. This is the work-list: each row is an',
    'import to delete, not a chunk to look at.',
    '',
    '| Route | Edge modules | Modules walked | Which |',
    '|---|---|---|---|',
  ];

  assertRoutesDeclared(budgets.routes);

  for (const [route, { entries, maxFirstLoadGzipKB }] of Object.entries(budgets.routes)) {
    const { seen, parent } = reachableWithPaths(manifest, entries);
    const files = [...new Set([...seen].map((k) => manifest[k].file))].filter((f) =>
      f.endsWith('.js'),
    );
    assertMeasured(route, files);
    const sized = files
      .map((f) => ({ file: f, bytes: gzipBytes(f) }))
      .sort((a, b) => b.bytes - a.bytes);
    const total = sized.reduce((sum, s) => sum + s.bytes, 0);
    const over = kb(total) > maxFirstLoadGzipKB;
    anyOver ||= over;

    const status = over ? 'OVER BUDGET' : 'ok';
    console.log('');
    console.log(
      `[${status}] ${route}: ${fmtKB(total)} first-load JS across ${sized.length} files ` +
        `(budget ${maxFirstLoadGzipKB} KB)`,
    );
    console.log('  largest chunks:');
    for (const { file, bytes } of sized.slice(0, 10)) {
      console.log(`    ${fmtKB(bytes).padStart(9)}  ${file}`);
    }

    const pullers = findPullers(manifest, seen, trackedKey);
    const inGraph = seen.has(trackedKey);
    const base = baseRoutes[route];

    console.log(
      `  ${trackedName}: ${
        inGraph ? `IN first load (${fmtKB(trackedGz)} gz)` : 'NOT in first load'
      } -- ${pullers.length} direct puller(s)`,
    );
    if (!base) {
      // Said out loud, not skipped: a budgeted route with no baseline row
      // accrues weight against no reference, and silence there reads as "no
      // change since the baseline" rather than "never compared".
      console.log(
        `  vs baseline ${baseCommit}: NO baseline row for "${route}" -- nothing to ` +
          'compare against. Add one to attribution.baseline.routes in perf-budgets.json.',
      );
    } else {
      assertBaselineRow(route, base);
      console.log(
        `  vs baseline ${baseCommit}: ${base.firstLoadGzipKB} KB / ${base.chunks} chunk(s) / ` +
          `${base.pullers} puller(s) -> ${signed(kb(total) - base.firstLoadGzipKB, 1)} KB, ` +
          `${signed(sized.length - base.chunks, 0)} chunk(s), ` +
          `${signed(pullers.length - base.pullers, 0)} puller(s)`,
      );
    }
    for (const puller of pullers) {
      console.log(`    ${puller}`);
      console.log(`      via: ${pathTo(parent, puller).join(' > ')}`);
      console.log(`      contains: ${describeContents(readChunkContents(manifest[puller].file))}`);
    }

    // The chunk count above says WHERE the weight is; this says WHICH import to
    // delete. Both are printed, and the counts are NOT comparable -- one counts
    // chunks, the other modules, so a bigger module number is not a regression
    // against a smaller puller number.
    const walk = walkModuleGraph({ entries, readSource, resolveSpec });
    const moduleEdges = findModuleEdges(walk.edges, trackedModule);
    assertModuleWalkSaw(route, {
      trackedInGraph: inGraph,
      walked: walk.parsed,
      edgeCount: moduleEdges.length,
      unresolved: walk.unresolved,
    });
    console.log(
      `  static module edges to ${trackedModule}: ${moduleEdges.length} module(s) ` +
        `(${walk.parsed} module(s) parsed; source-level ceiling, see header)`,
    );
    for (const mod of moduleEdges) {
      console.log(`    ${mod}`);
      console.log(`      via: ${pathTo(walk.parent, mod).join(' > ')}`);
    }
    moduleRows.push(
      `| ${route} | ${moduleEdges.length} | ${walk.parsed} | ${
        moduleEdges.join('<br>') || '--'
      } |`,
    );

    budgetRows.push(
      `| ${route} | ${fmtKB(total)} (${sized.length} files) | ${maxFirstLoadGzipKB} KB | ${
        over ? 'OVER' : 'ok'
      } |`,
    );
    attrRows.push(
      `| ${route} | ${pullers.length}${inGraph ? '' : ' (chunk not in first load)'} | ${
        base ? base.pullers : 'n/a'
      } | ${pullers.join('<br>') || '--'} |`,
    );
  }

  // REQUIRED edges (P5). Evaluated after the per-route loop so its output sits
  // beside the budget table, but it is an independent verdict: a route can be
  // comfortably under budget and still have lost the edge that keeps OAuth
  // working, which is precisely the regression this exists to catch.
  const required = budgets.requiredFirstLoad;
  assertRequiredDeclared(required);
  const missing = findMissingRequiredEdges(manifest, required, budgets.routes);
  const requiredRows = ['', '## Required first-load edges', '', '| Route | Module | Status |', '|---|---|---|'];
  console.log('');
  for (const { route, module } of required) {
    const gone = missing.some((r) => r.route === route && r.module === module);
    requiredRows.push(`| ${route} | \`${module}\` | ${gone ? '**MISSING**' : 'present'} |`);
    console.log(`[${gone ? 'MISSING' : 'ok'}] required edge: ${module} in ${route}`);
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      [...budgetRows, ...attrRows, ...moduleRows, ...requiredRows].join('\n') + '\n',
    );
  }

  if (missing.length) {
    console.error('');
    for (const { route, module, why } of missing) {
      console.error(
        `REQUIRED FIRST-LOAD EDGE LOST: "${module}" is no longer in the ` +
          `first-load graph of "${route}".\n  Why it is required: ${why}\n` +
          '  This is not a size regression -- it is a CORRECTNESS one, and it fails ' +
          'silently in production. A user who clicks a valid magic link is told the ' +
          'link expired.\n  The edge is held by src/integrations/supabase/eagerAuthClient.ts, ' +
          'imported by app/routes/catchall.tsx. Restore it rather than deleting this ' +
          'rule; if the auth pages genuinely moved off the catchall, repoint the ' +
          "route's entries here in the same PR.",
      );
    }
  }

  // BOTH verdicts, then one exit. Returning early on a lost edge suppressed the
  // budget message entirely, so a PR that broke both got told about one, fixed
  // it, rebuilt (minutes), and only then heard about the other.
  if (anyOver) {
    console.error(
      '\nOne or more routes exceed their first-load JS budget (perf-budgets.json). ' +
        'Either remove the weight from the static import graph or raise the budget ' +
        'deliberately in this PR with justification.',
    );
  }
  if (missing.length || anyOver) {
    return 1;
  }
  console.log('');
  console.log('All first-load JS budgets respected.');
  return 0;
}

// ---------------------------------------------------------------------------
// Canary (rule R4 of check-script-conventions.mjs -- a guard with no proof it
// can fail is not a guard). Every PURE rule is proved in BOTH directions
// against fixtures, so it needs no build -- which is why perf-budget.yml runs
// it BEFORE the build step, where it still reports when the build is the thing
// that broke. Two branches are filesystem-bound (no client manifest at all; a
// manifest entry missing from disk) and are deliberately NOT covered here.
// That workflow triggers on pushes to main/master and PRs targeting them, so
// this is not literally every push.
// ---------------------------------------------------------------------------

function selfTest() {
  const cases = [];
  const add = (name, run, expected) => cases.push({ name, run, expected });

  // WHICH failure, not merely that one happened. Asserting "it throws" let a
  // mutant survive that deleted the renamed-chunk branch entirely: control fell
  // through to the ambiguous branch, so the guard still went red -- while
  // telling the reader 0 nodes were "ambiguous". A guard that fails for a
  // reason it cannot name sends whoever is on the other end to the wrong file.
  //
  // ONE classifier, not two. A weaker "did it throw" helper beside this one is
  // exactly the assertion that let that mutant live; keeping both on hand
  // invites the next case to reach for the weaker one.
  const KINDS = [
    ['is not in the client manifest', 'unknown-entry'],
    ['matches no chunk', 'misconfiguration'],
    ['is ambiguous', 'ambiguous'],
    ['does not define', 'inconsistent-build'],
    ['declares no routes', 'no-routes'],
    ['measured NOTHING', 'nothing-measured'],
    ['must be a number', 'bad-baseline'],
    ['no attribution.trackedChunkName', 'no-attribution'],
    ['no attribution.trackedModule', 'no-tracked-module'],
    ['saw NOTHING', 'walk-saw-nothing'],
    ['is BLIND', 'walk-blind'],
    ['no module holding', 'walk-found-no-edge'],
    ['no `resolve.alias` block', 'alias-block'],
    ['this guard does not resolve', 'unknown-alias'],
    ['declares no requiredFirstLoad', 'no-required-edges'],
    ['which is not declared in', 'required-unknown-route'],
    ['has no node of its own', 'required-module-not-chunked'],
  ];
  const failureKind = (run) => {
    try {
      run();
      return 'no-throw';
    } catch (err) {
      if (!(err instanceof CheckFailure)) return `wrong-error: ${err.message}`;
      for (const [needle, kind] of KINDS) if (err.message.includes(needle)) return kind;
      return 'unclassified';
    }
  };

  const TRACKED = '_vendor-supabase.js';
  // root -> shared -> tracked, and root -> tracked directly: two pullers.
  // clean reaches the tracked chunk ONLY through a dynamic import, so it must
  // contribute neither bytes nor pullers.
  // _omega is deliberately reachable two ways of DIFFERENT length --
  // root>_shared>_omega (3 nodes) and root>_alpha>_mid>_omega (4) -- so the
  // shortest-path case below can actually fail under a depth-first walk.
  const M = {
    'app/root.tsx?__react-router-build-client-route': {
      file: 'assets/root.js',
      imports: ['_shared.js', TRACKED, '_alpha.js'],
    },
    '_shared.js': {
      file: 'assets/shared.js',
      name: 'shared',
      imports: [TRACKED, '_omega.js'],
    },
    '_alpha.js': { file: 'assets/alpha.js', name: 'alpha', imports: ['_mid.js'] },
    '_mid.js': { file: 'assets/mid.js', name: 'mid', imports: ['_omega.js'] },
    '_omega.js': { file: 'assets/omega.js', name: 'omega' },
    '_deep.js': { file: 'assets/deep.js', name: 'deep', imports: ['_shared.js'] },
    [TRACKED]: { file: 'assets/vendor-supabase.js', name: 'vendor-supabase' },
    'app/routes/clean.tsx?__react-router-build-client-route': {
      file: 'assets/clean.js',
      imports: [],
      dynamicImports: ['_shared.js'],
    },
  };
  const ROOT_ENTRY = 'app/root.tsx';
  const CLEAN_ENTRY = 'app/routes/clean.tsx';
  const from = (entry) => reachableWithPaths(M, [entry]);

  // --- resolveKey: the React Router querystring form, both directions ---
  add(
    'resolveKey resolves a plain path to its RR route key',
    () => resolveKey(M, ROOT_ENTRY),
    'app/root.tsx?__react-router-build-client-route',
  );
  add(
    'resolveKey fires on an entry the manifest does not have',
    () => failureKind(() => resolveKey(M, 'app/routes/ghost.tsx')),
    'unknown-entry',
  );

  // --- reachableWithPaths: an inconsistent build is diagnosed, not crashed on ---
  add(
    'an import the manifest does not define fails AS an inconsistent build',
    () =>
      failureKind(() =>
        reachableWithPaths(
          { 'a.js': { file: 'assets/a.js', imports: ['ghost.js'] } },
          ['a.js'],
        ),
      ),
    'inconsistent-build',
  );
  add(
    'a fully-defined graph does not trip the inconsistent-build rule',
    () => failureKind(() => reachableWithPaths(M, [ROOT_ENTRY])),
    'no-throw',
  );

  // --- findPullers: both directions ---
  add(
    'pullers found when static edges exist',
    () => findPullers(M, from(ROOT_ENTRY).seen, TRACKED).length,
    2,
  );
  add(
    'zero pullers when the only edge is a DYNAMIC import',
    () => findPullers(M, from(CLEAN_ENTRY).seen, TRACKED).length,
    0,
  );
  add(
    'a dynamic-only import keeps the tracked chunk out of the graph',
    () => from(CLEAN_ENTRY).seen.has(TRACKED),
    false,
  );
  add(
    'a transitively-reached chunk with no direct edge is not a puller',
    () => findPullers(M, new Set(['_deep.js']), TRACKED).length,
    0,
  );
  add(
    'the tracked chunk never counts itself',
    () => findPullers(M, new Set([TRACKED]), TRACKED).length,
    0,
  );

  // --- resolveTrackedKey: the two zero states must not share a path ---
  add(
    'a renamed or removed manualChunks group fails AS a misconfiguration',
    () => failureKind(() => resolveTrackedKey(M, 'vendor-supabase-renamed')),
    'misconfiguration',
  );
  add(
    'an ambiguous chunk name fails AS an ambiguity, not as a misconfiguration',
    () =>
      failureKind(() =>
        resolveTrackedKey(
          { a: { file: 'a.js', name: 'dup' }, b: { file: 'b.js', name: 'dup' } },
          'dup',
        ),
      ),
    'ambiguous',
  );
  add(
    'a chunk present in the manifest but outside a route graph is NOT a failure',
    () =>
      failureKind(() =>
        findPullers(M, from(CLEAN_ENTRY).seen, resolveTrackedKey(M, 'vendor-supabase')),
      ),
    'no-throw',
  );

  // --- measured-anything floors: a guard measuring nothing must not go green ---
  add(
    'a route resolving to zero JS chunks fails rather than passing vacuously',
    () => failureKind(() => assertMeasured('home (/city/:slug)', [])),
    'nothing-measured',
  );
  add(
    'a route that measured chunks is silent',
    () => failureKind(() => assertMeasured('home (/city/:slug)', ['assets/root.js'])),
    'no-throw',
  );
  add(
    'an empty or renamed `routes` object fails rather than enforcing nothing',
    () => failureKind(() => assertRoutesDeclared({})),
    'no-routes',
  );
  add(
    'a populated `routes` object is silent',
    () => failureKind(() => assertRoutesDeclared({ 'home (/city/:slug)': {} })),
    'no-throw',
  );
  add(
    'a missing attribution block fails AS a missing attribution block',
    () => failureKind(() => assertAttribution({ routes: {} })),
    'no-attribution',
  );
  add(
    'a present attribution block is silent',
    () => failureKind(() => assertAttribution({ attribution: { trackedChunkName: 'x' } })),
    'no-throw',
  );

  // --- assertBaselineRow: a hole in the baseline must not render as "NaN" ---
  add(
    'a baseline row missing `pullers` fails instead of printing NaN',
    () => failureKind(() => assertBaselineRow('home', { firstLoadGzipKB: 244.2, chunks: 61 })),
    'bad-baseline',
  );
  add(
    'a complete baseline row is silent',
    () =>
      failureKind(() =>
        assertBaselineRow('home', { firstLoadGzipKB: 244.2, chunks: 61, pullers: 3 }),
      ),
    'no-throw',
  );

  // --- pathTo: shortest, not merely valid ---
  // _omega is reachable at two DIFFERENT depths: root>_shared>_omega (3) and
  // root>_alpha>_mid>_omega (4). The fixture this replaced asserted on a node
  // reachable at one depth only, so it scored 2 under the BFS and 2 under the
  // depth-first walk the BFS replaced -- it could not fail, and so proved
  // nothing. Swap `queue[head++]` for `queue.pop()` and this case goes red.
  add(
    'the reported path is the SHORTEST one, not the deepest',
    () => pathTo(from(ROOT_ENTRY).parent, '_omega.js').length,
    3,
  );

  // --- sourceModulesFromMap: both directions ---
  add(
    'sourcemap sources name first-party modules',
    () =>
      sourceModulesFromMap({
        sources: [
          '../../../node_modules/lucide-react/dist/esm/shared/src/utils.js',
          '../../../src/integrations/supabase/client.ts',
          '../../../src/lib/lazyWithRetry.ts',
        ],
      }).join(','),
    'src/integrations/supabase/client.ts,src/lib/lazyWithRetry.ts',
  );
  add(
    'a vendor-only chunk names nothing rather than guessing',
    () => sourceModulesFromMap({ sources: ['../../../node_modules/react-dom/index.js'] }).length,
    0,
  );
  add('a map with no sources is empty, not a crash', () => sourceModulesFromMap({}).length, 0);

  // --- findMissingRequiredEdges: the INVERSE rule, proved in BOTH directions ---
  //
  // The direction that matters is the SECOND one. A required-edge rule that
  // cannot go red is worse than no rule: it reports "present" forever while the
  // OAuth fragment parse quietly moves after the router mounts. So the removal
  // case here is not a nicety -- it is the whole rule.
  const REQ_M = {
    'app/routes/catchall.tsx?__react-router-build-client-route': {
      file: 'assets/catchall.js',
      imports: ['src/integrations/supabase/client.ts'],
    },
    'src/integrations/supabase/client.ts': { file: 'assets/client.js', name: 'client' },
    'app/routes/lean.tsx?__react-router-build-client-route': {
      file: 'assets/lean.js',
      imports: [],
      // Reaching it dynamically is exactly the deferral that breaks OAuth, so
      // it must NOT satisfy the requirement.
      dynamicImports: ['src/integrations/supabase/client.ts'],
    },
  };
  const REQ_ROUTES = {
    auth: { entries: ['app/routes/catchall.tsx'], maxFirstLoadGzipKB: 310 },
    lean: { entries: ['app/routes/lean.tsx'], maxFirstLoadGzipKB: 310 },
  };
  const REQ = (route) => [
    { route, module: 'src/integrations/supabase/client.ts', why: 'detectSessionInUrl' },
  ];
  add(
    'a present required edge reports nothing',
    () => findMissingRequiredEdges(REQ_M, REQ('auth'), REQ_ROUTES).length,
    0,
  );
  add(
    'a required edge reached only DYNAMICALLY is reported missing',
    () => findMissingRequiredEdges(REQ_M, REQ('lean'), REQ_ROUTES)[0]?.route,
    'lean',
  );
  add(
    'a required edge whose module left the graph entirely is reported missing',
    () =>
      findMissingRequiredEdges(
        { ...REQ_M, 'app/routes/catchall.tsx?__react-router-build-client-route': {
          file: 'assets/catchall.js', imports: [] } },
        REQ('auth'),
        REQ_ROUTES,
      ).length,
    1,
  );
  // The silent-skip direction. A deleted or renamed requiredFirstLoad key must
  // fail, not report a reassuring "None declared." and exit 0.
  add(
    'a missing requiredFirstLoad block fails rather than checking nothing',
    () => failureKind(() => assertRequiredDeclared(undefined)),
    'no-required-edges',
  );
  add(
    'an EMPTY requiredFirstLoad block fails the same way',
    () => failureKind(() => assertRequiredDeclared([])),
    'no-required-edges',
  );
  add(
    'a populated requiredFirstLoad block is silent',
    () => failureKind(() => assertRequiredDeclared(REQ('auth'))),
    'no-throw',
  );
  add(
    'a requirement naming an undeclared route fails loudly rather than checking nothing',
    () => failureKind(() => findMissingRequiredEdges(REQ_M, REQ('ghost'), REQ_ROUTES)),
    'required-unknown-route',
  );
  add(
    'a required module with no manifest node of its own asks for a human',
    () =>
      failureKind(() =>
        findMissingRequiredEdges(
          { 'app/routes/catchall.tsx?__react-router-build-client-route': {
            file: 'assets/catchall.js', imports: [] } },
          REQ('auth'),
          REQ_ROUTES,
        ),
      ),
    'required-module-not-chunked',
  );

  // --- packagesFromMap / describeContents: the vendor-only fallback ---
  add(
    'a vendor-only chunk is described by its packages, not dismissed',
    () =>
      describeContents({
        modules: [],
        packages: packagesFromMap({
          sources: [
            '../../../node_modules/@radix-ui/react-focus-scope/dist/index.mjs',
            '../../../node_modules/react-remove-scroll/dist/es2015/UI.js',
            '../../../node_modules/react-remove-scroll/dist/es2015/medium.js',
          ],
        }),
        note: null,
      }),
    'vendor only -- @radix-ui/react-focus-scope, react-remove-scroll',
  );
  add(
    'first-party modules win over the package fallback',
    () => describeContents({ modules: ['src/a.ts'], packages: ['react'], note: null }),
    'src/a.ts',
  );
  add(
    'an unreadable sourcemap is reported, never rendered as an empty chunk',
    () => describeContents({ modules: [], packages: [], note: 'sourcemap unreadable -- x' }),
    'sourcemap unreadable -- x',
  );

  // --- capped: both directions, and the cap must SAY what it dropped ---
  add('a short list is printed whole', () => capped(['a', 'b'], 3), 'a, b');
  add(
    'a long list names how many it dropped',
    () => capped(['a', 'b', 'c', 'd'], 2),
    'a, b (+2 more)',
  );

  // --- parseStaticSpecifiers: what counts as an edge, in both directions ---
  const specsOf = (src) => parseStaticSpecifiers(src).map((s) => s.spec).join(',');

  add(
    'every static form is counted: default, named, namespace, export-from, bare',
    () =>
      specsOf(
        [
          "import def from 'm1';",
          "import { a } from 'm2';",
          "import * as ns from 'm3';",
          "export { b } from 'm4';",
          "export * from 'm5';",
          "import 'm6';",
        ].join('\n'),
      ),
    'm1,m2,m3,m4,m5,m6',
  );
  add(
    'a wrapped named import spanning lines is still one edge',
    () => specsOf("import {\n  a,\n  b,\n} from 'm';"),
    'm',
  );
  add(
    'a statement-level `import type` is erased before the bundler and is skipped',
    () => parseStaticSpecifiers("import type { T } from 'm';")[0].typeOnly,
    true,
  );
  add('`export type ... from` is skipped too', () => parseStaticSpecifiers("export type { T } from 'm';")[0].typeOnly, true);
  // THE P4 TRAP, asserted deliberately. `import { User, Session }` from
  // @supabase/supabase-js is a VALUE import whose bindings happen to be types.
  // It reads like a type import and holds the module edge open anyway -- P4
  // exists because that one line kept 43.3 KB in home's first load.
  add(
    'a value-position import of types-only bindings is NOT treated as type-only',
    () => parseStaticSpecifiers("import { User, Session } from '@supabase/supabase-js';")[0].typeOnly,
    false,
  );
  add(
    'an inline `type` modifier does not make the statement type-only',
    () => parseStaticSpecifiers("import { type A, B } from 'm';")[0].typeOnly,
    false,
  );
  add(
    'a dynamic import is NOT an edge -- it is the lazy shape this arc creates',
    () => specsOf("const p = import('m1');\nawait import('m2');"),
    '',
  );
  add(
    'a bare import does not swallow the next statement',
    () => specsOf("import './side';\nconst x = 1;\nimport { a } from 'later';"),
    'later,./side',
  );
  // The `;` bound in the clause character class, and the ONLY case that proves
  // it. A type ALIAS above an import is ordinary code; without that bound the
  // lazy match spans from `export` across the `;` to the next `from`, the
  // clause then starts with `type`, and a live value import is classified
  // type-only and dropped. That is the one direction this walk must never
  // fail in -- an undercount reads as "fewer edges left" and that is the exact
  // wrong answer this whole report exists to stop giving. Delete the `;` from
  // the class and every other case here still passes.
  add(
    'a type ALIAS above an import does not make that import read as type-only',
    () => parseStaticSpecifiers("export type Foo = 1;\nimport { B } from 'm';")[0].typeOnly,
    false,
  );
  add('a module with no imports has no edges', () => parseStaticSpecifiers('export const a = 1;').length, 0);
  // Every case below is a defect found in review of this PR, pinned so it
  // cannot come back. Each one silently DROPPED an edge and its whole subtree.
  add(
    'a UTF-8 BOM does not eat the first import',
    () => specsOf(String.fromCharCode(0xfeff) + "import { A } from 'm';"),
    'm',
  );
  // The semicolon-less sibling of the type-alias case above. A clause bounded
  // only by `;` still spans this one, which is why the clause is now matched as
  // a grammar rather than as any-text-up-to-from.
  add(
    'a brace-terminated type alias with NO semicolon does not swallow the next import',
    () => {
      const got = parseStaticSpecifiers("export type Foo = {\n  a: string\n}\nimport { B } from './m';");
      return `${got.length}:${got[0].spec}:${got[0].typeOnly}`;
    },
    "1:./m:false",
  );
  add(
    'an apostrophe in a comment inside a wrapped import list does not drop the edge',
    () => specsOf("import {\n  a, // don't use b\n  c,\n} from './m';"),
    './m',
  );
  add(
    'a block comment before the keyword does not drop the edge',
    () => specsOf("/* hi */ import { B } from './m';"),
    './m',
  );
  // The ACCEPTED over-report, asserted so it stays a decision. Fixing it needs a
  // stateful comment stripper, which trades this visible extra row for a silent
  // undercount whenever a regex literal carries a stray quote.
  add(
    'an import commented OUT with a block comment is still counted (known ceiling)',
    () => specsOf("/*\nimport { a } from './dead';\n*/\nimport { b } from './live';"),
    './dead,./live',
  );
  add(
    'star and mixed-default clauses are counted',
    () => specsOf("export * from 'm';\nexport * as ns from 'n';\nimport d, { x } from 'o';"),
    'm,n,o',
  );
  add(
    'an identifier merely STARTING with type is not a type import',
    () => parseStaticSpecifiers("import typeahead from 'm';")[0].typeOnly,
    false,
  );

  // --- stripQuery / isFirstPartySpec ---
  add('a Vite query suffix names the same module', () => stripQuery('@/a.png?url'), '@/a.png');
  add('a specifier without a query is untouched', () => stripQuery('@/a'), '@/a');
  add('an alias specifier is first-party', () => isFirstPartySpec('@/lib/x'), true);
  add('a relative specifier is first-party', () => isFirstPartySpec('./x'), true);
  add('a bare specifier is node_modules, not a hole', () => isFirstPartySpec('react'), false);

  // --- walkModuleGraph, on fixtures ---
  // root reaches tracked at TWO depths: root>a>tracked (3) and
  // root>mid>deep>tracked (4), so the shortest-path case can actually fail.
  const SRC = {
    'app/root.tsx': [
      "import { A } from '@/a';",
      "import { M } from '@/mid';",
      "import type { T } from '@/typeonly';",
      "import '@/side';",
      "const lazy = () => import('@/lazyonly');",
    ].join('\n'),
    'src/a.ts': "import { C } from '@/tracked';",
    'src/mid.ts': "import { D } from '@/deep';",
    'src/deep.ts': "import { C } from '@/tracked';",
    'src/side.ts': 'export const S = 1;',
    'src/typeonly.ts': 'export type T = 1;',
    'src/lazyonly.ts': "import { C } from '@/tracked';",
    'src/tracked.ts': 'export const C = 1;',
  };
  const TRACKED_MODULE = 'src/tracked.ts';
  const fixtureReader = (f) => SRC[f] ?? null;
  const fixtureResolver = (spec) => {
    if (!spec.startsWith('@/')) return null;
    const file = `src/${spec.slice(2)}.ts`;
    return file in SRC ? file : null;
  };
  const walked = () =>
    walkModuleGraph({
      entries: ['app/root.tsx'],
      readSource: fixtureReader,
      resolveSpec: fixtureResolver,
    });

  add('the walk follows static edges transitively', () => walked().seen.has(TRACKED_MODULE), true);
  add(
    'the reported module path is the SHORTEST one, not the deepest',
    () => pathTo(walked().parent, TRACKED_MODULE).length,
    3,
  );
  add(
    'a module reached only by a DYNAMIC import is never walked',
    () => walked().seen.has('src/lazyonly.ts'),
    false,
  );
  add('a type-only import is not followed', () => walked().seen.has('src/typeonly.ts'), false);
  add('a bare side-effect import IS followed', () => walked().seen.has('src/side.ts'), true);
  add('a clean walk records no holes', () => walked().unresolved.length, 0);
  add(
    'a first-party specifier resolving to nothing is recorded as a hole',
    () =>
      walkModuleGraph({
        entries: ['app/root.tsx'],
        readSource: () => "import { G } from '@/ghost';\nimport React from 'react';",
        resolveSpec: () => null,
      }).unresolved.length,
    1,
  );

  // A non-source leaf (stylesheet, asset) is a real graph node with no edges:
  // seen, never parsed. Counting `seen` instead let three unreadable entries
  // score 3 and made the measured-anything floor unfireable for a real route.
  const leafWalk = () =>
    walkModuleGraph({
      entries: ['a.ts'],
      readSource: (f) => (f === 'a.ts' ? "import './s.css';\nimport { b } from './b';" : null),
      resolveSpec: (s) => (s === './s.css' ? 's.css' : s === './b' ? 'b.ts' : null),
    });
  add('a stylesheet leaf is seen but not parsed', () => `${leafWalk().parsed}/${leafWalk().seen.size}`, '1/3');
  add(
    'an unreadable module is blamed on its PARENT, not on perf-budgets.json',
    () => leafWalk().unresolved.map((u) => `${u.spec}<-${u.from}`).join(','),
    'b.ts<-a.ts',
  );

  // --- aliasKeysFrom / assertKnownAliases: the one-alias assumption is CHECKED ---
  add(
    'the single declared alias is read off vite.config.ts',
    () => (aliasKeysFrom('resolve: {\n  alias: {\n    "@": path.resolve(__dirname, "./src"),\n  },\n},') || []).join(','),
    '@',
  );
  add(
    'a second alias is read too, rather than quietly ignored',
    () => (aliasKeysFrom("alias: { '@': a, '~': b }") || []).join(','),
    '@,~',
  );
  add('an unreadable alias block is null, not an empty list', () => aliasKeysFrom('export default {}'), null);
  add(
    'an alias the resolver does not know fails LOUDLY rather than truncating the walk',
    () => failureKind(() => assertKnownAliases(['@', '~'])),
    'unknown-alias',
  );
  add(
    'a missing alias block fails as an unreadable block, not as an unknown alias',
    () => failureKind(() => assertKnownAliases(null)),
    'alias-block',
  );
  add('the one known alias is silent', () => failureKind(() => assertKnownAliases(['@'])), 'no-throw');

  // --- findModuleEdges: both directions ---
  add(
    'direct importers of the tracked module are the edge list',
    () => findModuleEdges(walked().edges, TRACKED_MODULE).join(','),
    'src/a.ts,src/deep.ts',
  );
  add(
    'a module that only reaches the tracked module transitively is not an edge',
    () => findModuleEdges(walked().edges, TRACKED_MODULE).includes('src/mid.ts'),
    false,
  );
  add(
    'the tracked module never counts itself',
    () => findModuleEdges(new Map([[TRACKED_MODULE, new Set([TRACKED_MODULE])]]), TRACKED_MODULE).length,
    0,
  );

  // --- assertTrackedModule / assertModuleWalkSaw ---
  add(
    'a missing trackedModule fails AS a missing trackedModule',
    () => failureKind(() => assertTrackedModule({ trackedChunkName: 'vendor-supabase' })),
    'no-tracked-module',
  );
  add(
    'a declared trackedModule is silent',
    () => failureKind(() => assertTrackedModule({ trackedModule: 'src/x.ts' })),
    'no-throw',
  );
  add(
    'a walk that saw nothing fails rather than reporting zero edges',
    () =>
      failureKind(() =>
        assertModuleWalkSaw('home', { trackedInGraph: true, walked: 1, edgeCount: 0, unresolved: [] }),
      ),
    'walk-saw-nothing',
  );
  add(
    'unresolved first-party specifiers fail AS blindness, not as an edge count',
    () =>
      failureKind(() =>
        assertModuleWalkSaw('home', {
          trackedInGraph: true,
          walked: 90,
          edgeCount: 4,
          unresolved: [{ from: 'app/root.tsx', spec: '@/ghost' }],
        }),
      ),
    'walk-blind',
  );
  // The case this report was built for: the chunk is demonstrably in the graph,
  // and the walk says nothing holds it there. Believing that 0 is how three
  // wrong edge-lists got into the arc.
  add(
    'chunk in the graph with an empty module list fails instead of reading as done',
    () =>
      failureKind(() =>
        assertModuleWalkSaw('home', { trackedInGraph: true, walked: 90, edgeCount: 0, unresolved: [] }),
      ),
    'walk-found-no-edge',
  );
  add(
    'the GOAL state -- chunk out of the graph, no module edges -- is silent',
    () =>
      failureKind(() =>
        assertModuleWalkSaw('home', { trackedInGraph: false, walked: 90, edgeCount: 0, unresolved: [] }),
      ),
    'no-throw',
  );
  add(
    'chunk in the graph with a non-empty module list is silent',
    () =>
      failureKind(() =>
        assertModuleWalkSaw('home', { trackedInGraph: true, walked: 90, edgeCount: 8, unresolved: [] }),
      ),
    'no-throw',
  );

  let failed = 0;
  for (const { name, run, expected } of cases) {
    let actual;
    try {
      actual = run();
    } catch (err) {
      actual = `unexpected throw: ${err.message}`;
    }
    const ok = Object.is(actual, expected);
    if (!ok) failed++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}`);
    if (!ok) {
      console.log(`          expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  }

  if (failed) {
    console.error('');
    console.error(`FAIL self-test -- ${failed} of ${cases.length} case(s).`);
    return false;
  }
  console.log('');
  console.log(
    `PASS self-test -- ${cases.length} cases. Every PURE rule is proven in both ` +
      'directions, including the module walk (which takes its reader and ' +
      'resolver as arguments so fixtures can drive it). What is NOT covered, ' +
      'because none of it is fixture-drivable: the four filesystem-bound ' +
      'failures (no client manifest; a manifest entry missing from disk; a ' +
      'trackedModule that is not a file; no vite.config.ts), and the bodies of ' +
      'makeFsResolver / makeFsReader. A wrong EXTENSION list surfaces as ' +
      'unresolved specifiers on a real run; a missed ALIAS does not, which is ' +
      'exactly why assertKnownAliases exists and is pinned here instead. A ' +
      "banner claiming total coverage is the same over-claim this file's " +
      'failureKind classifier exists to prevent.',
  );
  return true;
}

// ---------------------------------------------------------------------------
// Entry. process.exitCode rather than process.exit(): on Linux an exit() right
// after a large stdout write truncates it, which is invisible on Windows and
// cost this repo a guard that printed 194 of 904 lines in CI.
// ---------------------------------------------------------------------------

// Only act as a CLI when actually invoked as one -- the same guard, and for the
// same reason, as check-script-conventions.mjs. This module exports its graph
// helpers; unguarded, merely importing one of them runs the whole budget check
// as a side effect and sets process.exitCode, reddening the importing process.
const IS_CLI =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (IS_CLI) {
  const argv = process.argv.slice(2);
  const KNOWN_FLAGS = ['--self-test'];
  const unknown = argv.filter((a) => !KNOWN_FLAGS.includes(a));

  if (unknown.length) {
    console.error(
      `bundle-budget: unknown flag(s) ${unknown.join(' ')}. Known: ${KNOWN_FLAGS.join(', ')}.`,
    );
    process.exitCode = 1;
  } else if (argv.includes('--self-test')) {
    process.exitCode = selfTest() ? 0 : 1;
  } else {
    try {
      process.exitCode = main();
    } catch (err) {
      if (!(err instanceof CheckFailure)) throw err;
      console.error('');
      console.error(`bundle-budget check FAILED\n  ${err.message}`);
      console.error('');
      process.exitCode = 1;
    }
  }
}
