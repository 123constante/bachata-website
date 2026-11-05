// Slice 2 (foundations-web), PART 3: the arming file (drill A30). Arming moves OUT of repo variables
// into the checked-in .github/automation/arming.json on main. Every reader reads the FILE; the old
// variables are DRIFT input only (a variable that disagrees with the file logs
// `arming drift: <VAR>=<value> but arming.json says <value>` and changes nothing).
// Readers: the CLI the workflows run (scripts/automation-arming.mjs), scripts/autopilot-step.mjs
// run(), and the three workflows (autopilot.yml, bot-automerge.yml, dependabot-automerge.yml).
// Each reader has a MUTANT that reads the variable instead of the file and must turn its test red.
// Doc: docs/automation-foundations.md.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse, stringify } from 'yaml';
import { readArming, effectiveArming, varsFromEnv, SAFE_ARMING, ARMING_PATH, ARMING_VARS } from '../scripts/lib/arming.mjs';
import { main as armingCli } from '../scripts/automation-arming.mjs';
import { run, defaultFoundations } from '../scripts/autopilot-step.mjs';
import { NOT_PAUSED, FOUNDATIONS_OK } from './autopilotTable';
import { fakeGitHub, ENV, NOW } from './automationFakeGitHub';

const ROOT = path.resolve(__dirname, '..');
const FILE_TEXT = readFileSync(path.join(ROOT, ARMING_PATH), 'utf8');
const OFF = JSON.stringify({ version: 1, autopilot_live: false, autopilot_merge_mode: 'off', automerge_enabled: false, bot_automerge_enabled: false, approver: false, audit_escalation: false });
const ARMED = JSON.stringify({ version: 1, autopilot_live: true, autopilot_merge_mode: 'soft', automerge_enabled: true, bot_automerge_enabled: true, approver: false, audit_escalation: false });
const noVersion = (t: string) => { const o = JSON.parse(t); delete o.version; return o; };
// The A30 attack: variables written to "arm" everything while the file says off.
const A30_VARS = { AUTOPILOT_LIVE: 'true', AUTOMERGE_ENABLED: 'true', AUTOPILOT_MERGE_MODE: 'soft' };
const A30_DRIFT = [
  'arming drift: AUTOPILOT_LIVE=true but arming.json says false',
  'arming drift: AUTOPILOT_MERGE_MODE=soft but arming.json says off',
  'arming drift: AUTOMERGE_ENABLED=true but arming.json says false',
];

// ---------------------------------------------------------------- the file
describe('arming.json (PART 3.1): mirrors TODAY\'s effective state, so merging this changes no behaviour', () => {
  it('exact content (fact 3: AUTOMERGE_ENABLED=true, BOT_AUTOMERGE_ENABLED=true, AUTOPILOT_LIVE / AUTOPILOT_MERGE_MODE unset)', () => {
    expect(JSON.parse(FILE_TEXT)).toEqual({ version: 1, autopilot_live: false, autopilot_merge_mode: 'off', automerge_enabled: true, bot_automerge_enabled: true, approver: false, audit_escalation: false });
  });
  it('reads clean: no drift line from the file itself', () => {
    expect(readArming(FILE_TEXT).problems).toEqual([]);
  });
  it('today\'s variables against today\'s file: silent (no drift, no notice)', () => {
    const e = effectiveArming({ file: FILE_TEXT, vars: { AUTOMERGE_ENABLED: 'true', BOT_AUTOMERGE_ENABLED: 'true' } });
    expect(e.drift).toEqual([]);
    expect(e.notices).toEqual([]);
    expect(e.values).toEqual(readArming(FILE_TEXT).values);
  });
  it('lives under .github/** (a guard path: changing it is a human-merged guard change)', () => {
    expect(ARMING_PATH).toBe('.github/automation/arming.json');
  });
});

