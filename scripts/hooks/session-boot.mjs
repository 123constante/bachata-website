/**
 * session-boot.mjs -- SessionStart hook (startup|resume|clear|compact). Injects the
 * orientation facts every Website session needs -- this repo auto-deploys prod from
 * main and has zero other local-machinery boot injection, so a session that opens
 * without this has no branch/dirt/PR/staleness picture at all:
 *   - current branch + `git status --porcelain -b`
 *   - last 3 commit subjects
 *   - open PRs (gh pr list, 8s timeout, degrades to a "gh unavailable" line)
 *   - stale-origin warning when .git/FETCH_HEAD is > 24h old (protects
 *     resolveBaseRef-style diffing against origin/main from running on stale refs)
 *   - review-stamp age line (.claude/.review-stamp.json -- the pre-push gate's receipt)
 *
 * Output is capped (~6k chars) and emitted as SessionStart additionalContext. The hook
 * NEVER throws -- a broken boot hook must not disrupt the session; on any failure it
 * emits whatever it gathered.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { STAMP_PATH, loadStamp, stampAgeMs, stampIsFresh } from "../lib/review-scope.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const CHAR_CAP = 6000;
const STALE_FETCH_MS = 24 * 60 * 60 * 1000;

function git(args) {
  try {
    return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

// `git rev-parse --git-path` resolves through worktrees/submodules, where
// .git is a pointer FILE rather than the repo directory -- a hardcoded
// `<root>/.git/FETCH_HEAD` throws in that shape and prints a false "origin
// unreadable" warning even seconds after a fresh fetch.
function fetchHeadPath() {
  const rel = git(["rev-parse", "--git-path", "FETCH_HEAD"]);
  return rel ? path.resolve(REPO_ROOT, rel) : path.join(REPO_ROOT, ".git", "FETCH_HEAD");
}

function openPRsLine() {
  try {
    const out = execFileSync(
      "gh",
      ["pr", "list", "--state", "open", "--limit", "10", "--json", "number,title,headRefName,isDraft"],
      { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 8000 }
    );
    const prs = JSON.parse(out);
    if (!prs.length) return "-- Open PRs --\n(none)";
    const lines = prs.map(
      (p) => `#${p.number}${p.isDraft ? " (draft)" : ""} ${p.title} [${p.headRefName}]`
    );
    return "-- Open PRs --\n" + lines.join("\n");
  } catch {
    return "-- Open PRs --\ngh unavailable (not installed, not authed, or timed out) -- run `gh pr list` manually";
  }
}

function staleOriginWarning() {
  try {
    const ageMs = Date.now() - fs.statSync(fetchHeadPath()).mtimeMs;
    if (ageMs > STALE_FETCH_MS) {
      const ageDays = (ageMs / 86400000).toFixed(1);
      return `WARNING: origin is ${ageDays} days stale (.git/FETCH_HEAD) -- run \`git fetch\` before diffing against origin/main.`;
    }
    return "";
  } catch {
    return "WARNING: .git/FETCH_HEAD unreadable -- origin freshness unknown; run `git fetch` before diffing against origin/main.";
  }
}

function stampAgeLine() {
  const { status, stamp } = loadStamp();
  if (status === "missing") return "-- Review stamp --\nno review stamp yet (" + STAMP_PATH + ") -- pre-push gate will require one before shipping.";
  if (status !== "ok") return "-- Review stamp --\nstamp file is " + status + " -- treat as missing; re-review before shipping.";
  const ageMs = stampAgeMs(stamp);
  if (!Number.isFinite(ageMs)) return "-- Review stamp --\nstamp has no valid timestamp -- treat as missing; re-review before shipping.";
  const ageH = (ageMs / 3600000).toFixed(1);
  const fresh = stampIsFresh(stamp);
  return "-- Review stamp --\n" + ageH + "h old, " + (fresh ? "fresh" : "STALE (> 24h) -- re-review before shipping") + ".";
}

function build() {
  const parts = [];
  // `git status --porcelain -b`'s own first line ("## <branch>...<tracking>")
  // already carries the branch name -- reuse it instead of a second spawn.
  const status = git(["status", "--porcelain", "-b"]);
  const branchLine = status.split("\n", 1)[0] || "";
  const branch = branchLine.replace(/^##\s*/, "").split(/\.\.\.| /, 1)[0] || "(unknown)";
  parts.push(`SESSION BOOT -- branch: ${branch}`);
  parts.push("-- git status --\n" + (status || "(clean)"));

  const commits = git(["log", "-3", "--format=%h %s"]);
  if (commits) parts.push("-- Last 3 commits --\n" + commits);

  parts.push(openPRsLine());

  const stale = staleOriginWarning();
  if (stale) parts.push(stale);

  parts.push(stampAgeLine());

  let out = parts.join("\n\n");
  if (out.length > CHAR_CAP) out = out.slice(0, CHAR_CAP) + "\n... (truncated at boot cap)";
  return out;
}

let context = "";
try {
  context = build();
} catch (err) {
  context = `SESSION BOOT: partial (${err.message || err}).`;
}
process.stdout.write(
  JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context } })
);
process.exitCode = 0;
