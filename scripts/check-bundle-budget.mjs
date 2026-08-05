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

import { readFileSync, existsSync, appendFileSync } from 'node:fs';
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

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      [...budgetRows, ...attrRows].join('\n') + '\n',
    );
  }

  if (anyOver) {
    console.error(
      '\nOne or more routes exceed their first-load JS budget (perf-budgets.json). ' +
        'Either remove the weight from the static import graph or raise the budget ' +
        'deliberately in this PR with justification.',
    );
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
      'directions. The two filesystem-bound failures (no client manifest; a ' +
      'manifest entry missing from disk) are not fixture-drivable and are NOT ' +
      'covered -- a banner claiming total coverage is the same over-claim this ' +
      "file's failureKind classifier exists to prevent.",
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
