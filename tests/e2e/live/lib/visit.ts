import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, type TestInfo } from '@playwright/test';
import { guardPage, type GuardFindings } from './pageGuard';
import { runAllChecks, type Finding } from './pageChecks';
import { KNOWN_BUGS } from '../known-bugs';

// visit(): the one way a live-QA spec opens a page. It installs the read-only
// guard, navigates, lets the page settle, runs every per-page check, and
// soft-asserts the result, so EVERY page any spec visits gets Layer 3 and the
// screen-wide Layer 1 rules without the spec having to remember them.
//
// Known findings live in baseline.json, keyed by route TEMPLATE (/event/:slug)
// and a data-independent signature. A finding that is in the baseline is
// reported (findings.ndjson) but does not fail; a NEW one fails. Errors,
// hydration errors and write attempts are never baselined.
//
// Re-baseline (only after reading the new findings): LIVE_QA_UPDATE_BASELINE=1
// npm run test:e2e:live -- the global teardown folds every finding into
// baseline.json. Review that diff like code.

export const FINDINGS_FILE = join('test-results', 'live-qa', 'findings.ndjson');
export const BASELINE_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'baseline.json');

type Baseline = Record<string, Record<string, string[]>>;
let baselineCache: Baseline | null = null;
function baseline(): Baseline {
  if (!baselineCache) {
    baselineCache = JSON.parse(readFileSync(BASELINE_FILE, 'utf8')) as Baseline;
  }
  return baselineCache;
}

export function routeTemplate(path: string): string {
  const p = path.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  return p
    .replace(/^\/event\/[^/]+/, '/event/:slug')
    .replace(/^\/organisers\/[^/]+/, '/organisers/:slug')
    .replace(/^\/city\/[^/]+\/search$/, '/city/:slug/search')
    .replace(/^\/city\/[^/]+$/, '/city/:slug')
    .replace(/^\/festival\/[^/]+/, '/festival/:slug')
    .replace(/^\/venue-entity\/[^/]+/, '/venue-entity/:slug')
    .replace(/^\/(dancers|djs|teachers)\/[^/]+/, '/$1/:slug');
}

export function isBaselined(tpl: string, f: Finding, b: Baseline = baseline()): boolean {
  return (b[tpl]?.[f.rule] ?? []).includes(f.sig);
}

export type VisitResult = { guard: GuardFindings; findings: Finding[]; status: number | null };

export type VisitOptions = {
  /** Also save a full-page screenshot as a run artifact under this name. */
  screenshot?: string;
  /** Console errors this page logs on purpose (e.g. the 404 page). */
  allowConsole?: RegExp[];
};

export async function visit(page: Page, testInfo: TestInfo, path: string, opts: VisitOptions = {}): Promise<VisitResult> {
  const origin = new URL(testInfo.project.use.baseURL as string).origin;
  const guard = await guardPage(page, origin);
  const resp = await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  // Hydration errors surface after the first idle; give React a beat.
  await page.waitForTimeout(800);

  // Freeze the page's own errors BEFORE the checks run, so nothing the
  // checks themselves do (axe injecting a script) is blamed on the site.
  const errors = guard.errors.filter((e) => {
    if ((opts.allowConsole ?? []).some((re) => re.test(e))) return false;
    const known = KNOWN_BUGS.find((k) => k.console?.test(e));
    if (known) {
      testInfo.annotations.push({ type: `known-bug ${known.id}`, description: `${path}: ${known.summary}` });
      return false;
    }
    return true;
  });
  const hydration = [...guard.hydration];
  const tpl = routeTemplate(path);
  const all = await runAllChecks(page);
  // One finding per signature per page: twenty identical chips are one defect.
  const seen = new Set<string>();
  const findings = all.filter((f) => {
    const k = `${f.rule}|${f.sig}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  mkdirSync(dirname(FINDINGS_FILE), { recursive: true });
  for (const f of findings) {
    appendFileSync(FINDINGS_FILE, JSON.stringify({ tpl, path, ...f, baselined: isBaselined(tpl, f) }) + '\n');
  }

  if (opts.screenshot) {
    const file = testInfo.outputPath(`${opts.screenshot}.png`);
    await page.screenshot({ path: file, fullPage: true });
    await testInfo.attach(opts.screenshot, { path: file, contentType: 'image/png' });
  }

  const label = `${path} [${tpl}]`;
  // The error-boundary copy the root renders when a route throws.
  const body = (await page.locator('body').innerText().catch(() => '')) || '';
  expect.soft(/Application Error|Something went wrong/i.test(body), `${label}: error boundary rendered`).toBe(false);
  expect.soft(errors, `${label}: client errors`).toEqual([]);
  expect.soft(hydration, `${label}: React hydration errors`).toEqual([]);
  expect.soft(guard.writes, `${label}: write attempts against prod (blocked)`).toEqual([]);
  const fresh = findings.filter((f) => !isBaselined(tpl, f));
  expect.soft(fresh.map((f) => `${f.rule}: ${f.detail}`), `${label}: new page-check findings (not in baseline.json)`).toEqual([]);

  return { guard, findings, status: resp?.status() ?? null };
}
