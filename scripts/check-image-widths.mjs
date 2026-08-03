// Image-width contract: every width and quality that reaches Vercel's image
// optimizer must be one Vercel will actually serve.
//
// THE INCIDENT (2026-07-31). PR #178 shipped a 22px past-event thumbnail on the
// organiser page as cssUrl(e.poster_url, 80). vercel.json's images.sizes is
// [96,160,320,480,640,960,1280] -- 80 is not in it, so /_vercel/image answered
// 400 and six thumbnails rendered blank on production. Nothing was red: the
// call typechecks (the helper takes a plain number), it renders locally (dev
// has no /_vercel/image, so imageCdn.ts returns the original URL), and the only
// signal was prod-smoke counting console errors an hour after the merge.
//
// This is the sibling of the contract check-doc-weight.mjs already guards. That
// one asserts the HOST half -- an <img> must go through /_vercel/image rather
// than straight to R2. This asserts the ARGUMENT half. Both read vercel.json
// itself rather than a hardcoded copy, because a copy that drifts is how the
// original imageCdn no-op survived for months.
//
// FOUR RULES:
//
//   1. imageCdn.ts's SIZES array === vercel.json images.sizes. srcWidthFor()
//      snaps a CSS pixel size up to the nearest entry of SIZES, so it is only
//      safe if SIZES is the real list. Its docstring already said "MUST equal
//      vercel.json images.sizes"; until now nothing checked it.
//   2. EVERY helper's DEFAULT quality is in vercel.json images.qualities. This
//      is where the real exposure lives: measured on the tree, most helper calls
//      pass a literal width and ZERO pass a literal quality, so every optimized
//      URL on the site inherits a default. Drop 70 from images.qualities and
//      every image 400s at once. Both helpers are checked, not just
//      optimizedImageUrl: cssUrl declares its OWN `quality = 70` and forwards
//      it, so checking one left the whole background-image surface -- the half
//      no <img> sweep can see -- guarded by nothing.
//   3. Every LITERAL width passed to the helpers is in images.sizes.
//   4. Every LITERAL quality passed to the helpers is in images.qualities.
//
// A width that is numeric but NOT a plain decimal (0x50, +80, 80.0) is a
// violation in its own right rather than being waved through as "dynamic":
// 0x50 IS 80, and classifying it as unresolvable would let the incident value
// ship again in a different spelling. Genuinely dynamic arguments -- a variable,
// or srcWidthFor(n) -- are not checked, because rule 1 is what makes
// srcWidthFor safe by construction.
//
// Source text is stripped of comments and string literals before scanning
// (scripts/lib/stripSource.mjs, shared with audit-images.mjs), so a doc example
// or a test fixture string is never mistaken for a live call site.
//
// NO SHEBANG, deliberately: tests/imageWidths.test.ts imports this module, and
// vitest compiles an imported file through vm.Script, which does NOT strip a
// shebang the way Node's own module loader does -- it fails with a bare
// "SyntaxError: Invalid or unexpected token" pointing at line 2, nowhere near
// the real cause. Every caller runs it as `node scripts/check-image-widths.mjs`.
//
// Usage:
//   node scripts/check-image-widths.mjs             scan the tree, exit 1 on breach
//   node scripts/check-image-widths.mjs --self-test  prove both directions

import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripCommentsAndStrings } from './lib/stripSource.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
// Only the helpers that exist. optimizedBackgroundImage was listed here and is
// not defined anywhere in the repo -- an advertised guarantee with no subject.
const HELPERS = ['optimizedImageUrl', 'cssUrl'];
// app/ is first-class source (the SSR entry, root.tsx, routes/, seoMeta.ts) and
// vitest already collects it. A literal width added to an SSR route renders
// blank on the surface that paints FIRST, so it cannot be left unscanned.
const SCAN_DIRS = ['src', 'app'];
const SCAN_EXT = /\.(ts|tsx)$/;
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', 'coverage', 'playwright-report']);
// The three JS string delimiters, spelled by char code so this file stays free
// of nested-quote gymnastics: 34 = double, 39 = single, 96 = backtick.
const QUOTES = new Set([String.fromCharCode(34), String.fromCharCode(39), String.fromCharCode(96)]);
const BACKSLASH = String.fromCharCode(92);

