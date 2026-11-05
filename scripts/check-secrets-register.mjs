#!/usr/bin/env node
/**
 * check-secrets-register.mjs -- the secrets / identity register against the workflows
 * (contract section 6, criteria 6.2(1), 6.2(7) static half of drill A34, 6.2(10); slice 2).
 *
 * The register is `.github/automation/secrets-register.json` (a GUARD path: owner Approve at
 * head). This check MEASURES every `secrets.<NAME>` reference in .github/workflows/*.yml with a
 * real YAML parse (expressions only: `${{ ... }}` and `if:` values -- never prose, never a
 * script file name) and fails when:
 *   (a) a secret used by a workflow is not in the register (GITHUB_TOKEN exempt), or an entry
 *       says `exists: false` while a workflow already reads it (unless that workflow is in the
 *       entry's `absent_readers` with a dated reason; a stale one, or one on an existing entry, fails);
 *   (b) a measured reader is not in that entry's `readers_allowed`; an allowed reader nothing
 *       reads any more (stale); a reader beyond the contract's minimum list (`contract_readers`)
 *       without a dated `grandfathered` reason;
 *   (c) a workflow reading a register secret is reachable from `pull_request`,
 *       `pull_request_target` (unless the job checks out only `ref: main`, or nothing) or a
 *       `push` that is not limited to `main` -- unless that (secret, workflow) pair is in the
 *       entry's `untrusted_trigger_grandfathered` with a dated reason (a stale one fails too).
 *       This is the static half of drill A34 / 6.2(7); the live half needs the real token;
 *   (d) any `acts_as` equals `owner_login` (case-insensitive: GitHub logins are);
 *   (e) a self-hosted `runs-on` label is reachable from those triggers (Website has none);
 *   (f) `actual_scope` is anything but "NOT VERIFIED" or a list of `perm:read|write` tokens
 *       each covered by `required_minimum_scope` (a recorded scope wider than the minimum fails).
 *
 * --expiry (automation-token-expiry.yml): for an entry whose `expiry` is within 7 days, and
 * again within 1 day, post ONE notice on the pinned `AUTOMATION PAUSE SWITCH` issue through
 * slice 1's postPauseNotice (key `expiry:<name>:<expiry>:<7d|1d|past>`); past expiry = exit 1.
 * Node built-ins only on that path (the workflow does not run npm ci); `yaml` is loaded lazily
 * for the measuring path only.
 *
 * Exit: 0 pass, 1 a rule above is violated (or a token is past expiry), 2 could not measure
 * (register unreadable / malformed, a workflow that does not parse, no workflows found, a
 * notice that was due but could not be posted).
 *
 *   node scripts/check-secrets-register.mjs
 *   node scripts/check-secrets-register.mjs --expiry [--today YYYY-MM-DD]
 *   node scripts/check-secrets-register.mjs --self-test
 */
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEntryPoint } from './lib/entry-point.mjs';
import { postPauseNotice } from './lib/automation-pause.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REGISTER_PATH = path.join(REPO_ROOT, '.github', 'automation', 'secrets-register.json');
export const WORKFLOW_DIR = path.join(REPO_ROOT, '.github', 'workflows');
export const OWNER_LOGIN = '123constante';
const DATED = /\b20\d\d-\d\d-\d\d\b/;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const REQUIRED_FIELDS = ['name', 'kind', 'acts_as', 'owner_login', 'required_minimum_scope', 'actual_scope', 'expiry', 'readers_allowed', 'exists'];

