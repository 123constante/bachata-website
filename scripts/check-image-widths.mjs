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
// FIVE RULES:
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
//   5. A width or quality passed as a bare identifier that a `const` in the SAME
//      file binds to a plain decimal is resolved and checked as that decimal.
//      Rules 3 and 4 are otherwise trivially evaded by the most ordinary
//      refactor of all: `const THUMB = 80; cssUrl(u, THUMB)`.
//
// WHAT COUNTS AS A LITERAL, since the incident value has more than one spelling:
//
//   * A plain decimal (80) is checked -- the incident itself.
//   * A SINGLE numeric token that is not a plain decimal (0x50, +80, 80.0, 1e2,
//     8_0) is a violation in its own right rather than being waved through as
//     "dynamic": 0x50 IS 80, and calling it unresolvable would let the incident
//     value ship again in a different spelling.
//   * A TypeScript cast decides nothing about the value, so it is stripped
//     first: `320 as number` is the literal 320. Classifying the cast as a
//     not-a-plain-decimal violation red-lit correct code (review finding).
//   * An EXPRESSION (2 * srcWidthFor(48)) is dynamic, not a bad literal. The
//     first cut tested "starts with a digit", which reds arithmetic with advice
//     -- "write a plain decimal" -- that is actively wrong for it.
//   * A bare identifier bound to a plain decimal by a `const` IN THE SAME FILE
//     is resolved and checked (rule 5). Extracting the literal to a named
//     constant is the most ordinary refactor there is, and until this landed it
//     reproduced the #178 incident with the guard green (review finding).
//
// Everything else -- a variable from elsewhere, a prop, srcWidthFor(n) -- is
// genuinely dynamic and unchecked, because rule 1 is what makes srcWidthFor safe
// by construction.
//
// Source text is stripped of comments and string literals before scanning
// (scripts/lib/stripSource.mjs, shared with audit-images.mjs), so a doc example
// or a test fixture string is never mistaken for a live call site. THAT INCLUDES
// imageCdn.ts itself, which rules 1 and 2 read: it already carries
// `cssUrl(poster, 480)` in a docstring, and reading it raw let a doc example
// satisfy the rule the header calls the real exposure (review finding). Both
// rules also anchor on `function <name>(`, so only a real signature can answer.
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
import { closesOnSameLine, stripCommentsAndStrings } from './lib/stripSource.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
// Only the helpers that exist. optimizedBackgroundImage was listed here and is
// not defined anywhere in the repo -- an advertised guarantee with no subject.
const HELPERS = ['optimizedImageUrl', 'cssUrl'];
// Where those helpers are DEFINED. Call sites here prove nothing about the rest
// of the tree, so the "the scan measured something" tripwire counts calls found
// anywhere else -- see checkTree.
const HELPER_MODULE = 'src/lib/imageCdn.ts';
// app/ is first-class source (the SSR entry, root.tsx, routes/, seoMeta.ts) and
// vitest already collects it. A literal width added to an SSR route renders
// blank on the surface that paints FIRST, so it cannot be left unscanned.
const SCAN_DIRS = ['src', 'app'];
const SCAN_EXT = /\.(ts|tsx)$/;
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', 'coverage', 'playwright-report']);
// The three JS string delimiters, spelled by char code so this file stays free
// of nested-quote gymnastics: 34 = double, 39 = single, 96 = backtick. Named
// individually because splitArgs has to treat the backtick differently -- a
// template literal is the one that legitimately spans lines -- and because the
// self-test fixtures further down need the same characters.
const DOUBLE_QUOTE = String.fromCharCode(34);
const APOSTROPHE = String.fromCharCode(39);
const BACKTICK = String.fromCharCode(96);
const QUOTES = new Set([DOUBLE_QUOTE, APOSTROPHE, BACKTICK]);
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
    // function\s+<name>\s*\([^)]*quality\s*=\s*(\d+) -- assembled from BACKSLASH
    // because the helper name is dynamic, exactly as findCalls() does it.
    // ANCHORED ON `function` so only a real signature can answer this rule: the
    // source is stripped (see readImageCdn) and the anchor is the second lock,
    // because a green from a doc example is the exact fail-open shape #178 was.
    const re = new RegExp(
      'function' + BACKSLASH + 's+' + name + BACKSLASH + 's*' + BACKSLASH + '([^)]*quality' + BACKSLASH + 's*=' + BACKSLASH + 's*(' + BACKSLASH + 'd+)',
    );
    const m = src.match(re);
    return { helper: name, quality: m ? Number(m[1]) : null };
  });
}

