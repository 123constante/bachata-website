import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:8081/';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', (msg) => {
    console.log(`[console:${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', (err) => {
    console.error('[pageerror]', err);
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (err) {
    console.error('Failed to load page:', err);
  }

  await page.waitForTimeout(3000);

  const content = await page.content();
  console.log('Rendered HTML length:', content.length);

  await page.screenshot({ path: 'white-screen-debug.png', fullPage: true });
  await browser.close();
})();
