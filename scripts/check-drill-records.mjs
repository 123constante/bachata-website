#!/usr/bin/env node
/**
 * check-drill-records.mjs -- the slice-15 drill-record checker (rule 1.1(6), drill A32).
 *
 * A drill record is a COMMENT (JSON body) on the pinned issue titled exactly `DRILL RECORDS`,
 * authored by the drill workflow (`github-actions[bot]`), with fields drill, component,
 * component_sha, date, pass, actors, run_url, run_id (and head_sha, written by
 * scripts/write-drill-record.mjs). The record is a POINTER; the run is the proof. For the LATEST
 * record per (component, drill) this checker requires:
 *   - every field present, `pass === true`, the author is github-actions[bot];
 *   - the component is in `.github/automation/components.json`, `status: "built"`, and lists the
 *     drill (which names the drill's workflow);
 *   - GET /repos/{repo}/actions/runs/{run_id} re-fetched: conclusion `success`, workflow name
 *     equal to the drill's workflow, head_sha equal to the record's (and run_url equal to the
 *     run's html_url);
 *   - component_sha equal to the CURRENT componentSha for that component.
 * A JSON record by any other author is refused (forged). An older record superseded by a newer one
 * for the same (component, drill) is listed, not judged. A non-JSON comment is a note.
 * A drill listed for a built component with no record is `missing`: listed by default, exit 1
 * under --require-all (slice 15 uses that). The copy under C:/Users/ecual/.claude/plans/ is
 * never read.
 *
 * Inputs: --comments <file> (a JSON array of issue comments) or, without it, the issue found by
 * title and its comments read with GH_TOKEN (GITHUB_TOKEN) for GITHUB_REPOSITORY. Runs are always
 * re-fetched through the API. --ref <ref> picks the tree component_sha is computed at (main).
 * --components-only validates components.json offline (the lint-chain link).
 *
 * Exit: 0 every record verified (missing ones only listed), 1 a refusal (or missing under
 * --require-all), 2 could not measure (components.json unreadable, no comments source, an API
 * read of the issue or its comments failed).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEntryPoint } from './lib/entry-point.mjs';
import { componentShaFromGit } from './lib/component-sha.mjs';
import { pauseRequest, PAUSE_API } from './lib/automation-pause.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const COMPONENTS_PATH = path.join(REPO_ROOT, '.github', 'automation', 'components.json');
export const DRILL_ISSUE_TITLE = 'DRILL RECORDS';
export const DRILL_ACTOR = 'github-actions[bot]';
export const COMPONENT_NAMES = ['approver', 'sql-classifier', 'merge-lane', 'queue', 'apply', 'notifier', 'pause-readers', 'canary', 'revert', 'walk-gate'];
export const RECORD_FIELDS = ['drill', 'component', 'component_sha', 'date', 'pass', 'actors', 'run_url', 'run_id', 'head_sha'];
const GLOB = /[*?[\]{}!]/;
const REPO_RE = /^[\w.-]+\/[\w.-]+$/;

/** Strict components.json parse. -> { ok, components } | { ok:false, reason }. Never throws. */
export function parseComponents(text) {
  let d;
  try {
    d = JSON.parse(String(text));
  } catch (e) {
    return { ok: false, reason: 'components.json is not valid JSON: ' + e.message };
  }
  if (!d || d.version !== 1 || !d.components || typeof d.components !== 'object') return { ok: false, reason: 'components.json must be { "version": 1, "components": {...} }' };
  const names = Object.keys(d.components).sort();
  if (JSON.stringify(names) !== JSON.stringify([...COMPONENT_NAMES].sort())) return { ok: false, reason: 'components.json must name exactly: ' + COMPONENT_NAMES.join(', ') };
  for (const [name, c] of Object.entries(d.components)) {
    if (!c || !Array.isArray(c.paths)) return { ok: false, reason: `${name}: paths must be an array` };
    if (c.status !== 'built' && c.status !== 'not built') return { ok: false, reason: `${name}: status must be "built" or "not built"` };
    if (c.status === 'built' && c.paths.length === 0) return { ok: false, reason: `${name}: a built component needs paths` };
    if (c.status === 'not built' && c.paths.length !== 0) return { ok: false, reason: `${name}: a not-built component has paths: []` };
    for (const p of c.paths) {
      if (typeof p !== 'string' || p === '' || p.startsWith('/') || p.startsWith('-') || GLOB.test(p)) return { ok: false, reason: `${name}: path ${JSON.stringify(p)} must be a literal repo path (git ls-tree does not expand globs)` };
    }
    if (c.drills !== undefined) {
      if (!c.drills || typeof c.drills !== 'object' || Array.isArray(c.drills)) return { ok: false, reason: `${name}: drills must be an object { drill: workflow name }` };
      for (const [k, v] of Object.entries(c.drills)) if (!/^A\d+[a-z]?$/.test(k) || typeof v !== 'string' || v === '') return { ok: false, reason: `${name}: drill ${k} needs a workflow name` };
    }
  }
  return { ok: true, components: d };
}

