// Slice 2 (foundations-web), PART 5: guard paths (drill A18). ONE shared isGuardPath()
// (scripts/lib/guard-paths.mjs + .github/automation/guard-paths.json) that IMPORTS the lane's
// existing lists (GOVERNANCE, isAgentInstructionPath) rather than forking them; every auto path
// that exists here (the merge lane, bot-automerge's classifier, the Dependabot lane) refuses with
// `guard-path refused: <path>`; layer (2) is the owner-approval audit (decideAudit), extended ONLY
// behind arming.json `audit_escalation` (off = exactly today's verdicts). Mutants: each wiring, and
// the A18 mutant (a lane with the isGuardPath call string-removed is still caught by decideAudit).
// Doc: docs/automation-foundations.md.
import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse, stringify } from 'yaml';
import { isGuardPath, guardRefusals, parseGuardPaths, GUARD_PATHS_PATH } from '../scripts/lib/guard-paths.mjs';
import { mergeVerdict, GOVERNANCE } from '../scripts/lib/autopilot-merge.mjs';
// @ts-expect-error -- plain .mjs script, no types
import { classify, BOT_LOGIN, LABEL_OK } from '../scripts/automerge-classify.mjs';
import { main as depCli } from '../scripts/automation-money-check.mjs';
// @ts-expect-error -- plain .mjs script, no types
import { decideAudit, escalateRed, OWNER_LOGIN } from '../scripts/owner-approval-audit.mjs';
import { readArming, ARMING_PATH } from '../scripts/lib/arming.mjs';
import { PAUSE_ISSUE_TITLE, PAUSE_LABEL, noticeMarker } from '../scripts/lib/automation-pause.mjs';
import { FOUNDATIONS_OK, NOT_PAUSED } from './autopilotTable';
import { run } from '../scripts/autopilot-step.mjs';
import { fakeGitHub, green, ENV, NOW } from './automationFakeGitHub';
import { vi } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
const GUARD = JSON.parse(readFileSync(path.join(ROOT, GUARD_PATHS_PATH), 'utf8'));
const MONEY_SET = JSON.parse(readFileSync(path.join(ROOT, '.github/automation/money-set.json'), 'utf8'));
const H = 'b'.repeat(40);
type F = { filename: string; status: string; additions: number; deletions: number; changes: number; patch: string; previous_filename?: string };
const file = (filename: string, extra: Partial<F> = {}): F => ({ filename, status: 'modified', additions: 1, deletions: 0, changes: 1, patch: '@@ -1 +1,2 @@\n ctx\n+a plain line', ...extra });