// ---------------------------------------------------------------- readArming: strict, fail closed
describe('readArming(text): strict; anything missing / unreadable / unknown = the SAFE value and a drift line', () => {
  it('the safe reading is off / false for every key', () => {
    expect(SAFE_ARMING).toEqual({ autopilot_live: false, autopilot_merge_mode: 'off', automerge_enabled: false, bot_automerge_enabled: false, approver: false, audit_escalation: false });
  });
  const T: [string, unknown, Record<string, unknown>, RegExp | null][] = [
    ['valid armed file', ARMED, noVersion(ARMED), null],
    ['not JSON', '{ nope', {}, /^arming drift: arming\.json unreadable/],
    ['null (file missing)', null, {}, /^arming drift: arming\.json unreadable/],
    ['an array', '[]', {}, /^arming drift: arming\.json unreadable/],
    ['wrong version', JSON.stringify({ ...JSON.parse(ARMED), version: 2 }), {}, /^arming drift: arming\.json version/],
    ['missing key = safe', JSON.stringify({ version: 1, autopilot_live: true }), { autopilot_live: true }, /^arming drift: arming\.json automerge_enabled missing/],
    ['string "true" is not true', JSON.stringify({ ...JSON.parse(OFF), automerge_enabled: 'true' }), {}, /^arming drift: arming\.json automerge_enabled is not a boolean/],
    ['unknown mode = off', JSON.stringify({ ...JSON.parse(OFF), autopilot_merge_mode: 'Soft' }), {}, /^arming drift: arming\.json autopilot_merge_mode/],
    ['unknown key is reported', JSON.stringify({ ...JSON.parse(OFF), turbo: true }), {}, /^arming drift: arming\.json unknown key turbo/],
  ];
  for (const [name, text, want, problem] of T) {
    it(name, () => {
      const r = readArming(text as string);
      expect(r.values).toEqual({ ...SAFE_ARMING, ...want });
      if (problem) expect(r.problems.some((p: string) => problem.test(p))).toBe(true);
      else expect(r.problems).toEqual([]);
    });
  }
  it('never throws', () => {
    for (const t of [undefined, 42, '', 'null', '"x"', '{"version":1,"autopilot_live":null}']) expect(() => readArming(t as string)).not.toThrow();
  });
});

// ---------------------------------------------------------------- effectiveArming: the file is authoritative
describe('effectiveArming({file, vars}) (PART 3.2): the file decides, a disagreeing variable is a drift line', () => {
  it('A30: AUTOPILOT_LIVE=true, AUTOMERGE_ENABLED=true, AUTOPILOT_MERGE_MODE=soft while the file says off: values are the FILE\'s, three drift lines', () => {
    const e = effectiveArming({ file: OFF, vars: A30_VARS });
    expect(e.values).toEqual(noVersion(OFF));
    expect([...e.drift].sort()).toEqual([...A30_DRIFT].sort());
    expect(e.notices.map((n: { key: string }) => n.key).sort()).toEqual(['arming-drift:AUTOMERGE_ENABLED:true', 'arming-drift:AUTOPILOT_LIVE:true', 'arming-drift:AUTOPILOT_MERGE_MODE:soft']);
  });
  it('a variable equal to the file is silent; an unset or empty one is silent', () => {
    expect(effectiveArming({ file: ARMED, vars: { AUTOPILOT_LIVE: 'true', AUTOPILOT_MERGE_MODE: 'soft', AUTOMERGE_ENABLED: '', BOT_AUTOMERGE_ENABLED: undefined } }).drift).toEqual([]);
  });
  it('a variable that says false while the file says true is ALSO drift (the file still decides)', () => {
    const e = effectiveArming({ file: ARMED, vars: { BOT_AUTOMERGE_ENABLED: 'false' } });
    expect(e.values.bot_automerge_enabled).toBe(true);
    expect(e.drift).toEqual(['arming drift: BOT_AUTOMERGE_ENABLED=false but arming.json says true']);
  });
  it('an unreadable file: SAFE values, its drift line, and a variable cannot arm anything', () => {
    const e = effectiveArming({ file: null, vars: A30_VARS });
    expect(e.values).toEqual(SAFE_ARMING);
    expect(e.drift.some((d: string) => /^arming drift: arming\.json unreadable/.test(d))).toBe(true);
  });
  it('a hostile variable value cannot break the notice key (no newline, no >)', () => {
    const e = effectiveArming({ file: OFF, vars: { AUTOPILOT_MERGE_MODE: 'soft\n<!-- x -->' } });
    expect(e.notices).toHaveLength(1);
    expect(e.notices[0].key).toMatch(/^arming-drift:AUTOPILOT_MERGE_MODE:[A-Za-z0-9._-]+$/);
    expect(e.values.autopilot_merge_mode).toBe('off');
  });
  it('varsFromEnv reads ONLY the ARMING_VAR_ drift inputs (the plain names are never an input)', () => {
    expect(Object.keys(ARMING_VARS).sort()).toEqual(['AUTOMERGE_ENABLED', 'AUTOPILOT_LIVE', 'AUTOPILOT_MERGE_MODE', 'BOT_AUTOMERGE_ENABLED']);
    expect(varsFromEnv({ AUTOPILOT_MERGE_MODE: 'soft', ARMING_VAR_AUTOPILOT_LIVE: 'true' })).toEqual({ AUTOPILOT_LIVE: 'true' });
  });
});

