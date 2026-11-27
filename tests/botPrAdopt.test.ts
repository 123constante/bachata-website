// scripts/lib/bot-pr-adopt.mjs: bot-pr.yml replaces an OWNER-authored open PR on a claude/**
// branch with a bot-authored copy (P125, P138). A fake GitHub keeps the state in memory.
import { describe, it, expect } from 'vitest';
// @ts-expect-error plain .mjs module
import { adopt, makeApi } from '../scripts/lib/bot-pr-adopt.mjs';

const REPO = 'o/r';
const OWNER = 'o';
type Pr = Record<string, any>;

function fake(opts: { open?: Pr[]; closed?: Pr[]; failOn?: RegExp; failCreateOnce?: boolean } = {}) {
  const calls: string[] = [];
  const bodies: Record<string, any> = {};
  let created = 0;
  const api = async (method: string, p: string, body?: any) => {
    const key = `${method} ${p}`;
    calls.push(key);
    bodies[key] = body;
    if (opts.failOn?.test(key)) throw new Error(`${key} -> HTTP 500`);
    if (method === 'GET' && p.includes('state=open')) return opts.open ?? [];
    if (method === 'GET' && p.includes('state=closed')) return opts.closed ?? [];
    if (method === 'POST' && p === `/repos/${REPO}/pulls`) {
      if (opts.failCreateOnce && !created++) throw new Error('POST pulls -> HTTP 422');
      return { number: 99, user: { login: 'bot' } };
    }
    return {};
  };
  return { api, calls, bodies };
}
const run = (f: ReturnType<typeof fake>) => {
  const warns: string[] = [];
  const p = adopt({ api: f.api, repo: REPO, owner: OWNER, branch: 'claude/x', base: 'main', warn: (m: string) => warns.push(m) });
  return { p, warns };
};
const ownerPr = (extra: Pr = {}): Pr => ({
  number: 5, user: { login: OWNER }, draft: false, title: 'T', body: 'B',
  base: { ref: 'main' }, head: { repo: { full_name: REPO } }, labels: [{ name: 'automerge-ok' }], ...extra,
});

describe('bot-pr-adopt', () => {
  it('no open PR, none merged -> open', async () => {
    expect(await run(fake()).p).toBe('open');
  });

  it('open PR by the bot -> skip, nothing written', async () => {
    const f = fake({ open: [ownerPr({ user: { login: 'bot' } })] });
    expect(await run(f).p).toBe('skip');
    expect(f.calls.every((c) => c.startsWith('GET'))).toBe(true);
  });

  it('owner PR -> closed, same title/head/base/body reopened as bot, labels copied, comment', async () => {
    const f = fake({ open: [ownerPr()] });
    expect(await run(f).p).toBe('skip');
    expect(f.calls.filter((c) => !c.startsWith('GET'))).toEqual([
      `PATCH /repos/${REPO}/pulls/5`,
      `POST /repos/${REPO}/pulls`,
      `POST /repos/${REPO}/issues/99/labels`,
      `POST /repos/${REPO}/issues/5/comments`,
    ]);
    expect(f.bodies[`PATCH /repos/${REPO}/pulls/5`]).toEqual({ state: 'closed' });
    expect(f.bodies[`POST /repos/${REPO}/pulls`]).toEqual({ title: 'T', head: 'claude/x', base: 'main', body: 'B' });
    expect(f.bodies[`POST /repos/${REPO}/issues/99/labels`]).toEqual({ labels: ['automerge-ok'] });
    expect(f.bodies[`POST /repos/${REPO}/issues/5/comments`]).toEqual({ body: 'Replaced by #99' });
  });

  it('branch already merged -> skip + warning', async () => {
    const f = fake({ closed: [{ number: 3, merged_at: '2026-01-01' }] });
    const { p, warns } = run(f);
    expect(await p).toBe('skip');
    expect(warns[0]).toMatch(/already shipped in #3/);
  });

  it('closed but unmerged PR does not block opening', async () => {
    expect(await run(fake({ closed: [{ number: 3, merged_at: null }] })).p).toBe('open');
  });

  it('API error listing -> rejects, nothing closed', async () => {
    const f = fake({ failOn: /^GET/ });
    await expect(run(f).p).rejects.toThrow(/HTTP 500/);
    expect(f.calls.some((c) => c.startsWith('PATCH'))).toBe(false);
  });

  it('create fails -> old PR reopened, error surfaces', async () => {
    const f = fake({ open: [ownerPr()], failCreateOnce: true });
    await expect(run(f).p).rejects.toThrow(/422/);
    const patches = f.calls.filter((c) => c.startsWith('PATCH'));
    expect(patches).toHaveLength(2);
    expect(f.bodies[`PATCH /repos/${REPO}/pulls/5`]).toEqual({ state: 'open' });
  });

  it('draft owner PR -> skip + warning, untouched', async () => {
    const f = fake({ open: [ownerPr({ draft: true })] });
    const { p, warns } = run(f);
    expect(await p).toBe('skip');
    expect(warns[0]).toMatch(/DRAFT/);
    expect(f.calls.every((c) => c.startsWith('GET'))).toBe(true);
  });

  it('fork head -> skip + warning, untouched', async () => {
    const f = fake({ open: [ownerPr({ head: { repo: { full_name: 'x/r' } } })] });
    const { p, warns } = run(f);
    expect(await p).toBe('skip');
    expect(warns[0]).toMatch(/fork/);
    expect(f.calls.every((c) => c.startsWith('GET'))).toBe(true);
  });

  it('more than one open PR -> skip + warning, nothing written', async () => {
    const f = fake({ open: [ownerPr(), ownerPr({ number: 6 })] });
    const r = run(f);
    expect(await r.p).toBe('skip');
    expect(r.warns[0]).toMatch(/2 open PRs/);
    expect(f.calls.some((c) => c.startsWith('PATCH') || c.startsWith('POST'))).toBe(false);
  });

  it('owner login compare is case-insensitive', async () => {
    const f = fake({ open: [ownerPr({ user: { login: 'O' } })] });
    expect(await run(f).p).toBe('skip');
    expect(f.calls.some((c) => c === `PATCH /repos/${REPO}/pulls/5`)).toBe(true);
  });

  it('label copy fails after reopen -> error names the old labels', async () => {
    const f = fake({ open: [ownerPr()], failOn: /issues\/99\/labels/ });
    await expect(run(f).p).rejects.toThrow(/automerge-ok/);
  });

  it('makeApi throws on non-2xx', async () => {
    const api = makeApi('t', (async () => ({ ok: false, status: 403, text: async () => 'no' })) as any);
    await expect(api('GET', '/x')).rejects.toThrow(/HTTP 403/);
  });
});