/** Strict register parse. -> { ok:true, register } | { ok:false, reason }. Never throws. */
export function parseRegister(text) {
  let data;
  try {
    data = JSON.parse(String(text));
  } catch (e) {
    return { ok: false, reason: 'register is not valid JSON: ' + e.message };
  }
  if (!data || typeof data !== 'object' || data.version !== 1) return { ok: false, reason: 'register must be an object with "version": 1' };
  if (!Array.isArray(data.entries) || data.entries.length === 0) return { ok: false, reason: 'register "entries" must be a non-empty array' };
  const seen = new Set();
  for (const e of data.entries) {
    if (!e || typeof e !== 'object') return { ok: false, reason: 'register entry is not an object' };
    for (const k of REQUIRED_FIELDS) if (!(k in e)) return { ok: false, reason: `entry ${e.name || '?'} lacks "${k}"` };
    if (typeof e.name !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(e.name)) return { ok: false, reason: `entry name ${JSON.stringify(e.name)} is not a secret name` };
    if (seen.has(e.name)) return { ok: false, reason: `entry ${e.name} appears twice` };
    seen.add(e.name);
    if (!Array.isArray(e.readers_allowed) || e.readers_allowed.some((r) => typeof r !== 'string')) return { ok: false, reason: `entry ${e.name}: readers_allowed must be an array of workflow file names` };
    if (e.contract_readers != null && !Array.isArray(e.contract_readers)) return { ok: false, reason: `entry ${e.name}: contract_readers must be an array or null` };
    if (!Array.isArray(e.required_minimum_scope)) return { ok: false, reason: `entry ${e.name}: required_minimum_scope must be an array of permission tokens` };
    if (typeof e.exists !== 'boolean') return { ok: false, reason: `entry ${e.name}: exists must be true or false` };
    for (const k of ['grandfathered', 'untrusted_trigger_grandfathered']) {
      if (e[k] != null && (typeof e[k] !== 'object' || Array.isArray(e[k]))) return { ok: false, reason: `entry ${e.name}: ${k} must be an object` };
    }
  }
  return { ok: true, register: data };
}

/** ['contents:write', ...] -> [{perm, level}] (read=1, write=2), or null when malformed. */
export function parseScope(list) {
  if (!Array.isArray(list)) return null;
  const out = [];
  for (const t of list) {
    const m = typeof t === 'string' ? /^([a-z][a-z-]*):(read|write)$/.exec(t) : null;
    if (!m) return null;
    out.push({ perm: m[1], level: m[2] === 'write' ? 2 : 1 });
  }
  return out;
}

let yamlParse = null;
function parseYaml(text) {
  if (!yamlParse) yamlParse = createRequire(import.meta.url)('yaml').parse;
  return yamlParse(text);
}

const SECRET_RE = /(?<![\w.-])secrets\s*(?:\.\s*([A-Za-z_][A-Za-z0-9_]*)|\[\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]\s*\])/g;

function secretsInExpression(expr, into) {
  for (const m of String(expr).matchAll(SECRET_RE)) into.add(m[1] || m[2]);
}

/** Every secret referenced by a YAML value tree (expressions inside strings; whole `if:` values). */
function collectSecrets(node, into, key = '') {
  if (typeof node === 'string') {
    if (key === 'if') secretsInExpression(node, into);
    for (const m of node.matchAll(/\$\{\{([\s\S]*?)\}\}/g)) secretsInExpression(m[1], into);
  } else if (Array.isArray(node)) {
    for (const v of node) collectSecrets(v, into);
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) collectSecrets(v, into, k);
  }
}

function triggersOf(doc) {
  const raw = doc && (doc.on ?? doc[true] ?? doc.true);
  if (typeof raw === 'string') return { [raw]: null };
  if (Array.isArray(raw)) return Object.fromEntries(raw.filter((t) => typeof t === 'string').map((t) => [t, null]));
  if (raw && typeof raw === 'object') return raw;
  return {};
}

/** The untrusted triggers of a workflow, as [{trigger, kind}] (kind: pr | prt | push). */
function untrustedTriggers(on) {
  const out = [];
  if ('pull_request' in on) out.push({ trigger: 'pull_request', kind: 'pr' });
  if ('pull_request_target' in on) out.push({ trigger: 'pull_request_target', kind: 'prt' });
  if ('push' in on) {
    const p = on.push && typeof on.push === 'object' ? on.push : {};
    const b = Array.isArray(p.branches) ? p.branches.map(String) : null;
    const onlyMain = b !== null && b.length > 0 && b.every((x) => x === 'main') && !p.tags && !p['branches-ignore'];
    if (!onlyMain) out.push({ trigger: b ? `push (branches: ${b.join(', ')})` : 'push (any branch)', kind: 'push' });
  }
  return out;
}

const isCheckout = (s) => s && typeof s.uses === 'string' && /^actions\/checkout@/.test(s.uses);
function checksOutOnlyMain(job) {
  const steps = Array.isArray(job && job.steps) ? job.steps : [];
  return steps.filter(isCheckout).every((s) => s.with && s.with.ref === 'main');
}

/**
 * Measure the workflows. `files` = [{name, text}]. Throws on a workflow that does not parse
 * (a measurement failure, never a clean scan).
 * -> { readers: {SECRET: [wf]}, untrustedReaders: {SECRET: [{workflow, trigger}]}, selfHosted, jobCount, workflowCount }
 */
