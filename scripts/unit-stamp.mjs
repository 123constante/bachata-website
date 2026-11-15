// CLI for the pre-ship -> pre-push unit stamp. See scripts/lib/unit-stamp.mjs.
//   node scripts/unit-stamp.mjs check   -- prints "skip <tree7> <minutes>" or "run"; always exit 0
// The CLI only CHECKS. Writing is the `writeStamp` export, imported by pre-ship after a
// green test:unit: a hand-run `write` would vouch for a suite that never ran.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { isEntryPoint } from "./lib/entry-point.mjs";
import { canWriteStamp, decideUnitStamp, formatStamp } from "./lib/unit-stamp.mjs";

const git = (...a) => execFileSync("git", a, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const stampPath = () => git("rev-parse", "--git-path", "preship-unit-stamp");

/** Tree + clean-status as of now; pre-ship takes it BEFORE the suite runs. */
export function snapshotTree() {
  return { tree: git("rev-parse", "HEAD^{tree}"), clean: !git("status", "--porcelain") };
}

/** Write only if the tree is clean and unchanged since `before` (taken before the suite ran). */
export function writeStamp(before) {
  const now = snapshotTree();
  if (!canWriteStamp(before || now, now)) return false;
  fs.writeFileSync(stampPath(), formatStamp(now.tree, Date.now()));
  return true;
}

export function checkStamp() {
  try {
    const tree = git("rev-parse", "HEAD^{tree}");
    const d = decideUnitStamp(fs.readFileSync(stampPath(), "utf8"), tree, Date.now());
    return d.skip ? `skip ${tree.slice(0, 7)} ${d.minutes}` : "run";
  } catch {
    return "run";
  }
}

if (isEntryPoint(import.meta.url)) {
  // Any argument other than `check` (including the retired `write`) only prints a verdict.
  try {
    console.log(checkStamp());
  } catch {
    console.log("run");
  }
}
