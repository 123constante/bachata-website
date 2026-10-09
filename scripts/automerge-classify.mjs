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
 * only code that runs is this file and, when present, the real-data parser, both
 * from the BASE branch checkout.
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

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const LABEL_OK = "automerge-ok";
export const BLOCK_LABELS = ["needs-owner", "do-not-merge", "wip"];
export const MAX_CHANGED_LINES = 400; // strictly fewer than this
export const BOT_LOGIN = "kiki-claude-bot";
export const OWNER_LOGIN = "123constante";
// The owner's account is ALSO the shared token the cloud workers push with (see
// bot-pr.yml). An owner-authored PR therefore qualifies only from a worker branch
// prefix; see docs/automerge.md "Identity" for why this is a decision, not a fact.
export const WORKER_BRANCH = /^(claude\/|ccr-)/;
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

const TEST_FILE = /\.(test|spec)\.(c|m)?[jt]sx?$/;

/** A path the API handed us, rejected unless it is a plain relative POSIX path.
 *  `docs/../src/x` is the trap: a prefix test alone would call it docs. */
export function pathProblem(p) {
  if (typeof p !== "string" || p.length === 0) return "empty path";
  if (/[\\\0]/.test(p) || p.startsWith("/")) return "non-POSIX or absolute path";
  if (p.split("/").some((seg) => seg === "" || seg === "." || seg === "..")) return "path with ./.. or empty segment";
  return null;
}

/** "docs" | "tests" | null (null = not on the allowlist). Forbidden wins. */
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

/** A tests/ file that is not itself a test or spec is a HELPER, and a helper is
 *  only safe while no shipped code imports it. */
export function isHelper(p) {
  return pathClass(p) === "tests" && !TEST_FILE.test(p);
}

/**
 * Pure verdict.
 *  pr: { state, draft, user, headRef, headRepo, baseRepo, baseRef, labels[], additions,
 *        deletions, changedFiles, body }
 *  files: GitHub pull-file objects ({ filename, previous_filename, status, additions, deletions })
 *  labelActor: login that last applied LABEL_OK (null if unknown)
 *  realData: null (no parser on main) or (body) => { ok, problems[] }
 *  importedByShipped: (path) => boolean; DEFAULT says yes, so a helper with no scan fails.
 */
export function classify({ pr, files, labelActor, realData = null, importedByShipped = () => true }) {
  const reasons = [];
  const no = (r) => reasons.push(r);
  if (!pr) return { qualifies: false, reasons: ["no PR object"], classes: [] };

  if (pr.state !== "open") no(`state is ${pr.state}, not open`);
  if (pr.draft !== false) no("draft (or draft state unknown)");
  if (pr.baseRef !== "main") no(`base is ${pr.baseRef}, not main`);
  if (!pr.headRepo || pr.headRepo !== pr.baseRepo) no("head is not a branch of this repository (fork or deleted)");

  const author = String(pr.user || "");
  if (author === BOT_LOGIN) {
    // bot-authored: any branch
  } else if (author === OWNER_LOGIN && WORKER_BRANCH.test(String(pr.headRef || ""))) {
    // shared-token worker PR
  } else {
    no(`author ${author || "?"} on ${pr.headRef || "?"} is not a bot worker`);
  }

  const labels = (pr.labels || []).map(String);
  if (!labels.includes(LABEL_OK)) no(`label ${LABEL_OK} missing`);
  else if (!LABEL_ACTORS.includes(String(labelActor || ""))) no(`label ${LABEL_OK} applied by ${labelActor || "unknown"}, not a bot worker`);
  for (const b of BLOCK_LABELS) if (labels.includes(b)) no(`label ${b} present`);

  const list = Array.isArray(files) ? files : [];
  if (list.length === 0) no("no changed files listed");
  if (!Number.isInteger(pr.changedFiles) || pr.changedFiles !== list.length) {
    no(`file list incomplete (${list.length} listed, PR says ${pr.changedFiles})`);
  }

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
      const c = pathClass(n);
      if (!c) { no(`${n}: not on the docs/tests allowlist`); continue; }
      classes.add(c);
      if (c === "tests" && f.status === "removed") no(`${n}: deletes a test (owner decides)`);
      if (isHelper(n) && importedByShipped(n)) no(`${n}: test helper that shipped code imports (or the scan could not prove it does not)`);
    }
  }

  if (realData) {
    let v;
    try { v = realData(String(pr.body || "")); } catch (e) { v = { ok: false, problems: [`parser threw: ${e.message}`] }; }
    if (!v || v.ok !== true) no(`'## Verified on real data' section fails: ${((v && v.problems) || ["no verdict"]).join("; ")}`);
  }

  const qualifies = reasons.length === 0 && list.length > 0 && classes.size > 0;
  if (reasons.length === 0 && !qualifies) reasons.push("nothing judged (fail closed)");
  return { qualifies, reasons, classes: [...classes].sort() };
}