// ---------------------------------------------------------------- the list
describe('guard-paths.json + isGuardPath (PART 5.1): section 14.1 for THIS repo, one list', () => {
  it('the file is version 1 and parses; it lives under .github/** (itself a guard path)', () => {
    expect(GUARD.version).toBe(1);
    expect(() => parseGuardPaths(readFileSync(path.join(ROOT, GUARD_PATHS_PATH), 'utf8'))).not.toThrow();
    expect(isGuardPath(GUARD_PATHS_PATH)).toBe(true);
  });
  const YES = [
    '.github/workflows/autopilot.yml', '.github/automation/money-set.json', '.github/automation/required-jobs.json', '.github/automation/arming.json',
    '.github/automation/guard-paths.json', '.github/CODEOWNERS',
    'scripts/lib/autopilot.mjs', 'scripts/lib/autopilot-merge.mjs', 'scripts/lib/autopilot-pack.mjs', 'scripts/automerge-classify.mjs',
    'scripts/lib/automation-pause.mjs', 'scripts/automation-pause.mjs', 'scripts/lib/is-money.mjs', 'scripts/lib/required-jobs.mjs',
    'scripts/lib/arming.mjs', 'scripts/lib/guard-paths.mjs', 'scripts/data/automation-workflow-allowlist.json',
    'scripts/check-automation-workflow-allowlist.mjs', 'scripts/owner-approval-audit.mjs',
    // F7 (review-1370-r1): every guard CLI dispatches through isEntryPoint(); a change there could
    // make every check a silent no-op.
    'scripts/lib/entry-point.mjs',
    '.claude/settings.json', '.claude/hooks/pre-write-block.sh', '.claude/rules/x.md', '.githooks/pre-push', 'CLAUDE.md',
    // imported from the lane, not forked: GOVERNANCE prose and agent-instruction paths at any depth
    'docs/automerge.md', 'docs/testing-doctrine.md', 'docs/ci-guard-notes.md', 'AGENTS.md', 'docs/CLAUDE.md', 'src/modules/event-page/CLAUDE.md',
    // fail closed: an unreadable or traversal path is guarded
    '', 'docs/../.github/workflows/x.yml', '/etc/passwd', 'docs\\x.md', './CLAUDE.md',
    // case: over-block on purpose (a Windows checkout is case-insensitive)
    '.GitHub/workflows/x.yml', 'Scripts/Automerge-Classify.mjs',
  ];
  const NO = ['docs/handover/x.md', 'docs/design/notes.md', 'README.md', 'tests/a.test.ts', 'src/lib/x.ts', 'package.json', 'scripts/check-bundle-budget.mjs', 'docs/automerge-notes.md', 'public/x.png'];
  it.each(YES)('guard: %s', (p) => expect(isGuardPath(p)).toBe(true));
  it.each(NO)('not guard: %s', (p) => expect(isGuardPath(p)).toBe(false));
  it('the flaky list (none exists yet) is a reserved fixture path in the file, and it is guarded', () => {
    expect(typeof GUARD.reserved.flaky_list).toBe('string');
    expect(isGuardPath(GUARD.reserved.flaky_list)).toBe(true);
  });
  it('every GOVERNANCE entry is a guard path (imported, so a new GOVERNANCE entry is guarded with no second edit)', () => {
    for (const g of GOVERNANCE) expect(isGuardPath(g)).toBe(true);
  });
  it('IMPORTS the lane\'s lists; never forks them', () => {
    const src = readFileSync(path.join(ROOT, 'scripts/lib/guard-paths.mjs'), 'utf8');
    expect(src).toMatch(/import \{[^}]*\bGOVERNANCE\b[^}]*\bisAgentInstructionPath\b[^}]*\} from '\.\/autopilot-merge\.mjs'/);
    expect(src).not.toMatch(/docs\/agent-policy\.md|copilot-instructions|\.cursorrules/);
  });
  it('an unreadable list guards EVERYTHING (fail closed)', () => {
    expect(isGuardPath('docs/handover/x.md', null)).toBe(true);
    expect(() => parseGuardPaths('{ nope')).toThrow();
    expect(() => parseGuardPaths(JSON.stringify({ version: 1, globs: 'x' }))).toThrow();
  });
  it('guardRefusals: one `guard-path refused: <path>` per distinct guard path, in order', () => {
    expect(guardRefusals(['docs/a.md', '.github/x.yml', 'CLAUDE.md', '.github/x.yml'])).toEqual(['guard-path refused: .github/x.yml', 'guard-path refused: CLAUDE.md']);
    expect(guardRefusals(['docs/a.md'])).toEqual([]);
  });
});

// ---------------------------------------------------------------- the three auto paths
const laneFacts = (files: string[]) => ({
  ...FOUNDATIONS_OK.facts,
  mode: 'soft', dryRun: false, tokenOk: true, budgetOk: true, decision: 'ready', workerDone: true,
  pr: { state: 'open', draft: false, fork: false, base: 'main', author: BOT_LOGIN, ref: 'claude/x', ageDays: 1, head: H, changedFiles: files.length },
  files, labels: ['review-passed', 'automerge-ok'],
});
const basePr = { state: 'open', draft: false, user: BOT_LOGIN, headRef: 'claude/x', headRepo: 'o/r', baseRepo: 'o/r', baseRef: 'main', labels: [LABEL_OK, 'review-passed'], body: 'x' };
const classifyFiles = (files: F[], cls = classify) => cls({
  pr: { ...basePr, additions: files.length, deletions: 0, changedFiles: files.length }, files, labelActor: BOT_LOGIN, importedByShipped: () => false, moneySet: MONEY_SET,
});
async function dependabot(files: F[], cli = depCli) {
  const outputs: string[] = [];
  const fetchImpl = async (url: string) => {
    const u = new URL(url);
    if (/\/pulls\/\d+$/.test(u.pathname)) return new Response(JSON.stringify({ changed_files: files.length, head: { sha: 'c'.repeat(40) } }), { status: 200 });
    if (/\/pulls\/\d+\/files$/.test(u.pathname)) return new Response(JSON.stringify(Number(u.searchParams.get('page')) === 1 ? files : []), { status: 200 });
    return new Response('{}', { status: 404 });
  };
  const code = await cli({ GH_TOKEN: 't', REPO: 'o/r', PR_NUMBER: '5', HEAD_SHA: 'c'.repeat(40) }, { fetch: fetchImpl, writeOutput: (l: string) => outputs.push(l), out: () => {}, err: () => {} });
  return { code, outputs };
}
const unapproved = [{ number: 5, headSha: H, reviews: [] }];
const ownerApproved = [{ number: 5, headSha: H, reviews: [{ user: { login: OWNER_LOGIN }, state: 'APPROVED', commit_id: H }] }];

