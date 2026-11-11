// Builds C3-test.html = C3-test.template.html + the unchanged mockups/C3.html held as escaped text.
// node build-c3-test.mjs
import fs from 'node:fs';
import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname);
const c3 = fs.readFileSync(path.join(here, '../mockups/C3.html'), 'utf8');
if (c3.includes('<@@')) throw new Error('sentinel clash');
const esc = c3.replace(/<(\/?)script/gi, '<@@$1script').replace(/<!--/g, '<@@!--');
const tpl = fs.readFileSync(path.join(here, 'C3-test.template.html'), 'utf8');
fs.writeFileSync(path.join(here, 'C3-test.html'), tpl.replace('/*C3_SOURCE*/', () => esc));
console.log('wrote C3-test.html', fs.statSync(path.join(here, 'C3-test.html')).size);
