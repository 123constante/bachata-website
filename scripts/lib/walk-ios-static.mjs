// walk-ios-static.mjs -- slice 10 Part C (contract 11 item 5b): a STATIC scan
// for three iOS Safari bug classes the Chromium walk cannot see. It emits the
// three numbers the judge rubric (scripts/lib/walk-judge.mjs RUBRIC) asks for,
// keyed by the rubric ids:
//
//   iosInputFontSize      smallest font-size (px) found on input/textarea/select.
//                         iOS zooms the page on focus below 16px.
//   iosNoRawVh            count of 100vh declarations with no dvh/svh fallback in
//                         the SAME rule. iOS 100vh is taller than the visible area.
//   iosFixedBarsSafeArea  count of position:fixed rules/elements with no
//                         env(safe-area-inset-*) in the SAME rule. Fixed bars
//                         otherwise sit under the home indicator / notch.
//
// PURE core (scanIosClasses): no network, no clock, no env, no fs. Never throws;
// anything it cannot read is red-shaped, never a silent pass.
//
// WHAT "RULE" MEANS
// - CSS (.css, and <style> blocks in .html): a leaf `{ ... }` declaration block,
//   found by the brace splitter below. @media/@supports wrappers are walked into;
//   the leaf block is the rule.
// - TSX/HTML markup: one opening tag. Its class tokens are the string literals of
//   its className=/class= attribute (including every literal inside
//   className={cn(...)}), and its inline style text is part of the same rule.
//
// WHAT IT DOES NOT PARSE (each one is said in a finding when met, never silent)
// - Minified CSS: scanned best-effort with the same splitter (it is still brace
//   structured), but line numbers are meaningless and a finding says so.
// - CSS-in-JS (styled.x`...`, css`...`, <style> inside TSX): not parsed at all.
// - Class strings built outside the tag (const cls = 'fixed ...'), template
//   literal ${} expressions, @apply, and CSS variables (font-size: var(--x)
//   counts as unmeasurable = 0px, red).
// - Strings containing braces inside CSS (content: "{") can mis-split a rule.
// - Cascade: a rule is judged alone; an input's size set elsewhere by inheritance
//   is not followed. Breakpoint variants sm:/md:/lg:/xl:/2xl: are ignored because
//   they do not apply at the 390px walk width.
// - em and % font sizes depend on the parent, so they count as unmeasurable
//   (0px, red). input::placeholder-style selectors are not the field's size.
// - rem and named Tailwind sizes are converted at ROOT_PX (browser default
//   16px) and a finding records the assumption; this site's phone root is
//   smaller (~13.5px), so the real number can be lower than reported.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { isEntryPoint } from './entry-point.mjs';
import { RUBRIC } from './walk-judge.mjs';

export const IOS_IDS = Object.freeze(['iosInputFontSize', 'iosNoRawVh', 'iosFixedBarsSafeArea']);
export const ROOT_PX = 16;
const NO_INPUT_PX = 16;
const MIN_BREAKPOINTS = new Set(['sm', 'md', 'lg', 'xl', '2xl']);
const PSEUDO_ELEMENTS = new Set(['placeholder', 'file', 'before', 'after', 'marker', 'selection', 'first-letter', 'first-line']);
const TW_TEXT_REM = { xs: 0.75, sm: 0.875, base: 1, lg: 1.125, xl: 1.25, '2xl': 1.5, '3xl': 1.875, '4xl': 2.25 };
const SCAN_EXT = /\.(css|html|tsx)$/i;

