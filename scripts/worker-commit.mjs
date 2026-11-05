#!/usr/bin/env node
/**
 * worker-commit.mjs -- the ONE commit path for workers and reviewers.
 *
 * Owner decision 2026-11-05: identity, message form and the done marker are
 * never hand-typed. Permission prompts on multi-line `-m` and on
 * `-c user.name` flags stranded a review worker on 2026-11-05; this helper
 * builds the message in a temp file and runs `git commit -F <file>`.
 *
 *   node scripts/worker-commit.mjs --subject "<one line>" \
 *     [--body-file <path>] [--trailer-file <path>] [--marker dt_xxxxxxxxxxxx] \
 *     [--files a,b | --all]
 *
 * Refuses (exit 1) when:
 *   - the branch is not claude/*, brief/* or review/* (detached HEAD included);
 *   - --subject is missing, blank, multi-line, or already carries a done marker;
 *   - --marker does not match ^dt_[0-9a-f]{12}$;
 *   - --files and --all are both given, or --files names nothing;
 *   - no --files, no --all and the tree has unstaged/untracked changes (listed);
 *   - after staging, something outside --files is staged, or nothing is staged;
 *   - --body-file / --trailer-file cannot be read; an unknown flag is passed.
 *
 * It NEVER pushes, never passes -m, --no-verify or -c (identity comes from the
 * environment already configured). The only git argv that commits is
 * buildCommitArgv(): ["commit", "-F", <tempfile>].
 *
 * Exit codes: 0 committed (prints the new head sha), 1 refused, 2 git failure.
 * `--self-test` drives main() against a fake git and exits 0 only if every
 * refusal and exit code holds. Tests: tests/workerCommit.test.ts.
 * Doc: docs/automation-foundations.md ("Worker commits").
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { isEntryPoint } from "./lib/entry-point.mjs";

export const BRANCH_RE = /^(claude|brief|review)\/.+$/;
export const MARKER_RE = /^dt_[0-9a-f]{12}$/;
const VALUE_FLAGS = new Set(["--subject", "--body-file", "--trailer-file", "--marker", "--files"]);
const BOOL_FLAGS = new Set(["--all", "--help", "--self-test"]);

class Refusal extends Error {}

export function parseArgs(argv) {
  const o = { help: false, all: false, selfTest: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (BOOL_FLAGS.has(a)) {
      if (a === "--all") o.all = true;
      else if (a === "--help") o.help = true;
      else o.selfTest = true;
    } else if (VALUE_FLAGS.has(a)) {
      if (i + 1 >= argv.length || argv[i + 1].startsWith("--")) throw new Refusal(`${a} needs a value`);
      const key = a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      o[key] = argv[++i];
    } else {
      throw new Refusal(`unknown argument: ${a}`);
    }
  }
  return o;
}

export function buildMessage({ subject, marker, body, trailers }) {
  let msg = subject.trim();
  if (marker) msg += ` [worker-done ${marker}]`;
  for (const part of [body, trailers]) {
    const t = (part ?? "").trim();
    if (t) msg += `\n\n${t}`;
  }
  return `${msg}\n`;
}

export function buildCommitArgv(msgPath) {
  return ["commit", "-F", msgPath];
}

function validate(o) {
  if (o.subject === undefined || o.subject.trim() === "") throw new Refusal("--subject is required and must not be blank");
  if (/[\r\n]/.test(o.subject)) throw new Refusal("--subject must be one line (no CR/LF); put detail in --body-file");
  if (/\[worker-done\b/.test(o.subject)) throw new Refusal("--subject already carries a [worker-done] marker; pass --marker instead");
  if (o.marker !== undefined && !MARKER_RE.test(o.marker)) throw new Refusal(`--marker must match ${MARKER_RE} (got ${JSON.stringify(o.marker)})`);
  if (o.files !== undefined && o.all) throw new Refusal("--files and --all are exclusive");
  if (o.files !== undefined) {
    const list = o.files.split(",").map((s) => s.trim()).filter(Boolean);
    if (list.length === 0) throw new Refusal("--files names no path");
    return list;
  }
  return null;
}

function readOptional(deps, flag, p) {
  if (p === undefined) return undefined;
  try {
    return deps.readFile(p);
  } catch (e) {
    throw new Refusal(`${flag} unreadable: ${p} (${e.message})`);
  }
}

/**
 * Unstaged or untracked paths from `git status --porcelain -z` (worktree column
 * set). -z: names are never quoted, and a rename/copy entry is "XY new\0old\0",
 * so the old name is skipped and the listed path is the one --files accepts.
 */
