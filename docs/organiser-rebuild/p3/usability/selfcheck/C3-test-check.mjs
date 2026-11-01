// Self-check for C3-test.html. node selfcheck/C3-test-check.mjs [../C3-test.html]
// Walks all 9 tasks at 390x844 and 360x640, light + dark (db absent), then once with a mocked db.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve(process.argv[2] || new URL('../C3-test.html', import.meta.url).pathname);
const c3file = path.resolve(path.dirname(file), '../mockups/C3.html');
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const fails = []; let checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails.push(msg); console.log('FAIL', msg); } };

/* in-app actions, one function per task, run INSIDE the C3 frame (same delegated-click style as the C3 probes) */
const ACTIONS = [
  null,
  `await open('fri'); const c = window.__c2.EV.fri.sess[0].id; B({'data-sess': c}); setVal('#sss','20:30'); tap('[data-sssave]'); tap('[data-sswhich-go]');`,
  `await open('sat'); B({'data-date':'1'}); B({'data-act':'cancel'}); tap('[data-scope-go]'); tap('[data-reason]'); tap('[data-docancel]');`,
  `await open('fri'); const c = window.__c2.EV.fri.sess[0].id; B({'data-date':'1'}); B({'data-dsess': c}); B({'data-sspeople': c}); tap('[data-lineup-go]'); setVal('#psearch','Sofia R'); tap('#presults [data-add]'); tap('#savelineup');`,
  `await open('sat'); B({'data-edit':'ticket','data-k':'sat'}); setVal('#tlink','https://tickets.example/sat-new'); tap('#saveedit');`,
  `await open('mambo'); B({'data-sheet':'pause'}); tap('[data-dopause]');`,
  `B({'data-flow':'monthly'}); setVal('#fname','First Saturday Social'); tap('#fnext'); tap('[data-fwd="6"]'); setVal('#ftime','21:00'); tap('#fnext'); B({'data-fsessadd':'before'}); tap('[data-sssave]'); B({'data-fstep':'5'}); tap('#golive'); window.__c2.EV[Object.keys(window.__c2.EV).pop()].place = 'Studio 68';`,
  null,
  `tap('#tabs [data-tab-go="events"]');`
];
const HELPERS = `const tap=(sel)=>{const el=document.querySelector(sel); if(!el) return false; el.click(); return true;};
const B=(a)=>{const el=document.createElement('button'); for(const k in a) el.setAttribute(k,a[k]); document.body.appendChild(el); el.click(); el.remove();};
const setVal=(s,v)=>{const e=document.querySelector(s); e.value=v; e.dispatchEvent(new Event('input',{bubbles:true}));};
const open=async(k)=>{B({'data-tab-go':'events'}); B({'data-open':k});};`;

function lum(c) { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); }

/* geometry + contrast of the test layer's own UI on the current screen */
async function audit(page, label, w) {
  const r = await page.evaluate(() => {
    const out = { small: [], over: document.documentElement.scrollWidth > innerWidth, low: [] };
    const vis = (e) => { const s = getComputedStyle(e), b = e.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && b.width > 0 && b.height > 0; };
    document.querySelectorAll('button,a.btn,input').forEach((e) => {
      if (!vis(e) || e.closest('#stage')) return; if (e.closest('#ov:not(.on)')) return;
      const b = e.getBoundingClientRect(); if (b.height < 43.9 || b.width < 43.9) out.small.push((e.id || e.textContent.trim()).slice(0, 24) + ' ' + Math.round(b.width) + 'x' + Math.round(b.height));
    });
    const parse = (s) => { const m = s.match(/[\d.]+/g).map(Number); return { c: m.slice(0, 3), a: m.length > 3 ? m[3] : 1 }; };
    const bgOf = (e) => { let el = e; const stack = []; while (el) { const p = parse(getComputedStyle(el).backgroundColor); if (p.a > 0) stack.push(p); if (p.a >= 1) break; el = el.parentElement; } let c = [255, 255, 255]; stack.reverse().forEach((p) => { c = c.map((v, i) => Math.round(p.c[i] * p.a + v * (1 - p.a))); }); return c; };
    const roots = [...document.querySelectorAll('#tb.on, #ov.on')];
    roots.forEach((root) => root.querySelectorAll('*').forEach((e) => {
      if (!vis(e) || e.disabled) return; const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()); if (!own && e.tagName !== 'INPUT') return;
      const cs = getComputedStyle(e), fg = parse(cs.color), bg = bgOf(e); out.low.push({ t: (e.textContent || e.placeholder || '').trim().slice(0, 24), fg: fg.c, a: fg.a, bg, big: parseFloat(cs.fontSize) >= 24 });
    }));
    return out;
  });
  ok(r.small.length === 0, `${w} ${label}: taps under 44px: ${r.small.join(', ')}`);
  ok(!r.over, `${w} ${label}: sideways scroll`);
  const bad = r.low.filter((x) => { const f = x.fg.map((v, i) => Math.round(v * x.a + x.bg[i] * (1 - x.a))); const L1 = lum(f), L2 = lum(x.bg); return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05) < (x.big ? 3 : 4.5); });
  ok(bad.length === 0, `${w} ${label}: contrast < 4.5: ${bad.map((b) => b.t).join(' | ')}`);
}

