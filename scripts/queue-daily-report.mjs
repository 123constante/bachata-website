#!/usr/bin/env node
/**
 * queue-daily-report.mjs -- no LLM. Posts a daily comment on the open issue titled
 * "Queue daily report" (created if absent; pin it by hand). Warn-only over budget: never exits
 * non-zero for cost and never stops the queue.
 *
 *   GH_TOKEN, GITHUB_REPOSITORY.  Exit 0 posted, 2 could not measure.
 *   node scripts/queue-daily-report.mjs [--self-test]
 */
import { readFileSync } from 'node:fs';
import { isEntryPoint } from './lib/entry-point.mjs';
import { makeApi, parseBudget, reportMarkdown, sumCosts } from './lib/queue.mjs';

const TITLE = 'Queue daily report';

export async function build(api, today, budgetMd) {
  const since = `${today}T00:00:00Z`;
  const closed = await api('GET', '/pulls?state=closed&sort=updated&direction=desc&per_page=100');
  const merged = closed.filter((p) => p.merged_at && p.merged_at >= since && p.head.ref.startsWith('claude/queue-')).map((p) => p.number);
  const queued = (await api('GET', '/issues?state=open&labels=queue&per_page=100')).filter((i) => !i.pull_request);
  const ownerTurn = (await api('GET', '/issues?state=open&labels=owner-turn&per_page=100')).filter((i) => !i.pull_request);
  const comments = await api('GET', `/issues/comments?since=${since}&per_page=100`);
  const totals = sumCosts(comments.map((c) => c.body));
  return reportMarkdown({ date: today, merged, queued, ownerTurn, totals, budget: parseBudget(budgetMd) });
}

export async function main(argv, env = process.env, deps = {}) {
  if (argv.includes('--self-test')) return selfTest();
  if (!env.GH_TOKEN || !env.GITHUB_REPOSITORY) { console.error('GH_TOKEN / GITHUB_REPOSITORY not set'); return 2; }
  const api = deps.api || makeApi(env.GH_TOKEN, env.GITHUB_REPOSITORY);
  try {
    const budgetMd = deps.budgetMd ?? readFileSync(new URL('../docs/queue.md', import.meta.url), 'utf8');
    const body = await build(api, new Date().toISOString().slice(0, 10), budgetMd);
    const open = await api('GET', '/issues?state=open&per_page=100');
    let issue = open.find((i) => !i.pull_request && i.title === TITLE);
    if (!issue) issue = await api('POST', '/issues', { title: TITLE, body: 'Daily queue report. Pin me.' });
    await api('POST', `/issues/${issue.number}/comments`, { body });
    if (body.includes('WARNING')) console.log('::warning::queue cost is over the daily budget (warn only)');
    console.log(body);
    return 0;
  } catch (e) { console.error(`INFRA: ${e.message}`); return 2; }
}

async function selfTest() {
  const posted = [];
  const api = async (m, p, b) => {
    if (m === 'POST') { posted.push(b); return { number: 9 }; }
    if (p.startsWith('/pulls')) return [{ number: 5, merged_at: '2099-01-01T01:00:00Z', head: { ref: 'claude/queue-3' } }, { number: 6, merged_at: '2099-01-01T01:00:00Z', head: { ref: 'other' } }];
    if (p.includes('labels=queue')) return [{ number: 1, labels: [{ name: 'p1' }] }, { number: 2, labels: [] }];
    if (p.includes('labels=owner-turn')) return [{ number: 3, labels: [] }];
    if (p.startsWith('/issues/comments')) return [{ body: '<!-- queue-run cost_usd=30.5 in=100 out=50 turns=9 -->' }, { body: 'hi' }];
    return [{ number: 9, title: TITLE }];
  };
  const body = await build(api, '2099-01-01', 'Daily budget (USD): 20');
  const need = ['Merged today: 1 (#5)', 'p1 1,', 'unprioritised 1', 'owner-turn): 1', 'runs today: 1', '$30.50', 'WARNING'];
  for (const n of need) if (!body.includes(n)) { console.error(`FAIL: report missing "${n}"\n${body}`); return 1; }
  if ((await main([], { GH_TOKEN: 'x', GITHUB_REPOSITORY: 'a/b' }, { api, budgetMd: 'Daily budget (USD): 20' })) !== 0 || posted.length !== 1) { console.error('FAIL: main must post once and exit 0 (warn only)'); return 1; }
  if ((await main([], {}, {})) !== 2) { console.error('FAIL: missing token must be exit 2'); return 1; }
  console.log('queue-daily-report self-test ok');
  return 0;
}

if (isEntryPoint(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
