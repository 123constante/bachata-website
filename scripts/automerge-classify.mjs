#!/usr/bin/env node
/**
 * Bot auto-merge CLASSIFIER: may this PR be auto-merged without the owner?
 *
 * Read docs/automerge.md first. This file only answers yes/no; the workflow
 * .github/workflows/bot-automerge.yml acts on the answer, and GitHub itself does
 * the merge, and only once the `main` ruleset's REQUIRED checks pass.
 *
 * FAIL CLOSED, everywhere: every rule below is a reason to say NO, and the answer
 * is YES only when the reason list is empty AND at least one file was judged. An
 * unknown file, an unknown status, a truncated file list, a missing label actor or
 * an unreadable real-data parser is a NO (or exit 2), never a pass.
 *
 * It NEVER reads PR code. Files, labels and the body come from the REST API; the
 * only code that runs is this file, the real-data parser and the Phone QA checker
 * (whose MARKER / HEADING exports it reads), all from the BASE branch checkout.
 * Either checker unreadable = the import fails = exit 2 = NO.
 *
 *   exit 0  classified (qualifies=true OR qualifies=false is in $GITHUB_OUTPUT)
 *   exit 2  infra: could not classify; the workflow treats this as NO and goes red
 *
 * Usage: imported, never run directly (see RUN at the bottom for the one-liner the
 *        workflow uses, with GH_TOKEN, GITHUB_REPOSITORY and PR_NUMBER set).
 *        Canary: node -e 'import("./scripts/automerge-classify.mjs").then((m) => process.exit(m.selfTest()))'
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { MARKER, HEADING as REAL_DATA_HEADING } from "./check-pr-real-data-verified.mjs";
import { HEADING as PHONE_QA_HEADING } from "./check-pr-phone-qa.mjs";
import { isMoney, parseMoneySet, MONEY_SET_PATH } from "./lib/is-money.mjs";
import { guardRefusals } from "./lib/guard-paths.mjs";
// Shared with the merge lane, never copied. A module cycle (autopilot-merge imports pathClass
// from here): every binding below is read only inside a function, never at module load.
import { DOC_EXT, REVIEW_LABEL, reviewLabelRefusal } from "./lib/autopilot-merge.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const LABEL_OK = "automerge-ok";
export const BLOCK_LABELS = ["needs-owner", "do-not-merge", "wip"];
export const MAX_CHANGED_LINES = 400; // strictly fewer than this (classes A/B)
export const MAX_CLASS_C_LINES = 200; // strictly fewer than this (class C, and any mixed PR)
export const MAX_CHANGED_FILES = 60; // at most this many files, every class
export const BOT_LOGIN = "kiki-claude-bot";
export const OWNER_LOGIN = "123constante";
// Owner decision (brief automerge-web-classes-abc): the PR AUTHOR must be the bot account, on
// any branch. The old arm that also took 123constante on a claude/ or ccr- branch is gone.
export const BOT_ONLY_AUTHOR = BOT_LOGIN;
export const LABEL_ACTORS = [BOT_LOGIN, OWNER_LOGIN];
export const REAL_DATA_PARSER = "scripts/check-pr-real-data-verified.mjs";

/* Never auto-merged, whatever the allowlist says. Checked on EVERY name a file
 * entry carries (new name and, for a rename/copy, the old one). */
