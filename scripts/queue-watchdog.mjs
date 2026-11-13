#!/usr/bin/env node
/**
 * queue-watchdog.mjs -- no LLM. Finds in-progress queue issues with no live run for over an hour,
 * and open claude/queue-<n> PRs with red checks. First stall: relabel `queue` + comment. Second
 * stall (count of marker comments): `owner-turn` + comment. Never touches owner-reserved PRs.
 *
 *   GH_TOKEN, GITHUB_REPOSITORY.  Exit 0 done, 2 could not measure.
 *   node scripts/queue-watchdog.mjs [--self-test]
 */
import { isEntryPoint } from './lib/entry-point.mjs';
import { STALL_MARKER, decideStalls, makeApi } from './lib/queue.mjs';

export async function gather(api, now) {
  const issues = await api('GET', '/issues?state=open&labels=in-progress&per_page=100');
  const real = issues.filter((i) => !i.pull_request);
  for (const i of real) {
    const cs = await api('GET', `/issues/${i.number}/comments?per_page=100`);
    i.stalls = cs.filter((c) => String(c.body).includes(STALL_MARKER)).length;
  }
  const runs = await api('GET', '/actions/workflows/queue-worker.yml/runs?per_page=20');
  const activeRuns = (runs.workflow_runs || []).filter((r) => r.status === 'queued' || r.status === 'in_progress').length;
  const prs = await api('GET', '/pulls?state=open&per_page=100');
  const redPrs = [];
  for (const p of prs) {
    const m = /^claude\/queue-(\d+)$/.exec(p.head.ref);
    if (!m) continue;
    const checks = await api('GET', `/commits/${p.head.sha}/check-runs?per_page=100`);
    const red = (checks.check_runs || []).some((c) => ['failure', 'timed_out', 'cancelled'].includes(c.conclusion));
    if (red) redPrs.push({ issue: Number(m[1]), reserved: p.labels.some((l) => l.name === 'owner-reserved') });
  }
  return { issues: real, activeRuns, redPrs, now };
}

export async function apply(api, actions) {
  for (const a of actions) {
    const n = a.issue;
    if (a.kind === 'requeue') {
      await api('POST', `/issues/${n}/labels`, { labels: ['queue'] });
      await api('DELETE', `/issues/${n}/labels/in-progress`).catch(() => null);
      await api('POST', `/issues/${n}/comments`, { body: `${STALL_MARKER}\nQueue watchdog: ${a.reason}. Returned to the queue (first stall).` });
    } else {
      await api('POST', `/issues/${n}/labels`, { labels: ['owner-turn'] });
      await api('DELETE', `/issues/${n}/labels/in-progress`).catch(() => null);
      await api('POST', `/issues/${n}/comments`, { body: `${STALL_MARKER}\nQueue watchdog: ${a.reason}. Second stall: handed to the owner (owner-turn). Comment \`extend\` for one longer run.` });
    }
  }
}

export async function main(argv, env = process.env, deps = {}) {
  if (argv.includes('--self-test')) return selfTest();
  if (!env.GH_TOKEN || !env.GITHUB_REPOSITORY) { console.error('GH_TOKEN / GITHUB_REPOSITORY not set'); return 2; }
  const api = deps.api || makeApi(env.GH_TOKEN, env.GITHUB_REPOSITORY);
  try {
    const actions = decideStalls(await gather(api, Date.now()));
    await apply(api, actions);
    console.log(`queue-watchdog: ${actions.length} action(s)`);
    return 0;
  } catch (e) { console.error(`INFRA: ${e.message}`); return 2; }
}

function selfTest() {
  const now = Date.parse('2026-11-13T12:00:00Z');
  const old = '2026-11-13T10:00:00Z';
  const iss = (number, labels, stalls = 0, updated_at = old) => ({ number, labels: labels.map((name) => ({ name })), updated_at, stalls });
  const k = (o) => decideStalls({ now, activeRuns: 0, redPrs: [], ...o }).map((a) => `${a.issue}:${a.kind}`).join(',');
  const cases = [
    ['first stall requeues', k({ issues: [iss(1, ['in-progress'])] }), '1:requeue'],
    ['second stall goes to owner', k({ issues: [iss(1, ['in-progress'], 1)] }), '1:owner-turn'],
    ['live run protects', k({ issues: [iss(1, ['in-progress'])], activeRuns: 1 }), ''],
    ['fresh issue untouched', k({ issues: [iss(1, ['in-progress'], 0, '2026-11-13T11:30:00Z')] }), ''],
    ['red PR requeues', k({ issues: [iss(1, ['in-progress'], 0, '2026-11-13T11:59:00Z')], redPrs: [{ issue: 1, reserved: false }] }), '1:requeue'],
    ['reserved PR untouched', k({ issues: [iss(1, ['in-progress'], 0, '2026-11-13T11:59:00Z')], redPrs: [{ issue: 1, reserved: true }] }), ''],
    ['already queued untouched', k({ issues: [iss(1, ['queue', 'in-progress'])] }), ''],
    ['owner-turn untouched', k({ issues: [iss(1, ['owner-turn', 'in-progress'])] }), ''],
  ];
  for (const [name, got, want] of cases) if (got !== want) { console.error(`FAIL ${name}: got "${got}" want "${want}"`); return 1; }
  console.log('queue-watchdog self-test ok');
  return 0;
}

if (isEntryPoint(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
