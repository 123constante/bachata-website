#!/usr/bin/env node
/**
 * queue-claim.mjs -- pick the highest-priority open `queue` issue and claim it by swapping the
 * label queue -> in-progress (the label swap IS the lock). Writes issue=, related=, found= to
 * $GITHUB_OUTPUT. Exit 0 claimed or nothing to do (found=false), 2 could not measure.
 *
 *   GH_TOKEN, GITHUB_REPOSITORY, optional ISSUE_NUMBER (use that issue instead of picking one)
 *   node scripts/queue-claim.mjs [--self-test]
 */
import { appendFileSync } from 'node:fs';
import { isEntryPoint } from './lib/entry-point.mjs';
import { makeApi, pickIssue, relatedOf } from './lib/queue.mjs';

export async function claim(api, forced) {
  let issue;
  if (forced) issue = await api('GET', `/issues/${forced}`);
  else issue = pickIssue(await api('GET', '/issues?state=open&labels=queue&per_page=100'));
  if (!issue) return { found: false };
  try {
    await api('DELETE', `/issues/${issue.number}/labels/queue`);
  } catch (e) {
    if (e.status === 404) return { found: false, lost: true }; // another run took it
    throw e;
  }
  await api('POST', `/issues/${issue.number}/labels`, { labels: ['in-progress'] });
  return { found: true, issue: issue.number, related: relatedOf(issue.body, issue.number) };
}

export async function main(argv, env = process.env, deps = {}) {
  if (argv.includes('--self-test')) return selfTest();
  if (!env.GH_TOKEN || !env.GITHUB_REPOSITORY) { console.error('GH_TOKEN / GITHUB_REPOSITORY not set'); return 2; }
  const api = deps.api || makeApi(env.GH_TOKEN, env.GITHUB_REPOSITORY);
  let r;
  try { r = await claim(api, env.ISSUE_NUMBER ? Number(env.ISSUE_NUMBER) : null); } catch (e) { console.error(`INFRA: ${e.message}`); return 2; }
  const out = `found=${r.found}\nissue=${r.issue || ''}\nrelated=${(r.related || []).join(',')}\n`;
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, out); else process.stdout.write(out);
  return 0;
}

async function selfTest() {
  const calls = [];
  const mk = (issues, failDelete) => async (m, p) => {
    calls.push(`${m} ${p}`);
    if (m === 'GET') return issues;
    if (m === 'DELETE' && failDelete) { const e = new Error('gone'); e.status = 404; throw e; }
    return null;
  };
  const q = (n, labels) => ({ number: n, labels: labels.map((name) => ({ name })), created_at: `2026-01-0${n}`, body: '' });
  const r1 = await claim(mk([q(1, ['queue']), q(2, ['queue', 'p1'])]), null);
  if (r1.issue !== 2) { console.error('FAIL: p1 not picked first'); return 1; }
  if (!calls.includes('DELETE /issues/2/labels/queue') || !calls.includes('POST /issues/2/labels')) { console.error('FAIL: label swap missing'); return 1; }
  const r2 = await claim(mk([q(1, ['queue'])], true), null);
  if (r2.found || !r2.lost) { console.error('FAIL: lost race must exit found=false'); return 1; }
  if ((await claim(mk([]), null)).found) { console.error('FAIL: empty queue'); return 1; }
  if ((await main([], {}, {})) !== 2) { console.error('FAIL: missing token must be exit 2'); return 1; }
  if ((await main([], { GH_TOKEN: 'x', GITHUB_REPOSITORY: 'a/b' }, { api: async () => { throw new Error('boom'); } })) !== 2) { console.error('FAIL: api error must be exit 2'); return 1; }
  console.log('queue-claim self-test ok');
  return 0;
}

if (isEntryPoint(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
