// Builds gallery.html from facts.js + checks.json. Run after capture.mjs:
// node docs/people-arc/worlds/src/gallery.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..');
const { PAGES, PEOPLE, FILLERS, FACT_SOURCES } = new Function(`${readFileSync(join(dir, 'src/facts.js'), 'utf8')}; return { PAGES, PEOPLE, FILLERS, FACT_SOURCES };`)();
const checks = JSON.parse(readFileSync(join(dir, 'checks.json'), 'utf8'));
const sum = JSON.parse(readFileSync(join(dir, 'checks-summary.json'), 'utf8'));

// Today's live page for each AFTER (P0 audit shots, main fe77e93; teacher pages also from the
// teacher-pages-on build, because main shows a "Coming soon" form there).
const BEFORE = {
  'magda-dancer': [['dancer-dancer-nophoto', 'Live today']],
  'sabrina-dancer': [['dancer-dancer-longname', 'Live today']],
  'pierre-teacher': [['teacher-teacher-nophoto', 'Live today (teacher pages closed)'], ['hub-teacher-teacher-nophoto', 'Teacher page with the flag on']],
  'nadeem-teacher': [],
  'papacito-dj': [['dj-dancer-dj-claimed-2gigs', 'Live today']],
  'papacito-dancer': [['dancer-dancer-dj-claimed-2gigs', 'Live today']],
  'ramiro-teacher': [['teacher-all3-claimed-rich', 'Live today (teacher pages closed)'], ['hub-teacher-all3-claimed-rich', 'Teacher page with the flag on']],
  'ramiro-dj': [['dj-all3-claimed-rich', 'Live today']],
  'ramiro-dancer': [['dancer-all3-claimed-rich', 'Live today']],
};
const WORLD = { dancer: 'Dancer world (teal card)', dj: 'DJ world (record sleeve)', teacher: 'Teacher world (studio timetable)' };
const fig = (src, cap, cls = '') => `<figure class="${cls}"><a href="${src}"><img src="${src}" alt="${cap}" loading="lazy"></a><figcaption>${cap}</figcaption></figure>`;
const live = (key, f, w) => `worlds.html?p=${key.split('-')[0]}&r=${key.split('-')[1]}${f ? `&f=${f}` : ''}`;

const people = [...new Set(PAGES.map((x) => x.person))];
const personSections = people.map((pk) => {
  const p = PEOPLE[pk];
  const pages = PAGES.filter((x) => x.person === pk);
  return `<section><h2>${p.name}</h2><p class="meta">Roles: ${p.roles.join(', ')}. ${p.roles.length > 1 ? 'Tab row shown.' : 'One role: no tab row.'}</p>
  ${pages.map((x) => `<h3>${WORLD[x.role]} &mdash; ${x.label}</h3><div class="row">
    ${BEFORE[x.key].length ? BEFORE[x.key].map(([b, cap]) => fig(`before/${b}-390.png`, `BEFORE: ${cap}, 390`, 'before')).join('') : '<figure class="before none"><div>BEFORE not captured: no audit shot of this person. On main every teacher page shows the &ldquo;Coming soon&rdquo; form (see Pierre Henry).</div></figure>'}
    ${fig(`shots/${x.key}-390.png`, 'AFTER 390x844', 'after')}${fig(`shots/${x.key}-360.png`, 'AFTER 360x800', 'after')}
    </div><p class="open"><a href="${live(x.key)}">Open this page live</a></p>`).join('')}</section>`;
}).join('');

const fillerSection = `<section><h2>The open question: what goes under the dancer card?</h2>
<p>The calendar holds nothing for dancers, so today the dancer page ends in empty ground. Three answers, each drawn on a thin dancer-only person (Magda) and on Ramiro. In every world the footer now comes up straight after the content, so no answer leaves empty ground.</p>
${['magda', 'ramiro'].map((pk) => `<h3>${PEOPLE[pk].name}</h3><div class="row">${[1, 2, 3].map((f) => fig(`shots/${pk}-dancer-f${f}-390.png`, `(${f}) ${FILLERS[f]}${pk === 'magda' && f === 2 ? ' &mdash; Magda has no other world, so this is the same page as (3)' : ''}`, 'after')).join('')}</div>`).join('')}
<p class="meta">360-wide versions: <code>shots/*-dancer-f1|f2|f3-360.png</code>. When the owner has not chosen, the mockup pages use (2) if the person has another world with a date, else (1), else (3).</p></section>`;

