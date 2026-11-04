// r2 of the hourly autopilot (review docs/review/1204-r1.md on branch claude/review-1204-r1):
// B1 worker-done gate, B2 caps + newest-first + stale-PR skips, B3 call budget, H1 author,
// H2 autopilot-hold, M1 stale ap:* labels, M2 human-cancelled runs, M3 24 h cap count, N2 author
// of the status comment. Pure helpers first, then a fake-GitHub simulation of run() that counts
// every request. Handover: docs/handover/autopilot-loop-r2.md.
import { describe, it, expect } from 'vitest';
import {
  labelPlan, listFacts, listGate, classifyHead, countCiProofs24h, ledgerCount, pruneLedger, newestFirst,
  findStatusComment, staleLabels, deriveFacts, decide, STATE_LABELS, BOT_LOGIN, RUN_CALL_BUDGET, HOUR_CALL_BUDGET,
} from '../scripts/lib/autopilot.mjs';
import { run } from '../scripts/autopilot-step.mjs';

const NOW = Date.parse('2026-11-03T12:00:00Z');
const MIN = 60000;
const iso = (ms: number) => new Date(ms).toISOString();
const listPr = (n: number, o: Record<string, unknown> = {}) => ({
  number: n, state: 'open', draft: false, user: { login: BOT_LOGIN }, created_at: iso(NOW - 2 * 86400000),
  labels: [] as { name: string }[], head: { sha: `h${n}`.padEnd(40, '0'), ref: `claude/feat-${n}`, repo: { full_name: 'o/r' } }, base: { repo: { full_name: 'o/r' } }, ...o,
});

describe('M1 stale ap:* labels', () => {
  it('want = null removes every ap:* label and nothing else', () => {
    expect(labelPlan(['ap:ready', 'run-ci', 'ap:stopped'], null)).toEqual({ add: [], remove: ['ap:ready', 'ap:stopped'] });
    expect(labelPlan(['run-ci'], null)).toEqual({ add: [], remove: [] });
  });
  it('the new worker-running label is one of ours', () => {
    expect(labelPlan(['ap:worker-running'], STATE_LABELS.ready)).toEqual({ add: ['ap:ready'], remove: ['ap:worker-running'] });
  });
  it('a head change since the label was set clears it; same head or unknown head keeps it', () => {
    expect(staleLabels(['ap:ready', 'run-ci'], 'a', 'b')).toEqual(['ap:ready']);
    expect(staleLabels(['ap:ready'], 'a', 'a')).toEqual([]);
    expect(staleLabels(['ap:ready'], undefined, 'a')).toEqual([]);
  });
});

describe('list gate: decided from the PR list alone (no per-PR call)', () => {
  const g = (o: Record<string, unknown>) => listGate(listFacts(listPr(9, o), NOW));
  it('passes a fresh bot PR on a feature branch', () => expect(g({})).toBeNull());
  it.each([
    ['draft', { draft: true }, 'none'],
    ['owner-authored', { user: { login: '123constante' } }, 'none'],
    ['review branch', { head: { sha: 'x', ref: 'claude/review-1', repo: { full_name: 'o/r' } } }, 'none'],
    ['done branch', { head: { sha: 'x', ref: 'claude/done-dt_ab', repo: { full_name: 'o/r' } } }, 'none'],
    ['walk branch', { head: { sha: 'x', ref: 'claude/walk-12', repo: { full_name: 'o/r' } } }, 'none'],
    ['20 days old', { created_at: iso(NOW - 20 * 86400000) }, 'none'],
    ['hold', { labels: [{ name: 'autopilot-hold' }] }, 'none'],
    ['queue-stopped', { labels: [{ name: 'queue-stopped' }] }, 'skip'],
    ['migration-queued', { labels: [{ name: 'migration-queued' }] }, 'skip'],
  ])('%s -> %s, no ap:* label', (_n, o, action) => {
    const d = g(o as Record<string, unknown>);
    expect(d?.action).toBe(action);
    expect(d?.label).toBeNull();
  });
});