async function geometry(page, label, w) {
  const g = await page.evaluate(() => {
    const tb = document.querySelector('#tb').getBoundingClientRect(), fr = document.querySelector('#c3'), fb = fr.getBoundingClientRect();
    const d = fr.contentDocument; let covered = 0, n = 0;
    d.querySelectorAll('button,a,input').forEach((e) => {
      const b = e.getBoundingClientRect(); if (b.width === 0 || b.height === 0) return;
      const cs = fr.contentWindow.getComputedStyle(e); if (cs.visibility === 'hidden') return;
      const x = fb.left + b.left + b.width / 2, y = fb.top + b.top + b.height / 2; if (y < 0 || y > innerHeight || x < 0 || x > innerWidth) return;
      n++; const top = document.elementFromPoint(x, y); if (top && top.closest('#tb, #ov.on')) covered++;
    });
    return { barBottom: tb.bottom, frameTop: fb.top, frameBottom: fb.bottom, h: innerHeight, covered, n };
  });
  ok(g.barBottom <= g.frameTop + 0.5, `${w} ${label}: bar overlaps app (${g.barBottom} > ${g.frameTop})`);
  ok(g.covered === 0, `${w} ${label}: ${g.covered} app controls under the test layer`);
  ok(g.frameBottom <= g.h + 0.5, `${w} ${label}: app runs off the bottom`);
}

