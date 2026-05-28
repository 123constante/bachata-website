#!/usr/bin/env node
/**
 * Image-attribute audit. Strips line comments, block comments, and string
 * literals before scanning for <img> tags so doc references like "uses an
 * <img>" do not produce false positives. JSX-safe: respects {} depth in
 * expressions like onError={() => ...}.
 *
 * Run:  node scripts/audit-images.mjs
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const BS = String.fromCharCode(92);

function stripCommentsAndStrings(text) {
  // Replace contents of // line comments, /* block */ comments, and string
  // literals (" ' `) with spaces, preserving line breaks so line numbers
  // remain accurate. Does NOT strip JSX {/* */} content (those are JSX
  // comments and unlikely to contain <img references; left as-is).
  let out = '';
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    const c2 = text[i + 1] || '';
    if (c === '/' && c2 === '/') {
      // line comment
      while (i < text.length && text[i] !== '\n') {
        out += text[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
    } else if (c === '/' && c2 === '*') {
      out += '  ';
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) {
        out += text[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
      if (i < text.length) { out += '  '; i += 2; }
    } else if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      out += ' ';
      i += 1;
      while (i < text.length && text[i] !== quote) {
        if (text[i] === BS && i + 1 < text.length) {
          out += '  '; i += 2; continue;
        }
        out += text[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
      if (i < text.length) { out += ' '; i += 1; }
    } else {
      out += c;
      i += 1;
    }
  }
  return out;
}

function findTagEnd(text, start) {
  let depth = 0;
  let inStr = null;
  for (let i = start; i < text.length; i += 1) {
    const c = text[i];
    if (inStr !== null) {
      if (c === BS && i + 1 < text.length) { i += 1; continue; }
      if (c === inStr) inStr = null;
    } else {
      if (c === '"' || c === "'" || c === '`') inStr = c;
      else if (c === '{') depth += 1;
      else if (c === '}') { if (depth > 0) depth -= 1; }
      else if (c === '>' && depth === 0) return i;
    }
  }
  return -1;
}

let files;
try {
  files = execSync('git ls-files "src/**/*.tsx"', { encoding: 'utf8' })
    .split(/\r?\n/).filter(Boolean);
} catch (err) {
  console.error('git ls-files failed:', err.message);
  process.exit(1);
}

const offenders = [];
let total = 0;
for (const file of files) {
  let raw;
  try { raw = readFileSync(file, 'utf8'); } catch { continue; }
  const src = stripCommentsAndStrings(raw);
  let i = 0;
  while (i < src.length) {
    const j = src.indexOf('<img', i);
    if (j === -1) break;
    const nxt = src[j + 4];
    if (!nxt || !/[\s/>]/.test(nxt)) { i = j + 4; continue; }
    const end = findTagEnd(src, j + 4);
    if (end === -1) break;
    total += 1;
    // For the attribute check, scan the ORIGINAL text so the alt= / loading=
    // values are visible (we stripped string contents above).
    const tag = raw.slice(j, end + 1);
    const hasAlt = /\balt=/.test(tag);
    const hasLoading = /\bloading=/.test(tag);
    if (!hasAlt || !hasLoading) {
      const line = raw.slice(0, j).split('\n').length;
      offenders.push({ file, line, hasAlt, hasLoading });
    }
    i = end + 1;
  }
}

const missingAlt = offenders.filter((o) => !o.hasAlt && o.hasLoading).length;
const missingLoading = offenders.filter((o) => o.hasAlt && !o.hasLoading).length;
const missingBoth = offenders.filter((o) => !o.hasAlt && !o.hasLoading).length;
console.log('Total <img> tags: ' + total);
console.log('  missing alt:       ' + missingAlt);
console.log('  missing loading:   ' + missingLoading);
console.log('  missing both:      ' + missingBoth);
console.log('');
offenders.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)));
for (const o of offenders) {
  const gaps = [];
  if (!o.hasAlt) gaps.push('alt');
  if (!o.hasLoading) gaps.push('loading');
  console.log('  ' + o.file + ':' + o.line + '  missing: ' + gaps.join(', '));
}
process.exit(offenders.length > 0 && process.env.AUDIT_STRICT === '1' ? 1 : 0);
