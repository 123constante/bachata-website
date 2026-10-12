import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { animationsDone, fakeSupabase, openOrganiserAsOwnerWithDraft, PUBLIC_ROUTES, scrollTo, settled } from './helpers';

/**
 * axe-core colour-contrast (WCAG 2 AA) on every public route and the organiser
 * page as its owner, at both phone sizes.
 *
 * A RATCHET, not a waiver: violations that already existed when this check
 * landed are frozen in axe-contrast-baseline.json, keyed "<project> <page>" ->
 * the axe target selectors. The test FAILS on
 *   - any violation not in the baseline (a new low-contrast element), and
 *   - any baseline entry that no longer reproduces (it was fixed: delete it),
 * so the file can only shrink. Never add an entry to make a PR green.
 */

type Baseline = Record<string, string[]>;
const BASELINE_FILE = new URL('./axe-contrast-baseline.json', import.meta.url);
const baseline: Baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf8')).violations;

async function contrastViolations(page: Page): Promise<{ target: string; summary: string }[]> {
  // Bottom first, so sections that mount on scroll-into-view are in the DOM;
  // then back to the top, where the fixed layers settle. axe reads the whole document.
  await scrollTo(page, 'bottom');
  await animationsDone(page);
  await scrollTo(page, 'top');
  await animationsDone(page);
  // preload:false, as tests/e2e/live/lib/pageChecks.ts checkAxe: axe otherwise
  // re-fetches every stylesheet, and the CSP blocks fonts.googleapis.com.
  // options() BEFORE withRules(): options() replaces the whole options object,
  // so the other order silently drops the rule filter and runs every rule.
  // The id filter below holds whichever way round a future edit puts them.
  const result = await new AxeBuilder({ page }).options({ preload: false }).withRules(['color-contrast']).analyze();
  return result.violations.filter((v) => v.id === 'color-contrast').flatMap((v) =>
    v.nodes.map((n) => ({ target: stableTarget(n.target.join(' ')), summary: (n.failureSummary ?? '').replace(/\s+/g, ' ').slice(0, 200) })),
  );
}

/**
 * axe's selector minus positional parts: ":nth-child(13)" names WHICH calendar
 * day cell, and that moves with the data, so a baseline keyed on it would go
 * stale for reasons that are not a contrast change. The rest of the selector
 * still names the element kind.
 */
const stableTarget = (t: string) => t.replace(/:nth-(child|of-type)\(\d+\)/g, '');

function assertAgainstBaseline(key: string, found: { target: string; summary: string }[]) {
  // Kept as an artifact for every run: what axe saw, before the baseline is applied.
  writeFileSync(test.info().outputPath('contrast-violations.json'), JSON.stringify({ key, found }, null, 2));
  const known = new Set(baseline[key] ?? []);
  const seen = new Set(found.map((f) => f.target));
  const added = [...new Map(found.filter((f) => !known.has(f.target)).map((f) => [f.target, f])).values()];
  const fixed = [...known].filter((t) => !seen.has(t));
  expect(added, `${key}: NEW colour-contrast violations (fix them; never add them to the baseline)`).toEqual([]);
  expect(fixed, `${key}: baseline entries no longer reproduce -- delete them from tests/e2e-phone/axe-contrast-baseline.json`).toEqual([]);
}

for (const path of PUBLIC_ROUTES) {
  test(`contrast ${path}`, async ({ page }, info) => {
    await fakeSupabase(page);
    const res = await page.goto(path);
    expect(res?.status(), `${path} must render (status)`).toBeLessThan(400);
    await settled(page);
    assertAgainstBaseline(`${info.project.name} ${path}`, await contrastViolations(page));
  });
}

test('contrast organiser page as its owner (edit-in-place, Save bar up)', async ({ page }, info) => {
  await openOrganiserAsOwnerWithDraft(page);
  assertAgainstBaseline(`${info.project.name} organiser-owner`, await contrastViolations(page));
});
