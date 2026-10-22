// node cls.mjs <url> <width>: layout shift while the timeline arrives (harness ?delay=), card order before/after.
import { chromium } from 'playwright';
const [url, w] = process.argv.slice(2);
const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await (await br.newContext({ viewport: { width: Number(w || 390), height: 844 }, deviceScaleFactor: 2, isMobile: true })).newPage();
await page.addInitScript(() => { window.__cls = 0; window.__shifts = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__cls += e.value; window.__shifts.push(Math.round(e.value * 1000) / 1000); } }).observe({ type: 'layout-shift', buffered: true }); });
await page.goto(url);
await page.waitForSelector('[data-testid="person-hub"]');
const snap = () => page.evaluate(() => ({ order: [...document.querySelectorAll('[data-testid="hub-role-card"]')].map((c) => `${c.getAttribute('data-role')}@${Math.round(c.getBoundingClientRect().top)}`).join(' '), button: !!document.querySelector('[data-testid="hub-next-event"]') }));
const first = await snap();
await page.waitForTimeout(2500);
const last = await snap();
const cls = await page.evaluate(() => ({ cls: Math.round(window.__cls * 1000) / 1000, shifts: window.__shifts }));
console.log(JSON.stringify({ url: url.split('?')[1], w, first, last, ...cls }));
await br.close();
