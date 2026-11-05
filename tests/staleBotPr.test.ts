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
  createdAt: ago(10), lastActivity: ago(5), title: 'feat: x', headSubject: 'feat: x', changedFiles: 3, ...o,
});
const zero = (o = {}) => pr({ changedFiles: 0, ...o });
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
  const fixed = src.replace("'./autopilot.mjs'", `'${abs('autopilot.mjs')}'`).replace("'./autopilot-merge.mjs'", `'${abs('autopilot-merge.mjs')}'`);
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
  function fake(open: object[], fail: (u: string, m: string) => boolean = () => false) {
    const calls: string[] = [];
    const f = async (url: string, init: { method: string }) => {
      calls.push(`${init.method} ${url.replace('https://api.github.com', '')}`);
      if (fail(url, init.method)) return { ok: false, status: 500, json: async () => ({}) };
      let body: unknown = [];
      if (/pulls\?state=open/.test(url)) body = open;
      else if (/pulls\/\d+$/.test(url) && init.method === 'GET') body = { changed_files: 0 };
      else if (/\/commits/.test(url)) body = [{ commit: { message: 'x', committer: { date: ago(10) } } }];
      return { ok: true, status: 200, json: async () => body };
    };
    return { f, calls };
  }
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
});

// ------------------------------------------------------------ workflow structure
const WFP = path.resolve(__dirname, '../.github/workflows/stale-bot-pr-sweep.yml');
function wfProblems(text: string): string[] {
  const out: string[] = [];
  const wf = parse(text);
  const on = wf.on ?? wf[true as unknown as string];
  if (!on?.schedule?.length) out.push('no schedule');
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
  return out;
}
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
});