describe('B1 worker-done marker', () => {
  it('classifies the head commit subject', () => {
    expect(classifyHead('feat(x): y [worker-done dt_c42a0f5337b1]\n\nbody')).toBe('done');
    expect(classifyHead('wip: handover PARTIAL [worker-done dt_c42a0f5337b1]')).toBe('done');
    expect(classifyHead("Merge branch 'main' into claude/x")).toBe('merge-main');
    expect(classifyHead("Merge remote-tracking branch 'origin/main' into claude/x")).toBe('merge-main');
    expect(classifyHead('feat(x): first coherent push')).toBe('running');
    expect(classifyHead('feat: x\n\nthe marker only in the body [worker-done dt_ab]')).toBe('running');
    expect(classifyHead('fake [worker-done dt_XYZ]')).toBe('running');
  });
});

describe('M3 the daily CI cap: rolling 24 h, paged, fail closed', () => {
  const add = (ms: number) => ({ event: 'labeled', label: { name: 'run-ci' }, actor: { login: BOT_LOGIN }, created_at: iso(ms) });
  const noise = (ms: number) => ({ event: 'labeled', label: { name: 'ap:ready' }, created_at: iso(ms) });
  it('counts 9 adds sitting at positions 300+ (the r1 300-event window read 0)', () => {
    const ev = [...Array.from({ length: 300 }, (_, i) => noise(NOW - i * 1000)), ...Array.from({ length: 9 }, (_, i) => add(NOW - 3600000 - i * MIN)), noise(NOW - 25 * 3600000)];
    expect(countCiProofs24h(ev, false, [], NOW)).toEqual({ count: 9, complete: true, foreign: 0 });
  });
  it('a window whose oldest event is still inside 24 h and more pages exist is incomplete (caller fails closed)', () => {
    expect(countCiProofs24h([add(NOW - MIN)], false, [], NOW).complete).toBe(false);
    expect(countCiProofs24h([add(NOW - MIN)], true, [], NOW).complete).toBe(true);
  });
  it('re-runs from the ledger spend the same daily cap; adds older than 24 h do not count', () => {
    const ledger = [{ t: NOW - 2 * 3600000, a: 'rerun', n: 2 }, { t: NOW - 30 * 3600000, a: 'rerun', n: 5 }];
    expect(countCiProofs24h([add(NOW - 25 * 3600000)], true, ledger, NOW).count).toBe(2);
  });
  it('ledger counts per window and prunes past 24 h; garbage entries drop', () => {
    const l = [{ t: NOW - 10 * MIN, a: 'update-branch', n: 3 }, { t: NOW - 70 * MIN, a: 'update-branch', n: 4 }, { t: NOW - 25 * 3600000, a: 'rerun', n: 1 }, { nope: 1 }];
    expect(ledgerCount(l, 'update-branch', NOW, 60)).toBe(3);
    expect(pruneLedger(l, NOW)).toEqual(l.slice(0, 2));
  });
  it('newest PR first', () => {
    expect(newestFirst([listPr(908), listPr(1204), listPr(1015)]).map((p) => p.number)).toEqual([1204, 1015, 908]);
  });
});

describe('M2 a cancelled run is re-run only as a duplicate (a newer run of the same workflow at head)', () => {
  const H = 'b'.repeat(40);
  const raw = (runs: object[]) => ({
    pr: { ...listPr(5), head: { sha: H, ref: 'claude/x', repo: { full_name: 'o/r' } }, mergeable_state: 'clean', labels: [] },
    reviews: [], files: [], statuses: [], mainCheckRuns: [], mainStatuses: [], labelEvents: [], jobLogs: {}, runAttempts: { 11: 1 },
    checkRuns: [{ name: 'unit', status: 'completed', conclusion: 'cancelled', details_url: 'https://github.com/o/r/actions/runs/11/job/21', completed_at: iso(NOW - MIN) }],
    runsAtHead: runs, workerDone: true,
  });
  it('cancelled with no newer run of that workflow: a human cancelled it -> red, never re-run', () => {
    const f = deriveFacts(raw([{ id: 11, workflow_id: 1, head_sha: H, event: 'pull_request', created_at: iso(NOW - 9 * MIN) }]), NOW);
    expect(f.rerunnable).toEqual([]);
    expect(f.redNew).toEqual(['unit']);
    expect(decide({ ...f, ranCi: true }).action).toBe('stop');
  });
  it('cancelled with a newer run of the same workflow at head: a duplicate -> rerun once', () => {
    const f = deriveFacts(raw([
      { id: 11, workflow_id: 1, head_sha: H, event: 'pull_request', created_at: iso(NOW - 9 * MIN) },
      { id: 12, workflow_id: 1, head_sha: H, event: 'pull_request', created_at: iso(NOW - 8 * MIN) },
    ]), NOW);
    expect(f.rerunnable.map((x: { reason: string }) => x.reason)).toEqual(['cancelled duplicate']);
  });
});