/** vercel.json's images block -- the authority every rule here reads. */
export function readVercelImages(root = ROOT) {
  const cfg = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
  const images = cfg.images ?? {};
  return {
    sizes: Array.isArray(images.sizes) ? images.sizes : [],
    qualities: Array.isArray(images.qualities) ? images.qualities : [],
  };
}

/** The SIZES literal declared in imageCdn.ts, or null when it cannot be read. */
export function readHelperSizes(root = ROOT) {
  const src = readImageCdn(root);
  if (src === null) return null;
  const m = src.match(/const\s+SIZES\s*=\s*\[([^\]]*)\]/);
  if (!m) return null;
  const nums = m[1].match(/\d+/g);
  return nums ? nums.map(Number) : [];
}

/**
 * The DEFAULT quality baked into optimizedImageUrl's signature. Every call site
 * relies on it (zero pass a literal), so it is the single value whose drift
 * would 400 every image on the site at once.
 */
export function readHelperDefaultQuality(root = ROOT) {
  const all = readHelperDefaultQualities(root);
  if (all === null) return null;
  const hit = all.find((h) => h.helper === 'optimizedImageUrl');
  return hit ? hit.quality : null;
}

/**
 * EVERY helper's own default quality, not just optimizedImageUrl's.
 *
 * cssUrl declares an INDEPENDENT `quality = 70` and forwards it, so checking
 * only optimizedImageUrl left the entire background-image surface unguarded:
 * change cssUrl's default alone and every optimized background 400s while this
 * check stays green. That is the same shape as the incident it was written for
 * -- a guarantee advertised over a subject nobody verified.
 *
 * @returns {Array<{helper:string, quality:number|null}>|null}
 */
export function readHelperDefaultQualities(root = ROOT) {
  const src = readImageCdn(root);
  if (src === null) return null;
  return HELPERS.map((name) => {
    // <name>\s*\([^)]*quality\s*=\s*(\d+) -- assembled from BACKSLASH because the
    // helper name is dynamic, exactly as findCalls() does it.
    const re = new RegExp(
      name + BACKSLASH + 's*' + BACKSLASH + '([^)]*quality' + BACKSLASH + 's*=' + BACKSLASH + 's*(' + BACKSLASH + 'd+)',
    );
    const m = src.match(re);
    return { helper: name, quality: m ? Number(m[1]) : null };
  });
}

function readImageCdn(root) {
  try {
    return readFileSync(join(root, 'src', 'lib', 'imageCdn.ts'), 'utf8');
  } catch {
    return null;
  }
}

/**
 * Split the argument list of a call whose open paren is at `open`, respecting
 * nested brackets and string/template literals, so that
 * cssUrl(e.poster_url, srcWidthFor(22)) yields two arguments and not three.
 * Returns null when the call is unbalanced (a truncated file).
 */
export function splitArgs(text, open) {
  let depth = 0;
  let quote = null;
  const args = [];
  let start = open + 1;
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === BACKSLASH) { i += 1; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (QUOTES.has(ch)) { quote = ch; continue; }
    if (ch === '(' || ch === '[' || ch === '{') { depth += 1; continue; }
    if (ch === ')' || ch === ']' || ch === '}') {
      depth -= 1;
      if (depth === 0) { args.push(text.slice(start, i)); return args; }
      continue;
    }
    if (ch === ',' && depth === 1) { args.push(text.slice(start, i)); start = i + 1; }
  }
  return null;
}

/**
 * What an argument IS, rather than just "number or not". The middle case is the
 * one that matters: `0x50` and `+80` are numeric literals a reader would call
 * hardcoded, they resolve to widths Vercel rejects, and the previous plain
 * /^\d+$/ test classified them as dynamic and waved them through.
 *
 * @returns {{kind:'absent'}|{kind:'decimal',value:number}|{kind:'odd-numeric',text:string}|{kind:'dynamic'}}
 */
export function classifyArg(arg) {
  if (arg === undefined) return { kind: 'absent' };
  const t = arg.trim();
  if (t === '') return { kind: 'absent' };
  if (/^\d+$/.test(t)) return { kind: 'decimal', value: Number(t) };
  // Starts like a number but is not a plain decimal: 0x50, +80, 80.0, 1e2, 8_0.
  if (/^[+-]?[.\d]/.test(t)) return { kind: 'odd-numeric', text: t };
  return { kind: 'dynamic' };
}

