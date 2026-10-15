import { test, expect, type Page } from '@playwright/test';
import { build } from 'esbuild';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * The banner ships OFF, so the real home page cannot show it. This spec bundles
 * the component with esbuild, flips it ON through its `enabled` prop (never by
 * editing the constant), and styles it with the PRODUCTION css from `npm run build`.
 * Needs `build/client/assets/root-*.css`.
 */
const ROOT = process.cwd();

async function bundle(enabled: boolean): Promise<string> {
  const entry = `
    import { createRoot } from 'react-dom/client';
    import { MemoryRouter } from 'react-router-dom';
    import HomeAnnounceBanner from '@/components/HomeAnnounceBanner';
    createRoot(document.getElementById('root')).render(
      <MemoryRouter><HomeAnnounceBanner enabled={${enabled}} /><main>calendar placeholder</main></MemoryRouter>);`;
  const out = await build({
    stdin: { contents: entry, resolveDir: ROOT, loader: 'tsx' },
    bundle: true,
    write: false,
    format: 'iife',
    jsx: 'automatic',
    alias: { '@': path.join(ROOT, 'src') },
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  return out.outputFiles[0].text;
}

async function open(page: Page, enabled: boolean) {
  const assets = path.join(ROOT, 'build/client/assets');
  const css = readFileSync(path.join(assets, readdirSync(assets).find((f) => /^root-.*\.css$/.test(f))!), 'utf8');
  await page.route('**/banner-harness', (r) =>
    r.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div></body></html>' }),
  );
  await page.goto('http://127.0.0.1:4185/banner-harness');
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: await bundle(enabled) });
}

test('banner ON: 44px+ controls, no sideways scroll, dismiss sticks', async ({ page }) => {
  await open(page, true);
  const banner = page.getByTestId('home-announce-banner');
  await expect(banner).toBeVisible();
  const cta = page.getByRole('link', { name: 'Create your profile' });
  const close = page.getByRole('button', { name: 'Dismiss' });
  expect((await cta.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect((await close.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect((await banner.boundingBox())!.height).toBeLessThan(120);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await close.click();
  await expect(banner).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('home-announce-dismissed-v1'))).not.toBeNull();
});

test('banner OFF: nothing rendered', async ({ page }) => {
  await open(page, false);
  await expect(page.getByText('calendar placeholder')).toBeVisible();
  await expect(page.getByTestId('home-announce-banner')).toHaveCount(0);
});
