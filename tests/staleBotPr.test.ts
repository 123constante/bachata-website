// Stale-bot-PR sweep: decide() table, the per-run cap, mutants of the real lib, and the workflow
// structure (pause reader first, sweep gated on it). Brief: branch brief/bot-pr-skip-review-done.
import { describe, it, expect, afterAll } from 'vitest';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse, stringify } from 'yaml';
import * as real from '../scripts/lib/stale-bot-pr.mjs';
import { BOT_LOGIN, OWNER_LOGIN, HANDS_OFF_LABELS, STATE_LABELS } from '../scripts/lib/autopilot.mjs';
import { RESERVED_LABELS } from '../scripts/lib/autopilot-merge.mjs';
import { run } from '../scripts/sweep-stale-bot-prs.mjs';

type Lib = typeof real;
const DAY = 86400000;
const NOW = Date.parse('2026-11-04T12:00:00Z');
const ago = (d: number) => new Date(NOW - d * DAY).toISOString();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pr = (o: Record<string, any> = {}) => ({
  number: 10, author: BOT_LOGIN, headRef: 'claude/feat-x', labels: [] as string[], draft: false,
  createdAt: ago(10), lastActivity: ago(5), title: 'feat: x', headSubject: 'feat: x', changedFiles: 3,
  files: ['docs/x.md', 'tests/x.test.ts', 'public/x.png'] as string[] | null | undefined, approvedAtHead: false, ...o,
});
const zero = (o = {}) => pr({ changedFiles: 0, files: [], ...o });
const later = (ticket: string, state = 'open', n = 20, created = ago(4), headRef = 'claude/other') => ({ others: [{ number: n, createdAt: created, state, keys: [ticket], headRef }] });