export function measureWorkflows(files) {
  const readers = {};
  const untrustedReaders = {};
  const selfHosted = [];
  let jobCount = 0;
  const add = (map, k, v) => { (map[k] = map[k] || []).push(v); };
  for (const { name, text } of files) {
    let doc;
    try {
      doc = parseYaml(text);
    } catch (e) {
      throw new Error(`${name} does not parse: ${String(e.message).split('\n')[0]}`);
    }
    if (!doc || typeof doc !== 'object' || !doc.jobs || typeof doc.jobs !== 'object') throw new Error(`${name} has no jobs mapping`);
    const untrusted = untrustedTriggers(triggersOf(doc));
    const top = new Set();
    for (const k of Object.keys(doc)) if (k !== 'jobs') collectSecrets(doc[k], top, k);
    const wfSecrets = new Set(top);
    for (const [id, job] of Object.entries(doc.jobs)) {
      jobCount++;
      const js = new Set(top);
      collectSecrets(job, js);
      for (const s of js) wfSecrets.add(s);
      const labels = [].concat(job && job['runs-on'] !== undefined ? job['runs-on'] : []).map((l) => (typeof l === 'object' ? JSON.stringify(l) : String(l)));
      if (labels.some((l) => /self-hosted/i.test(l))) {
        for (const u of untrusted) selfHosted.push({ workflow: name, job: id, trigger: u.trigger });
        if (!untrusted.length) selfHosted.push({ workflow: name, job: id, trigger: null });
      }
      for (const s of js) {
        for (const u of untrusted) {
          if (u.kind === 'prt' && checksOutOnlyMain(job)) continue;
          const list = untrustedReaders[s] || [];
          if (!list.some((x) => x.workflow === name && x.trigger === u.trigger)) add(untrustedReaders, s, { workflow: name, trigger: u.trigger });
        }
      }
    }
    for (const s of wfSecrets) add(readers, s, name);
  }
  return { readers, untrustedReaders, selfHosted, jobCount, workflowCount: files.length };
}

/** Rules (a)-(f). Pure. -> { violations: [string] } */
export function checkRegister({ register, measured }) {
  const v = [];
  const owner = String(register.owner_login || OWNER_LOGIN).toLowerCase();
  const byName = new Map(register.entries.map((e) => [e.name, e]));
  for (const [secret, wfs] of Object.entries(measured.readers)) {
    if (secret === 'GITHUB_TOKEN') continue;
    const e = byName.get(secret);
    if (!e) {
      for (const w of wfs) v.push(`(a) secrets.${secret} is used in ${w} but is not in the register`);
      continue;
    }
    if (e.exists === false) {
      // A workflow may still NAME an absent secret (it then reads an empty value) only with a dated
      // per-workflow reason in `absent_readers`: the register says truthfully the secret is missing.
      const ar = e.absent_readers || {};
      for (const w of wfs) if (typeof ar[w] !== 'string' || !DATED.test(ar[w])) v.push(`(a) ${secret}: exists is false but ${w} reads it`);
    }
  }
  for (const e of register.entries) {
    for (const w of Object.keys(e.absent_readers || {})) {
      if (e.exists !== false) v.push(`(a) ${e.name}: absent_readers is only for an entry with exists false`);
      else if (!(measured.readers[e.name] || []).includes(w)) v.push(`(a) ${e.name}: absent_readers ${w} is not a measured reader (stale)`);
    }
  }
  for (const e of register.entries) {
    if (e.name === 'GITHUB_TOKEN') continue;
    const measuredReaders = measured.readers[e.name] || [];
    for (const w of measuredReaders) if (!e.readers_allowed.includes(w)) v.push(`(b) ${e.name}: measured reader ${w} is not in readers_allowed`);
    for (const w of e.readers_allowed) if (!measuredReaders.includes(w)) v.push(`(b) ${e.name}: readers_allowed ${w} is not a measured reader (stale)`);
    const gf = e.grandfathered || {};
    if (Array.isArray(e.contract_readers)) {
      for (const w of e.readers_allowed) {
        if (e.contract_readers.includes(w)) continue;
        if (typeof gf[w] !== 'string' || !DATED.test(gf[w])) v.push(`(b) ${e.name}: reader ${w} exceeds the contract minimum and is not grandfathered (reason with a date)`);
      }
    }
    for (const w of Object.keys(gf)) if (!e.readers_allowed.includes(w)) v.push(`(b) ${e.name}: grandfathered ${w} is not in readers_allowed (stale)`);
    const ugf = e.untrusted_trigger_grandfathered || {};
    const untrusted = measured.untrustedReaders[e.name] || [];
    for (const u of untrusted) {
      if (typeof ugf[u.workflow] === 'string' && DATED.test(ugf[u.workflow])) continue;
      v.push(`(c) ${e.name}: ${u.workflow} reads it and is reachable from ${u.trigger} (not grandfathered)`);
    }
    for (const w of Object.keys(ugf)) if (!untrusted.some((u) => u.workflow === w)) v.push(`(c) ${e.name}: untrusted_trigger_grandfathered ${w} is not reachable from an untrusted trigger (stale)`);
    if (typeof e.acts_as === 'string' && e.acts_as.toLowerCase() === owner) v.push(`(d) ${e.name}: acts_as ${e.acts_as} equals owner_login ${register.owner_login || OWNER_LOGIN}`);
    if (String(e.owner_login).toLowerCase() !== owner) v.push(`(d) ${e.name}: owner_login ${e.owner_login} differs from the register's ${register.owner_login}`);
    if (e.actual_scope !== 'NOT VERIFIED') {
      const actual = parseScope(e.actual_scope);
      const min = parseScope(e.required_minimum_scope) || [];
      if (!actual) v.push(`(f) ${e.name}: actual_scope is neither "NOT VERIFIED" nor a list of permission tokens`);
      else for (let i = 0; i < actual.length; i++) {
        const a = actual[i];
        if (!min.some((m) => m.perm === a.perm && m.level >= a.level)) v.push(`(f) ${e.name}: actual_scope ${e.actual_scope[i]} exceeds required_minimum_scope`);
      }
    }
  }
  for (const s of measured.selfHosted) v.push(`(e) ${s.workflow}/${s.job}: self-hosted runner reachable from ${s.trigger || 'a trusted trigger (no self-hosted runner is registered for this repo)'}`);
  return { violations: v };
}