// A18: a bot PR (automerge-ok + review-passed) that LOOSENS a rule in each of these files.
const A18: [string, string][] = [
  ['GOVERNANCE (defined in scripts/lib/autopilot-merge.mjs)', 'scripts/lib/autopilot-merge.mjs'],
  ['HARD_RULES (defined in scripts/lib/autopilot-pack.mjs)', 'scripts/lib/autopilot-pack.mjs'],
  ['the flaky list (reserved fixture path)', GUARD.reserved.flaky_list],
  ['the classifier', 'scripts/automerge-classify.mjs'],
  ['required-jobs.json', '.github/automation/required-jobs.json'],
  ['money-set.json', '.github/automation/money-set.json'],
  ['arming.json', '.github/automation/arming.json'],
];
const RECORD: string[] = [];
describe('A18: each guard-path edit is refused by layer (1) on every auto path AND flagged RED by layer (2)', () => {
  it.each(A18)('lane: %s', (_n, p) => {
    const v = mergeVerdict(laneFacts([p]));
    expect(v.merge).toBe(false);
    expect(v.reasons).toContain(`guard-path refused: ${p}`);
    RECORD.push(`${p} | lane | refused`);
  });
  it.each(A18)('bot-automerge: %s', (_n, p) => {
    const v = classifyFiles([file(p)]);
    expect(v.qualifies).toBe(false);
    expect(v.reasons).toContain(`guard-path refused: ${p}`);
    RECORD.push(`${p} | bot-automerge | refused`);
  });
  it.each(A18)('Dependabot lane: %s', async (_n, p) => {
    const r = await dependabot([file(p)]);
    expect(r.outputs).toContain('guard=true');
    expect(r.outputs).toContain(`guard_reason=guard-path refused: ${p}`);
    RECORD.push(`${p} | dependabot | refused`);
  });
  it.each(A18)('owner-approval audit (layer 2), escalation off AND on: %s merged without the owner Approve = RED', (_n, p) => {
    expect(decideAudit({ files: [p], prs: unapproved }).code).toBe(1);
    const on = decideAudit({ files: [p], prs: unapproved, escalation: true });
    expect(on.code).toBe(1);
    expect(on.escalate).toBe(true);
    expect(decideAudit({ files: [p], prs: ownerApproved, escalation: true }).code).toBe(0);
    RECORD.push(`${p} | audit | RED`);
  });
  it('A16 case 7 (a name added to money-set.json) is ALSO refused as a guard path on all three paths', async () => {
    const p = '.github/automation/money-set.json';
    expect(mergeVerdict(laneFacts([p])).reasons).toContain(`guard-path refused: ${p}`);
    expect(classifyFiles([file(p, { patch: '@@ -1 +1,2 @@\n ctx\n+    "ticket_new_thing",' })]).reasons).toContain(`guard-path refused: ${p}`);
    expect((await dependabot([file(p)])).outputs).toContain('guard=true');
  });
  it('a rename OUT of a guard path is refused too (old name checked)', () => {
    const v = classifyFiles([file('docs/x.md', { status: 'renamed', previous_filename: 'CLAUDE.md' })]);
    expect(v.reasons).toContain('guard-path refused: CLAUDE.md');
  });
});