// ---------------------------------------------------------------- the CLI the workflows run
type Notice = { repo: string; token: string; key: string; text: string };
async function cli(argv: string[], env: Record<string, string | undefined>, fileText: string | null, cliMain = armingCli) {
  const outputs: string[] = [];
  const lines: string[] = [];
  const summary: string[] = [];
  const notices: Notice[] = [];
  const code = await cliMain(argv, env, {
    readFile: () => { if (fileText === null) throw new Error('ENOENT'); return fileText; },
    writeOutput: (l: string) => outputs.push(l),
    writeSummary: (s: string) => summary.push(s),
    out: (s: string) => lines.push(s),
    postNotice: async (n: Notice) => { notices.push(n); return { posted: true, skipped: false, error: null }; },
  });
  return { code, outputs, out: lines.join('\n'), summary: summary.join('\n'), notices };
}
const A30_ENV = { ARMING_VAR_AUTOPILOT_LIVE: 'true', ARMING_VAR_AUTOMERGE_ENABLED: 'true', ARMING_VAR_AUTOPILOT_MERGE_MODE: 'soft', GH_TOKEN: 't', GITHUB_REPOSITORY: 'o/r' };
describe('scripts/automation-arming.mjs: the workflows\' reader', () => {
  it('A30: the outputs are the FILE\'s values; the drift goes to the log (::notice::) and the step summary; exit 0', async () => {
    const r = await cli(['--gate', 'automerge_enabled'], A30_ENV, OFF);
    expect(r.code).toBe(0);
    expect(r.outputs).toEqual(expect.arrayContaining(['autopilot_live=false', 'autopilot_merge_mode=off', 'automerge_enabled=false', 'bot_automerge_enabled=false', 'enabled=false']));
    for (const d of A30_DRIFT) {
      expect(r.out).toContain(`::notice::${d}`);
      expect(r.summary).toContain(d);
    }
  });
  it('off: a visible ::notice:: that the job stays green and every later step is skipped', async () => {
    const r = await cli(['--gate', 'automerge_enabled,bot_automerge_enabled'], {}, OFF);
    expect(r.code).toBe(0);
    expect(r.outputs).toContain('enabled=false');
    expect(r.out).toMatch(/::notice::arming: OFF .*automerge_enabled=false/);
  });
  it('today: the real file with today\'s variables enables both auto-merge workflows, silently', async () => {
    const env = { ARMING_VAR_AUTOMERGE_ENABLED: 'true', ARMING_VAR_BOT_AUTOMERGE_ENABLED: 'true' };
    const bot = await cli(['--gate', 'automerge_enabled,bot_automerge_enabled'], env, FILE_TEXT);
    const dep = await cli(['--gate', 'automerge_enabled'], env, FILE_TEXT);
    expect(bot.outputs).toContain('enabled=true');
    expect(dep.outputs).toContain('enabled=true');
    expect(bot.out).not.toMatch(/arming drift/);
  });
  it('an unreadable file: enabled=false, a drift line, still exit 0 (green, nothing enabled)', async () => {
    const r = await cli(['--gate', 'automerge_enabled'], A30_ENV, null);
    expect(r.code).toBe(0);
    expect(r.outputs).toContain('enabled=false');
    expect(r.out).toMatch(/arming drift: arming\.json unreadable/);
  });
  it('an unknown gate key is a usage error (exit 2) and still writes enabled=false', async () => {
    const r = await cli(['--gate', 'automerge_enabledd'], {}, ARMED);
    expect(r.code).toBe(2);
    expect(r.outputs).toContain('enabled=false');
  });
  it('--post-notices: ONE notice per distinct drift through postPauseNotice, key arming-drift:<VAR>:<value>', async () => {
    const r = await cli(['--post-notices'], A30_ENV, OFF);
    expect(r.notices.map((n) => n.key).sort()).toEqual(['arming-drift:AUTOMERGE_ENABLED:true', 'arming-drift:AUTOPILOT_LIVE:true', 'arming-drift:AUTOPILOT_MERGE_MODE:soft']);
    expect(r.notices.every((n) => n.repo === 'o/r' && n.token === 't')).toBe(true);
    for (const n of r.notices) expect(A30_DRIFT.some((d) => n.text.includes(d))).toBe(true);
  });
  it('no drift: no notice posted; without --post-notices nothing is posted either', async () => {
    expect((await cli(['--post-notices'], {}, OFF)).notices).toEqual([]);
    expect((await cli([], A30_ENV, OFF)).notices).toEqual([]);
  });
  it('a notice that cannot be posted is a ::warning::, never a red run', async () => {
    const r = await armingCli(['--post-notices'], A30_ENV, { readFile: () => OFF, writeOutput: () => {}, writeSummary: () => {}, out: () => {}, postNotice: async () => ({ posted: false, skipped: false, error: 'HTTP 403' }) });
    expect(r).toBe(0);
  });
});

