// CLI for the pre-ship -> pre-push unit stamp. See scripts/lib/unit-stamp.mjs.
//   node scripts/unit-stamp.mjs write   -- after a green test:unit; refuses on a dirty tree
//   node scripts/unit-stamp.mjs check   -- prints "skip <tree7> <minutes>" or "run"; always exit 0
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { isEntryPoint } from "./lib/entry-point.mjs";
import { decideUnitStamp, formatStamp } from "./lib/unit-stamp.mjs";

const git = (...a) => execFileSync("git", a, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const stampPath = () => git("rev-parse", "--git-path", "preship-unit-stamp");

export function writeStamp() {
  // A dirty tree means HEAD^{tree} is not what the suite ran on: no stamp.
  if (git("status", "--porcelain")) return false;
  fs.writeFileSync(stampPath(), formatStamp(git("rev-parse", "HEAD^{tree}"), Date.now()));
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
  try {
    if (process.argv[2] === "write") writeStamp();
    else console.log(checkStamp());
  } catch {
    if (process.argv[2] !== "write") console.log("run");
  }
}