describe('no new refusal on a legitimate docs-only bot PR (except where the docs path is itself a guard path)', () => {
  it('lane: docs/handover + docs/design paths carry no guard-path reason', () => {
    expect(mergeVerdict(laneFacts(['docs/handover/x.md', 'docs/design/notes.md'])).reasons.filter((r: string) => r.startsWith('guard-path'))).toEqual([]);
  });
  it('bot-automerge: a docs-only PR still qualifies with the REAL guard check', () => {
    const v = classifyFiles([file('docs/handover/x.md'), file('docs/design/notes.md')]);
    expect(v.reasons).toEqual([]);
    expect(v.qualifies).toBe(true);
  });
  it('Dependabot lane: a lockfile bump is not a guard path', async () => {
    const r = await dependabot([file('package.json'), file('package-lock.json')]);
    expect(r.outputs).toContain('guard=false');
  });
  it('bot-automerge: a GOVERNANCE doc (docs/automerge.md) is now refused with the named reason', () => {
    const v = classifyFiles([file('docs/automerge.md')]);
    expect(v.qualifies).toBe(false);
    expect(v.reasons).toContain('guard-path refused: docs/automerge.md');
  });
});

// ---------------------------------------------------------------- layer (2): audit_escalation
describe('decideAudit behind arming.json audit_escalation (PART 5.3)', () => {
  it('arming.json ships audit_escalation: false', () => {
    const a = readArming(readFileSync(path.join(ROOT, ARMING_PATH), 'utf8'));
    expect(a.problems).toEqual([]);
    expect(a.values.audit_escalation).toBe(false);
  });
  const TODAY: [string, string[], unknown[]][] = [
    ['no hard path', ['docs/a.md', 'src/x.ts'], unapproved],
    ['hard, no PR', ['scripts/x.mjs'], []],
    ['hard, unapproved', ['.github/workflows/x.yml', 'docs/a.md'], unapproved],
    ['hard, owner-approved at head', ['scripts/x.mjs'], ownerApproved],
    ['GOVERNANCE prose only (not hard tier today)', ['docs/automerge.md'], unapproved],
    ['CLAUDE.md only (not hard tier today)', ['CLAUDE.md'], unapproved],
  ];
  it.each(TODAY)('off = exactly today\'s verdict object: %s', (_n, files, prs) => {
    const v = decideAudit({ files, prs });
    expect(decideAudit({ files, prs, escalation: false })).toEqual(v);
    expect(Object.keys(v).sort()).toEqual(['code', 'reason']);
  });
  it('off: GOVERNANCE prose / CLAUDE.md stay green as today; on: they are RED and escalate', () => {
    for (const p of ['docs/automerge.md', 'CLAUDE.md']) {
      expect(decideAudit({ files: [p], prs: unapproved }).code).toBe(0);
      const on = decideAudit({ files: [p], prs: unapproved, escalation: true });
      expect(on.code).toBe(1);
      expect(on.escalate).toBe(true);
      expect(on.guard).toEqual([p]);
    }
  });
  it('on: a hard-tier change that is NOT a guard path is RED but does not escalate (pause is for guard paths)', () => {
    const v = decideAudit({ files: ['bin/x.sh'], prs: unapproved, escalation: true });
    expect(v.code).toBe(1);
    expect(v.escalate).toBe(false);
  });
});

