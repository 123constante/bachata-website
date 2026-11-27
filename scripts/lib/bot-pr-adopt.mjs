// Decide what bot-pr.yml does for a pushed claude/** branch, and replace an OWNER-authored
// open PR with a bot-authored copy (the merge gate needs a bot author so the owner login can
// Approve; P125, P138). Runs from the DEFAULT branch checkout only: its env holds BOT_PR_TOKEN.
//
// Outcome is written to $ADOPT_OUT: "open" = the branch has no PR and none merged, so the
// workflow goes on to open a new one from scripts/pr-body-stub.mjs; "skip" = nothing more to do.
//
//   no open PR, none merged     -> "open"
//   open PR by the bot          -> "skip"
//   open PR by the owner        -> close it, open the same title/head/base/body as the bot,
//                                  copy labels, comment "Replaced by #N", then "skip"
//   owner PR is a draft / fork  -> "skip" + warning (never replaced)
//   branch already merged       -> "skip" + warning (#547, #553, #554)
//   any API error               -> throws (exit 1). The old PR is never closed without a
//                                  successful reopen-as-bot; a failed create reopens it.
import { writeFileSync } from 'node:fs';
import { isEntryPoint } from './entry-point.mjs';

const API = 'https://api.github.com';

export function makeApi(token, fetchImpl = globalThis.fetch) {
  return async function api(method, path, body) {
    const res = await fetchImpl(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* keep null */ }
    if (!res.ok) throw new Error(`${method} ${path} -> HTTP ${res.status}: ${text.slice(0, 300)}`);
    return json;
  };
}

/**
 * @returns {Promise<'open'|'skip'>}
 */
export async function adopt({ api, repo, owner, branch, base, warn = () => {}, log = () => {} }) {
  const head = encodeURIComponent(`${owner}:${branch}`);
  const openPrs = await api('GET', `/repos/${repo}/pulls?state=open&head=${head}`);
  if (!Array.isArray(openPrs)) throw new Error('unexpected response listing open PRs');

  if (openPrs.length === 0) {
    const closed = await api('GET', `/repos/${repo}/pulls?state=closed&head=${head}&per_page=100`);
    if (!Array.isArray(closed)) throw new Error('unexpected response listing closed PRs');
    const merged = closed.filter((p) => p.merged_at).map((p) => `#${p.number}`);
    if (merged.length) {
      warn(`${branch} already shipped in ${merged.join(' ')} (merged), so this push opens no PR. Put new work on a new branch cut from ${base}.`);
      return 'skip';
    }
    return 'open';
  }

  if (openPrs.length > 1) {
    warn(`${branch} has ${openPrs.length} open PRs (${openPrs.map((p) => `#${p.number}`).join(' ')}); not replacing any. Close the extras and push again.`);
    return 'skip';
  }
  const old = openPrs[0];
  if (String(old.user?.login || '').toLowerCase() !== String(owner || '').toLowerCase()) {
    log(`Already has an open PR: #${old.number} (by ${old.user?.login})`);
    return 'skip';
  }
  if (old.draft) {
    warn(`#${old.number} is an owner-authored DRAFT; not replacing it. Mark it ready, or close it and push again.`);
    return 'skip';
  }
  if (old.head?.repo?.full_name !== repo) {
    warn(`#${old.number} comes from a fork (${old.head?.repo?.full_name}); not replacing it.`);
    return 'skip';
  }

  const labels = (old.labels || []).map((l) => (typeof l === 'string' ? l : l.name)).filter(Boolean);
  await api('PATCH', `/repos/${repo}/pulls/${old.number}`, { state: 'closed' });
  let created;
  try {
    created = await api('POST', `/repos/${repo}/pulls`, {
      title: old.title,
      head: branch,
      base: old.base?.ref || base,
      body: old.body ?? '',
    });
  } catch (err) {
    // Never leave the branch with no open PR.
    try { await api('PATCH', `/repos/${repo}/pulls/${old.number}`, { state: 'open' }); }
    catch (e2) { throw new Error(`${err.message}; AND reopening #${old.number} failed: ${e2.message}`); }
    throw err;
  }
  log(`Opened #${created.number} as ${created.user?.login}, replacing #${old.number}`);
  // The bot PR exists now; a failure below must not lose the old PR's labels silently.
  try {
    if (labels.length) await api('POST', `/repos/${repo}/issues/${created.number}/labels`, { labels });
    await api('POST', `/repos/${repo}/issues/${old.number}/comments`, { body: `Replaced by #${created.number}` });
  } catch (err) {
    throw new Error(`#${created.number} was opened as the bot, but copying labels or commenting on #${old.number} failed: ${err.message}. Old labels to re-apply by hand: ${labels.join(', ') || '(none)'}`);
  }
  return 'skip';
}

async function main() {
  const { BOT_TOKEN, REPO, OWNER, BRANCH, BASE, ADOPT_OUT } = process.env;
  if (!BOT_TOKEN) { console.log('::error::secret BOT_PR_TOKEN is not set'); return 1; }
  try {
    const out = await adopt({
      api: makeApi(BOT_TOKEN), repo: REPO, owner: OWNER, branch: BRANCH, base: BASE,
      warn: (m) => {
        console.log(`::warning::${m}`);
        if (process.env.GITHUB_STEP_SUMMARY) {
          writeFileSync(process.env.GITHUB_STEP_SUMMARY, `${m}\n`, { flag: 'a' });
        }
      },
      log: (m) => console.log(m),
    });
    if (ADOPT_OUT) writeFileSync(ADOPT_OUT, out);
    return 0;
  } catch (err) {
    console.log(`::error::${err.message}`);
    return 1;
  }
}

if (isEntryPoint(import.meta.url)) {
  process.exitCode = await main();
}