/**
 * imageCdn.ts as rules 1 and 2 must read it: COMMENTS AND STRINGS BLANKED.
 *
 * Every other read in this file strips first so a doc example is never mistaken
 * for code; these two did not, and took the FIRST regex match. imageCdn.ts
 * already carries `cssUrl(poster, 480)` in a docstring above the function, so
 * the shape was live: a doc line reading `function cssUrl(url, width, quality =
 * 70)` above a signature whose real default had drifted to an unserved value
 * would have answered rule 2 with the comment and reported green -- a fail-open
 * in the rule this file's header calls the real exposure (review finding).
 */
function readImageCdn(root) {
  try {
    return stripCommentsAndStrings(readFileSync(join(root, 'src', 'lib', 'imageCdn.ts'), 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Split the argument list of a call whose open paren is at `open`, respecting
 * nested brackets and string/template literals, so that
 * cssUrl(e.poster_url, srcWidthFor(22)) yields two arguments and not three.
 * Returns null when the call is unbalanced (a truncated file) -- which findCalls
 * now reports as a VIOLATION rather than as an absent call site.
 *
 * A QUOTE ONLY OPENS A STRING IF IT CLOSES ON THE SAME LINE -- the rule
 * stripSource.mjs applies, imported rather than re-derived. scanSource strips
 * before splitting, so every quote this function still sees is by construction a
 * STRAY one (an apostrophe in JSX text, a quote inside a regex literal). Opening
 * a phantom string on those ran the scan to EOF unbalanced, and the call was
 * then dropped: cssUrl(u.replace(/'/g, ''), 80) yielded NO call sites at all, so
 * the incident literal shipped blank while the check printed "ok" (review
 * finding -- a fail-open in the guard written to be fail-loud).
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
    if (QUOTES.has(ch) && (ch === BACKTICK || closesOnSameLine(text, i, ch))) { quote = ch; continue; }
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

/** `const NAME = <plain decimal>` -- with an optional `: number` annotation and
 *  an optional `as const`, which is how the repo actually spells them. */
const NUMERIC_CONST_RE = /\bconst\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?::\s*number\s*)?=\s*(\d+)(?![\w.])/g;

/**
 * Every module-local name bound to a plain decimal, so rule 5 can resolve
 * `const THUMB = 80; cssUrl(u, THUMB)`.
 *
 * Extracting a literal to a named constant is the most ordinary refactor there
 * is, and it reproduced the #178 incident with the guard reporting green: rule 1
 * makes srcWidthFor() safe BY CONSTRUCTION, but a bare identifier carries no
 * such guarantee and was classified dynamic all the same (review finding).
 *
 * DELIBERATELY SCOPE-BLIND, and only `const`: two different values under one
 * name in one file cannot be resolved from a regex, so that name is dropped
 * rather than guessed at, and `let`/`var` are ignored because a later
 * reassignment would make any answer here a lie. The cost of both is a missed
 * catch, never a false red -- the correct direction for a guard to fail.
 *
 * @returns {Map<string, number>}
 */
export function readNumericConsts(text) {
  const seen = new Map();
  const ambiguous = new Set();
  NUMERIC_CONST_RE.lastIndex = 0;
  let m;
  while ((m = NUMERIC_CONST_RE.exec(text)) !== null) {
    const name = m[1];
    const value = Number(m[2]);
    if (seen.has(name) && seen.get(name) !== value) ambiguous.add(name);
    seen.set(name, value);
  }
  for (const name of ambiguous) seen.delete(name);
  return seen;
}

/**
 * What an argument IS, rather than just "number or not".
 *
 * odd-numeric is the case that matters: `0x50` and `+80` are numeric literals a
 * reader would call hardcoded, they resolve to widths Vercel rejects, and the
 * original plain /^\d+$/ test classified them as dynamic and waved them through.
 *
 * TWO CORRECTIONS to the first cut of that test, both review findings, both
 * measured on constructed cases rather than argued:
 *
 *   * A CAST decides nothing about the value. `320 as number` is the literal
 *     320, and the cast is stripped before classifying. It used to read as
 *     odd-numeric, i.e. correct code red-lit.
 *   * odd-numeric means A SINGLE NUMERIC TOKEN, not "starts with a digit".
 *     `2 * srcWidthFor(48)` is a dynamic expression; the old test called it
 *     odd-numeric and CI would have told the author to "write a plain decimal",
 *     which is actively wrong advice for it.
 *
 * `consts` is the module-local const map from readNumericConsts (rule 5); pass
 * null to classify an argument in isolation.
 *
 * @returns {{kind:'absent'}|{kind:'decimal',value:number,via?:string}|{kind:'odd-numeric',text:string}|{kind:'dynamic'}}
 */
export function classifyArg(arg, consts = null) {
  if (arg === undefined) return { kind: 'absent' };
  const raw = arg.trim();
  if (raw === '') return { kind: 'absent' };
  const t = raw.replace(/\s+as\s+[A-Za-z_$][A-Za-z0-9_$.<>[\]|\s]*$/, '').trim();
  if (t === '') return { kind: 'absent' };
  if (/^\d+$/.test(t)) return { kind: 'decimal', value: Number(t) };
  // One numeric token that is not a plain decimal: 0x50, +80, 80.0, 1e2, 8_0.
  // Anything with an operator, a call or a space in it is an expression.
  const unsigned = t.replace(/^[+-]\s*/, '');
  if (/^(\d[A-Za-z0-9_.]*|\.\d[A-Za-z0-9_]*)$/.test(unsigned)) return { kind: 'odd-numeric', text: t };
  // Rule 5: a bare identifier this file binds to a plain decimal.
  if (consts && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(t) && consts.has(t)) {
    return { kind: 'decimal', value: consts.get(t), via: t };
  }
  return { kind: 'dynamic' };
}

/**
 * Every helper CALL SITE in RAW text, with its width/quality arguments
 * classified. `consts` is the module-local const map for rule 5 (see
 * readNumericConsts); scanSource supplies it.
 *
 * A call whose argument list will not parse comes back with `unparsed: true`
 * rather than being dropped -- checkTree turns that into a violation.
 */
export function findCalls(text, consts = null) {
  const out = [];
  for (const name of HELPERS) {
    // Pattern chars are assembled from BACKSLASH so this file needs no escaped
    // backslash literals: <name>\s*\(
    const re = new RegExp(BACKSLASH + 'b' + name + BACKSLASH + 's*' + BACKSLASH + '(', 'g');
    let m;
    while ((m = re.exec(text)) !== null) {
      // A property access (helpers.cssUrl(...)) or a longer identifier ending in
      // the helper name is a different function -- do not claim it.
      const before = text[m.index - 1];
      if (before === '.' || (before && /[A-Za-z0-9_$]/.test(before))) continue;
      // A DECLARATION IS NOT A CALL SITE. `export function cssUrl(` matched here,
      // so imageCdn.ts contributed two entries to every scan and the "ZERO
      // helper calls found" tripwire could never fire: delete every real call
      // site and the count still floored at 2, reported green (review finding).
      if (/\bfunction\s+$/.test(text.slice(Math.max(0, m.index - 32), m.index))) continue;
      const open = m.index + m[0].length - 1;
      const line = text.slice(0, m.index).split('\n').length;
      const args = splitArgs(text, open);
      if (!args) {
        // FAIL LOUD. `continue` here dropped an unparseable call site silently,
        // which is the one thing this guard exists not to do: a literal 80 on a
        // line the splitter choked on shipped blank while the check printed ok.
        out.push({ helper: name, index: m.index, line, unparsed: true, width: { kind: 'unparsed' }, quality: { kind: 'unparsed' } });
        continue;
      }
      out.push({
        helper: name,
        index: m.index,
        line,
        unparsed: false,
        width: classifyArg(args[1], consts),
        quality: classifyArg(args[2], consts),
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
  // The const map for rule 5 is read from the STRIPPED text too, so a
  // `const THUMB = 80` inside a doc block or a fixture string cannot define a
  // binding the scanner then resolves against.
  const stripped = stripCommentsAndStrings(text);
  return findCalls(stripped, readNumericConsts(stripped));
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

/** How a resolved numeric reads in a violation. A width reached through rule 5
 *  names the constant as well as the value, so the reader is not left grepping
 *  for where 80 came from. */
function describeNumeric(c) {
  return c.via ? `${c.via} = ${c.value}` : String(c.value);
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
 * `callSites` is the one the measurement contract gates on, and it is what
 * tests/imageWidths.test.ts destructures -- do not drop it from the return
 * object on the strength of a signature that used to omit it (it did, until
 * review on 2026-08-26).
 *
 * @returns {{violations: string[], scanned: number, calls: number, callSites: number}}
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
  // Calls found OUTSIDE the helper module. `calls` alone cannot arbitrate the
  // measurement contract below: findCalls used to claim imageCdn.ts's own two
  // `export function` lines, so the count floored at 2 no matter how blind the
  // scanner was. Declarations are skipped now; this is the second lock.
  let callSites = 0;
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
      if (rel !== HELPER_MODULE) callSites += 1;
      const where = `${rel}:${call.line}: ${call.helper}`;
      if (call.unparsed) {
        violations.push(
          `${where}(...) -- the argument list could not be parsed, so this call's width and ` +
            'quality were never checked. A call site the scanner cannot read is a breach, not a ' +
            'pass: skipping it silently is how a literal width ships blank under a green check.',
        );
        continue;
      }
      if (call.width.kind === 'decimal' && !sizes.includes(call.width.value)) {
        violations.push(
          `${where}(..., ${describeNumeric(call.width)}) -- width not in vercel.json images.sizes ` +
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
          `${where}(..., ..., ${describeNumeric(call.quality)}) -- quality not in vercel.json images.qualities ` +
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
  // indistinguishable in the output, so an empty one must not be a pass. It is
  // gated on callSites, NOT on calls -- see the callSites declaration for why
  // the raw count could never reach zero and so could never trip.
  if (files.length === 0) {
    violations.push(`no source files found under [${scanDirs.join(', ')}] -- the scan measured nothing.`);
  } else if (callSites === 0) {
    violations.push(
      `${files.length} file(s) scanned but ZERO helper call sites found outside ${HELPER_MODULE} -- ` +
        'either the helpers were renamed (update HELPERS) or the scanner is broken. A guard that ' +
        'measures nothing is not a pass.',
    );
  }

  return { violations, scanned: files.length, calls, callSites };
}

/**
 * A throwaway repo root, so the RULES can be driven through checkTree() itself
 * rather than asserted against a hand-copied list. The previous self-test
 * compared two literal arrays with JSON.stringify -- a JavaScript identity that
 * passes no matter how checkTree, readHelperSizes or readVercelImages behave,
 * which meant rule 1's RED direction was never actually exercised.
 */
function fixtureRoot({ sizes, qualities, helperSizes, defaultQuality, cssQuality, callWidth, callText, docSizes, docQuality }) {
  const dir = mkdtempSync(join(tmpdir(), 'imgw-'));
  mkdirSync(join(dir, 'src', 'lib'), { recursive: true });
  mkdirSync(join(dir, 'app'), { recursive: true });
  writeFileSync(join(dir, 'vercel.json'), JSON.stringify({ images: { sizes, qualities } }));
  // A DOC BLOCK ABOVE THE REAL SIGNATURES, when asked for. Rules 1 and 2 take
  // the first regex match, so a fixture that omits this cannot tell a stripped
  // read from an unstripped one -- and the real imageCdn.ts does carry a
  // cssUrl(...) example in a docstring.
  const doc =
    (docSizes ? `/** e.g. const SIZES = [${docSizes.join(', ')}] */\n` : '') +
    (docQuality ? `/** e.g. function cssUrl(url, width, quality = ${docQuality}) */\n` : '');
  // BOTH helpers, each with its own default -- rule 2 checks every one, and a
  // fixture carrying only optimizedImageUrl could not tell the difference.
  writeFileSync(
    join(dir, 'src', 'lib', 'imageCdn.ts'),
    doc +
      `export function optimizedImageUrl(url: string, width: number, quality = ${defaultQuality}): string { return url + width + quality; }\n` +
      `export function cssUrl(url: string, width: number, quality = ${cssQuality}): string { return url + width + quality; }\n` +
      `const SIZES = [${helperSizes.join(', ')}] as const;\n`,
  );
  writeFileSync(join(dir, 'src', 'page.tsx'), (callText ?? `const a = cssUrl(u, ${callWidth});`) + '\n');
  return dir;
}

const CLEAN_FIXTURE = {
  sizes: [96, 320],
  qualities: [70],
  helperSizes: [96, 320],
  defaultQuality: 70,
  cssQuality: 70,
  callWidth: '96',
  callText: null,
  docSizes: null,
  docQuality: null,
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
const LF = String.fromCharCode(10);
const STRAY_APOSTROPHE = '<p>What' + APOSTROPHE + 's On</p>' + LF + 'const a = cssUrl(u, 80);';
const STRAY_REGEX_QUOTE =
  's.replace(/' + DOUBLE_QUOTE + '/g, ' + DOUBLE_QUOTE + '&quot;' + DOUBLE_QUOTE + ');' +
  LF + 'const a = cssUrl(u, 80);';
// The other direction: a template literal DOES legally span lines, so it must
// still be blanked whole. Narrowing the rule to backticks as well would trade
// this fail-open for a fail-closed one.
const MULTILINE_TEMPLATE = 'const t = ' + BACKTICK + 'one' + LF + 'cssUrl(u, 80)' + BACKTICK + ';';
// THE SPLITARGS FAIL-OPEN (found 2026-08-04 reviewing the fix above). Stripping
// deliberately LEAVES a stray quote in place, and splitArgs then treated it as a
// string opener, ran to EOF unbalanced, and the whole call was discarded with no
// violation: a literal 80 here shipped blank while the check printed ok.
const STRAY_QUOTE_ARGLIST =
  'const a = cssUrl(u.replace(/' + APOSTROPHE + '/g, ' + APOSTROPHE + APOSTROPHE + '), 80);';
// Rule 5: the incident value, spelled the way the most ordinary refactor spells
// it. srcWidthFor() is safe by construction; a bare identifier is not.
const NAMED_CONSTANT_WIDTH = 'const THUMB = 80;' + LF + 'const a = cssUrl(u, THUMB);';

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
  expect('findCalls: an unbalanced call is REPORTED, not silently skipped', findCalls('cssUrl(u, 80')[0]?.unparsed === true);
  expect(
    'findCalls: a DECLARATION is not a call site (what floored the tripwire at 2)',
    findCalls('export function cssUrl(url: string, width: number, quality = 70): string {').length === 0,
  );
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
  expect(
    'scanSource: a stray quote in the ARGUMENT LIST no longer discards the call',
    scanSource(STRAY_QUOTE_ARGLIST)[0]?.width.value === 80,
  );

  // --- rule 5: a width extracted to a named constant is still a literal ---
  expect('scanSource: const THUMB = 80 resolves through the identifier', scanSource(NAMED_CONSTANT_WIDTH)[0]?.width.value === 80);
  expect('scanSource: and names the constant it came from', scanSource(NAMED_CONSTANT_WIDTH)[0]?.width.via === 'THUMB');
  expect('readNumericConsts: two values under one name are dropped, not guessed', !readNumericConsts('const W = 80;\nconst W = 96;').has('W'));
  expect('readNumericConsts: let is ignored (it can be reassigned)', !readNumericConsts('let W = 80;').has('W'));
  expect('classifyArg: an identifier with no const binding stays dynamic', classifyArg('THUMB', new Map()).kind === 'dynamic');

  // --- the two classification corrections ---
  expect('classifyArg: a cast decides nothing -- 320 as number is 320', classifyArg('320 as number').value === 320);
  expect('classifyArg: an arithmetic expression is dynamic, not a bad literal', classifyArg('2 * srcWidthFor(48)').kind === 'dynamic');
  expect('classifyArg: 0x50 as number is STILL odd-numeric', classifyArg('0x50 as number').kind === 'odd-numeric');

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
  expect(
    'RED: a call site whose argument list will not parse',
    has(withRoot({ callText: 'const a = cssUrl(u, 80' }), 'could not be parsed'),
  );
  expect(
    'RED rule 5: the incident value extracted to a named constant',
    has(withRoot({ callText: NAMED_CONSTANT_WIDTH }), 'width not in vercel.json images.sizes'),
  );
  expect(
    'RED rule 5: and the violation names the constant, not just the number',
    has(withRoot({ callText: NAMED_CONSTANT_WIDTH }), 'THUMB = 80'),
  );
  expect(
    'RED: the tripwire can actually fire -- a tree with no call site at all',
    has(withRoot({ callText: 'const a = 1;' }), 'ZERO helper call sites'),
  );
  expect(
    'GREEN rule 5: a constant bound to a width Vercel serves is not flagged',
    withRoot({ callText: 'const W = 96;' + LF + 'const a = cssUrl(u, W);' }).length === 0,
  );
  expect(
    'GREEN: a cast around a served width is not flagged',
    withRoot({ callText: 'const a = cssUrl(u, 96 as number);' }).length === 0,
  );
  expect(
    'GREEN: a doc example cannot answer rule 1 for the real SIZES literal',
    withRoot({ docSizes: [96, 480] }).length === 0,
  );
  expect(
    'GREEN: a doc example cannot answer rule 2 for the real signature',
    withRoot({ docQuality: 999 }).length === 0,
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

  // NO LIVE-TREE CASES HERE, and the absence is deliberate -- do not put them
  // back. Three used to sit at this point: the tree is clean, calls > 0, and
  // callSites > 0. Every one of them duplicated something checkTree() already
  // asserts on its own run, so the canary bought no coverage and cost a second
  // 551-file walk:
  //
  //   "tree is clean"   IS the guard's verdict. The guard prints it better --
  //                     with the file, the line and the remediation.
  //   "callSites > 0"   IS the guard's own violation at the callSites === 0
  //                     branch of the fail-loud measurement contract below the
  //                     scan ("A guard that measures nothing is not a pass").
  //   "calls > 0"       could never arbitrate anything: see the callSites
  //                     declaration -- findCalls once claimed imageCdn.ts's own
  //                     two export lines, so the raw count floored at 2 however
  //                     blind the scanner was. That is why the contract gates
  //                     on callSites and not on this.
  //
  // WHAT THEY COST, which is the reason this is a defect and not a tidy-up.
  // architecture-guard.yml and "lint" both run the canary BEFORE the check.
  // "lint" WAS an && chain, so an ORDINARY width violation -- the single thing
  // this guard exists to name -- red the CANARY first and the check never ran.
  // Past tense as of 2026-08-26: "lint" is scripts/run-lint-chain.mjs and runs
  // every link. architecture-guard.yml is NOT fixed, so read the rest of this
  // note as live for CI and historical for the local tier.
  // Measured 2026-08-26 by injecting optimizedImageUrl(image, 123): canary
  // exit 1, "FAILED (1/52)", and the operator never saw the line naming the
  // file and saying /_vercel/image answers 400. The guard switched itself off
  // and reported ITSELF as broken about a repository that had done exactly
  // what the guard was written to catch.
  //
  // Same failure, same repository, second instance: check-workflow-artifact-
  // policy.mjs moved five MEASURED comparisons out of its canary for this
  // reason, and its header records why.
  //
  // It did not move them all, and this note claimed otherwise until review on
  // 2026-08-26. One live read survives there -- A5 fan-out over the real
  // .github/workflows, at check-workflow-artifact-policy.mjs:4560 -- and two
  // more live-subject canaries sit ahead of their own checks in the same list:
  // check-mojibake's ".claude/settings.local.json is collected" and
  // check-script-conventions' R5 run over the live source of
  // check-ci-budget.mjs. They no longer GATE those checks locally -- the chain
  // runs to completion -- but they still do in architecture-guard.yml, where
  // the pairs are separate steps or separate lines of one `run: |` under
  // `bash -e`. So the class is OPEN with three instances left; this
  // guard is one instance of it closed. scripts/pre-ship.mjs carries the list
  // and the line numbers.
  //
  // The rule itself, which none of that softens: a canary that gates a check
  // must assert nothing about the live subject -- keep it to injected fixtures
  // and pure arithmetic, which cannot red on ordinary work.

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
