#!/usr/bin/env node
/**
 * Going P3: shoot every harness scene at 390x844 into docs/handover/going-p3/
 * and measure Design Gate stage 4 per scene: text contrast (>= 4.5:1 against
 * the painted background), tap targets (>= 44 x 44 px), sideways scroll at
 * 390, clipped or spilling text. Writes INDEX.md beside the PNGs. Exit 1 on any failure.
 *
 *   node tests/harness/going-p3/shoot.mjs
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const out = path.join(repo, 'docs/handover/going-p3');
const PORT = 5199;

const SHAPES = ['going-0', 'going-1', 'going-12', 'going-200', 'cancelled', 'cancelled-had-3'];
const SCENES = [
  ...['summary-home', 'summary-row', 'summary-stats', 'sheet'].flatMap((k) => SHAPES.map((s) => `${k}--${s}`)),
  ...['loading', 'error', 'not-signed-in', 'not-found', 'not-organiser'].map((s) => `load--${s}`),
];

const vite = spawn(process.execPath, [path.join(repo, 'node_modules/vite/bin/vite.js'), '--config', path.join(here, 'vite.config.ts')], {
  cwd: repo,
  stdio: ['ignore', 'pipe', 'ignore'],
});
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('vite did not start in 60s')), 60_000);
  vite.stdout.on('data', (b) => { if (String(b).includes('Local:')) { clearTimeout(t); resolve(); } });
});

const measure = () => {
  const lum = (c) => {
    const [r, g, b] = c.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const rgba = (s) => (s.match(/[\d.]+/g) ?? []).map(Number).concat([1]).slice(0, 4);
  const bgOf = (el) => {
    const layers = [];
    for (let e = el; e; e = e.parentElement) {
      const c = rgba(getComputedStyle(e).backgroundColor);
      if (c[3] > 0) { layers.push(c); if (c[3] >= 1) break; }
    }
    let base = [0, 0, 0, 1];
    for (const c of layers.reverse()) base = base.map((v, i) => (i < 3 ? c[i] * c[3] + v * (1 - c[3]) : 1));
    return base;
  };
  const texts = [...document.querySelectorAll('[data-scene] *')].filter((e) =>
    [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && e.getClientRects().length);
  let minContrast = 99;
  let worst = '';
  for (const e of texts) {
    if (e.closest('[aria-hidden="true"]') && !e.matches('[data-testid="going-initial"]')) continue;
    const fg = rgba(getComputedStyle(e).color);
    const bg = bgOf(e);
    const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
    const ratio = (a + 0.05) / (b + 0.05);
    if (ratio < minContrast) { minContrast = ratio; worst = e.textContent.trim().slice(0, 40); }
  }
  const taps = [...document.querySelectorAll('[data-scene] button, [data-scene] a')].filter((e) => e.getClientRects().length).map((e) => {
    const r = e.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), name: (e.getAttribute('aria-label') ?? e.textContent).trim().slice(0, 30) };
  });
  const smallTaps = taps.filter((t) => t.w < 44 || t.h < 44);
  const sideways = document.documentElement.scrollWidth > window.innerWidth;
  // Clipped (overflow hidden) OR spilling over a neighbour (overflow visible): text wider than its box.
  const clipped = texts.filter((e) => e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.trim().slice(0, 30));
  const list = document.querySelector('[data-testid="going-sheet-list"]');
  const listScrolls = list ? list.scrollHeight > list.clientHeight : null;
  return { minContrast: Math.round(minContrast * 100) / 100, worst, taps: taps.length, smallTaps, sideways, clipped, listScrolls };
};

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const rows = [];
let failed = 0;
try {
  for (const scene of SCENES) {
    await page.goto(`http://localhost:${PORT}/?scene=${scene}`);
    await page.waitForSelector(`[data-scene="${scene}"]`);
    await page.evaluate(() => document.fonts.ready);
    const m = await page.evaluate(measure);
    await page.screenshot({ path: path.join(out, `${scene}.png`) });
    const ok = m.minContrast >= 4.5 && m.smallTaps.length === 0 && !m.sideways && m.clipped.length === 0;
    if (!ok) failed++;
    rows.push(`| [${scene}](${scene}.png) | ${m.minContrast} (${m.worst.replace(/\|/g, '/')}) | ${m.taps} / ${m.smallTaps.length ? m.smallTaps.map((t) => `${t.name} ${t.w}x${t.h}`).join(', ') : 'none'} | ${m.sideways ? 'YES' : 'no'} | ${m.clipped.length ? m.clipped.join(', ') : 'none'} | ${m.listScrolls === null ? '-' : m.listScrolls ? 'inside the sheet' : 'fits'} | ${ok ? 'PASS' : 'FAIL'} |`);
    console.log(ok ? 'PASS' : 'FAIL', scene, JSON.stringify(m));
  }
} finally {
  await browser.close();
  vite.kill();
}

writeFileSync(path.join(out, 'INDEX.md'), [
  '# Going P3 -- organiser "who is going": 390x844 screenshots (Design Gate stage 4)',
  '',
  'Generated by `node tests/harness/going-p3/shoot.mjs` (component harness, organiser `.org-theme.ember-world` tokens = mockup C2).',
  'Frames copy C2\'s three slots: Home "Next up" hero (`summary-home`), the date sheet row (`summary-row`), Stats "By event" (`summary-stats`), and the list sheet (`sheet`).',
  '',
  '| Scene | Min text contrast (worst) | Taps / under 44px | Sideways scroll | Clipped text | 200-list | Stage 4 |',
  '|---|---|---|---|---|---|---|',
  ...rows,
  '',
].join('\n'));
console.log(failed ? `FAIL ${failed} scene(s)` : `PASS all ${SCENES.length} scenes`);
process.exit(failed ? 1 : 0);
