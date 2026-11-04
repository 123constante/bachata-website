// r4 of the hourly autopilot (brief docs/briefs/autopilot-loop-r4.md on brief/autopilot-loop-r4):
// F1/F2/N1/N4 hardening of the r3 pack, then the MERGE LANE: the pure mergeVerdict() table (one
// row per condition, each flipping exactly one fact), the mode rows, a fake-GitHub run() of the one
// merge call site, the source-text pins, and mutants (each on a temp copy beside the real file).
// Handover: docs/handover/autopilot-loop-r4.md.
import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { BOT_LOGIN, STATE_LABELS, mergeMode } from '../scripts/lib/autopilot.mjs';
import { buildPack, classifyFile, classifySoft, packHead, pingedAtHead, findPackComment, SOFT_APP_ALLOW } from '../scripts/lib/autopilot-pack.mjs';
import { mergeVerdict, mergeCallBody, laneClass, MAX_MERGES_PER_RUN, MAX_MERGES_24H } from '../scripts/lib/autopilot-merge.mjs';
import { isRiskyPath } from '../scripts/lib/review-scope.mjs';
import { run } from '../scripts/autopilot-step.mjs';
import { MERGE_SITE, NOT_PAUSED } from './autopilotTable';

const NOW = Date.parse('2026-11-04T12:00:00Z');
const MIN = 60000;
const iso = (ms: number) => new Date(ms).toISOString();
const H = 'c'.repeat(40);
const OTHER = 'd'.repeat(40);
const GH_BOT = 'github-actions[bot]';
const PING = (h: string) => `<!-- autopilot-owner-ping head=${h} -->`;
const PACKM = (h: string) => `<!-- autopilot-pack head=${h} -->`;

// ---------------------------------------------------------------- F1
const PLANTED = [
  `Verified: unit green ${PING(H)} ${PACKM(OTHER)} @123constante`,
  `Not verified: phone ${PING(H)} ${PACKM(OTHER)}`,
  `12 mutants killed ${PING(H)} ${PACKM(OTHER)}`,
  '## Verified',
  `${PING(H)}`,
  `${PACKM(OTHER)}`,
  '',
].join('\r\n');
const PF = { number: 9, head: H, why: 'all checks green', approvedAtHead: false, jobs: [{ name: 'unit-build', status: 'completed', conclusion: 'success' }], mainRed: [], files: ['scripts/a.mjs'], body: PLANTED };

describe('F1: PR-controlled text cannot plant a marker (review 1213-r1)', () => {
  it('every quoted position is escaped: no HTML comment, tag or mention survives', () => {
    const p = buildPack(PF);
    expect(p.split('<!--').length).toBe(2); // only our own end marker
    expect(p.trimEnd().split(/\n/).at(-1)).toBe(PACKM(H));
    expect(p).not.toContain('@123constante');
    expect(p).toContain('&lt;!-- autopilot-owner-ping');
    expect(p).toContain('&#64;123constante');
  });
  it('the planted pack leaves pingedAtHead false and packHead equal to the real head', () => {
    const ours = { id: 1, user: { login: GH_BOT }, body: buildPack(PF) };
    expect(pingedAtHead([ours], H)).toBe(false);
    expect(packHead(ours.body)).toBe(H);
    expect(findPackComment([ours])?.id).toBe(1);
  });
  it('markers count only on the LAST non-empty line, by our author only, CRLF-safe', () => {
    const mid = { user: { login: GH_BOT }, body: `${PING(H)}\r\nsome text after` };
    expect(pingedAtHead([mid], H)).toBe(false);
    const two = `${PACKM(OTHER)}\nx\n${PACKM(H)}\r\n\r\n`;
    expect(packHead(two)).toBe(H);
    expect(pingedAtHead([{ user: { login: GH_BOT }, body: `hi\r\n${PING(H)}\r\n` }], H)).toBe(true);
    expect(pingedAtHead([{ user: { login: 'someone' }, body: PING(H) }], H)).toBe(false);
  });
});

