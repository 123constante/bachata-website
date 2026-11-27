// CSS that loads ONLY through a lazy import, never with a route.
//
// WHY THIS EXISTS (2026-11-26, PRs #2369 / #2373 / #2376): a stylesheet that
// Vite attaches to a lazily imported chunk is fetched only when that chunk is
// imported at runtime, AFTER the route has painted. React Router preloads the
// css of the route module and everything it imports statically; it knows
// nothing about a dynamic import() inside a component. So the page first
// paints unstyled and then jumps (the homepage map flash: homeMap css rode a
// lazy chunk until #2373 imported it statically from the route). After a
// deploy the same late fetch can also 404 on an old hashed file.
//
// THE RULE (a ratchet, not a ban): every css file in the client manifest is
// either reachable through static `imports` from a root (an entry, or a React
// Router client route module), or it is on LAZY_ONLY_ALLOWED below with the
// reason it is fine to arrive late. A NEW lazy-only stylesheet is exit 1: import
// it statically from the route or the shell (see #2373), or add it here with a
// reason. A STALE allow-list entry (no longer lazy-only, or gone) is also exit 1,
// so the list only ever shrinks to the truth.
//
// Names are the css basename minus the -<hash>.css suffix, so the list
// survives rebuilds.
//
//   npm run build
//   npm run check:lazy-route-css
//   npm run check:lazy-route-css:self-test   # proves the rules, no build
//
// Exit 0 pass, 1 rule broken, 2 cannot measure: no manifest, unreadable
// manifest, no roots, or no css at all. None of these may read as "clean".

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { isEntryPoint } from './lib/entry-point.mjs';

const MANIFEST = path.join('build', 'client', '.vite', 'manifest.json');
const ROUTE_SUFFIX = '?__react-router-build-client-route';

// name -> why arriving after first paint is acceptable.
export const LAZY_ONLY_ALLOWED = {
  CityMap: 'map widget inside a page section; renders a sized placeholder until loaded',
  EventMap: 'map widget inside a page section; renders a sized placeholder until loaded',
  Raffles: 'raffle panel opened on demand, not on first paint',
  theme: 'map theme css shipped with the lazy map bundle',
  'vendor-leaflet': 'leaflet css travels with the lazy leaflet chunk; map containers are sized before it lands',
  'vendor-maplibre': 'maplibre css travels with the lazy maplibre chunk; map containers are sized before it lands',
};

export function cssName(file) {
  return path.basename(file).replace(/-[A-Za-z0-9_-]{8}\.css$/, '').replace(/\.css$/, '');
}

/** Pure: manifest -> { roots, lazyOnly: Set<name>, allCss: number }. */
export function measure(manifest) {
  const keys = Object.keys(manifest);
  const roots = keys.filter((k) => manifest[k].isEntry || k.endsWith(ROUTE_SUFFIX));
  const seen = new Set();
  const stack = [...roots];
  while (stack.length) {
    const k = stack.pop();
    if (seen.has(k) || !manifest[k]) continue;
    seen.add(k);
    for (const i of manifest[k].imports || []) stack.push(i);
  }
  const staticCss = new Set();
  for (const k of seen) for (const c of manifest[k].css || []) staticCss.add(c);
  const all = new Set();
  for (const k of keys) for (const c of manifest[k].css || []) all.add(c);
  const lazyOnly = new Set([...all].filter((c) => !staticCss.has(c)).map(cssName));
  return { roots: roots.length, lazyOnly, allCss: all.size };
}

function defaultReadManifest() {
  if (!existsSync(MANIFEST)) return { error: `no ${MANIFEST} -- run \`npm run build\` first` };
  try {
    return { manifest: JSON.parse(readFileSync(MANIFEST, 'utf8')) };
  } catch (err) {
    return { error: `cannot read ${MANIFEST}: ${err.message}` };
  }
}

