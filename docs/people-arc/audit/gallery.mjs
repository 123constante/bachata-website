// Builds gallery.html from measurements.json: every screenshot, grouped by shape, screens side by side.
//   node docs/people-arc/audit/gallery.mjs
import fs from 'node:fs';
const OUT = 'docs/people-arc/audit';
const rows = JSON.parse(fs.readFileSync(`${OUT}/measurements.json`, 'utf8'));
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
const shapes = [...new Set(rows.map((r) => r.shape))];
const ORDER = ['wall-dancers', 'wall-djs', 'wall-teachers', 'wall-organisers', 'hub', 'role-dancer', 'role-dj', 'role-teacher'];
let body = '';
for (const s of shapes) {
  body += `<section id="${esc(s)}"><h2>${esc(s === 'all' ? 'Walls (every person)' : s)}</h2>`;
  for (const w of [390, 360]) {
    const set = rows.filter((r) => r.shape === s && r.width === w).sort((a, b) => (a.build === b.build ? ORDER.indexOf(a.screen) - ORDER.indexOf(b.screen) : a.build < b.build ? 1 : -1));
    body += `<h3>${w}px</h3><div class="row">`;
    for (const r of set) body += `<figure><figcaption><b>${esc(r.build === 'main' ? 'main' : '#963')}</b> ${esc(r.screen)}<br><code>${esc(r.landed)}</code>${r.status && r.status >= 400 ? ` <span class="bad">${r.status}</span>` : ''}${/went wrong/i.test(r.h1?.text || '') ? ' <span class="bad">error</span>' : ''}</figcaption><a href="shots/${esc(r.file)}"><img loading="lazy" src="shots/${esc(r.file)}" alt="${esc(r.build + ' ' + r.screen + ' ' + s)}" width="${w / 2}"></a></figure>`;
    body += '</div>';
  }
  body += '</section>';
}
const nav = shapes.map((s) => `<a href="#${esc(s)}">${esc(s)}</a>`).join(' ');
fs.writeFileSync(`${OUT}/gallery.html`, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>People audit gallery</title>
<style>:root{--bg:#fff;--fg:#111;--mut:#666;--bad:#b00020}@media (prefers-color-scheme:dark){:root{--bg:#111;--fg:#eee;--mut:#aaa;--bad:#ff6b81}}
body{background:var(--bg);color:var(--fg);font:14px system-ui;margin:0;padding:12px 16px}nav{font-size:12px;line-height:1.8}nav a{margin-right:8px}
.row{display:flex;gap:12px;overflow-x:auto;align-items:flex-start;padding-bottom:8px}figure{margin:0;flex:none}figcaption{font-size:11px;color:var(--mut);max-width:200px;word-break:break-all}
img{display:block;height:auto;border:1px solid #8884}.bad{color:var(--bad);font-weight:700}h2{margin-top:32px}</style></head><body>
<h1>People pages audit &mdash; screenshots</h1><p>${rows.length} full-page screenshots. main = prod-like flags (wall/hub/teacher pages off); #963 = PR #963 head with peopleWall, personHub and teacher/organiser pages on. Click a shot for full size. Report: <a href="REPORT.md">REPORT.md</a>.</p><nav>${nav}</nav>${body}</body></html>`);
console.log('gallery', rows.length);