// ---------------------------------------------------------------- run(): scripts/autopilot-step.mjs
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RunFn = (env: any, opts: any) => Promise<number>;
const realArming = (text: string | null) => defaultFoundations({ readFile: (p: string) => (p.endsWith('arming.json') ? (text === null ? (() => { throw new Error('ENOENT'); })() : text) : readFileSync(p, 'utf8')) }).arming;
async function lane(runFn: RunFn, env: Record<string, string | undefined>, arming: unknown) {
  const gh = fakeGitHub({ n: 95 });
  const lines: string[] = [];
  const spy = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => { lines.push(a.map(String).join(' ')); });
  let code: number;
  try {
    code = await runFn(env, { pauseReader: NOT_PAUSED.pauseReader, now: NOW, fetch: gh.fetchImpl, foundations: { ...FOUNDATIONS_OK.opts.foundations, ...(arming ? { arming } : {}) } });
  } finally { spy.mockRestore(); }
  return { code, merges: gh.merges().length, out: lines.join('\n') };
}
// The lane's old variable, plus the A30 drift inputs, all saying "armed".
const A30_STEP_ENV = { ...ENV, AUTOPILOT_MERGE_MODE: 'soft', ARMING_VAR_AUTOPILOT_MERGE_MODE: 'soft', ARMING_VAR_AUTOPILOT_LIVE: 'true', ARMING_VAR_AUTOMERGE_ENABLED: 'true' };
describe('run(): the merge mode is the arming FILE\'s value, never AUTOPILOT_MERGE_MODE (PART 3.3)', () => {
  it('A30: variables say soft, the file says off: NO merge, mode off, drift line logged', async () => {
    const r = await lane(run as RunFn, A30_STEP_ENV, realArming(OFF));
    expect(r.merges).toBe(0);
    expect(r.out).toContain('Merge lane: mode off');
    expect(r.out).toContain('arming drift: AUTOPILOT_MERGE_MODE=soft but arming.json says off');
  });
  it('the DEFAULT reader (no injection) reads the real file on the checkout (today: off): NO merge', async () => {
    const r = await lane(run as RunFn, A30_STEP_ENV, null);
    expect(r.merges).toBe(0);
    expect(r.out).toContain('Merge lane: mode off');
  });
  it('control: the FILE says soft and no variable is set: the same PR merges (the file is what decides)', async () => {
    const r = await lane(run as RunFn, { ...ENV, AUTOPILOT_MERGE_MODE: undefined }, realArming(ARMED));
    expect(r.merges).toBe(1);
    expect(r.out).not.toMatch(/arming drift/);
  });
  it('an unreadable file = mode off, whatever the variables say', async () => {
    const r = await lane(run as RunFn, A30_STEP_ENV, realArming(null));
    expect(r.merges).toBe(0);
    expect(r.out).toMatch(/arming drift: arming\.json unreadable/);
  });
});

