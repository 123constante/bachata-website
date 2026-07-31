/**
 * reworkShare.test.ts -- CI cover for the Phase 6 rework-share metric
 * (scripts/rework-share.mjs, arc operating-model-v2).
 *
 * WHY THIS EXISTS: the metric renders once a week, inside a scheduled workflow
 * nobody watches. "A metric that stops reporting" is the silent-failure class
 * this phase is meant to close, so the self-test runs on every push instead of
 * only on the Monday it breaks.
 *
 * SINGLE RULE MATRIX: the classification fixtures live ONLY in the script's
 * selfTest(); this file runs that matrix through BOTH arms -- in-process (per-
 * assertion visibility, imported below) and at spawn level (exit codes, real
 * streams) -- and adds what selfTest cannot see from inside: argument handling
 * and the shape of the markdown the digest concatenates. Do NOT re-add
 * per-subject cases here.
 */
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REWORK_RE, FROZEN_RECIPE, countTwin, render, selfTest } from "../scripts/rework-share.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(REPO_ROOT, "scripts", "rework-share.mjs");

/** Run the script, returning {status, stdout, stderr} without throwing on non-zero. */
function run(args: string[], env: NodeJS.ProcessEnv = {}) {
  // spawnSync (not execFileSync) so stderr is REAL on the success path too, and
  // process.execPath (not "node") so the child runs the same runtime as vitest,
  // matching planHygiene.test.ts and surviving PATH shims.
  const r = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return { status: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

describe("rework-share", () => {
  it("passes its own self-test in-process", () => {
    // Direct import: an assertion failure inside selfTest surfaces here with the
    // script's own FAIL lines on stderr, not just a non-zero spawn status.
    expect(selfTest()).toBe(0);
  });

  it("passes its own self-test at spawn level", () => {
    const r = run(["--self-test"]);
    expect(r.stderr).toBe("");
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/self-test: OK/);
  });

  it("keeps the frozen recipe verbatim", () => {
    // The number is only comparable to the 52%/51% baselines while this string is a
    // verbatim copy (modulo the doc's line wrap) of the one pinned in admin
    // docs/workflow-overhaul-adoption-checkpoint.md -- including NO trailing
    // `|| true`, which the script appends at the call site instead. If this test
    // fails, the owner doc must change FIRST and record a new baseline.
    expect(FROZEN_RECIPE).toBe(
      "git log --format=%s -100 | grep -c -iE '^(fix|revert)|review|punch|follow-?up|repair|reconcile|correction'"
    );
  });

  it("anchors the fix/revert alternatives and floats the rest", () => {
    expect(REWORK_RE.test("fix: anchored")).toBe(true);
    expect(REWORK_RE.test("prefix-fix: not anchored")).toBe(false);
    expect(REWORK_RE.test("feat: fold the review findings")).toBe(true);
    expect(countTwin(["fix: a", "feat: b", "chore: reconcile c"])).toBe(2);
  });

  it("renders a complete section with the admin row degraded when there is no token", () => {
    const saved = process.env.ADMIN_READ_TOKEN;
    delete process.env.ADMIN_READ_TOKEN;
    let md = "";
    try {
      md = render();
    } finally {
      if (saved !== undefined) process.env.ADMIN_READ_TOKEN = saved;
    }
    expect(md).toMatch(/^## Rework share \(trailing 100\)/);
    expect(md).toMatch(/\| Website \|/);
    expect(md).toMatch(/\| admin \|.*unavailable.*ADMIN_READ_TOKEN not set/);
    // Fail-soft means a LINE degrades, not the section: the table still has both rows
    // plus header + separator, so the digest concatenation stays well-formed markdown.
    expect(md.split("\n").filter((l) => l.startsWith("|")).length).toBe(4);
  });

  it("degrades rather than throws when the admin arm cannot reach a host", () => {
    // GH_HOST pointed at a nonexistent domain: exercises the same catch path as a bad
    // token or a GitHub outage, but fails in milliseconds, deterministically, without
    // firing an invalid-credential request at the real api.github.com on every CI run.
    const r = run(["--markdown"], {
      ADMIN_READ_TOKEN: "ghp_invalid_token_for_test",
      GH_HOST: "nonexistent-github-host.invalid",
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/\| admin \|.*unavailable/);
  });

  it("hard-errors on an unknown flag rather than silently rendering", () => {
    const r = run(["--norender"]);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/unknown argument/);
  });
});
