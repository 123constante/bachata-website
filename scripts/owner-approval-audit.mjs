#!/usr/bin/env node
/**
 * Owner-approval AUDIT (not a gate) for a commit that landed on main.
 *
 * Feature-branch pushes skip the review-receipt gate (.githooks/pre-push): the owner's
 * PR approval is the review, and it cannot exist before the push. GitHub Free cannot
 * enforce "requires approval", so this is the after-the-fact net: a commit on main that
 * touches a HARD-tier path (scripts/lib/review-scope.mjs riskTier) must belong to a PR
 * whose owner APPROVED it at that PR's head. Mirrors admin's owner-approval-audit.
 *
 *   exit 0  clean: nothing hard-tier touched, or owner-approved at head
 *   exit 1  RED:   hard-tier change without an owner approval at head
 *   exit 2  infra: could not determine (the workflow still raises an issue)
 *
 * Usage: GH_TOKEN=... GITHUB_REPOSITORY=owner/repo node scripts/owner-approval-audit.mjs <sha>
 */
import { riskTier } from "./lib/review-scope.mjs";
import { isEntryPoint } from "./lib/entry-point.mjs";

export const OWNER_LOGIN = "123constante";

/**
 * Pure verdict. `files` = paths the commit touched; `prs` = [{number, headSha, reviews}]
 * where reviews are GitHub review objects ({user:{login}, state, commit_id}).
 */
export function decideAudit({ files, prs, owner = OWNER_LOGIN }) {
  const hard = (files || []).filter((f) => riskTier(f) === "hard");
  if (hard.length === 0) return { code: 0, reason: "no hard-tier path touched" };
  if (!prs || prs.length === 0) {
    return { code: 1, reason: `hard-tier change with no PR (direct push to main): ${hard.join(", ")}` };
  }
  for (const pr of prs) {
    const mine = (pr.reviews || []).filter(
      (r) => r && r.user && String(r.user.login).toLowerCase() === owner.toLowerCase() && r.state !== "COMMENTED"
    );
    const last = mine[mine.length - 1];
    if (last && last.state === "APPROVED" && last.commit_id === pr.headSha) {
      return { code: 0, reason: `PR #${pr.number} owner-approved at head ${pr.headSha.slice(0, 8)}` };
    }
  }
  const nums = prs.map((p) => "#" + p.number).join(", ");
  return { code: 1, reason: `hard-tier change in ${nums} without an owner approval at the PR head: ${hard.join(", ")}` };
}

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.json();
}

async function paginate(path) {
  const out = [];
  for (let page = 1; page < 50; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const batch = await gh(`${path}${sep}per_page=100&page=${page}`);
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

/** Audit ONE commit: its own files, the merged PRs it belongs to. */
async function auditCommit(repo, sha) {
  const commit = await gh(`/repos/${repo}/commits/${sha}`);
  if ((commit.files || []).length >= 300) {
    return { code: 2, reason: `${sha.slice(0, 8)} lists 300+ files (API cap) - cannot prove the hard-tier set` };
  }
  const files = (commit.files || []).map((f) => f.filename);
  const assoc = await gh(`/repos/${repo}/commits/${sha}/pulls`);
  const prs = [];
  for (const p of assoc.filter((x) => x.merged_at)) {
    const reviews = await paginate(`/repos/${repo}/pulls/${p.number}/reviews`);
    prs.push({ number: p.number, headSha: p.head.sha, reviews });
  }
  return decideAudit({ files, prs });
}

const ZERO = /^0+$/;

async function main() {
  // <sha> [<before>]: with <before> (a push event), EVERY commit in before..sha is
  // audited -- github.sha alone is only the newest commit of a multi-commit push.
  const [sha, before] = process.argv.slice(2);
  const repo = process.env.GITHUB_REPOSITORY;
  if (!sha || !repo || !process.env.GH_TOKEN) {
    console.log("INFRA: need <sha>, GITHUB_REPOSITORY and GH_TOKEN");
    return 2;
  }
  let shas = [sha];
  if (before !== undefined && before !== "") {
    if (ZERO.test(before)) {
      console.log("INFRA: push has no 'before' commit (new branch) - cannot bound the range");
      return 2;
    }
    const cmp = await gh(`/repos/${repo}/compare/${before}...${sha}`);
    if ((cmp.total_commits || 0) > (cmp.commits || []).length) {
      console.log(`INFRA: push carries ${cmp.total_commits} commits, compare listed ${cmp.commits.length}`);
      return 2;
    }
    shas = (cmp.commits || []).map((c) => c.sha);
    if (shas.length === 0) {
      console.log(`INFRA: compare ${before.slice(0, 8)}...${sha.slice(0, 8)} listed no commits (force push?)`);
      return 2;
    }
  }
  let worst = 0;
  for (const c of shas) {
    const v = await auditCommit(repo, c);
    console.log(`${v.code === 0 ? "OK" : v.code === 1 ? "RED" : "INFRA"} ${c.slice(0, 8)}: ${v.reason}`);
    // RED outranks INFRA: a proven unapproved change is the stronger alarm.
    if (v.code === 1 || (v.code === 2 && worst === 0)) worst = v.code;
  }
  return worst;
}

if (isEntryPoint(import.meta.url)) {
  main().then(
    (code) => { process.exitCode = code; },
    (err) => { console.log(`INFRA: ${err.message || err}`); process.exitCode = 2; }
  );
}