// ---------------------------------------------------------------- mutants: a reader that reads the variable
const lf = (f: string) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
let seq = 0;
async function loadBeside(file: string, src: string) {
  const f = path.join(path.dirname(file), `.arming-mutant-${process.pid}-${seq++}.mjs`);
  writeFileSync(f, src);
  try { return await import(/* @vite-ignore */ pathToFileURL(f).href); } finally { rmSync(f, { force: true }); }
}
const STEP = path.join(ROOT, 'scripts/autopilot-step.mjs');
const CLI = path.join(ROOT, 'scripts/automation-arming.mjs');
const STEP_READ = 'const mode = parseMergeMode(arming.values.autopilot_merge_mode);';
const CLI_READ = 'const { values, drift, notices } = effectiveArming({ file: text, vars });';
describe('MUTANTS: a reader that reads the variable instead of the file turns A30 red', () => {
  it('autopilot-step: mode from env.AUTOPILOT_MERGE_MODE merges at the A30 head', async () => {
    const src = lf(STEP);
    expect(src.split(STEP_READ).length).toBe(2);
    const m = await loadBeside(STEP, src.replace(STEP_READ, 'const mode = parseMergeMode(env.AUTOPILOT_MERGE_MODE);'));
    const r = await lane(m.run, A30_STEP_ENV, realArming(OFF));
    expect(r.merges).toBe(1); // the A30 test above asserts 0: this mutant makes it red
  });
  it('the CLI: values from the variables enable auto-merge under A30', async () => {
    const src = lf(CLI);
    expect(src.split(CLI_READ).length).toBe(2);
    const legacy = 'const { values, drift, notices } = { values: Object.fromEntries(Object.entries(ARMING_VARS).map(([v, k]) => [k, vars[v] === \'true\' ? true : vars[v] === \'false\' ? false : (vars[v] ?? false)])), drift: [], notices: [] };';
    const m = await loadBeside(CLI, src.replace(CLI_READ, legacy));
    const r = await cli(['--gate', 'automerge_enabled'], A30_ENV, OFF, m.main);
    expect(r.outputs).toContain('enabled=true'); // the A30 CLI test asserts enabled=false
  });
});