const dayNum = (iso) => Math.round(Date.parse(iso + 'T00:00:00Z') / 86400000);

/** Expiry decision (pure). today = 'YYYY-MM-DD'. -> { notices: [{key, text, name}], expired: [name], errors } */
export function decideExpiry(register, today) {
  const notices = [];
  const expired = [];
  const errors = [];
  for (const e of register.entries) {
    if (e.expiry === null || e.expiry === undefined) continue;
    if (typeof e.expiry !== 'string' || !ISO_DAY.test(e.expiry) || !Number.isFinite(Date.parse(e.expiry + 'T00:00:00Z'))) {
      errors.push(`${e.name}: expiry ${JSON.stringify(e.expiry)} is not YYYY-MM-DD`);
      continue;
    }
    const left = dayNum(e.expiry) - dayNum(today);
    if (left < 0) {
      expired.push(e.name);
      notices.push({ name: e.name, key: `expiry:${e.name}:${e.expiry}:past`, text: `Token expiry: ${e.name} EXPIRED on ${e.expiry}. Every path that uses it stops until the owner replaces it and records the new expiry in .github/automation/secrets-register.json.` });
    } else if (left <= 1) {
      notices.push({ name: e.name, key: `expiry:${e.name}:${e.expiry}:1d`, text: `Token expiry: ${e.name} expires on ${e.expiry} (${left === 0 ? 'today' : 'tomorrow'}). Replace it and record the new expiry in .github/automation/secrets-register.json.` });
    } else if (left <= 7) {
      notices.push({ name: e.name, key: `expiry:${e.name}:${e.expiry}:7d`, text: `Token expiry: ${e.name} expires on ${e.expiry} (in ${left} days). Replace it and record the new expiry in .github/automation/secrets-register.json.` });
    }
  }
  return { notices, expired, errors };
}

function readWorkflows(dir = WORKFLOW_DIR) {
  return readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).sort().map((name) => ({ name, text: readFileSync(path.join(dir, name), 'utf8') }));
}

function loadRegister(deps, log) {
  let text = deps.registerText;
  if (text === undefined) {
    try {
      text = readFileSync(REGISTER_PATH, 'utf8');
    } catch (e) {
      log.error('secrets-register: CANNOT RUN -- cannot read ' + REGISTER_PATH + ': ' + e.code);
      return null;
    }
  }
  const r = parseRegister(text);
  if (!r.ok) {
    log.error('secrets-register: CANNOT RUN -- ' + r.reason);
    return null;
  }
  return r.register;
}

