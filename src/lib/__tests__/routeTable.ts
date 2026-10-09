// The site's REAL route table, read from the two files that define it -- the
// declarative catchall tree (src/components/AnimatedRoutes.tsx) and the
// framework routes (app/routes.ts) -- so a test can ask "would this URL render
// a page, or the catchall's 404?" without a hand-kept copy that drifts.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { matchPath } from 'react-router-dom';

const ROOT = path.resolve(__dirname, '../../..');

const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8');

export function routePatterns(): string[] {
  const declarative = [...read('src/components/AnimatedRoutes.tsx').matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]);
  const framework = [...read('app/routes.ts').matchAll(/\broute\(\s*"([^"]+)"/g)].map((m) => `/${m[1]}`);
  // `index(...)` is the bare "/" framework route.
  const patterns = [...declarative, ...framework, '/'];
  // The splat is the 404 page, not a route anyone means to land on.
  return [...new Set(patterns)].filter((p) => p !== '*' && p !== '/*');
}

/** The path part of a target (no query, no hash). */
export const pathOf = (target: string) => target.split(/[?#]/, 1)[0] || '/';

export function isRoutable(target: string, patterns: string[] = routePatterns()): boolean {
  const pathname = pathOf(target);
  return patterns.some((pattern) => matchPath({ path: pattern, end: true }, pathname) !== null);
}
