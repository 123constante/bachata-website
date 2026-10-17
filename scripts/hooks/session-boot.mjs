/**
 * session-boot.mjs -- SessionStart hook (startup|resume|clear|compact). Prints a
 * deliberately SMALL orientation block (owner trim, 2026-10-15):
 *   - branch + `git status -sb` (capped at 10 lines)
 *   - last 3 commit subjects
 *   - ONE line pointing at the newest ~/.claude/plans/HANDOVER-*.md, if any
 *
 * The open-PR list, stale-origin warning and review-stamp age used to print here;
 * they were dropped from the boot output (the stamp itself is still enforced by the
 * pre-push gate; run `gh pr list` / `git fetch` on demand).
 *
 * Emitted as SessionStart additionalContext. The hook NEVER throws -- a broken boot
 * hook must not disrupt the session; on any failure it emits whatever it gathered.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const STATUS_MAX_LINES = 10;

function git(args) {
  try {
    return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function newestHandoverLine() {
  try {
    const dir = path.join(os.homedir(), ".claude", "plans");
    const files = fs
      .readdirSync(dir)
      .filter((f) => /^HANDOVER-.*\.md$/.test(f))
      .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    return files.length ? "Newest handover: " + path.join(dir, files[0].f) : "";
  } catch {
    return "";
  }
}

function build() {
  const parts = [];
  const status = (git(["status", "-sb"]) || "(clean)").split("\n");
  const shown = status.slice(0, STATUS_MAX_LINES);
  if (status.length > STATUS_MAX_LINES) shown.push("... (" + (status.length - STATUS_MAX_LINES) + " more)");
  parts.push("SESSION BOOT\n" + shown.join("\n"));

  const commits = git(["log", "-3", "--format=%h %s"]);
  if (commits) parts.push("-- Last 3 commits --\n" + commits);

  const handover = newestHandoverLine();
  if (handover) parts.push(handover);

  return parts.join("\n\n");
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
