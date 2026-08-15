// First-load REQUEST-COUNT ratchet for the prerendered routes.
//
// scripts/check-bundle-budget.mjs answers "how many KILOBYTES does this route's
// first load weigh". This answers the other question, and they are not the same
// one: Vercel meters edge REQUESTS, and this account went 80% over that
// allowance while sitting at a third of its byte allowance. A route can get
// lighter and more expensive in the same commit -- splitting one 40 KB chunk
// into forty 1 KB chunks is free in bytes and costs 39 requests on every view.
// Nothing in perf-budgets.json could see that before this file existed; the KB
// budgets would have reported the split as a small WIN.
//
// WHAT IS COUNTED, exactly, because a number nobody can reproduce is not a
// contract. For each prerendered route's index.html, the union of:
//
//   * every <link rel="modulepreload"> href
//   * every <link rel="stylesheet"> href
//   * every <link rel="preload"> href whose as= is "script" or "style"
//   * every STATIC import specifier in the inline <script type="module">
//
// A UNION, not a sum, and the inline-import term is the reason. React Router
// bootstraps the route through `import * as route0 from "/assets/root-x.js"`
// inside an inline module script -- a real request that no <script src> and no
// tag count would ever see. Today those specifiers are all in the modulepreload
// set, so the union equals the tag count; the guard takes the union anyway,
// because "they happen to coincide" is a property of this week's React Router
// and not something to bake into the number.
//
// WHAT IS NOT COUNTED, said out loud rather than left for a reader to discover
// from a number that seems low: the HTML document itself, favicons, the web
// manifest, preconnect hints (a connection, not a request), and font preloads.
// The font is a real first-load request and it is deliberately outside the
// ratchet -- it is a constant this arc does not move -- so the report prints it
// per route instead of hiding it. If a change ever adds JS or CSS through a
// shape not in the list above, this guard will not see it, which is why the
// coverage assertion below is on the ARTEFACT and not on a name list.
//
// WHICH ROUTES ARE NOT COVERED AT ALL, and this is the bigger caveat by far:
// only PRERENDERED routes have a document on disk to read, so /city/:slug and
// /event/:id -- the two highest-traffic pages in the app, and the ones the
// request bill is mostly made of -- are structurally outside this guard. They
// are on-demand SSR + tagged ISR and emit no index.html. Do NOT read a green
// run here as "the request bill is guarded". What covers them is the SIBLING
// guard: check-bundle-budget.mjs walks the vite manifest and, since PR 3 of the
// vendor-cost arc, GATES a first-load `chunks` count for every budgeted route
// including the two SSR ones -- `chunkRatchet` in perf-budgets.json, both edges
// blocking. It was report-only when this file was written.
//
// A chunk count is not a request count -- it omits the stylesheet and the
// document -- so the two guards are not interchangeable and their numbers are
// not comparable. On the six routes where BOTH exist, each pin here is its
// chunk pin plus one stylesheet; that agreement between two guards reading two
// different artefacts is what makes the chunk figure a defensible proxy for the
// routes this file cannot see. Nothing enforces that relationship, so if you
// change a pin in one block, check the other.
//
// BOTH EDGES ARE PINNED, the same contract pullerRatchet in perf-budgets.json
// carries and for the same reason. Over the pin is a regression. UNDER the pin
// also fails: an allowance nobody tightens stops describing the code and decays
// into a ceiling with slack, and the next regression hides inside the slack.
// The fix for an UNDER is a one-line edit in the PR that earned the win, which
// is the moment the number is best understood.
//
//   npm run build                                 # the HTML is a build artifact
//   npm run check:first-load-requests
//   npm run check:first-load-requests:self-test   # proves the rules, no build
//
// Exit 0 pass, 1 contract violated, 2 cannot measure.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { isEntryPoint } from './lib/entry-point.mjs';

const ROOT = process.cwd();
const CLIENT_DIR = path.join(ROOT, 'build', 'client');
const BUDGETS_PATH = path.join(ROOT, 'perf-budgets.json');

/** A contract violation -- exit 1. The build is fine; the numbers disagree. */
class CheckFailure extends Error {}

/** The guard cannot measure -- exit 2. Never reported as a pass. */
class InfraFailure extends Error {}

const fail = (msg) => {
  throw new CheckFailure(msg);
};

const infra = (msg) => {
  throw new InfraFailure(msg);
};

// ---------------------------------------------------------------------------
// Extraction. Pure -- takes HTML, returns what that document asks the browser
// to fetch, so the canary drives it with literal strings and no build.
// ---------------------------------------------------------------------------

const TAG = /<(link|script)\b[^>]*>/gi;

// REGEX LITERALS, NOT `new RegExp(string)`, and this is not a style choice. The
// first version built these from a single-quoted string -- `new RegExp(name +
// '\s*=\s*"([^"]*)"')` -- where `\s` is not a recognised JS string escape and
// collapses to a literal `s`. The compiled source was `rels*=s*"([^"]*)"`, so
// `rel = "modulepreload"` with spaces around the `=` matched NOTHING and the
// link was dropped from the count. Silently, and in the direction that reads as
// a WIN: the route falls UNDER its pin and this guard's own message invites the
// operator to tighten the pin onto the undercount. A literal cannot have that
// class of bug, and this repo has the string form on record as a mount hazard
// besides (a doubled backslash does not always survive the write).
//
// Each accepts EITHER quoting style and requires a real attribute-name
// boundary. Without the boundary `data-rel="x"` shadows `rel="modulepreload"`
// -- unanchored `rel` matches inside `data-rel` first -- and the tag is
// discarded while the comment below claims attribute order does not matter.
const REL = /(?:^|\s)rel\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const AS = /(?:^|\s)as\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const HREF = /(?:^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const SRC = /(?:^|\s)src\s*=\s*(?:"([^"]*)"|'([^']*)')/i;