/** [name, pr, ctx, close, reason fragment] */
const ROWS = (lib: Lib): [string, ReturnType<typeof pr>, object, boolean, RegExp][] => [
  ['non-bot author', zero({ author: 'someone' }), {}, false, /author/],
  ['owner author', zero({ author: OWNER_LOGIN }), {}, false, /author/],
  ...lib.PROTECTED_LABELS.map((l) => [`protected ${l}`, zero({ labels: [l] }), {}, false, /protected/] as [string, ReturnType<typeof pr>, object, boolean, RegExp]),
  ...[...RESERVED_LABELS, ...HANDS_OFF_LABELS, STATE_LABELS.running].map((l) => [`reserved/hands-off ${l}`, zero({ labels: [l] }), {}, false, /protected/] as [string, ReturnType<typeof pr>, object, boolean, RegExp]),
  ['just under 3 days', zero({ lastActivity: ago(3 - 1 / 24) }), {}, false, /active/],
  ['exactly 3 days', zero({ lastActivity: ago(3) }), {}, false, /active/],
  ['just over 3 days', zero({ lastActivity: ago(3 + 1 / 24) }), {}, true, /zero changed/],
  ['superseded by a later open PR', pr({ headRef: 'claude/feat-x' }), later('feat-x'), true, /superseded.*#20/],
  ['superseded by a later merged PR (worker-done ticket)', pr({ title: 'x [worker-done dt_abc1]' }), later('dt_abc1', 'merged', 21), true, /merged PR #21/],
  ['NOT superseded: only an earlier PR', pr(), later('feat-x', 'open', 5, ago(20)), false, /no close rule/],
  ['NOT superseded: later PR is closed unmerged', pr(), later('feat-x', 'closed'), false, /no close rule/],
  ['chore: already on main', pr({ headSubject: 'Chore: x Already On Main' }), {}, true, /already on main/],
  ['zero files', zero(), {}, true, /zero changed/],
  ['fresh, no rule', pr({ lastActivity: ago(1) }), {}, false, /active/],
  ['stale, no rule', pr(), {}, false, /no close rule/],
  ['non-claude head', zero({ headRef: 'ccr-abc' }), {}, false, /not claude/],
  ['review report branch is sweepable', zero({ headRef: 'claude/review-1362-r1' }), {}, true, /zero changed/],
  ['draft', zero({ draft: true }), {}, false, /draft/],
  ['a later REVIEW report never supersedes the work PR', pr(), later('feat-x', 'open', 20, ago(4), 'claude/review-feat-x'), false, /no close rule/],
  ['a later DONE marker never supersedes the work PR', pr(), later('feat-x', 'open', 20, ago(4), 'claude/done-feat-x'), false, /no close rule/],
  ['an older review report IS superseded by a later report', pr({ headRef: 'claude/review-feat-x-r1' }), later('feat-x', 'open', 20, ago(4), 'claude/review-feat-x-r2'), true, /#20/],
  ['worker-done key in the head subject meets a later PR known by branch stem', pr({ headRef: 'claude/a', headSubject: 'x [worker-done dt_ab12]' }), later('dt_ab12'), true, /dt_ab12.*#20/],
  // fix-1368-r1: an owner Approve at the current head, or any hard-tier path, is never closed.
  ['owner Approve at head, superseded', pr({ approvedAtHead: true }), later('feat-x'), false, /approved at head/],
  ['owner Approve at head, zero files', zero({ approvedAtHead: true }), {}, false, /approved at head/],
  ['hard-tier scripts/ path, superseded', pr({ files: ['docs/a.md', 'scripts/lib/x.mjs'] }), later('feat-x'), false, /hard-tier.*scripts\/lib\/x\.mjs/],
  ['hard-tier .github/ path, already on main', pr({ files: ['.github/workflows/x.yml'], headSubject: 'chore: x already on main' }), {}, false, /hard-tier/],
  ['hard-tier package.json, superseded', pr({ files: ['package.json'] }), later('feat-x'), false, /hard-tier/],
  ['hard-tier src/ (review-scope isRiskyPath, as the merge lane), superseded', pr({ files: ['docs/a.md', 'src/pages/X.tsx'] }), later('feat-x'), false, /hard-tier.*src\/pages\/X\.tsx/],
  ['file list not read (null) fails closed', pr({ files: null }), later('feat-x'), false, /hard-tier.*not read/],
  ['file list not read (undefined) fails closed', zero({ files: undefined }), {}, false, /hard-tier.*not read/],
  ['L5: chore: not at the start of the subject', pr({ headSubject: 'feat: chore: x already on main' }), {}, false, /no close rule/],
  ['L6/R7: changed_files missing is not zero', pr({ changedFiles: undefined, files: [] }), {}, false, /no close rule/],
];

/** Problems the lib shows against the table + cap. Empty = correct. */
function libProblems(lib: Lib): string[] {
  const out: string[] = [];
  if (JSON.stringify([...lib.PROTECTED_LABELS]) !== JSON.stringify(['automerge-ok', 'ap:hold', 'owner-reserved'])) out.push('PROTECTED_LABELS');
  if (lib.MAX_CLOSES !== 5 || lib.STALE_DAYS !== 3) out.push('constants');
  for (const [name, p, ctx, close, re] of ROWS(real)) {
    const d = lib.decide(p, ctx, NOW);
    if (d.close !== close || !re.test(d.reason)) out.push(`${name}: ${JSON.stringify(d)}`);
  }
  const eight = Array.from({ length: 8 }, (_, i) => zero({ number: 100 + i, createdAt: ago(30 - ((i * 3) % 8)) }));
  const closed = lib.plan(eight, {}, NOW).toClose.map((d: { pr: { number: number } }) => d.pr.number).sort();
  const oldest5 = [...eight].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)).slice(0, 5).map((p) => p.number).sort();
  if (JSON.stringify(closed) !== JSON.stringify(oldest5)) out.push(`cap: ${closed} != ${oldest5}`);
  return out;
}

describe('decide() table', () => {
  for (const [name, p, ctx, close, re] of ROWS(real)) {
    it(name, () => {
      const d = real.decide(p, ctx, NOW);
      expect(d.close).toBe(close);
      expect(d.reason).toMatch(re);
    });
  }
  it('8 candidates: only 5 close, and they are the oldest 5', () => expect(libProblems(real)).toEqual([]));
  it('never closes a PR as superseded by one the same run closes (the ticket keeps a survivor)', () => {
    const a = pr({ number: 1, headRef: 'claude/feat-x', createdAt: ago(10) });
    const b = zero({ number: 2, headRef: 'claude/feat-x-r2', createdAt: ago(8) });
    const ctx = { others: [{ number: 2, createdAt: b.createdAt, state: 'open', keys: real.ticketKeys(b), headRef: b.headRef }] };
    const { toClose, decisions } = real.plan([a, b], ctx, NOW);
    expect(toClose.map((d: { pr: { number: number } }) => d.pr.number)).toEqual([2]);
    expect(decisions.find((d: { pr: { number: number } }) => d.pr.number === 1)!.reason).toMatch(/superseder #2/);
  });
});

// ------------------------------------------------------------ mutants of the real lib
const LIB = path.resolve(__dirname, '../scripts/lib/stale-bot-pr.mjs');
const SRC = readFileSync(LIB, 'utf8');
const TMP = mkdtempSync(path.join(tmpdir(), 'stale-bot-pr-'));
afterAll(() => rmSync(TMP, { recursive: true, force: true }));
async function load(src: string, tag: string): Promise<Lib> {
  const abs = (f: string) => pathToFileURL(path.resolve(path.dirname(LIB), f)).href;
  const fixed = ['autopilot.mjs', 'autopilot-merge.mjs', 'autopilot-pack.mjs', 'review-scope.mjs'].reduce((s, f) => s.replace(`'./${f}'`, `'${abs(f)}'`), src);
  const f = path.join(TMP, `${tag}.mjs`);
  writeFileSync(f, fixed);
  return import(/* @vite-ignore */ pathToFileURL(f).href);
}
const MUTANTS: [string, string, string][] = [
  ['drop the author check', "if (pr.author !== BOT_LOGIN) return", 'if (false) return'],
  ['drop one protected label', "'automerge-ok', 'ap:hold', 'owner-reserved'", "'automerge-ok', 'owner-reserved'"],
  ['> becomes >= at the 3-day edge', '!(ageDays > STALE_DAYS)', '!(ageDays >= STALE_DAYS)'],
  ['lift the cap to 6', 'MAX_CLOSES = 5', 'MAX_CLOSES = 6'],
  ['invert supersede order', 'ms(o.createdAt) > mine', 'ms(o.createdAt) < mine'],
  ['let a report supersede work', '.filter((o) => isReport || ', '.filter((o) => true || '],
  ['drop the hands-off labels', ', ...HANDS_OFF_LABELS, STATE_LABELS.running]', ']'],
  ['drop the owner-Approve-at-head check', 'if (pr.approvedAtHead) return', 'if (false) return'],
  ['drop the hard-tier check', 'if (hard.length) return', 'if (false) return'],
  ['L5: loosen the ^chore: anchor', '/^chore: .*already on main/i', '/chore: .*already on main/i'],
  ['L6: a missing changed_files reads as zero', 'pr.changedFiles === 0', '!pr.changedFiles'],
];
describe('MUTANTS of scripts/lib/stale-bot-pr.mjs fail the table', () => {
  it('the unmutated copy passes (the loader is sound)', async () => expect(libProblems(await load(SRC, 'm0'))).toEqual([]));
  MUTANTS.forEach(([name, from, to], i) => {
    it(name, async () => {
      expect(SRC).toContain(from);
      expect(libProblems(await load(SRC.replace(from, to), `m${i + 1}`))).not.toEqual([]);
    });
  });
  it('a lifted cap is also caught with exactly 6 candidates', async () => {
    const m = await load(SRC.replace('MAX_CLOSES = 5', 'MAX_CLOSES = 6'), 'cap6');
    const six = Array.from({ length: 6 }, (_, i) => zero({ number: i, createdAt: ago(20 - i) }));
    expect(m.plan(six, {}, NOW).toClose.length).toBe(6);
    expect(real.plan(six, {}, NOW).toClose.length).toBe(5);
  });
});

// ------------------------------------------------------------ runner (fake fetch, no network)
describe('sweep runner', () => {
  const row = (n: number, o = {}) => ({ number: n, user: { login: BOT_LOGIN }, head: { ref: `claude/w-${n}` }, labels: [], draft: false, created_at: ago(20 - n), updated_at: ago(10), title: `w ${n}`, ...o });
  /** route(url, method) may return a body to override the default for that call (undefined = default). */
  function fake(open: object[] | ((url: string) => object[]), fail: (u: string, m: string) => boolean = () => false, route: (u: string, m: string) => unknown = () => undefined) {
    const calls: string[] = [];
    const f = async (url: string, init: { method: string }) => {
      calls.push(`${init.method} ${url.replace('https://api.github.com', '')}`);
      if (fail(url, init.method)) return { ok: false, status: 500, json: async () => ({}) };
      let body: unknown = route(url, init.method);
      if (body === undefined) {
        body = [];
        if (/pulls\?state=open/.test(url)) body = typeof open === 'function' ? open(url) : open;
        else if (/pulls\/\d+$/.test(url) && init.method === 'GET') body = { changed_files: 0, head: { sha: 'h1' } };
        else if (/\/commits/.test(url)) body = [{ commit: { message: 'x', committer: { date: ago(10) } } }];
      }
      return { ok: true, status: 200, json: async () => body };
    };
    return { f, calls };
  }
  const writes = (calls: string[]) => calls.filter((c) => !c.startsWith('GET'));
  const env = { GH_TOKEN: 't', GITHUB_REPOSITORY: 'o/r' };
  const quiet = () => {};
  it('dry-run by default: no POST or PATCH', async () => {
    const { f, calls } = fake([row(1), row(2)]);
    expect(await run({ env, argv: [], fetch: f, now: NOW, log: quiet })).toBe(0);
    expect(calls.filter((c) => !c.startsWith('GET'))).toEqual([]);
  });
  it('--apply: comment then close, at most 5, oldest first; never a non-bot PR; never a branch delete', async () => {
    const open = [...Array.from({ length: 7 }, (_, i) => row(i + 1)), row(50, { user: { login: OWNER_LOGIN } })];
    const { f, calls } = fake(open);
    expect(await run({ env, argv: ['--apply'], fetch: f, now: NOW, log: quiet })).toBe(0);
    const writes = calls.filter((c) => !c.startsWith('GET'));
    expect(writes).toEqual([1, 2, 3, 4, 5].flatMap((n) => [`POST /repos/o/r/issues/${n}/comments`, `PATCH /repos/o/r/pulls/${n}`]));
    expect(calls.some((c) => /\/50\b/.test(c))).toBe(false);
    expect(calls.some((c) => /git\/refs|DELETE/.test(c))).toBe(false);
  });
  it('a listing error exits 2 and closes nothing', async () => {
    const { f, calls } = fake([row(1)], (u) => /state=open/.test(u));
    expect(await run({ env, argv: ['--apply'], fetch: f, now: NOW, log: quiet })).toBe(2);
    expect(calls.filter((c) => !c.startsWith('GET'))).toEqual([]);
  });
  it('an API error on one PR skips that PR only', async () => {
    const { f, calls } = fake([row(1), row(2)], (u, m) => m === 'GET' && /pulls\/1$/.test(u));
    expect(await run({ env, argv: ['--apply'], fetch: f, now: NOW, log: quiet })).toBe(0);
    expect(calls.filter((c) => c.startsWith('PATCH'))).toEqual(['PATCH /repos/o/r/pulls/2']);
  });
  it('a failed close takes its "Closed by" comment back and deletes no branch', async () => {
    const { f, calls } = fake([row(1)], (u, m) => m === 'PATCH');
    const f2 = async (url: string, init: { method: string }) => (init.method === 'POST' ? (calls.push(`POST ${url}`), { ok: true, status: 201, json: async () => ({ id: 77 }) }) : f(url, init));
    expect(await run({ env, argv: ['--apply'], fetch: f2, now: NOW, log: quiet })).toBe(0);
    expect(calls.filter((c) => !c.startsWith('GET')).map((c) => c.replace('https://api.github.com', ''))).toEqual(['POST /repos/o/r/issues/1/comments', 'PATCH /repos/o/r/pulls/1', 'DELETE /repos/o/r/issues/comments/77']);
  });
  it('missing token exits 2', async () => expect(await run({ env: {}, argv: [], fetch: fake([]).f, now: NOW, log: quiet })).toBe(2));
  // ---- fix-1368-r1 survivor rows
  it('R9: missing GITHUB_REPOSITORY exits 2 and makes no call', async () => {
    const { f, calls } = fake([row(1)]);
    expect(await run({ env: { GH_TOKEN: 't' }, argv: ['--apply'], fetch: f, now: NOW, log: quiet })).toBe(2);
    expect(calls).toEqual([]);
  });
  it('R3: a failed CLOSED-list read exits 2 and closes nothing (fail closed)', async () => {
    const { f, calls } = fake([row(1)], (u) => /state=closed/.test(u));
    expect(await run({ env, argv: ['--apply'], fetch: f, now: NOW, log: quiet })).toBe(2);
    expect(calls.some((c) => /state=closed/.test(c))).toBe(true);
    expect(writes(calls)).toEqual([]);
  });
  const someone = (n: number) => row(n, { user: { login: 'someone' } });
  it('R2: the open list is paginated past 100 rows (a candidate on page 2 is seen)', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => someone(1000 + i));
    const { f, calls } = fake((u) => (/[?&]page=1\b/.test(u) ? page1 : /[?&]page=2\b/.test(u) ? [row(1)] : []));
    expect(await run({ env, argv: ['--apply'], fetch: f, now: NOW, log: quiet })).toBe(0);
    expect(calls).toContain('GET /repos/o/r/pulls?state=open&per_page=100&page=2');
    expect(writes(calls)).toEqual(['POST /repos/o/r/issues/1/comments', 'PATCH /repos/o/r/pulls/1']);
  });
  it('R5: the open list stops at its 10-page cap', async () => {
    const full = Array.from({ length: 100 }, (_, i) => someone(1000 + i));
    const { f, calls } = fake(() => full);
    expect(await run({ env, argv: ['--apply'], fetch: f, now: NOW, log: quiet })).toBe(0);
    expect(calls.filter((c) => /state=open/.test(c)).length).toBe(10);
    expect(calls.some((c) => /state=open.*page=11\b/.test(c))).toBe(false);
  });
  it('R6: a recent COMMENT is last activity (kept although updated_at is old)', async () => {
    const { f, calls } = fake([row(1)], undefined, (u) => (/issues\/1\/comments/.test(u) ? [{ created_at: ago(1) }] : undefined));
    expect(await run({ env, argv: ['--apply'], fetch: f, now: NOW, log: quiet })).toBe(0);
    expect(writes(calls)).toEqual([]);
  });
  it('R6: a recent COMMIT is last activity (kept although updated_at is old)', async () => {
    const { f, calls } = fake([row(1)], undefined, (u) => (/pulls\/1\/commits/.test(u) ? [{ commit: { message: 'x', committer: { date: ago(1) } } }] : undefined));
    expect(await run({ env, argv: ['--apply'], fetch: f, now: NOW, log: quiet })).toBe(0);
    expect(writes(calls)).toEqual([]);
  });
  it('R7: a detail with no changed_files field is not closed as zero files', async () => {
    const { f, calls } = fake([row(1)], undefined, (u, m) => (m === 'GET' && /pulls\/1$/.test(u) ? { head: { sha: 'h1' } } : undefined));
    expect(await run({ env, argv: ['--apply'], fetch: f, now: NOW, log: quiet })).toBe(0);
    expect(writes(calls)).toEqual([]);
  });
  const reviewsFor = (rv: object[]) => (u: string) => (/pulls\/1\/reviews/.test(u) ? rv : undefined);
  it('owner Approve at the CURRENT head: never closed', async () => {
    const { f, calls } = fake([row(1)], undefined, reviewsFor([{ state: 'APPROVED', commit_id: 'h1', user: { login: OWNER_LOGIN } }]));
    expect(await run({ env, argv: ['--apply'], fetch: f, now: NOW, log: quiet })).toBe(0);
    expect(calls).toContain('GET /repos/o/r/pulls/1/reviews?per_page=100&page=1');
    expect(writes(calls)).toEqual([]);
  });
  it('an owner Approve at an OLDER head, or a non-owner Approve at head, does not protect', async () => {
    for (const rv of [{ state: 'APPROVED', commit_id: 'old', user: { login: OWNER_LOGIN } }, { state: 'APPROVED', commit_id: 'h1', user: { login: 'someone' } }, { state: 'COMMENTED', commit_id: 'h1', user: { login: OWNER_LOGIN } }]) {
      const { f, calls } = fake([row(1)], undefined, reviewsFor([rv]));
      expect(await run({ env, argv: ['--apply'], fetch: f, now: NOW, log: quiet })).toBe(0);
      expect(writes(calls)).toEqual(['POST /repos/o/r/issues/1/comments', 'PATCH /repos/o/r/pulls/1']);
    }
  });
  it('a hard-tier path in the PR file list: never closed', async () => {
    const { f, calls } = fake([row(1)], undefined, (u, m) => (/pulls\/1\/files/.test(u) ? [{ filename: '.github/workflows/x.yml' }] : m === 'GET' && /pulls\/1$/.test(u) ? { changed_files: 1, head: { sha: 'h1' } } : undefined));
    expect(await run({ env, argv: ['--apply'], fetch: f, now: NOW, log: quiet })).toBe(0);
    expect(writes(calls)).toEqual([]);
  });
  it('a rename OUT of a hard-tier path (previous_filename) is still hard-tier: never closed', async () => {
    // "already on main" head subject makes the PR closable, so only the hard-tier rule can keep it.
    const route = (old: string) => (u: string, m: string) =>
      /pulls\/1\/files/.test(u) ? [{ filename: 'docs/x.md', previous_filename: old, status: 'renamed' }]
        : /pulls\/1\/commits/.test(u) ? [{ commit: { message: 'chore: x already on main', committer: { date: ago(10) } } }]
          : m === 'GET' && /pulls\/1$/.test(u) ? { changed_files: 1, head: { sha: 'h1' } } : undefined;
    const hard = fake([row(1)], undefined, route('.github/workflows/x.yml'));
    expect(await run({ env, argv: ['--apply'], fetch: hard.f, now: NOW, log: quiet })).toBe(0);
    expect(writes(hard.calls)).toEqual([]);
    // control: a rename between docs paths closes
    const soft = fake([row(1)], undefined, route('docs/old.md'));
    expect(await run({ env, argv: ['--apply'], fetch: soft.f, now: NOW, log: quiet })).toBe(0);
    expect(writes(soft.calls)).toHaveLength(2);
  });
  it('a file list that disagrees with changed_files (truncated or inconsistent) fails closed', async () => {
    const { f, calls } = fake([row(1)], undefined, (u, m) => (m === 'GET' && /pulls\/1$/.test(u) ? { changed_files: 0, head: { sha: 'h1' } } : /pulls\/1\/files/.test(u) ? [] : undefined));
    // control: consistent (0 files, 0 listed) closes
    expect(await run({ env, argv: ['--apply'], fetch: f, now: NOW, log: quiet })).toBe(0);
    expect(writes(calls)).toHaveLength(2);
    const t = fake([row(1)], undefined, (u, m) => (m === 'GET' && /pulls\/1$/.test(u) ? { changed_files: 0, head: { sha: 'h1' } } : /pulls\/1\/files/.test(u) ? [{ filename: 'docs/a.md' }] : undefined));
    // 1 listed but 0 counted is inconsistent too: not trusted
    expect(await run({ env, argv: ['--apply'], fetch: t.f, now: NOW, log: quiet })).toBe(0);
    expect(writes(t.calls)).toEqual([]);
  });
});

// ------------------------------------------------------------ workflow structure
const WFP = path.resolve(__dirname, '../.github/workflows/stale-bot-pr-sweep.yml');
function wfProblems(text: string): string[] {
  const out: string[] = [];
  const wf = parse(text);
  const on = wf.on ?? wf[true as unknown as string];
  if (!on?.schedule?.length) out.push('no schedule');
  // S3: the trigger set is EXACTLY {schedule, workflow_dispatch} (a pull_request_target would run on PR events).
  if (JSON.stringify(Object.keys(on || {}).sort()) !== JSON.stringify(['schedule', 'workflow_dispatch'])) out.push(`triggers ${Object.keys(on || {})}`);
  // Manual runs are DRY by default: one boolean input `apply`, default false.
  const inputs = on?.workflow_dispatch?.inputs;
  if (JSON.stringify(Object.keys(inputs || {})) !== '["apply"]' || inputs.apply?.type !== 'boolean' || inputs.apply?.default !== false) out.push('dispatch input apply');
  if (JSON.stringify(wf.permissions) !== JSON.stringify({ contents: 'read', issues: 'read', 'pull-requests': 'write' })) out.push('permissions');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const steps: any[] = wf.jobs?.sweep?.steps || [];
  const co = steps.findIndex((s) => /^actions\/checkout@/.test(String(s.uses || '')));
  const rd = steps.findIndex((s) => /node scripts\/automation-pause\.mjs/.test(String(s.run || '')));
  const sw = steps.findIndex((s) => /sweep-stale-bot-prs\.mjs/.test(String(s.run || '')));
  if (co < 0 || steps[co].with?.ref !== 'main') out.push('checkout ref is not main');
  if (rd < 0) out.push('no pause reader');
  if (sw < 0) out.push('no sweep step');
  if (rd >= 0 && (rd < co || sw < rd)) out.push('order: checkout, reader, sweep');
  if (rd >= 0 && sw >= 0 && !new RegExp(`steps\\.${steps[rd].id}\\.outputs\\.paused == 'false'`).test(String(steps[sw].if || ''))) out.push('sweep not gated on the reader');
  if (rd >= 0 && steps[rd].env?.GH_TOKEN !== '${{ github.token }}') out.push('reader token');
  if (sw >= 0 && steps[sw].env?.GH_TOKEN !== '${{ secrets.BOT_PR_TOKEN }}') out.push('sweep token');
  // --apply only when the schedule fires or the manual run ticked apply; otherwise the dry-run line.
  if (sw >= 0 && steps[sw].env?.SWEEP_APPLY !== "${{ github.event_name == 'schedule' || inputs.apply == true }}") out.push('SWEEP_APPLY expression');
  if (sw >= 0 && String(steps[sw].run || '').trim() !== SWEEP_RUN) out.push('sweep run line');
  return out;
}
const SWEEP_RUN = 'if [ "$SWEEP_APPLY" = "true" ]; then node scripts/sweep-stale-bot-prs.mjs --apply; else node scripts/sweep-stale-bot-prs.mjs; fi';
describe('stale-bot-pr-sweep.yml', () => {
  const raw = readFileSync(WFP, 'utf8');
  it('structure', () => expect(wfProblems(raw)).toEqual([]));
  it('MUTANT: skip the pause step -> red', () => {
    const wf = parse(raw);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wf.jobs.sweep.steps = wf.jobs.sweep.steps.filter((s: any) => !/automation-pause/.test(String(s.run || '')));
    expect(wfProblems(stringify(wf))).not.toEqual([]);
  });
  it('MUTANT: ungated sweep -> red', () => {
    const wf = parse(raw);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete wf.jobs.sweep.steps.find((s: any) => /sweep-stale/.test(String(s.run || ''))).if;
    expect(wfProblems(stringify(wf))).not.toEqual([]);
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mutate = (fn: (wf: any) => void) => { const wf = parse(raw); fn(wf); return wfProblems(stringify(wf)); };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sweepStep = (wf: any) => wf.jobs.sweep.steps.find((s: any) => /sweep-stale/.test(String(s.run || '')));
  it('S3 MUTANT: add pull_request_target -> red', () => expect(mutate((wf) => { wf.on.pull_request_target = { types: ['opened'] }; })).toContain('triggers schedule,workflow_dispatch,pull_request_target'));
  it('MUTANT: add push -> red', () => expect(mutate((wf) => { wf.on.push = { branches: ['main'] }; })).not.toEqual([]));
  it('MUTANT: manual run defaults to apply -> red', () => expect(mutate((wf) => { wf.on.workflow_dispatch.inputs.apply.default = true; })).toContain('dispatch input apply'));
  it('MUTANT: drop the apply input -> red', () => expect(mutate((wf) => { wf.on.workflow_dispatch = null; })).not.toEqual([]));
  it('MUTANT: --apply hardcoded again -> red', () => expect(mutate((wf) => { sweepStep(wf).run = 'node scripts/sweep-stale-bot-prs.mjs --apply'; })).toContain('sweep run line'));
  it('MUTANT: SWEEP_APPLY always true -> red', () => expect(mutate((wf) => { sweepStep(wf).env.SWEEP_APPLY = 'true'; })).toContain('SWEEP_APPLY expression'));
});