describe('N2 the status comment must be ours', () => {
  it('a planted marker from anyone else is ignored', () => {
    const planted = { id: 1, user: { login: 'someone' }, body: '<!-- autopilot-state {"x":1} -->' };
    const ours = { id: 2, user: { login: 'github-actions[bot]' }, body: '<!-- autopilot-state {} -->' };
    expect(findStatusComment([planted])).toBeNull();
    expect(findStatusComment([planted, ours])?.id).toBe(2);
  });
});

// ---- fake GitHub: every request is counted; the simulation drives run() end to end ----
type Pr = ReturnType<typeof listPr> & { mergeable_state?: string; subject?: string };
function fakeGitHub(prs: Pr[], { events = [] as object[], statusComments = [] as object[] } = {}) {
  const log: string[] = [];
  const json = (b: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(b), { status, headers: { 'x-ratelimit-remaining': '4000' } });
  const fetchImpl = async (url: string, init: { method?: string } = {}) => {
    const m = init.method || 'GET';
    const u = new URL(url);
    const p = u.pathname.replace(/^\/repos\/o\/r/, '');
    const page = Number(u.searchParams.get('page') || 1);
    log.push(`${m} ${p}`);
    const byNum = (n: string) => prs.find((x) => x.number === Number(n))!;
    let mm: RegExpExecArray | null;
    if (m === 'GET' && p === '') return json({ default_branch: 'main' });
    if (m === 'GET' && p === '/commits/main') return json({ sha: 'm'.repeat(40) });
    if (m === 'GET' && /^\/commits\/m+\/check-runs$/.test(p)) return json({ check_runs: [] });
    if (m === 'GET' && /^\/commits\/m+\/status$/.test(p)) return json({ statuses: [] });
    if (m === 'GET' && p === '/issues/events') return json(events.slice((page - 1) * 100, page * 100));
    if (m === 'GET' && p === '/issues') return json(statusComments.length ? [{ number: 77, title: 'autopilot status', user: { login: 'github-actions[bot]' } }] : []);
    if (m === 'GET' && p === '/issues/77/comments') return json(statusComments);
    if (m === 'GET' && p === '/labels') return json(Object.values(STATE_LABELS).map((name) => ({ name })));
    if (m === 'GET' && p === '/pulls') return json(page === 1 ? prs : []);
    if (m === 'GET' && (mm = /^\/commits\/([^/]+)$/.exec(p))) {
      const pr = prs.find((x) => x.head.sha === mm![1]);
      return json({ sha: mm[1], commit: { message: pr?.subject ?? 'feat: x [worker-done dt_ab12]' }, parents: [{ sha: 'p'.repeat(40) }] });
    }
    if (m === 'GET' && (mm = /^\/pulls\/(\d+)$/.exec(p))) { const pr = byNum(mm[1]); return json({ ...pr, mergeable_state: pr.mergeable_state ?? 'clean' }); }
    if (m === 'GET' && /^\/pulls\/\d+\/reviews$/.test(p)) return json([]);
    // Website r5: a non-docs file list (run-ci is refused on docs-only PRs).
    if (m === 'GET' && /^\/pulls\/\d+\/files$/.test(p)) return json([{ filename: 'src/lib/x.ts' }]);
    if (m === 'GET' && /^\/commits\/[^/]+\/check-runs$/.test(p)) return json({ check_runs: [] });
    if (m === 'GET' && /^\/commits\/[^/]+\/status$/.test(p)) return json({ statuses: [] });
    // Website r5: a push run only (no pull_request proof), carrying the head subject.
    if (m === 'GET' && p === '/actions/runs') { const s = u.searchParams.get('head_sha'); return json({ workflow_runs: [{ id: 1, workflow_id: 1, head_sha: s, event: 'push', created_at: '2026-11-01T00:00:00Z', head_commit: { message: 'feat: x [worker-done dt_ab12]' } }] }); }
    if (m === 'GET' && /^\/issues\/\d+\/events$/.test(p)) return json([]);
    if (m === 'PUT' && /\/update-branch$/.test(p)) return json({});
    if (m === 'POST' && /^\/issues\/\d+\/labels$/.test(p)) return json([]);
    if (m === 'DELETE' && /^\/issues\/\d+\/labels\//.test(p)) return json(null, 204);
    if (m === 'POST' && p === '/issues') return json({ number: 77, node_id: 'n' });
    if (m === 'POST' && p === '/issues/77/comments') return json({});
    if (m === 'PATCH' && /^\/issues\/comments\/\d+$/.test(p)) return json({});
    if (m === 'POST' && u.pathname === '/graphql') return json({});
    // Website r5: the repo's vercel.json (claude/* never deploys), read GET-only by readVercelConfig().
    if (m === 'GET' && p === '/contents/vercel.json') return json({ content: 'eyJnaXQiOiB7ImRlcGxveW1lbnRFbmFibGVkIjogeyJjbGF1ZGUvKiI6IGZhbHNlLCAibWFpbiI6IHRydWV9fX0=', encoding: 'base64' });
    return json({ message: `fake: unhandled ${m} ${p}` }, 500);
  };
  return { log, fetchImpl };
}
const ENV = { REPOS: 'o/r', GH_TOKEN: 't', BOT_TOKEN: 'b', DRY_RUN: 'false' };
const perPr = (log: string[], n: number) => log.filter((l) => new RegExp(`^(GET|PUT|POST|DELETE) /(pulls|issues)/${n}(/|$)`).test(l));

describe('run() against a fake GitHub (B1, B2, B3, H1, H2)', () => {
  it('20 behind bot PRs: at most 5 update-branch writes, newest first', async () => {
    const prs = Array.from({ length: 20 }, (_, i) => ({ ...listPr(1000 + i), mergeable_state: 'behind' }));
    const gh = fakeGitHub(prs);
    expect(await run(ENV, { now: NOW, fetch: gh.fetchImpl, quiet: true })).toBe(0);
    const updated = gh.log.filter((l) => l.startsWith('PUT')).map((l) => Number(/pulls\/(\d+)/.exec(l)![1]));
    expect(updated).toEqual([1019, 1018, 1017, 1016, 1015]);
  });
  it('20 bot run-ci adds already today + 10 unproven bot PRs: run-ci on the 5 newest only (r3: CI_CAP 25; foreign adds not counted)', async () => {
    const prs = Array.from({ length: 10 }, (_, i) => listPr(1000 + i));
    const add = (login: string, i: number) => ({ event: 'labeled', label: { name: 'run-ci' }, actor: { login }, created_at: iso(NOW - 3600000 - i * MIN) });
    const events = [...Array.from({ length: 20 }, (_, i) => add(BOT_LOGIN, i)), ...Array.from({ length: 6 }, (_, i) => add('123constante', 30 + i))];
    const gh = fakeGitHub(prs, { events });
    await run(ENV, { now: NOW, fetch: gh.fetchImpl, quiet: true });
    const ci = gh.log.filter((l) => /^POST \/issues\/\d+\/labels$/.test(l)).map((l) => Number(/issues\/(\d+)/.exec(l)![1]));
    // each gets run-ci (bot) then ap:waiting-ci (gh): two label POSTs on the 5 newest
    expect(ci.filter((n) => n >= 1005)).toHaveLength(10);
    expect(gh.log.filter((l) => /^POST \/issues\/(100[0-4])\/labels$/.test(l))).toHaveLength(5); // 5 older: only the ap:stopped label
  });
  it('26 bot run-ci adds in the last 24 h beyond event 300: no run-ci at all (cap counted by paging)', async () => {
    const noise = Array.from({ length: 300 }, (_, i) => ({ event: 'labeled', label: { name: 'ap:ready' }, created_at: iso(NOW - i * 1000) }));
    const adds = Array.from({ length: 26 }, (_, i) => ({ event: 'labeled', label: { name: 'run-ci' }, actor: { login: BOT_LOGIN }, created_at: iso(NOW - 3600000 - i * MIN) }));
    const gh = fakeGitHub([listPr(1204)], { events: [...noise, ...adds, { event: 'closed', created_at: iso(NOW - 30 * 3600000) }] });
    await run(ENV, { now: NOW, fetch: gh.fetchImpl, quiet: true });
    expect(gh.log.filter((l) => /^GET \/issues\/events/.test(l)).length).toBe(4);
    expect(gh.log.some((l) => l === 'POST /issues/1204/labels')).toBe(true); // ap:stopped only
    expect(gh.log.filter((l) => l === 'POST /issues/1204/labels')).toHaveLength(1);
  });
  it('no marker: one commit read, one label, nothing else on that PR (B1)', async () => {
    const gh = fakeGitHub([{ ...listPr(1300, { mergeable_state: 'behind' }), subject: 'feat: early push' }]);
    await run(ENV, { now: NOW, fetch: gh.fetchImpl, quiet: true });
    expect(gh.log.filter((l) => /^GET \/commits\/h1300/.test(l))).toHaveLength(1);
    expect(perPr(gh.log, 1300)).toEqual(['POST /issues/1300/labels']);
    expect(gh.log.some((l) => l.startsWith('PUT'))).toBe(false);
  });
  it('a merge of main on top of a marker commit still counts as done (update-branch does not reset it)', async () => {
    const gh = fakeGitHub([{ ...listPr(1301), subject: "Merge branch 'main' into claude/feat-1301" }]);
    await run(ENV, { now: NOW, fetch: gh.fetchImpl, quiet: true });
    expect(gh.log.filter((l) => /^GET \/commits\/(h1301\w*|p{40})$/.test(l))).toHaveLength(2);
    expect(gh.log).toContain('GET /pulls/1301');
  });
  it('owner / review / done / walk / old / hold / draft PRs: zero per-PR reads (H1, B2, H2, B3)', async () => {
    const skip = [
      listPr(2001, { user: { login: '123constante' } }),
      listPr(2002, { head: { sha: 'x', ref: 'claude/review-1', repo: { full_name: 'o/r' } } }),
      listPr(2003, { head: { sha: 'x', ref: 'claude/done-dt_ab', repo: { full_name: 'o/r' } } }),
      listPr(2004, { head: { sha: 'x', ref: 'claude/walk-1', repo: { full_name: 'o/r' } } }),
      listPr(2005, { created_at: iso(NOW - 40 * 86400000) }),
      listPr(2006, { labels: [{ name: 'autopilot-hold' }] }),
      listPr(2007, { draft: true }),
    ];
    const gh = fakeGitHub(skip as Pr[]);
    await run(ENV, { now: NOW, fetch: gh.fetchImpl, quiet: true });
    for (const p of skip) expect(perPr(gh.log, p.number)).toEqual([]);
    expect(gh.log.some((l) => /^GET \/commits\/(h20|x)/.test(l))).toBe(false);
  });
  it('a skipped PR still carrying an ap:* label loses it (M1)', async () => {
    const gh = fakeGitHub([listPr(2010, { draft: true, labels: [{ name: 'ap:ready' }] }), listPr(2011, { labels: [{ name: 'queue-stopped' }, { name: 'ap:waiting-ci' }] })]);
    await run(ENV, { now: NOW, fetch: gh.fetchImpl, quiet: true });
    expect(gh.log).toContain('DELETE /issues/2010/labels/ap%3Aready');
    expect(gh.log).toContain('DELETE /issues/2011/labels/ap%3Awaiting-ci');
  });
  it('95 open PRs: total requests stay inside the per-run budget, and the hourly ledger caps the next run (B3)', async () => {
    const prs = Array.from({ length: 95 }, (_, i) => ({ ...listPr(1100 + i), mergeable_state: 'clean' }));
    const gh = fakeGitHub(prs);
    await run(ENV, { now: NOW, fetch: gh.fetchImpl, quiet: true });
    expect(gh.log.length).toBeLessThanOrEqual(RUN_CALL_BUDGET);
    // a previous run this hour already spent nearly the whole hour: this run reads almost nothing per PR
    const spent = `<!-- autopilot-state ${JSON.stringify({ _ledger: [{ t: NOW - 20 * MIN, a: 'calls', n: HOUR_CALL_BUDGET - 20 }] })} -->`;
    const gh2 = fakeGitHub(prs, { statusComments: [{ id: 5, user: { login: 'github-actions[bot]' }, body: spent }] });
    await run(ENV, { now: NOW, fetch: gh2.fetchImpl, quiet: true });
    expect(gh2.log.length).toBeLessThanOrEqual(20 + 15);
    expect(gh2.log.some((l) => /^GET \/pulls\/\d+$/.test(l))).toBe(false);
  });
});
