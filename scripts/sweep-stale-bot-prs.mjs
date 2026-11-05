#!/usr/bin/env node
/**
 * Stale-bot-PR sweep runner (.github/workflows/stale-bot-pr-sweep.yml).
 * Lists open PRs, applies scripts/lib/stale-bot-pr.mjs decide(), and with --apply closes at most
 * MAX_CLOSES (oldest first), posting one comment before each close. DRY-RUN unless --apply.
 * Never touches a non-bot PR, never deletes a branch.
 *
 * Env: GH_TOKEN (the bot token), GITHUB_REPOSITORY.
 * Exit: 0 done (per-PR API errors skip that PR and are logged), 2 infrastructure (missing env,
 * or listing PRs failed: nothing is closed).
 */
import { decide as _decide, plan, closeComment, ticketKeys } from './lib/stale-bot-pr.mjs';
import { BOT_LOGIN } from './lib/autopilot.mjs';
import { isEntryPoint } from './lib/entry-point.mjs';

const API = 'https://api.github.com';

export function makeApi({ token, fetch: fetchImpl = globalThis.fetch }) {
  return async function api(method, path, body) {
    const res = await fetchImpl(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`${method} ${path} -> HTTP ${res.status}`);
    return res.status === 204 ? null : res.json();
  };
}

async function listAll(api, path, maxPages) {
  const out = [];
  for (let page = 1; page <= maxPages; page++) {
    const rows = await api('GET', `${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    if (!Array.isArray(rows)) throw new Error(`GET ${path} did not return a list`);
    out.push(...rows);
    if (rows.length < 100) break;
  }
  return out;
}

const newest = (...ts) => ts.filter(Boolean).map((t) => new Date(t).getTime()).filter(Number.isFinite).reduce((a, b) => (Number.isFinite(a) ? Math.max(a, b) : b), NaN);

/** Enrich one bot PR with head subject, changed files and lastActivity. Throws on API error. */
async function enrich(api, repo, p) {
  const detail = await api('GET', `/repos/${repo}/pulls/${p.number}`);
  const commits = await listAll(api, `/repos/${repo}/pulls/${p.number}/commits`, 3);
  const comments = await listAll(api, `/repos/${repo}/issues/${p.number}/comments`, 3);
  const head = commits.at(-1);
  const last = newest(p.updated_at, ...comments.map((c) => c.updated_at || c.created_at), ...commits.map((c) => c.commit?.committer?.date));
  return {
    number: p.number,
    author: p.user?.login,
    headRef: p.head?.ref,
    labels: (p.labels || []).map((l) => l.name),
    draft: !!p.draft,
    createdAt: p.created_at,
    lastActivity: Number.isFinite(last) ? new Date(last).toISOString() : null,
    title: p.title,
    headSubject: String(head?.commit?.message || '').split('\n')[0],
    changedFiles: detail.changed_files,
  };
}

const shallow = (p) => ({ number: p.number, author: p.user?.login, headRef: p.head?.ref, labels: (p.labels || []).map((l) => l.name), draft: !!p.draft, createdAt: p.created_at, lastActivity: p.updated_at, title: p.title, headSubject: '', changedFiles: undefined });

export async function run({ env = process.env, argv = process.argv.slice(2), fetch: fetchImpl = globalThis.fetch, now = Date.now(), log = console.log } = {}) {
  const apply = argv.includes('--apply');
  const repo = env.GITHUB_REPOSITORY;
  if (!env.GH_TOKEN || !repo) { log('INFRA: GH_TOKEN and GITHUB_REPOSITORY are required'); return 2; }
  const api = makeApi({ token: env.GH_TOKEN, fetch: fetchImpl });
  let open, closed;
  try {
    open = await listAll(api, `/repos/${repo}/pulls?state=open`, 10);
    closed = await listAll(api, `/repos/${repo}/pulls?state=closed&sort=created&direction=desc`, 3);
  } catch (e) {
    log(`INFRA: listing PRs failed, closing nothing: ${e.message}`);
    return 2;
  }
  const others = [
    ...open.map((p) => ({ number: p.number, createdAt: p.created_at, state: 'open', keys: ticketKeys({ title: p.title, headRef: p.head?.ref }), headRef: p.head?.ref })),
    ...closed.filter((p) => p.merged_at).map((p) => ({ number: p.number, createdAt: p.created_at, state: 'merged', keys: ticketKeys({ title: p.title, headRef: p.head?.ref }), headRef: p.head?.ref })),
  ];
  const ctx = { others };
  const prs = [];
  for (const p of open) {
    // Cheap pre-filter on the list row: with changedFiles 0 every rule-eligible PR reads "close", so
    // only bot PRs that could still be closed (author, head, labels, staleness) cost API calls.
    const pre = _decide({ ...shallow(p), changedFiles: 0, headSubject: '' }, { others: [] }, now);
    if (p.user?.login !== BOT_LOGIN || !pre.close) {
      log(`#${p.number} keep: ${pre.reason}`);
      continue;
    }
    try {
      prs.push(await enrich(api, repo, p));
    } catch (e) {
      log(`#${p.number} skip: API error ${e.message}`);
    }
  }
  const { decisions, toClose } = plan(prs, ctx, now);
  const chosen = new Set(toClose.map((d) => d.pr.number));
  for (const d of decisions) {
    if (!d.close) log(`#${d.pr.number} keep: ${d.reason}`);
    else if (!chosen.has(d.pr.number)) log(`#${d.pr.number} would close (over the per-run cap, next run): ${d.reason}`);
  }
  for (const d of toClose) {
    if (!apply) { log(`#${d.pr.number} DRY-RUN close: ${d.reason}`); continue; }
    try {
      const c = await api('POST', `/repos/${repo}/issues/${d.pr.number}/comments`, { body: closeComment(d.reason) });
      try {
        await api('PATCH', `/repos/${repo}/pulls/${d.pr.number}`, { state: 'closed' });
      } catch (e) {
        // The close failed: take back the "Closed by" comment so the PR does not claim a close
        // that never happened (and so it does not reset its own idle clock every cycle).
        if (c?.id) await api('DELETE', `/repos/${repo}/issues/comments/${c.id}`).catch((e2) => log(`#${d.pr.number} comment ${c.id} not removed: ${e2.message}`));
        throw e;
      }
      log(`#${d.pr.number} closed: ${d.reason}`);
    } catch (e) {
      log(`#${d.pr.number} skip: API error ${e.message}`);
    }
  }
  log(`sweep: ${open.length} open, ${prs.length} bot candidates, ${toClose.length} ${apply ? 'closed' : 'would close'}`);
  return 0;
}

if (isEntryPoint(import.meta.url)) {
  run().then((c) => { process.exitCode = c; }, (e) => { console.log(`INFRA: ${e.message}`); process.exitCode = 2; });
}
