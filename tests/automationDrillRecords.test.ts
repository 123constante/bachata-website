// Foundations-web PART 6: components.json, component_sha, the drill-record checker (drill A32)
// and the write-drill-record helper. Fakes only: no live API call, no live issue.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { componentSha, lsTreeArgs, componentShaFromGit } from '../scripts/lib/component-sha.mjs';
import { parseComponents, verifyRecords, main as checkMain, DRILL_ISSUE_TITLE, DRILL_ACTOR } from '../scripts/check-drill-records.mjs';
import { buildRecord, postDrillRecord, main as writeMain } from '../scripts/write-drill-record.mjs';

const ROOT = path.resolve(__dirname, '..');
const COMPONENTS_TEXT = readFileSync(path.join(ROOT, '.github/automation/components.json'), 'utf8');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const quiet = () => {
  const lines: string[] = [];
  return { lines, log: { log: (s: string) => lines.push(String(s)), error: (s: string) => lines.push(String(s)) } };
};

describe('components.json', () => {
  const c = parseComponents(COMPONENTS_TEXT);
  it('parses; names exactly the ten contract components', () => {
    expect(c.ok).toBe(true);
    expect(Object.keys(c.components.components).sort()).toEqual(['apply', 'approver', 'canary', 'merge-lane', 'notifier', 'pause-readers', 'queue', 'revert', 'sql-classifier', 'walk-gate']);
  });
  it('only merge-lane and pause-readers are built here; the rest are paths:[] / not built', () => {
    for (const [name, v] of Object.entries(c.components.components) as [string, Any][]) {
      if (name === 'merge-lane' || name === 'pause-readers') {
        expect(v.status).toBe('built');
        expect(v.paths.length).toBeGreaterThan(0);
      } else {
        expect(v).toMatchObject({ paths: [], status: 'not built' });
      }
    }
  });
  it('merge-lane lists the lane, its four new libs and their checked-in files', () => {
    const p = c.components.components['merge-lane'].paths;
    for (const x of ['scripts/lib/autopilot-merge.mjs', 'scripts/autopilot-step.mjs', 'scripts/lib/required-jobs.mjs', 'scripts/lib/is-money.mjs', 'scripts/lib/guard-paths.mjs', 'scripts/lib/arming.mjs']) expect(p).toContain(x);
  });
  it('pause-readers lists the slice-1 reader code', () => {
    const p = c.components.components['pause-readers'].paths;
    for (const x of ['scripts/lib/automation-pause.mjs', 'scripts/automation-pause.mjs', '.github/workflows/automation-pause-guard.yml']) expect(p).toContain(x);
  });
  it('paths are literal (git ls-tree does not expand globs): a glob character is refused', () => {
    const bad = JSON.parse(COMPONENTS_TEXT);
    bad.components['merge-lane'].paths.push('scripts/lib/autopilot*');
    expect(parseComponents(JSON.stringify(bad)).ok).toBe(false);
  });
  it('fails closed on bad JSON, a built component with no paths, an unknown status', () => {
    expect(parseComponents('{').ok).toBe(false);
    const a = JSON.parse(COMPONENTS_TEXT);
    a.components['merge-lane'].paths = [];
    expect(parseComponents(JSON.stringify(a)).ok).toBe(false);
    const b = JSON.parse(COMPONENTS_TEXT);
    b.components.queue.status = 'maybe';
    expect(parseComponents(JSON.stringify(b)).ok).toBe(false);
  });
});

describe('component-sha', () => {
  it('componentSha = sha256 hex of the exact ls-tree text', () => {
    const t = '100644 blob abc\tscripts/a.mjs\n';
    expect(componentSha(['scripts/a.mjs'], t)).toBe(createHash('sha256').update(t).digest('hex'));
    expect(componentSha(['scripts/a.mjs'], t + ' ')).not.toBe(componentSha(['scripts/a.mjs'], t));
  });
  it('one fixed invocation: sorted, de-duplicated path specs after --', () => {
    expect(lsTreeArgs(['b', 'a', 'b'])).toEqual(['ls-tree', '-r', 'main', '--', 'a', 'b']);
    expect(lsTreeArgs(['x'], 'abc123')).toEqual(['ls-tree', '-r', 'abc123', '--', 'x']);
  });
  it('an empty path set is refused (git ls-tree with no path lists the WHOLE tree)', () => {
    expect(() => lsTreeArgs([])).toThrow();
    expect(() => componentSha([], '')).toThrow();
  });
  it('componentShaFromGit shells out with execFile-style args (no shell) and hashes the output', () => {
    const calls: Any[] = [];
    const git = (args: string[]) => { calls.push(args); return 'OUT'; };
    expect(componentShaFromGit(['z', 'a'], { git })).toBe(createHash('sha256').update('OUT').digest('hex'));
    expect(calls).toEqual([['ls-tree', '-r', 'main', '--', 'a', 'z']]);
  });
  it('the real tree: the pause-readers sha is a stable 64-hex value', () => {
    const p = parseComponents(COMPONENTS_TEXT).components.components['pause-readers'].paths;
    const a = componentShaFromGit(p, { ref: 'HEAD' });
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(componentShaFromGit([...p].reverse(), { ref: 'HEAD' })).toBe(a);
  });
});