// Attributes in ANY order. The emitted tags put nonce= before rel= and href=
// after it, and a regex written as rel-then-href happens to work on today's
// output for the wrong reason. Read the tag, then read its attributes.
const attr = (tag, re) => {
  const m = re.exec(tag);
  if (!m) return undefined;
  return m[1] ?? m[2];
};

/**
 * Static import specifiers in an inline module script.
 *
 * TWO separate guards, and a draft of this comment credited the wrong one with
 * the job. Measured, not reasoned:
 *
 *   * `import` must be followed by a QUOTE (optionally after whitespace, or
 *     after a `* as X from` clause). This is what keeps the `"imports"` arrays
 *     inside the __reactRouterManifest JSON -- in the very same script body --
 *     out of the count. Those name assets the router may fetch LATER, on
 *     navigation, which is not what this measures. `"imports":` puts an `s`
 *     between `import` and the quote, so it never matches, with or without the
 *     anchor below.
 *
 *     The whitespace is `\s*` and NOT `\s+`, which a draft had. A minified
 *     side-effect import is spelled `import"/a.js"` with no space at all, and
 *     `\s+` misses it -- silently, and in the direction that reads as a WIN:
 *     the route appears to have dropped a request, the UNDER edge fires, and
 *     whoever tightens the pin bakes the undercount in. Today's build emits the
 *     spaced form; the regex does not depend on that staying true.
 *   * The statement anchor (start of input, newline, or `;`) is what rejects an
 *     `import` glued to the end of a longer token. `noimport "/a.js";` matches
 *     without it and does not match with it -- that is the anchor's whole job,
 *     and the canary case named after it is the only thing holding it.
 *
 * The distinction matters because the two are deletable independently, and the
 * earlier comment would have told whoever deleted the `\s+` that the anchor had
 * them covered.
 */
