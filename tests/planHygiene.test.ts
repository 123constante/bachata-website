/**
 * planHygiene.test.ts -- CI cover for the Phase 5 plan-layer guard
 * (scripts/check-plan-hygiene.mjs, arc operating-model-v2).
 *
 * WHY THIS EXISTS ALONGSIDE --self-test: the guard's live target is the HOME
 * plans dir, which does not exist on a CI runner, so "npm run check:plan-hygiene"
 * SKIPs there. Without this file the rules would be proven only on Ricky's
 * machine and CI would green-stamp a guard it never exercised.
 *
 * SINGLE RULE MATRIX (review finding 14): the per-rule fixtures live ONLY in
 * the script's selfTest(); this file runs that in-process and at spawn level,
 * and adds what selfTest cannot see from inside: CLI flag handling, exit
 * codes, the read-only default, ARC_STATE_FILE plumbing, and pre-ship's SKIP
 * predicate. Do NOT re-add per-rule it() blocks here -- a rule added to only
 * one of two matrices silently loses half its coverage.
 */
import { describe, it, expect, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { selfTest, plansDir } from "../scripts/check-plan-hygiene.mjs";
import { CHECK_SKIPS } from "../scripts/pre-ship.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(REPO_ROOT, "scripts", "check-plan-hygiene.mjs");

const tmpDirs: string[] = [];
afterAll(() => {
  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
});

function mkDir(files: Record<string, string>): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "planhyg-"));
  tmpDirs.push(d);
  for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(d, name), body);
  return d;
}

const plan = (fields: Record<string, string>, title = "A plan") =>
  "---\n" +
  Object.entries(fields)
    .map(([k, v]) => k + ": " + v)
    .join("\n") +
  "\n---\n\n# " + title + "\n\nbody\n";

/** Spawn the CLI against a fixture dir. ARC_STATE_FILE is pointed at nothing
 *  by default so the REPO's live arc-state (whose plan is not in the fixture
 *  dir) cannot bleed into fixture verdicts. */
function cli(dir: string, args: string[] = [], env: Record<string, string> = {}) {
  const absentArcState = path.join(os.tmpdir(), "planhyg-no-arc-state-" + process.pid + ".json");
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT, ...args], {
      encoding: "utf8",
      env: { ...process.env, PLANS_DIR: dir, ARC_STATE_FILE: absentArcState, ...env },
    });
    return { status: 0, stdout };
  } catch (e) {
    const er = e as { status: number; stdout?: string; stderr?: string };
    return { status: er.status, stdout: (er.stdout || "") + (er.stderr || "") };
  }
}

describe("the script's own --self-test (the single rule matrix)", () => {
  it("passes in-process", () => {
    expect(selfTest(() => {})).toBe(true);
  });

  it("passes at spawn level with no FAIL lines", () => {
    const out = execFileSync(process.execPath, [SCRIPT, "--self-test"], { encoding: "utf8" });
    expect(out).toContain("PASS self-test");
    expect(out).not.toContain("  FAIL ");
  });
});