// ---------------------------------------------------------------- the workflows: vars.* only as drift input
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Step = Record<string, any>;
const WF = (n: string) => path.join(ROOT, '.github/workflows', n);
const ARMING_VAR_RE = /vars\.(AUTOPILOT_[A-Z_]+|AUTOMERGE_[A-Z_]+|BOT_AUTOMERGE_[A-Z_]+)/;
/** Every place an old arming variable is read must be `ARMING_VAR_<X>: ${{ vars.<X> }}` (drift input). */
function armingVarProblems(text: string): string[] {
  const out: string[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (/^\s*#/.test(line) || !ARMING_VAR_RE.test(line)) return;
    const m = /^\s*ARMING_VAR_([A-Z_]+): \$\{\{ vars\.([A-Z_]+) \}\}\s*$/.exec(line);
    if (!m || m[1] !== m[2]) out.push(`line ${i + 1}: an arming variable read outside the drift input: ${line.trim()}`);
  });
  return out;
}
const isArmingStep = (s: Step) => /node scripts\/automation-arming\.mjs/.test(String(s.run || ''));
/** bot-automerge / dependabot: checkout(main, no creds) -> setup-node -> the arming step -> every later step gated on it. */
function gateProblems(text: string, job: string, gate: string): string[] {
  const out = armingVarProblems(text);
  const j = parse(text).jobs[job];
  if (ARMING_VAR_RE.test(String(j.if || ''))) out.push('job if reads a variable');
  const steps: Step[] = j.steps;
  const i = steps.findIndex(isArmingStep);
  if (i < 0) return [...out, 'no arming step'];
  const a = steps[i];
  if (a.id !== 'arming') out.push('arming step id is not arming');
  if (String(a.run).trim() !== `node scripts/automation-arming.mjs --gate ${gate}`) out.push(`arming step does not gate on ${gate}`);
  if (a['continue-on-error'] || a.if) out.push('arming step is conditional or hides a crash');
  const co = steps.findIndex((s) => /^actions\/checkout@/.test(String(s.uses || '')));
  if (co < 0 || co > i || steps[co].with?.ref !== 'main' || steps[co].with?.['persist-credentials'] !== false) out.push('no main checkout without credentials before the arming step');
  for (const s of steps.slice(0, i)) if (!/^actions\/(checkout|setup-node)@/.test(String(s.uses || ''))) out.push(`step before arming: ${s.name || s.uses || s.id}`);
  for (const s of steps.slice(i + 1)) if (!/steps\.arming\.outputs\.enabled == 'true'/.test(String(s.if || ''))) out.push(`not gated on arming: ${s.name || s.id || s.uses}`);
  return out;
}
function autopilotProblems(text: string): string[] {
  const out = armingVarProblems(text);
  const wf = parse(text);
  const a = wf.jobs.arming;
  if (!a) return [...out, 'no arming job'];
  const co = a.steps.find((s: Step) => /^actions\/checkout@/.test(String(s.uses || '')));
  if (!co || co.with?.ref !== 'main' || co.with?.['persist-credentials'] !== false) out.push('arming job: no main checkout without credentials');
  const st = a.steps.find(isArmingStep);
  if (!st || String(st.run).trim() !== 'node scripts/automation-arming.mjs --post-notices' || st.id !== 'arming') out.push('arming job: the reader step is not `node scripts/automation-arming.mjs --post-notices` (id arming)');
  if (a.outputs?.autopilot_live !== '${{ steps.arming.outputs.autopilot_live }}') out.push('arming job does not export autopilot_live');
  const perms = Object.entries(a.permissions || {}).map(([k, v]) => `${k}:${v}`).sort();
  if (JSON.stringify(perms) !== JSON.stringify(['contents:read', 'issues:write'])) out.push(`arming job permissions ${perms.join(',')}`);
  const ap = wf.jobs.autopilot;
  if (!(ap.needs === 'arming' || (Array.isArray(ap.needs) && ap.needs.includes('arming')))) out.push('autopilot does not need arming');
  const step = ap.steps.find((s: Step) => /autopilot-step\.mjs/.test(String(s.run || '')));
  if (!/needs\.arming\.outputs\.autopilot_live == 'true'/.test(String(step.env.DRY_RUN))) out.push('DRY_RUN does not come from arming.json');
  if ('AUTOPILOT_MERGE_MODE' in step.env) out.push('the step still gets AUTOPILOT_MERGE_MODE as behaviour input');
  const af = wf.jobs['announce-failure'];
  if (!/needs\.arming\.outputs\.autopilot_live == 'true'/.test(String(af.if))) out.push('announce-failure does not read arming.json');
  return out;
}
describe('workflows: no vars.AUTOPILOT_* / AUTOMERGE_* / BOT_AUTOMERGE_* in an if: or a behaviour env (PART 3.3, A30)', () => {
  it('autopilot.yml', () => expect(autopilotProblems(readFileSync(WF('autopilot.yml'), 'utf8'))).toEqual([]));
  it('bot-automerge.yml', () => expect(gateProblems(readFileSync(WF('bot-automerge.yml'), 'utf8'), 'decide', 'automerge_enabled,bot_automerge_enabled')).toEqual([]));
  it('dependabot-automerge.yml', () => expect(gateProblems(readFileSync(WF('dependabot-automerge.yml'), 'utf8'), 'enable', 'automerge_enabled')).toEqual([]));
  it('no workflow writes a variable (A30: nothing here may arm by variable)', () => {
    for (const n of ['autopilot.yml', 'bot-automerge.yml', 'dependabot-automerge.yml']) {
      const t = readFileSync(WF(n), 'utf8');
      expect(t).not.toMatch(/gh variable|actions\/variables|variables:\s*write/);
    }
  });
  it('no permission widening: the workflow-level blocks are unchanged', () => {
    expect(parse(readFileSync(WF('autopilot.yml'), 'utf8')).permissions).toEqual({ contents: 'read' });
    expect(parse(readFileSync(WF('bot-automerge.yml'), 'utf8')).permissions).toEqual({ contents: 'read', 'pull-requests': 'write', issues: 'read' });
    expect(parse(readFileSync(WF('dependabot-automerge.yml'), 'utf8')).permissions).toEqual({ contents: 'write', 'pull-requests': 'write', issues: 'read' });
  });
  it('the arming steps never interpolate an expression into run:', () => {
    for (const n of ['autopilot.yml', 'bot-automerge.yml', 'dependabot-automerge.yml']) {
      const wf = parse(readFileSync(WF(n), 'utf8'));
      for (const j of Object.values(wf.jobs) as { steps?: Step[] }[]) for (const s of j.steps || []) if (isArmingStep(s)) expect(String(s.run)).not.toMatch(/\$\{\{/);
    }
  });
});
describe('MUTANTS: a workflow reader that reads the variable turns the structure test red', () => {
  it('bot-automerge with the old job-level vars gate', () => {
    const wf = parse(readFileSync(WF('bot-automerge.yml'), 'utf8'));
    wf.jobs.decide.if = `vars.AUTOMERGE_ENABLED == 'true' && ${wf.jobs.decide.if}`;
    expect(gateProblems(stringify(wf), 'decide', 'automerge_enabled,bot_automerge_enabled').length).toBeGreaterThan(0);
  });
  it('dependabot with one later step not gated on the file', () => {
    const wf = parse(readFileSync(WF('dependabot-automerge.yml'), 'utf8'));
    const en = wf.jobs.enable.steps.find((s: Step) => /^Enable auto-merge/.test(String(s.name || '')));
    en.if = String(en.if).replace(/steps\.arming\.outputs\.enabled == 'true' && /, '');
    expect(gateProblems(stringify(wf), 'enable', 'automerge_enabled')).toContain('not gated on arming: Enable auto-merge (GitHub merges when required checks pass)');
  });
  it('autopilot with DRY_RUN from vars.AUTOPILOT_LIVE again', () => {
    const wf = parse(readFileSync(WF('autopilot.yml'), 'utf8'));
    const step = wf.jobs.autopilot.steps.find((s: Step) => /autopilot-step\.mjs/.test(String(s.run || '')));
    step.env.DRY_RUN = String(step.env.DRY_RUN).replace("needs.arming.outputs.autopilot_live == 'true'", "vars.AUTOPILOT_LIVE == 'true'");
    expect(autopilotProblems(stringify(wf)).length).toBeGreaterThan(0);
  });
  it('autopilot with AUTOPILOT_MERGE_MODE from the variable again', () => {
    const wf = parse(readFileSync(WF('autopilot.yml'), 'utf8'));
    const step = wf.jobs.autopilot.steps.find((s: Step) => /autopilot-step\.mjs/.test(String(s.run || '')));
    step.env.AUTOPILOT_MERGE_MODE = '${{ vars.AUTOPILOT_MERGE_MODE }}';
    expect(autopilotProblems(stringify(wf)).length).toBeGreaterThan(0);
  });
});
