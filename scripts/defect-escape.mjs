/**
 * defect-escape.mjs -- weekly defect-escape count for the digest.
 *
 * WHAT IT MEASURES. Does faster merging let more bugs reach production? One number a
 * week: of the first-parent commits on main in the trailing 7 days, how many are a
 * FIX that landed within 7 days AFTER a non-fix commit in the same area.
 *
 * FROZEN RECIPE (do not "improve" -- week-to-week comparability depends on it):
 *   log     git log --first-parent (squash merges), commits with %ct and touched files
 *   window  commits with committer time in (now - 7d, now]            -> `merged`
 *   fix     subject matches /^(fix|revert|hotfix)/i (so `fix(scope):` counts)
 *   area    per touched file: src/ scripts/ .github/ supabase/, anything else = other
 *   escaped a window FIX commit F such that some NON-fix commit P, older than F by
 *           at most 7 days, touches at least one area F touches
 *   rate    escaped / merged (0 when merged is 0)
 * Git-only, no network. Needs history >= 14 days (digest checkout is fetch-depth 150).
 *
 * Usage:
 *   node scripts/defect-escape.mjs --markdown
 *   node scripts/defect-escape.mjs --self-test
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isEntryPoint } from "./lib/entry-point.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DAY = 86400;
const WINDOW = 7 * DAY;
const MAX_LISTED = 10;
const FIX_RE = /^(fix|revert|hotfix)/i;
const AREAS = ["src", "scripts", ".github", "supabase"];

export function areaOf(file) {
  const top = file.split("/")[0];
  return file.includes("/") && AREAS.includes(top) ? top : "other";
}

/** commits: [{subject, ts (unix s), files: string[]}] -> metric. Pure. */
export function compute(commits, now) {
  const inWindow = commits.filter((c) => c.ts > now - WINDOW && c.ts <= now);
  const areas = (c) => new Set((c.files.length ? c.files : [""]).map(areaOf));
  const priors = commits.filter((c) => !FIX_RE.test(c.subject));
  const escapes = inWindow.filter((f) => {
    if (!FIX_RE.test(f.subject)) return false;
    const fa = areas(f);
    return priors.some(
      (p) => p.ts <= f.ts && f.ts - p.ts <= WINDOW && p !== f && [...areas(p)].some((a) => fa.has(a))
    );
  });
  const merged = inWindow.length;
  return {
    escaped: escapes.length,
    merged,
    rate: merged ? escapes.length / merged : 0,
    subjects: escapes.map((c) => c.subject),
  };
}

/** Parse `git log --name-only --format=%x1e%ct%x09%s` output. */
export function parseLog(raw) {
  return raw
    .split("\x1e")
    .filter((b) => b.trim())
    .map((b) => {
      const [head, ...rest] = b.split("\n");
      const tab = head.indexOf("\t");
      return {
        ts: Number.parseInt(head.slice(0, tab), 10),
        subject: head.slice(tab + 1),
        files: rest.map((l) => l.trim()).filter(Boolean),
      };
    })
    .filter((c) => Number.isFinite(c.ts));
}

function readLog() {
  const raw = execFileSync(
    "git",
    ["log", "--first-parent", "--name-only", "--format=%x1e%ct%x09%s", "-n", "400"],
    { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 << 20 }
  );
  return parseLog(raw);
}

export function render(m) {
  const lines = ["## Defect escape (trailing 7 days)", ""];
  lines.push(
    "Fix / revert / hotfix commits on main that landed within 7 days after a non-fix commit " +
      "in the same area (`src/`, `scripts/`, `.github/`, `supabase/`, other)."
  );
  lines.push("");
  lines.push(`- escaped: **${m.escaped}**`);
  lines.push(`- merged: **${m.merged}**`);
  lines.push(`- escape rate: **${Math.round(m.rate * 100)}%**`);
  if (m.subjects.length) {
    lines.push("", "Escaping commits:");
    for (const s of m.subjects.slice(0, MAX_LISTED)) lines.push(`- ${s.replace(/\|/g, "\\|")}`);
    if (m.subjects.length > MAX_LISTED) lines.push(`- &hellip; and ${m.subjects.length - MAX_LISTED} more`);
  }
  return lines.join("\n");
}

function selfTest() {
  const now = 1_000_000_000;
  const c = (subject, ageDays, ...files) => ({ subject, ts: now - ageDays * DAY, files });
  const m = compute(
    [
      c("fix(ui): a", 1, "src/a.tsx"),
      c("feat: b", 3, "src/b.tsx"),
      c("feat: other area", 20, "scripts/x.mjs"),
    ],
    now
  );
  if (m.escaped !== 1 || m.merged !== 2) {
    console.error(`defect-escape --self-test: FAIL ${JSON.stringify(m)}`);
    return 1;
  }
  console.log("defect-escape --self-test: OK");
  return 0;
}

if (isEntryPoint(import.meta.url)) {
  const argv = process.argv.slice(2);
  const unknown = argv.filter((a) => a !== "--markdown" && a !== "--self-test");
  if (unknown.length) {
    console.error(`defect-escape: unknown argument(s): ${unknown.join(", ")}`);
    process.exitCode = 2;
  } else if (argv.includes("--self-test")) {
    process.exitCode = selfTest();
  } else {
    try {
      console.log(render(compute(readLog(), Math.floor(Date.now() / 1000))));
    } catch (err) {
      console.log("## Defect escape (trailing 7 days)\n\nunavailable &mdash; " + (err.message || String(err)));
    }
  }
}
