// S2 critique: each socials row's time against the event page it links to (same build, prod data).
import { chromium } from 'playwright';
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } : undefined;
const b = await chromium.launch({ proxy });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto('http://localhost:4173/dancers/' + (process.env.S || 'leoncio'), { waitUntil: 'networkidle' });
await p.waitForSelector('[data-testid="dancer-world-social-time"]', { timeout: 20000 });
const rows = await p.$$eval('[data-testid="dancer-world-socials"] a[href^="/event"]', (as) => as.map((a) => ({ href: a.getAttribute('href'), text: a.innerText.replace(/\s+/g, ' ') })));
for (const r of rows.slice(0, 4)) {
  await p.goto('http://localhost:4173' + r.href, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  const times = await p.evaluate(() => [...new Set((document.body.innerText.match(/\b\d{1,2}(:\d{2})?\s?(AM|PM|am|pm)\b|\b\d{2}:\d{2}\b/g) || []))].slice(0, 4));
  console.log(r.text, '|', r.href, '| event page:', times.join(', '));
}
await b.close();
