// Review-1370-r1 F13 + F9: the Dependabot lane's money-check CLI reads the WHOLE file list or says
// money=true. main(env, { fetch }) against a fake files API: pagination (100 then 50), a failure on
// page 2, a count that disagrees with the PR's changed_files, and the event head sha pin. Kills the
// review's surviving mutants MC01 (count check dropped), MC02 (truthy money output) and MC05 (one page).
// Doc: docs/automation-foundations.md.
import { describe, it, expect } from 'vitest';
import { main, moneyOutput } from '../scripts/automation-money-check.mjs';

const HEAD = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);
const plain = (i: number) => ({ filename: `docs/f${i}.md`, status: 'modified', additions: 1, deletions: 0, changes: 1, patch: '@@ -1 +1,2 @@\n ctx\n+a plain line' });
const range = (from: number, n: number) => Array.from({ length: n }, (_, i) => plain(from + i));

type Pages = Record<number, unknown[] | 'error'>;
function fake({ changed, pages, head = HEAD }: { changed: number; pages: Pages; head?: string }) {
  const asked: number[] = [];
  const fetchImpl = async (url: string) => {
    const u = new URL(url);
    if (/\/pulls\/5$/.test(u.pathname)) return new Response(JSON.stringify({ changed_files: changed, head: { sha: head } }), { status: 200 });
    if (/\/pulls\/5\/files$/.test(u.pathname)) {
      const p = Number(u.searchParams.get('page'));
      asked.push(p);
      const b = pages[p] ?? [];
      return b === 'error' ? new Response('{}', { status: 502 }) : new Response(JSON.stringify(b), { status: 200 });
    }
    return new Response('{}', { status: 404 });
  };
  return { fetchImpl, asked };
}
async function runCli(f: ReturnType<typeof fake>, env: Record<string, string> = { HEAD_SHA: HEAD }) {
  const outputs: string[] = [];
  const code = await main({ GH_TOKEN: 't', REPO: 'o/r', PR_NUMBER: '5', ...env }, { fetch: f.fetchImpl, writeOutput: (l: string) => outputs.push(l), out: () => {}, err: () => {} });
  const get = (k: string) => (outputs.find((l) => l.startsWith(`${k}=`)) || '').slice(k.length + 1);
  return { code, outputs, money: get('money'), reason: get('money_reason'), guard: get('guard') };
}

describe('automation-money-check CLI: the file list must be read in full (F13)', () => {
  it('150 files over two pages (100 then 50): money=false only after BOTH pages are read (MC05)', async () => {
    const f = fake({ changed: 150, pages: { 1: range(0, 100), 2: range(100, 50) } });
    const r = await runCli(f);
    expect(r.code).toBe(0);
    expect(f.asked).toEqual([1, 2]);
    expect(r.money).toBe('false');
    expect(r.guard).toBe('false');
  });
  it('a money name on PAGE 2 is found (the second page is scanned, not just counted)', async () => {
    const hit = { ...plain(149), patch: '@@ -1 +1,2 @@\n ctx\n+calls my_tickets_v1' };
    const r = await runCli(fake({ changed: 150, pages: { 1: range(0, 100), 2: [...range(100, 49), hit] } }));
    expect(r.money).toBe('true');
    expect(r.reason).toBe('money set: my_tickets_v1');
  });
  it('100 then an error on page 2: money=true, unreadable, guard=true', async () => {
    const r = await runCli(fake({ changed: 150, pages: { 1: range(0, 100), 2: 'error' } }));
    expect(r.code).toBe(0);
    expect(r.money).toBe('true');
    expect(r.reason).toMatch(/^money set: unreadable \(GET \/repos\/o\/r\/pulls\/5\/files -> HTTP 502\)$/);
    expect(r.guard).toBe('true');
  });
  it('a count that disagrees with changed_files (151 said, 150 read): money=true, file list incomplete (MC01)', async () => {
    const r = await runCli(fake({ changed: 151, pages: { 1: range(0, 100), 2: range(100, 50) } }));
    expect(r.money).toBe('true');
    expect(r.reason).toBe('money set: unreadable (file list incomplete (150 read, PR says 151))');
    expect(r.guard).toBe('true');
  });
  it('changed_files missing from the PR: money=true', async () => {
    const r = await runCli(fake({ changed: undefined as unknown as number, pages: { 1: range(0, 2) } }));
    expect(r.money).toBe('true');
    expect(r.reason).toMatch(/^money set: unreadable \(file list incomplete/);
  });
});

describe('moneyOutput: only an explicit false is money=false (MC02)', () => {
  it.each([
    ['false', { money: false }, 'money=false'],
    ['true', { money: true }, 'money=true'],
    ['undefined', {}, 'money=true'],
    ['null', { money: null }, 'money=true'],
    ['0', { money: 0 }, 'money=true'],
    ['the string false', { money: 'false' }, 'money=true'],
  ])('%s', (_n, v, line) => expect(moneyOutput(v)).toBe(line));
});

describe('automation-money-check CLI: the event head sha is pinned (F9)', () => {
  it('the PR head moved since the event: money=true, guard=true, reason names both shas', async () => {
    const r = await runCli(fake({ changed: 1, pages: { 1: range(0, 1) }, head: OTHER }));
    expect(r.code).toBe(0);
    expect(r.money).toBe('true');
    expect(r.reason).toBe(`money set: unreadable (PR head moved: event ${HEAD.slice(0, 12)}, now ${OTHER.slice(0, 12)})`);
    expect(r.guard).toBe('true');
  });
  it('the same head: the normal verdict', async () => {
    expect((await runCli(fake({ changed: 1, pages: { 1: range(0, 1) } }))).money).toBe('false');
  });
  it.each([['missing', {}], ['not 40 hex', { HEAD_SHA: 'abc' }]])('HEAD_SHA %s: exit 2, money=true, no API call', async (_n, env) => {
    const f = fake({ changed: 1, pages: { 1: range(0, 1) } });
    let calls = 0;
    const counting = { ...f, fetchImpl: async (u: string) => { calls++; return f.fetchImpl(u); } };
    const r = await runCli(counting, env as Record<string, string>);
    expect(r.code).toBe(2);
    expect(r.money).toBe('true');
    expect(calls).toBe(0);
  });
});
