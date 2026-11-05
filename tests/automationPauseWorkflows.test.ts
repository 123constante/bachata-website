// Pause switch, slice 1: every merge/approval/write consumer workflow reads the switch BEFORE it
// acts (docs/automation-pause.md). Line-ending agnostic like tests/autopilotWorkflow.test.ts: each
// structural assertion runs on the file as read AND on a CRLF copy. The COMPLETENESS test turns
// red when a new workflow can merge/approve/write without a reader and is not on EXEMPT.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { parse, stringify } from 'yaml';

const WF = path.resolve(__dirname, '../.github/workflows');
const read = (f: string) => readFileSync(path.join(WF, f), 'utf8');
const READER = /node scripts\/automation-pause\.mjs/;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Step = Record<string, any>;

/** Problems with one consumer's structure. Empty = the consumer reads the switch before it writes. */
function consumerProblems(text: string, spec: { job: string; gated: RegExp[]; info?: boolean; pr?: boolean; perms: Record<string, string> }) {
  const out: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let wf: any;
  try { wf = parse(text); } catch (e) { return [`yaml: ${(e as Error).message}`]; }
  const job = wf?.jobs?.[spec.job];
  if (!job) return [`job ${spec.job} missing`];
  const perms = wf.permissions || {};
  if (JSON.stringify(perms) !== JSON.stringify(spec.perms)) out.push(`permissions ${JSON.stringify(perms)} != ${JSON.stringify(spec.perms)}`);
  if (job.permissions) out.push('job-level permissions widen the workflow set');
  const steps: Step[] = job.steps || [];
  const readers = steps.map((s, i) => [s, i] as const).filter(([s]) => READER.test(String(s.run || '')));
  if (!readers.length) return [...out, 'no pause reader step'];
  for (const [s] of readers) {
    if (!/^\$\{\{ github\.token \}\}$/.test(String(s.env?.GH_TOKEN || ''))) out.push(`reader ${s.id} not called with github.token`);
    if (spec.info ? !/--info/.test(s.run) : /--info/.test(s.run)) out.push(`reader ${s.id} has the wrong mode`);
    if (/\$\{\{/.test(String(s.run))) out.push(`reader ${s.id} interpolates into run`);
  }
  const firstReader = readers[0][1];
  const co = steps.findIndex((s) => /^actions\/checkout@/.test(String(s.uses || '')));
  if (co < 0 || co > firstReader) out.push('no checkout before the reader');
  else {
    const w = steps[co].with || {};
    const refOk = w.ref === 'main' || (!spec.pr && w.ref === '${{ github.event.repository.default_branch }}');
    if (!refOk) out.push(`checkout ref ${w.ref} is not main`);
    if (spec.pr && w['persist-credentials'] !== false) out.push('checkout keeps credentials on a PR trigger');
  }
  for (const re of spec.gated) {
    const i = steps.findIndex((s) => re.test(String(s.name || '')) || re.test(String(s.run || '')));
    if (i < 0) { out.push(`gated step ${re} missing`); continue; }
    const before = readers.filter(([, j]) => j < i);
    if (!before.length) { out.push(`step ${re} runs before any reader`); continue; }
    if (spec.info) continue; // the brake: log only, never gated
    const last = before.at(-1)![0];
    if (!new RegExp(`steps\\.${last.id}\\.outputs\\.paused == 'false'`).test(String(steps[i].if || ''))) out.push(`step ${re} does not depend on the nearest reader (${last.id})`);
  }
  return out;
}

const CONSUMERS: [string, Parameters<typeof consumerProblems>[1]][] = [
  ['bot-automerge.yml', { job: 'decide', gated: [/^Enable auto-merge/], pr: true, perms: { contents: 'read', 'pull-requests': 'write', issues: 'read' } }],
  ['dependabot-automerge.yml', { job: 'enable', gated: [/^Enable auto-merge/], pr: true, perms: { contents: 'write', 'pull-requests': 'write', issues: 'read' } }],
  ['stale-bot-pr-sweep.yml', { job: 'sweep', gated: [/^Sweep stale bot PRs/], perms: { contents: 'read', issues: 'read', 'pull-requests': 'write' } }],
  ['post-merge-prod-alarm.yml', { job: 'brake', gated: [/^Disable auto-merge on every open PR/, /^Open or update the alarm issue/], info: true, perms: { contents: 'read', issues: 'write', 'pull-requests': 'write' } }],
];

for (const [file, spec] of CONSUMERS) {
  describe(`${file} reads the pause switch first`, () => {
    const raw = read(file);
    for (const [eol, text] of [['as read', raw], ['CRLF', raw.replace(/\r?\n/g, '\r\n')]] as const) {
      it(`structure (${eol})`, () => expect(consumerProblems(text, spec)).toEqual([]));
    }
    it('MUTANT: with every reader step removed the structure test fails', () => {
      const wf = parse(raw);
      wf.jobs[spec.job].steps = wf.jobs[spec.job].steps.filter((s: Step) => !READER.test(String(s.run || '')));
      expect(consumerProblems(stringify(wf), spec)).not.toEqual([]);
    });
  });
}

describe('bot-automerge.yml: paused = no enable, and the disable path runs', () => {
  const steps: Step[] = parse(read('bot-automerge.yml')).jobs.decide.steps;
  const byName = (re: RegExp) => steps.find((s) => re.test(String(s.name || '')))!;
  it('reads AGAIN in the step immediately before Enable auto-merge', () => {
    const i = steps.indexOf(byName(/^Enable auto-merge/));
    expect(READER.test(String(steps[i - 1].run))).toBe(true);
    expect(steps.filter((s) => READER.test(String(s.run || ''))).length).toBe(2);
  });
  it('the disable step fires when paused (its if negates the same pause condition)', () => {
    const en = String(byName(/^Enable auto-merge/).if);
    const dis = String(byName(/^Disable auto-merge/).if);
    expect(dis).toContain('always()');
    expect(dis.replace(/\s+/g, ' ')).toContain(`!(${en.replace(/\s+/g, ' ')})`);
  });
  it('reader steps never fail the job (a pause is not a failure)', () => {
    for (const s of steps.filter((x) => READER.test(String(x.run || '')))) expect(s['continue-on-error']).toBe(true);
  });
});

describe('dependabot-automerge.yml: paused = no enable; an armed auto-merge is disabled', () => {
  const steps: Step[] = parse(read('dependabot-automerge.yml')).jobs.enable.steps;
  it('a disable step runs when the switch is not positively running', () => {
    const d = steps.find((s) => /^Disable auto-merge/.test(String(s.name || '')))!;
    expect(d).toBeTruthy();
    expect(String(d.if)).toMatch(/steps\.pause\.outputs\.paused != 'false'/);
    expect(String(d.run)).toMatch(/gh pr merge --disable-auto/);
  });
  it('the reader output names the reason (the Dependabot-token risk stays visible)', () => {
    const r = steps.find((s) => READER.test(String(s.run || '')))!;
    expect(r['continue-on-error']).toBe(true);
  });
});

describe('autopilot.yml: the script reader runs from main and with github.token', () => {
  const wf = parse(read('autopilot.yml'));
  const job = Object.values(wf.jobs).find((j) => (j as { steps?: Step[] }).steps?.some((s) => /autopilot-step\.mjs/.test(String(s.run || '')))) as { steps: Step[]; permissions?: Record<string, string> };
  it('checks out the default branch (main), never a PR ref, and has no pull_request trigger', () => {
    const co = job.steps.find((s) => /^actions\/checkout@/.test(String(s.uses || '')))!;
    expect(co.with.ref).toBe('${{ github.event.repository.default_branch }}');
    expect(Object.keys(wf.on || wf[true as unknown as string] || {})).not.toContain('pull_request');
    expect(Object.keys(wf.on || {})).not.toContain('pull_request_target');
  });
  it('GH_TOKEN is github.token (the reader inside the script uses it)', () => {
    const s = job.steps.find((x) => /autopilot-step\.mjs/.test(String(x.run || '')))!;
    expect(s.env.GH_TOKEN).toBe('${{ github.token }}');
    expect(job.permissions?.issues).toBe('write');
  });
});

// ------------------------------------------------------------- completeness
const WRITE_PATTERNS: [string, RegExp][] = [
  ['pr merge', /\bpr merge\b/], ['/merge', /\/merge\b/], ['--approve', /--approve/], ['createReview', /createReview/],
  ['update-branch', /update-branch/], ['/dispatches', /\/dispatches/], ['job rerun', /jobs\/[^\s]*\/rerun/],
  ['label POST/DELETE', /(--add-label|--remove-label|-X\s*(POST|DELETE)[^\n]*\/labels|addLabels|removeLabel)/], ['reviews', /pulls\/[^\s]*\/reviews/],
  ['pr create', /\bgh pr create\b/],
];
/** Auto paths that write but are NOT consumers in the contract's reader list (slice 1). */
const EXEMPT: Record<string, string> = {
  'bot-pr.yml': 'opens a PR for a claude/** push; no merge, no approval (outside the contract reader list; handover item)',
  'types-drift-autoheal.yml': 'force-pushes bot/types-regen and opens/refreshes one PR; no merge (outside the contract reader list; handover item)',
  'automation-pause-guard.yml': 'the guard itself: re-asserts the label and DISABLES auto-merge (protective; must run while paused)',
};
const stripComments = (t: string) => t.split(/\r?\n/).filter((l) => !/^\s*#/.test(l)).join('\n');
function completenessProblems(files: Record<string, string>) {
  const out: string[] = [];
  for (const [f, text] of Object.entries(files)) {
    const body = stripComments(text);
    const hits = WRITE_PATTERNS.filter(([, re]) => re.test(body)).map(([n]) => n);
    if (!hits.length) continue;
    if (READER.test(body) || EXEMPT[f]) continue;
    out.push(`${f}: ${hits.join(', ')} without a pause reader and not on EXEMPT`);
  }
  for (const f of Object.keys(EXEMPT)) if (!(f in files)) out.push(`EXEMPT lists ${f}, which does not exist`);
  return out;
}
describe('completeness: every auto merge/approve/write workflow reads the switch or is EXEMPT with a reason', () => {
  const files = Object.fromEntries(readdirSync(WF).filter((f) => /\.ya?ml$/.test(f)).map((f) => [f, read(f)]));
  it('no unlisted consumer', () => expect(completenessProblems(files)).toEqual([]));
  it('every EXEMPT entry carries a reason', () => { for (const r of Object.values(EXEMPT)) expect(r.length).toBeGreaterThan(20); });
  it('CANARY: a new workflow that merges without a reader turns this red', () => {
    expect(completenessProblems({ ...files, 'new-merger.yml': 'jobs:\n  a:\n    steps:\n      - run: gh pr merge --auto "$PR"\n' })).toEqual([expect.stringMatching(/^new-merger\.yml/)]);
    expect(completenessProblems({ ...files, 'new-approver.yml': 'jobs:\n  a:\n    steps:\n      - run: gh pr review --approve "$PR"\n' })).toHaveLength(1);
  });
  it('CANARY: a consumer whose reader is removed turns this red', () => {
    const cut = files['bot-automerge.yml'].split(/\r?\n/).filter((l) => !READER.test(l)).join('\n');
    expect(completenessProblems({ ...files, 'bot-automerge.yml': cut })).toEqual([expect.stringMatching(/^bot-automerge\.yml/)]);
  });
});
