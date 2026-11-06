// Mutants of the autopilot's guards: each one is applied to a temp copy of scripts/lib/autopilot.mjs
// and the decide() table from tests/autopilot.test.ts must catch it. Also pins, by source text, that
// the executor (scripts/autopilot-step.mjs) has no merge / approve / close / force-push call.
// Handover: docs/handover/autopilot-loop-r1.md (mutant table).
import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { BASE, TABLE, MERGE_SITE, R4B_PATHS, R4B_BODIES, R4B_LABELS, R4C_PATHS } from './autopilotTable';

const LIB = path.resolve(__dirname, '../scripts/lib/autopilot.mjs');
const STEP = path.resolve(__dirname, '../scripts/autopilot-step.mjs');
const SRC = readFileSync(LIB, 'utf8');

const MUTANTS: [string, string, string][] = [
  // Website r5 (brief requirement 4): the Vercel build-budget gates.
  ['r5 drop the run-ci Vercel refusal', 'const vr = runCiRefusal(f);', 'const vr = null;'],
  ['r5 allow run-ci on a docs-only PR', "if (f.files.every((p) => /^docs\\//.test(String(p)))) return 'docs-only PR';", ''],
  ['r5 allow run-ci on a [skip preview] head', "if (SKIP_PREVIEW_RE.test(f.headSubject)) return 'head is [skip preview]';", ''],
  ['r5 allow run-ci when the head subject is unread', "if (typeof f.headSubject !== 'string') return 'head subject not read';", ''],
  ['r5 allow run-ci when the file list is unread', "if (!Array.isArray(f.files) || !f.files.length) return 'file list not read';", "if (!Array.isArray(f.files)) return null;"],
  ['r5 update-branch when vercel.json is unread', 'f.deployEnabled !== false', 'f.deployEnabled === true'],
  ['r5 drop the update-branch Vercel gate', 'f.deployEnabled !== false', 'false'],
  ['drop the BEHIND/approved guard', "if (behind && !f.approvedAtHead) return", "if (behind) return"],
  ['drop the migration-queued exclusion', "if (f.labels.includes('migration-queued')) return", 'if (false) return'],
  ['drop the owner-approved migration exclusion', 'if (f.isMigration && f.approvedAtHead) return', 'if (false) return'],
  ['drop the queue-stopped exclusion', "if (f.labels.includes('queue-stopped')) return", 'if (false) return'],
  ['drop the daily cap', 'if (f.ciRunsToday >= f.ciCap) return', 'if (false) return'],
  ['allow merge', "return r('ready', green);", "return r('merge', green);"],
  ['touch a draft', "if (f.draft) return r('none'", "if (false) return r('none'"],
  ['touch a conflicting branch', "if (f.merge === 'dirty') return r('stop'", "if (false) return r('stop'"],
  ['re-add run-ci for ever', "if (f.relabelledAtHead) return r('stop'", "if (false) return r('stop'"],
  // r2 (review 1204-r1). Each anchor is the fix; the table or an EXTRA check must catch its removal.
  ['B1 drop the worker-done gate', "if (!f.workerDone) return", 'if (false) return'],
  ['B1 marker matched anywhere in the message', "const subject = String(message ?? '').split(/\\r?\\n/)[0];", "const subject = String(message ?? '');"],
  ['B1 merge of main counts as running', "if (MERGE_MAIN_RE.test(subject)) return 'merge-main';", ''],
  ['B2 drop the review/walk/done branch skip', 'if (isExcludedBranch(f.ref)) return', 'if (false) return'],
  ['B2 drop the 14-day age skip', 'if (!(f.ageDays <= MAX_AGE_DAYS)) return', 'if (false) return'],
  ['B2 age unknown fails open', 'if (!(f.ageDays <= MAX_AGE_DAYS)) return', 'if (f.ageDays > MAX_AGE_DAYS) return'],
  ['B2 drop the hourly update-branch cap', 'f.updatesThisHour >= f.updateCap) return', 'false) return'],
  ['B2 drop the hourly re-run cap', 'f.rerunsThisHour >= f.rerunCap) return', 'false) return'],
  ['B2 oldest first', 'export const newestFirst = (prs) => [...prs].sort((a, b) => b.number - a.number);', 'export const newestFirst = (prs) => [...prs].sort((a, b) => a.number - b.number);'],
  ['M2 re-run outside the daily CI cap', 'if (f.rerunnable.length && f.ciRunsToday >= f.ciCap) return', 'if (false) return'],
  ['M2 every all-cancelled job is a duplicate again', "const reason = allCancelled ? (dup ? 'cancelled duplicate' : null)", "const reason = allCancelled ? 'cancelled duplicate'"],
  ['M3 the 24 h window fails open', 'const complete = !!exhausted ||', 'const complete = true ||'],
  ['M3 re-runs not counted in the 24 h cap', "return { count: adds + ledgerCount(ledger, 'rerun', now, 24 * 60), complete,", 'return { count: adds, complete,'],
  ['H1 drop the bot-author check', 'if (!f.botAuthored) return', 'if (false) return'],
  ['H1 author check reads the wrong login', 'botAuthored: !!pr.user && pr.user.login === BOT_LOGIN', 'botAuthored: true'],
  ['H2 drop the autopilot-hold skip', 'if (f.labels.includes(HOLD_LABEL)) return', 'if (false) return'],
  ['M1 null label keeps stale ap:* labels', "if (!want) return { add: [], remove: labels.filter((l) => ours.includes(l)) };", 'if (!want) return { add: [], remove: [] };'],
  ['M1 a head change keeps the old label', 'if (!recordedHead || recordedHead === head) return [];', 'return [];'],
  ['N2 trust anyone\'s status marker', 'c.user && c.user.login === STATUS_AUTHOR && ', ''],
];