export function unstagedPaths(porcelainZ) {
  const parts = porcelainZ.split("\0");
  const outPaths = [];
  for (let i = 0; i < parts.length; i++) {
    const e = parts[i];
    if (e.length < 4) continue;
    if (e[0] === "R" || e[0] === "C") i++;
    if (e.startsWith("??") || e[1] !== " ") outPaths.push(e.slice(3));
  }
  return outPaths;
}

const nulList = (s) => s.split("\0").filter(Boolean);

class GitFailure extends Error {}

function git(deps, args) {
  const r = deps.git(args);
  if (r.status !== 0) throw new GitFailure(`git ${args[0]} failed (exit ${r.status}): ${(r.stderr || r.stdout || "").trim()}`);
  return r.stdout;
}

export function main(argv, deps) {
  try {
    const o = parseArgs(argv);
    if (o.help) {
      deps.out("usage: node scripts/worker-commit.mjs --subject \"<one line>\" [--body-file p] [--trailer-file p] [--marker dt_xxxxxxxxxxxx] [--files a,b | --all]");
      return 0;
    }
    if (o.selfTest) throw new Refusal("--self-test takes no other arguments");
    const files = validate(o);
    const body = readOptional(deps, "--body-file", o.bodyFile);
    const trailers = readOptional(deps, "--trailer-file", o.trailerFile);

    const branch = git(deps, ["rev-parse", "--abbrev-ref", "HEAD"]).trim();
    if (!BRANCH_RE.test(branch)) throw new Refusal(`branch ${JSON.stringify(branch)} is not claude/*, brief/* or review/*`);

    const stagedNow = (pathspec) => nulList(git(deps, ["diff", "--cached", "--name-only", "-z", ...(pathspec ? ["--", ...pathspec] : [])]));
    if (files) {
      // Containment BEFORE add, so a refusal leaves the index exactly as found.
      // Git itself matches the pathspec (subdirectory cwd, directories, ./x), so
      // no hand-rolled path comparison can disagree with what `add` stages.
      const inSpec = new Set(stagedNow(files));
      const extra = stagedNow(null).filter((p) => !inSpec.has(p));
      if (extra.length) throw new Refusal(`already staged outside --files (unstage or list them):\n${extra.map((p) => `  ${p}`).join("\n")}`);
      git(deps, ["add", "--", ...files]);
    } else if (o.all) {
      git(deps, ["add", "-A"]);
    } else {
      const dirty = unstagedPaths(git(deps, ["status", "--porcelain", "-z"]));
      if (dirty.length) throw new Refusal(`unstaged changes and no --files/--all:\n${dirty.map((p) => `  ${p}`).join("\n")}`);
    }

    if (stagedNow(null).length === 0) throw new Refusal("nothing staged to commit");

    const msgPath = deps.writeTemp(buildMessage({ subject: o.subject, marker: o.marker, body, trailers }));
    try {
      git(deps, buildCommitArgv(msgPath));
    } finally {
      deps.removeTemp(msgPath);
    }
    // The commit exists from here on: a failing rev-parse must not read as exit 2
    // ("not committed"), or a caller retries into a duplicate commit.
    const head = deps.git(["rev-parse", "HEAD"]);
    if (head.status === 0) deps.out(head.stdout.trim());
    else deps.err(`worker-commit: committed, but rev-parse HEAD failed: ${(head.stderr || "").trim()}`);
    return 0;
  } catch (e) {
    if (e instanceof Refusal) {
      deps.err(`worker-commit: REFUSED: ${e.message}`);
      return 1;
    }
    deps.err(`worker-commit: ${e instanceof GitFailure ? "" : "unexpected error: "}${e.message}`);
    return 2;
  }
}

