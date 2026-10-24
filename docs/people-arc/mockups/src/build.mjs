// Builds the standalone direction pages a.html, b.html, c.html from src/ (facts.js + ui.js + dir-*.js inlined).
// Run: node docs/people-arc/mockups/src/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = dirname(fileURLToPath(import.meta.url));
const out = join(src, '..');
const read = (f) => readFileSync(join(src, f), 'utf8');

for (const letter of ['a', 'b', 'c']) {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>People page mockup ${letter.toUpperCase()}</title>
<style>*{box-sizing:border-box}html{font-size:13.5px}body{margin:0;-webkit-font-smoothing:antialiased}h1,h2{margin:0}button{cursor:pointer}a:focus-visible,button:focus-visible{outline:2px solid #FBEBDD;outline-offset:2px}</style>
</head><body><div id="root"></div>
<script>
${read('facts.js')}
${read(`dir-${letter}.js`)}
${read('ui.js')}
renderView();
</script></body></html>
`;
  writeFileSync(join(out, `${letter}.html`), html);
  console.log(`wrote ${letter}.html`);
}

// The gallery inlines the same facts.js and the latest self-check summary (run capture.mjs first).
let summary = '{}';
try { summary = readFileSync(join(out, 'checks-summary.json'), 'utf8'); } catch { console.log('no checks-summary.json yet'); }
writeFileSync(join(out, 'gallery.html'), read('gallery.tpl.html').replace('/*FACTS*/', read('facts.js')).replace('/*SUMMARY*/', summary));
console.log('wrote gallery.html');