describe('escalateRed: sets the pause label on THE pinned issue and posts ONE notice naming the sha and PR', () => {
  function fakeIssues(existing: string[] = []) {
    const log: { m: string; p: string; body?: { labels?: string[]; body?: string } }[] = [];
    const comments = existing.map((b, i) => ({ id: i + 1, body: b }));
    const f = async (url: string, init: { method?: string; body?: string } = {}) => {
      const m = init.method || 'GET';
      const u = new URL(url);
      const p = u.pathname.replace(/^\/repos\/o\/r/, '');
      const body = init.body ? JSON.parse(init.body) : undefined;
      log.push({ m, p, body });
      if (m === 'GET' && p === '/issues') return new Response(JSON.stringify([{ number: 9, title: PAUSE_ISSUE_TITLE, state: 'open', labels: [], user: { login: 'o' } }]), { status: 200 });
      if (m === 'GET' && p === '/issues/9/comments') return new Response(JSON.stringify(comments), { status: 200 });
      if (m === 'POST' && p === '/issues/9/labels') return new Response('[]', { status: 200 });
      if (m === 'POST' && p === '/issues/9/comments') { comments.push({ id: 99, body: body.body }); return new Response('{"id":99}', { status: 201 }); }
      return new Response('{}', { status: 404 });
    };
    return { f, log };
  }
  const verdict = { code: 1, reason: 'x', escalate: true, guard: ['.github/automation/arming.json'], prs: [5] };
  it('label + one notice, key audit-red:<sha>', async () => {
    const g = fakeIssues();
    const r = await escalateRed({ repo: 'o/r', token: 't', sha: H, verdict, fetch: g.f });
    expect(r.labelled).toBe(true);
    expect(g.log.filter((l) => l.m === 'POST' && l.p === '/issues/9/labels').map((l) => l.body?.labels)).toEqual([[PAUSE_LABEL]]);
    const posts = g.log.filter((l) => l.m === 'POST' && l.p === '/issues/9/comments');
    expect(posts).toHaveLength(1);
    expect(posts[0].body?.body).toContain(H);
    expect(posts[0].body?.body).toContain('#5');
    expect(posts[0].body?.body).toContain(noticeMarker(`audit-red:${H}`));
  });
  it('a re-run for the same sha posts no second notice', async () => {
    const g = fakeIssues([`old\n\n${noticeMarker(`audit-red:${H}`)}`]);
    await escalateRed({ repo: 'o/r', token: 't', sha: H, verdict, fetch: g.f });
    expect(g.log.filter((l) => l.m === 'POST' && l.p === '/issues/9/comments')).toHaveLength(0);
  });
  it('never throws; a failed read is reported, not swallowed', async () => {
    const r = await escalateRed({ repo: 'o/r', token: 't', sha: H, verdict, fetch: async () => new Response('{}', { status: 500 }) });
    expect(r.labelled).toBe(false);
    expect(String(r.error)).toMatch(/HTTP 500/);
  });
  it('main() escalates ONLY on an escalate verdict, and reads audit_escalation from arming.json (not a variable)', () => {
    const src = readFileSync(path.join(ROOT, 'scripts/owner-approval-audit.mjs'), 'utf8');
    expect(src).toMatch(/if \(v\.escalate\) /);
    expect(src).toMatch(/readArming\(/);
    expect(src).not.toMatch(/process\.env\.(AUDIT_ESCALATION|ARMING)/);
  });
});

// ---------------------------------------------------------------- the Dependabot workflow wiring
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Step = Record<string, any>;
const DEP_WF = path.join(ROOT, '.github/workflows/dependabot-automerge.yml');
function depGuardProblems(text: string) {
  const out: string[] = [];
  const steps: Step[] = parse(text).jobs.enable.steps;
  const en = steps.find((s) => /^Enable auto-merge/.test(String(s.name || '')));
  const dis = steps.find((s) => /^Disable auto-merge/.test(String(s.name || '')));
  if (!/steps\.money\.outputs\.guard == 'false'/.test(String(en?.if))) out.push('Enable does not require guard == false');
  if (!/steps\.money\.outputs\.guard != 'false'/.test(String(dis?.if))) out.push('an armed auto-merge is not disarmed on a guard path');
  return out;
}
describe('dependabot-automerge.yml: the guard output gates Enable', () => {
  const raw = readFileSync(DEP_WF, 'utf8');
  it('structure', () => expect(depGuardProblems(raw)).toEqual([]));
  it('MUTANT: an Enable that ignores the guard output fails the structure test', () => {
    const wf = parse(raw);
    const en = wf.jobs.enable.steps.find((s: Step) => /^Enable auto-merge/.test(String(s.name || '')));
    en.if = String(en.if).replace(/ && steps\.money\.outputs\.guard == 'false'/, '');
    expect(depGuardProblems(stringify(wf))).toContain('Enable does not require guard == false');
  });
});

// ---------------------------------------------------------------- mutants
const lf = (f: string) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
let seq = 0;
async function loadBeside(file: string, src: string) {
  const f = path.join(path.dirname(file), `.guard-mutant-${process.pid}-${seq++}.mjs`);
  writeFileSync(f, src);
  try { return await import(/* @vite-ignore */ pathToFileURL(f).href); } finally { rmSync(f, { force: true }); }
}
const LANE = path.join(ROOT, 'scripts/lib/autopilot-merge.mjs');
const CLASSIFY = path.join(ROOT, 'scripts/automerge-classify.mjs');
const CLI = path.join(ROOT, 'scripts/automation-money-check.mjs');
const LANE_CALL = '  if (Array.isArray(files)) for (const r of guardRefusals([...files, ...(Array.isArray(f.previousFiles) ? f.previousFiles : [])])) no(r);';
const CLASSIFY_CALL = '  for (const r of guardCheck(names)) no(r);';
const CLI_CALL = 'const guard = guardRefusals(names);';
describe('MUTANTS: the isGuardPath wiring is load-bearing', () => {
  it('lane: without the call the guard-path reason is gone', async () => {
    const src = lf(LANE);
    expect(src.split(LANE_CALL).length).toBe(2);
    const m = await loadBeside(LANE, src.replace(LANE_CALL, ''));
    expect(m.mergeVerdict(laneFacts(['.github/automation/arming.json'])).reasons).not.toContain('guard-path refused: .github/automation/arming.json');
  });
  it('bot-automerge: without the call a GOVERNANCE doc qualifies again', async () => {
    const src = lf(CLASSIFY);
    expect(src.split(CLASSIFY_CALL).length).toBe(2);
    const m = await loadBeside(CLASSIFY, src.replace(CLASSIFY_CALL, ''));
    expect(classifyFiles([file('docs/automerge.md')], m.classify).qualifies).toBe(true);
  });
  it('Dependabot: without the call a guard path says guard=false', async () => {
    const src = lf(CLI);
    expect(src.split(CLI_CALL).length).toBe(2);
    const m = await loadBeside(CLI, src.replace(CLI_CALL, 'const guard = [];'));
    expect((await dependabot([file('.github/automation/arming.json')], m.main)).outputs).toContain('guard=false');
  });
  it('A18 MUTANT: a lane with the isGuardPath call removed is STILL caught by layer (2), decideAudit, alone', async () => {
    const m = await loadBeside(LANE, lf(LANE).replace(LANE_CALL, ''));
    for (const [, p] of A18) {
      const reasons: string[] = m.mergeVerdict(laneFacts([p])).reasons;
      expect(reasons).not.toContain(`guard-path refused: ${p}`); // layer (1) is gone in the mutant
      // the commit lands on main without the owner's Approve at head: layer (2) alone turns red
      expect(decideAudit({ files: [p], prs: unapproved }).code).toBe(1);
      expect(decideAudit({ files: [p], prs: unapproved, escalation: true }).escalate).toBe(true);
    }
  });
  it('pass record: every (A18 path, auto path) pair was refused / RED', () => {
    for (const [, p] of A18) for (const where of ['lane | refused', 'bot-automerge | refused', 'dependabot | refused', 'audit | RED']) expect(RECORD).toContain(`${p} | ${where}`);
  });
});

describe('lane run(): a rename OUT of a guard path is refused (the old name is checked, as on bot-automerge)', () => {
  const REQ = JSON.parse(readFileSync(path.join(ROOT, '.github/automation/required-jobs.json'), 'utf8'));
  async function laneRun(f: Partial<F> & { filename: string }) {
    const gh = fakeGitHub({ n: 91, files: [f], checkRuns: (h) => green(h, REQ.pr_head) });
    const lines: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => { lines.push(a.map(String).join(' ')); });
    try { await run(ENV, { ...FOUNDATIONS_OK.armingOpts, pauseReader: NOT_PAUSED.pauseReader, now: NOW, fetch: gh.fetchImpl }); } finally { spy.mockRestore(); }
    return { merges: gh.merges().length, out: lines.join('\n') };
  }
  it('control: a plain docs edit merges through the same harness', async () => {
    expect((await laneRun(file('docs/a.md'))).merges).toBe(1);
  });
  it.each(['CLAUDE.md', '.claude/hooks/pre-write-block.sh', 'scripts/lib/guard-paths.mjs'])('rename %s -> docs/moved.md: no merge, named reason', async (old) => {
    const r = await laneRun({ filename: 'docs/moved.md', previous_filename: old, status: 'renamed', additions: 0, deletions: 0, changes: 0 });
    expect(r.merges).toBe(0);
    expect(r.out).toContain(`guard-path refused: ${old}`);
  });
});
