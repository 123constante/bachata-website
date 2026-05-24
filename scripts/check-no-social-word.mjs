#!/usr/bin/env node
/**
 * check-no-social-word.mjs
 *
 * Copy guardrail: new dancers don't know what a "social" is, but everyone
 * understands "party". So the word "social" must never be shown to a human for
 * an event/party. This fails the build if a program/type **display label**
 * reintroduces the capitalised word "Social" as a code value, e.g.
 *   social: 'Social'        // section/type label map
 *   return { text: 'Social' } // rank caption
 *
 * Scope: src/
 *
 * Intentionally NOT flagged (these are different meanings, kept by decision):
 *   - "social media" links (EventSocialIcons, organiser/DJ `socials`, vendor
 *     "social" section) — these use the lowercase key `social`/`socials`.
 *   - "social dancer", the "Social Dancer" testimonial role, "Social Demos" —
 *     a dancer descriptor, not an event; "party dancer" would be wrong.
 *   - the lowercase enum value `'social'` (breadcrumb mapping, default-title
 *     regexes) — the value stays; only its *displayed* form must be "Party".
 *
 * That is why the pattern requires a capitalised `'Social'` / `"Social"` used as
 * a code value (preceded by `:` or `=`), not the lowercase key or free prose.
 *
 * Wired into: package.json `lint`.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const SCAN_PATHS = ['src'];

const ALLOWED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

const EXCLUDED_PATHS = [
  'src/integrations/supabase/types.ts',
  'src/types/supabase.ts',
  'node_modules',
  'dist',
  '.next',
];

// A capitalised "Social" used as a code value (label/caption), e.g.
//   social: 'Social'   |   text: "Social"   |   = 'Social'
// Comments like  // "Social" / "Party"  have no `:`/`=` before the quote.
const SOCIAL_LABEL_PATTERN = /[:=]\s*(['"])Social\1/;

const toPosixRelative = (absolutePath) =>
  path.relative(ROOT, absolutePath).split(path.sep).join('/');

const isExcluded = (relativePath) =>
  EXCLUDED_PATHS.some((excluded) => relativePath === excluded || relativePath.startsWith(`${excluded}/`));

const collect = async (entryPath) => {
  let stat;
  try {
    stat = await fs.stat(entryPath);
  } catch {
    return [];
  }
  if (stat.isFile()) return [entryPath];
  if (!stat.isDirectory()) return [];

  const entries = await fs.readdir(entryPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(entryPath, entry.name);
      const relative = toPosixRelative(fullPath);
      if (isExcluded(relative)) return [];
      if (entry.isDirectory()) return collect(fullPath);
      return [fullPath];
    }),
  );
  return nested.flat();
};

const isScannableFile = (relativePath) => {
  if (isExcluded(relativePath)) return false;
  if (relativePath.endsWith('.d.ts')) return false;
  return ALLOWED_EXTENSIONS.has(path.extname(relativePath));
};

const run = async () => {
  const allFiles = (
    await Promise.all(SCAN_PATHS.map((relPath) => collect(path.join(ROOT, relPath))))
  ).flat();

  const violations = [];

  for (const absolutePath of allFiles) {
    const relativePath = toPosixRelative(absolutePath);
    if (!isScannableFile(relativePath)) continue;

    const content = await fs.readFile(absolutePath, 'utf8');
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (SOCIAL_LABEL_PATTERN.test(line)) {
        violations.push({
          file: relativePath,
          line: index + 1,
          snippet: line.trim().slice(0, 160),
        });
      }
    });
  }

  if (violations.length > 0) {
    console.error('\nSocial-word guardrail failed: a display label says "Social".');
    console.error('The platform shows "Party", never "Social" — relabel it to "Party".');
    console.error('(Legacy `social` enum values still render as "Party".)\n');
    for (const v of violations) {
      console.error(`- ${v.file}:${v.line}  ${v.snippet}`);
    }
    console.error(`\nTotal violations: ${violations.length}`);
    process.exit(1);
  }

  console.log('Social-word guardrail passed (no "Social" display labels).');
};

run().catch((error) => {
  console.error('check-no-social-word failed to run:', error);
  process.exit(1);
});
