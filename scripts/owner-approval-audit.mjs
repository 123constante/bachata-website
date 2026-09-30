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

async function main() {
  const sha = process.argv[2];
  const repo = process.env.GITHUB_REPOSITORY;
  if (!sha || !repo || !process.env.GH_TOKEN) {
    console.log("INFRA: need <sha>, GITHUB_REPOSITORY and GH_TOKEN");
    return 2;
  }
  const commit = await gh(`/repos/${repo}/commits/${sha}`);
  const files = (commit.files || []).map((f) => f.filename);
  if ((commit.files || []).length >= 300) {
    console.log("INFRA: commit lists 300+ files (API cap) - cannot prove the hard-tier set");
    return 2;
  }
  const assoc = await gh(`/repos/${repo}/commits/${sha}/pulls`);
  const prs = [];
  for (const p of assoc.filter((x) => x.merged_at)) {
    const reviews = await paginate(`/repos/${repo}/pulls/${p.number}/reviews`);
    prs.push({ number: p.number, headSha: p.head.sha, reviews });
  }
  const v = decideAudit({ files, prs });
  console.log(`${v.code === 0 ? "OK" : "RED"}: ${v.reason}`);
  return v.code;
}

if (isEntryPoint(import.meta.url)) {
  main().then(
    (code) => { process.exitCode = code; },
    (err) => { console.log(`INFRA: ${err.message || err}`); process.exitCode = 2; }
  );
}