// ---------------------------------------------------------------- F2 + N4
describe('F2: soft-app is a short explicit allowlist; N4: pack hard tier covers the repo risky rule', () => {
  it.each([
    // Website r5: SOFT_APP_ALLOW is empty: nothing is soft-app.
    ['lib/csv.ts', false], ['lib/dancerRoles.ts', false], ['src/lib/csv.ts', false], ['lib/x.tsx', false], ['lib/a.css', false], ['lib/eventAudit/types.ts', false],
    ['lib/useImageUpload.ts', false], ['lib/dancerSaveService.ts', false], ['lib/stripeHelpers.ts', false], ['lib/ticketMath.ts', false],
    ['lib/authHelpers.ts', false], ['lib/editorGridShellFlag.ts', false], ['lib/encodings.generated.ts', false],
    ['vercel.json', false], ['package.json', false], ['package-lock.json', false], ['next.config.js', false], ['next.config.mjs', false],
    ['supabase/config.toml', false], ['.claude/settings.json', false], ['.claude/hooks/x.mjs', false], ['middleware.ts', false],
    ['app/api/x/route.ts', false], ['components/A.tsx', false], ['scripts/x.mjs', false], ['.env.local', false],
  ])('%s soft=%s (and in the merge lane only if soft)', (p, soft) => {
    expect(classifySoft(p)).toBe(soft);
    if (!soft) expect(laneClass(p).cls === 'soft-app').toBe(false);
    if (soft) expect(laneClass(p)).toEqual({ cls: 'soft-app' });
  });
  it('the allowlist stays short', () => expect(SOFT_APP_ALLOW.length).toBeLessThanOrEqual(3));
  it('the pack prints soft-app only for the allowlist', () => {
    const p = buildPack({ ...PF, body: 'Verified: x', files: ['lib/csv.ts', 'lib/dataSaver.ts', 'middleware.ts'] });
    expect(p).toMatch(/\*\*soft-app \(allowlist\)\*\* \(0\)/);
    expect(p).toMatch(/\*\*app \(not soft\)\*\* \(3\)/);
  });
  const DRIFT = [
    'supabase/migrations/99990101000000_x.sql', 'supabase/migrations/ledger-sync-allowlist.json', 'supabase/migrations/proof-receipt-bypass-allowlist.json',
    'supabase/functions/x/index.ts', 'supabase/encodings/baseline.json', 'supabase/encodings/registry.json', '.github/workflows/autopilot.yml',
    'scripts/check-workflow-artifact-policy.mjs', 'scripts/apply-migration.mjs', 'scripts/lib/review-scope.mjs', 'scripts/pre-ship.mjs', 'guards.json',
    'docs/a.md', 'lib/csv.ts',
  ];
  it.each(DRIFT)('N4 drift: %s risky in the repo rule => hard-tier in the pack', (p) => {
    if (isRiskyPath(p)) expect(classifyFile(p).group).toBe('hard');
  });
});

