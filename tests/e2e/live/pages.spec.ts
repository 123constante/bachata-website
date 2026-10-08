import { test } from '@playwright/test';
import { visit } from './lib/visit';

// LAYER 3 sweep over the public entry points that are not tied to one event
// shape. Each visit() asserts, at 390px: no client errors, no React hydration
// errors (#418/#421/#423/#425), no write attempts, no horizontal overflow, no
// sub-44px tap targets, no serious/critical axe violations, no copy pointing
// at a missing control, no disabled control without a reason -- anything not
// already recorded in baseline.json. The event/organiser/search pages are
// covered, per shape, by shape-matrix.spec.ts.

const PAGES: { path: string; shot?: string; allowConsole?: RegExp[] }[] = [
  { path: '/city/london-gb' },
  { path: '/parties', shot: 'parties' },
  { path: '/classes', shot: 'classes' },
  { path: '/festivals', shot: 'festivals' },
  { path: '/faq' },
  { path: '/london-bachata-guide' },
  { path: '/bachata-london-friday' },
  { path: '/search?q=bachata' },
  { path: '/auth' },
  // The not-found page logs this on purpose (src/pages/NotFound): expected here.
  { path: '/this-page-does-not-exist-live-qa', shot: 'not-found', allowConsole: [/User attempted to access non-existent route/] },
];

for (const p of PAGES) {
  test(`page health at 390px: ${p.path}`, async ({ page }, testInfo) => {
    await visit(page, testInfo, p.path, { screenshot: p.shot, allowConsole: p.allowConsole });
  });
}