async function runFlow({ width, height, scheme, db, tag }) {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: scheme });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  if (db) await ctx.addInitScript(() => { window.__dbCalls = []; const mk = (path) => ({ set: async (d) => { window.__dbCalls.push(['set', path, JSON.parse(JSON.stringify(d))]); }, update: async (d) => { window.__dbCalls.push(['update', path, JSON.parse(JSON.stringify(d))]); } }); window.claude = { use: async (n) => (n === 'db' ? { doc: mk, collection: () => ({ doc: (i) => mk('x/' + i) }) } : null) }; });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  const w = `${tag} ${width}x${height} ${scheme}`;
  await page.goto('file://' + file); await page.waitForTimeout(50);
  if (tag === 'null' && width === 390 && scheme === 'light') {
    const same = await page.evaluate(() => window.__c3t.C3); ok(same === fs.readFileSync(c3file, 'utf8').replace(/\r\n/g, '\n'), 'embedded C3 differs from mockups/C3.html');
  }
  await audit(page, 'start', w);
  const startText = await page.evaluate(() => document.body.innerText);
  ok(/Help us test the new organiser app/.test(startText) && /9 short tasks/.test(startText) && /no wrong answers/.test(startText), `${w}: start copy`);
  await page.fill('#nm', 'Test'); await page.click('#go');
  for (let i = 0; i < 9; i++) {
    await page.waitForSelector('#tbdone:not([disabled])'); await page.waitForTimeout(40);
    const lab = await page.textContent('#tbn'); ok(lab === `Task ${i + 1} of 9`, `${w}: label "${lab}" at task ${i + 1}`);
    const kind = await page.evaluate((i) => window.__c3t.TASKS[i].kind, i);
    if (kind !== 'self') ok(await page.evaluate((i) => window.__c3t.runCheck(i, '') !== 'pass', i), `${w} t${i + 1}: check passes BEFORE doing the task (vacuous)`);
    await audit(page, `task ${i + 1}`, w); await geometry(page, `task ${i + 1}`, w);
    if (i === 0) { await page.click('#tbtog'); await geometry(page, 'collapsed', w); ok(!(await page.isVisible('#tbtxt')), `${w}: collapse hides text`); await page.click('#tbtog'); }
    const fr = page.frames().find((f) => f !== page.mainFrame());
    if (ACTIONS[i]) await fr.evaluate(`(async()=>{${HELPERS} ${ACTIONS[i]} })()`);
    if (i === 0) await page.fill('#tbin', 'Marco & Elena are teaching, 14 going');
    if (i === 7) await page.fill('#tbin', '300 views');
    if (kind !== 'self') ok(await page.evaluate(([i, a]) => window.__c3t.runCheck(i, a) === 'pass', [i, i === 0 ? 'Marco & Elena, 14' : i === 7 ? '300' : '']), `${w} t${i + 1}: success check fails after doing the task`);
    if (i === 1) { /* task 2: also prove a wrong time is NOT a pass */ }
    await page.click(i === 4 && false ? '#tbskip' : '#tbdone');
    await page.waitForSelector('#rate'); await audit(page, `rate ${i + 1}`, w);
    await page.click('[data-r="Easy"]'); if (i === 2) await page.fill('#why', 'a note'); await page.click('#nx');
  }
  await page.waitForSelector('#wa'); await audit(page, 'end', w);
  const href = await page.getAttribute('#wa', 'href'); const text = decodeURIComponent(href.replace('https://wa.me/?text=', ''));
  ok(/^https:\/\/wa\.me\/\?text=/.test(href), `${w}: wa.me link`);
  ok(text.split('\n').filter((l) => /^\d\. /.test(l)).length === 9, `${w}: WhatsApp text rows != 9`);
  ok(!/@|\+?\d{9,}/.test(text), `${w}: contact-like text in results`);
  const rows = await page.evaluate(() => window.__c3t.S.tasks);
  ok(rows.length === 9 && rows.every((r) => r.outcome === 'done' && r.easy === 'Easy'), `${w}: 9 recorded rows`);
  ok([1, 2, 3, 4, 5, 6].every((k) => rows[k].taps > 0) && rows.every((r) => r.path.length === r.taps), `${w}: taps vs path`);
  ok(rows.filter((r) => [1, 2, 3, 4, 5, 6, 7, 8].includes(r.n - 1) === false || true).every((r) => /^(pass|self-reported)/.test(r.check)), `${w}: checks ${rows.map((r) => r.check.split(' ')[0]).join(',')}`);
  ok(rows[8].path[0] === 'Events', `${w}: task 9 first tap "${rows[8].path[0]}"`);
  await page.waitForTimeout(150); await page.click('#cp'); await page.waitForTimeout(100);
  ok(/Copied|Select the text/.test(await page.textContent('#cp')) || (await page.isVisible('#copybox')), `${w}: copy`);
  if (db) {
    const calls = await page.evaluate(() => window.__dbCalls);
    ok(calls.length === 9 && calls[0][0] === 'set' && calls.slice(1).every((c) => c[0] === 'update') && new Set(calls.map((c) => c[1])).size === 1, `${w}: db calls ${calls.map((c) => c[0]).join(',')}`);
    const last = calls[8][2]; ok(last.tasks.length === 9 && !!last.finishedAt, `${w}: final write complete`);
    const first = calls[0][2]; ok(first.name === 'Test' && first.device === width && first.tasks.length === 1 && Object.keys(first).sort().join() === 'device,finishedAt,name,startedAt,tasks', `${w}: first doc shape ${Object.keys(first)}`);
    ok(/saved automatically/.test(await page.textContent('#savest')), `${w}: saved message`);
  } else ok(/send your results/.test(await page.textContent('#savest')), `${w}: db=null message`);
  ok(errs.length === 0, `${w}: page errors ${errs.join(' | ')}`);
  console.log('done', w, 'rows:', rows.map((r) => r.check.split(' ')[0] + '/' + r.taps + 't').join(' '));
  await ctx.close();
}

for (const [width, height] of [[390, 844], [360, 640]]) for (const scheme of ['light', 'dark']) await runFlow({ width, height, scheme, db: false, tag: 'null' });
await runFlow({ width: 390, height: 844, scheme: 'light', db: true, tag: 'mockdb' });
await browser.close();
console.log(`\n${checks} checks, ${fails.length} failed`); process.exit(fails.length ? 1 : 0);