// ---------------------------------------------------------------- mergeVerdict table
const PACK_OK = { id: 7, user: { login: GH_BOT }, body: `## Autopilot pack\nall read\n${PACKM(H)}` };
const ALL = () => ({
  mode: 'soft', dryRun: false, tokenOk: true, budgetOk: true, decision: 'ready', workerDone: true,
  pr: { state: 'open', draft: false, fork: false, base: 'main', author: BOT_LOGIN, ref: 'claude/x', ageDays: 1, head: H, changedFiles: 2 },
  files: ['docs/a.md', 'docs/handover/b.md'], labels: ['review-passed', 'ap:ready'],
  labelEvents: [{ event: 'labeled', label: { name: 'review-passed' }, actor: { login: BOT_LOGIN }, created_at: iso(NOW - 5 * MIN) }],
  pushAnchorMs: NOW - 60 * MIN, comments: [PACK_OK], body: 'Verified: unit suite green (12 tests)\nNot verified: the phone walk',
  jobs: [{ name: 'unit-build', status: 'completed', conclusion: 'success' }], redNew: [], redMain: [], pending: 0, behindBy: 0,
  mergesThisRun: 0, merges24h: 0, mainAfterLastMerge: { state: 'none' },
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type F = any;
const ROWS: [string, (f: F) => void, RegExp][] = [
  ['1 mode unset', (f) => { f.mode = undefined; }, /^mode off/],
  ['1 dry run on', (f) => { f.dryRun = true; }, /^dry run/],
  ['1 merge token missing', (f) => { f.tokenOk = false; }, /AUTOMERGE_TOKEN missing/],
  ['2 PR closed', (f) => { f.pr.state = 'closed'; }, /PR not open/],
  ['2 draft', (f) => { f.pr.draft = true; }, /^draft/],
  ['2 fork', (f) => { f.pr.fork = true; }, /^fork/],
  ['2 base not main', (f) => { f.pr.base = 'dev'; }, /base is dev/],
  ['2 author not bot', (f) => { f.pr.author = '123constante'; }, /author 123constante is not/],
  ['2 branch kind', (f) => { f.pr.ref = 'feature/x'; }, /not claude\/ or ccr-/],
  ['2 too old', (f) => { f.pr.ageDays = 15; }, /older than 14 days/],
  ['2 no worker-done marker', (f) => { f.workerDone = false; }, /worker-done/],
  ['2 decision not ready', (f) => { f.decision = 'wait'; }, /decision is wait/],
  ['3 file list not read', (f) => { f.files = null; }, /file list not read/],
  ['3 file list truncated (count mismatch)', (f) => { f.pr.changedFiles = 3; }, /file list incomplete/],
  ['3 file list at the 300 cap', (f) => { f.files = Array.from({ length: 300 }, (_, i) => `docs/f${i}.md`); f.pr.changedFiles = 300; }, /cap 300/],
  ['3 hard-tier path', (f) => { f.files = ['docs/a.md', 'scripts/x.mjs']; }, /^hard-tier path scripts\/x\.mjs/],
  ['3 screen path', (f) => { f.files = ['docs/a.md', 'components/A.tsx']; }, /^screen \/ app path components\/A\.tsx/],
  ['3 root config', (f) => { f.files = ['docs/a.md', 'vercel.json']; }, /vercel\.json/],
  ['3 package.json', (f) => { f.files = ['docs/a.md', 'package.json']; }, /package\.json/],
  ['3 .claude settings', (f) => { f.files = ['docs/a.md', '.claude/settings.json']; }, /\.claude/],
  ['3 supabase config', (f) => { f.files = ['docs/a.md', 'supabase/config.toml']; }, /^hard-tier path supabase\/config\.toml/],
  ['3 governance doc', (f) => { f.files = ['docs/a.md', 'docs/pr-batching-policy.md']; }, /governance/],
  ['4 migration file', (f) => { f.files = ['docs/a.md', 'supabase/migrations/9999_x.sql']; }, /migration file/],
  ['4 migration-queued label', (f) => { f.labels.push('migration-queued'); }, /migration-queued label/],
  ['4 queue-stopped label', (f) => { f.labels.push('queue-stopped'); }, /queue-stopped label/],
  ['5 reserved label do-not-merge', (f) => { f.labels.push('do-not-merge'); }, /reserved label do-not-merge/],
  ['5 reserved label needs-owner', (f) => { f.labels.push('needs-owner'); }, /reserved label needs-owner/],
  ['5 reserved label wip', (f) => { f.labels.push('wip'); }, /reserved label wip/],
  ['5 reserved label owner-reserved', (f) => { f.labels.push('owner-reserved'); }, /reserved label owner-reserved/],
  ['5 reserved label autopilot-hold', (f) => { f.labels.push('autopilot-hold'); }, /reserved label autopilot-hold/],
  ['5 body says do not merge', (f) => { f.body += '\nPlease do not merge until Friday.'; }, /must not be merged/],
  ['6 no checks read', (f) => { f.jobs = null; }, /no checks read/],
  ['6 check pending', (f) => { f.jobs.push({ name: 'e2e', status: 'in_progress', conclusion: null }); f.pending = 1; }, /pending: e2e/],
  ['6 newly red', (f) => { f.jobs.push({ name: 'lint', status: 'completed', conclusion: 'failure' }); f.redNew = ['lint']; }, /newly red vs main: lint/],
  ['6 red also on main is listed, not green', (f) => { f.jobs.push({ name: 'drift', status: 'completed', conclusion: 'failure' }); f.redMain = ['drift']; }, /red also on main.*drift/],
  ['6 billing annotation red (cancelled, not on main)', (f) => { f.jobs.push({ name: 'billing', status: 'completed', conclusion: 'cancelled' }); }, /billing/],
  ['7 behind', (f) => { f.behindBy = 2; }, /behind main by 2/],
  ['7 behind not read', (f) => { f.behindBy = null; }, /behind check not read/],
  ['8 no review-passed label', (f) => { f.labels = ['ap:ready']; }, /no review-passed label/],
  ['8 review-passed by someone else', (f) => { f.labelEvents[0].actor.login = '123constante'; }, /not added by kiki-claude-bot/],
  ['8 review-passed before the latest push', (f) => { f.labelEvents[0].created_at = iso(NOW - 90 * MIN); }, /before the latest push/],
  ['8 push time unknown', (f) => { f.pushAnchorMs = null; }, /push time or label events not read/],
  ['8 no pack comment', (f) => { f.comments = []; }, /no autopilot pack comment/],
  ['8 pack by someone else', (f) => { f.comments = [{ ...PACK_OK, user: { login: BOT_LOGIN } }]; }, /no autopilot pack comment/],
  ['8 pack for another head', (f) => { f.comments = [{ ...PACK_OK, body: `x\n${PACKM(OTHER)}` }]; }, /another head/],
  ['8 pack says not read', (f) => { f.comments = [{ ...PACK_OK, body: `Job list not read\n${PACKM(H)}` }]; }, /says "not read"/],
  ['9 TO FILL', (f) => { f.body += '\nRollback: TO FILL'; }, /TO FILL/],
  ['9 Verified empty', (f) => { f.body = 'Verified:\n\nNot verified: phone'; }, /Verified line not filled/],
  ['9 Not verified missing', (f) => { f.body = 'Verified: unit green'; }, /Not verified line not filled/],
  ['10 prod write section', (f) => { f.body += '\n## Prod data write\n- rows'; }, /announces a prod data write/],
  ['10 apply in Verified', (f) => { f.body = 'Verified: applied the backfill on prod\nNot verified: phone'; }, /prod write \/ apply/],
  ['11 per-run cap', (f) => { f.mergesThisRun = 3; }, /per-run merge cap/],
  ['11 24 h cap', (f) => { f.merges24h = 6; }, /24 h merge cap/],
  ['11 merge log not read', (f) => { f.merges24h = null; }, /log not read/],
  ['11 budget spent', (f) => { f.budgetOk = false; }, /request budget spent/],
  ['11 main red after last merge', (f) => { f.mainAfterLastMerge = { state: 'red', pr: 1300 }; }, /^paused: main red after #1300$/],
  ['11 main state unread', (f) => { f.mainAfterLastMerge = { state: 'unread', pr: 1300 }; }, /not read/],
];

describe('mergeVerdict: one row per condition (each flips one fact)', () => {
  it('all true -> merge', () => {
    const v = mergeVerdict(ALL());
    expect(v).toMatchObject({ merge: true, reasons: [], classes: ['docs'], mode: 'soft' });
  });
  it.each(ROWS)('%s -> NO with its reason', (_n, flip, re) => {
    const f = ALL();
    flip(f);
    const v = mergeVerdict(f);
    expect(v.merge).toBe(false);
    expect(v.reasons.some((r: string) => re.test(r))).toBe(true);
  });
  it('mode rows', () => {
    const docs = { files: ['docs/a.md'], pr: { ...ALL().pr, changedFiles: 1 } };
    const app = { files: ['lib/csv.ts'], pr: { ...ALL().pr, changedFiles: 1 } };
    for (const m of [undefined, '', 'off', 'SOFT', 'soft ']) expect(mergeVerdict({ ...ALL(), mode: m }).reasons[0]).toMatch(/^mode off/);
    expect(mergeVerdict({ ...ALL(), ...docs, mode: 'docs-canary' }).merge).toBe(true);
    const canaryApp = mergeVerdict({ ...ALL(), ...app, mode: 'docs-canary' });
    expect(canaryApp.merge).toBe(false); // the canary test: a one-file soft-app PR gets NO
    // Website r5: lib/csv.ts is never soft-app, so it is refused in every mode.
    expect(canaryApp.reasons).toEqual(['forbidden path: lib/csv.ts is not on the Website docs/tests allowlist']);
    expect(mergeVerdict({ ...ALL(), ...app, mode: 'soft' }).merge).toBe(false);
    expect(mergeMode({})).toBe('off');
    expect(mergeMode({ AUTOPILOT_MERGE_MODE: 'docs-canary' })).toBe('docs-canary');
    expect(mergeMode({ AUTOPILOT_MERGE_MODE: 'yes' })).toBe('off');
  });
  it('caps and the pinned call body', () => {
    expect([MAX_MERGES_PER_RUN, MAX_MERGES_24H]).toEqual([3, 6]);
    expect(mergeCallBody(H)).toEqual({ sha: H, merge_method: 'squash' });
    expect(() => mergeCallBody('')).toThrow();
  });
});

// ---------------------------------------------------------------- run() with a fake GitHub
const MERGED = 'e'.repeat(40);
type Cfg = { n: number; files?: string[]; labels?: string[]; body?: string; behind?: number; mergeStatus?: number };
function fakeGitHub(cfgs: Cfg[], { statusState = null as object | null, mainRed = false, lowRateAfter = '' } = {}) {
  const log: { m: string; p: string; auth?: string; body?: Record<string, unknown> }[] = [];
  let low = false; // once `lowRateAfter` is read, GitHub reports 100 requests left (below RATE_FLOOR)
  const json = (b: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(b), { status, headers: { 'x-ratelimit-remaining': low ? '100' : '4000' } });
  const sha = (n: number) => `${n}`.padEnd(40, 'a').replace(/[^0-9a]/g, 'a');
  const files = (c: Cfg) => c.files ?? ['docs/a.md'];
  const pr = (c: Cfg) => ({
    number: c.n, state: 'open', draft: false, user: { login: BOT_LOGIN }, created_at: iso(NOW - 86400000), changed_files: files(c).length,
    body: c.body ?? 'Verified: unit green (12)\nNot verified: phone walk', labels: (c.labels ?? ['run-ci', 'review-passed']).map((name) => ({ name })), mergeable_state: 'clean',
    head: { sha: sha(c.n), ref: `claude/f-${c.n}`, repo: { full_name: 'o/r' } }, base: { ref: 'main', repo: { full_name: 'o/r' } },
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
    if (lowRateAfter && p === lowRateAfter) low = true;
    let mm: RegExpExecArray | null;
    if (m === 'GET' && p === '') return json({ default_branch: 'main' });
    if (m === 'GET' && p === '/commits/main') return json({ sha: 'm'.repeat(40) });
    if (m === 'GET' && /^\/commits\/(m+|e+)\/check-runs$/.test(p)) return json({ check_runs: mainRed && p.includes('eee') ? [{ name: 'unit-build', status: 'completed', conclusion: 'failure' }] : [] });
    if (m === 'GET' && /^\/commits\/(m+|e+)\/status$/.test(p)) return json({ statuses: [] });
    if (m === 'GET' && p === '/issues/events') return json([]);
    if (m === 'GET' && p === '/issues') return json(statusComments.length ? [{ number: 77, title: 'autopilot status', user: { login: GH_BOT } }] : []);
    if (m === 'GET' && p === '/issues/77/comments') return json(statusComments);
    if (m === 'GET' && p === '/labels') return json(Object.values(STATE_LABELS).map((name) => ({ name })));
    if (m === 'GET' && p === '/pulls') return json(page === 1 ? cfgs.map(pr) : []);
    if (m === 'GET' && (mm = /^\/compare\/[me]{40}\.\.\.([0-9a-f]{40})$/.exec(p))) return json({ behind_by: p.includes('eee') ? 1 : bySha(mm[1])?.behind ?? 0, ahead_by: 1 });
    if (m === 'GET' && (mm = /^\/commits\/([0-9a-f]{40})$/.exec(p))) return json({ sha: mm[1], commit: { message: 'feat: x [worker-done dt_ab12]' }, parents: [] });
    if (m === 'GET' && (mm = /^\/pulls\/(\d+)$/.exec(p))) return json(pr(byNum(mm[1])));
    if (m === 'GET' && /^\/pulls\/(\d+)\/reviews$/.test(p)) return json([]);
    if (m === 'GET' && (mm = /^\/pulls\/(\d+)\/files$/.exec(p))) return json(files(byNum(mm[1])).map((filename) => ({ filename })));
    if (m === 'GET' && /^\/commits\/[0-9a-f]{40}\/check-runs$/.test(p)) return json({ check_runs: [{ name: 'unit-build', status: 'completed', conclusion: 'success', details_url: 'https://github.com/o/r/actions/runs/1/job/2', completed_at: iso(NOW - 10 * MIN) }] });
    if (m === 'GET' && /^\/commits\/[0-9a-f]{40}\/status$/.test(p)) return json({ statuses: [] });
    if (m === 'GET' && p === '/actions/runs') { const s = u.searchParams.get('head_sha'); return json({ workflow_runs: [{ id: 1, workflow_id: 1, head_sha: s, event: 'pull_request', created_at: iso(NOW - 30 * MIN) }] }); }
    if (m === 'GET' && /^\/issues\/\d+\/events$/.test(p)) return json([
      { event: 'labeled', label: { name: 'run-ci' }, actor: { login: BOT_LOGIN }, created_at: iso(NOW - 31 * MIN) },
      { event: 'labeled', label: { name: 'review-passed' }, actor: { login: BOT_LOGIN }, created_at: iso(NOW - 5 * MIN) },
    ]);
    if (m === 'GET' && (mm = /^\/issues\/(\d+)\/comments$/.exec(p))) return json([{ id: 300, user: { login: GH_BOT }, html_url: 'u', body: `pack\n${PACKM(sha(Number(mm[1])))}` }]);
    if (m === 'PUT' && (mm = /^\/pulls\/(\d+)\/merge$/.exec(p))) { const st = byNum(mm[1]).mergeStatus ?? 200; return st === 200 ? json({ merged: true, sha: MERGED }) : json({ message: 'Head branch was modified' }, st); }
    if (m === 'POST' && /^\/issues\/\d+\/comments$/.test(p)) return json({ id: 900, html_url: 'u' });
    if (m === 'PATCH' && /^\/issues\/comments\/\d+$/.test(p)) return json({ id: 1, html_url: 'u' });
    if (m === 'POST' && /^\/issues\/\d+\/labels$/.test(p)) return json([]);
    if (m === 'DELETE' && /^\/issues\/\d+\/labels\//.test(p)) return json(null, 204);
    if (m === 'POST' && p === '/issues') return json({ number: 77, node_id: 'n' });
    if (m === 'POST' && u.pathname === '/graphql') return json({});
    // Website r5: the repo's vercel.json (claude/* never deploys), read GET-only by readVercelConfig().
    if (m === 'GET' && p === '/contents/vercel.json') return json({ content: 'eyJnaXQiOiB7ImRlcGxveW1lbnRFbmFibGVkIjogeyJjbGF1ZGUvKiI6IGZhbHNlLCAibWFpbiI6IHRydWV9fX0=', encoding: 'base64' });
    return json({ message: `fake: unhandled ${m} ${p}` }, 500);
  };
  const merges = () => log.filter((l) => l.m === 'PUT' && /\/merge$/.test(l.p));
  return { log, fetchImpl, sha, merges };
}
const ENV = { REPOS: 'o/r', GH_TOKEN: 't', BOT_TOKEN: 'b', AUTOMERGE_TOKEN: 'am', DRY_RUN: 'false', AUTOPILOT_MERGE_MODE: 'soft', RUN_URL: 'https://run/1' };
const stateOf = (log: { m: string; p: string; body?: Record<string, unknown> }[]) => {
  const w = log.filter((l) => (l.m === 'POST' && l.p === '/issues/77/comments') || l.m === 'PATCH').map((l) => String(l.body!.body)).find((b) => b.includes('autopilot-state'))!;
  return { body: w, state: JSON.parse(/<!-- autopilot-state (\{[\s\S]*?\}) -->/.exec(w)![1]) };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RunFn = (env: any, opts: any) => Promise<number>;
const SCENARIOS: [string, (run: RunFn) => Promise<boolean>][] = [
  ['soft docs PR: ONE pinned-sha squash with AUTOMERGE_TOKEN, ap:* removed, merge-log row', async (run) => {
    const gh = fakeGitHub([{ n: 61 }]);
    const code = await run(ENV, { ...NOT_PAUSED, now: NOW, fetch: gh.fetchImpl, quiet: true });
    const ms = gh.merges();
    const { body, state } = stateOf(gh.log);
    const removed = gh.log.some((l) => l.m === 'DELETE' && l.p === '/issues/61/labels/ap%3Aready');
    return code === 0 && ms.length === 1 && ms[0].auth === 'Bearer am' && JSON.stringify(ms[0].body) === JSON.stringify({ sha: gh.sha(61), merge_method: 'squash' })
      && removed && state._merges.length === 1 && state._merges[0].sha === MERGED && body.includes('### Merge log') && body.includes('o/r#61');
  }],
  ['mode unset: no merge call', async (run) => {
    const gh = fakeGitHub([{ n: 62 }]);
    await run({ ...ENV, AUTOPILOT_MERGE_MODE: undefined }, { ...NOT_PAUSED, now: NOW, fetch: gh.fetchImpl, quiet: true });
    return gh.merges().length === 0;
  }],
  ['dry run with mode soft: no write of any kind', async (run) => {
    const gh = fakeGitHub([{ n: 63 }]);
    await run({ ...ENV, DRY_RUN: 'true' }, { ...NOT_PAUSED, now: NOW, fetch: gh.fetchImpl, quiet: true });
    return gh.log.every((l) => l.m === 'GET');
  }],
  ['no AUTOMERGE_TOKEN: no merge (never GITHUB_TOKEN)', async (run) => {
    const gh = fakeGitHub([{ n: 64 }]);
    await run({ ...ENV, AUTOMERGE_TOKEN: '' }, { ...NOT_PAUSED, now: NOW, fetch: gh.fetchImpl, quiet: true });
    return gh.merges().length === 0;
  }],
  ['409 head moved: logged, no retry, nothing else, exit 0', async (run) => {
    const gh = fakeGitHub([{ n: 65, mergeStatus: 409 }]);
    const code = await run(ENV, { ...NOT_PAUSED, now: NOW, fetch: gh.fetchImpl, quiet: true });
    return code === 0 && gh.merges().length === 1 && stateOf(gh.log).state._merges.length === 0 && !gh.log.some((l) => l.m === 'DELETE');
  }],
  ['hard-tier / screen PRs: no merge', async (run) => {
    const gh = fakeGitHub([{ n: 66, files: ['scripts/a.mjs'] }, { n: 67, files: ['components/A.tsx'] }]);
    await run(ENV, { ...NOT_PAUSED, now: NOW, fetch: gh.fetchImpl, quiet: true });
    return gh.merges().length === 0;
  }],
  ['two mergeable PRs: the second is behind the new main, one merge only', async (run) => {
    const gh = fakeGitHub([{ n: 68 }, { n: 69 }]);
    await run(ENV, { ...NOT_PAUSED, now: NOW, fetch: gh.fetchImpl, quiet: true });
    return gh.merges().length === 1;
  }],
  ['main red after the previous loop merge: paused, written in the status comment', async (run) => {
    const prev = { _merges: [{ t: NOW - 3600000, key: 'o/r#60', head: 'x', sha: MERGED, cls: 'docs', mode: 'soft', run: 'r' }] };
    const gh = fakeGitHub([{ n: 70 }], { statusState: prev, mainRed: true });
    await run(ENV, { ...NOT_PAUSED, now: NOW, fetch: gh.fetchImpl, quiet: true });
    return gh.merges().length === 0 && stateOf(gh.log).body.includes('paused: main red after #60');
  }],
  ['24 h cap counted from the merge log', async (run) => {
    const prev = { _merges: Array.from({ length: 6 }, (_, i) => ({ t: NOW - (i + 2) * 3600000, key: 'o/r#1', head: 'x', sha: 'f'.repeat(40), cls: 'docs', mode: 'soft', run: 'r' })) };
    const gh = fakeGitHub([{ n: 71 }], { statusState: prev });
    await run(ENV, { ...NOT_PAUSED, now: NOW, fetch: gh.fetchImpl, quiet: true });
    return gh.merges().length === 0;
  }],
  ['N1: a deferred behind check never labels ap:ready (it labels ap:waiting-ci)', async (run) => {
    const gh = fakeGitHub([{ n: 72 }], { lowRateAfter: '/pulls/72/files' });
    await run({ ...ENV, AUTOPILOT_MERGE_MODE: undefined }, { ...NOT_PAUSED, now: NOW, fetch: gh.fetchImpl, quiet: true });
    const labelled = (l: string) => gh.log.some((x) => x.m === 'POST' && x.p === '/issues/72/labels' && JSON.stringify(x.body).includes(l));
    return !gh.log.some((x) => x.p.startsWith('/compare/')) && labelled(STATE_LABELS.waiting) && !labelled(STATE_LABELS.ready);
  }],
];

describe('run() merge lane against a fake GitHub (r4)', () => {
  for (const [name, check] of SCENARIOS) it(name, async () => expect(await check(run as RunFn)).toBe(true));
});

// ---------------------------------------------------------------- source text + mutants
const STEP = path.resolve(__dirname, '../scripts/autopilot-step.mjs');
const MERGE = path.resolve(__dirname, '../scripts/lib/autopilot-merge.mjs');
const PACK = path.resolve(__dirname, '../scripts/lib/autopilot-pack.mjs');
const lf = (f: string) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const SRC = { step: lf(STEP), merge: lf(MERGE), pack: lf(PACK) };

function sourceProblems(step: string) {
  const out: string[] = [];
  if (step.split(MERGE_SITE).length !== 2) out.push('not exactly one allowed merge site');
  const rest = step.replace(MERGE_SITE, '');
  for (const [n, re] of [
    ['second merge call', /\/merge[`'"]/], ['approve', /APPROVE|\/reviews[`'"],\s*\{/], ['close', /state:\s*['"]closed['"]/], ['branch delete', /\/git\/refs|DELETE['"],\s*`[^`]*\/branches\//],
    ['force push', /force:\s*true/], ['variable write', /\/actions\/(variables|secrets)/], ['GITHUB_TOKEN merge', /makeApi\(env\.(GH_TOKEN|GITHUB_TOKEN)[^)]*\)[^\n]*mergeApi|const mergeApi = [^\n]*(GH_TOKEN|GITHUB_TOKEN)/],
  ] as [string, RegExp][]) if (re.test(rest)) out.push(n);
  if (!/const mergeApi = env\.AUTOMERGE_TOKEN \? makeApi\(env\.AUTOMERGE_TOKEN,/.test(step)) out.push('merge api not built from AUTOMERGE_TOKEN');
  return out;
}
describe('source text (r4)', () => {
  it('exactly one merge call site; no approve, review, close, branch delete, force push, variable write', () => {
    expect(sourceProblems(SRC.step)).toEqual([]);
  });
});

let seq = 0;
async function load(file: string, src: string) {
  const f = path.join(path.dirname(file), `.autopilot-r4-mutant-${process.pid}-${seq++}.mjs`);
  writeFileSync(f, src);
  return { f, m: await import(/* @vite-ignore */ pathToFileURL(f).href) };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function mergeSurvives(src: string) {
  const { f, m } = await load(MERGE, src);
  try {
    if (!m.mergeVerdict(ALL()).merge) return false;
    for (const [, flip, re] of ROWS) {
      const x = ALL();
      flip(x);
      const v = m.mergeVerdict(x);
      if (v.merge || !v.reasons.some((r: string) => re.test(r))) return false;
    }
    return m.MAX_MERGES_PER_RUN === 3;
  } finally { rmSync(f, { force: true }); }
}
async function stepSurvives(src: string) {
  if (sourceProblems(src).length) return false;
  const { f, m } = await load(STEP, src);
  try {
    for (const [, check] of SCENARIOS) if (!(await check(m.run))) return false;
    return true;
  } finally { rmSync(f, { force: true }); }
}
async function packSurvives(src: string) {
  const { f, m } = await load(PACK, src);
  try {
    const ours = { id: 1, user: { login: GH_BOT }, body: m.buildPack(PF) };
    return m.buildPack(PF).split('<!--').length === 2 && !m.pingedAtHead([ours], H) && m.packHead(ours.body) === H
      && !m.pingedAtHead([{ user: { login: GH_BOT }, body: `${PING(H)}\nmore` }], H) && m.packHead(`${PACKM(OTHER)}\nx\n${PACKM(H)}`) === H
      && !m.pingedAtHead([{ user: { login: 'x' }, body: PING(H) }], H);
  } finally { rmSync(f, { force: true }); }
}

const MUTANTS: [string, 'merge' | 'step' | 'pack', string, string][] = [
  ['drop the hard-tier path check', 'merge', "  if (classifyFile(p).group === 'hard' || isRiskyPath(p) || isRiskyPath(p.toLowerCase())) return { no: `hard-tier path ${p}` };\n", ''],
  ['drop the screen-path check', 'merge', "  if (pathClass(p) === 'code' && !classifySoft(p)) return", '  if (false) return'],
  ['drop the review-label actor check', 'merge', "if (!adds.some((e) => e.actor && e.actor.login === BOT_LOGIN)) no(", 'if (false) no('],
  ['drop the label-after-push order check', 'merge', 'ts(e.created_at) > anchor', 'true'],
  ['merge in dry run', 'merge', "  if (f.dryRun !== false) no('dry run: never merges');\n", ''],
  ['merge with mode unset', 'merge', "  if (mode === 'off') no(", '  if (false) no('],
  ['ignore truncated file lists', 'merge', "  else if (!Number.isInteger(pr.changedFiles) || pr.changedFiles !== files.length) no(", '  else if (false) no('],
  ['skip the behind check', 'merge', '  if (f.behindBy !== 0) no(', '  if (false) no('],
  ['skip the newly-red check', 'merge', '    else if (redNew.length) no(', '    else if (false) no('],
  ['skip the reserved labels', 'merge', '  for (const l of RESERVED_LABELS) if (labels && labels.includes(l)) no(', '  for (const l of RESERVED_LABELS) if (false) no('],
  ['skip the main-red self-pause', 'merge', "  if (m.state === 'red') no(`paused: main red after #${m.pr}`);\n  else if", '  if'],
  ['raise the per-run cap', 'merge', 'export const MAX_MERGES_PER_RUN = 3;', 'export const MAX_MERGES_PER_RUN = 4;'],
  ['use GITHUB_TOKEN', 'step', 'const mergeApi = env.AUTOMERGE_TOKEN ? makeApi(env.AUTOMERGE_TOKEN,', 'const mergeApi = env.AUTOMERGE_TOKEN ? makeApi(env.GH_TOKEN,'],
  ['merge without the pinned sha', 'step', 'mergeCallBody(f.head))', "{ merge_method: 'squash' })"],
  ['add a second merge call site', 'step', '  try {\n    const res = await mergeApi', "  await mergeApi.call('PUT', `/repos/${repo}/pulls/${f.number}/merge`, {}).catch(() => {});\n  try {\n    const res = await mergeApi"],
  ['N1: deferred behind check keeps ap:ready', 'step', "d = { action: 'wait', why: 'behind check deferred (request budget)', label: STATE_LABELS.waiting, stop: false };", 'd = { ...d, deferred: true };'],
  ['F1: unescaped less-than', 'pack', ".replace(/</g, '&lt;')", ''],
  ['F1: marker matched anywhere', 'pack', 'PING_RE.exec(lastLine(c.body))', '/<!-- autopilot-owner-ping head=([0-9a-f]{7,40}) -->/.exec(String(c.body))'],
  ['F1: first match wins', 'pack', 'export const packHead = (body) => (PACK_RE.exec(lastLine(body))', 'export const packHead = (body) => (/<!-- autopilot-pack head=([0-9a-f]{7,40}) -->/.exec(String(body))'],
  ['F1: marker taken from a non-bot author', 'pack', 'c.user && c.user.login === PACK_AUTHOR && (PING_RE', 'c.user && (PING_RE'],
];

describe('r4 mutants (each must turn a check red)', () => {
  it('the unmutated sources pass every check (the harness is honest)', async () => {
    expect(await mergeSurvives(SRC.merge)).toBe(true);
    expect(await packSurvives(SRC.pack)).toBe(true);
    expect(await stepSurvives(SRC.step)).toBe(true);
  }, 60000);
  for (const [name, kind, from, to] of MUTANTS) {
    it(`catches (${kind}): ${name}`, async () => {
      const src = SRC[kind];
      expect(src.includes(from)).toBe(true);
      const mutated = src.replace(from, to);
      const survives = kind === 'merge' ? await mergeSurvives(mutated) : kind === 'pack' ? await packSurvives(mutated) : await stepSurvives(mutated);
      expect(survives).toBe(false);
    }, 60000);
  }
});