/** Every helper call in RAW text, with its width/quality arguments classified. */
export function findCalls(text) {
  const out = [];
  for (const name of HELPERS) {
    // Pattern chars are assembled from BACKSLASH so this file needs no escaped
    // backslash literals: <name>\s*\(
    const re = new RegExp(BACKSLASH + 'b' + name + BACKSLASH + 's*' + BACKSLASH + '(', 'g');
    let m;
    while ((m = re.exec(text)) !== null) {
      // A property access (helpers.cssUrl(...)) or a longer identifier ending in
      // the helper name is a different function -- do not claim it.
      const before = text[m.index - 1];
      if (before === '.' || (before && /[A-Za-z0-9_$]/.test(before))) continue;
      const open = m.index + m[0].length - 1;
      const args = splitArgs(text, open);
      if (!args) continue;
      out.push({
        helper: name,
        index: m.index,
        line: text.slice(0, m.index).split('\n').length,
        width: classifyArg(args[1]),
        quality: classifyArg(args[2]),
      });
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

/**
 * What the scanner actually runs on real files: comments and string literals
 * blanked first, so `// never write cssUrl(u, 80)` in a doc block, or a fixture
 * string in a spec, is not reported as a live call. Line numbers survive
 * because the stripper replaces content with spaces and keeps newlines.
 */
export function scanSource(text) {
  return findCalls(stripCommentsAndStrings(text));
}

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) walk(abs, acc);
    else if (SCAN_EXT.test(entry)) acc.push(abs);
  }
  return acc;
}

/**
 * The whole contract as one decision, so callers (vitest, --self-test, the CLI)
 * share it and a fixture root can be driven through the real code path.
 *
 * FAIL-LOUD: an fs error, a missing scan directory, or a scan that measured
 * nothing is a VIOLATION, not a quiet zero. The previous version wrapped the
 * whole walk in one try/catch and returned `{scanned: 0, calls: 0}` with no
 * violation, so a single EPERM on this repo's FUSE mount made the CI step print
 * "ok (0 helper call(s) across 0 file(s))" and exit 0 -- a guard that fails open
 * is the dead-check failure this repo exists to kill.
 *
 * @returns {{violations: string[], scanned: number, calls: number}}
 */