// A fixture world for the checker.
const SHA_ML = 'a'.repeat(64);
const SHA_PR = 'b'.repeat(64);
const HEAD = 'c'.repeat(40);
const components = () => ({
  version: 1,
  components: {
    'merge-lane': { paths: ['scripts/lib/autopilot-merge.mjs'], status: 'built', drills: { A17: 'Drill A17' } },
    'pause-readers': { paths: ['scripts/lib/automation-pause.mjs'], status: 'built', drills: { A15: 'Drill A15' } },
    ...Object.fromEntries(['approver', 'sql-classifier', 'queue', 'apply', 'notifier', 'canary', 'revert', 'walk-gate'].map((n) => [n, { paths: [], status: 'not built' }])),
  },
});
const record = (over: Any = {}) => ({
  drill: 'A17', component: 'merge-lane', component_sha: SHA_ML, date: '2026-11-04', pass: true,
  actors: ['github-actions[bot]'], run_url: 'https://github.com/o/r/actions/runs/101', run_id: 101, head_sha: HEAD, ...over,
});
let nextId = 1;
const comment = (body: Any, login = 'github-actions[bot]') => ({ id: nextId++, user: { login }, body: typeof body === 'string' ? body : JSON.stringify(body), created_at: '2026-11-04T10:00:00Z' });
const RUNS: Record<string, Any> = {
  101: { id: 101, name: 'Drill A17', conclusion: 'success', head_sha: HEAD, html_url: 'https://github.com/o/r/actions/runs/101' },
  102: { id: 102, name: 'Drill A15', conclusion: 'success', head_sha: HEAD, html_url: 'https://github.com/o/r/actions/runs/102' },
  103: { id: 103, name: 'Drill A17', conclusion: 'failure', head_sha: HEAD, html_url: 'https://github.com/o/r/actions/runs/103' },
  104: { id: 104, name: 'Some other workflow', conclusion: 'success', head_sha: HEAD, html_url: 'https://github.com/o/r/actions/runs/104' },
  105: { id: 105, name: 'Drill A17', conclusion: 'success', head_sha: 'd'.repeat(40), html_url: 'https://github.com/o/r/actions/runs/105' },
};
const fetchRun = async (id: Any) => {
  const r = RUNS[String(id)];
  if (!r) throw new Error('HTTP 404 on GET /actions/runs/' + id);
  return r;
};
const currentSha = (name: string) => ({ 'merge-lane': SHA_ML, 'pause-readers': SHA_PR }[name]);
const verify = (comments: Any[]) => verifyRecords({ comments, components: components(), currentSha, fetchRun });
const both = () => [comment(record()), comment(record({ drill: 'A15', component: 'pause-readers', component_sha: SHA_PR, run_id: 102, run_url: 'https://github.com/o/r/actions/runs/102' }))];

