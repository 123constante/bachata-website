// A fake GitHub for run() of scripts/autopilot-step.mjs, shared by the slice-2 foundation tests
// (tests/automationFoundations.test.ts, tests/automationMoney.test.ts). One bot docs PR that the
// lane would merge, unless a test changes one fact: the head's check-runs per read, or the files.
// Modelled on the fake in tests/autopilotMerge.test.ts; GitHub check-run objects carry head_sha.
import { BOT_LOGIN, STATE_LABELS } from '../scripts/lib/autopilot.mjs';

export const NOW = Date.parse('2026-11-04T12:00:00Z');
const MIN = 60000;
const iso = (ms: number) => new Date(ms).toISOString();
const GH_BOT = 'github-actions[bot]';
export const MERGED = 'e'.repeat(40);
export const ENV = { REPOS: 'o/r', GH_TOKEN: 't', BOT_TOKEN: 'b', AUTOMERGE_TOKEN: 'am', DRY_RUN: 'false', AUTOPILOT_MERGE_MODE: 'soft', RUN_URL: 'https://run/1' };
export const sha = (n: number) => `${n}`.padEnd(40, 'a').replace(/[^0-9a]/g, 'a');

export type FakeFile = { filename: string; status?: string; patch?: string; changes?: number; additions?: number; deletions?: number; previous_filename?: string };
export type CheckRun = { id?: number; name: string; status: string; conclusion: string | null; head_sha?: string };
export type FakeCfg = {
  n: number;
  files?: FakeFile[];
  labels?: string[];
  body?: string;
  /** The head's check-runs for the Nth read of /commits/<head>/check-runs (1-based). */
  checkRuns?: (head: string, read: number) => CheckRun[];
};

/** A check-run as GitHub returns it at the head (success, completed, head_sha set). */
export const green = (head: string, names: string[], from = 1): CheckRun[] =>
  names.map((name, i) => ({ id: from + i, name, status: 'completed', conclusion: 'success', head_sha: head }));

export const DOC_FILE: FakeFile = { filename: 'docs/a.md', status: 'modified', additions: 1, deletions: 0, changes: 1, patch: '@@ -1 +1,2 @@\n hello\n+a plain line' };

