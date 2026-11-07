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
 *
 * Slice 2 (drill A18 layer 2; docs/automation-foundations.md), ONLY behind the arming key
 * `audit_escalation` in .github/automation/arming.json (read from this checkout, never a
 * variable; ships false): the hard set ALSO counts every guard path (scripts/lib/guard-paths.mjs),
 * and a RED verdict on a guard path additionally sets the pause label on the pinned AUTOMATION
 * PAUSE SWITCH issue and posts ONE notice naming the sha and PR (escalateRed; GITHUB_TOKEN
 * issues: write, which the workflow already has). Opening a revert PR is DESIGN ONLY (not built).
 * With the key off, every verdict is exactly today's.
 *
 * Class C review record (DETECTIVE only; brief audit-review-record-class-c): for each merged PR
 * of a commit touching a test path (automerge-classify pathClass === "tests"), the audit also
 * reads the PR's review record and prints `RECORD-MISSING <sha8>: PR #n <first problem>` when
 * reviewRecordVerdict refuses it. That line never changes the exit code (worstCode ignores it).
 * A PR the owner approved at head is skipped (`RECORD-SKIP`): the approval is the stronger record.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { riskTier } from "./lib/review-scope.mjs";
import { isEntryPoint } from "./lib/entry-point.mjs";
import { isGuardPath } from "./lib/guard-paths.mjs";
import { readArming, ARMING_PATH } from "./lib/arming.mjs";
import { postPauseNotice, PAUSE_LABEL } from "./lib/automation-pause.mjs";
import { setPauseLabel } from "./automation-pause.mjs";
import { pathClass, reviewRecordVerdict, readReviewRecord } from "./automerge-classify.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export const OWNER_LOGIN = "123constante";

/**
 * Pure verdict. `files` = paths the commit touched; `prs` = [{number, headSha, reviews}]
 * where reviews are GitHub review objects ({user:{login}, state, commit_id}).
 * `escalation` = arming.json audit_escalation. Off (default) = exactly today's verdict objects.
 * On = guard paths count as hard too, and a verdict carries escalate (RED on a guard path), guard
 * (the guard paths touched) and prs (the PR numbers) for escalateRed().
 */
export function decideAudit({ files, prs, owner = OWNER_LOGIN, escalation = false }) {
  if (escalation !== true) return verdictOf({ files, prs, owner, isHard: (f) => riskTier(f) === "hard" });
  const v = verdictOf({ files, prs, owner, isHard: (f) => riskTier(f) === "hard" || isGuardPath(f) });
  const guard = (files || []).filter((f) => isGuardPath(f));
  return { ...v, escalate: v.code === 1 && guard.length > 0, guard, prs: (prs || []).map((p) => p.number) };
}

function verdictOf({ files, prs, owner, isHard }) {
  const hard = (files || []).filter(isHard);
  if (hard.length === 0) return { code: 0, reason: "no hard-tier path touched" };
  if (!prs || prs.length === 0) {
    return { code: 1, reason: `hard-tier change with no PR (direct push to main): ${hard.join(", ")}` };
  }
  for (const pr of prs) {
    if (ownerApprovedAtHead(pr, owner)) {
      return { code: 0, reason: `PR #${pr.number} owner-approved at head ${pr.headSha.slice(0, 8)}` };
    }
  }
  const nums = prs.map((p) => "#" + p.number).join(", ");
  return { code: 1, reason: `hard-tier change in ${nums} without an owner approval at the PR head: ${hard.join(", ")}` };
}

/** The owner's LATEST non-COMMENTED review is APPROVED at the PR's head sha. */
function ownerApprovedAtHead(pr, owner = OWNER_LOGIN) {
  const mine = ((pr && pr.reviews) || []).filter(
    (r) => r && r.user && String(r.user.login).toLowerCase() === owner.toLowerCase() && r.state !== "COMMENTED"
  );
  const last = mine[mine.length - 1];
  return Boolean(last && last.state === "APPROVED" && typeof pr.headSha === "string" && last.commit_id === pr.headSha);
}

/**
 * Pure class C record verdict for ONE merged PR of a commit. `files` = the commit's paths;
 * `pr` = {number, headSha, labels, reviews}; `record` = readReviewRecord()'s answer (null /
 * {error} = unreadable, which fails closed). -> { applies, ok, problems, skipped }.
 * applies: some file is a test path (pathClass, shared, never copied). skipped: the owner
 * approved at head, so no record is needed. Detective only: never feeds an exit code.
 */
export function decideRecordAudit({ files, pr, record, owner = OWNER_LOGIN }) {
  const applies = (files || []).some((f) => pathClass(f) === "tests");
  if (!applies) return { applies: false, ok: true, problems: [], skipped: false };
  if (ownerApprovedAtHead(pr, owner)) return { applies: true, ok: true, problems: [], skipped: true, pr: pr.number };
  const problems = reviewRecordVerdict({ headSha: pr && pr.headSha, labels: (pr && pr.labels) || [], record });
  return { applies: true, ok: problems.length === 0, problems, skipped: false, pr: pr && pr.number };
}

/** The log line for one record result, or null when there is nothing to say. */
export function recordLine(sha, r) {
  if (!r || !r.applies) return null;
  const s8 = String(sha).slice(0, 8);
  if (r.skipped) return `RECORD-SKIP ${s8}: PR #${r.pr} owner-approved at head (no review record needed)`;
  if (!r.ok) return `RECORD-MISSING ${s8}: PR #${r.pr} ${r.problems[0]}`;
  return null;
}

