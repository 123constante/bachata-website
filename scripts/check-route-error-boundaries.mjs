#!/usr/bin/env node
// Conformance guard for the SSR error surface (regression fence for the gap
// that let loader/render throws render RR7's unstyled default page AND go
// uncaptured — root cause of the /city/london-gb hydration-cascade Sentry
// cluster, fixed by adding a root ErrorBoundary + server-side capture).
//
// RR7 error model: a thrown loader/render error bubbles to the NEAREST ancestor
// route that exports an `ErrorBoundary`. `app/root.tsx` is the ancestor of every
// framework route, so a root ErrorBoundary is the universal safety net — every
// route is covered by construction. This check therefore HARD-FAILS only if the
// root net is missing (removing it silently reopens the whole gap), and prints
// an informational list of data routes (those exporting a `loader`) that rely on
// the root net rather than a route-scoped boundary — not a failure, just
// visibility for anyone who wants a styled per-route fallback.
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ROUTES_DIR = path.join(ROOT, 'app', 'routes');
const ROOT_FILE = path.join(ROOT, 'app', 'root.tsx');

const EXPORTS_ERROR_BOUNDARY =
  /export\s+(?:async\s+)?function\s+ErrorBoundary\b|export\s+(?:const|let)\s+ErrorBoundary\b|export\s*\{[^}]*\bErrorBoundary\b[^}]*\}/;
const EXPORTS_LOADER =
  /export\s+(?:async\s+)?function\s+loader\b|export\s+(?:const|let)\s+loader\b|export\s*\{[^}]*\bloader\b[^}]*\}/;

const fail = (msg) => {
  console.error(`\n✗ route-error-boundary check FAILED\n  ${msg}\n`);
  process.exit(1);
};

const rootSrc = await fs.readFile(ROOT_FILE, 'utf8').catch(() => null);
if (rootSrc == null) fail(`Cannot read ${path.relative(ROOT, ROOT_FILE)}`);
if (!EXPORTS_ERROR_BOUNDARY.test(rootSrc)) {
  fail(
    'app/root.tsx does not export an `ErrorBoundary`. This is the universal SSR ' +
      'safety net — without it, a loader/render throw on ANY route renders RR7’s ' +
      'unstyled default error page and (before server Sentry) goes uncaptured. ' +
      'Restore `export function ErrorBoundary()` in app/root.tsx.',
  );
}

// Informational: which data routes lean on the root net rather than a local one.
const entries = await fs.readdir(ROUTES_DIR).catch(() => []);
const leaning = [];
for (const name of entries) {
  if (!name.endsWith('.tsx') && !name.endsWith('.ts')) continue;
  if (name.startsWith('api.')) continue; // resource routes: no UI to fall back to
  const src = await fs.readFile(path.join(ROUTES_DIR, name), 'utf8');
  if (EXPORTS_LOADER.test(src) && !EXPORTS_ERROR_BOUNDARY.test(src)) {
    leaning.push(name);
  }
}

console.log('✓ app/root.tsx exports ErrorBoundary (SSR surface has boundary coverage).');
if (leaning.length) {
  console.log(
    `  ℹ ${leaning.length} data route(s) rely on the root boundary (fine; add a ` +
      `route-scoped ErrorBoundary only if you want a styled per-route fallback):`,
  );
  for (const n of leaning) console.log(`      app/routes/${n}`);
}