const FORBIDDEN = [
  [/^(src|app|api|server|public|supabase|scripts|bin|node_modules)\//, "shipped / tooling tree"],
  [/^\.(github|claude|githooks|vercel)\//, "CI / hook / agent surface"],
  [/^middleware\.[cm]?[jt]s$/, "edge middleware"],
  [/(^|\/)package(-lock)?\.json$|(^|\/)npm-shrinkwrap\.json$|(^|\/)\.npmrc$/, "dependency manifest"],
  [/^vercel\.json$/, "deploy config"],
  [/^(vite|vitest|react-router|playwright|tailwind|postcss|eslint)[^/]*\.(c|m)?[jt]s$|^tsconfig[^/]*\.json$/, "build config"],
  [/(^|\/)(CLAUDE|AGENTS)\.md$/i, "agent doctrine (owner reviews)"],
  [/(auth|login|log-in|signin|sign-in|signup|sign-up|otp|magic-?link|password)/i, "auth / login file"],
];

/** A path the API handed us, rejected unless it is a plain relative POSIX path.
 *  `docs/../src/x` is the trap: a prefix test alone would call it docs. */
export function pathProblem(p) {
  if (typeof p !== "string" || p.length === 0) return "empty path";
  if (/[\\\0]/.test(p) || p.startsWith("/")) return "non-POSIX or absolute path";
  if (p.split("/").some((seg) => seg === "" || seg === "." || seg === "..")) return "path with ./.. or empty segment";
  return null;
}

/** The COARSE tree test the merge lane (scripts/lib/autopilot-merge.mjs) builds on: "docs" |
 *  "tests" | null. bot-automerge does NOT use it; its allowlist is classOf() below. */
const TEST_FILE = /\.(test|spec)\.(c|m)?[jt]sx?$/;
export function pathClass(p) {
  if (pathProblem(p)) return null;
  if (FORBIDDEN.some(([re]) => re.test(p))) return null;
  if (/^docs\//.test(p)) return "docs";
  if (/^(tests|e2e)\//.test(p) || /(^|\/)__tests__\//.test(p) || TEST_FILE.test(p)) return "tests";
  if (/\.md$/i.test(p)) return "docs";
  return null;
}

function forbiddenWhy(p) {
  const hit = FORBIDDEN.find(([re]) => re.test(p));
  return hit ? hit[1] : null;
}

/** Classes A/B (docs): a lowercase .md / .png / .jpg / .jpeg / .webp / .gif under docs/, or the
 *  root README.md (exact case). `docs/x.mjs`, `docs/x.json`, `README.MD` are NOT. GOVERNANCE
 *  prose under docs/ passes this test and is refused by the guard-path check in classify(). */
export function isClassAB(p) {
  if (pathProblem(p)) return false;
  return p === "README.md" || (/^docs\//.test(p) && DOC_EXT.test(p));
}

/** Class C (tests): a spec file only -- tests/**\/*.test.ts(x) or tests/e2e/**\/*.spec.ts. Any
 *  other file under tests/ (setup-env.ts, helpers, fixtures, tables) is NOT, nor e2e/,
 *  __tests__/ or a *.test.* outside tests/. */
export function isClassCTestPath(p) {
  if (pathProblem(p)) return false;
  return /^tests\/(?:[^/]+\/)*[^/]+\.test\.tsx?$/.test(p) || /^tests\/e2e\/(?:[^/]+\/)*[^/]+\.spec\.ts$/.test(p);
}

/** "A/B" | "C" | null (null = not on the A/B/C allowlist). Forbidden wins. */
export function classOf(p) {
  if (pathProblem(p) || forbiddenWhy(p)) return null;
  if (isClassAB(p)) return "A/B";
  if (isClassCTestPath(p)) return "C";
  return null;
}

/** `review-pack: <url> head <sha>` as the LAST non-empty line of the comment, whole line, nothing
 *  around it (as autopilot-pack's PACK_RE, review 1213-r1 F1): a marker quoted mid-comment, in a
 *  code span or with trailing text does not count. Url and sha are captured loosely so the refusal
 *  can say WHICH part is wrong. */
const PACK_LINE = /^review-pack:[ \t]+(\S+)[ \t]+head[ \t]+(\S+)[ \t]*$/;
const lastLine = (body) => String(body).replace(/\r\n?/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean).pop() || "";
const FULL_SHA = /^[0-9a-f]{40}$/;
const at = (s) => (typeof s === "string" && s ? Date.parse(s) : NaN);

/**
 * Class C's independent review record at the head sha, FAIL CLOSED. [] = ok, else the refusals.
 *  headSha: the PR head (40 lower-case hex, else NO)
 *  labels:  the PR's current label names
 *  record:  { pushAnchorMs, comments: [issue comment], labelEvents: [issue event] } read by main();
 *           null / { error } / a missing field = NO.
 * Needs BOTH: a comment by BOT_LOGIN carrying `review-pack: <https url> head <sha>` with sha ===
 * headSha, created after the push; and REVIEW_LABEL added by BOT_LOGIN after the push
 * (reviewLabelRefusal, the lane's own rule).
 */
export function reviewRecordVerdict({ headSha, labels, record }) {
  const tag = (r) => `class C review record: ${r}`;
  if (!record || typeof record !== "object") return [tag("not read (fail closed)")];
  if (record.error) return [tag(`read failed (${record.error})`)];
  const out = [];
  if (typeof headSha !== "string" || !FULL_SHA.test(headSha)) out.push(tag(`head sha unknown or not 40-hex (${headSha || "?"})`));
  const anchor = record.pushAnchorMs;
  if (!Number.isFinite(anchor)) out.push(tag("head push time unknown"));
  if (!Array.isArray(record.comments)) out.push(tag("PR comments not read"));
  if (out.length) return out;

  const packs = [];
  for (const c of record.comments) {
    if (!c || !c.user || c.user.login !== BOT_LOGIN || typeof c.body !== "string") continue;
    const m = PACK_LINE.exec(lastLine(c.body));
    if (m) packs.push({ url: m[1], sha: m[2], t: at(c.created_at) });
  }
  if (!packs.length) out.push(tag(`no review-pack comment by ${BOT_LOGIN}`));
  else {
    const forHead = packs.filter((k) => /^https:\/\/\S+$/.test(k.url) && FULL_SHA.test(k.sha) && k.sha === headSha);
    if (!forHead.length) out.push(tag(`review-pack is not for head ${headSha} (other, short or invalid sha, or a non-https url)`));
    else if (!forHead.some((k) => Number.isFinite(k.t) && k.t > anchor)) out.push(tag("review-pack for this head was posted before the latest push (or has no time)"));
  }
  const lowered = (labels || []).map((l) => String(l).toLowerCase());
  const labelNo = reviewLabelRefusal(lowered, record.labelEvents, anchor);
  if (labelNo) out.push(tag(labelNo));
  return out;
}

/** The body sections a bot stub pre-fills with the checkers' pending MARKER. */
export const PENDING_SECTIONS = [REAL_DATA_HEADING, PHONE_QA_HEADING];

/** The headings (of PENDING_SECTIONS) whose section still carries the pending
 *  marker on a visible line. HTML comments and fenced blocks are examples, not
 *  the PR's own section (as in the checkers); an empty or deleted section is not
 *  pending. Throws when there is no marker to look for (caller fails closed). */
export function pendingSections(body, marker = MARKER, headings = PENDING_SECTIONS) {
  if (typeof marker !== "string" || marker === "") throw new Error("no pending marker exported by the checkers");
  const norm = (h) => String(h).trim().replace(/[ \t]+#+$/, "").replace(/\s+/g, " ").toLowerCase();
  const want = new Map(headings.map((h) => [norm(h), h]));
  const lines = String(body || "").replace(/\r\n?/g, "\n").replace(/<!--[\s\S]*?-->/g, "").split("\n");
  const hit = new Set();
  let current = null;
  let fence = null;
  for (const l of lines) {
    const f = /^[ \t]{0,3}(`{3,}|~{3,})/.exec(l);
    if (fence) {
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length && l.trim() === f[1]) fence = null;
      continue;
    }
    // CommonMark: "```npm test``` passes" is an inline span, not a fence.
    if (f && !(f[1][0] === "`" && l.slice(l.indexOf(f[1]) + f[1].length).includes("`"))) { fence = f[1]; continue; }
    if (/^[ \t]{0,3}#{1,6}(?:[ \t]|$)/.test(l)) { current = want.get(norm(l)) || null; continue; }
    if (current && l.includes(marker)) hit.add(current);
  }
  return [...hit];
}

/**
 * Pure verdict.
 *  pr: { state, draft, user, headRef, headRepo, baseRepo, baseRef, labels[], additions,
 *        deletions, changedFiles, body }
 *  files: GitHub pull-file objects ({ filename, previous_filename, status, additions, deletions })
 *  labelActor: login that last applied LABEL_OK (null if unknown)
 *  realData: null (no parser on main) or (body) => { ok, problems[] }
 *  reviewRecord: class C's record read by main() (see reviewRecordVerdict); null = not read.
 *  moneySet: the parsed .github/automation/money-set.json from MAIN (null = unreadable = NO);
 *  moneyCheck: isMoney (slice 2, drill A16); tests inject through tests/autopilotTable.ts only.
 *  guardCheck: guardRefusals (slice 2, drill A18); same injection rule.
 */
export function classify({ pr, files, labelActor, realData = null, reviewRecord = null, moneySet = null, moneyCheck = isMoney, guardCheck = guardRefusals }) {
  const reasons = [];
  const no = (r) => reasons.push(r);
  if (!pr) return { qualifies: false, reasons: ["no PR object"], classes: [] };

  if (pr.state !== "open") no(`state is ${pr.state}, not open`);
  if (pr.draft !== false) no("draft (or draft state unknown)");
  if (pr.baseRef !== "main") no(`base is ${pr.baseRef}, not main`);
  if (!pr.headRepo || pr.headRepo !== pr.baseRepo) no("head is not a branch of this repository (fork or deleted)");

  const author = String(pr.user || "");
  if (author !== BOT_ONLY_AUTHOR) no(`author ${author || "?"} on ${pr.headRef || "?"} is not ${BOT_ONLY_AUTHOR} (bot-authored PRs only)`);

  const labels = (pr.labels || []).map(String);
  if (!labels.includes(LABEL_OK)) no(`label ${LABEL_OK} missing`);
  else if (!LABEL_ACTORS.includes(String(labelActor || ""))) no(`label ${LABEL_OK} applied by ${labelActor || "unknown"}, not a bot worker`);
  for (const b of BLOCK_LABELS) if (labels.includes(b)) no(`label ${b} present`);

  const list = Array.isArray(files) ? files : [];
  if (list.length === 0) no("no changed files listed");
  if (!Number.isInteger(pr.changedFiles) || pr.changedFiles !== list.length) {
    no(`file list incomplete (${list.length} listed, PR says ${pr.changedFiles})`);
  }
  const fileCount = Math.max(list.length, Number.isInteger(pr.changedFiles) ? pr.changedFiles : 0);
  if (fileCount > MAX_CHANGED_FILES) no(`${fileCount} changed files (cap is at most ${MAX_CHANGED_FILES})`);

  const fileLines = list.reduce((n, f) => n + (Number(f.additions) || 0) + (Number(f.deletions) || 0), 0);
  const prLines = (Number(pr.additions) || 0) + (Number(pr.deletions) || 0);
  if (!Number.isFinite(Number(pr.additions)) || !Number.isFinite(Number(pr.deletions))) no("line counts unknown");
  const lines = Math.max(fileLines, prLines);
  if (lines >= MAX_CHANGED_LINES) no(`${lines} changed lines (cap is under ${MAX_CHANGED_LINES})`);

  const classes = new Set();
  const STATUSES = new Set(["added", "modified", "removed", "renamed", "copied", "changed"]);
  for (const f of list) {
    const names = [f.filename];
    if (f.status === "renamed" || f.status === "copied" || f.previous_filename) names.push(f.previous_filename);
    if (!STATUSES.has(f.status)) no(`${f.filename}: unknown status ${f.status}`);
    for (const n of names) {
      const bad = pathProblem(n);
      if (bad) { no(`${n}: ${bad}`); continue; }
      const why = forbiddenWhy(n);
      if (why) { no(`${n}: ${why}`); continue; }
      const c = classOf(n);
      if (!c) { no(`${n}: not on the A/B/C allowlist`); continue; }
      classes.add(c);
      if (c === "C" && f.status === "removed") no(`${n}: deletes a test (owner decides)`);
      if (c === "C" && (f.status === "renamed" || f.status === "copied")) no(`${n}: renames or copies a test (owner decides)`);
    }
  }

  // The class judged: a PR with ANY class-C file is judged as C (its line cap, its review record).
  const judged = classes.has("C") ? "C" : classes.has("A/B") ? "A/B" : null;
  if (judged === "C") {
    if (lines >= MAX_CLASS_C_LINES) no(`${lines} changed lines (class C cap is under ${MAX_CLASS_C_LINES})`);
    for (const r of reviewRecordVerdict({ headSha: pr.headSha, labels, record: reviewRecord })) no(r);
  }

  // MONEY SET (slice 2, drill A16; docs/automation-foundations.md): paths AND the added/removed
  // lines of every file (patches from the files API). A docs/tests path class is overridden by a
  // content hit; an unreadable set or patch is a NO.
  const mv = moneyCheck({ files: list, set: moneySet });
  if (!mv || mv.money !== false) no((mv && mv.reason) || "money set: unreadable (no verdict)");
  // GUARD PATHS (slice 2, drill A18; scripts/lib/guard-paths.mjs): the ONE shared check, on every
  // name a file entry carries (a rename out of a guard path counts). Refusal: `guard-path refused: <path>`.
  const names = list.flatMap((f) => [f && f.filename, f && f.previous_filename].filter((n) => n !== undefined && n !== null));
  for (const r of guardCheck(names)) no(r);
  if (realData) {
    let v;
    try { v = realData(String(pr.body || "")); } catch (e) { v = { ok: false, problems: [`parser threw: ${e.message}`] }; }
    if (!v || v.ok !== true) no(`'## Verified on real data' section fails: ${((v && v.problems) || ["no verdict"]).join("; ")}`);
  }

  // A stub never merges unfilled, parser or not: a docs-only PR needs no Phone QA
  // section, so its checker passes a TO FILL one; deleting the section is fine.
  let pending = [];
  try { pending = pendingSections(pr.body); } catch (e) { no(`pending-marker check failed: ${e.message}`); }
  for (const h of pending) no(`'${h}' section still carries ${MARKER} (the description has not been filled in)`);

  const qualifies = reasons.length === 0 && list.length > 0 && judged !== null;
  if (reasons.length === 0 && !qualifies) reasons.push("nothing judged (fail closed)");
  return { qualifies, reasons, classes: judged ? [judged] : [] };
}

/* -- base-checkout helpers (trusted: this runs on the BASE branch tree) ------- */

/** The real-data parser from PR #658, if it has landed on the base branch.
 *  Present but without a parse() export = infra (throw), never "not required". */
export async function loadRealDataParser(root = REPO_ROOT) {
  const file = path.join(root, REAL_DATA_PARSER);
  if (!fs.existsSync(file)) return null;
  const mod = await import(pathToFileURL(file).href);
  if (typeof mod.parse !== "function") throw new Error(`${REAL_DATA_PARSER} exists but exports no parse()`);
  return mod.parse;
}

/** The money set from the BASE checkout; unreadable = null, which classify() refuses (fail closed). */
export function loadMoneySet(root = REPO_ROOT) {
  try {
    return parseMoneySet(fs.readFileSync(path.join(root, MONEY_SET_PATH), "utf8"));
  } catch (e) {
    console.log(`money set unreadable (${e.message}) - nothing qualifies`);
    return null;
  }
}
/* -- REST (GraphQL is never needed to classify) -------------------------------- */

async function gh(p) {
  const res = await fetch(`https://api.github.com${p}`, {
    headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`GET ${p} -> ${res.status}`);
  return res.json();
}

async function pages(p, max) {
  const out = [];
  for (let page = 1; page <= max; page++) {
    const batch = await gh(`${p}${p.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
    if (!Array.isArray(batch)) throw new Error(`GET ${p} returned no list`);
    out.push(...batch);
    if (batch.length < 100) return out;
  }
  throw new Error(`GET ${p}: more than ${max} pages`);
}

export function prFromApi(p) {
  return {
    state: p.state, draft: p.draft, user: p.user && p.user.login,
    headRef: p.head && p.head.ref, headRepo: p.head && p.head.repo && p.head.repo.full_name,
    baseRepo: p.base && p.base.repo && p.base.repo.full_name, baseRef: p.base && p.base.ref,
    labels: (p.labels || []).map((l) => l.name), additions: p.additions, deletions: p.deletions,
    changedFiles: p.changed_files, body: p.body, headSha: p.head && p.head.sha,
  };
}

/** When the head was pushed, in ms: the LATER of the head commit's committer date and the first
 *  workflow run GitHub created for that sha (server time; a pusher cannot backdate it). Any
 *  missing field = null, which reviewRecordVerdict refuses. */
export function pushAnchorFrom(commit, runs) {
  const committed = at(commit && commit.commit && commit.commit.committer && commit.commit.committer.date);
  const list = runs && Array.isArray(runs.workflow_runs) ? runs.workflow_runs : null;
  if (!list || !list.length || !Number.isFinite(committed)) return null;
  const first = Math.min(...list.map((r) => at(r && r.created_at)));
  return Number.isFinite(first) ? Math.max(committed, first) : null;
}

/** Class C's review record, read with the REST API. Any failure = { error }, never a throw:
 *  classes A/B need no record, so an unreadable one must not stop them classifying. */
export async function readReviewRecord(repo, num, headSha, events, get = gh, list = pages) {
  try {
    if (typeof headSha !== "string" || !FULL_SHA.test(headSha)) throw new Error(`head sha ${headSha || "?"} is not 40-hex`);
    const [commit, runs, comments] = await Promise.all([
      get(`/repos/${repo}/commits/${headSha}`),
      get(`/repos/${repo}/actions/runs?head_sha=${headSha}&per_page=100`),
      list(`/repos/${repo}/issues/${num}/comments`, 20),
    ]);
    return { pushAnchorMs: pushAnchorFrom(commit, runs), comments, labelEvents: Array.isArray(events) ? events : null };
  } catch (e) {
    return { error: e.message };
  }
}

/** Login of whoever most recently applied LABEL_OK (null if never). */
export function lastLabelActor(events) {
  let who = null;
  for (const e of events || []) {
    if (e && e.event === "labeled" && e.label && e.label.name === LABEL_OK) who = e.actor && e.actor.login;
  }
  return who;
}

export async function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  const num = process.env.PR_NUMBER;
  if (!repo || !num || !process.env.GH_TOKEN || !/^\d+$/.test(num)) {
    console.log("INFRA: need GH_TOKEN, GITHUB_REPOSITORY and a numeric PR_NUMBER");
    return 2;
  }
  const raw = await gh(`/repos/${repo}/pulls/${num}`);
  const pr = prFromApi(raw);
  const files = await pages(`/repos/${repo}/pulls/${num}/files`, 30);
  const events = await pages(`/repos/${repo}/issues/${num}/events`, 20);
  const realData = await loadRealDataParser();
  const moneySet = loadMoneySet();
  // Classes A/B need no record: read it only when some file is a class-C path (any name it carries).
  const needsRecord = files.some((f) => f && [f.filename, f.previous_filename].some((n) => typeof n === "string" && classOf(n) === "C"));
  const reviewRecord = needsRecord ? await readReviewRecord(repo, num, pr.headSha, events) : { error: "not read (no class-C file)" };
  const v = classify({ pr, files, labelActor: lastLabelActor(events), realData, reviewRecord, moneySet });

  console.log(`PR #${num} by ${pr.user} (${pr.headRef} @ ${String(pr.headSha).slice(0, 8)}): ${v.qualifies ? "QUALIFIES" : "does not qualify"}`);
  console.log(`  class judged: ${v.classes.join(", ") || "-"}; real-data parser on main: ${realData ? "yes" : "no"}; review record: ${reviewRecord.error ? `unreadable (${reviewRecord.error})` : "read"}`);
  for (const r of v.reasons) console.log(`  - ${r}`);
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `qualifies=${v.qualifies}\nhead_sha=${pr.headSha}\n`);
  }
  return 0;
}

/** Canary: the rules can say YES, and each guard can say NO. */
export function selfTest() {
  const pr = { state: "open", draft: false, user: BOT_LOGIN, headRef: "docs/x", headRepo: "o/r", baseRepo: "o/r", baseRef: "main", labels: [LABEL_OK], additions: 3, deletions: 1, changedFiles: 1, body: "" };
  const f = (filename, extra = {}) => ({ filename, status: "modified", additions: 3, deletions: 1, changes: 4, patch: "@@ -1,2 +1,4 @@\n+a\n+b\n+c\n-d", ...extra });
  const moneySet = { version: 1, paths: ["src/pay/**"], tables: ["ticket_orders"], functions: [], keys: [], flags: [], env: [] };
  const head = "0123456789abcdef".repeat(3).slice(0, 40);
  const comment = { user: { login: BOT_LOGIN }, created_at: "2026-01-01T00:02:00Z", body: `review-pack: https://x.example/p head ${head}` };
  const rec = {
    pr: { ...pr, headSha: head, labels: [LABEL_OK, REVIEW_LABEL] }, comment,
    record: { pushAnchorMs: Date.parse("2026-01-01T00:00:00Z"), comments: [comment], labelEvents: [{ event: "labeled", label: { name: REVIEW_LABEL }, actor: { login: BOT_LOGIN }, created_at: "2026-01-01T00:03:00Z" }] },
  };
  const cases = [
    ["docs-only qualifies", classify({ pr, files: [f("docs/a.md")], labelActor: BOT_LOGIN, moneySet }).qualifies, true],
    ["a money-set name in a docs line does not", classify({ pr, files: [f("docs/a.md", { patch: "@@ -1,2 +1,4 @@\n+ticket_orders\n+b\n+c\n-d" })], labelActor: BOT_LOGIN, moneySet }).qualifies, false],
    ["no money set does not", classify({ pr, files: [f("docs/a.md")], labelActor: BOT_LOGIN }).qualifies, false],
    ["src does not", classify({ pr, files: [f("src/a.ts")], labelActor: BOT_LOGIN }).qualifies, false],
    ["docs/x.mjs does not", classify({ pr, files: [f("docs/x.mjs")], labelActor: BOT_LOGIN, moneySet }).qualifies, false],
    ["a test with a valid record qualifies", classify({ pr: rec.pr, files: [f("tests/a.test.ts")], labelActor: BOT_LOGIN, moneySet, reviewRecord: rec.record }).qualifies, true],
    ["a test whose record is for another head does not", classify({ pr: rec.pr, files: [f("tests/a.test.ts")], labelActor: BOT_LOGIN, moneySet, reviewRecord: { ...rec.record, comments: [{ ...rec.comment, body: `review-pack: https://x.example/p head ${"f".repeat(40)}` }] } }).qualifies, false],
    ["traversal does not", classify({ pr, files: [f("docs/../src/x.ts")], labelActor: BOT_LOGIN }).qualifies, false],
    ["empty does not", classify({ pr: { ...pr, changedFiles: 0 }, files: [], labelActor: BOT_LOGIN }).qualifies, false],
    ["pending Phone QA stub does not", classify({ pr: { ...pr, body: `${PHONE_QA_HEADING}\n- Walked: ${MARKER}` }, files: [f("docs/a.md")], labelActor: BOT_LOGIN }).qualifies, false],
  ];
  let bad = 0;
  for (const [name, got, want] of cases) {
    const ok = got === want;
    if (!ok) bad++;
    console.log(`${ok ? "ok  " : "FAIL"} ${name}`);
  }
  return bad ? 1 : 0;
}

/* No CLI dispatch on purpose: a scripts/*.mjs that dispatches through isEntryPoint
 * must be enrolled in prove-entry-point-dispatch.mjs, and the workflow is the only
 * caller. Run it the way the workflow does: */
export const RUN = `node -e 'import("./scripts/automerge-classify.mjs").then((m) => m.main()).then((c) => { process.exitCode = c; }, (e) => { console.log("INFRA: " + e.message); process.exitCode = 2; })'`;
