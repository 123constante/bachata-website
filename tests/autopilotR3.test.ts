// r3 of the hourly autopilot (brief docs/briefs/autopilot-loop-r3.md on brief/autopilot-loop-r3):
// the pack comment for a `ready` PR (scripts/lib/autopilot-pack.mjs), ONE owner ping per head on a
// hard-tier ready PR, the main...head behind check for ready PRs only, and CI_CAP 25 counting only
// the bot's run-ci adds. Pure tables first, then a fake-GitHub simulation of run(), then mutants
// (each applied to a temp copy beside the real file; some scenario or check must turn red).
// Handover: docs/handover/autopilot-loop-r3.md.
import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { decide, countCiProofs24h, CI_CAP, BOT_LOGIN, STATE_LABELS, WRITE_ACTIONS } from '../scripts/lib/autopilot.mjs';
import { buildPack, classifyFile, hardTier, needsOwnerApprove, quoteBody, findPackComment, packHead, pingedAtHead, renderOwnerPing } from '../scripts/lib/autopilot-pack.mjs';
import { run } from '../scripts/autopilot-step.mjs';
import { BASE, MERGE_SITE } from './autopilotTable';

const NOW = Date.parse('2026-11-04T12:00:00Z');
const MIN = 60000;
const iso = (ms: number) => new Date(ms).toISOString();
const H = 'c'.repeat(40);
const GH_BOT = 'github-actions[bot]';
const PACK_FACTS = { number: 9, head: H, why: 'all checks green', approvedAtHead: false, jobs: [{ name: 'unit-build', status: 'completed', conclusion: 'success' }], mainRed: [], files: ['docs/x.md'], body: '## Verified\n- unit suite passed\n\nNot verified: phone walk' };

describe('decide() + pack table (r3)', () => {
  it.each([
    ['ready + hard-tier', { files: ['scripts/autopilot-step.mjs', 'docs/a.md'] }, true],
    ['ready + docs only', { files: ['docs/a.md', 'README.md'] }, false],
    ['ready + tests and app only', { files: ['tests/a.test.ts', 'components/x.tsx'] }, false],
    ['ready + migration', { files: ['supabase/migrations/99990101000000_x.sql'] }, true],
    ['ready + workflow', { files: ['.github/workflows/x.yml'] }, true],
    ['ready + hard-tier, approved at head', { files: ['scripts/x.mjs'], approvedAtHead: true }, false],
    ['ready + files not read', { files: null }, true],
  ])('%s -> owner Approve needed: %s', (_n, o, needs) => {
    const facts = { ...PACK_FACTS, ...o };
    expect(decide({ ...BASE }).action).toBe('ready');
    expect(needsOwnerApprove(facts)).toBe(needs);
    const pack = buildPack(facts);
    expect(pack.includes(`Needs: owner Approve at head \`${H}\``)).toBe(needs);
    expect(pack).toContain(`<!-- autopilot-pack head=${H} -->`);
  });
  it('ready migration PR not approved stays ready (owner wait) and its pack asks for Approve', () => {
    const d = decide({ ...BASE, isMigration: true });
    expect([d.action, d.label, d.stop]).toEqual(['ready', STATE_LABELS.ready, true]);
    expect(buildPack({ ...PACK_FACTS, files: ['supabase/migrations/9999_x.sql'] })).toMatch(/hard-tier: migration/);
  });
  it('ready + behind (behindBy > 0), not approved -> update-branch; approved at head -> stop', () => {
    expect(decide({ ...BASE, behindBy: 3 }).action).toBe('update-branch');
    expect(decide({ ...BASE, behindBy: 3, updatesThisHour: 5 }).action).toBe('wait');
    const a = decide({ ...BASE, behindBy: 3, approvedAtHead: true });
    expect([a.action, a.label]).toEqual(['stop', STATE_LABELS.stopped]);
    expect(decide({ ...BASE, behindBy: 0 }).action).toBe('ready');
  });
  it('CI_CAP is 25 and only the bot\'s run-ci adds count; foreign adds are reported', () => {
    expect(CI_CAP).toBe(25);
    const add = (login: string | null, ago: number) => ({ event: 'labeled', label: { name: 'run-ci' }, actor: login ? { login } : undefined, created_at: iso(NOW - ago) });
    const r = countCiProofs24h([add(BOT_LOGIN, MIN), add('123constante', 2 * MIN), add(null, 3 * MIN), add(BOT_LOGIN, 25 * 3600000)], true, [], NOW);
    expect(r).toEqual({ count: 1, complete: true, foreign: 2 });
    expect(decide({ ...BASE, ranCi: false, ciRunsToday: 20 }).action).toBe('run-ci');
    expect(decide({ ...BASE, ranCi: false, ciRunsToday: 25 }).action).toBe('wait-cap');
  });
  it('pack and owner-ping are listed write actions', () => {
    expect(WRITE_ACTIONS).toEqual(expect.arrayContaining(['pack', 'owner-ping']));
  });
});