// Helper-level checks a mutant of a non-decide() fix must break (r2).
const NOW = Date.parse('2026-11-03T12:00:00Z');
const runCi = (ms: number) => ({ event: 'labeled', label: { name: 'run-ci' }, created_at: new Date(ms).toISOString() });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EXTRA: [string, (m: any) => boolean][] = [
  ['marker only on the subject line', (m) => m.classifyHead('feat: x\n\n[worker-done dt_ab]') === 'running'],
  ['merge of main walks to the parent', (m) => m.classifyHead("Merge branch 'main' into claude/x") === 'merge-main'],
  ['newest first', (m) => m.newestFirst([{ number: 1 }, { number: 3 }, { number: 2 }]).map((p: { number: number }) => p.number).join() === '3,2,1'],
  ['an unread 24 h window is incomplete', (m) => m.countCiProofs24h([runCi(NOW - 60000)], false, [], NOW).complete === false],
  ['re-runs spend the 24 h cap', (m) => m.countCiProofs24h([], true, [{ t: NOW - 60000, a: 'rerun', n: 2 }], NOW).count === 2],
  ['owner PR is not bot-authored', (m) => m.listFacts({ number: 1, state: 'open', user: { login: '123constante' }, created_at: '2026-11-03T00:00:00Z', labels: [], head: { sha: 'a', ref: 'claude/x', repo: { full_name: 'o/r' } }, base: { repo: { full_name: 'o/r' } } }, NOW).botAuthored === false],
  ['null label clears ap:*', (m) => m.labelPlan(['ap:ready'], null).remove.join() === 'ap:ready'],
  ['head change clears ap:*', (m) => m.staleLabels(['ap:ready'], 'a', 'b').join() === 'ap:ready'],
  ['planted status marker ignored', (m) => m.findStatusComment([{ user: { login: 'x' }, body: '<!-- autopilot-state {} -->' }]) === null],
  ['human-cancelled job is not re-run', (m) => {
    const H = 'b'.repeat(40);
    const f = m.deriveFacts({ pr: { number: 5, state: 'open', user: { login: 'kiki-claude-bot' }, created_at: '2026-11-03T00:00:00Z', labels: [], mergeable_state: 'clean', head: { sha: H, ref: 'claude/x', repo: { full_name: 'o/r' } }, base: { repo: { full_name: 'o/r' } } },
      checkRuns: [{ name: 'unit', status: 'completed', conclusion: 'cancelled', details_url: 'https://github.com/o/r/actions/runs/11/job/21' }],
      runsAtHead: [{ id: 11, workflow_id: 1, head_sha: H, event: 'pull_request', created_at: '2026-11-03T10:00:00Z' }], runAttempts: { 11: 1 } }, NOW);
    return f.rerunnable.length === 0;
  }],
];