const RAW_100VH = /(^|[^\w.])100vh\b/g;
const HAS_DVH = /\d(?:\.\d+)?[ds]vh\b|\b(?:min-|max-)?h-[ds]vh\b/;
const SAFE_AREA = /env\(\s*safe-area-inset-/;

const redShaped = (detail) => ({
  iosInputFontSize: 0,
  iosNoRawVh: 1,
  iosFixedBarsSafeArea: 1,
  findings: [{ id: 'scanner', path: '', line: 0, detail }],
});

const lineAt = (text, offset) => {
  let n = 1;
  for (let i = 0; i < offset && i < text.length; i += 1) if (text.charCodeAt(i) === 10) n += 1;
  return n;
};

/** Blank out /* *\/ comments, keeping offsets (and so line numbers) intact. */
const stripCssComments = (t) => t.replace(/\/\*[\s\S]*?(\*\/|$)/g, (m) => m.replace(/[^\n]/g, ' '));

/**
 * The tiny rule splitter. Returns every LEAF block (a `{}` with no `{` inside)
 * as { selector, body, offset } where offset is the body's start. Selectors of
 * an @-rule wrapper are not leaf selectors. Unbalanced input never throws: an
 * unclosed block is dropped, a stray `}` is ignored.
 */
export function splitCssRules(text) {
  const t = stripCssComments(String(text));
  const out = [];
  const stack = [];
  let lastBoundary = 0;
  for (let i = 0; i < t.length; i += 1) {
    const c = t[i];
    if (c === '{') {
      stack.push({ open: i, selector: t.slice(lastBoundary, i).trim(), leaf: true });
      if (stack.length > 1) stack[stack.length - 2].leaf = false;
      lastBoundary = i + 1;
    } else if (c === '}') {
      const top = stack.pop();
      if (top && top.leaf) out.push({ selector: top.selector, body: t.slice(top.open + 1, i), offset: top.open + 1 });
      lastBoundary = i + 1;
    } else if (c === ';' && stack.length === 0) {
      lastBoundary = i + 1; // @import ...; at top level
    }
  }
  return out;
}

/** px for a CSS font-size value, or null when it cannot be measured. */
function cssFontPx(value, note) {
  const v = value.trim().replace(/\s*!important$/, '');
  let m = /^(\d+(?:\.\d+)?)px$/i.exec(v);
  if (m) return Number(m[1]);
  // rem is root-relative, so the ROOT_PX assumption is stated in a finding. em
  // (and %) depend on the parent's size, which a static scan cannot see: null.
  m = /^(\d+(?:\.\d+)?)rem$/i.exec(v);
  if (m) { note(); return Number(m[1]) * ROOT_PX; }
  return null;
}

const INPUT_SELECTOR = /(^|[\s,>+~(])(input|textarea|select)(?![\w-])/i;

function scanCss(path, text, offsetBase, sourceText, acc) {
  for (const rule of splitCssRules(text)) {
    const body = rule.body;
    const at = (rel) => lineAt(sourceText, offsetBase + rule.offset + rel);
    // 100vh
    const fallback = HAS_DVH.test(body);
    RAW_100VH.lastIndex = 0;
    let m;
    while ((m = RAW_100VH.exec(body)) !== null) {
      if (!fallback) {
        acc.vh += 1;
        acc.findings.push({ id: 'iosNoRawVh', path, line: at(m.index), detail: `${rule.selector}: 100vh with no dvh/svh fallback in the same rule` });
      }
    }
    // position: fixed
    const fx = /position\s*:\s*fixed\b/i.exec(body);
    if (fx && !SAFE_AREA.test(body)) {
      acc.fixed += 1;
      acc.findings.push({ id: 'iosFixedBarsSafeArea', path, line: at(fx.index), detail: `${rule.selector}: position: fixed with no env(safe-area-inset-*) in the same rule` });
    }
    // input font-size
    // A selector part that styles a pseudo-element (input::placeholder, ::file-
    // selector-button) is not the field's own size; iOS zooms on the field.
    const fieldParts = rule.selector.split(',')
      .filter((p) => INPUT_SELECTOR.test(p) && !/::|:(?:-[a-z]+-)?(?:input-)?placeholder\b/i.test(p));
    if (fieldParts.length > 0) {
      acc.inputs += 1;
      const fsRe = /(?:^|[;\s])font-size\s*:\s*([^;]+)/gi;
      let f;
      while ((f = fsRe.exec(body)) !== null) {
        const px = cssFontPx(f[1], () => { acc.remSeen = true; });
        recordFont(acc, path, at(f.index), rule.selector, f[1].trim(), px);
      }
    }
  }
}

function recordFont(acc, path, line, where, raw, px) {
  if (px === null) {
    acc.fontMin = Math.min(acc.fontMin, 0);
    acc.findings.push({ id: 'iosInputFontSize', path, line, detail: `${where}: font-size ${raw} cannot be measured statically; counted as 0px` });
    return;
  }
  acc.fontMin = Math.min(acc.fontMin, px);
  if (px < 16) acc.findings.push({ id: 'iosInputFontSize', path, line, detail: `${where}: font-size ${raw} (${px}px) is below 16px` });
}

/** Tokens that apply at the 390px walk width, with their variant list. */
function tokensOf(classText) {
  return classText.split(/\s+/).filter(Boolean).map((tok) => {
    // split variants on ':' outside [] brackets
    const parts = [];
    let depth = 0;
    let cur = '';
    for (const ch of tok) {
      if (ch === '[') depth += 1;
      if (ch === ']') depth -= 1;
      if (ch === ':' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
    }
    return { variants: parts, base: cur.replace(/^!/, ''), raw: tok };
  }).filter((t) => !t.variants.some((v) => MIN_BREAKPOINTS.has(v)));
}

/** End index (exclusive) of an opening tag starting at `<`, or -1 if not a tag. */
function tagEnd(text, start) {
  let depth = 0;
  let quote = null;
  for (let i = start + 1; i < text.length; i += 1) {
    const c = text[i];
    if (quote) {
      if (c === '\\') { i += 1; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth += 1;
    else if (c === '}') { depth -= 1; if (depth < 0) return -1; }
    else if (depth === 0) {
      if (c === '>') return i + 1;
      if (c === '<' || c === ';') return -1;
    }
  }
  return -1;
}

/** Every string literal's content inside a JS expression text. */
const literalsIn = (expr) => [...expr.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|`([^`\\]*(?:\\.[^`\\]*)*)`/g)]
  .map((m) => (m[1] ?? m[2] ?? m[3] ?? '').replace(/\$\{[^}]*\}/g, ' '));

function classTextOf(tag) {
  const out = [];
  const re = /\bclass(?:Name)?\s*=\s*/g;
  let m;
  while ((m = re.exec(tag)) !== null) {
    const i = m.index + m[0].length;
    const c = tag[i];
    if (c === '"' || c === "'") {
      const j = tag.indexOf(c, i + 1);
      if (j > i) out.push(tag.slice(i + 1, j));
    } else if (c === '{') {
      let depth = 0;
      let j = i;
      for (; j < tag.length; j += 1) {
        if (tag[j] === '{') depth += 1;
        else if (tag[j] === '}') { depth -= 1; if (depth === 0) break; }
      }
      out.push(...literalsIn(tag.slice(i + 1, j)));
    }
  }
  return out.join(' ');
}

const VH_TOKEN = /^(?:min-|max-)?h-(?:screen|\[100vh\])$/;
const TEXT_PX = /^text-\[(\d+(?:\.\d+)?)px\]$/;
const TEXT_REM = /^text-\[(\d+(?:\.\d+)?)rem\]$/;
const TEXT_NAMED = /^text-(xs|sm|base|lg|xl|2xl|3xl|4xl)$/;

function scanMarkup(path, text, acc) {
  const tagRe = /<([A-Za-z][\w.]*)(?=[\s/>])/g;
  let m;
  while ((m = tagRe.exec(text)) !== null) {
    const end = tagEnd(text, m.index);
    if (end < 0) continue;
    const tag = text.slice(m.index, end);
    const name = m[1];
    const line = lineAt(text, m.index);
    const tokens = tokensOf(classTextOf(tag));
    const safe = SAFE_AREA.test(tag);
    const styleVh = (tag.match(/style\s*=\s*\{\{[\s\S]*?\}\}|style\s*=\s*"[^"]*"/g) || []).join(' ');
    const fallback = HAS_DVH.test(tag) || tokens.some((t) => /^(?:min-|max-)?h-(?:\[[\d.]+[ds]vh\]|[ds]vh)$/.test(t.base));
    // 100vh: class tokens + inline style occurrences
    let vhCount = tokens.filter((t) => VH_TOKEN.test(t.base)).length;
    RAW_100VH.lastIndex = 0;
    vhCount += (styleVh.match(RAW_100VH) || []).length;
    if (vhCount > 0 && !fallback) {
      acc.vh += vhCount;
      acc.findings.push({ id: 'iosNoRawVh', path, line, detail: `<${name}>: ${vhCount} x 100vh (h-screen / [100vh] / style) with no dvh/svh fallback on the element` });
    }
    // fixed
    const fixed = tokens.some((t) => t.base === 'fixed') || /position\s*:\s*['"]?fixed\b/.test(styleVh);
    if (fixed && !safe) {
      acc.fixed += 1;
      acc.findings.push({ id: 'iosFixedBarsSafeArea', path, line, detail: `<${name}>: fixed with no env(safe-area-inset-*) on the element` });
    }
    // input font-size
    if (/^(input|textarea|select)$/.test(name)) {
      acc.inputs += 1;
      for (const t of tokens) {
        if (t.variants.some((v) => PSEUDO_ELEMENTS.has(v))) continue;
        let px = null;
        let hit = false;
        let r;
        if ((r = TEXT_PX.exec(t.base))) { px = Number(r[1]); hit = true; }
        else if ((r = TEXT_REM.exec(t.base))) { px = Number(r[1]) * ROOT_PX; hit = true; acc.remSeen = true; }
        else if ((r = TEXT_NAMED.exec(t.base))) { px = TW_TEXT_REM[r[1]] * ROOT_PX; hit = true; acc.remSeen = true; }
        if (hit) recordFont(acc, path, line, `<${name}> ${t.raw}`, t.raw, px);
      }
    }
  }
}

function looksMinified(text) {
  const lines = text.split('\n');
  return lines.some((l) => l.length > 1000) || (text.length > 2000 && lines.length < 3);
}

function scanFile(path, text, acc) {
  if (/\.css$/i.test(path)) {
    if (looksMinified(text)) acc.findings.push({ id: 'scanner', path, line: 0, detail: 'minified CSS: scanned best-effort, line numbers and selectors are unreliable' });
    scanCss(path, text, 0, text, acc);
    return;
  }
  if (/\.tsx$/i.test(path)) {
    if (/\bstyled(?:\.\w+|\([^)]*\))\s*`|\bcss\s*`|<style[\s>]/.test(text)) {
      acc.findings.push({ id: 'scanner', path, line: 0, detail: 'CSS-in-JS (styled/css template or <style>) found: not parsed' });
    }
    scanMarkup(path, text, acc);
    return;
  }
  // .html: <style> blocks as CSS, the rest as markup
  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = styleRe.exec(text)) !== null) {
    const off = m.index + m[0].indexOf('>') + 1;
    if (looksMinified(m[1])) acc.findings.push({ id: 'scanner', path, line: lineAt(text, off), detail: 'minified <style>: scanned best-effort' });
    scanCss(path, m[1], off, text, acc);
  }
  scanMarkup(path, text.replace(styleRe, (s) => s.replace(/[^\n]/g, ' ')), acc);
}

/**
 * files = [{ path, text }]. Returns { iosInputFontSize, iosNoRawVh,
 * iosFixedBarsSafeArea, findings[] }. Never throws. Empty or malformed input is
 * red-shaped (counts 1, font 0px, exactly one finding): scanning nothing proves
 * nothing.
 */
export function scanIosClasses(files) {
  try {
    if (!Array.isArray(files)) return redShaped('files is not a list of { path, text }');
    if (files.length === 0) return redShaped('no files to scan');
    const items = [];
    for (let i = 0; i < files.length; i += 1) {
      const f = files[i];
      if (f === null || typeof f !== 'object' || typeof f.path !== 'string' || typeof f.text !== 'string') {
        return redShaped(`files[${i}] is not { path: string, text: string }`);
      }
      items.push({ path: f.path, text: f.text });
    }
    const acc = { vh: 0, fixed: 0, inputs: 0, fontMin: Infinity, remSeen: false, findings: [] };
    for (const { path, text } of items) {
      if (!SCAN_EXT.test(path)) { acc.findings.push({ id: 'scanner', path, line: 0, detail: 'not .css/.html/.tsx: skipped' }); continue; }
      scanFile(path, text, acc);
    }
    if (acc.remSeen) acc.findings.push({ id: 'iosInputFontSize', path: '', line: 0, detail: `rem or named text sizes converted at a ${ROOT_PX}px root; a smaller phone root makes the real size lower` });
    let font = acc.fontMin;
    if (acc.inputs === 0) {
      font = NO_INPUT_PX;
      acc.findings.push({ id: 'iosInputFontSize', path: '', line: 0, detail: `no input/textarea/select found; reported as ${NO_INPUT_PX}px` });
    } else if (!Number.isFinite(font)) {
      font = NO_INPUT_PX;
      acc.findings.push({ id: 'iosInputFontSize', path: '', line: 0, detail: `${acc.inputs} input(s) found but none sets a font-size statically; reported as ${NO_INPUT_PX}px, inherited size not followed` });
    }
    return { iosInputFontSize: font, iosNoRawVh: acc.vh, iosFixedBarsSafeArea: acc.fixed, findings: acc.findings };
  } catch (err) {
    return redShaped(`scanner threw: ${err && err.message ? err.message : String(err)}`);
  }
}

/** True when all three numbers meet their RUBRIC rule (read from the judge). */
export function meetsRubric(result) {
  return IOS_IDS.every((id) => {
    const rule = RUBRIC.find((r) => r.id === id);
    const n = result ? result[id] : undefined;
    if (!rule || typeof n !== 'number' || !Number.isFinite(n)) return false;
    return rule.op === '>=' ? n >= rule.threshold : n <= rule.threshold;
  });
}

function listFilesDefault(dir) {
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      if (name === 'node_modules' || name === '.git') continue;
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p); else out.push(p);
    }
  };
  walk(dir);
  return out;
}

const USAGE = 'usage: node scripts/lib/walk-ios-static.mjs --dir <built or src dir>';

/** CLI. Exit 0 = all three meet the rubric, 1 = any misses (or unreadable), 2 = usage. */
export function main(argv = [], deps = {}) {
  const listFiles = deps.listFiles || listFilesDefault;
  const readFile = deps.readFile || ((p) => readFileSync(p, 'utf8'));
  const log = deps.log || ((s) => console.log(s));
  const error = deps.error || ((s) => console.error(s));
  const i = argv.indexOf('--dir');
  const dir = i >= 0 && typeof argv[i + 1] === 'string' && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
  if (!dir) { error(USAGE); return 2; }
  let result;
  try {
    const files = listFiles(dir).filter((p) => SCAN_EXT.test(p)).sort().map((p) => ({ path: p, text: readFile(p) }));
    result = scanIosClasses(files);
  } catch (err) {
    result = redShaped(`could not read ${dir}: ${err && err.message ? err.message : String(err)}`);
  }
  log(JSON.stringify(result, null, 2));
  return meetsRubric(result) ? 0 : 1;
}

if (isEntryPoint(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
