import { chromium } from 'playwright';
const proxy = { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' };
const b = await chromium.launch({ proxy });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto('http://localhost:4173/djs/' + (process.env.S || 'papacito'), { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
const from = process.env.FROM || 'dj', to = process.env.TO || 'dancer';
await p.evaluate(() => { window.__log = []; const t0 = performance.now(); const tick = () => { const t = document.querySelector('[data-testid="role-tabs"]'); const w = document.querySelector('[data-testid="dancer-world-card"],[data-testid="dj-world"]'); window.__log.push(`${Math.round(performance.now() - t0)}:${t ? Math.round(t.getBoundingClientRect().top) : '-'}/${w ? Math.round(w.getBoundingClientRect().top) : '-'}`); if (performance.now() - t0 < 3000) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
await p.click(`[data-testid="role-tabs"] a:has-text("Dancer"), [data-testid="role-tabs"] button:has-text("Dancer")`);
await p.waitForTimeout(3200);
const log = await p.evaluate(() => window.__log);
const out = []; let last = ''; for (const l of log) { const v = l.split(':')[1]; if (v !== last) { out.push(l); last = v; } }
console.log(p.url(), out.join('  '));
await b.close();