/** Exit code of a run: RED (1) outranks INFRA (2) outranks OK (0). Reads `code` only, so
 *  the detective record results a verdict carries can never move it. */
export function worstCode(verdicts) {
  let worst = 0;
  for (const v of verdicts || []) {
    // RED outranks INFRA: a proven unapproved change is the stronger alarm.
    if (v.code === 1 || (v.code === 2 && worst === 0)) worst = v.code;
  }
  return worst;
}

/**
 * Layer (2) escalation for ONE red commit (audit_escalation on): set the pause label on THE pinned
 * pause issue and post ONE notice (key audit-red:<sha>; slice 1 postPauseNotice de-duplicates).
 * -> { labelled, notice, error }. Never throws.
 */
export async function escalateRed({ repo, token, sha, verdict, fetch: fetchImpl = globalThis.fetch }) {
  const out = { labelled: false, notice: null, error: null };
  try {
    await setPauseLabel({ repo, token, fetch: fetchImpl }); // slice 1's ONE label-adding site
    out.labelled = true;
  } catch (e) {
    out.error = e && e.message ? e.message : String(e);
  }
  const prs = ((verdict && verdict.prs) || []).map((n) => `#${n}`).join(", ") || "no PR (direct push)";
  const text = [
    `Owner-approval audit RED on a GUARD path: commit ${sha} (${prs}) landed on main without the owner's Approve at the PR head.`,
    `Guard paths: ${((verdict && verdict.guard) || []).join(", ") || "?"}.`,
    `The automation is PAUSED (label ${PAUSE_LABEL}). Review the commit; revert it or approve. Only the owner clears the pause.`,
  ].join("\n");
  out.notice = await postPauseNotice({ repo, token, fetch: fetchImpl, key: `audit-red:${sha}`, text });
  if (out.notice && out.notice.error && !out.error) out.error = out.notice.error;
  return out;
}

/** arming.json audit_escalation from this checkout; unreadable = false (today's behaviour). */
export function readEscalation(readFile = (p) => readFileSync(p, "utf8")) {
  let text = null;
  try { text = readFile(join(ROOT, ARMING_PATH)); } catch (e) { console.log(`arming.json not read (${e.message}): audit_escalation off`); }
  return readArming(text).values.audit_escalation === true;
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
async function auditCommit(repo, sha, escalation) {
  const commit = await gh(`/repos/${repo}/commits/${sha}`);
  if ((commit.files || []).length >= 300) {
    return { code: 2, reason: `${sha.slice(0, 8)} lists 300+ files (API cap) - cannot prove the hard-tier set` };
  }
  const files = (commit.files || []).map((f) => f.filename);
  const assoc = await gh(`/repos/${repo}/commits/${sha}/pulls`);
  const prs = [];
  for (const p of assoc.filter((x) => x.merged_at)) {
    const reviews = await paginate(`/repos/${repo}/pulls/${p.number}/reviews`);
    prs.push({ number: p.number, headSha: p.head.sha, reviews, labels: (p.labels || []).map((l) => l && l.name) });
  }
  const v = decideAudit({ files, prs, escalation });
  return { ...v, records: await recordAudits(repo, files, prs) };
}

/** Detective class C record check for each merged PR. Never throws: any read failure becomes
 *  an { error } record, which decideRecordAudit fails closed into RECORD-MISSING. */
async function recordAudits(repo, files, prs) {
  const out = [];
  for (const pr of prs) {
    const first = decideRecordAudit({ files, pr, record: null });
    if (!first.applies || first.skipped) { out.push(first); continue; }
    let record;
    try {
      const events = await paginate(`/repos/${repo}/issues/${pr.number}/events`);
      record = await readReviewRecord(repo, pr.number, pr.headSha, events);
    } catch (e) {
      record = { error: e && e.message ? e.message : String(e) };
    }
    out.push(decideRecordAudit({ files, pr, record }));
  }
  return out;
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
  const escalation = readEscalation();
  console.log(`audit_escalation (arming.json): ${escalation ? "on" : "off"}`);
  const verdicts = [];
  for (const c of shas) {
    const v = await auditCommit(repo, c, escalation);
    verdicts.push(v);
    console.log(`${v.code === 0 ? "OK" : v.code === 1 ? "RED" : "INFRA"} ${c.slice(0, 8)}: ${v.reason}`);
    for (const r of v.records || []) {
      const line = recordLine(c, r);
      if (line) console.log(line);
    }
    if (v.escalate) {
      const e = await escalateRed({ repo, token: process.env.GH_TOKEN, sha: c, verdict: v });
      console.log(`ESCALATE ${c.slice(0, 8)}: pause label ${e.labelled ? "set" : "NOT set"}; notice ${e.notice && e.notice.posted ? "posted" : e.notice && e.notice.skipped ? "already posted" : "NOT posted"}${e.error ? ` (${e.error})` : ""}`);
    }
  }
  return worstCode(verdicts);
}

if (isEntryPoint(import.meta.url)) {
  main().then(
    (code) => { process.exitCode = code; },
    (err) => { console.log(`INFRA: ${err.message || err}`); process.exitCode = 2; }
  );
}