export function checkTree(root = ROOT, scanDirs = SCAN_DIRS) {
  const violations = [];
  let sizes = [];
  let qualities = [];
  try {
    ({ sizes, qualities } = readVercelImages(root));
  } catch (err) {
    return { violations: [`vercel.json could not be read: ${err.message}`], scanned: 0, calls: 0 };
  }

  if (sizes.length === 0) {
    violations.push('vercel.json declares no images.sizes -- every optimized width would 400.');
  }
  if (qualities.length === 0) {
    violations.push('vercel.json declares no images.qualities -- every optimized quality would 400.');
  }

  // Rule 1 -- what makes srcWidthFor() safe.
  const helperSizes = readHelperSizes(root);
  if (helperSizes === null) {
    violations.push('src/lib/imageCdn.ts: could not read the SIZES literal (rule 1 unverifiable).');
  } else if (JSON.stringify(helperSizes) !== JSON.stringify(sizes)) {
    violations.push(
      `src/lib/imageCdn.ts: SIZES [${helperSizes.join(',')}] !== vercel.json images.sizes ` +
        `[${sizes.join(',')}] -- srcWidthFor() would snap to a width Vercel will not serve.`,
    );
  }

  // Rule 2 -- the default every call site inherits. Checked for EVERY helper:
  // each declares its own literal, and cssUrl's covers the background-image
  // surface that no <img> sweep can see.
  const defaults = readHelperDefaultQualities(root);
  if (defaults === null) {
    violations.push('src/lib/imageCdn.ts: could not be read (rule 2 unverifiable).');
  } else {
    for (const { helper, quality } of defaults) {
      if (quality === null) {
        violations.push(`src/lib/imageCdn.ts: could not read ${helper}'s default quality (rule 2 unverifiable).`);
      } else if (qualities.length > 0 && !qualities.includes(quality)) {
        violations.push(
          `src/lib/imageCdn.ts: ${helper} default quality ${quality} is not in vercel.json ` +
            `images.qualities [${qualities.join(',')}] -- EVERY image through it would 400.`,
        );
      }
    }
  }

  let files = [];
  for (const rel of scanDirs) {
    try {
      walk(join(root, rel), files);
    } catch (err) {
      violations.push(`scan directory ${rel}/ could not be walked (${err.message}) -- refusing to report a partial pass.`);
    }
  }

  let calls = 0;
  for (const abs of files) {
    const rel = abs.slice(root.length).replace(/\\/g, '/').replace(/^\//, '');
    let text;
    try {
      text = readFileSync(abs, 'utf8');
    } catch (err) {
      violations.push(`${rel}: could not be read (${err.message}) -- refusing to report a partial pass.`);
      continue;
    }
    for (const call of scanSource(text)) {
      calls += 1;
      const where = `${rel}:${call.line}: ${call.helper}`;
      if (call.width.kind === 'decimal' && !sizes.includes(call.width.value)) {
        violations.push(
          `${where}(..., ${call.width.value}) -- width not in vercel.json images.sizes ` +
            `[${sizes.join(',')}]. /_vercel/image answers 400. Use srcWidthFor(<css px>).`,
        );
      } else if (call.width.kind === 'odd-numeric') {
        violations.push(
          `${where}(..., ${call.width.text}) -- numeric width that is not a plain decimal, so it ` +
            'cannot be checked against images.sizes. Write a plain decimal or use srcWidthFor(<css px>).',
        );
      }
      if (call.quality.kind === 'decimal' && qualities.length > 0 && !qualities.includes(call.quality.value)) {
        violations.push(
          `${where}(..., ..., ${call.quality.value}) -- quality not in vercel.json images.qualities ` +
            `[${qualities.join(',')}]. /_vercel/image answers 400.`,
        );
      } else if (call.quality.kind === 'odd-numeric') {
        violations.push(
          `${where}(..., ..., ${call.quality.text}) -- numeric quality that is not a plain decimal, ` +
            'so it cannot be checked against images.qualities.',
        );
      }
    }
  }

  // The fail-loud measurement contract: an empty scan and a clean scan are
  // indistinguishable in the output, so an empty one must not be a pass.
  if (files.length === 0) {
    violations.push(`no source files found under [${scanDirs.join(', ')}] -- the scan measured nothing.`);
  } else if (calls === 0) {
    violations.push(
      `${files.length} file(s) scanned but ZERO helper calls found -- either the helpers were ` +
        'renamed (update HELPERS) or the scanner is broken. A guard that measures nothing is not a pass.',
    );
  }

  return { violations, scanned: files.length, calls };
}

/**
 * A throwaway repo root, so the RULES can be driven through checkTree() itself
 * rather than asserted against a hand-copied list. The previous self-test
 * compared two literal arrays with JSON.stringify -- a JavaScript identity that
 * passes no matter how checkTree, readHelperSizes or readVercelImages behave,
 * which meant rule 1's RED direction was never actually exercised.
 */
function fixtureRoot({ sizes, qualities, helperSizes, defaultQuality, cssQuality, callWidth }) {
  const dir = mkdtempSync(join(tmpdir(), 'imgw-'));
  mkdirSync(join(dir, 'src', 'lib'), { recursive: true });
  mkdirSync(join(dir, 'app'), { recursive: true });
  writeFileSync(join(dir, 'vercel.json'), JSON.stringify({ images: { sizes, qualities } }));
  // BOTH helpers, each with its own default -- rule 2 checks every one, and a
  // fixture carrying only optimizedImageUrl could not tell the difference.
  writeFileSync(
    join(dir, 'src', 'lib', 'imageCdn.ts'),
    `export function optimizedImageUrl(url: string, width: number, quality = ${defaultQuality}): string { return url + width + quality; }\n` +
      `export function cssUrl(url: string, width: number, quality = ${cssQuality}): string { return url + width + quality; }\n` +
      `const SIZES = [${helperSizes.join(', ')}] as const;\n`,
  );
  writeFileSync(join(dir, 'src', 'page.tsx'), `const a = cssUrl(u, ${callWidth});\n`);
  return dir;
}

const CLEAN_FIXTURE = {
  sizes: [96, 320],
  qualities: [70],
  helperSizes: [96, 320],
  defaultQuality: 70,
  cssQuality: 70,
  callWidth: '96',
};

// THE STRAY-QUOTE FAIL-OPEN (found 2026-08-03 in review of this very branch).
// stripCommentsAndStrings treated EVERY quote as a string opener, so an
// apostrophe in JSX text or a quote inside a regex literal opened a phantom
// string that ran to the next matching quote anywhere later in the file --
// blanking real call sites on the way. Measured on this tree: 15 of 531 scanned
// files were partly invisible, i.e. the guard reported ok over code it had never
// looked at. Each fixture puts the stray quote on one line and a REAL violating
// call on a LATER line; the call must still be found. Spelled by char code so
// this file stays free of the characters under test.
const APOSTROPHE = String.fromCharCode(39);
const DOUBLE_QUOTE = String.fromCharCode(34);
const BACKTICK = String.fromCharCode(96);
const LF = String.fromCharCode(10);
const STRAY_APOSTROPHE = '<p>What' + APOSTROPHE + 's On</p>' + LF + 'const a = cssUrl(u, 80);';
const STRAY_REGEX_QUOTE =
  's.replace(/' + DOUBLE_QUOTE + '/g, ' + DOUBLE_QUOTE + '&quot;' + DOUBLE_QUOTE + ');' +
  LF + 'const a = cssUrl(u, 80);';
// The other direction: a template literal DOES legally span lines, so it must
// still be blanked whole. Narrowing the rule to backticks as well would trade
// this fail-open for a fail-closed one.
const MULTILINE_TEMPLATE = 'const t = ' + BACKTICK + 'one' + LF + 'cssUrl(u, 80)' + BACKTICK + ';';

/**
 * Both directions, driven through the real code path. Returns a total so the
 * CLI reports the true count instead of a hardcoded one that silently lies the
 * moment an assertion is added.
 *
 * @returns {{total:number, failures:string[]}}
 */
export function selfTestFailures() {
  const failures = [];
  let total = 0;
  const expect = (label, cond) => { total += 1; if (!cond) failures.push(label); };
  const withRoot = (over) => {
    const dir = fixtureRoot({ ...CLEAN_FIXTURE, ...over });
    try {
      return checkTree(dir).violations;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
  const has = (vs, needle) => vs.some((v) => v.includes(needle));

  // --- parsing, on the shapes that actually occur ---
  expect(
    'splitArgs: a nested call counts as ONE argument',
    findCalls('cssUrl(e.poster_url, srcWidthFor(22))')[0].width.kind === 'dynamic',
  );
  expect('findCalls: a plain decimal width is captured', findCalls('cssUrl(u, 80)')[0].width.value === 80);
  expect('findCalls: a plain decimal quality is captured', findCalls('optimizedImageUrl(u, 320, 70)')[0].quality.value === 70);
  expect('findCalls: object/array args do not break the split', findCalls('optimizedImageUrl({ a: [1, 2] }, 96)')[0].width.value === 96);
  expect('findCalls: a property access of the same name is NOT claimed', findCalls('helpers.cssUrl(u, 80)').length === 0);
  expect('findCalls: a longer identifier ending in the helper name is NOT claimed', findCalls('myCssUrl(u, 80)').length === 0);
  expect('findCalls: an unbalanced call is skipped, not crashed on', findCalls('cssUrl(u, 80').length === 0);
  expect('findCalls: reports the correct 1-based line', findCalls('const a = 1;\nconst b = 2;\ncssUrl(u, 80)')[0].line === 3);

  // --- comments and strings are not call sites (scanSource, the real path) ---
  expect('scanSource: a commented-out call is NOT a call site', scanSource('// cssUrl(u, 80)').length === 0);
  expect('scanSource: a call inside a doc block is NOT a call site', scanSource('/** e.g. cssUrl(poster, 480) */').length === 0);
  expect('scanSource: a fixture STRING is NOT a call site', scanSource('const s = "cssUrl(u, 80)";').length === 0);
  expect('scanSource: a real call still IS one', scanSource('const a = cssUrl(u, 80);')[0].width.value === 80);
  expect(
    'scanSource: stripping preserves line numbers',
    scanSource('// pad\n/* pad */\nconst a = cssUrl(u, 80);')[0].line === 3,
  );

  // --- the stray-quote fail-open, both directions ---
  expect(
    'scanSource: an apostrophe in JSX text does not blind the rest of the file',
    scanSource(STRAY_APOSTROPHE)[0]?.width.value === 80,
  );
  expect(
    'scanSource: a quote inside a regex literal does not blind the rest of the file',
    scanSource(STRAY_REGEX_QUOTE)[0]?.width.value === 80,
  );
  expect(
    'scanSource: a stray quote does not shift later line numbers',
    scanSource(STRAY_APOSTROPHE)[0]?.line === 2,
  );
  expect(
    'scanSource: a multi-line template literal is STILL blanked whole',
    scanSource(MULTILINE_TEMPLATE).length === 0,
  );

  // --- non-plain-decimal numeric literals are violations, not "dynamic" ---
  expect('classifyArg: 80 with a trailing comment is caught once stripped', scanSource('cssUrl(u, 80 /* px */)')[0].width.value === 80);
  expect('classifyArg: 0x50 is odd-numeric, not dynamic', findCalls('cssUrl(u, 0x50)')[0].width.kind === 'odd-numeric');
  expect('classifyArg: +80 is odd-numeric, not dynamic', findCalls('cssUrl(u, +80)')[0].width.kind === 'odd-numeric');
  expect('classifyArg: 80.0 is odd-numeric, not dynamic', findCalls('cssUrl(u, 80.0)')[0].width.kind === 'odd-numeric');
  expect('classifyArg: srcWidthFor(22) stays dynamic despite containing digits', findCalls('cssUrl(u, srcWidthFor(22))')[0].width.kind === 'dynamic');

  // --- every RULE, both directions, through checkTree() on a fixture root ---
  expect('GREEN: a clean fixture root reports no violation', withRoot({}).length === 0);
  expect(
    'RED rule 1: imageCdn SIZES drifted from vercel.json images.sizes',
    has(withRoot({ helperSizes: [96, 480] }), 'srcWidthFor() would snap to a width Vercel will not serve'),
  );
  expect(
    'RED rule 2: optimizedImageUrl default quality is not in images.qualities',
    has(withRoot({ defaultQuality: 75 }), 'optimizedImageUrl default quality 75'),
  );
  expect(
    "RED rule 2: cssUrl's OWN default quality is checked too (the background surface)",
    has(withRoot({ cssQuality: 75 }), 'cssUrl default quality 75'),
  );
  expect(
    'RED rule 3: a literal width outside images.sizes (the #178 defect)',
    has(withRoot({ callWidth: '80' }), 'width not in vercel.json images.sizes'),
  );
  expect(
    'RED rule 3: a numeric width that is not a plain decimal',
    has(withRoot({ callWidth: '0x50' }), 'not a plain decimal'),
  );
  expect(
    'RED: vercel.json declaring no sizes at all',
    has(withRoot({ sizes: [] }), 'declares no images.sizes'),
  );
  expect(
    'RED: vercel.json declaring no qualities at all',
    has(withRoot({ qualities: [] }), 'declares no images.qualities'),
  );
  // withRoot() cannot express this one (it pins scanDirs), so the fixture root is
  // built by hand -- and must still be removed. The first cut leaked one temp
  // directory per --self-test run, which the lint chain invokes on every push.
  const emptyScanRoot = fixtureRoot(CLEAN_FIXTURE);
  try {
    expect(
      'RED: a scan that measures nothing is not a pass',
      has(checkTree(emptyScanRoot, ['does-not-exist']).violations, 'measured nothing'),
    );
  } finally {
    rmSync(emptyScanRoot, { recursive: true, force: true });
  }

  // --- and the live tree must be clean right now ---
  const live = checkTree();
  expect(`LIVE: tree is clean (${live.violations.join(' | ')})`, live.violations.length === 0);
  expect(`LIVE: the scan actually found calls (${live.calls})`, live.calls > 0);

  return { total, failures };
}

// Only act when run as a CLI -- importing this module must not scan or exit.
const invokedDirectly =
  typeof process.argv[1] === 'string' && process.argv[1].replace(/\\/g, '/').endsWith('check-image-widths.mjs');

if (invokedDirectly && process.argv.includes('--self-test')) {
  const { total, failures } = selfTestFailures();
  if (failures.length > 0) {
    console.error(`check-image-widths --self-test: FAILED (${failures.length}/${total})`);
    for (const f of failures) console.error(`  x ${f}`);
    process.exitCode = 1;
  } else {
    console.log(`check-image-widths --self-test: ${total}/${total} ok`);
  }
} else if (invokedDirectly) {
  const { violations, scanned, calls } = checkTree();
  if (violations.length > 0) {
    console.error('Image-width contract: BREACH');
    for (const v of violations) console.error(`  x ${v}`);
    console.error(
      '\nWhy this matters: /_vercel/image returns 400 for a width or quality not declared\n' +
        'in vercel.json, so the image renders blank on production while typechecking,\n' +
        'linting and rendering fine in dev. See the header of this file.',
    );
    process.exitCode = 1;
  } else {
    console.log(`Image-width contract: ok (${calls} helper call(s) across ${scanned} file(s)).`);
  }
}