describe('verifyRecords (drill A32)', () => {
  it('a real record for every built component drill = accepted, nothing refused, nothing missing', async () => {
    const v = await verify(both());
    expect(v.refusals).toEqual([]);
    expect(v.missing).toEqual([]);
    expect(v.accepted.length).toBe(2);
  });
  it('A32: a forged comment with no real run is refused', async () => {
    const v = await verify([comment(record({ run_id: 999, run_url: 'https://github.com/o/r/actions/runs/999' }))]);
    expect(v.refusals.some((r: string) => /run 999 cannot be re-verified/.test(r))).toBe(true);
  });
  it('A32: a record whose component_sha is stale is refused', async () => {
    const v = await verify([comment(record({ component_sha: 'e'.repeat(64) }))]);
    expect(v.refusals.some((r: string) => /component_sha is stale/.test(r))).toBe(true);
  });
  it('a record by any author other than the drill workflow actor is refused (forged)', async () => {
    const v = await verify([comment(record(), 'kiki-claude-bot')]);
    expect(v.refusals.some((r: string) => /author kiki-claude-bot is not github-actions\[bot\]/.test(r))).toBe(true);
  });
  it('pass:false, a run that did not succeed, a run of another workflow, a different head sha: each refused', async () => {
    const r1 = await verify([comment(record({ pass: false }))]);
    expect(r1.refusals.some((r: string) => /pass is not true/.test(r))).toBe(true);
    const r2 = await verify([comment(record({ run_id: 103, run_url: RUNS[103].html_url }))]);
    expect(r2.refusals.some((r: string) => /conclusion failure/.test(r))).toBe(true);
    const r3 = await verify([comment(record({ run_id: 104, run_url: RUNS[104].html_url }))]);
    expect(r3.refusals.some((r: string) => /workflow "Some other workflow" is not "Drill A17"/.test(r))).toBe(true);
    const r4 = await verify([comment(record({ run_id: 105, run_url: RUNS[105].html_url }))]);
    expect(r4.refusals.some((r: string) => /head_sha/.test(r))).toBe(true);
  });
  it('missing fields, non-JSON-object body, unknown component, not-built component, unknown drill: each refused', async () => {
    const r = record();
    delete (r as Any).actors;
    expect((await verify([comment(r)])).refusals.some((x: string) => /missing field actors/.test(x))).toBe(true);
    expect((await verify([comment(record({ component: 'nope' }))])).refusals.some((x: string) => /unknown component nope/.test(x))).toBe(true);
    expect((await verify([comment(record({ component: 'queue' }))])).refusals.some((x: string) => /component queue is not built/.test(x))).toBe(true);
    expect((await verify([comment(record({ drill: 'A99' }))])).refusals.some((x: string) => /drill A99 is not listed for merge-lane/.test(x))).toBe(true);
    expect((await verify([comment('{"drill": ')])).refusals.length).toBe(0);
  });
  it('ordinary (non-JSON) comments are notes, not records; a JSON-looking comment that does not parse is not a record either', async () => {
    const v = await verify([comment('Pinned for drill records; do not edit.'), ...both()]);
    expect(v.refusals).toEqual([]);
    expect(v.notes.length).toBe(1);
  });
  it('a fenced ```json body is read the same as a raw one', async () => {
    const v = await verify([comment('```json\n' + JSON.stringify(record()) + '\n```')]);
    expect(v.accepted.length).toBe(1);
  });
  it('the LATEST record per (component, drill) decides; an older stale one is superseded, not refused', async () => {
    const v = await verify([comment(record({ component_sha: 'e'.repeat(64) })), ...both()]);
    expect(v.refusals).toEqual([]);
    expect(v.superseded.length).toBe(1);
  });
  it('a built component drill with no record is reported missing', async () => {
    const v = await verify([comment(record())]);
    expect(v.missing).toEqual(['pause-readers/A15']);
  });
});

describe('check-drill-records main(): exit codes', () => {
  const deps = (comments: Any[], extra: Any = {}) => ({ comments, componentsText: JSON.stringify(components()), currentSha, fetchRun, ...extra });
  it('all good = 0; a refusal = 1; missing = 0 by default, 1 with --require-all', async () => {
    expect(await checkMain([], {}, quiet().log, deps(both()))).toBe(0);
    expect(await checkMain([], {}, quiet().log, deps([comment(record({ run_id: 999 }))]))).toBe(1);
    expect(await checkMain([], {}, quiet().log, deps([comment(record())]))).toBe(0);
    expect(await checkMain(['--require-all'], {}, quiet().log, deps([comment(record())]))).toBe(1);
  });
  it('one line per refusal', async () => {
    const q = quiet();
    await checkMain([], {}, q.log, deps([comment(record({ run_id: 999 })), comment(record({ drill: 'A15', component: 'pause-readers', component_sha: 'f'.repeat(64), run_id: 102 }))]));
    expect(q.lines.filter((l) => /^REFUSED /.test(l)).length).toBe(2);
  });
  it('no comments source (no --comments, no token) = exit 2; unreadable components = 2', async () => {
    expect(await checkMain([], {}, quiet().log, { componentsText: JSON.stringify(components()) })).toBe(2);
    expect(await checkMain([], {}, quiet().log, deps(both(), { componentsText: '{' }))).toBe(2);
  });
  it('fetches the issue by title and its comments with GITHUB_TOKEN when no file is given (fake fetch)', async () => {
    const urls: string[] = [];
    const f = async (u: string) => {
      urls.push(u);
      if (/\/issues\?/.test(u)) return new Response(JSON.stringify([{ number: 7, title: DRILL_ISSUE_TITLE, state: 'open', labels: [], user: { login: 'o' } }]), { status: 200 });
      if (/\/issues\/7\/comments/.test(u)) return new Response(JSON.stringify(both()), { status: 200 });
      return new Response('{}', { status: 404 });
    };
    const code = await checkMain([], { GH_TOKEN: 't', GITHUB_REPOSITORY: 'o/r' }, quiet().log, { fetch: f, componentsText: JSON.stringify(components()), currentSha, fetchRun });
    expect(code).toBe(0);
    expect(urls.every((u) => u.startsWith('https://api.github.com/repos/o/r/'))).toBe(true);
  });
  it('--components-only validates the real components.json offline (the lint-chain link) = 0', async () => {
    expect(await checkMain(['--components-only'], {}, quiet().log)).toBe(0);
  });
  it('--self-test passes', async () => {
    expect(await checkMain(['--self-test'], {}, quiet().log)).toBe(0);
  });
  it('the drill actor constant is github-actions[bot]', () => expect(DRILL_ACTOR).toBe('github-actions[bot]'));
});