export const realDeps = {
  git: (args) => {
    const r = spawnSync("git", args, { encoding: "utf8" });
    return { status: r.status ?? 2, stdout: r.stdout ?? "", stderr: r.stderr ?? (r.error ? String(r.error) : "") };
  },
  readFile: (p) => readFileSync(p, "utf8"),
  writeTemp: (text) => {
    const dir = mkdtempSync(path.join(tmpdir(), "worker-commit-"));
    const p = path.join(dir, "COMMIT_MSG");
    writeFileSync(p, text);
    return p;
  },
  removeTemp: (p) => rmSync(path.dirname(p), { recursive: true, force: true }),
  out: (l) => console.log(l),
  err: (l) => console.error(l),
};

/** Canary: drives main() against a fake git; returns the number of failed cases. */
export function selfTest() {
  const mk = ({ branch = "claude/x", porcelain = "", staged = [], commitStatus = 0 } = {}) => {
    const calls = [];
    const st = [...staged];
    return {
      calls,
      deps: {
        git: (args) => {
          calls.push(args);
          if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") return { status: 0, stdout: `${branch}\n` };
          if (args[0] === "rev-parse") return { status: 0, stdout: "f".repeat(40) };
          if (args[0] === "status") return { status: 0, stdout: porcelain.replace(/\n/g, "\0") };
          if (args[0] === "add") { st.push(...args.slice(args.indexOf("--") + 1)); return { status: 0, stdout: "" }; }
          if (args[0] === "diff") { const sep = args.indexOf("--"); const spec = sep < 0 ? null : args.slice(sep + 1); return { status: 0, stdout: st.filter((p) => !spec || spec.includes(p)).join("\0") }; }
          if (args[0] === "commit") return { status: commitStatus, stdout: "", stderr: "x" };
          return { status: 0, stdout: "" };
        },
        readFile: () => { throw new Error("no file"); },
        writeTemp: () => "/fake/msg",
        removeTemp: () => {},
        out: () => {},
        err: () => {},
      },
    };
  };
  const cases = [
    ["ok", ["--subject", "s", "--files", "a"], {}, 0],
    ["branch main", ["--subject", "s", "--files", "a"], { branch: "main" }, 1],
    ["multi-line subject", ["--subject", "a\nb", "--files", "a"], {}, 1],
    ["empty subject", ["--subject", "", "--files", "a"], {}, 1],
    ["bad marker", ["--subject", "s", "--marker", "dt_xyz", "--files", "a"], {}, 1],
    ["dirty tree", ["--subject", "s"], { porcelain: " M a\n" }, 1],
    ["staged outside --files", ["--subject", "s", "--files", "a"], { staged: ["b"] }, 1],
    ["commit fails", ["--subject", "s", "--files", "a"], { commitStatus: 1 }, 2],
  ];
  let failed = 0;
  for (const [name, argv, opts, want] of cases) {
    const f = mk(opts);
    const got = main(argv, f.deps);
    const bad = f.calls.some((c) => c.some((a) => ["push", "-m", "--no-verify", "-c"].includes(a)));
    if (got !== want || bad) {
      failed++;
      console.error(`self-test FAIL: ${name}: exit ${got}, want ${want}${bad ? " (forbidden git argv)" : ""}`);
    }
  }
  if (failed === 0) console.log(`worker-commit self-test: ${cases.length} cases passed`);
  return failed;
}

if (isEntryPoint(import.meta.url)) {
  const argv = process.argv.slice(2);
  process.exitCode = argv.length === 1 && argv[0] === "--self-test" ? (selfTest() === 0 ? 0 : 1) : main(argv, realDeps);
}
