// Pause switch, drill A15b: a bot cannot remove the `automation-paused` label. The guard workflow
// re-asserts it with a notice; no workflow or script contains code that removes it or deletes the
// pinned issue; PR-controlled text never reaches a shell. Line-ending agnostic (as read + CRLF).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, type Dirent } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { main as cli } from '../scripts/automation-pause.mjs';
import { PAUSE_ISSUE_TITLE, PAUSE_LABEL } from '../scripts/lib/automation-pause.mjs';

const ROOT = path.resolve(__dirname, '..');
const GUARD = path.join(ROOT, '.github/workflows/automation-pause-guard.yml');
const RAW = readFileSync(GUARD, 'utf8');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Step = Record<string, any>;
/**
 * A tiny evaluator for the `if:` subset this workflow uses: always(), ==, !=, &&, ||, parens,
 * 'single-quoted' strings and github.* / steps.* paths (a missing path is null, as in Actions).
 */
function evalIf(expr: unknown, ctx: Record<string, unknown>): boolean {
  const src = String(expr).trim().replace(/^\$\{\{([\s\S]*)\}\}$/, '$1');
  const strings: string[] = [];
  let js = src.replace(/'([^']*)'/g, (_m, s: string) => { strings.push(s); return `__S${strings.length - 1}__`; });
  if (/[^\w\s.()&|=!-]/.test(js)) throw new Error(`evalIf: unsupported syntax in ${src}`);
  js = js.replace(/\balways\(\)/g, 'true')
    .replace(/\b(github|steps)(\.[\w-]+)+/g, (m) => {
      let v: unknown = ctx;
      for (const k of m.split('.')) v = v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined;
      return v === undefined ? 'null' : JSON.stringify(v);
    })
    .replace(/!=/g, '!==').replace(/([^!=])==/g, '$1===')
    .replace(/__S(\d+)__/g, (_m, i: string) => JSON.stringify(strings[Number(i)]));
  return Boolean(new Function(`return (${js});`)());
}