describe('buildPack never states a check it did not read', () => {
  it('missing job list: "not read", never green', () => {
    const p = buildPack({ ...PACK_FACTS, why: 'decided ready', jobs: undefined });
    expect(p).toMatch(/Job list not read/);
    expect(p).not.toMatch(/green/i);
  });
  it('a job with no conclusion, or main not read, prints "not read"', () => {
    const p = buildPack({ ...PACK_FACTS, jobs: [{ name: 'unit-build' }], mainRed: null });
    expect(p).toContain('| unit-build | not read | not read |');
    expect(p).not.toContain('| green');
  });
  it('prints conclusions per job and whether the red is also on main', () => {
    const p = buildPack({ ...PACK_FACTS, jobs: [{ name: 'a', status: 'completed', conclusion: 'success' }, { name: 'b', status: 'completed', conclusion: 'failure' }], mainRed: ['b'] });
    expect(p).toContain('| a | green | no |');
    expect(p).toContain('| b | red (failure) | yes |');
  });
  it('files grouped with the rule for each hard-tier file; body lines quoted verbatim', () => {
    const p = buildPack({ ...PACK_FACTS, files: ['docs/a.md', 'tests/x.test.ts', 'lib/y.ts', 'scripts/z.mjs'], body: 'intro\nVerified: 12 mutants killed\n**Not verified**: the phone walk\nother' });
    expect(p).toMatch(/\*\*docs\*\* \(1\): `docs\/a\.md`/);
    expect(p).toMatch(/\*\*tests\*\* \(1\)/);
    expect(p).toMatch(/\*\*soft-app \(allowlist\)\*\* \(0\)/); // Website r5: SOFT_APP_ALLOW is empty
    expect(p).toContain('  - `scripts/z.mjs`: scripts/: gate and automation code');
    expect(p).toContain('> Verified: 12 mutants killed');
    expect(p).toContain('> **Not verified**: the phone walk');
    expect(p).not.toContain('> intro');
  });
  it('a heading-only Verified section quotes its lines; no body says so', () => {
    expect(quoteBody('## Verified\n- a\n- b\n\n## Next\n- c')).toEqual(['## Verified', '- a', '- b']);
    expect(buildPack({ ...PACK_FACTS, body: null })).toContain('PR body not read.');
    expect(classifyFile('README.md').group).toBe('docs');
    expect(hardTier(['guards.json'])[0].rule).toMatch(/guard/);
  });
  it('only our own pack / ping markers count', () => {
    const ours = { id: 1, user: { login: GH_BOT }, body: buildPack(PACK_FACTS) };
    const planted = { id: 2, user: { login: 'someone' }, body: `<!-- autopilot-pack head=${H} --> <!-- autopilot-owner-ping head=${H} -->` };
    expect(findPackComment([planted, ours])?.id).toBe(1);
    expect(packHead(ours.body)).toBe(H);
    expect(pingedAtHead([planted], H)).toBe(false);
    expect(pingedAtHead([{ user: { login: GH_BOT }, body: renderOwnerPing(9, H, 'u') }], H)).toBe(true);
    expect(pingedAtHead([{ user: { login: GH_BOT }, body: renderOwnerPing(9, 'd'.repeat(40), 'u') }], H)).toBe(false);
    expect(renderOwnerPing(9, H, 'https://x/c1')).toMatch(new RegExp(`^@123constante #9 is ready for Approve at head \`${H}\`\\. Pack: https://x/c1`));
  });
});

