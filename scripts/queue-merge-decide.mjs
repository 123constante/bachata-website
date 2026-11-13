#!/usr/bin/env node
/**
 * queue-merge-decide.mjs -- verdict for queue-merge.yml. Reads the PR's file list through the REST
 * API (never PR code) and prints reserved=true|false, reasons=. A PR already labelled owner-reserved
 * stays reserved: only the owner removes that label. Exit 0 verdict written, 2 could not measure.
 *
 *   GH_TOKEN, GITHUB_REPOSITORY, PR_NUMBER, GITHUB_OUTPUT
 *   node scripts/queue-merge-decide.mjs [--self-test]
 */
import { appendFileSync, readFileSync } from 'node:fs';
import { isEntryPoint } from './lib/entry-point.mjs';
import { riskTier } from './lib/review-scope.mjs';
import { makeApi, reservedReasons } from './lib/queue.mjs';

const GLOBS = () => JSON.parse(readFileSync(new URL('./queue-reserved-paths.json', import.meta.url), 'utf8')).globs;

export async function decide(api, pr, globs) {
  const files = [];
  for (let page = 1; ; page++) {
    const batch = await api('GET', `/pulls/${pr}/files?per_page=100&page=${page}`);
    for (const f of batch) { files.push(f.filename); if (f.previous_filename) files.push(f.previous_filename); }
    if (batch.length < 100) break;
  }
  if (files.length === 0) throw new Error('empty file list');
  const labels = (await api('GET', `/issues/${pr}`)).labels.map((l) => l.name);
  const reasons = reservedReasons(files, globs, riskTier);
  if (labels.includes('owner-reserved')) reasons.unshift('already labelled owner-reserved (owner-only removal)');
  return { reserved: reasons.length > 0, reasons };
}

export async function main(argv, env = process.env, deps = {}) {
  if (argv.includes('--self-test')) return selfTest();
  if (!env.GH_TOKEN || !env.GITHUB_REPOSITORY || !/^\d+$/.test(env.PR_NUMBER || '')) { console.error('GH_TOKEN / GITHUB_REPOSITORY / PR_NUMBER not set'); return 2; }
  const api = deps.api || makeApi(env.GH_TOKEN, env.GITHUB_REPOSITORY);
  try {
    const v = await decide(api, Number(env.PR_NUMBER), deps.globs || GLOBS());
    const out = `reserved=${v.reserved}\nreasons=${v.reasons.slice(0, 5).join('; ')}\n`;
    if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, out); else process.stdout.write(out);
    return 0;
  } catch (e) { console.error(`INFRA: ${e.message}`); return 2; }
}

async function selfTest() {
  const globs = GLOBS();
  const mk = (files, labels = []) => async (m, p) => (p.startsWith('/issues/') ? { labels: labels.map((name) => ({ name })) } : files.map((filename) => ({ filename })));
  const cases = [
    ['plain src is ok', ['src/components/Foo.tsx'], [], false],
    ['migration reserved', ['supabase/migrations/1.sql'], [], true],
    ['price reserved', ['src/lib/ticketPrice.ts'], [], true],
    ['payout reserved', ['src/modules/payouts/payoutTable.ts'], [], true],
    ['workflow is HARD', ['.github/workflows/x.yml'], [], true],
    ['docs ok', ['docs/x.md'], [], false],
    ['label sticks', ['docs/x.md'], ['owner-reserved'], true],
  ];
  for (const [name, files, labels, want] of cases) {
    const v = await decide(mk(files, labels), 1, globs);
    if (v.reserved !== want) { console.error(`FAIL ${name}: got ${v.reserved}`); return 1; }
  }
  try { await decide(mk([]), 1, globs); console.error('FAIL: empty list must throw'); return 1; } catch { /* expected */ }
  if ((await main([], {}, {})) !== 2) { console.error('FAIL: missing env must be exit 2'); return 1; }
  console.log('queue-merge-decide self-test ok');
  return 0;
}

if (isEntryPoint(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
