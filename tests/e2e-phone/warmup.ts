import { chromium, type FullConfig } from '@playwright/test';
import { fakeSupabase, PUBLIC_ROUTES } from './helpers';

/**
 * Global setup: warm the dev server's dependency optimiser BEFORE any test runs.
 *
 * On a cold Vite cache (every CI run) the first visits discover new deps, Vite
 * re-optimises them and reloads the page; pages caught mid-way render React's
 * "Application Error" (two copies of React: "reading 'useContext'") or lose their
 * execution context. Measured on the first CI run of this suite: 2 failed and 4
 * flaky, every one on the first project to reach a route, none with a warm cache.
 *
 * So every route the suite visits is loaded here, pass after pass, until one full
 * pass renders no "Application Error". Still erroring after the last pass is a
 * real failure, thrown here -- never a silent green.
 */
export default async function warmup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL as string;
  const browser = await chromium.launch();
  try {
    const paths = [...PUBLIC_ROUTES];
    let broken: string[] = [];
    for (let pass = 1; pass <= 4; pass++) {
      broken = [];
      for (const path of paths) {
        const context = await browser.newContext({ baseURL });
        const page = await context.newPage();
        await fakeSupabase(page, { signedInAsOwner: true, realClock: true });
        try {
          await page.goto(path, { waitUntil: 'load', timeout: 90_000 });
          await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
          await page.waitForTimeout(500);
          const errored = await page
            .getByRole('heading', { name: 'Application Error' })
            .count()
            .catch(() => 1); // context destroyed by an optimiser reload: not settled yet
          if (errored) broken.push(path);
        } catch {
          broken.push(path);
        } finally {
          await context.close();
        }
      }
      if (pass > 1 && broken.length === 0) return;
    }
    throw new Error(`phone-qa warm-up: still erroring after 4 passes: ${broken.join(', ')}`);
  } finally {
    await browser.close();
  }
}