describe('makeApi rate-limit header (r3, found by the live dry run)', () => {
  it('a response without x-ratelimit-remaining leaves the counter unknown; a real header lowers it', async () => {
    const { makeApi } = await import('../scripts/autopilot-step.mjs');
    const counter = { calls: 0, remaining: Infinity };
    const api = makeApi('t', counter, async () => new Response('log text', { status: 200 }));
    await api.call('GET', '/x', null, { raw: true });
    expect(counter.remaining).toBe(Infinity);
    const api2 = makeApi('t', counter, async () => new Response('{}', { status: 200, headers: { 'x-ratelimit-remaining': '4000' } }));
    await api2.call('GET', '/y');
    expect(counter.remaining).toBe(4000);
  });
});

// ---- fake GitHub for run(): every request logged with its body ----
type PrCfg = { n: number; ready?: boolean; files?: string[]; body?: string; approved?: boolean; behind?: number; comments?: object[] };
function fakeGitHub(cfgs: PrCfg[], { statusState = null as object | null, pingFails = false } = {}) {
  const log: { m: string; p: string; auth?: string; body?: Record<string, unknown> }[] = [];
  const json = (b: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(b), { status, headers: { 'x-ratelimit-remaining': '4000' } });
  const sha = (n: number) => `${n}`.padEnd(40, 'a').replace(/[^0-9a]/g, 'a');
  const pr = (c: PrCfg) => ({
    number: c.n, state: 'open', draft: false, user: { login: BOT_LOGIN }, created_at: iso(NOW - 86400000), body: c.body ?? 'Verified: unit green',
    labels: [{ name: 'run-ci' }], mergeable_state: 'clean', head: { sha: sha(c.n), ref: `claude/f-${c.n}`, repo: { full_name: 'o/r' } }, base: { repo: { full_name: 'o/r' } },
  });
  const byNum = (n: string) => cfgs.find((c) => c.n === Number(n))!;
  const bySha = (s: string) => cfgs.find((c) => sha(c.n) === s);
  const statusComments = statusState ? [{ id: 5, user: { login: GH_BOT }, body: `<!-- autopilot-state ${JSON.stringify(statusState)} -->` }] : [];
  const fetchImpl = async (url: string, init: { method?: string; body?: string; headers?: Record<string, string> } = {}) => {
    const m = init.method || 'GET';
    const u = new URL(url);
    const p = u.pathname.replace(/^\/repos\/o\/r/, '');
    const page = Number(u.searchParams.get('page') || 1);
    log.push({ m, p, auth: init.headers?.authorization, body: init.body ? JSON.parse(init.body) : undefined });
    let mm: RegExpExecArray | null;
    if (m === 'GET' && p === '') return json({ default_branch: 'main' });
    if (m === 'GET' && p === '/commits/main') return json({ sha: 'm'.repeat(40) });
    if (m === 'GET' && /^\/commits\/m+\/check-runs$/.test(p)) return json({ check_runs: [] });
    if (m === 'GET' && /^\/commits\/m+\/status$/.test(p)) return json({ statuses: [] });
    if (m === 'GET' && p === '/issues/events') return json([]);
    if (m === 'GET' && p === '/issues') return json(statusComments.length ? [{ number: 77, title: 'autopilot status', user: { login: GH_BOT } }] : []);
    if (m === 'GET' && p === '/issues/77/comments') return json(statusComments);
    if (m === 'GET' && p === '/labels') return json(Object.values(STATE_LABELS).map((name) => ({ name })));
    if (m === 'GET' && p === '/pulls') return json(page === 1 ? cfgs.map(pr) : []);
    if (m === 'GET' && (mm = /^\/compare\/m{40}\.\.\.([0-9a-f]{40})$/.exec(p))) return json({ behind_by: bySha(mm[1])?.behind ?? 0, ahead_by: 1 });
    if (m === 'GET' && (mm = /^\/commits\/([0-9a-f]{40})$/.exec(p))) return json({ sha: mm[1], commit: { message: 'feat: x [worker-done dt_ab12]' }, parents: [] });
    if (m === 'GET' && (mm = /^\/pulls\/(\d+)$/.exec(p))) return json(pr(byNum(mm[1])));
    if (m === 'GET' && (mm = /^\/pulls\/(\d+)\/reviews$/.exec(p))) { const c = byNum(mm[1]); return json(c.approved ? [{ state: 'APPROVED', commit_id: sha(c.n), user: { login: '123constante' } }] : []); }
    if (m === 'GET' && (mm = /^\/pulls\/(\d+)\/files$/.exec(p))) return json((byNum(mm[1]).files ?? ['docs/a.md']).map((filename) => ({ filename })));
    if (m === 'GET' && (mm = /^\/commits\/([0-9a-f]{40})\/check-runs$/.test(p) ? /^\/commits\/([0-9a-f]{40})/.exec(p) : null)) {
      const c = bySha(mm[1])!;
      return json({ check_runs: [{ name: 'unit-build', status: c.ready === false ? 'in_progress' : 'completed', conclusion: c.ready === false ? null : 'success', details_url: 'https://github.com/o/r/actions/runs/1/job/2', completed_at: iso(NOW - 10 * MIN) }] });
    }
    if (m === 'GET' && /^\/commits\/[0-9a-f]{40}\/status$/.test(p)) return json({ statuses: [] });
    if (m === 'GET' && p === '/actions/runs') { const s = u.searchParams.get('head_sha'); return json({ workflow_runs: [{ id: 1, workflow_id: 1, head_sha: s, event: 'pull_request', created_at: iso(NOW - 30 * MIN) }] }); }
    if (m === 'GET' && /^\/issues\/\d+\/events$/.test(p)) return json([{ event: 'labeled', label: { name: 'run-ci' }, actor: { login: BOT_LOGIN }, created_at: iso(NOW - 31 * MIN) }]);
    if (m === 'GET' && (mm = /^\/issues\/(\d+)\/comments$/.exec(p))) return json(byNum(mm[1]).comments ?? []);
    if (m === 'POST' && (mm = /^\/issues\/(\d+)\/comments$/.exec(p))) {
      if (pingFails && String((JSON.parse(init.body!) as { body: string }).body).startsWith('@')) return json({ message: 'boom' }, 500);
      return json({ id: 900, html_url: `https://github.com/o/r/pull/${mm[1]}#issuecomment-900` });
    }
    if (m === 'PATCH' && /^\/issues\/comments\/\d+$/.test(p)) return json({ id: 1, html_url: 'https://github.com/o/r/pull/1#issuecomment-1' });
    if (m === 'PUT' && /\/update-branch$/.test(p)) return json({});
    if (m === 'POST' && /^\/issues\/\d+\/labels$/.test(p)) return json([]);
    if (m === 'DELETE' && /^\/issues\/\d+\/labels\//.test(p)) return json(null, 204);
    if (m === 'POST' && p === '/issues') return json({ number: 77, node_id: 'n' });
    if (m === 'POST' && u.pathname === '/graphql') return json({});
    // Website r5: the repo's vercel.json (claude/* never deploys), read GET-only by readVercelConfig().
    if (m === 'GET' && p === '/contents/vercel.json') return json({ content: 'eyJnaXQiOiB7ImRlcGxveW1lbnRFbmFibGVkIjogeyJjbGF1ZGUvKiI6IGZhbHNlLCAibWFpbiI6IHRydWV9fX0=', encoding: 'base64' });
    return json({ message: `fake: unhandled ${m} ${p}` }, 500);
  };
  const prComments = (n: number) => log.filter((l) => l.m === 'POST' && l.p === `/issues/${n}/comments`).map((l) => String(l.body!.body));
  return { log, fetchImpl, sha, prComments, compares: () => log.filter((l) => l.p.startsWith('/compare/')).length };
}
const ENV = { REPOS: 'o/r', GH_TOKEN: 't', BOT_TOKEN: 'b', DRY_RUN: 'false' };
const stateOf = (log: { m: string; p: string; body?: Record<string, unknown> }[]) => {
  const w = log.filter((l) => (l.m === 'POST' && l.p === '/issues/77/comments') || l.m === 'PATCH').map((l) => String(l.body!.body)).find((b) => b.includes('autopilot-state'))!;
  return JSON.parse(/<!-- autopilot-state (\{[\s\S]*?\}) -->/.exec(w)![1]);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RunFn = (env: any, opts: any) => Promise<number>;
const SCENARIOS: [string, (run: RunFn) => Promise<boolean>][] = [
  ['hard-tier ready PR: one pack + one owner ping, one compare', async (run) => {
    const gh = fakeGitHub([{ n: 41, files: ['scripts/a.mjs'] }]);
    const code = await run(ENV, { now: NOW, fetch: gh.fetchImpl, quiet: true });
    const c = gh.prComments(41);
    const asGhActions = gh.log.filter((l) => l.p === '/issues/41/comments' && l.m === 'POST').every((l) => l.auth === 'Bearer t');
    return code === 0 && asGhActions && c.length === 2 && c[0].includes('autopilot-pack head=') && c[1].startsWith('@123constante #41 is ready for Approve at head') && c[1].includes(gh.sha(41)) && c[1].includes('issuecomment-900') && gh.compares() === 1 && stateOf(gh.log)._pings['41'] === gh.sha(41);
  }],
  ['non-ready PR: no pack, no ping, no compare', async (run) => {
    const gh = fakeGitHub([{ n: 42, ready: false, files: ['scripts/a.mjs'] }]);
    await run(ENV, { now: NOW, fetch: gh.fetchImpl, quiet: true });
    return gh.prComments(42).length === 0 && !gh.log.some((l) => l.m === 'PATCH' && l.p !== '/issues/comments/5') && gh.compares() === 0;
  }],
  ['docs-only ready PR: pack, no owner ping', async (run) => {
    const gh = fakeGitHub([{ n: 43, files: ['docs/a.md'] }]);
    await run(ENV, { now: NOW, fetch: gh.fetchImpl, quiet: true });
    const c = gh.prComments(43);
    return c.length === 1 && c[0].includes('Needs: nothing from the owner') && !c.some((b) => b.startsWith('@'));
  }],
  ['second run at the same head: no comment written (pack current, already pinged)', async (run) => {
    const g1 = fakeGitHub([{ n: 44, files: ['scripts/a.mjs'] }]);
    await run(ENV, { now: NOW, fetch: g1.fetchImpl, quiet: true });
    const posted = g1.prComments(44).map((body, i) => ({ id: 300 + i, user: { login: GH_BOT }, body, html_url: 'u' }));
    const g2 = fakeGitHub([{ n: 44, files: ['scripts/a.mjs'], comments: posted }], { statusState: stateOf(g1.log) });
    await run(ENV, { now: NOW + 3600000, fetch: g2.fetchImpl, quiet: true });
    // the ping comment is gone (deleted by hand) but the state remembers the head: still no second ping
    const g3 = fakeGitHub([{ n: 44, files: ['scripts/a.mjs'], comments: posted.slice(0, 1) }], { statusState: stateOf(g1.log) });
    await run(ENV, { now: NOW + 7200000, fetch: g3.fetchImpl, quiet: true });
    return g2.prComments(44).length === 0 && !g2.log.some((l) => l.m === 'PATCH' && l.p !== '/issues/comments/5') && g3.prComments(44).length === 0;
  }],
  ['a stale pack (older head) is edited in place, never a second pack', async (run) => {
    const old = { id: 301, user: { login: GH_BOT }, body: `x\n<!-- autopilot-pack head=${'d'.repeat(40)} -->`, html_url: 'u' };
    const gh = fakeGitHub([{ n: 45, files: ['docs/a.md'], comments: [old] }]);
    await run(ENV, { now: NOW, fetch: gh.fetchImpl, quiet: true });
    return gh.log.some((l) => l.m === 'PATCH' && l.p === '/issues/comments/301') && gh.prComments(45).length === 0;
  }],
  ['ready + behind, not approved: update-branch, no pack; approved: no update, ap:stopped, no pack', async (run) => {
    const gh = fakeGitHub([{ n: 46, behind: 3, files: ['scripts/a.mjs'] }, { n: 47, behind: 2, approved: true, files: ['scripts/a.mjs'] }]);
    await run(ENV, { now: NOW, fetch: gh.fetchImpl, quiet: true });
    const puts = gh.log.filter((l) => l.m === 'PUT').map((l) => l.p);
    const stopped = gh.log.some((l) => l.m === 'POST' && l.p === '/issues/47/labels' && JSON.stringify(l.body).includes('ap:stopped'));
    return puts.join() === '/pulls/46/update-branch' && stopped && gh.prComments(46).length === 0 && gh.prComments(47).length === 0;
  }],
  ['migration ready PR not approved: pack + ping', async (run) => {
    const gh = fakeGitHub([{ n: 48, files: ['supabase/migrations/99990101000000_x.sql'] }]);
    await run(ENV, { now: NOW, fetch: gh.fetchImpl, quiet: true });
    return gh.prComments(48).length === 2;
  }],
  ['dry run: no write of any kind', async (run) => {
    const gh = fakeGitHub([{ n: 49, files: ['scripts/a.mjs'] }]);
    await run({ ...ENV, DRY_RUN: 'true' }, { now: NOW, fetch: gh.fetchImpl, quiet: true });
    return gh.log.every((l) => l.m === 'GET');
  }],
  ['owner ping error: logged, the run carries on (exit 0, pack still posted)', async (run) => {
    const gh = fakeGitHub([{ n: 50, files: ['scripts/a.mjs'] }, { n: 51, files: ['docs/a.md'] }], { pingFails: true });
    const code = await run(ENV, { now: NOW, fetch: gh.fetchImpl, quiet: true });
    return code === 0 && gh.prComments(51).length === 1 && gh.prComments(50).length === 2 && !stateOf(gh.log)._pings['51'] && !stateOf(gh.log)._pings['50'];
  }],
  ['every write is one of the allowed endpoints', async (run) => {
    const gh = fakeGitHub([{ n: 52, files: ['scripts/a.mjs'] }, { n: 53, behind: 1 }, { n: 54, ready: false }]);
    await run(ENV, { now: NOW, fetch: gh.fetchImpl, quiet: true });
    const ok = /^(POST \/issues|POST \/graphql|POST \/issues\/\d+\/(labels|comments)|DELETE \/issues\/\d+\/labels\/.+|PATCH \/issues\/comments\/\d+|PUT \/pulls\/\d+\/update-branch|POST \/actions\/jobs\/\d+\/rerun)$/;
    return gh.log.filter((l) => l.m !== 'GET').every((l) => ok.test(`${l.m} ${l.p}`));
  }],
];

describe('run() against a fake GitHub (r3)', () => {
  for (const [name, check] of SCENARIOS) it(name, async () => expect(await check(run as RunFn)).toBe(true));
});

// ---- mutants ----
const STEP = path.resolve(__dirname, '../scripts/autopilot-step.mjs');
const LIB = path.resolve(__dirname, '../scripts/lib/autopilot.mjs');
const PACK = path.resolve(__dirname, '../scripts/lib/autopilot-pack.mjs');
// Normalised to LF: a Windows checkout is CRLF and the multi-line anchors are written with \n.
const lf = (f: string) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const SRC = { step: lf(STEP), lib: lf(LIB), pack: lf(PACK) };

/** Source-text check: a forbidden write anywhere in the executor or the pack module. */
export function forbiddenWrites(src: string) {
  // r4: exactly one occurrence of the allowed site is removed before the scan; a second one stays and is flagged.
  if (src.split(MERGE_SITE).length === 2) src = src.replace(MERGE_SITE, '');
  const bad: [string, RegExp][] = [
    ['merge', /\/merge[`'"]/], ['review submission', /\/reviews[`'"],\s*\{/], ['approve', /['"]APPROVE['"]/], ['review request', /requested_reviewers/],
    ['close', /state:\s*['"]closed['"]/], ['ref write', /\/git\/refs/], ['force', /force:\s*true/], ['child_process', /child_process/], ['branch delete', /DELETE['"],\s*`[^`]*\/branches\//],
  ];
  return bad.filter(([, re]) => re.test(src)).map(([n]) => n);
}

let seq = 0;
async function load(kind: 'step' | 'lib' | 'pack', src: string) {
  const dir = { step: STEP, lib: LIB, pack: PACK }[kind];
  const file = path.join(path.dirname(dir), `.autopilot-r3-mutant-${process.pid}-${seq++}.mjs`);
  writeFileSync(file, src);
  return { file, m: await import(/* @vite-ignore */ pathToFileURL(file).href) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PURE: [string, (lib: any, pack: any) => boolean][] = [
  ['CI_CAP is 25', (lib) => lib.CI_CAP === 25],
  ['a foreign run-ci add is not counted', (lib) => lib.countCiProofs24h([{ event: 'labeled', label: { name: 'run-ci' }, actor: { login: '123constante' }, created_at: iso(NOW - MIN) }], true, [], NOW).count === 0],
  ['behindBy > 0 is behind', (lib) => lib.decide({ ...BASE, behindBy: 2 }).action === 'update-branch'],
  ['unread jobs are not green', (_l, pack) => { const p = pack.buildPack({ ...PACK_FACTS, jobs: [{ name: 'u' }] }) + pack.buildPack({ ...PACK_FACTS, jobs: null }); return !p.includes('| green') && p.includes('not read'); }],
  ['scripts/ is hard-tier', (_l, pack) => pack.needsOwnerApprove({ files: ['scripts/a.mjs'] })],
  ['unread file list fails closed', (_l, pack) => pack.needsOwnerApprove({ files: undefined })],
  ['a planted ping marker is ignored', (_l, pack) => !pack.pingedAtHead([{ user: { login: 'x' }, body: `<!-- autopilot-owner-ping head=${H} -->` }], H)],
];

async function survivorsPure(kind: 'lib' | 'pack', src: string) {
  const { file, m } = await load(kind, src);
  try {
    const lib = kind === 'lib' ? m : await import('../scripts/lib/autopilot.mjs');
    const pack = kind === 'pack' ? m : await import('../scripts/lib/autopilot-pack.mjs');
    return PURE.filter(([, ok]) => { try { return !ok(lib, pack); } catch { return true; } }).map(([n]) => n);
  } finally { rmSync(file, { force: true }); }
}
async function survivorsStep(src: string) {
  const { file, m } = await load('step', src);
  try {
    const out = forbiddenWrites(src).map((n) => `source: ${n}`);
    for (const [n, check] of SCENARIOS) { try { if (!(await check(m.run))) out.push(n); } catch { out.push(n); } }
    return out;
  } finally { rmSync(file, { force: true }); }
}

const STEP_MUTANTS: [string, string, string][] = [
  ['pack comment written on a non-ready PR', "          if (d.action === 'ready') {\n            try {", '          if (true) {\n            try {'],
  ['owner ping posted for a non-hard-tier PR', '  if (needsOwnerApprove(facts)) {', '  if (true) {'],
  ['owner ping posted twice for one head', 'if (pingedAtHead(comments, f.head) || ctx.pings[f.number] === f.head)', 'if (false)'],
  ['behind check run on every PR', "          if (d.action === 'ready') {\n            // r4 N1", '          if (true) {\n            // r4 N1'],
  ['approve call added', "  if (d.action === 'rerun') {", "  if (d.action === 'rerun') {\n    await apis.gh.call('POST', `/repos/${repo}/pulls/${f.number}/reviews`, { event: 'APPROVE' });"],
  ['merge call added', "  if (d.action === 'rerun') {", "  if (d.action === 'rerun') {\n    await apis.gh.call('PUT', `/repos/${repo}/pulls/${f.number}/merge`);"],
  ['ping failure aborts the PR', "        ctx.log(`::warning::${repo}#${f.number}: owner ping failed", "        throw e; ctx.log(`::warning::${repo}#${f.number}: owner ping failed"],
  ['pack written by the bot token', 'await packAndPing(gh, repo', 'await packAndPing(bot ?? gh, repo'],
];
const LIB_MUTANTS: [string, string, string][] = [
  ['CI_CAP left at 15', 'export const CI_CAP = 25;', 'export const CI_CAP = 15;'],
  ['foreign actor counted against the cap', "inWindow.filter((e) => e.actor && e.actor.login === BOT_LOGIN)", 'inWindow.filter(() => true)'],
  ['behindBy ignored', "const behind = f.merge === 'behind' || f.behindBy > 0;", "const behind = f.merge === 'behind';"],
];
const PACK_MUTANTS: [string, string, string][] = [
  ['a job with no conclusion reads green', "if (!j.conclusion) return 'not read';", "if (!j.conclusion) return 'green';"],
  ['scripts/ dropped from the hard tier', "  [/^scripts\\//, 'scripts/: gate and automation code'],\n", ''],
  ['unread file list fails open', "if (!Array.isArray(files)) return [{", 'if (!Array.isArray(files)) return []; if (0) return [{'],
  ['planted ping marker trusted', "c.user && c.user.login === PACK_AUTHOR && (PING_RE", '(PING_RE'],
];

describe('r3 mutants (each must turn a check red)', () => {
  it('the unmutated sources pass every check (the harness is honest)', async () => {
    expect(forbiddenWrites(SRC.step)).toEqual([]);
    expect(forbiddenWrites(SRC.pack)).toEqual([]);
    expect(await survivorsPure('lib', SRC.lib)).toEqual([]);
    expect(await survivorsStep(SRC.step)).toEqual([]);
  }, 60000);
  for (const [name, from, to] of STEP_MUTANTS) {
    it(`catches (step): ${name}`, async () => {
      expect(SRC.step.includes(from), `anchor missing for ${name}`).toBe(true);
      expect((await survivorsStep(SRC.step.replace(from, to))).length).toBeGreaterThan(0);
    }, 60000);
  }
  for (const [name, from, to] of LIB_MUTANTS) {
    it(`catches (lib): ${name}`, async () => {
      expect(SRC.lib.includes(from), `anchor missing for ${name}`).toBe(true);
      expect((await survivorsPure('lib', SRC.lib.replace(from, to))).length).toBeGreaterThan(0);
    });
  }
  for (const [name, from, to] of PACK_MUTANTS) {
    it(`catches (pack): ${name}`, async () => {
      expect(SRC.pack.includes(from), `anchor missing for ${name}`).toBe(true);
      expect((await survivorsPure('pack', SRC.pack.replace(from, to))).length).toBeGreaterThan(0);
    });
  }
});
