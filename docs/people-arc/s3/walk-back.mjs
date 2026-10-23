import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto('http://localhost:4173/dancers/ramiro-zapata', { waitUntil: 'networkidle' }); await p.waitForTimeout(3000);
console.log(await p.$$eval('a', (as) => as.map((a) => a.getAttribute('href')).filter((h) => h && /djs|teachers/.test(h))));
const l = p.locator('a[href^="/djs/"]').first();
if (await l.count()) { await l.click(); await p.waitForURL('**/djs/**'); await p.waitForTimeout(2500); await p.click('[data-testid="frame-back"]'); await p.waitForTimeout(1500); console.log('after Back:', new URL(p.url()).pathname); }
await b.close();