function recordBody(body) {
  const s = String(body ?? '').trim();
  const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n```$/.exec(s);
  const raw = fenced ? fenced[1] : s;
  if (!raw.startsWith('{')) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * -> { accepted: [], refusals: [string], missing: ['component/drill'], superseded: [], notes: [] }
 * deps: comments (issue comments), components (parsed), currentSha(name), fetchRun(id) (throws on
 * any failure: the run cannot be re-verified).
 */
export async function verifyRecords({ comments, components, currentSha, fetchRun }) {
  const out = { accepted: [], refusals: [], missing: [], superseded: [], notes: [] };
  const comps = components.components;
  const latest = new Map();
  const ordered = [...comments].sort((a, b) => (Date.parse(a.created_at) || 0) - (Date.parse(b.created_at) || 0) || Number(a.id) - Number(b.id));
  for (const c of ordered) {
    const rec = recordBody(c && c.body);
    const where = `comment ${c && c.id}`;
    if (!rec) {
      out.notes.push(`${where}: not a JSON record`);
      continue;
    }
    const author = c.user && typeof c.user.login === 'string' ? c.user.login : '(unknown)';
    if (author !== DRILL_ACTOR) {
      out.refusals.push(`${where}: author ${author} is not ${DRILL_ACTOR} (forged record)`);
      continue;
    }
    const key = `${rec.component}/${rec.drill}`;
    if (latest.has(key)) out.superseded.push(latest.get(key).where);
    latest.set(key, { rec, where });
  }
  for (const { rec, where } of latest.values()) {
    const id = `${where} (${rec.component}/${rec.drill})`;
    const missingField = RECORD_FIELDS.find((f) => !(f in rec));
    if (missingField) { out.refusals.push(`${id}: missing field ${missingField}`); continue; }
    if (rec.pass !== true) { out.refusals.push(`${id}: pass is not true`); continue; }
    const comp = Object.prototype.hasOwnProperty.call(comps, rec.component) ? comps[rec.component] : null;
    if (!comp) { out.refusals.push(`${id}: unknown component ${rec.component}`); continue; }
    if (comp.status !== 'built') { out.refusals.push(`${id}: component ${rec.component} is not built`); continue; }
    const workflow = comp.drills && Object.prototype.hasOwnProperty.call(comp.drills, rec.drill) ? comp.drills[rec.drill] : null;
    if (!workflow) { out.refusals.push(`${id}: drill ${rec.drill} is not listed for ${rec.component}`); continue; }
    let run;
    try {
      run = await fetchRun(rec.run_id);
    } catch (e) {
      out.refusals.push(`${id}: run ${rec.run_id} cannot be re-verified (${String(e && e.message).split('\n')[0]})`);
      continue;
    }
    if (!run || run.conclusion !== 'success') { out.refusals.push(`${id}: run ${rec.run_id} conclusion ${run ? run.conclusion : 'none'}, not success`); continue; }
    if (run.name !== workflow) { out.refusals.push(`${id}: run ${rec.run_id} workflow "${run.name}" is not "${workflow}"`); continue; }
    if (run.head_sha !== rec.head_sha) { out.refusals.push(`${id}: run ${rec.run_id} head_sha ${run.head_sha} differs from the record's ${rec.head_sha}`); continue; }
    if (run.html_url && rec.run_url !== run.html_url) { out.refusals.push(`${id}: run_url does not match run ${rec.run_id}`); continue; }
    let now;
    try {
      now = currentSha(rec.component);
    } catch (e) {
      out.refusals.push(`${id}: current component_sha cannot be computed (${String(e && e.message).split('\n')[0]})`);
      continue;
    }
    if (rec.component_sha !== now) { out.refusals.push(`${id}: component_sha is stale (record ${String(rec.component_sha).slice(0, 12)}, current ${String(now).slice(0, 12)}): re-drill`); continue; }
    out.accepted.push(id);
  }
  for (const [name, c] of Object.entries(comps)) {
    if (c.status !== 'built') continue;
    for (const d of Object.keys(c.drills || {})) if (!latest.has(`${name}/${d}`)) out.missing.push(`${name}/${d}`);
  }
  return out;
}