async function runExpiry(argv, env, log, deps) {
  const register = loadRegister(deps, log);
  if (!register) return 2;
  const i = argv.indexOf('--today');
  const today = i >= 0 ? argv[i + 1] : new Date().toISOString().slice(0, 10);
  if (!ISO_DAY.test(String(today))) {
    log.error('secrets-register --expiry: CANNOT RUN -- --today must be YYYY-MM-DD');
    return 2;
  }
  const d = decideExpiry(register, today);
  for (const e of d.errors) log.error('secrets-register --expiry: ' + e);
  if (d.errors.length) return 2;
  const post = deps.post || postPauseNotice;
  let undelivered = 0;
  for (const n of d.notices) {
    const res = await post({ repo: env.GITHUB_REPOSITORY, token: env.GH_TOKEN, key: n.key, text: n.text });
    if (res && (res.posted || res.skipped)) log.log(`secrets-register --expiry: notice ${n.key} ${res.posted ? 'posted' : 'already posted'}`);
    else {
      undelivered++;
      log.error(`secrets-register --expiry: notice ${n.key} could NOT be posted: ${res && res.error ? res.error : 'no result'}`);
    }
  }
  for (const n of d.expired) log.error(`secrets-register --expiry: FAIL -- ${n} is past its expiry; the arc stops until it is replaced.`);
  if (d.expired.length) return 1;
  if (undelivered) return 2;
  log.log(`secrets-register --expiry: OK -- ${register.entries.length} entries, ${register.entries.filter((e) => e.expiry).length} with an expiry, ${d.notices.length} notice(s) due.`);
  return 0;
}

export async function main(argv = [], env = process.env, log = console, deps = {}) {
  if (argv.includes('--self-test')) return (await selfTest(log)) ? 0 : 1;
  if (argv.includes('--expiry')) return runExpiry(argv, env, log, deps);
  const register = loadRegister(deps, log);
  if (!register) return 2;
  let measured;
  try {
    const files = deps.workflows || readWorkflows();
    if (files.length === 0) throw new Error('no workflow files found');
    measured = measureWorkflows(files);
  } catch (e) {
    log.error('secrets-register: CANNOT RUN -- ' + e.message);
    return 2;
  }
  const { violations } = checkRegister({ register, measured });
  if (violations.length) {
    log.error(`secrets-register: FAIL -- ${violations.length} violation(s):`);
    for (const x of violations) log.error('  ' + x);
    log.error('Fix the workflow, or (owner Approve) the register entry; see docs/automation-foundations.md.');
    return 1;
  }
  const secrets = Object.keys(measured.readers).filter((s) => s !== 'GITHUB_TOKEN').length;
  log.log(`secrets-register: OK -- ${measured.workflowCount} workflows, ${measured.jobCount} jobs, ${secrets} secret(s) read, ${register.entries.length} register entries, 0 self-hosted runners.`);
  return 0;
}