for (const [eol, text] of [['as read', RAW], ['CRLF', RAW.replace(/\r?\n/g, '\r\n')]] as const) {
  describe(`automation-pause-guard.yml (${eol})`, () => {
    const wf = parse(text);
    const on = wf.on ?? wf[true as unknown as string];
    it('triggers: issues labeled/unlabeled, every 30 minutes, workflow_dispatch; nothing PR-shaped', () => {
      expect(on.issues.types).toEqual(['labeled', 'unlabeled']);
      expect(on.schedule).toEqual([{ cron: '*/30 * * * *' }]);
      expect('workflow_dispatch' in on).toBe(true);
      expect(Object.keys(on).sort()).toEqual(['issues', 'schedule', 'workflow_dispatch']);
    });
    it('permissions exactly contents:read, issues:write, pull-requests:write; no job widens them', () => {
      expect(wf.permissions).toEqual({ contents: 'read', issues: 'write', 'pull-requests': 'write' });
      for (const j of Object.values(wf.jobs) as Step[]) expect(j.permissions).toBeUndefined();
    });
    it('guard job runs the CLI --guard on GitHub-hosted runners from a main checkout without credentials', () => {
      const g = wf.jobs.guard;
      // Exact expression, title check included: the evaluator rows below cannot see every weakening
      // (e.g. `|| github.event.action == 'unlabeled'` survived them -- fix-1361-r2).
      expect(String(g.if).trim()).toBe(`github.event_name != 'issues' || github.event.issue.title == '${PAUSE_ISSUE_TITLE}'`);
      expect(g['runs-on']).toBe('ubuntu-latest');
      const co = g.steps.find((s: Step) => /^actions\/checkout@/.test(String(s.uses || '')));
      expect(co.with).toEqual({ ref: 'main', 'persist-credentials': false });
      const r = g.steps.find((s: Step) => /automation-pause\.mjs/.test(String(s.run || '')));
      expect(String(r.run).trim()).toBe('node scripts/automation-pause.mjs --guard');
      expect(r.env.GH_TOKEN).toBe('${{ github.token }}');
    });
    it('disarm job: issues/labeled with the pause label (or the schedule), compared in if:, disables auto-merge on open PRs', () => {
      const d = wf.jobs.disarm;
      expect(d['runs-on']).toBe('ubuntu-latest');
      const cond = String(d.if).replace(/\s+/g, ' ');
      expect(cond).toContain("github.event_name == 'issues'");
      expect(cond).toContain("github.event.action == 'labeled'");
      expect(cond).toContain(`github.event.label.name == '${PAUSE_LABEL}'`);
      expect(cond).toContain(`github.event.issue.title == '${PAUSE_ISSUE_TITLE}'`);
      const run = d.steps.map((s: Step) => String(s.run || '')).join('\n');
      expect(run).toMatch(/gh pr list --state open[^\n]*--json number,autoMergeRequest/);
      expect(run).toMatch(/gh pr merge --disable-auto "\$n"/);
      expect(run).not.toMatch(/gh pr merge (--auto|--squash|--merge|--rebase)/);
    });
    it('disarm runs AFTER the guard (needs: guard, always()) so a label it re-asserted is seen; the scheduled read is --info from main', () => {
      const d = wf.jobs.disarm;
      expect(d.needs).toBe('guard');
      expect(String(d.if)).toMatch(/^always\(\) && \(/);
      const read = d.steps.find((s: Step) => s.id === 'pause');
      expect(String(read.run).trim()).toBe('node scripts/automation-pause.mjs --info');
    });
    // fix-1361-r1: a pause set with GITHUB_TOKEN fires no `issues` workflow, so the 30-minute
    // scheduled run must disarm too. Evaluates the REAL if: expressions over event x label state.
    // reason = what `automation-pause.mjs --info` writes to GITHUB_OUTPUT ('label' = label present,
    // '' = running, anything else = fail-closed doubt; 'NO OUTPUT' = the step wrote nothing).
    const ISSUE = (action: string, label: string, title = PAUSE_ISSUE_TITLE) => ({ event_name: 'issues', event: { action, label: { name: label }, issue: { title } } });
    const SCHED = { event_name: 'schedule', event: {} };
    const TABLE: [string, Record<string, unknown>, string | null, boolean, boolean, boolean][] = [
      // name, github, --info reason (null = step skipped), guard job, disarm job, disable step
      ['issues labeled with the pause label', ISSUE('labeled', PAUSE_LABEL), null, true, true, true],
      ['issues labeled, another label', ISSUE('labeled', 'bug'), null, true, false, false],
      ['issues labeled, another issue', ISSUE('labeled', PAUSE_LABEL, 'other'), null, false, false, false],
      ['issues unlabeled (the pause label)', ISSUE('unlabeled', PAUSE_LABEL), null, true, false, false],
      ['schedule, label PRESENT (e.g. set with GITHUB_TOKEN)', SCHED, 'label', true, true, true],
      ['schedule, label absent (running)', SCHED, '', true, true, false],
      ['schedule, issue closed without label (fail closed)', SCHED, 'pause issue #9 is closed', true, true, true],
      ['schedule, read error (fail closed)', SCHED, 'HTTP 500 on GET /repos/o/r/issues', true, true, true],
      ['schedule, the read step wrote no output (fail closed)', SCHED, 'NO OUTPUT', true, true, true],
      ['workflow_dispatch', { event_name: 'workflow_dispatch', event: {} }, null, true, false, false],
    ];
    for (const [name, github, reason, guardRuns, disarmRuns, disableRuns] of TABLE) {
      it(`event x label: ${name} -> guard ${guardRuns}, disarm job ${disarmRuns}, disable step ${disableRuns}`, () => {
        const d = wf.jobs.disarm;
        const steps: Record<string, unknown> = {};
        const ran: Record<string, boolean> = {};
        const ctx = () => ({ github, steps });
        expect(evalIf(wf.jobs.guard.if, ctx())).toBe(guardRuns);
        const jobRuns = evalIf(d.if, ctx());
        expect(jobRuns).toBe(disarmRuns);
        if (!jobRuns) return;
        for (const s of d.steps as Step[]) {
          const label = String(s.name || s.uses);
          ran[label] = s.if === undefined ? true : evalIf(s.if, ctx());
          if (s.id === 'pause') {
            expect(ran[label]).toBe(reason !== null);
            if (ran[label] && reason !== 'NO OUTPUT') steps.pause = { outputs: { paused: reason === '' ? 'false' : 'true', reason } };
          }
        }
        expect(ran['Disable auto-merge on every open PR']).toBe(disableRuns);
      });
    }
    it('CANARY: the evaluator is not vacuous (a disarm if: without the schedule clause fails the PRESENT row)', () => {
      const cut = String(wf.jobs.disarm.if).replace(/\|\|\s*github\.event_name == 'schedule'/, '');
      expect(cut).not.toBe(String(wf.jobs.disarm.if));
      expect(evalIf(cut, { github: SCHED, steps: {} })).toBe(false);
      expect(evalIf("steps.pause.outputs.paused != 'false'", { github: SCHED, steps: {} })).toBe(true);
      expect(evalIf("steps.pause.outputs.paused != 'false'", { github: SCHED, steps: { pause: { outputs: { paused: 'false' } } } })).toBe(false);
      expect(evalIf("github.event_name != 'issues'", { github: SCHED, steps: {} })).toBe(true);
    });
    it('no PR code is ever checked out; no ${{ }} expression inside any run: text', () => {
      for (const j of Object.values(wf.jobs) as Step[]) for (const s of j.steps) {
        if (/^actions\/checkout@/.test(String(s.uses || ''))) expect(s.with.ref).toBe('main');
        if (s.run) expect(String(s.run)).not.toMatch(/\$\{\{/);
      }
    });
  });
}

describe('inert PR/issue text: hostile titles, branches and bodies stay data', () => {
  const HOSTILE = ['$(touch /tmp/x)', '`touch /tmp/x`', '"; rm -rf / #', "'; rm -rf / #", 'a\nb\r\nc', '${{ github.token }}'];
  it('the guard workflow never interpolates event text into run:, only env/if', () => {
    const wf = parse(RAW);
    for (const j of Object.values(wf.jobs) as Step[]) for (const s of j.steps) {
      const r = String(s.run || '');
      expect(r).not.toMatch(/github\.event\.(issue|pull_request|label|comment)/);
    }
  });
  it('the CLI path treats hostile titles/labels/comment bodies as data (no exec, exact match only)', async () => {
    for (const h of HOSTILE) {
      const urls: string[] = [];
      const lines: string[] = [];
      const items = [
        { number: 9, title: PAUSE_ISSUE_TITLE, state: 'open', labels: [{ name: h }], user: { login: 'o' } },
        { number: 10, title: h, state: 'open', labels: [{ name: PAUSE_LABEL }], body: h },
        { number: 11, title: `${PAUSE_ISSUE_TITLE}${h}`, state: 'open', labels: [], pull_request: { head: { ref: h } } },
      ];
      const f = async (u: string) => { urls.push(u); return new Response(JSON.stringify(items), { status: 200 }); };
      const code = await cli([], { GH_TOKEN: 't', GITHUB_REPOSITORY: 'o/r' }, { fetch: f, out: (s: string) => lines.push(s) });
      expect(code).toBe(0); // the hostile label is not `automation-paused`; the hostile issue is not the switch
      expect(urls.every((u) => u.startsWith('https://api.github.com/repos/o/r/'))).toBe(true);
      expect(lines.join('\n')).not.toContain(h);
    }
  });
});

describe('the --guard CLI re-asserts a bot removal with ONE notice and exit 0', () => {
  function guardFetch(events: unknown[], { labelPresent = false, failLabelPost = false, existing = [] as string[] } = {}) {
    const log: { m: string; u: string; body?: string }[] = [];
    const f = async (u: string, init: { method?: string; body?: string } = {}) => {
      const m = init.method || 'GET';
      log.push({ m, u, body: init.body });
      const ok = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s });
      if (m === 'GET' && /\/issues\?/.test(u)) return ok([{ number: 9, title: PAUSE_ISSUE_TITLE, state: 'open', labels: labelPresent ? [{ name: PAUSE_LABEL }] : [], user: { login: 'o' } }]);
      if (m === 'GET' && /\/issues\/9\/events/.test(u)) return ok(events);
      if (m === 'GET' && /\/issues\/9\/comments/.test(u)) return ok(existing.map((body, id) => ({ id, body })));
      if (m === 'POST' && /\/issues\/9\/labels$/.test(u)) return failLabelPost ? ok({}, 403) : ok([{ name: PAUSE_LABEL }]);
      if (m === 'POST' && /\/issues\/9\/comments$/.test(u)) return ok({ id: 1 }, 201);
      return ok({}, 500);
    };
    return { f, log };
  }
  const ENV = { GH_TOKEN: 't', GITHUB_REPOSITORY: 'o/r', GITHUB_REPOSITORY_OWNER: '123constante' };
  const ev = (event: string, login: string, id: number) => ({ id, event, label: { name: PAUSE_LABEL }, actor: { login }, created_at: new Date(1e12 + id * 1000).toISOString() });
  const q = { out: () => {} };
  it('kiki-claude-bot removed it: label re-added, one notice naming the actor, exit 0', async () => {
    const g = guardFetch([ev('labeled', '123constante', 1), ev('unlabeled', 'kiki-claude-bot', 2)]);
    expect(await cli(['--guard'], ENV, { fetch: g.f, ...q })).toBe(0);
    const posts = g.log.filter((l) => l.m === 'POST');
    expect(posts.map((p) => p.u.replace(/^.*\/issues\/9\//, ''))).toEqual(['labels', 'comments']);
    expect(JSON.parse(posts[0].body!)).toEqual({ labels: [PAUSE_LABEL] });
    const note = JSON.parse(posts[1].body!).body;
    expect(note).toContain('kiki-claude-bot');
    expect(note).toContain('<!-- automation-pause-notice key=reassert:2 -->');
  });
  it('the notice is not repeated for the same event', async () => {
    const g = guardFetch([ev('unlabeled', 'github-actions[bot]', 2)], { existing: ['<!-- automation-pause-notice key=reassert:2 -->'] });
    expect(await cli(['--guard'], ENV, { fetch: g.f, ...q })).toBe(0);
    expect(g.log.filter((l) => l.m === 'POST').map((p) => p.u.replace(/^.*\/issues\/9\//, ''))).toEqual(['labels']);
  });
  it('owner removal = legitimate clear: no write, exit 0', async () => {
    const g = guardFetch([ev('unlabeled', '123constante', 2)]);
    expect(await cli(['--guard'], ENV, { fetch: g.f, ...q })).toBe(0);
    expect(g.log.filter((l) => l.m !== 'GET')).toEqual([]);
  });
  it('could not re-assert -> exit 1', async () => {
    const g = guardFetch([ev('unlabeled', 'kiki-claude-bot', 2)], { failLabelPost: true });
    expect(await cli(['--guard'], ENV, { fetch: g.f, ...q })).toBe(1);
  });
  it('could not read -> exit 1 (never silently green)', async () => {
    expect(await cli(['--guard'], ENV, { fetch: async () => new Response('x', { status: 500 }), ...q })).toBe(1);
    expect(await cli(['--guard'], { ...ENV, GITHUB_REPOSITORY_OWNER: '' }, { fetch: guardFetch([]).f, ...q })).toBe(1);
  });
  it('the guard never removes anything (no DELETE in any path)', async () => {
    for (const evs of [[ev('unlabeled', 'kiki-claude-bot', 2)], [ev('labeled', '123constante', 1)], []]) {
      const g = guardFetch(evs, { labelPresent: evs.length === 1 && evs[0].event === 'labeled' });
      await cli(['--guard'], ENV, { fetch: g.f, ...q });
      expect(g.log.some((l) => l.m === 'DELETE')).toBe(false);
    }
  });
});

// ------------------------------------------------------------- static tripwire
function walk(dir: string, out: string[] = []) {
  // Dot-files are skipped: other suites write and delete `.<name>-mutant-*.mjs` temp copies in scripts/
  // while this one runs in parallel (they are the TEST corpus, not shipped code).
  // ENOENT is tolerated too: a directory can vanish between listing and reading (temp dirs).
  let ents: Dirent[];
  try { ents = readdirSync(dir, { withFileTypes: true }); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return out; throw e; }
  for (const d of ents) {
    if (d.name.startsWith('.') || d.name === 'node_modules') continue;
    const p = path.join(dir, d.name);
    if (d.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
// A file listed by walk() can be deleted by a parallel suite before it is read: skip it (ENOENT only).
function readIfPresent(p: string): string | null {
  try { return readFileSync(p, 'utf8'); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null; throw e; }
}
const REMOVERS: RegExp[] = [
  /labels\/automation-paused/, /--remove-label[^\n]*automation-paused/, /removeLabel[^\n]*automation-paused/,
  /DELETE[^\n]*PAUSE_LABEL/, /PAUSE_LABEL[^\n]*DELETE/, /gh issue delete/, /deleteIssue/, /gh label delete[^\n]*automation-paused/,
  /AUTOMATION_PAUSED[^\n]*false/,
];
function tripwire(files: Record<string, string>) {
  const out: string[] = [];
  for (const [f, t] of Object.entries(files)) for (const re of REMOVERS) if (re.test(t)) out.push(`${f}: ${re}`);
  return out;
}
describe('tripwire: no workflow or script removes the label or deletes the pinned issue', () => {
  const files = Object.fromEntries([...walk(path.join(ROOT, '.github/workflows')), ...walk(path.join(ROOT, 'scripts'))]
    .filter((p) => /\.(ya?ml|mjs|js|cjs|ts|sh|py)$/.test(p)).flatMap((p) => { const t = readIfPresent(p); return t === null ? [] : [[path.relative(ROOT, p), t]]; }));
  it('scans a real corpus', () => expect(Object.keys(files).length).toBeGreaterThan(100));
  it('no remover anywhere', () => expect(tripwire(files)).toEqual([]));
  it('CANARY: each remover shape is caught', () => {
    for (const t of ['gh api -X DELETE repos/o/r/issues/9/labels/automation-paused', 'gh issue edit 9 --remove-label automation-paused', 'github.rest.issues.removeLabel({ name: "automation-paused" })', 'gh issue delete 9']) {
      expect(tripwire({ 'x.yml': t })).toHaveLength(1);
    }
  });
  it('the only label-ADDING code for the switch is the CLI --guard path', () => {
    const adders = Object.entries(files).filter(([, t]) => /automation-paused|PAUSE_LABEL/.test(t) && /\/labels['`"]?\s*,|--add-label/.test(t)).map(([f]) => f);
    expect(adders).toEqual(['scripts/automation-pause.mjs']);
  });
});