const ok = (b) => (b ? '<td class="pass">pass</td>' : '<td class="fail">FAIL</td>');
const rows = checks.map((r) => {
  const minC = Math.min(...r.texts.filter((t) => t.ratio !== null).map((t) => t.ratio));
  const small = r.taps.filter((t) => t.w < 44 || t.h < 44).length;
  const tabOk = r.multi ? r.tabRows === 1 : r.tabRows === 0;
  return `<tr><td>${r.shot}</td><td>${minC.toFixed(2)}</td>${ok(minC >= 4.5)}${ok(!small)}${ok(!r.clipped.length && !r.offscreen.length)}${ok(!r.sideways)}${ok(tabOk)}<td>${r.tabsShown.join(' ') || '&ndash;'}</td><td>${r.tabY ?? '&ndash;'}</td><td>${r.backY}</td></tr>`;
}).join('');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>People worlds gallery</title>
<style>
:root { --bg: #f6f5f2; --ink: #1b1a17; --muted: #5d5a52; --line: #d9d5cc; --card: #fff; }
@media (prefers-color-scheme: dark) { :root { --bg: #151413; --ink: #f1efe9; --muted: #b9b4a8; --line: #3a3732; --card: #1f1d1b; } }
body { margin: 0; padding: 16px; background: var(--bg); color: var(--ink); font: 14px/1.5 Inter, system-ui, sans-serif; }
h1 { font-size: 22px; margin: 0 0 4px; } h2 { font-size: 19px; margin: 28px 0 4px; border-top: 1px solid var(--line); padding-top: 16px; } h3 { font-size: 15px; margin: 18px 0 6px; }
.meta, figcaption { color: var(--muted); font-size: 13px; }
.row { display: flex; gap: 12px; overflow-x: auto; align-items: flex-start; padding-bottom: 6px; }
figure { margin: 0; flex: none; width: 240px; }
figure img { width: 100%; border: 1px solid var(--line); border-radius: 8px; display: block; }
figure.before img { outline: 3px solid #b44; outline-offset: -3px; } figure.after img { outline: 3px solid #2a8; outline-offset: -3px; }
figure.none div { border: 1px dashed var(--line); border-radius: 8px; padding: 12px; color: var(--muted); }
table { border-collapse: collapse; font-size: 12px; width: 100%; } td, th { border: 1px solid var(--line); padding: 4px 6px; text-align: left; } .pass { color: #187a4c; } .fail { color: #b42318; font-weight: 700; }
@media (prefers-color-scheme: dark) { .pass { color: #5fd39a; } .fail { color: #ff8a80; } }
.tablewrap { overflow-x: auto; } a { color: inherit; }
</style></head><body>
<h1>People pages: the three worlds</h1>
<p class="meta">P2b mockups, 2026-10-23. Red frame = today&rsquo;s live page (P0 audit shots), green frame = the proposal. Header and footer in every AFTER are the live site&rsquo;s own pixels. Photos are a striped stand-in (the image host is unreachable from the build sandbox). Data: prod read-only, see <code>data.md</code>.</p>
<h2>What is the same on every world</h2>
<ul><li>Back (left) and Share (right) in one bar, directly under the site header, at the same height on every page.</li>
<li>The role tabs sit under that bar and above the photo, the same component in the same place (y = ${sum.tabY.join(', ')} px). They list ALL the person&rsquo;s roles, the current one filled in its role colour; tapping goes to <code>/teachers|/djs|/dancers/&lt;slug&gt;</code>. One-role people get no tab row.</li>
<li>One placeholder family: a circle with initials, coloured by the world. One date format (&ldquo;Thursday 29 October&rdquo;), counts only from 2, languages as full names, nationality as a flag, city without a postcode.</li>
<li>Names: the DJ world shows the DJ name big and the public name small under it (Morcilla / Papacito); when there is no DJ name (Ramiro) only the public name shows. Dancer and teacher worlds show the public name.</li>
<li>No &ldquo;coming soon&rdquo; blocks, no empty cards: a section only appears when it has rows. The footer comes up right after the content.</li></ul>
${personSections}
${fillerSection}
<section><h2>Self-check (${checks.length} renders)</h2>
<p class="meta">Contrast = the lowest text contrast on the page, measured against every solid colour and gradient stop behind the text (worst case). Taps = every link and button at least 44x44. Tab y = the tab row&rsquo;s top in px; Back y = the Back control&rsquo;s top.</p>
<div class="tablewrap"><table><tr><th>Render</th><th>Lowest contrast</th><th>&ge; 4.5</th><th>Taps &ge; 44</th><th>No clipping</th><th>No sideways scroll at width</th><th>Tab row only for 2+ roles</th><th>Tabs (* = selected)</th><th>Tab y</th><th>Back y</th></tr>${rows}</table></div></section>
<section><h2>Where each fact comes from</h2><div class="tablewrap"><table><tr><th>Fact</th><th>Rule (src/facts.js)</th><th>Source</th></tr>${FACT_SOURCES.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</table></div></section>
</body></html>
`;
writeFileSync(join(dir, 'gallery.html'), html);
console.log('gallery.html written');