describe("CLI behaviour (what selfTest cannot see from inside)", () => {
  const tree = () =>
    mkDir({
      "live-a.md": plan({ status: "live", arc: "alpha" }, "Alpha live"),
      "done-b.md": plan({ status: "shipped", arc: "beta" }, "Beta shipped"),
      "legacy.md": "# Legacy\n\nno frontmatter\n",
    });

  it("is READ-ONLY by default: exit 0, no index written", () => {
    const d = tree();
    const r = cli(d);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("PASS plan hygiene");
    expect(r.stdout).toContain("index STALE (or missing)");
    expect(fs.existsSync(path.join(d, "PLANS-INDEX.md"))).toBe(false);
  });

  it("--render writes the index; a second --render run says up-to-date", () => {
    const d = tree();
    expect(cli(d, ["--render"]).stdout).toContain("index written");
    const index = fs.readFileSync(path.join(d, "PLANS-INDEX.md"), "utf8");
    expect(index).toContain("### alpha");
    expect(index).toContain("1 grandfathered plan file(s)");
    expect(cli(d, ["--render"]).stdout).toContain("index up to date");
  });

  // The PASS line is the operator-facing statement of the arc: none rule, and
  // selfTest() cannot see it -- it calls run(), never report(). A mutant that
  // counted arc-less plans as arcs SURVIVED the whole self-test battery with
  // zero fail lines, so the summary is pinned here instead.
  it("the PASS line counts arc-less plans separately, never as an arc", () => {
    const d = mkDir({
      "live-a.md": plan({ status: "live", arc: "alpha" }, "Alpha live"),
      "solo-1.md": plan({ status: "live", arc: "none" }, "Solo one"),
      "solo-2.md": plan({ status: "live", arc: "none" }, "Solo two"),
    });
    const r = cli(d);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("1 arc-tagged plan(s) across 1 arc(s)");
    expect(r.stdout).toContain("2 arc-less (`arc: none`)");
  });

  it("rejects unknown flags instead of silently defaulting (--norender typo)", () => {
    const d = tree();
    const r = cli(d, ["--norender"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("unknown flag");
    expect(fs.existsSync(path.join(d, "PLANS-INDEX.md"))).toBe(false);
  });

  it("exits 1 on a lint failure and never writes the index, even with --render", () => {
    const d = tree();
    fs.writeFileSync(path.join(d, "bad.md"), plan({ status: "in-progress", arc: "gamma" }));
    const r = cli(d, ["--render"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("E_STATUS_ENUM");
    expect(fs.existsSync(path.join(d, "PLANS-INDEX.md"))).toBe(false);
  });

  it("SKIPs with exit 0 when the plans dir is absent (fail-open for CI)", () => {
    const gone = path.join(os.tmpdir(), "planhyg-absent-spawn-" + process.pid);
    const r = cli(gone);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("SKIP plan hygiene");
  });

  it("PLANS_DIR overrides the home default, but a blank value does not", () => {
    expect(plansDir({ PLANS_DIR: "  " })).toBe(path.join(os.homedir(), ".claude", "plans"));
    expect(plansDir({ PLANS_DIR: "/tmp/somewhere" })).toBe(path.resolve("/tmp/somewhere"));
  });
});

describe("arc-state cross-check plumbing (end to end via ARC_STATE_FILE)", () => {
  it("reds when arc-state names a live arc whose plan carries a different slug", () => {
    const d = mkDir({ "the-plan.md": plan({ status: "live", arc: "operating-model-v3" }) });
    const stateFile = path.join(d, "arc-state.json");
    fs.writeFileSync(
      stateFile,
      JSON.stringify({ version: 1, arc: "operating-model-v2", phase: 5, plan: "C:/x/the-plan.md", set_at: "2026-07-30T00:00:00Z" }),
    );
    const r = cli(d, [], { ARC_STATE_FILE: stateFile });
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("E_ARCSTATE_ARC_MISMATCH");
  });

  it("greens when arc-state and the plan agree", () => {
    const d = mkDir({ "the-plan.md": plan({ status: "live", arc: "operating-model-v2" }) });
    const stateFile = path.join(d, "arc-state.json");
    fs.writeFileSync(
      stateFile,
      JSON.stringify({ version: 1, arc: "operating-model-v2", phase: 5, plan: "C:/x/the-plan.md", set_at: "2026-07-30T00:00:00Z" }),
    );
    const r = cli(d, [], { ARC_STATE_FILE: stateFile });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("arc-state cross-check ok");
  });

  it("a missing arc-state file skips the cross-check silently", () => {
    const d = mkDir({ "a.md": plan({ status: "live", arc: "alpha" }) });
    const r = cli(d);
    expect(r.status).toBe(0);
    expect(r.stdout).not.toContain("arc-state cross-check ok");
  });
});

describe("pre-ship's SKIP predicate for this check (review finding 5)", () => {
  it("returns a reason when the plans dir is absent, null when present", () => {
    const skip = CHECK_SKIPS["check:plan-hygiene"] as (() => string | null) | undefined;
    expect(typeof skip).toBe("function");
    const prev = process.env.PLANS_DIR;
    try {
      process.env.PLANS_DIR = path.join(os.tmpdir(), "planhyg-absent-" + process.pid);
      expect(skip!()).toContain("no plans dir");
      process.env.PLANS_DIR = mkDir({});
      expect(skip!()).toBeNull();
    } finally {
      if (prev === undefined) delete process.env.PLANS_DIR;
      else process.env.PLANS_DIR = prev;
    }
  });
});