/* -- base-checkout helpers (trusted: this runs on the BASE branch tree) ------- */

/** Does any file under src/, app/ or api/ of the base tree mention this helper's
 *  path (without extension)? A crude textual scan, deliberately over-matching:
 *  an over-match only blocks an auto-merge. An unreadable tree answers TRUE. */
export function makeImportScan(root = REPO_ROOT) {
  let corpus = null;
  try {
    const chunks = [];
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== "node_modules") walk(full); }
        else if (/\.(c|m)?[jt]sx?$/.test(e.name) && !TEST_FILE.test(e.name) && !full.includes(`${path.sep}__tests__${path.sep}`)) {
          chunks.push(fs.readFileSync(full, "utf8"));
        }
      }
    };
    let seen = 0;
    for (const top of ["src", "app", "api"]) {
      const d = path.join(root, top);
      if (fs.existsSync(d)) { walk(d); seen++; }
    }
    if (seen === 0) throw new Error("no shipped tree found");
    corpus = chunks.join("\n");
  } catch (e) {
    console.log(`import scan unavailable (${e.message}) - helpers will not qualify`);
    return () => true;
  }
  return (p) => {
    const stem = p.replace(/\.(c|m)?[jt]sx?$/, "");
    const base = path.posix.basename(stem);
    return corpus.includes(stem) || new RegExp(`['"/]${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}['"]`).test(corpus);
  };
}

/** The real-data parser from PR #658, if it has landed on the base branch.
 *  Present but without a parse() export = infra (throw), never "not required". */
export async function loadRealDataParser(root = REPO_ROOT) {
  const file = path.join(root, REAL_DATA_PARSER);
  if (!fs.existsSync(file)) return null;
  const mod = await import(pathToFileURL(file).href);
  if (typeof mod.parse !== "function") throw new Error(`${REAL_DATA_PARSER} exists but exports no parse()`);
  return mod.parse;
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
  const v = classify({ pr, files, labelActor: lastLabelActor(events), realData, importedByShipped: makeImportScan() });

  console.log(`PR #${num} by ${pr.user} (${pr.headRef} @ ${String(pr.headSha).slice(0, 8)}): ${v.qualifies ? "QUALIFIES" : "does not qualify"}`);
  console.log(`  classes: ${v.classes.join(", ") || "-"}; real-data parser on main: ${realData ? "yes" : "no"}`);
  for (const r of v.reasons) console.log(`  - ${r}`);
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `qualifies=${v.qualifies}\nhead_sha=${pr.headSha}\n`);
  }
  return 0;
}

/** Canary: the rules can say YES, and each guard can say NO. */
export function selfTest() {
  const pr = { state: "open", draft: false, user: BOT_LOGIN, headRef: "docs/x", headRepo: "o/r", baseRepo: "o/r", baseRef: "main", labels: [LABEL_OK], additions: 3, deletions: 1, changedFiles: 1, body: "" };
  const f = (filename, extra = {}) => ({ filename, status: "modified", additions: 3, deletions: 1, ...extra });
  const cases = [
    ["docs-only qualifies", classify({ pr, files: [f("docs/a.md")], labelActor: BOT_LOGIN }).qualifies, true],
    ["src does not", classify({ pr, files: [f("src/a.ts")], labelActor: BOT_LOGIN }).qualifies, false],
    ["traversal does not", classify({ pr, files: [f("docs/../src/x.ts")], labelActor: BOT_LOGIN }).qualifies, false],
    ["empty does not", classify({ pr: { ...pr, changedFiles: 0 }, files: [], labelActor: BOT_LOGIN }).qualifies, false],
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
