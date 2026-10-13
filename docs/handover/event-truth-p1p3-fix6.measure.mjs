// Per-entry first-load chunk count: every route module and lazy page (isEntry / isDynamicEntry),
// static-import closure from app/entry.client.tsx + app/root.tsx + the entry itself, base vs head.
import { readFileSync } from 'node:fs';
const [baseDir, headDir] = process.argv.slice(2);
const load = (d) => JSON.parse(readFileSync(`${d}/build/client/.vite/manifest.json`, 'utf8'));
const B = load(baseDir), H = load(headDir);
const closure = (M, keys) => {
  const seen = new Set(); const q = keys.filter((k) => M[k]);
  while (q.length) { const k = q.shift(); if (seen.has(k)) continue; seen.add(k); for (const i of M[k].imports ?? []) q.push(i); }
  const js = new Set([...seen].map((k) => M[k].file)); const css = new Set([...seen].flatMap((k) => M[k].css ?? []));
  return { js, css, n: js.size + css.size };
};
const SUF = '?__react-router-build-client-route';
const key = (M, k) => (M[k] ? k : M[k + SUF] ? k + SUF : null);
const shellOf = (M) => ['app/entry.client.tsx', 'app/root.tsx'].map((k) => key(M, k)).filter(Boolean);
const entries = Object.keys(H).filter((k) => H[k].isEntry || H[k].isDynamicEntry);
const rulesFile = Object.values(H).find((v) => /lib-event-rules/.test(v.file))?.file;
let changed = 0, loads = 0, rows = [];
for (const k of entries) {
  const h = closure(H, [...shellOf(H), k]);
  const hasRules = rulesFile && h.js.has(rulesFile);
  if (hasRules) loads += 1;
  const b = B[k] ? closure(B, [...shellOf(B), k]) : null;
  const d = b ? h.n - b.n : null;
  if (d !== 0) changed += 1;
  rows.push(`${d === null ? 'NEW ' : d > 0 ? `+${d}  ` : d < 0 ? `${d}  ` : '=   '} ${k}  head ${h.n}${b ? ` base ${b.n}` : ''}`);
}
console.log(`lib-event-rules chunk: ${rulesFile}`);
console.log(`entries (route + lazy) in head: ${entries.length}; loading lib-event-rules statically: ${loads}; count changed vs base: ${changed}`);
for (const r of rows.sort()) console.log(r);
