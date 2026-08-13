/**
 * sessionLock.test.ts -- CI cover for the session-lock advisory lock
 * (scripts/hooks/session-lock.mjs, arc operating-model-v2 Phase 6).
 *
 * WHY THIS EXISTS: the lock guards the write-corruption incident class named in
 * its own header, and before this file its 10-group --self-test was wired into
 * nothing -- an edit to the release guard or the staleness logic would have
 * shipped green everywhere. It runs that matrix on the WEBSITE copy only. The
 * sentence that used to stand here -- that the admin repo has no test
 * infrastructure and that this file is therefore the proof for both copies -- was
 * wrong, and session-lock.mjs's own header already records why: since 2026-07-31
 * the admin repo has tests/hookSelfTests.test.ts, which invokes --self-test on its
 * own copy and asserts twin parity. Cross-repo drift is caught by the two parity
 * suites, not by this file.
 *
 * SINGLE RULE MATRIX: behavioural fixtures live ONLY in the script's selfTest();
 * this file runs that matrix in-process and at spawn level, and adds the
 * spawn-only surfaces (exit codes, stdin behaviour, flag ordering).
 */
import { describe, it, expect, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { selfTest, parseArgv } from "../scripts/hooks/session-lock.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(REPO_ROOT, "scripts", "hooks", "session-lock.mjs");

const tmpDirs: string[] = [];
afterAll(() => {
  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
});

/**
 * A throwaway root so CLI-level runs cannot touch the real .claude/ lock. The script
 * resolves its root from its own location, NOT process.cwd() (hooks depend on that),
 * so sandboxing goes through the SESSION_LOCK_ROOT test-only override - an early
 * draft of this file used cwd and deleted the live session's real lock mid-run.
 */
function mkRepo(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "sesslock-cli-"));
  tmpDirs.push(d);
  return d;
}

function run(args: string[], opts: { root?: string; input?: string } = {}) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    input: opts.input, // undefined = closed stdin, so --hook reads EOF, never blocks
    env: { ...process.env, ...(opts.root ? { SESSION_LOCK_ROOT: opts.root } : {}) },
  });
  return { status: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

describe("session-lock", () => {
  it("passes its own self-test in-process", () => {
    expect(selfTest()).toBe(0);
  });

  it("passes its own self-test at spawn level", () => {
    const r = run(["--self-test"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/self-test: OK/);
  });

  it("parses flags position-independently (a value is never the verb)", () => {
    expect(parseArgv(["--id", "abc", "release"]).cmd).toBe("release");
    expect(parseArgv(["--stale-minutes", "90", "acquire"]).cmd).toBe("acquire");
    expect(parseArgv(["release", "--bogus"]).error).toMatch(/unknown flag/);
  });

  it("full hook lifecycle at CLI level: acquire, heartbeat, guarded + owner release", () => {
    const repo = mkRepo();
    const hookA = { root: repo, input: JSON.stringify({ session_id: "sess-A" }) };

    const acq = run(["acquire", "--warn-only", "--hook"], hookA);
    expect(acq.status).toBe(0);
    expect(acq.stdout).toMatch(/acquired \(sess-A/);

    // Own heartbeat: silent, exit 0.
    const hb = run(["heartbeat", "--hook"], hookA);
    expect(hb.status).toBe(0);
    expect(hb.stdout).toBe("");

    // Foreign heartbeat: warns on BOTH streams (context + terminal), exit 0, no steal.
    const hookB = { root: repo, input: JSON.stringify({ session_id: "sess-B" }) };
    const fhb = run(["heartbeat", "--hook"], hookB);
    expect(fhb.status).toBe(0);
    expect(fhb.stdout).toMatch(/another Claude session is live/);
    expect(fhb.stderr).toMatch(/another Claude session is live/);

    // Quiet (Stop-entry) foreign heartbeat: fully silent, still no steal.
    const qhb = run(["heartbeat", "--hook", "--quiet"], hookB);
    expect(qhb.status).toBe(0);
    expect(qhb.stdout).toBe("");

    // Foreign SessionEnd: guarded, refuses, exit 0.
    const frel = run(["release", "--hook"], hookB);
    expect(frel.status).toBe(0);
    expect(frel.stdout).toMatch(/NOT releasing/);
    expect(fs.existsSync(path.join(repo, ".claude", ".session-lock.json"))).toBe(true);

    // Owner SessionEnd: deletes.
    const orel = run(["release", "--hook"], hookA);
    expect(orel.status).toBe(0);
    expect(orel.stdout).toMatch(/released/);
    expect(fs.existsSync(path.join(repo, ".claude", ".session-lock.json"))).toBe(false);
  });

  it("manual release (no --hook) is the escape hatch: deletes a live foreign lock with a warning", () => {
    const repo = mkRepo();
    run(["acquire", "--hook"], { root: repo, input: JSON.stringify({ session_id: "sess-A" }) });
    // A manual run mints a pid identity that can never match sess-A -- the old shell
    // behaviour (delete + warn) must survive, or the documented hatch is a silent no-op.
    const rel = run(["release"], { root: repo });
    expect(rel.status).toBe(0);
    expect(rel.stdout).toMatch(/released/);
    expect(rel.stderr).toMatch(/releasing lock held by 'sess-A'/);
    expect(fs.existsSync(path.join(repo, ".claude", ".session-lock.json"))).toBe(false);
  });

  it("check exits 1 against a live foreign lock and 0 on a free repo", () => {
    const repo = mkRepo();
    expect(run(["check"], { root: repo }).status).toBe(0);
    run(["acquire", "--hook"], { root: repo, input: JSON.stringify({ session_id: "sess-A" }) });
    expect(run(["check"], { root: repo }).status).toBe(1);
  });
});
