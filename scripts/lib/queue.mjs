// Pure helpers for the GitHub-native work queue (docs/queue.md). No network, no fs:
// the scripts (queue-claim, queue-watchdog, queue-daily-report, queue-merge-decide)
// inject their I/O so tests/queueScripts.test.ts can drive every branch.

export const PRIORITY = ['p1', 'p2', 'p3'];
export const STALL_MARKER = '<!-- queue-stall -->';
export const STALL_MS = 60 * 60 * 1000;

const names = (labels) => (labels || []).map((l) => (typeof l === 'string' ? l : l.name));

export function prioRank(labels) {
  const n = names(labels);
  const i = PRIORITY.findIndex((p) => n.includes(p));
  return i === -1 ? PRIORITY.length : i;
}

/** Highest priority first (p1>p2>p3>none), then oldest, then lowest number. */
export function pickIssue(issues) {
  const open = (issues || []).filter((i) => {
    const n = names(i.labels);
    return !i.pull_request && i.state !== 'closed' && n.includes('queue') && !n.includes('in-progress') && !n.includes('owner-reserved');
  });
  open.sort((a, b) => prioRank(a.labels) - prioRank(b.labels) || String(a.created_at).localeCompare(String(b.created_at)) || a.number - b.number);
  return open[0] || null;
}

/** `Related: #12 #13` in the body: at most 3 issue numbers, never the issue itself. */
export function relatedOf(body, self) {
  const m = /^\s*Related:\s*(.+)$/im.exec(String(body || ''));
  if (!m) return [];
  const nums = [...m[1].matchAll(/#(\d+)/g)].map((x) => Number(x[1])).filter((n) => n !== self);
  return [...new Set(nums)].slice(0, 3);
}

export function globToRe(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') { re += '(?:.*/)?'; i += 2; } else { re += '.*'; i += 1; }
    } else if (c === '*') re += '[^/]*';
    else re += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`, 'i');
}

/** Why a PR must be owner-reserved: reserved globs or any HARD-tier path. Empty = auto-merge ok. */
export function reservedReasons(files, globs, tierFn) {
  const res = globs.map((g) => [g, globToRe(g)]);
  const out = [];
  for (const f of files) {
    const hit = res.find(([, re]) => re.test(f));
    if (hit) out.push(`${f} matches ${hit[0]}`);
    else if (tierFn(f) === 'hard') out.push(`${f} is HARD tier`);
  }
  return out;
}

/** The run comment carries this marker so the daily report can add it up. */
export function costMarker({ costUsd, inTok, outTok, turns }) {
  return `<!-- queue-run cost_usd=${Number(costUsd) || 0} in=${Number(inTok) || 0} out=${Number(outTok) || 0} turns=${Number(turns) || 0} -->`;
}

export function sumCosts(bodies) {
  const t = { runs: 0, costUsd: 0, inTok: 0, outTok: 0 };
  for (const b of bodies) {
    const m = /<!-- queue-run cost_usd=([\d.]+) in=(\d+) out=(\d+)/.exec(String(b || ''));
    if (!m) continue;
    t.runs += 1; t.costUsd += Number(m[1]); t.inTok += Number(m[2]); t.outTok += Number(m[3]);
  }
  return t;
}

/**
 * Stall decisions. issues: open, each {number, labels, updated_at, stalls}; activeRuns: count of
 * queued/in-progress queue-worker runs; redPrs: [{issue, reserved}] open claude/queue- PRs with red checks.
 * An issue already waiting (queue), with the owner (owner-turn) or reserved is never touched.
 */
export function decideStalls({ issues, activeRuns, redPrs, now }) {
  const skip = (i) => names(i.labels).some((n) => ['queue', 'owner-turn', 'owner-reserved'].includes(n));
  const byNum = new Map(issues.map((i) => [i.number, i]));
  const hit = new Map();
  for (const i of issues) {
    if (skip(i) || !names(i.labels).includes('in-progress')) continue;
    if (activeRuns === 0 && now - Date.parse(i.updated_at) > STALL_MS) hit.set(i.number, 'in-progress for over 1 hour with no run');
  }
  for (const p of redPrs) {
    const i = byNum.get(p.issue);
    if (p.reserved || !i || skip(i)) continue;
    if (!hit.has(i.number)) hit.set(i.number, `PR for #${i.number} has red checks`);
  }
  return [...hit].map(([issue, reason]) => ({
    issue, reason, kind: (byNum.get(issue).stalls || 0) >= 1 ? 'owner-turn' : 'requeue',
  }));
}

export function parseBudget(md) {
  const m = /Daily budget \(USD\):\s*(\d+(?:\.\d+)?)/i.exec(String(md || ''));
  return m ? Number(m[1]) : null;
}

export function reportMarkdown({ date, merged, queued, ownerTurn, totals, budget }) {
  const by = (p) => queued.filter((i) => prioRank(i.labels) === PRIORITY.indexOf(p)).length;
  const none = queued.filter((i) => prioRank(i.labels) === PRIORITY.length).length;
  const lines = [
    `## Queue report ${date}`,
    `- Merged today: ${merged.length}${merged.length ? ' (' + merged.map((n) => '#' + n).join(', ') + ')' : ''}`,
    `- Open queue: p1 ${by('p1')}, p2 ${by('p2')}, p3 ${by('p3')}, unprioritised ${none}`,
    `- Waiting on owner (owner-turn): ${ownerTurn.length}${ownerTurn.length ? ' (' + ownerTurn.map((i) => '#' + i.number).join(', ') + ')' : ''}`,
    `- Worker runs today: ${totals.runs}, tokens in ${totals.inTok} / out ${totals.outTok}, cost $${totals.costUsd.toFixed(2)}`,
  ];
  if (budget != null && totals.costUsd > budget) lines.push(`- WARNING: over the daily budget of $${budget} (warn only; the queue keeps running)`);
  return lines.join('\n');
}

/** Minimal REST client; `fetchImpl` injectable. Throws on non-2xx so callers exit 2 (cannot measure). */
export function makeApi(token, repo, fetchImpl = fetch) {
  return async function api(method, path, body) {
    const res = await fetchImpl(`https://api.github.com/repos/${repo}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) { const e = new Error(`${method} ${path} -> ${res.status}`); e.status = res.status; throw e; }
    return res.status === 204 ? null : res.json();
  };
}