async function findIssue(fetchImpl, repo, token) {
  let url = `${PAUSE_API}/repos/${repo}/issues?state=open&per_page=100&sort=created&direction=desc`;
  const hits = [];
  for (let page = 1; url && page <= 5; page++) {
    const { data, next } = await pauseRequest(fetchImpl, url, token);
    if (!Array.isArray(data)) throw new Error('issues response is not an array');
    for (const it of data) if (it && !('pull_request' in it) && typeof it.title === 'string' && it.title.trim() === DRILL_ISSUE_TITLE) hits.push(it);
    url = next;
  }
  if (hits.length !== 1) throw new Error(`issue titled "${DRILL_ISSUE_TITLE}" not unique (${hits.length})`);
  return hits[0].number;
}

/** Comments of the DRILL RECORDS issue (paginated, up to 20 pages). Throws on any read error. */
export async function fetchComments({ repo, token, fetch: fetchImpl = globalThis.fetch }) {
  const n = await findIssue(fetchImpl, repo, token);
  const out = [];
  let url = `${PAUSE_API}/repos/${repo}/issues/${n}/comments?per_page=100`;
  for (let page = 1; url && page <= 20; page++) {
    const { data, next } = await pauseRequest(fetchImpl, url, token);
    if (!Array.isArray(data)) throw new Error('comments response is not an array');
    out.push(...data);
    url = next;
  }
  if (url) throw new Error('more than 20 pages of comments: not fully read');
  return out;
}