describe('write-drill-record (helper for later drill workflows; fake fetch, never live)', () => {
  it('buildRecord carries exactly the contract fields plus head_sha', () => {
    const r = buildRecord({ drill: 'A17', component: 'merge-lane', componentSha: SHA_ML, pass: true, actors: ['github-actions[bot]'], runUrl: 'https://github.com/o/r/actions/runs/1', runId: 1, headSha: HEAD, date: '2026-11-04' });
    expect(Object.keys(r).sort()).toEqual(['actors', 'component', 'component_sha', 'date', 'drill', 'head_sha', 'pass', 'run_id', 'run_url']);
    expect(() => buildRecord({ ...r, drill: '' } as Any)).toThrow();
  });
  it('posts ONE comment with the JSON body on the issue titled DRILL RECORDS', async () => {
    const calls: Any[] = [];
    const f = async (u: string, init: Any) => {
      calls.push({ u, method: init.method, body: init.body });
      if (/\/issues\?/.test(u)) return new Response(JSON.stringify([{ number: 3, title: DRILL_ISSUE_TITLE, state: 'open', labels: [] }]), { status: 200 });
      return new Response('{"id":1}', { status: 201 });
    };
    const rec = record();
    const res = await postDrillRecord({ repo: 'o/r', token: 't', fetch: f, record: rec });
    expect(res.posted).toBe(true);
    const post = calls.filter((c) => c.method === 'POST');
    expect(post.length).toBe(1);
    expect(post[0].u).toBe('https://api.github.com/repos/o/r/issues/3/comments');
    expect(JSON.parse(JSON.parse(post[0].body).body)).toEqual(rec);
  });
  it('no issue / two issues = not posted, with the reason', async () => {
    const mk = (items: Any[]) => async (u: string) => (/\/issues\?/.test(u) ? new Response(JSON.stringify(items), { status: 200 }) : new Response('{}', { status: 201 }));
    expect((await postDrillRecord({ repo: 'o/r', token: 't', fetch: mk([]), record: record() })).error).toMatch(/not unique \(0\)/);
    const two = [{ number: 1, title: DRILL_ISSUE_TITLE, labels: [] }, { number: 2, title: DRILL_ISSUE_TITLE, labels: [] }];
    expect((await postDrillRecord({ repo: 'o/r', token: 't', fetch: mk(two), record: record() })).error).toMatch(/not unique \(2\)/);
  });
  it('the CLI builds the record from the Actions env and exits 0 when posted, 2 when not', async () => {
    const posted: Any[] = [];
    const env = { GH_TOKEN: 't', GITHUB_REPOSITORY: 'o/r', GITHUB_RUN_ID: '101', GITHUB_SERVER_URL: 'https://github.com', GITHUB_SHA: HEAD, GITHUB_ACTOR: 'github-actions[bot]' };
    const ok = await writeMain(['--drill', 'A17', '--component', 'merge-lane', '--pass', 'true'], env, quiet().log, { post: async (a: Any) => { posted.push(a.record); return { posted: true, error: null }; }, sha: () => SHA_ML, today: '2026-11-04' });
    expect(ok).toBe(0);
    expect(posted[0]).toMatchObject({ drill: 'A17', component: 'merge-lane', component_sha: SHA_ML, run_id: 101, run_url: 'https://github.com/o/r/actions/runs/101', head_sha: HEAD, pass: true });
    expect(await writeMain(['--drill', 'A17', '--component', 'merge-lane', '--pass', 'true'], env, quiet().log, { post: async () => ({ posted: false, error: 'x' }), sha: () => SHA_ML, today: '2026-11-04' })).toBe(2);
    expect(await writeMain(['--drill', 'A17'], env, quiet().log, { post: async () => ({ posted: true }), sha: () => SHA_ML })).toBe(2);
  });
  it('--self-test passes', async () => {
    expect(await writeMain(['--self-test'], {}, quiet().log)).toBe(0);
  });
});
