#!/usr/bin/env node
/**
 * write-drill-record.mjs -- the helper the drill workflows of later slices call (rule 1.1(6)).
 *
 * Builds the JSON record { drill, component, component_sha, date, pass, actors, run_url, run_id,
 * head_sha } from the Actions env and posts it as ONE comment on the issue titled exactly
 * `DRILL RECORDS`, with GITHUB_TOKEN (the comment's author is then github-actions[bot], which is
 * what scripts/check-drill-records.mjs requires). component_sha is computed from
 * `.github/automation/components.json` at the run's checkout (scripts/lib/component-sha.mjs).
 * Never run live in this slice; tested with a fake fetch.
 *
 *   GH_TOKEN=${{ github.token }} node scripts/write-drill-record.mjs \
 *     --drill A17 --component merge-lane --pass true [--ref HEAD]
 *   node scripts/write-drill-record.mjs --self-test
 *
 * Exit: 0 posted, 1 (unused), 2 could not post / bad arguments / missing env.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEntryPoint } from './lib/entry-point.mjs';
import { componentShaFromGit } from './lib/component-sha.mjs';
import { pauseRequest, PAUSE_API } from './lib/automation-pause.mjs';
import { DRILL_ISSUE_TITLE, DRILL_ACTOR, parseComponents, COMPONENTS_PATH } from './check-drill-records.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_RE = /^[\w.-]+\/[\w.-]+$/;

/** Validated record object (throws on a bad field). */
export function buildRecord({ drill, component, componentSha, pass, actors, runUrl, runId, headSha, date }) {
  if (typeof drill !== 'string' || !/^A\d+[a-z]?$/.test(drill)) throw new Error('drill must look like A17');
  if (typeof component !== 'string' || component === '') throw new Error('component is required');
  if (typeof componentSha !== 'string' || !/^[0-9a-f]{64}$/.test(componentSha)) throw new Error('component_sha must be 64 hex');
  if (typeof pass !== 'boolean') throw new Error('pass must be true or false');
  if (!Array.isArray(actors) || actors.some((a) => typeof a !== 'string')) throw new Error('actors must be a list of logins');
  if (typeof runUrl !== 'string' || !/^https:\/\//.test(runUrl)) throw new Error('run_url must be https');
  if (!Number.isInteger(runId) || runId <= 0) throw new Error('run_id must be a positive integer');
  if (typeof headSha !== 'string' || !/^[0-9a-f]{40}$/.test(headSha)) throw new Error('head_sha must be 40 hex');
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('date must be YYYY-MM-DD');
  return { drill, component, component_sha: componentSha, date, pass, actors, run_url: runUrl, run_id: runId, head_sha: headSha };
}

/** -> { posted, error }. Never throws. */
export async function postDrillRecord({ repo, token, fetch: fetchImpl = globalThis.fetch, record }) {
  try {
    if (typeof repo !== 'string' || !REPO_RE.test(repo)) return { posted: false, error: 'invalid repo' };
    if (!token) return { posted: false, error: 'no token' };
    let url = `${PAUSE_API}/repos/${repo}/issues?state=open&per_page=100&sort=created&direction=desc`;
    const hits = [];
    for (let page = 1; url && page <= 5; page++) {
      const { data, next } = await pauseRequest(fetchImpl, url, token);
      if (!Array.isArray(data)) return { posted: false, error: 'issues response is not an array' };
      for (const it of data) if (it && !('pull_request' in it) && typeof it.title === 'string' && it.title.trim() === DRILL_ISSUE_TITLE) hits.push(it);
      url = next;
    }
    if (hits.length !== 1) return { posted: false, error: `issue titled "${DRILL_ISSUE_TITLE}" not unique (${hits.length})` };
    await pauseRequest(fetchImpl, `${PAUSE_API}/repos/${repo}/issues/${hits[0].number}/comments`, token, { method: 'POST', body: { body: JSON.stringify(record) } });
    return { posted: true, error: null };
  } catch (e) {
    return { posted: false, error: e && e.message ? e.message : String(e) };
  }
}

export async function main(argv = [], env = process.env, log = console, deps = {}) {
  if (argv.includes('--self-test')) return (await selfTest(log)) ? 0 : 1;
  const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  let record;
  try {
    const component = opt('--component');
    const passArg = opt('--pass');
    if (passArg !== 'true' && passArg !== 'false') throw new Error('--pass true|false is required');
    if (!component) throw new Error('--component is required');
    const sha = deps.sha || ((name) => {
      const parsed = parseComponents(readFileSync(COMPONENTS_PATH, 'utf8'));
      if (!parsed.ok) throw new Error(parsed.reason);
      const c = parsed.components.components[name];
      if (!c || c.status !== 'built') throw new Error(`component ${name} is not a built component`);
      return componentShaFromGit(c.paths, { ref: opt('--ref') || 'HEAD', cwd: REPO_ROOT });
    });
    const server = env.GITHUB_SERVER_URL || 'https://github.com';
    record = buildRecord({
      drill: opt('--drill'),
      component,
      componentSha: sha(component),
      pass: passArg === 'true',
      actors: [env.GITHUB_ACTOR || DRILL_ACTOR],
      runUrl: `${server}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`,
      runId: Number(env.GITHUB_RUN_ID),
      headSha: env.GITHUB_SHA,
      date: deps.today || new Date().toISOString().slice(0, 10),
    });
  } catch (e) {
    log.error('write-drill-record: CANNOT RUN -- ' + String(e.message).split('\n')[0]);
    return 2;
  }
  const post = deps.post || postDrillRecord;
  const res = await post({ repo: env.GITHUB_REPOSITORY, token: env.GH_TOKEN, record });
  if (!res || !res.posted) {
    log.error('write-drill-record: NOT POSTED -- ' + (res && res.error ? res.error : 'no result'));
    return 2;
  }
  log.log(`write-drill-record: posted ${record.drill} for ${record.component} (run ${record.run_id}, pass ${record.pass}).`);
  return 0;
}

async function selfTest(log) {
  const quiet = { log() {}, error() {} };
  const ENV = { GH_TOKEN: 't', GITHUB_REPOSITORY: 'o/r', GITHUB_RUN_ID: '9', GITHUB_SHA: 'a'.repeat(40) };
  const ARGS = ['--drill', 'A17', '--component', 'merge-lane', '--pass', 'true'];
  const okDeps = { sha: () => 'b'.repeat(64), today: '2026-11-04', post: async () => ({ posted: true, error: null }) };
  // Exit-code owner (main) driven end to end, each branch pinned (R5).
  const cases = [
    ['posted (0)', await main(ARGS, ENV, quiet, okDeps), 0],
    ['post refused (2)', await main(ARGS, ENV, quiet, { ...okDeps, post: async () => ({ posted: false, error: 'x' }) }), 2],
    ['no --pass (2)', await main(['--drill', 'A17', '--component', 'merge-lane'], ENV, quiet, okDeps), 2],
    ['no run id (2)', await main(ARGS, { ...ENV, GITHUB_RUN_ID: '' }, quiet, okDeps), 2],
    ['bad drill id (2)', await main(['--drill', 'x', '--component', 'merge-lane', '--pass', 'true'], ENV, quiet, okDeps), 2],
  ];
  const f = async (u) => (u.includes('/issues?') ? new Response('[]', { status: 200 }) : new Response('{}', { status: 201 }));
  cases.push(['no DRILL RECORDS issue: not posted', (await postDrillRecord({ repo: 'o/r', token: 't', fetch: f, record: {} })).posted, false]);
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