export async function main(argv = [], env = process.env, log = console, deps = {}) {
  if (argv.includes('--self-test')) return (await selfTest(log)) ? 0 : 1;
  let text = deps.componentsText;
  if (text === undefined) {
    try {
      text = readFileSync(COMPONENTS_PATH, 'utf8');
    } catch (e) {
      log.error('drill-records: CANNOT RUN -- cannot read components.json: ' + e.code);
      return 2;
    }
  }
  const parsed = parseComponents(text);
  if (!parsed.ok) {
    log.error('drill-records: CANNOT RUN -- ' + parsed.reason);
    return 2;
  }
  const comps = parsed.components.components;
  if (argv.includes('--components-only')) {
    const built = Object.entries(comps).filter(([, c]) => c.status === 'built');
    log.log(`drill-records: OK -- components.json valid: ${built.length} built (${built.map(([n, c]) => `${n}: ${c.paths.length} paths, ${Object.keys(c.drills || {}).length} drills`).join('; ')}), ${COMPONENT_NAMES.length - built.length} not built.`);
    return 0;
  }
  const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  const repo = env.GITHUB_REPOSITORY;
  const token = env.GH_TOKEN || env.GITHUB_TOKEN;
  const fetchImpl = deps.fetch || globalThis.fetch;
  let comments = deps.comments;
  try {
    if (!comments && opt('--comments')) comments = JSON.parse(readFileSync(opt('--comments'), 'utf8'));
    if (!comments) {
      if (!token || typeof repo !== 'string' || !REPO_RE.test(repo)) throw new Error('no comments source: pass --comments <file>, or set GH_TOKEN and GITHUB_REPOSITORY');
      comments = await fetchComments({ repo, token, fetch: fetchImpl });
    }
    if (!Array.isArray(comments)) throw new Error('comments must be a JSON array');
  } catch (e) {
    log.error('drill-records: CANNOT RUN -- ' + String(e.message).split('\n')[0]);
    return 2;
  }
  const ref = opt('--ref') || 'main';
  const currentSha = deps.currentSha || ((name) => componentShaFromGit(comps[name].paths, { ref, cwd: REPO_ROOT }));
  const fetchRun = deps.fetchRun || (async (id) => {
    if (!token || typeof repo !== 'string' || !REPO_RE.test(repo)) throw new Error('no GH_TOKEN/GITHUB_REPOSITORY to re-fetch the run');
    if (!/^\d+$/.test(String(id))) throw new Error('run_id is not a number');
    return (await pauseRequest(fetchImpl, `${PAUSE_API}/repos/${repo}/actions/runs/${id}`, token)).data;
  });
  const v = await verifyRecords({ comments, components: parsed.components, currentSha, fetchRun });
  for (const a of v.accepted) log.log('VERIFIED ' + a);
  for (const s of v.superseded) log.log('superseded ' + s);
  for (const m of v.missing) log.log('missing ' + m);
  for (const r of v.refusals) log.error('REFUSED ' + r);
  const requireAll = argv.includes('--require-all');
  if (v.refusals.length || (requireAll && v.missing.length)) {
    log.error(`drill-records: FAIL -- ${v.refusals.length} refused, ${v.missing.length} missing${requireAll ? ' (--require-all)' : ''}.`);
    return 1;
  }
  log.log(`drill-records: OK -- ${v.accepted.length} verified, ${v.missing.length} missing (listed; --require-all fails on them).`);
  return 0;
}

async function selfTest(log) {
  const quiet = { log() {}, error() {} };
  const names = Object.fromEntries(COMPONENT_NAMES.map((n) => [n, { paths: [], status: 'not built' }]));
  names['merge-lane'] = { paths: ['x.mjs'], status: 'built', drills: { A17: 'Drill A17' } };
  const comps = JSON.stringify({ version: 1, components: names });
  const H = '1'.repeat(40);
  const S = '2'.repeat(64);
  const rec = (o = {}) => ({ id: 1, created_at: '2026-11-04T00:00:00Z', user: { login: DRILL_ACTOR }, body: JSON.stringify({ drill: 'A17', component: 'merge-lane', component_sha: S, date: '2026-11-04', pass: true, actors: [DRILL_ACTOR], run_url: 'u', run_id: 5, head_sha: H, ...o }) });
  const run = async (id) => { if (id !== 5) throw new Error('HTTP 404'); return { name: 'Drill A17', conclusion: 'success', head_sha: H, html_url: 'u' }; };
  const d = (comments, extra = {}) => ({ componentsText: comps, comments, currentSha: () => S, fetchRun: run, ...extra });
  // Exit-code owner (main) driven end to end, each branch pinned (R5).
  const cases = [
    ['verified record (0)', await main([], {}, quiet, d([rec()])), 0],
    ['forged: no real run (1)', await main([], {}, quiet, d([rec({ run_id: 6 })])), 1],
    ['stale component_sha (1)', await main([], {}, quiet, d([rec({ component_sha: '3'.repeat(64) })])), 1],
    ['foreign author (1)', await main([], {}, quiet, d([{ ...rec(), user: { login: 'someone' } }])), 1],
    ['missing, default mode (0)', await main([], {}, quiet, d([])), 0],
    ['missing, --require-all (1)', await main(['--require-all'], {}, quiet, d([])), 1],
    ['no comments source (2)', await main([], {}, quiet, { componentsText: comps }), 2],
    ['bad components.json (2)', await main([], {}, quiet, d([], { componentsText: '{' })), 2],
    ['--components-only (0)', await main(['--components-only'], {}, quiet, { componentsText: comps }), 0],
    ['glob path refused (2)', await main(['--components-only'], {}, quiet, { componentsText: comps.replace('"x.mjs"', '"x*.mjs"') }), 2],
  ];
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