let seq = 0;
async function survivors(src: string) {
  // Written BESIDE the real lib (so its relative import resolves inside vite's root), then deleted.
  const file = path.resolve(__dirname, `../scripts/lib/.autopilot-mutant-${process.pid}-${seq++}.mjs`);
  writeFileSync(file, src);
  try {
    const m = await import(/* @vite-ignore */ pathToFileURL(file).href);
    return [
      ...TABLE.filter(([, o, action, label]) => { const d = m.decide({ ...BASE, ...o }); return d.action !== action || d.label !== label; }).map(([n]) => n),
      ...EXTRA.filter(([, ok]) => { try { return !ok(m); } catch { return true; } }).map(([n]) => `extra: ${n}`),
    ];
  } finally {
    rmSync(file, { force: true });
  }
}

describe('autopilot mutants', () => {
  it('the unmutated copy passes the whole table (the harness is honest)', async () => {
    expect(await survivors(SRC)).toEqual([]);
  });
  for (const [name, from, to] of MUTANTS) {
    it(`catches: ${name}`, async () => {
      expect(SRC.includes(from), `anchor missing for ${name}`).toBe(true);
      const caught = await survivors(SRC.replace(from, to));
      expect(caught.length).toBeGreaterThan(0);
    });
  }
});

describe('the executor has no forbidden write', () => {
  const step = readFileSync(STEP, 'utf8');
  it('never calls merge, reviews (approve), close, or a ref force-update', () => {
    // r4: exactly ONE merge call site (the pinned-sha squash through AUTOMERGE_TOKEN); none other.
    expect(step.split(MERGE_SITE).length).toBe(2);
    expect(step.replace(MERGE_SITE, '')).not.toMatch(/\/merge[`'"]/);
    expect(step).not.toMatch(/\/reviews[`'"],\s*\{/);
    expect(step).not.toMatch(/state:\s*['"]closed['"]/);
    expect(step).not.toMatch(/\/git\/refs/);
    expect(step).not.toMatch(/force:\s*true/);
    expect(step).not.toMatch(/child_process/);
  });
  it('performs a write only for WRITE_ACTIONS and update-branch pins the expected head', () => {
    expect(step).toMatch(/if \(!WRITE_ACTIONS\.includes\(d\.action\)\) return 'nothing'/);
    expect(step).toMatch(/update-branch`, \{ expected_head_sha: f\.head \}/);
  });
  it('r2: the list gate runs before any per-PR read, PRs go newest first, every request is counted', () => {
    expect(step).toMatch(/const open = newestFirst\(/);
    const loop = step.slice(step.indexOf('for (const p of open)'));
    expect(loop.indexOf('listGate(lf)')).toBeLessThan(loop.indexOf('headDone('));
    expect(loop.indexOf('headDone(')).toBeLessThan(loop.indexOf('gather('));
    expect(step).toMatch(/counter\.calls\+\+;/);
  });
  it('a dry run is anything but the literal string false', () => {
    expect(step).toMatch(/const dryRun = env\.DRY_RUN !== 'false';/);
  });
});

// r4b (review 1215-r1 N1/N2/N3, brief docs/briefs/autopilot-loop-r4b.md): mutants of the merge lane,
// each applied to a temp copy beside scripts/lib/autopilot-merge.mjs; the shared R4B_* rows
// (tests/autopilotTable.ts) must catch every one. r4c (review 1217-r1 N4): the R4C_PATHS rows join them.
const MERGE_LIB = path.resolve(__dirname, '../scripts/lib/autopilot-merge.mjs');
const MERGE_SRC = readFileSync(MERGE_LIB, 'utf8').replace(/\r\n/g, '\n');
const NV = '\nNot verified: the phone walk';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function r4bProblems(m: any) {
  const out: string[] = [];
  for (const [p, want] of [...R4B_PATHS, ...R4C_PATHS]) {
    const c = m.laneClass(p);
    const ok = typeof want === 'string' ? c.cls === want && !c.no : !c.cls && want.test(String(c.no));
    if (!ok) out.push(`path ${p}`);
  }
  for (const [b, filled] of R4B_BODIES) if (m.bodyFilled(b + NV).verified !== filled) out.push(`body ${b}`);
  for (const [labels, want] of R4B_LABELS) {
    const r: string[] = m.mergeVerdict({ labels }).reasons;
    if (typeof want === 'string' ? r.includes(want) : !r.some((x) => want.test(x))) out.push(`labels ${labels}`);
  }
  const ev = m.mergeVerdict({ labels: ['review-passed'], pushAnchorMs: 1000, labelEvents: [{ event: 'labeled', label: { name: 'Review-Passed' }, actor: { login: 'kiki-claude-bot' }, created_at: new Date(5000).toISOString() }] });
  if (ev.reasons.some((x: string) => /review-passed/.test(x))) out.push('review-passed event case');
  return out;
}
const R4B_MUTANTS: [string, string, string][] = [
  ['drop the agent-instruction refusal', '  if (isAgentInstructionPath(p)) return { no: `agent-instruction path ${p}` };\n', ''],
  ['agent-instruction refusal at the root only', 'if (isAgentInstructionPath(p)) return', "if (!p.includes('/') && isAgentInstructionPath(p)) return"],
  ['basename matched case-sensitively', 'AGENT_BASENAMES.includes(segs[segs.length - 1])', "AGENT_BASENAMES.includes(String(p).split('/').pop())"],
  ['drop the .claude segment', "export const AGENT_SEGMENTS = ['.claude', '.cursor',", "export const AGENT_SEGMENTS = ['.cursor',"],
  ['accept a lone dash', "return !t || /^[-\\u2010-\\u2015.\\u2026\\s]*$/.test(t) ||", 'return !t ||'],
  ['restore the r4 placeholder test', 'if (!isPlaceholder(text)) seen[key] = true;', "if (text && !/^(-|n\\/a|tbd|todo|none)$/i.test(text.replace(/^[-*]\\s*/, ''))) seen[key] = true;"],
  ['compare labels case-sensitively', 'const labels = Array.isArray(f.labels) ? f.labels.map(lower) : null;', 'const labels = Array.isArray(f.labels) ? f.labels : null;'],
  ['review-passed event name case-sensitive', 'lower(e.label.name) === REVIEW_LABEL', 'e.label.name === REVIEW_LABEL'],
  ['restore the tests class', "return { no: `tests path ${p}: content is not read, owner-merged` };", "return { cls: 'tests' };"],
  // r4c N4 (brief docs/briefs/autopilot-loop-r4c.md): instruction-file names and the .gemini folder.
  ['r4c revert to the exact-name list only', ' || AGENT_NAME_RE.test(base)', ''],
  ['r4c drop the [.-]suffix group', '(claude|agents|gemini|skill)([.-][a-z0-9._-]+)?\\.md$', '(claude|agents|gemini|skill)\\.md$'],
  ['r4c drop .gemini from the segments', ", '.agents', '.gemini'];", ", '.agents'];"],
  ['r4c match the pattern case-sensitively', 'AGENT_NAME_RE.test(base)', "new RegExp(AGENT_NAME_RE.source).test(String(p).split(/[\\\\/]+/).pop())"],
  ['r4c match the pattern against the whole path', 'AGENT_NAME_RE.test(base)', 'AGENT_NAME_RE.test(String(p).toLowerCase())'],
];
let r4bSeq = 0;
async function r4bSurvivors(src: string) {
  const file = path.resolve(__dirname, `../scripts/lib/.autopilot-r4b-mutant-${process.pid}-${r4bSeq++}.mjs`);
  writeFileSync(file, src);
  try {
    return r4bProblems(await import(/* @vite-ignore */ pathToFileURL(file).href));
  } finally {
    rmSync(file, { force: true });
  }
}
describe('r4b merge-lane mutants', () => {
  it('the unmutated copy passes every r4b row (the harness is honest)', async () => {
    expect(await r4bSurvivors(MERGE_SRC)).toEqual([]);
  });
  for (const [name, from, to] of R4B_MUTANTS) {
    it(`catches: ${name}`, async () => {
      expect(MERGE_SRC.includes(from), `anchor missing for ${name}`).toBe(true);
      expect((await r4bSurvivors(MERGE_SRC.replace(from, to))).length).toBeGreaterThan(0);
    });
  }
});