export function main(_argv = [], deps = {}) {
  const read = deps.readManifest || defaultReadManifest;
  const allowed = deps.allowed || LAZY_ONLY_ALLOWED;
  const log = deps.log || console.log;
  const err = deps.err || console.error;

  const got = read();
  if (got.error) {
    err(`ERROR check-lazy-route-css: ${got.error}`);
    return 2;
  }
  const { roots, lazyOnly, allCss } = measure(got.manifest);
  if (roots === 0) {
    err('ERROR check-lazy-route-css: no entry or route modules in the manifest -- cannot tell static from lazy.');
    return 2;
  }
  if (allCss === 0) {
    err('ERROR check-lazy-route-css: the manifest lists no css at all -- nothing was measured.');
    return 2;
  }

  const fresh = [...lazyOnly].filter((n) => !(n in allowed)).sort();
  const stale = Object.keys(allowed).filter((n) => !lazyOnly.has(n)).sort();
  for (const n of fresh) {
    err(`FAIL ${n}.css loads only via a lazy import, so the page paints before it arrives. Import it statically from the route or shell (see #2373), or add it to LAZY_ONLY_ALLOWED in scripts/check-lazy-route-css.mjs with a reason.`);
  }
  for (const n of stale) {
    err(`FAIL ${n} is on LAZY_ONLY_ALLOWED but is no longer lazy-only css -- remove it from the list.`);
  }
  if (fresh.length || stale.length) {
    err(`FAIL check-lazy-route-css -- ${fresh.length} new, ${stale.length} stale. Lazy-only today: ${[...lazyOnly].sort().join(', ') || '(none)'}`);
    return 1;
  }
  log(`PASS check-lazy-route-css -- ${allCss} css file(s), ${roots} root(s); ${lazyOnly.size} lazy-only, all allow-listed.`);
  return 0;
}

function selfTest() {
  const route = (k) => `app/routes/${k}.tsx${ROUTE_SUFFIX}`;
  const base = () => ({
    'app/root.tsx': { isEntry: true, imports: ['_shell.js'], css: ['assets/root-AAAAAAAA.css'] },
    '_shell.js': { imports: [], css: ['assets/shell-BBBBBBBB.css'] },
    [route('home')]: { imports: ['_shell.js'], dynamicImports: ['_map.js'], css: ['assets/home-CCCCCCCC.css'] },
    '_map.js': { imports: ['_vendor.js'], css: ['assets/Map-DDDDDDDD.css'] },
    '_vendor.js': { imports: [], css: ['assets/vendor-x-E_E-EEEE.css'] },
  });
  const ALLOW = { Map: 'r', 'vendor-x': 'r' };
  const quiet = { log: () => {}, err: () => {} };
  const run = (manifestOrErr, allowed = ALLOW) =>
    main([], { ...quiet, allowed, readManifest: () => manifestOrErr });

  const cases = [
    ['allow-listed lazy css passes', () => run({ manifest: base() }), 0],
    ['a new lazy-only css fails', () => {
      const m = base();
      m['_map.js'].css.push('assets/Popup-FFFFFFFF.css');
      return run({ manifest: m });
    }, 1],
    ['a stale allow-list entry fails', () => run({ manifest: base() }, { ...ALLOW, Gone: 'r' }), 1],
    ['css made static (route imports it) makes its entry stale', () => {
      const m = base();
      m[route('home')].imports.push('_map.js');
      return run({ manifest: m });
    }, 1],
    ['missing manifest is 2, never clean', () => run({ error: 'no manifest' }), 2],
    ['no roots is 2', () => {
      const m = base();
      delete m['app/root.tsx'];
      delete m[route('home')];
      return run({ manifest: m });
    }, 2],
    ['no css at all is 2', () => run({ manifest: { 'app/root.tsx': { isEntry: true, imports: [] } } }, {}), 2],
  ];
  let failed = 0;
  for (const [name, fn, expected] of cases) {
    let actual;
    try {
      actual = fn();
    } catch (e) {
      actual = `THREW: ${e.message}`;
    }
    if (actual !== expected) {
      failed += 1;
      console.error(`FAIL ${name}: expected ${expected}, got ${actual}`);
    }
  }
  if (cssName('assets/vendor-x-E_E-EEEE.css') !== 'vendor-x') {
    failed += 1;
    console.error('FAIL cssName must strip a hash containing - and _');
  }
  if (failed) {
    console.error(`FAIL self-test -- ${failed} case(s).`);
    return false;
  }
  console.log(`PASS self-test -- ${cases.length + 1} cases; exit codes 0/1/2 driven through main().`);
  return true;
}

if (isEntryPoint(import.meta.url)) {
  const argv = process.argv.slice(2);
  process.exitCode = argv.includes('--self-test') ? (selfTest() ? 0 : 1) : main(argv);
}