// The clause between `import` and the specifier is matched GENERICALLY rather
// than enumerated. A draft handled the side-effect and namespace forms only --
// which are the two React Router emits today -- and silently counted nothing
// for `import r from "..."` or `import{a}from"..."`. That is the undercount
// direction again: the natural minifier-friendly rewrite of the bootstrap would
// have dropped one request per route module, read as UNDER, and been tightened
// in.
//
// The clause admits BALANCED quoted segments rather than banning quotes
// outright. `[^"';]*` was the first attempt and it silently missed
// `import {"a-b" as c} from "/x.js"` -- an arbitrary module namespace name,
// valid since ES2022 -- because the clause could not cross the quote. MUTATION
// found that: relaxing the class to `[^;]*` changed the result on that input
// and not one case noticed. Writing the miss down as expected would have been a
// canary asserting a defect as correct, so the regex changed instead. Allowing
// `"..."` and `'...'` as whole units is what fixes it without also letting the
// clause run away across a stray quote, which is exactly what `[^;]*` does.
//
// BOTH the clause and the optional group are LAZY, and that is the third defect
// mutation turned up in this one expression. A greedy clause spans newlines --
// nothing in it excludes one -- so given
//
//     import "/a.js"
//     const q = "x"
//     export {y} from "/decoy.js"
//
// it swallowed everything up to that LATER `from` and returned ["/decoy.js"]:
// the real request missed AND a decoy counted, from a body with no semicolon to
// stop it. The mutant that exposed this was a wider clause that behaved
// IDENTICALLY -- which is why it kept scoring zero FAIL lines and read as a
// canary blind spot rather than as the two regexes being wrong the same way.
//
// Lazy fixes it at the root: the group is tried EMPTY first, so a specifier
// sitting directly after `import` is taken immediately and the clause is only
// grown when there is genuinely a binding list to cross. Verified against all
// of: side-effect, minified, namespace, minified namespace, default, named,
// mixed, ES2022 string names, and a multi-line binding list.
//
// Still cannot match the `"imports":` array in the same script body: that puts
// an `s` between `import` and the quote, with no `from` before one either.
const IMPORT_SPEC =
  /(?:^|[;\n])\s*import\s*(?:(?:[^"';]|"[^"]*"|'[^']*')*?\bfrom\s*)??["']([^"']+)["']/g;

const MODULE_SCRIPT = /<script\b[^>]*\btype\s*=\s*"module"[^>]*>([\s\S]*?)<\/script>/gi;

/**
 * The first-load JS+CSS assets a prerendered document requests, plus the
 * non-JS/CSS preloads it also requests (reported, never ratcheted).
 *
 * @param {string} html
 * @returns {{assets: string[], otherPreloads: string[]}}
 */
export function extractFirstLoadAssets(html) {
  const assets = new Set();
  const otherPreloads = [];

  TAG.lastIndex = 0;
  for (let m = TAG.exec(html); m !== null; m = TAG.exec(html)) {
    const tag = m[0];
    if (m[1].toLowerCase() !== 'link') {
      // <script src="..."> is not emitted today (the entry arrives through the
      // inline module script below) but costs nothing to count, and a build
      // change that reintroduces it must move the number rather than slip past.
      const src = attr(tag, SRC);
      if (src) assets.add(src);
      continue;
    }
    const rel = (attr(tag, REL) ?? '').toLowerCase();
    const href = attr(tag, HREF);
    if (!href) continue;
    if (rel === 'modulepreload' || rel === 'stylesheet') {
      assets.add(href);
    } else if (rel === 'preload') {
      const as = (attr(tag, AS) ?? '').toLowerCase();
      if (as === 'script' || as === 'style') assets.add(href);
      else otherPreloads.push(href);
    }
  }

  MODULE_SCRIPT.lastIndex = 0;
  for (let s = MODULE_SCRIPT.exec(html); s !== null; s = MODULE_SCRIPT.exec(html)) {
    const body = s[1];
    IMPORT_SPEC.lastIndex = 0;
    for (let i = IMPORT_SPEC.exec(body); i !== null; i = IMPORT_SPEC.exec(body)) {
      assets.add(i[1]);
    }
  }

  return { assets: [...assets], otherPreloads };
}

// ---------------------------------------------------------------------------
// Rules. Pure and exported, so the canary proves both directions of each.
// ---------------------------------------------------------------------------

/**
 * The ratchet block must exist and name at least one route.
 *
 * An empty block would let this guard print "respected" having compared
 * nothing -- the silent-green failure mode rule R1 of
 * check-script-conventions.mjs exists to catch.
 */
export function assertRatchetDeclared(ratchet) {
  if (!ratchet || typeof ratchet !== 'object' || Array.isArray(ratchet)) {
    fail(
      'perf-budgets.json declares no firstLoadRequestRatchet block, so this ' +
        'guard would compare nothing while still exiting 0. Restore it, or ' +
        'retire this check in a PR that says why.',
    );
  }
  const names = Object.keys(ratchet);
  if (!names.length) {
    fail(
      'perf-budgets.json firstLoadRequestRatchet is EMPTY. Same failure as a ' +
        'missing block: nothing is compared and the exit code says pass.',
    );
  }
  for (const name of names) {
    const pin = ratchet[name];
    if (!Number.isInteger(pin) || pin < 1) {
      fail(
        `firstLoadRequestRatchet["${name}"] is ${JSON.stringify(pin)}, which is ` +
          'not a positive integer. A pin of 0 is not a tighter budget, it is a ' +
          'route that cannot load.',
      );
    }
  }
  return names;
}

/**
 * A route that parsed to nothing is a BROKEN MEASUREMENT, not a route with no
 * JS -- no page in this app loads zero assets. It is exit 2 rather than exit 1
 * because the honest report is "this guard no longer knows how to read the
 * document", most likely because React Router changed how it emits preloads.
 * Reporting it as a contract violation would send the reader to perf-budgets.json
 * to edit a number, which is the one thing that must not happen here.
 */
export function assertMeasured(route, assets) {
  if (!assets.length) {
    infra(
      `route "${route}" measured NOTHING -- its prerendered HTML yielded zero ` +
        'first-load assets. The document is not empty (it was found and read), ' +
        'so the extractor has stopped matching what the build emits. Fix the ' +
        'extraction in this file; do NOT adjust the pin.',
    );
  }
  return assets.length;
}

/**
 * Coverage, computed from the ARTEFACT rather than from a name list.
 *
 * A ratchet over a hand-written list of routes goes quietly blind the moment
 * someone adds a prerendered route: the new page ships unratcheted and the
 * guard still says every route it knows about is fine. So the set on disk is
 * the authority in BOTH directions -- an undeclared route on disk fails, and a
 * declared route that is no longer prerendered fails too (it left the prerender
 * list, and the pin describing it is now decoration).
 */
export function findCoverageGaps(declared, onDisk) {
  const declaredSet = new Set(declared);
  const diskSet = new Set(onDisk);
  return {
    unratcheted: onDisk.filter((r) => !declaredSet.has(r)).sort(),
    vanished: declared.filter((r) => !diskSet.has(r)).sort(),
  };
}

/** Both edges. Over is a regression; under is an unclaimed win. */
export function findRatchetBreaks(ratchet, observed) {
  const breaks = [];
  for (const route of Object.keys(ratchet)) {
    const pin = ratchet[route];
    const count = observed[route];
    if (typeof count !== 'number') continue;
    if (count > pin) breaks.push({ route, pin, count, direction: 'OVER' });
    else if (count < pin) breaks.push({ route, pin, count, direction: 'UNDER' });
  }
  return breaks;
}

// ---------------------------------------------------------------------------
// Discovery + the exit owner.
// ---------------------------------------------------------------------------

const SKIP_DIRS = new Set(['assets', '.vite']);

// The walk joins with path.posix so a route key is '/faq' on every platform --
// a Windows path.join would make it '\faq' and every pin would read as an
// unratcheted route beside a vanished one.
const toPosix = (p) => p.split(path.sep).join('/');

/**
 * Every prerendered document on disk, as { routePath -> html }. React Router
 * writes each prerendered route to <route>/index.html under build/client.
 */
/**
 * @param clientDir  build output root
 * @param fs         injected filesystem
 * @param publicDir  the source of the verbatim static copy, or undefined
 *
 * `publicDir` exists because build/client is NOT only prerendered routes:
 * everything in public/ is copied into it verbatim (robots.txt, the manifest,
 * map-placeholder/, ...). A static public/legacy/index.html would therefore be
 * discovered as a route called /legacy, and -- having no modulepreloads -- trip
 * the assertMeasured floor with "the extractor has stopped matching what the
 * build emits", sending the reader to debug an extractor that is working
 * perfectly. So a document whose IDENTICAL relative path also exists under
 * public/ is a copy, not a route, and is skipped.
 *
 * Skipped on the narrowest possible test -- the same path present in both
 * trees -- rather than by name or by inspecting content. A prerendered route
 * that a broken build emitted as an empty document must still fail loudly, and
 * a content test ("does it look like a React Router document?") would have
 * turned exactly that into a silent skip.
 */
export function listPrerenderedFrom(clientDir, fs, publicDir) {
  const { existsSync: exists, readdirSync: readdir, readFileSync: read } = fs;
  if (!exists(clientDir)) {
    infra(
      `No client build at ${clientDir}. Run ` +
        '`npm run build` first -- the prerendered HTML is a build artifact.',
    );
  }
  const found = new Map();
  const walk = (dir, rel) => {
    for (const dirent of readdir(dir, { withFileTypes: true })) {
      if (dirent.isDirectory()) {
        if (SKIP_DIRS.has(dirent.name)) continue;
        walk(path.posix.join(dir, dirent.name), rel + '/' + dirent.name);
      } else if (dirent.name === 'index.html') {
        if (publicDir !== undefined && exists(path.posix.join(publicDir + rel, 'index.html'))) {
          continue;
        }
        found.set(rel === '' ? '/' : rel, read(path.posix.join(dir, 'index.html'), 'utf8'));
      }
    }
  };
  walk(clientDir, '');
  if (found.size === 0) {
    infra(
      `No index.html anywhere under ${clientDir}. Either ` +
        'the build did not prerender, or its output layout changed. Either way ' +
        'this guard has nothing to read and must not report a pass.',
    );
  }
  return found;
}

export function readBudgetsFrom(budgetsPath, fs) {
  const { existsSync: exists, readFileSync: read } = fs;
  if (!exists(budgetsPath)) {
    infra(`perf-budgets.json is missing at ${budgetsPath}.`);
  }
  try {
    return JSON.parse(read(budgetsPath, 'utf8'));
  } catch (err) {
    infra(`perf-budgets.json does not parse: ${err.message}`);
  }
}

// The real filesystem, bound once. Injected everywhere below so the canary can
// drive the branches ABOVE -- "no build", "no index.html anywhere", "budgets
// file missing", "budgets file does not parse" -- for real, rather than by
// throwing a lookalike from a stub and pinning main()'s handling of it. Those
// four are exactly the branches that must never be reported as a pass, and
// three of them return the same code, so a canary that could not reach them
// would be asserting the code and guessing the branch.
const REAL_FS = { existsSync, readdirSync, readFileSync };
const readBudgetsFromDisk = () => readBudgetsFrom(BUDGETS_PATH, REAL_FS);
const defaultListPrerendered = () =>
  listPrerenderedFrom(toPosix(CLIENT_DIR), REAL_FS, toPosix(path.join(ROOT, 'public')));

const KNOWN_FLAGS = ['--self-test'];

/**
 * THE EXIT OWNER. Its return value becomes process.exitCode, and the canary
 * drives THIS function -- not the rules alone -- so the codes are measured
 * rather than asserted (rule R5 of check-script-conventions.mjs).
 *
 * Collaborators are injected so every branch is reachable with no build, no
 * filesystem and no network.
 */
export function main(argv = [], deps = {}) {
  const {
    readBudgets = readBudgetsFromDisk,
    listPrerendered = defaultListPrerendered,
    log = console.log,
    logError = console.error,
  } = deps;

  const unknown = argv.filter((a) => a.startsWith('-') && !KNOWN_FLAGS.includes(a));
  if (unknown.length) {
    logError(`Unknown flag(s): ${unknown.join(', ')}. Known: ${KNOWN_FLAGS.join(', ')}`);
    return 1;
  }

  try {
    const budgets = readBudgets();
    const ratchet = budgets?.firstLoadRequestRatchet;
    const declared = assertRatchetDeclared(ratchet);
    const documents = listPrerendered();

    const observed = {};
    const extras = {};
    for (const [route, html] of documents) {
      const { assets, otherPreloads } = extractFirstLoadAssets(html);
      observed[route] = assertMeasured(route, assets);
      extras[route] = otherPreloads.length;
    }

    const { unratcheted, vanished } = findCoverageGaps(declared, [...documents.keys()]);
    const breaks = findRatchetBreaks(ratchet, observed);

    log('');
    for (const route of [...documents.keys()].sort()) {
      const pin = ratchet[route];
      const count = observed[route];
      const extra = extras[route];
      const suffix = extra ? ` (+${extra} non-JS/CSS preload, not ratcheted)` : '';
      if (pin === undefined) {
        log(`[UNRATCHETED] ${route}: ${count} first-load JS/CSS request(s)${suffix}`);
      } else if (count === pin) {
        log(`[ok] ${route}: ${count} first-load JS/CSS request(s), pin ${pin}${suffix}`);
      } else {
        const dir = count > pin ? 'OVER' : 'UNDER';
        log(`[${dir}] ${route}: ${count} first-load JS/CSS request(s), pin ${pin}${suffix}`);
      }
    }
    log('');

    if (unratcheted.length) {
      fail(
        `prerendered route(s) with no firstLoadRequestRatchet pin: ${unratcheted.join(', ')}. ` +
          'A new prerendered page ships unratcheted otherwise, and this guard ' +
          'would keep reporting that every route it knows about is fine. Add a ' +
          'pin at the MEASURED count printed above.',
      );
    }
    if (vanished.length) {
      fail(
        `firstLoadRequestRatchet pins route(s) that are no longer prerendered: ${vanished.join(', ')}. ` +
          'They left react-router.config.ts `prerender` (or moved to on-demand ' +
          'SSR), so the pin describes nothing. Remove it deliberately.',
      );
    }
    if (breaks.length) {
      for (const b of breaks) {
        logError(
          b.direction === 'OVER'
            ? `${b.route}: ${b.count} first-load requests against a pin of ${b.pin} ` +
                `(+${b.count - b.pin}). Every extra chunk is one more edge request on ` +
                'every view of this page. Find it by diffing the modulepreload list ' +
                'against the previous build, or raise the pin deliberately and say why.'
            : `${b.route}: ${b.count} first-load requests against a pin of ${b.pin} ` +
                `(${b.count - b.pin}). This is a WIN, and it fails on purpose: a pin ` +
                'nobody tightens decays into a ceiling with slack and the next ' +
                `regression hides inside it. Set the pin to ${b.count} in this PR.`,
        );
      }
      return 1;
    }

    log(`All ${declared.length} prerendered route(s) match their first-load request pin.`);
    return 0;
  } catch (err) {
    if (err instanceof CheckFailure) {
      logError(`[first-load-requests] ${err.message}`);
      return 1;
    }
    if (err instanceof InfraFailure) {
      logError(`[first-load-requests] cannot measure: ${err.message}`);
      return 2;
    }
    logError(`[first-load-requests] unexpected error: ${err?.stack ?? err}`);
    return 2;
  }
}

// ---------------------------------------------------------------------------
// Canary. Proves the RULES in both directions, and -- separately -- drives
// main() itself so the exit CODES are measured rather than asserted.
// ---------------------------------------------------------------------------

// WHICH failure, not merely that one happened. Four branches of main() return
// 2, so a case asserting only "it returned 2" passes for the wrong reason.
// Review caught this list naming only the four CONTRACT branches, so all four
// INFRASTRUCTURE branches collapsed to 'infra:unclassified' and their cases
// asserted that one string. Swapping the bodies of the no-HTML branch and the
// missing-budgets branch left every case passing -- which is exactly what the
// paragraph above declares must not happen.
const KINDS = [
  ['declares no firstLoadRequestRatchet', 'no-ratchet'],
  ['is EMPTY', 'empty-ratchet'],
  ['not a positive integer', 'bad-pin'],
  ['measured NOTHING', 'nothing-measured'],
  ['No client build at', 'no-build'],
  ['No index.html anywhere under', 'no-prerendered-html'],
  ['perf-budgets.json is missing at', 'no-budgets-file'],
  ['does not parse', 'unparseable-budgets'],
];

const failureKind = (run) => {
  try {
    run();
    return 'no-throw';
  } catch (err) {
    const tag =
      err instanceof CheckFailure ? '' : err instanceof InfraFailure ? 'infra:' : null;
    if (tag === null) return `wrong-error: ${err.message}`;
    for (const [needle, kind] of KINDS) {
      if (err.message.includes(needle)) return tag + kind;
    }
    return tag + 'unclassified';
  }
};

const HTML_OK = [
  '<html><head>',
  '<link nonce="n" rel="modulepreload" href="/assets/root.js"/>',
  '<link rel="modulepreload" href="/assets/vendor-react.js" nonce="n"/>',
  '<link nonce="n" rel="stylesheet" href="/assets/root.css"/>',
  '<link rel="preload" as="font" href="/assets/inter.woff2"/>',
  '<script nonce="n" type="module" async="">;',
  'import * as route0 from "/assets/root.js";',
  'import * as route1 from "/assets/faq.js";',
  '  window.__reactRouterManifest = {"entry":{"module":"/assets/entry.js",',
  '  "imports":["/assets/never-counted-a.js","/assets/never-counted-b.js"]}};',
  '</script>',
  '</head></html>',
].join('\n');
// root.js appears BOTH as a modulepreload and as an inline import: 4 distinct
// assets, not 5. root.js + vendor-react.js + root.css + faq.js.
const HTML_OK_COUNT = 4;

const docs = (entries) => new Map(entries);
const okDocs = () => docs([['/faq', HTML_OK]]);
const okRatchet = () => ({ firstLoadRequestRatchet: { '/faq': HTML_OK_COUNT } });

/** Drive main() with everything injected; report its code AND what it said. */
const runMain = (argv, deps) => {
  const out = [];
  const err = [];
  const code = main(argv, {
    log: (m) => out.push(String(m)),
    logError: (m) => err.push(String(m)),
    ...deps,
  });
  return { code, said: out.concat(err).join('\n') };
};

function selfTest() {
  const cases = [];
  const add = (name, run, expected) => cases.push({ name, run, expected });

  // --- extraction ---------------------------------------------------------
  const ex = (html) => extractFirstLoadAssets(html);
  add('a modulepreload is a request', () => ex(HTML_OK).assets.includes('/assets/vendor-react.js'), true);
  add('a stylesheet is a request', () => ex(HTML_OK).assets.includes('/assets/root.css'), true);
  add(
    'an inline module import is a request no tag count would see',
    () => ex(HTML_OK).assets.includes('/assets/faq.js'),
    true,
  );
  add(
    'the same href preloaded AND imported counts ONCE (union, not sum)',
    () => ex(HTML_OK).assets.length,
    HTML_OK_COUNT,
  );
  add(
    'the __reactRouterManifest imports array is NOT counted',
    () => ex(HTML_OK).assets.some((a) => a.includes('never-counted')),
    false,
  );
  add('a font preload is reported, not ratcheted', () => ex(HTML_OK).otherPreloads.length, 1);
  // THE STATEMENT ANCHOR, which nothing proved until a mutant removed it and
  // every case still passed. The manifest case above survives without the
  // anchor too (see the regex docstring: the `\s+` is what excludes it), so
  // this is the only case that fails when the anchor goes.
  add(
    'an `import` glued to the end of a longer token is not an import statement',
    () => ex('<script type="module">const x=1;\nnoimport "/assets/sneaky.js";</script>').assets.length,
    0,
  );
  add(
    'a real import on the line after a statement IS counted',
    () => ex('<script type="module">const x=1;\nimport "/assets/real.js";</script>').assets,
    ['/assets/real.js'],
  );
  // A MINIFIED side-effect import has no space at all. Nothing proved this
  // until a mutant relaxed `\s+` to `\s*` and every case still passed -- which
  // was the mutant being RIGHT: `\s+` misses this form, and it misses it in the
  // direction that reads as a win, so the pin would be tightened onto an
  // undercount. Today's build emits the spaced form; this case is why the
  // number does not depend on that.
  add(
    'a MINIFIED import with no whitespace is still a request',
    () => ex('<script type="module">import"/assets/min.js";</script>').assets,
    ['/assets/min.js'],
  );
  // The namespace form, minified the same way. Every optional space in the
  // clause is driven here rather than left to a comment: a mutant tightened
  // each of them in turn and, until this case existed, the tightening scored
  // zero FAIL lines. The alternative -- writing down "fully minified namespace
  // imports are a known gap" -- would have been a canary asserting a defect as
  // correct, which is the failure mode the case above was added to stop.
  add(
    'a MINIFIED namespace import is still a request',
    () => ex('<script type="module">import*as r from"/assets/ns.js";</script>').assets,
    ['/assets/ns.js'],
  );
  add(
    'attribute order does not matter (href before rel)',
    () => ex('<link href="/a.js" rel="modulepreload"/>').assets.length,
    1,
  );
  // Review found the attribute regexes compiled from a string, where `\s`
  // collapsed to a literal `s`. These three cases are what would have caught
  // it: whitespace around `=`, single quotes, and an attribute whose name ENDS
  // with the one being read.
  add(
    'whitespace around = does not hide a request',
    () => ex('<link rel = "modulepreload" href = "/a.js"/>').assets,
    ['/a.js'],
  );
  add(
    "single-quoted attribute values are read too",
    () => ex("<link rel='modulepreload' href='/a.js'/>").assets,
    ['/a.js'],
  );
  add(
    'data-rel does not shadow rel',
    () => ex('<link data-rel="x" rel="modulepreload" href="/a.js"/>').assets,
    ['/a.js'],
  );
  add(
    'data-href does not shadow href',
    () => ex('<link rel="modulepreload" data-href="/decoy.js" href="/a.js"/>').assets,
    ['/a.js'],
  );
  add(
    'a default import is a request',
    () => ex('<script type="module">import r from "/assets/def.js";</script>').assets,
    ['/assets/def.js'],
  );
  add(
    'a named import is a request',
    () => ex('<script type="module">import{a}from"/assets/named.js";</script>').assets,
    ['/assets/named.js'],
  );
  // The greediness case. A clause with nothing excluding newlines ran forward
  // to a LATER `from` in a body with no semicolons, missing the real request
  // and counting a decoy -- both errors at once, and invisible to every other
  // case here.
  add(
    'a later `from` on another line cannot steal the specifier',
    () =>
      ex(
        '<script type="module">import "/assets/real.js"\nconst q = "x"\nexport {y} from "/assets/decoy.js"</script>',
      ).assets,
    ['/assets/real.js'],
  );
  add(
    'a multi-line binding list is still one request',
    () => ex('<script type="module">import {\n a,\n b\n} from "/assets/multi.js";</script>').assets,
    ['/assets/multi.js'],
  );
  add(
    'a string module-namespace name (ES2022) does not hide the request',
    () => ex('<script type="module">import {"a-b" as c} from "/assets/str.js";</script>').assets,
    ['/assets/str.js'],
  );
  // The only input on which a `[^;]` clause still differs from the balanced
  // one, found by diffing the two over a battery rather than by reasoning about
  // them. It is the reason the clause spells out quoted units instead of just
  // excluding `;`.
  //
  // The `\b` on `from` is NOT pinned by any case, deliberately and said out
  // loud: dropping it changed the result on NONE of fourteen inputs, two of
  // them real prerendered documents. It is an equivalent mutant, not a hole,
  // and inventing a case that cannot distinguish it would be decoration.
  add(
    'a semicolon inside a module-namespace name does not truncate the clause',
    () => ex('<script type="module">import {"a;b" as c} from "/assets/semi.js";</script>').assets,
    ['/assets/semi.js'],
  );
  add(
    'a `from` inside an earlier STRING does not drag a decoy into the count',
    () =>
      ex('<script type="module">const q="from decoy";\nimport "/assets/real.js";</script>').assets,
    ['/assets/real.js'],
  );
  add(
    'a mixed default+named import is a request',
    () => ex('<script type="module">import r,{a} from "/assets/mixed.js";</script>').assets,
    ['/assets/mixed.js'],
  );
  add(
    'preload as=script IS counted',
    () => ex('<link rel="preload" as="script" href="/a.js"/>').assets.length,
    1,
  );
  add(
    'preload as=font is NOT counted',
    () => ex('<link rel="preload" as="font" href="/a.woff2"/>').assets.length,
    0,
  );
  add('a script src is counted', () => ex('<script src="/a.js"></script>').assets.length, 1);
  add('a preconnect is not a request', () => ex('<link rel="preconnect" href="//cdn"/>').assets.length, 0);
  add('an icon is not a JS/CSS request', () => ex('<link rel="icon" href="/f.png"/>').assets.length, 0);
  add('an empty document measures nothing', () => ex('').assets.length, 0);

  // --- rules, BOTH directions ---------------------------------------------
  add('a missing ratchet block fails', () => failureKind(() => assertRatchetDeclared(undefined)), 'no-ratchet');
  add('an ARRAY is not a ratchet block', () => failureKind(() => assertRatchetDeclared([])), 'no-ratchet');
  add('an EMPTY ratchet block fails the same way', () => failureKind(() => assertRatchetDeclared({})), 'empty-ratchet');
  add('a pin of 0 fails', () => failureKind(() => assertRatchetDeclared({ '/a': 0 })), 'bad-pin');
  add('a fractional pin fails', () => failureKind(() => assertRatchetDeclared({ '/a': 1.5 })), 'bad-pin');
  add('a populated ratchet block is silent', () => failureKind(() => assertRatchetDeclared({ '/a': 1 })), 'no-throw');
  add(
    'a route that parsed to nothing is INFRASTRUCTURE, not a contract break',
    () => failureKind(() => assertMeasured('/a', [])),
    'infra:nothing-measured',
  );
  add('a route with assets measures them', () => assertMeasured('/a', ['x', 'y']), 2);
  add(
    'a prerendered route with no pin is a coverage gap',
    () => findCoverageGaps([], ['/new']).unratcheted,
    ['/new'],
  );
  add(
    'a pinned route that is no longer prerendered is a coverage gap',
    () => findCoverageGaps(['/gone'], []).vanished,
    ['/gone'],
  );
  add(
    'matching sets have no gaps in either direction',
    () => {
      const g = findCoverageGaps(['/a'], ['/a']);
      return g.unratcheted.length + g.vanished.length;
    },
    0,
  );
  add('over the pin is a break', () => findRatchetBreaks({ '/a': 5 }, { '/a': 6 })[0].direction, 'OVER');
  add('UNDER the pin is also a break', () => findRatchetBreaks({ '/a': 5 }, { '/a': 4 })[0].direction, 'UNDER');
  add('equal to the pin is not a break', () => findRatchetBreaks({ '/a': 5 }, { '/a': 5 }).length, 0);

  // --- discovery, driven against a fake filesystem -------------------------
  const fakeFs = (tree) => ({
    existsSync: (p) => p in tree || Object.keys(tree).some((k) => k.startsWith(p + '/')),
    readdirSync: (dir) =>
      [...new Set(
        Object.keys(tree)
          .filter((k) => k.startsWith(dir + '/'))
          .map((k) => k.slice(dir.length + 1).split('/')[0]),
      )].map((name) => ({
        name,
        isDirectory: () => Object.keys(tree).some((k) => k.startsWith(dir + '/' + name + '/')),
      })),
    readFileSync: (p) => {
      if (!(p in tree)) throw new Error(`ENOENT ${p}`);
      return tree[p];
    },
  });
  const TREE = { 'b/faq/index.html': HTML_OK, 'b/assets/app.js': 'x' };
  add(
    'the walk keys routes by their URL path',
    () => [...listPrerenderedFrom('b', fakeFs(TREE)).keys()],
    ['/faq'],
  );
  add(
    'a missing build is INFRASTRUCTURE and names the fix',
    () => failureKind(() => listPrerenderedFrom('nope', fakeFs(TREE))),
    'infra:no-build',
  );
  add(
    'a build with NO prerendered HTML must not report a pass',
    () => failureKind(() => listPrerenderedFrom('b', fakeFs({ 'b/assets/app.js': 'x' }))),
    'infra:no-prerendered-html',
  );
  add(
    'a verbatim public/ copy is NOT mistaken for a prerendered route',
    () =>
      [
        ...listPrerenderedFrom(
          'b',
          fakeFs({ ...TREE, 'b/legacy/index.html': '<html>static</html>', 'pub/legacy/index.html': '<html>static</html>' }),
          'pub',
        ).keys(),
      ],
    ['/faq'],
  );
  add(
    'a real route is NOT skipped just because public/ has a same-named directory',
    () =>
      [
        ...listPrerenderedFrom(
          'b',
          fakeFs({ ...TREE, 'pub/faq/logo.svg': 'x' }),
          'pub',
        ).keys(),
      ],
    ['/faq'],
  );
  add(
    'with no publicDir given, nothing is skipped',
    () =>
      [
        ...listPrerenderedFrom(
          'b',
          fakeFs({ ...TREE, 'b/legacy/index.html': '<html>static</html>' }),
        ).keys(),
      ].sort(),
    ['/faq', '/legacy'],
  );
  add(
    'the assets directory is not walked for index.html',
    () =>
      [...listPrerenderedFrom('b', fakeFs({ ...TREE, 'b/assets/index.html': HTML_OK })).keys()],
    ['/faq'],
  );
  add(
    'a missing perf-budgets.json is INFRASTRUCTURE',
    () => failureKind(() => readBudgetsFrom('none.json', fakeFs({}))),
    'infra:no-budgets-file',
  );
  add(
    'an UNPARSEABLE perf-budgets.json is INFRASTRUCTURE, never an empty ratchet',
    () => failureKind(() => readBudgetsFrom('x.json', fakeFs({ 'x.json': '{ nope' }))),
    'infra:unparseable-budgets',
  );

  // --- THE EXIT-CODE CONTRACT ITSELF --------------------------------------
  // main() is the function whose return value becomes process.exitCode, so it
  // is driven directly. Each case pins the CODE and the BRANCH: four different
  // branches return 2, and "it returned 2" alone would pass for any of them.
  const codeAnd = (r, needle) =>
    `${r.code}|${r.said.includes(needle) ? 'said' : 'SILENT<<' + r.said.slice(0, 160) + '>>'}`;

  add(
    'PASS: every route matches its pin -> 0',
    () =>
      codeAnd(
        runMain([], { readBudgets: okRatchet, listPrerendered: okDocs }),
        'match their first-load request pin',
      ),
    '0|said',
  );
  add(
    'an unknown flag -> 1, without pretending to have checked',
    () => codeAnd(runMain(['--nope'], { readBudgets: okRatchet, listPrerendered: okDocs }), 'Unknown flag(s)'),
    '1|said',
  );
  add(
    'a missing ratchet block -> 1',
    () => codeAnd(runMain([], { readBudgets: () => ({}), listPrerendered: okDocs }), 'declares no firstLoadRequestRatchet'),
    '1|said',
  );
  add(
    'OVER the pin -> 1',
    () =>
      codeAnd(
        runMain([], {
          readBudgets: () => ({ firstLoadRequestRatchet: { '/faq': HTML_OK_COUNT - 1 } }),
          listPrerendered: okDocs,
        }),
        'Every extra chunk is one more edge request',
      ),
    '1|said',
  );
  add(
    'UNDER the pin -> 1, and says to tighten it',
    () =>
      codeAnd(
        runMain([], {
          readBudgets: () => ({ firstLoadRequestRatchet: { '/faq': HTML_OK_COUNT + 1 } }),
          listPrerendered: okDocs,
        }),
        `This is a WIN`,
      ),
    '1|said',
  );
  add(
    'an unratcheted prerendered route -> 1',
    () =>
      codeAnd(
        runMain([], {
          readBudgets: okRatchet,
          listPrerendered: () => docs([['/faq', HTML_OK], ['/new', HTML_OK]]),
        }),
        'no firstLoadRequestRatchet pin',
      ),
    '1|said',
  );
  add(
    'a pin for a route that is no longer prerendered -> 1',
    () =>
      codeAnd(
        runMain([], {
          readBudgets: () => ({ firstLoadRequestRatchet: { '/faq': HTML_OK_COUNT, '/gone': 9 } }),
          listPrerendered: okDocs,
        }),
        'no longer prerendered',
      ),
    '1|said',
  );
  // The four branches that return 2, each pinned to ITS OWN message. Two go
  // through the real discovery/reader functions against a fake filesystem, so
  // what is proven is the branch and not a stub imitating it.
  add(
    'no build -> 2, via the real walk',
    () =>
      codeAnd(
        runMain([], {
          readBudgets: okRatchet,
          listPrerendered: () => listPrerenderedFrom('nope', fakeFs(TREE)),
        }),
        'No client build at',
      ),
    '2|said',
  );
  add(
    'unreadable budgets -> 2, via the real reader',
    () =>
      codeAnd(
        runMain([], {
          readBudgets: () => readBudgetsFrom('x.json', fakeFs({ 'x.json': '{ nope' })),
          listPrerendered: okDocs,
        }),
        'does not parse',
      ),
    '2|said',
  );
  add(
    'a document that yields no assets -> 2, NOT a contract break',
    () =>
      codeAnd(
        runMain([], { readBudgets: okRatchet, listPrerendered: () => docs([['/faq', '<html></html>']]) }),
        'measured NOTHING',
      ),
    '2|said',
  );
  add(
    'an UNEXPECTED error -> 2 with its stack, never 0',
    () =>
      codeAnd(
        runMain([], {
          readBudgets: () => {
            throw new TypeError('boom');
          },
          listPrerendered: okDocs,
        }),
        'unexpected error',
      ),
    '2|said',
  );

  let failed = 0;
  for (const c of cases) {
    let actual;
    try {
      actual = c.run();
    } catch (err) {
      actual = `THREW: ${err.message}`;
    }
    const ok = JSON.stringify(actual) === JSON.stringify(c.expected);
    if (!ok) {
      failed += 1;
      console.error(
        `FAIL ${c.name}\n  expected ${JSON.stringify(c.expected)}\n  actual   ${JSON.stringify(actual)}`,
      );
    }
  }
  if (failed) {
    console.error(`FAIL self-test -- ${failed} of ${cases.length} case(s).`);
    return false;
  }
  console.log(
    `PASS self-test -- ${cases.length} cases. Every rule is proven in both ` +
      'directions, and every exit code is driven through main() itself.',
  );
  return true;
}

// Entry. process.exitCode rather than process.exit(): a POSIX exit() right
// after a large console.log truncates the pipe, which cost this repo 710 lines
// of a guard's output in Linux CI once already.
if (isEntryPoint(import.meta.url)) {
  const argv = process.argv.slice(2);
  if (argv.includes('--self-test')) {
    process.exitCode = selfTest() ? 0 : 1;
  } else {
    process.exitCode = main(argv);
  }
}