async function selfTest(log) {
  const quiet = { log() {}, error() {} };
  const reg = (over = {}) => JSON.stringify({
    version: 1,
    owner_login: OWNER_LOGIN,
    entries: [{
      name: 'TOK', kind: 'pat', acts_as: null, acts_as_state: 'to record', owner_login: OWNER_LOGIN,
      required_minimum_scope: ['contents:write'], actual_scope: 'NOT VERIFIED', expiry: null, exists: true,
      readers_allowed: ['a.yml'], contract_readers: ['a.yml'], ...over,
    }],
  });
  const A = (on) => [{ name: 'a.yml', text: `on: ${on}\njobs:\n  j:\n    runs-on: ubuntu-latest\n    steps:\n      - env: { T: "\${{ secrets.TOK }}" }\n        run: "true"\n` }];
  const SCHED = '{ schedule: [{ cron: "0 0 * * *" }] }';
  const okPost = async () => ({ posted: true, skipped: false, error: null });
  const badPost = async () => ({ posted: false, skipped: false, error: 'HTTP 500' });
  const ENV = { GH_TOKEN: 't', GITHUB_REPOSITORY: 'o/r' };
  // Exit-code owner (main) driven end to end, each branch pinned (R5).
  const cases = [
    ['clean register (0)', await main([], {}, quiet, { registerText: reg(), workflows: A(SCHED) }), 0],
    ['(a) unregistered secret (1)', await main([], {}, quiet, { registerText: reg({ name: 'OTHER', readers_allowed: [], contract_readers: [] }), workflows: A(SCHED) }), 1],
    ['(a) absent secret read (1)', await main([], {}, quiet, { registerText: reg({ exists: false }), workflows: A(SCHED) }), 1],
    ['(a) absent secret read, dated absent_readers (0)', await main([], {}, quiet, { registerText: reg({ exists: false, absent_readers: { 'a.yml': 'no secret (measured 2026-11-05)' } }), workflows: A(SCHED) }), 0],
    ['(a) absent_readers without a date (1)', await main([], {}, quiet, { registerText: reg({ exists: false, absent_readers: { 'a.yml': 'no secret' } }), workflows: A(SCHED) }), 1],
    ['(a) absent_readers stale (1)', await main([], {}, quiet, { registerText: reg({ exists: false, absent_readers: { 'a.yml': '2026-11-05', 'gone.yml': '2026-11-05' } }), workflows: A(SCHED) }), 1],
    ['(a) absent_readers on an existing entry (1)', await main([], {}, quiet, { registerText: reg({ absent_readers: { 'a.yml': '2026-11-05' } }), workflows: A(SCHED) }), 1],
    ['(b) unlisted reader (1)', await main([], {}, quiet, { registerText: reg({ readers_allowed: [] }), workflows: A(SCHED) }), 1],
    ['(c) pull_request reader (1)', await main([], {}, quiet, { registerText: reg(), workflows: A('{ pull_request: {} }') }), 1],
    ['(c) non-main push reader (1)', await main([], {}, quiet, { registerText: reg(), workflows: A('{ push: { branches: [dev] } }') }), 1],
    ['(d) acts_as owner (1)', await main([], {}, quiet, { registerText: reg({ acts_as: OWNER_LOGIN }), workflows: A(SCHED) }), 1],
    ['(f) wider scope (1)', await main([], {}, quiet, { registerText: reg({ actual_scope: ['workflows:write'] }), workflows: A(SCHED) }), 1],
    ['bad register JSON (2)', await main([], {}, quiet, { registerText: '{', workflows: A(SCHED) }), 2],
    ['unparseable workflow (2)', await main([], {}, quiet, { registerText: reg(), workflows: [{ name: 'x.yml', text: 'on: [\n' }] }), 2],
    ['no workflows (2)', await main([], {}, quiet, { registerText: reg(), workflows: [] }), 2],
    ['--expiry nothing due (0)', await main(['--expiry', '--today', '2026-11-04'], ENV, quiet, { registerText: reg(), post: badPost }), 0],
    ['--expiry 7d notice posted (0)', await main(['--expiry', '--today', '2026-11-04'], ENV, quiet, { registerText: reg({ expiry: '2026-11-09' }), post: okPost }), 0],
    ['--expiry notice not deliverable (2)', await main(['--expiry', '--today', '2026-11-04'], ENV, quiet, { registerText: reg({ expiry: '2026-11-09' }), post: badPost }), 2],
    ['--expiry past (1)', await main(['--expiry', '--today', '2026-11-04'], ENV, quiet, { registerText: reg({ expiry: '2026-11-01' }), post: okPost }), 1],
    ['--expiry malformed date (2)', await main(['--expiry', '--today', '2026-11-04'], ENV, quiet, { registerText: reg({ expiry: 'soon' }), post: okPost }), 2],
  ];
  // Rule-level canaries the exit cases cannot pin by code alone.
  const m = measureWorkflows([{ name: 's.yml', text: 'on: { pull_request_target: {} }\njobs:\n  j:\n    runs-on: [self-hosted]\n    steps:\n      - uses: actions/checkout@v7\n      - run: echo "${{ secrets.TOK }}"\n' }]);
  cases.push(['(e) self-hosted reachable is reported', m.selfHosted.length, 1]);
  cases.push(['prt + PR-head checkout is untrusted', (m.untrustedReaders.TOK || []).length, 1]);
  const prose = measureWorkflows([{ name: 'p.yml', text: 'on: { schedule: [{ cron: "0 0 * * *" }] }\njobs:\n  j:\n    runs-on: ubuntu-latest\n    steps:\n      - run: node scripts/precheck-supabase-secrets.mjs\n' }]);
  cases.push(['a script name is not a secret reference', Object.keys(prose.readers).length, 0]);
  let failed = 0;
  for (const [name, got, want] of cases) {
    if (got !== want) {
      failed++;
      log.error('FAIL ' + name + ': expected ' + want + ', got ' + got);
    }
  }
  if (failed) {
    log.error('FAIL self-test -- ' + failed + ' of ' + cases.length + ' case(s).');
    return false;
  }
  log.log('PASS self-test -- ' + cases.length + ' cases, every exit code proven.');
  return true;
}

if (isEntryPoint(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
