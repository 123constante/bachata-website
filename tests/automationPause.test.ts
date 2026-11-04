// Pause switch, slice 1 (docs/automation-pause.md): the fail-closed reader table, the notice
// de-duplication, the re-assert decision (A15b logic), the CLI exit codes, and drill A15 as a
// run-level test of scripts/autopilot-step.mjs (a pause set MID-RUN stops the very next merge).
import { describe, it, expect, vi } from 'vitest';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readPause, postPauseNotice, decideReassert, isAllowedPauseAuthor, PAUSE_ISSUE_AUTHOR_BOTS, PAUSE_ISSUE_TITLE, PAUSE_LABEL } from '../scripts/lib/automation-pause.mjs';
import { main as cli } from '../scripts/automation-pause.mjs';
import { run } from '../scripts/autopilot-step.mjs';
import { BOT_LOGIN, STATE_LABELS } from '../scripts/lib/autopilot.mjs';

type Item = Record<string, unknown>;
const json = (b: unknown, status = 200, headers: Record<string, string> = {}) => new Response(status === 204 ? null : typeof b === 'string' ? b : JSON.stringify(b), { status, headers });
// The repo in R is o/r, so the OWNER login is `o` (the reader's author check, fix-1361-r1).
const issue = (over: Item = {}): Item => ({ number: 9, title: PAUSE_ISSUE_TITLE, state: 'open', labels: [], user: { login: 'o' }, ...over });
/** A fake fetch serving ONE page of the issues list (or a status / a throw). Records every URL. */
function listFetch(items: unknown, { status = 200, raw = null as string | null, throwErr = null as Error | null } = {}) {
  const urls: string[] = [];
  const f = async (url: string) => {
    urls.push(url);
    if (throwErr) throw throwErr;
    return raw != null ? new Response(raw, { status }) : json(items, status);
  };
  return { f, urls };
}
const R = { repo: 'o/r', token: 't' };