export function fakeGitHub(cfg: FakeCfg) {
  const log: { m: string; p: string; auth?: string; body?: Record<string, unknown> }[] = [];
  const reads: Record<string, number> = {};
  const json = (b: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(b), { status, headers: { 'x-ratelimit-remaining': '4000' } });
  const head = sha(cfg.n);
  const files = cfg.files ?? [DOC_FILE];
  const pr = () => ({
    number: cfg.n, state: 'open', draft: false, user: { login: BOT_LOGIN }, created_at: iso(NOW - 86400000), changed_files: files.length,
    body: cfg.body ?? 'Verified: unit green (12)\nNot verified: phone walk', labels: (cfg.labels ?? ['run-ci', 'review-passed', 'automerge-ok']).map((name) => ({ name })), mergeable_state: 'clean',
    head: { sha: head, ref: `claude/f-${cfg.n}`, repo: { full_name: 'o/r' } }, base: { ref: 'main', repo: { full_name: 'o/r' } },
  });
  const fetchImpl = async (url: string, init: { method?: string; body?: string; headers?: Record<string, string> } = {}) => {
    const m = init.method || 'GET';
    const u = new URL(url);
    const p = u.pathname.replace(/^\/repos\/o\/r/, '');
    const page = Number(u.searchParams.get('page') || 1);
    log.push({ m, p, auth: init.headers?.authorization, body: init.body ? JSON.parse(init.body) : undefined });
    let mm: RegExpExecArray | null;
    if (m === 'GET' && p === '') return json({ default_branch: 'main' });
    if (m === 'GET' && p === '/commits/main') return json({ sha: 'm'.repeat(40) });
    if (m === 'GET' && /^\/commits\/(m+|e+)\/check-runs$/.test(p)) return json({ check_runs: [] });
    if (m === 'GET' && /^\/commits\/(m+|e+)\/status$/.test(p)) return json({ statuses: [] });
    if (m === 'GET' && p === '/issues/events') return json([]);
    if (m === 'GET' && p === '/issues') return json([]);
    if (m === 'GET' && p === '/labels') return json(Object.values(STATE_LABELS).map((name) => ({ name })));
    if (m === 'GET' && p === '/pulls') return json(page === 1 ? [pr()] : []);
    if (m === 'GET' && /^\/compare\/[me]{40}\.\.\.[0-9a-f]{40}$/.test(p)) return json({ behind_by: 0, ahead_by: 1 });
    if (m === 'GET' && (mm = /^\/commits\/([0-9a-f]{40})$/.exec(p))) return json({ sha: mm[1], commit: { message: 'feat: x [worker-done dt_ab12]' }, parents: [] });
    if (m === 'GET' && /^\/pulls\/\d+$/.test(p)) return json(pr());
    if (m === 'GET' && /^\/pulls\/\d+\/reviews$/.test(p)) return json([]);
    if (m === 'GET' && /^\/pulls\/\d+\/files$/.test(p)) return json(page === 1 ? files : []);
    if (m === 'GET' && (mm = /^\/commits\/([0-9a-f]{40})\/check-runs$/.exec(p))) {
      if (page === 1) reads[mm[1]] = (reads[mm[1]] ?? 0) + 1;
      const runs = page === 1 && cfg.checkRuns ? cfg.checkRuns(mm[1], reads[mm[1]]) : [];
      return json({ check_runs: runs.map((r) => ({ details_url: 'https://github.com/o/r/actions/runs/1/job/2', completed_at: iso(NOW - 10 * MIN), ...r })) });
    }
    if (m === 'GET' && /^\/commits\/[0-9a-f]{40}\/status$/.test(p)) return json({ statuses: [] });
    if (m === 'GET' && p === '/actions/runs') return json({ workflow_runs: [{ id: 1, workflow_id: 1, head_sha: u.searchParams.get('head_sha'), event: 'pull_request', created_at: iso(NOW - 30 * MIN) }] });
    if (m === 'GET' && /^\/issues\/\d+\/events$/.test(p)) return json([
      { event: 'labeled', label: { name: 'run-ci' }, actor: { login: BOT_LOGIN }, created_at: iso(NOW - 31 * MIN) },
      { event: 'labeled', label: { name: 'review-passed' }, actor: { login: BOT_LOGIN }, created_at: iso(NOW - 5 * MIN) },
    ]);
    if (m === 'GET' && /^\/issues\/\d+\/comments$/.test(p)) return json([{ id: 300, user: { login: GH_BOT }, html_url: 'u', body: `pack\n<!-- autopilot-pack head=${head} -->` }]);
    if (m === 'PUT' && /^\/pulls\/\d+\/merge$/.test(p)) return json({ merged: true, sha: MERGED });
    if (m === 'POST' && /^\/issues\/\d+\/comments$/.test(p)) return json({ id: 900, html_url: 'u' });
    if (m === 'PATCH' && /^\/issues\/comments\/\d+$/.test(p)) return json({ id: 1, html_url: 'u' });
    if (m === 'POST' && /^\/issues\/\d+\/labels$/.test(p)) return json([]);
    if (m === 'DELETE' && /^\/issues\/\d+\/labels\//.test(p)) return json(null, 204);
    if (m === 'POST' && p === '/issues') return json({ number: 77, node_id: 'n' });
    if (m === 'POST' && u.pathname === '/graphql') return json({});
    if (m === 'GET' && p === '/contents/vercel.json') return json({ content: 'eyJnaXQiOiB7ImRlcGxveW1lbnRFbmFibGVkIjogeyJjbGF1ZGUvKiI6IGZhbHNlLCAibWFpbiI6IHRydWV9fX0=', encoding: 'base64' });
    return json({ message: `fake: unhandled ${m} ${p}` }, 500);
  };
  const merges = () => log.filter((l) => l.m === 'PUT' && /\/merge$/.test(l.p));
  const headReads = () => reads[head] ?? 0;
  return { log, fetchImpl, head, merges, headReads };
}
