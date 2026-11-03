// scripts/lib/buildRule.mjs -- the JS side of the ONE "does this diff need a
// Vercel build?" rule. The rule's data lives in exactly one place: BUILD_PATHS
// in scripts/vercel-ignore-build.sh (the Vercel ignoreCommand, which must stay
// a dependency-free shell script: .vercelignore strips scripts/* except that
// file). This module never holds a second copy: it PARSES that literal, so the
// ignore script and scripts/lib/previewProbe.mjs decide from the same list.
//
// Matching follows git's default pathspec semantics, which is what the script
// hands `git diff -- $BUILD_PATHS`:
//   - a spec without wildcards matches the path itself or anything under it
//     (`src` matches `src/main.tsx`);
//   - a spec with `*`, `?` or `[...]` is an fnmatch pattern over the WHOLE
//     path where `*` also crosses `/` (no `:(glob)` magic).
// tests/buildRule.test.ts runs real `git diff` against this matcher over a
// table of paths, so the two cannot drift silently.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const IGNORE_SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'vercel-ignore-build.sh');

/** The BUILD_PATHS='...' literal of the ignore script, as a pathspec list.
 *  THROWS when it is missing or empty: a caller must treat that as doubt. */
export function parseBuildPaths(shText) {
  const m = /^BUILD_PATHS='([^']*)'/m.exec(shText);
  const specs = m ? m[1].split(/\s+/).filter(Boolean) : [];
  if (specs.length === 0) throw new Error('buildRule: no BUILD_PATHS literal in the ignore script');
  return specs;
}

export function readBuildPaths(file = IGNORE_SCRIPT) {
  return parseBuildPaths(readFileSync(file, 'utf8'));
}

const WILDCARD = /[*?[]/;

function specToRegExp(spec) {
  let re = '';
  for (let i = 0; i < spec.length; i++) {
    const ch = spec[i];
    if (ch === '*') re += '.*';
    else if (ch === '?') re += '.';
    else if (ch === '[') {
      const end = spec.indexOf(']', i + 1);
      if (end === -1) re += '\\[';
      else {
        re += `[${spec.slice(i + 1, end).replace(/^!/, '^').replace(/\\/g, '\\\\')}]`;
        i = end;
      }
    } else re += ch.replace(/[.+^${}()|\\/]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

/** Does one git pathspec (default magic) match one repo-relative path? */
export function pathspecMatches(spec, path) {
  if (!WILDCARD.test(spec)) return path === spec || path.startsWith(`${spec}/`);
  return specToRegExp(spec).test(path);
}

/** True when any of `paths` is a build input. */
export function touchesBuildPaths(paths, specs = readBuildPaths()) {
  return paths.some((p) => specs.some((s) => pathspecMatches(s, p)));
}