describe('readPause: the fail-closed decision table', () => {
  const rows: [string, unknown, boolean, RegExp][] = [
    ['one open issue, no label -> running', [issue()], false, /^$/],
    ['label as object -> paused', [issue({ labels: [{ name: PAUSE_LABEL }] })], true, /^label$/],
    ['label as plain string -> paused', [issue({ labels: [PAUSE_LABEL] })], true, /^label$/],
    ['look-alike label automation-paused-x does not count', [issue({ labels: [{ name: 'automation-paused-x' }] })], false, /^$/],
    ['case look-alike Automation-Paused does not count', [issue({ labels: [{ name: 'Automation-Paused' }] })], false, /^$/],
    ['label on a PR with the same title does not count', [issue(), issue({ number: 10, pull_request: {}, labels: [{ name: PAUSE_LABEL }] })], false, /^$/],
    ['title is matched trimmed', [issue({ title: `  ${PAUSE_ISSUE_TITLE} ` })], false, /^$/],
    ['title is case-sensitive: lower-case title = missing', [issue({ title: PAUSE_ISSUE_TITLE.toLowerCase() })], true, /missing/],
    ['zero matching issues -> paused (missing)', [issue({ title: 'other' })], true, /pause issue missing/],
    ['empty list -> paused (missing)', [], true, /pause issue missing/],
    ['exactly one but CLOSED -> paused', [issue({ state: 'closed' })], true, /closed/],
    ['two matching -> paused (ambiguous)', [issue(), issue({ number: 11 })], true, /ambiguous/],
    ['one open + one closed matching -> ambiguous', [issue(), issue({ number: 11, state: 'closed' })], true, /ambiguous/],
    ['body not an array -> paused', { message: 'x' }, true, /not an array/],
    ['labels field missing -> paused', [{ number: 9, title: PAUSE_ISSUE_TITLE, state: 'open' }], true, /labels/],
    ['labels not an array -> paused', [issue({ labels: 'automation-paused' })], true, /labels/],
    ['a non-matching item with bad labels still fails closed', [issue(), { number: 3, title: 'x', state: 'open', labels: null }], true, /labels/],
  ];
  for (const [name, items, paused, re] of rows) {
    it(name, async () => {
      const { f } = listFetch(items);
      const r = await readPause({ ...R, fetch: f });
      expect(r.paused).toBe(paused);
      expect(r.reason).toMatch(re);
      if (!paused) expect(r.issue).toBe(9);
    });
  }
  for (const st of [401, 403, 404, 429, 500, 502]) {
    it(`HTTP ${st} -> paused, reason names it`, async () => {
      const r = await readPause({ ...R, fetch: listFetch([], { status: st }).f });
      expect(r).toMatchObject({ paused: true });
      expect(r.reason).toContain(`HTTP ${st}`);
    });
  }
  it('network throw -> paused', async () => {
    const r = await readPause({ ...R, fetch: listFetch(null, { throwErr: new Error('ECONNRESET') }).f });
    expect(r.paused).toBe(true);
    expect(r.reason).toMatch(/network.*ECONNRESET/);
  });
  it('timeout (AbortController) -> paused', async () => {
    const hang = (_u: string, init: { signal?: AbortSignal }) => new Promise<Response>((_, rej) => init.signal!.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
    const r = await readPause({ ...R, fetch: hang, timeoutMs: 20 });
    expect(r.paused).toBe(true);
    expect(r.reason).toMatch(/timeout/);
  });
  it('body not JSON -> paused', async () => {
    const r = await readPause({ ...R, fetch: listFetch(null, { raw: '<html>' }).f });
    expect(r.paused).toBe(true);
    expect(r.reason).toMatch(/not JSON/);
  });
  it('missing token -> paused, no request made', async () => {
    const { f, urls } = listFetch([issue()]);
    const r = await readPause({ repo: 'o/r', token: '', fetch: f });
    expect(r).toMatchObject({ paused: true });
    expect(r.reason).toMatch(/token/);
    expect(urls).toEqual([]);
  });
  for (const repo of ['', 'o', 'o/r/x', 'o/r; rm -rf /', '$(touch /tmp/x)/r', undefined]) {
    it(`invalid repo ${JSON.stringify(repo)} -> paused, no request`, async () => {
      const { f, urls } = listFetch([issue()]);
      const r = await readPause({ repo: repo as string, token: 't', fetch: f });
      expect(r.paused).toBe(true);
      expect(r.reason).toMatch(/repo/);
      expect(urls).toEqual([]);
    });
  }
  it('never throws: a fetch that is not a function -> paused', async () => {
    const r = await readPause({ ...R, fetch: 42 as unknown as typeof fetch });
    expect(r.paused).toBe(true);
  });
  it('one request in the normal case, with the documented query', async () => {
    const { f, urls } = listFetch([issue()]);
    await readPause({ ...R, fetch: f });
    expect(urls).toHaveLength(1);
    expect(urls[0]).toMatch(/^https:\/\/api\.github\.com\/repos\/o\/r\/issues\?state=all&per_page=100&sort=created&direction=desc$/);
  });
  it('follows Link rel=next (pages), finds the issue on page 2', async () => {
    const urls: string[] = [];
    const f = async (url: string) => {
      urls.push(url);
      if (urls.length === 1) return json([issue({ number: 1, title: 'x' })], 200, { link: '<https://api.github.com/repositories/1/issues?page=2>; rel="next", <https://api.github.com/repositories/1/issues?page=2>; rel="last"' });
      return json([issue({ number: 9 })]);
    };
    const r = await readPause({ ...R, fetch: f });
    expect(r).toEqual({ paused: false, reason: '', issue: 9 });
    expect(urls[1]).toBe('https://api.github.com/repositories/1/issues?page=2');
  });
  it('a next link off api.github.com is refused (fail closed)', async () => {
    const f = async () => json([], 200, { link: '<https://evil.example/x>; rel="next"' });
    const r = await readPause({ ...R, fetch: f });
    expect(r.paused).toBe(true);
  });
  it('stops at 5 pages; the issue on page 6 is NOT seen -> paused (missing)', async () => {
    let n = 0;
    const f = async () => { n++; return json(n === 6 ? [issue()] : [issue({ number: n, title: 'x' })], 200, { link: `<https://api.github.com/x?page=${n + 1}>; rel="next"` }); };
    const r = await readPause({ ...R, fetch: f });
    expect(n).toBe(5);
    expect(r.paused).toBe(true);
  });
  it('NO caching: two calls make two requests and see a flip', async () => {
    let paused = false;
    const urls: string[] = [];
    const f = async (u: string) => { urls.push(u); return json([issue({ labels: paused ? [{ name: PAUSE_LABEL }] : [] })]); };
    expect((await readPause({ ...R, fetch: f })).paused).toBe(false);
    paused = true;
    expect((await readPause({ ...R, fetch: f })).paused).toBe(true);
    expect(urls).toHaveLength(2);
  });
});

describe('readPause: only the owner or an allowed bot creates THE pause issue (fix-1361-r1)', () => {
  const read = async (items: unknown[]) => {
    const logs: string[] = [];
    const r = await readPause({ ...R, fetch: listFetch(items).f, log: (s: string) => logs.push(s) });
    return { r, logs };
  };
  it('a foreign-author duplicate (even labelled) is IGNORED: running, the owner issue is THE issue, and it is logged', async () => {
    const { r, logs } = await read([issue({ number: 10, user: { login: 'mallory' }, labels: [PAUSE_LABEL] }), issue()]);
    expect(r).toEqual({ paused: false, reason: '', issue: 9 });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatch(/^::warning::.*#10.*"mallory".*IGNORED$/);
  });
  it('the owner issue is still found (login compared case-insensitively)', async () => {
    expect((await read([issue({ user: { login: 'O' } })])).r).toEqual({ paused: false, reason: '', issue: 9 });
    expect((await read([issue({ labels: [PAUSE_LABEL] })])).r).toEqual({ paused: true, reason: 'label', issue: 9 });
  });
  it('the bot allow-list is EMPTY: the paused automation (kiki-claude-bot) cannot re-create an unlabelled issue and un-pause itself', async () => {
    expect(PAUSE_ISSUE_AUTHOR_BOTS).toEqual([]);
    const { r } = await read([issue({ number: 10, user: { login: 'kiki-claude-bot' } })]);
    expect(r.paused).toBe(true);
    expect(r.reason).toMatch(/missing/);
  });
  it('two OWNER issues = paused, fail closed (ambiguous)', async () => {
    const { r } = await read([issue(), issue({ number: 10 })]);
    expect(r.paused).toBe(true);
    expect(r.reason).toMatch(/ambiguous: 2/);
  });
  it('owner issue labelled + a bot-created unlabelled duplicate: still PAUSED (label), the duplicate ignored', async () => {
    const { r, logs } = await read([issue({ number: 10, user: { login: 'kiki-claude-bot' } }), issue({ labels: [PAUSE_LABEL] })]);
    expect(r).toEqual({ paused: true, reason: 'label', issue: 9 });
    expect(logs).toHaveLength(1);
  });
  it('only foreign issues -> none counts -> "missing" = paused (fail closed, never running)', async () => {
    const { r, logs } = await read([issue({ user: { login: 'mallory' } }), issue({ number: 10, user: { login: 'github-actions[bot]' } })]);
    expect(r.paused).toBe(true);
    expect(r.reason).toMatch(/missing/);
    expect(logs).toHaveLength(2);
  });
  it('an unreadable author (no user, user without login) is treated as foreign', async () => {
    const { r, logs } = await read([issue({ user: undefined }), issue({ number: 10, user: { id: 1 } }), issue({ number: 11 })]);
    expect(r).toEqual({ paused: false, reason: '', issue: 11 });
    expect(logs).toHaveLength(2);
    expect(logs.every((l) => /unreadable author/.test(l))).toBe(true);
  });
  it('a read error is still fail closed with the author check in place', async () => {
    expect((await readPause({ ...R, fetch: listFetch([issue()], { status: 502 }).f })).paused).toBe(true);
  });
  it('a logger that throws never changes the read', async () => {
    const r = await readPause({ ...R, fetch: listFetch([issue({ number: 10, user: { login: 'mallory' } }), issue()]).f, log: () => { throw new Error('x'); } });
    expect(r).toEqual({ paused: false, reason: '', issue: 9 });
  });
  it('isAllowedPauseAuthor: the owner half of owner/name only, never a substring or the repo name', () => {
    expect(isAllowedPauseAuthor('o', 'o/r')).toBe(true);
    expect(isAllowedPauseAuthor('r', 'o/r')).toBe(false);
    expect(isAllowedPauseAuthor('oo', 'o/r')).toBe(false);
    expect(isAllowedPauseAuthor('', 'o/r')).toBe(false);
    expect(isAllowedPauseAuthor(undefined, 'o/r')).toBe(false);
  });
});

describe('postPauseNotice: ONE comment per key on the pinned issue', () => {
  function noticeFetch(existing: string[]) {
    const log: { m: string; u: string; body?: string }[] = [];
    const f = async (u: string, init: { method?: string; body?: string } = {}) => {
      const m = init.method || 'GET';
      log.push({ m, u, body: init.body });
      if (m === 'GET' && /\/issues\?/.test(u)) return json([issue()]);
      if (m === 'GET' && /\/issues\/9\/comments/.test(u)) return json(existing.map((body, id) => ({ id, body })));
      if (m === 'POST' && /\/issues\/9\/comments$/.test(u)) return json({ id: 1 }, 201);
      return json({}, 500);
    };
    return { f, log };
  }
  it('posts once with the marker when the key is new', async () => {
    const { f, log } = noticeFetch(['hello']);
    const r = await postPauseNotice({ ...R, fetch: f, key: 'reassert:5', text: 'label re-added' });
    expect(r).toMatchObject({ posted: true, skipped: false });
    const post = log.filter((l) => l.m === 'POST');
    expect(post).toHaveLength(1);
    expect(JSON.parse(post[0].body!).body).toContain('<!-- automation-pause-notice key=reassert:5 -->');
  });
  it('skips when the key is already there (de-duplicated)', async () => {
    const { f, log } = noticeFetch(['x\n<!-- automation-pause-notice key=reassert:5 -->']);
    const r = await postPauseNotice({ ...R, fetch: f, key: 'reassert:5', text: 't' });
    expect(r).toMatchObject({ posted: false, skipped: true });
    expect(log.some((l) => l.m === 'POST')).toBe(false);
  });
  it('never throws; an error is returned', async () => {
    const r = await postPauseNotice({ ...R, fetch: async () => { throw new Error('boom'); }, key: 'k', text: 't' });
    expect(r.posted).toBe(false);
    expect(r.error).toBeTruthy();
  });
});

describe('decideReassert (A15b)', () => {
  const ev = (event: string, login: string, id: number, name = PAUSE_LABEL) => ({ id, event, label: { name }, actor: { login }, created_at: new Date(1e12 + id * 1000).toISOString() });
  const O = '123constante';
  const rows: [string, boolean, unknown, boolean, string?][] = [
    ['owner removed it: legitimate clear, no action', false, [ev('labeled', 'kiki-claude-bot', 1), ev('unlabeled', O, 2)], false],
    ['kiki-claude-bot removed it -> reassert', false, [ev('labeled', O, 1), ev('unlabeled', 'kiki-claude-bot', 2)], true, 'kiki-claude-bot'],
    ['github-actions[bot] removed it -> reassert', false, [ev('labeled', O, 1), ev('unlabeled', 'github-actions[bot]', 2)], true, 'github-actions[bot]'],
    ['never set: no action', false, [], false],
    ['only other labels touched: no action', false, [ev('unlabeled', 'kiki-claude-bot', 3, 'other')], false],
    ['present: no action', true, [ev('labeled', O, 1), ev('unlabeled', 'kiki-claude-bot', 2), ev('labeled', 'github-actions[bot]', 3)], false],
    ['most recent event decides (bot removed, owner re-added, owner removed)', false, [ev('unlabeled', 'kiki-claude-bot', 1), ev('labeled', O, 2), ev('unlabeled', O, 3)], false],
    ['order by created_at, not array order', false, [ev('unlabeled', 'kiki-claude-bot', 3), ev('unlabeled', O, 2)], true, 'kiki-claude-bot'],
  ];
  for (const [name, present, events, want, actor] of rows) {
    it(name, () => {
      const r = decideReassert({ labelPresent: present, events, ownerLogin: O });
      expect(r.reassert).toBe(want);
      if (actor) expect(r.actor).toBe(actor);
      expect(r.error).toBeUndefined();
    });
  }
  for (const [name, events, owner] of [
    ['events not an array', { x: 1 }, O], ['event without actor', [{ id: 1, event: 'unlabeled', label: { name: PAUSE_LABEL }, created_at: 'x' }], O],
    ['missing owner login', [ev('unlabeled', 'kiki-claude-bot', 1)], ''],
  ] as [string, unknown, string][]) {
    it(`odd input (${name}) -> no reassert WITH an error`, () => {
      const r = decideReassert({ labelPresent: false, events, ownerLogin: owner });
      expect(r.reassert).toBe(false);
      expect(r.error).toBeTruthy();
    });
  }
});

describe('CLI exit codes (scripts/automation-pause.mjs main)', () => {
  const env = { GH_TOKEN: 't', GITHUB_REPOSITORY: 'o/r' };
  const quiet = { out: () => {} };
  it('running -> 0', async () => expect(await cli([], env, { fetch: listFetch([issue()]).f, ...quiet })).toBe(0));
  it('paused (label) -> 3', async () => expect(await cli([], env, { fetch: listFetch([issue({ labels: [PAUSE_LABEL] })]).f, ...quiet })).toBe(3));
  it('read error -> 3 (never 0)', async () => expect(await cli([], env, { fetch: listFetch([], { status: 500 }).f, ...quiet })).toBe(3));
  it('no token -> 3', async () => expect(await cli([], { GITHUB_REPOSITORY: 'o/r' }, { fetch: listFetch([issue()]).f, ...quiet })).toBe(3));
  it('--info always exits 0, paused or not', async () => {
    expect(await cli(['--info'], env, { fetch: listFetch([], { status: 500 }).f, ...quiet })).toBe(0);
    expect(await cli(['--info'], env, { fetch: listFetch([issue({ labels: [PAUSE_LABEL] })]).f, ...quiet })).toBe(0);
  });
  it('unknown flag -> 3 (paused, never 0)', async () => expect(await cli(['--nope'], env, { fetch: listFetch([issue()]).f, ...quiet })).toBe(3));
  it('prints paused/reason lines and a ::notice:: when paused, and writes GITHUB_OUTPUT', async () => {
    const outFile = path.join(__dirname, `.pause-out-${process.pid}.txt`);
    writeFileSync(outFile, '');
    const lines: string[] = [];
    try {
      await cli([], { ...env, GITHUB_OUTPUT: outFile }, { fetch: listFetch([issue({ labels: [PAUSE_LABEL] })]).f, out: (s: string) => lines.push(s) });
      expect(lines).toContain('paused=true');
      expect(lines).toContain('reason=label');
      expect(lines.some((l) => l.startsWith('::notice::paused: label'))).toBe(true);
      expect(readFileSync(outFile, 'utf8')).toMatch(/^paused=true\nreason=label\n$/);
    } finally { rmSync(outFile, { force: true }); }
  });
});

// ------------------------------------------------------------------ drill A15 (run level)
const NOW = Date.parse('2026-11-04T12:00:00Z');
const MIN = 60000;
const iso = (ms: number) => new Date(ms).toISOString();
const GH_BOT = 'github-actions[bot]';
const PACKM = (h: string) => `<!-- autopilot-pack head=${h} -->`;
const ENV = { REPOS: 'o/r', GH_TOKEN: 't', BOT_TOKEN: 'b', AUTOMERGE_TOKEN: 'am', DRY_RUN: 'false', AUTOPILOT_MERGE_MODE: 'soft', RUN_URL: 'https://run/1' };
/** Three mergeable docs PRs (already ap:ready, pack current) and a main that never goes behind. */
function fakeGitHub(onMerge: () => void = () => {}) {
  const log: { m: string; p: string }[] = [];
  const sha = (n: number) => `${n}`.padEnd(40, 'a');
  const nums = [71, 72, 73];
  const pr = (n: number) => ({
    number: n, state: 'open', draft: false, user: { login: BOT_LOGIN }, created_at: iso(NOW - 86400000), changed_files: 1,
    body: 'Verified: unit green (12)\nNot verified: phone walk', labels: ['run-ci', 'review-passed', STATE_LABELS.ready].map((name) => ({ name })), mergeable_state: 'clean',
    head: { sha: sha(n), ref: `claude/f-${n}`, repo: { full_name: 'o/r' } }, base: { ref: 'main', repo: { full_name: 'o/r' } },
  });
  const fetchImpl = async (url: string, init: { method?: string } = {}) => {
    const m = init.method || 'GET';
    const u = new URL(url);
    const p = u.pathname.replace(/^\/repos\/o\/r/, '');
    const page = Number(u.searchParams.get('page') || 1);
    log.push({ m, p });
    const ok = (b: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(b), { status, headers: { 'x-ratelimit-remaining': '4000' } });
    let mm: RegExpExecArray | null;
    if (m === 'GET' && p === '') return ok({ default_branch: 'main' });
    if (m === 'GET' && p === '/commits/main') return ok({ sha: 'm'.repeat(40) });
    if (m === 'GET' && /^\/commits\/(m+|e+)\/check-runs$/.test(p)) return ok({ check_runs: [] });
    if (m === 'GET' && /^\/commits\/(m+|e+)\/status$/.test(p)) return ok({ statuses: [] });
    if (m === 'GET' && p === '/issues/events') return ok([]);
    if (m === 'GET' && p === '/issues') return ok([]);
    if (m === 'GET' && p === '/labels') return ok(Object.values(STATE_LABELS).map((name) => ({ name })));
    if (m === 'GET' && p === '/pulls') return ok(page === 1 ? nums.map(pr) : []);
    if (m === 'GET' && /^\/compare\//.test(p)) return ok({ behind_by: 0, ahead_by: 1 });
    if (m === 'GET' && (mm = /^\/commits\/([0-9a-f]{40})$/.exec(p))) return ok({ sha: mm[1], commit: { message: 'feat: x [worker-done dt_ab12]' }, parents: [] });
    if (m === 'GET' && (mm = /^\/pulls\/(\d+)$/.exec(p))) return ok(pr(Number(mm[1])));
    if (m === 'GET' && /^\/pulls\/(\d+)\/reviews$/.test(p)) return ok([]);
    if (m === 'GET' && /^\/pulls\/(\d+)\/files$/.test(p)) return ok([{ filename: 'docs/a.md' }]);
    if (m === 'GET' && /^\/commits\/[0-9a-f]{40}\/check-runs$/.test(p)) return ok({ check_runs: [{ name: 'unit-build', status: 'completed', conclusion: 'success', details_url: 'https://github.com/o/r/actions/runs/1/job/2', completed_at: iso(NOW - 10 * MIN) }] });
    if (m === 'GET' && /^\/commits\/[0-9a-f]{40}\/status$/.test(p)) return ok({ statuses: [] });
    if (m === 'GET' && p === '/actions/runs') return ok({ workflow_runs: [{ id: 1, workflow_id: 1, head_sha: u.searchParams.get('head_sha'), event: 'pull_request', created_at: iso(NOW - 30 * MIN) }] });
    if (m === 'GET' && /^\/issues\/\d+\/events$/.test(p)) return ok([
      { event: 'labeled', label: { name: 'run-ci' }, actor: { login: BOT_LOGIN }, created_at: iso(NOW - 31 * MIN) },
      { event: 'labeled', label: { name: 'review-passed' }, actor: { login: BOT_LOGIN }, created_at: iso(NOW - 5 * MIN) },
    ]);
    if (m === 'GET' && (mm = /^\/issues\/(\d+)\/comments$/.exec(p))) return ok([{ id: 300, user: { login: GH_BOT }, html_url: 'u', body: `pack\n${PACKM(sha(Number(mm[1])))}` }]);
    if (m === 'GET' && p === '/contents/vercel.json') return ok({ content: 'eyJnaXQiOiB7ImRlcGxveW1lbnRFbmFibGVkIjogeyJjbGF1ZGUvKiI6IGZhbHNlLCAibWFpbiI6IHRydWV9fX0=', encoding: 'base64' });
    if (m === 'PUT' && /^\/pulls\/\d+\/merge$/.test(p)) { onMerge(); return ok({ merged: true, sha: 'e'.repeat(40) }); }
    if (m === 'POST' || m === 'PATCH') return ok({ id: 1, number: 77, html_url: 'u', node_id: 'n' });
    if (m === 'DELETE') return ok(null, 204);
    return ok({ message: `fake: unhandled ${m} ${p}` }, 500);
  };
  const merges = () => log.filter((l) => l.m === 'PUT' && /\/merge$/.test(l.p));
  return { log, fetchImpl, merges };
}
const RUNNING = { paused: false, reason: '', issue: 1 };
const PAUSED = { paused: true, reason: 'label', issue: 1 };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RunFn = (env: any, opts: any) => Promise<number>;
async function rowsOf(fn: () => Promise<number>) {
  const out: string[] = [];
  const spy = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => { out.push(a.join(' ')); });
  let code: number;
  try { code = await fn(); } finally { spy.mockRestore(); }
  const rows = out.filter((l) => l.startsWith('{"repo"')).map((l) => JSON.parse(l));
  return { code, rows, out: out.join('\n') };
}
/** A15: the label appears right after the FIRST merge call. True when the drill PASSES. */
async function a15(runFn: RunFn) {
  let flipped = false;
  const gh = fakeGitHub(() => { flipped = true; });
  const reads: number[] = [];
  const { code, rows, out } = await rowsOf(() => runFn(ENV, { now: NOW, fetch: gh.fetchImpl, pauseReader: async () => { reads.push(gh.log.length); return flipped ? PAUSED : RUNNING; } }));
  const at = gh.log.findIndex((l) => l.m === 'PUT');
  const writesAfter = gh.log.slice(at + 1).filter((l) => l.m !== 'GET');
  const later = rows.filter((r) => r.pr !== 71);
  return code === 0 && gh.merges().length === 1 && writesAfter.length === 0 && later.length === 2 && later.every((r) => /paused/.test(r.did)) && /automation pause switch: PAUSED/i.test(out);
}

describe('drill A15: a pause set mid-run stops the NEXT merge in the same run', () => {
  it('baseline (not paused): the same fake merges all three PRs, so the drill is meaningful', async () => {
    const gh = fakeGitHub();
    const code = await run(ENV, { now: NOW, fetch: gh.fetchImpl, quiet: true, pauseReader: async () => RUNNING });
    expect(code).toBe(0);
    expect(gh.merges()).toHaveLength(3);
  });
  it('label appears after the first merge: exactly ONE merge, no write after the flip, later rows say paused, exit 0', async () => {
    expect(await a15(run)).toBe(true);
  });
  it('label present from the start: zero writes, zero merges, exit 0', async () => {
    const gh = fakeGitHub();
    const { code, rows } = await rowsOf(() => run(ENV, { now: NOW, fetch: gh.fetchImpl, pauseReader: async () => PAUSED }));
    expect(code).toBe(0);
    expect(gh.log.filter((l) => l.m !== 'GET')).toEqual([]);
    expect(rows.length).toBe(3);
    expect(rows.every((r) => /paused: label/.test(r.did))).toBe(true);
  });
  it('the read fails from the start (fail closed): zero writes', async () => {
    const gh = fakeGitHub();
    const failing = { paused: true, reason: 'HTTP 500', issue: null };
    const code = await run(ENV, { now: NOW, fetch: gh.fetchImpl, quiet: true, pauseReader: async () => failing });
    expect(code).toBe(0);
    expect(gh.log.filter((l) => l.m !== 'GET')).toEqual([]);
  });
  it('the REAL reader is the default: with no injection run() reads the pinned-issue list through opts.fetch', async () => {
    const gh = fakeGitHub();
    await run(ENV, { now: NOW, fetch: gh.fetchImpl, quiet: true });
    // The fake answers /issues with [] -> "pause issue missing" -> paused: nothing written.
    expect(gh.log.some((l) => l.m === 'GET' && l.p === '/issues')).toBe(true);
    expect(gh.merges()).toEqual([]);
    expect(gh.log.filter((l) => l.m !== 'GET')).toEqual([]);
  });
  it('the reader THROWS: treated as paused (fail closed): zero writes, zero merges, reason logged, exit 0', async () => {
    const gh = fakeGitHub();
    const { code, rows, out } = await rowsOf(() => run(ENV, { now: NOW, fetch: gh.fetchImpl, pauseReader: async () => { throw new Error('boom'); } }));
    expect(code).toBe(0);
    expect(gh.merges()).toEqual([]);
    expect(gh.log.filter((l) => l.m !== 'GET')).toEqual([]);
    expect(rows.length).toBe(3);
    expect(rows.every((r) => /paused: reader threw: boom/.test(r.did))).toBe(true);
    expect(out).toMatch(/automation pause switch: PAUSED/i);
  });
  for (const [name, bad] of [
    ['undefined', undefined], ['null', null], ['{}', {}], ['paused: "false" (string)', { paused: 'false', reason: '' }],
    ['paused: 0', { paused: 0, reason: '' }], ['paused: null', { paused: null, reason: 'x' }], ['a bare string', 'running'],
  ] as const) {
    it(`the reader returns a malformed result (${name}): treated as PAUSED, zero writes, zero merges`, async () => {
      const gh = fakeGitHub();
      const { code, out } = await rowsOf(() => run(ENV, { now: NOW, fetch: gh.fetchImpl, pauseReader: async () => bad }));
      expect(code).toBe(0);
      expect(gh.merges()).toEqual([]);
      expect(gh.log.filter((l) => l.m !== 'GET')).toEqual([]);
      expect(out).toMatch(/automation pause switch: PAUSED/i);
    });
  }
  /** The DEFAULT reader against a fake API that answers the pause query ONLY for GH_TOKEN. */
  function withPauseIssue(gh: ReturnType<typeof fakeGitHub>, labels: string[]) {
    const auths: string[] = [];
    const f = async (url: string, init: { method?: string; headers?: Record<string, string> } = {}) => {
      const u = new URL(url);
      if (u.pathname === '/repos/o/r/issues' && u.searchParams.get('state') === 'all' && u.searchParams.get('direction') === 'desc') {
        const auth = String((init.headers || {}).authorization);
        auths.push(auth);
        if (auth !== 'Bearer t') return new Response('{"message":"Bad credentials"}', { status: 401 });
        return new Response(JSON.stringify([{ number: 5, title: PAUSE_ISSUE_TITLE, state: 'open', labels: labels.map((name) => ({ name })), user: { login: 'o' } }]), { status: 200 });
      }
      return gh.fetchImpl(url, init);
    };
    return { f, auths };
  }
  it('the DEFAULT reader (no pauseReader) reads with GH_TOKEN: running issue -> the run merges all three', async () => {
    const gh = fakeGitHub();
    const w = withPauseIssue(gh, []);
    const code = await run(ENV, { now: NOW, fetch: w.f, quiet: true });
    expect(code).toBe(0);
    expect(w.auths.length).toBeGreaterThan(0);
    expect(w.auths.every((a) => a === `Bearer ${ENV.GH_TOKEN}`)).toBe(true);
    expect(gh.merges()).toHaveLength(3);
  });
  it('the DEFAULT reader sees the label: zero writes, zero merges', async () => {
    const gh = fakeGitHub();
    const w = withPauseIssue(gh, [PAUSE_LABEL]);
    const { out } = await rowsOf(() => run(ENV, { now: NOW, fetch: w.f }));
    expect(gh.merges()).toEqual([]);
    expect(gh.log.filter((l) => l.m !== 'GET')).toEqual([]);
    expect(out).toMatch(/PAUSED \(o\/r: label\)/);
  });
  it('a dry run still reads the switch and reports', async () => {
    const gh = fakeGitHub();
    const { out } = await rowsOf(() => run({ ...ENV, DRY_RUN: 'true' }, { now: NOW, fetch: gh.fetchImpl, pauseReader: async () => PAUSED }));
    expect(out).toMatch(/automation pause switch: PAUSED/i);
  });
  it('MUTANT: an autopilot that skips the re-read before a merge fails the A15 drill', async () => {
    const STEP = path.resolve(__dirname, '../scripts/autopilot-step.mjs');
    const src = readFileSync(STEP, 'utf8');
    const line = /^ *const switchWhy = await pauseCheck\(\);\n *if \(switchWhy\) return [^\n]*\n/m;
    expect(line.test(src.replace(/\r\n/g, '\n'))).toBe(true);
    const f = path.join(path.dirname(STEP), `.pause-a15-mutant-${process.pid}.mjs`);
    writeFileSync(f, src.replace(/\r\n/g, '\n').replace(line, ''));
    try {
      const m = await import(/* @vite-ignore */ pathToFileURL(f).href);
      expect(await a15(m.run)).toBe(false);
    } finally { rmSync(f, { force: true }); }
  });
});
