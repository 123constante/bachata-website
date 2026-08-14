/**
 * arcState.test.ts -- both-directions proof for the Phase 4 arc-checkpoint
 * machinery (arc operating-model-v2). Covers the shared lib
 * (scripts/lib/arc-state.mjs), spawn-level behaviour of the hook
 * (scripts/hooks/arc-checkpoint.mjs), and twin parity with the admin repo.
 *
 * Review finding 12: the first ship wired six behavioural branches into every
 * prompt with zero test coverage, and at least three of them were wrong (BOM
 * silence, NaN set_at, dated-id false mismatch) -- each is pinned here.
 */
import { describe, it, expect, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadArcState,
  arcLabel,
  staleness,
  compareModel,
  compareEffort,
  clip,
  ARC_STALE_MS,
} from "../scripts/lib/arc-state.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NOW = Date.UTC(2026, 6, 30, 12, 0, 0);
const FRESH = { arc: "x", phase: 4, required_model: "claude-opus-5", required_effort: "high", set_at: "2026-07-30T10:00:00Z" };

const tmpDirs: string[] = [];
afterAll(() => {
  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
});

/** Temp tree with copies of the hook + lib, so spawn tests never touch the real
 *  .claude/arc-state.json (which belongs to the live arc). */
function mkTree(arcState: unknown): string {
  const t = fs.mkdtempSync(path.join(os.tmpdir(), "arcstate-"));
  tmpDirs.push(t);
  fs.mkdirSync(path.join(t, "scripts", "hooks"), { recursive: true });
  fs.mkdirSync(path.join(t, "scripts", "lib"), { recursive: true });
  fs.mkdirSync(path.join(t, ".claude"), { recursive: true });
  // What the temp tree needs to RUN -- a different question from the twin list below,
  // so the two stay separate. This is arc-checkpoint.mjs (the only thing runHook ever
  // spawns) plus its import closure: arc-state.mjs, and now entry-point.mjs, because
  // the dispatch was converted to isEntryPoint() and ../lib/entry-point.mjs must
  // resolve in the temp tree or every spawn below dies at import with
  // ERR_MODULE_NOT_FOUND (proven by removing it: all 7 spawn cases go red).
  //
  // session-lock.mjs used to be copied here too and never was spawned or imported by
  // this file -- dead setup that a first draft of this comment certified as needed.
  // Dropped: if a session-lock spawn case is ever added, add it back WITH the case.
  for (const rel of [
    "scripts/hooks/arc-checkpoint.mjs",
    "scripts/lib/arc-state.mjs",
    "scripts/lib/entry-point.mjs",
  ]) {
    fs.copyFileSync(path.join(REPO_ROOT, rel), path.join(t, rel));
  }
  if (arcState !== null) {
    const body = typeof arcState === "string" ? arcState : JSON.stringify(arcState);
    fs.writeFileSync(path.join(t, ".claude", "arc-state.json"), body);
  }
  return t;
}

function runHook(tree: string, stdin: string, args: string[] = []): string {
  // The hook must exit 0 on EVERY path; execFileSync throwing IS the assertion.
  return execFileSync(process.execPath, [path.join(tree, "scripts", "hooks", "arc-checkpoint.mjs"), ...args], {
    input: stdin,
    encoding: "utf8",
  });
}

describe("loadArcState", () => {
  const inTmp = (body: string | null): string => {
    const t = fs.mkdtempSync(path.join(os.tmpdir(), "arcload-"));
    tmpDirs.push(t);
    const f = path.join(t, "arc-state.json");
    if (body !== null) fs.writeFileSync(f, body);
    return f;
  };

  it("missing file -> missing", () => {
    expect(loadArcState(inTmp(null)).status).toBe("missing");
  });
  it("unparseable -> corrupt, NEVER downgraded to missing", () => {
    expect(loadArcState(inTmp("{ not json")).status).toBe("corrupt");
  });
  it("present but unreadable (directory at the path) -> corrupt, not missing", () => {
    const t = fs.mkdtempSync(path.join(os.tmpdir(), "arcdir-"));
    tmpDirs.push(t);
    const f = path.join(t, "arc-state.json");
    fs.mkdirSync(f);
    expect(loadArcState(f).status).toBe("corrupt");
  });
  it("parseable non-object -> corrupt", () => {
    expect(loadArcState(inTmp('"a string"')).status).toBe("corrupt");
    expect(loadArcState(inTmp("[1,2]")).status).toBe("corrupt");
  });
  it("UTF-8 BOM + valid JSON -> ok (BOM is PowerShell noise, not corruption)", () => {
    const f = inTmp("");
    fs.writeFileSync(f, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(JSON.stringify(FRESH))]));
    expect(loadArcState(f).status).toBe("ok");
  });
  it('phase "done" or closed_at -> closed', () => {
    expect(loadArcState(inTmp(JSON.stringify({ ...FRESH, phase: "done" }))).status).toBe("closed");
    expect(loadArcState(inTmp(JSON.stringify({ ...FRESH, closed_at: "2026-07-01T00:00:00Z" }))).status).toBe("closed");
  });
  it("neither requirement -> inactive; ONE requirement -> ok (either-field rule)", () => {
    expect(loadArcState(inTmp(JSON.stringify({ arc: "x", phase: 1, set_at: FRESH.set_at }))).status).toBe("inactive");
    expect(
      loadArcState(inTmp(JSON.stringify({ arc: "x", phase: 1, required_model: "claude-opus-5", set_at: FRESH.set_at }))).status
    ).toBe("ok");
    expect(
      loadArcState(inTmp(JSON.stringify({ arc: "x", phase: 1, required_effort: "high", set_at: FRESH.set_at }))).status
    ).toBe("ok");
  });
});

describe("staleness", () => {
  it("fresh set_at -> not stale", () => {
    expect(staleness(FRESH, NOW).stale).toBe(false);
  });
  it("missing or garbage set_at -> STALE (unbounded means stale, not fresh)", () => {
    expect(staleness({ ...FRESH, set_at: undefined }, NOW).stale).toBe(true);
    expect(staleness({ ...FRESH, set_at: "not a date" }, NOW).stale).toBe(true);
  });
  it("future set_at beyond clock skew -> stale; within skew -> fresh", () => {
    expect(staleness({ ...FRESH, set_at: new Date(NOW + 2 * 3600000).toISOString() }, NOW).stale).toBe(true);
    expect(staleness({ ...FRESH, set_at: new Date(NOW + 10 * 60000).toISOString() }, NOW).stale).toBe(false);
  });
  it("older than 7 days -> stale with age in days", () => {
    const old = staleness({ ...FRESH, set_at: new Date(NOW - ARC_STALE_MS - 86400000).toISOString() }, NOW);
    expect(old.stale).toBe(true);
    expect(old.reason).toContain("8 days");
  });
});

describe("compareModel / compareEffort", () => {
  it("exact match", () => {
    expect(compareModel("claude-opus-5", "claude-opus-5")).toBe("match");
  });
  it("[1m] ceiling variant -> ceiling, not mismatch", () => {
    expect(compareModel("claude-opus-5[1m]", "claude-opus-5")).toBe("ceiling");
  });
  it("dated id -> match (the false-MISMATCH pin: never order a switch to the current model)", () => {
    expect(compareModel("claude-opus-5-20260514", "claude-opus-5")).toBe("match");
    expect(compareModel("claude-haiku-4-5-20251001", "claude-haiku-4-5")).toBe("match");
  });
  it("dated + bracket -> ceiling", () => {
    expect(compareModel("claude-opus-5-20260514[1m]", "claude-opus-5")).toBe("ceiling");
  });
  it("different tier -> mismatch", () => {
    expect(compareModel("claude-fable-5", "claude-opus-5")).toBe("mismatch");
    expect(compareModel("fable[1m]", "claude-opus-5")).toBe("mismatch");
  });
  it("SHORT ALIAS matches its family (the form settings.json actually stores)", () => {
    // Ricky's user settings hold "opus[1m]", not "claude-opus-5[1m]". Comparing
    // those as strings made every correctly-configured session render a red
    // SWITCH -- found by rendering the statusline with his real settings value.
    expect(compareModel("opus", "claude-opus-5")).toBe("match");
    expect(compareModel("sonnet", "claude-sonnet-5")).toBe("match");
    expect(compareModel("opus[1m]", "claude-opus-5")).toBe("ceiling");
  });
  it("a bare family is version-agnostic, so the rule survives the next model", () => {
    expect(compareModel("opus", "claude-opus-6")).toBe("match");
    expect(compareModel("claude-opus-6", "claude-opus-5")).toBe("mismatch");
  });
  it("unobservable session model -> unknown, never mismatch", () => {
    expect(compareModel("", "claude-opus-5")).toBe("unknown");
  });
  it("no requirement -> match", () => {
    expect(compareModel("anything", "")).toBe("match");
  });
  it("effort: unobservable (empty or question mark) -> unknown (the permanent-red pin)", () => {
    expect(compareEffort("", "high")).toBe("unknown");
    expect(compareEffort("?", "high")).toBe("unknown");
    expect(compareEffort("high", "high")).toBe("match");
    expect(compareEffort("low", "high")).toBe("mismatch");
  });
});

describe("arcLabel / clip", () => {
  it("numeric phase renders P-prefixed; slug renders verbatim", () => {
    expect(arcLabel({ arc: "operating-model-v2", phase: 4 })).toBe("operating-model-v2 P4");
    expect(arcLabel({ arc: "m2", phase: "socials-teardown" })).toBe("m2 socials-teardown");
  });
  it("long labels clip; control characters collapse (injection cap pin)", () => {
    expect(arcLabel({ arc: "a".repeat(100), phase: 1 }, 40)).toHaveLength(40);
    expect(clip("line1\nline2\tline3", 80)).toBe("line1 line2 line3");
  });
});

describe("arc-checkpoint hook (spawned)", () => {
  const PROMPT = JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt: "hi" });
  // These cases spawn the REAL hook, which reads the REAL clock, so a fixture
  // with a hardcoded set_at has an expiry date. FRESH's 2026-07-30 stamp passed
  // it seven days later and took three cases with it: two went red, and "dated
  // session model id -> NO mismatch line" started passing VACUOUSLY, because
  // the staleness path suppresses the very line it asserts the absence of --
  // the worse failure of the two, since nothing goes red to say so. Stamp the
  // live-path fixture at run time. The staleness cases above keep the fixed
  // date on purpose: they are handed an explicit NOW, so they are not clocks.
  const LIVE = () => ({ ...FRESH, set_at: new Date().toISOString() });

  it("live arc-state -> injects the requirement, exit 0", () => {
    const out = runHook(mkTree(LIVE()), PROMPT);
    expect(out).toContain("ARC CHECKPOINT [x P4]");
    expect(out).toContain("/model claude-opus-5, effort high");
  });
  it("missing arc-state -> completely silent", () => {
    expect(runHook(mkTree(null), PROMPT)).toBe("");
  });
  it("corrupt arc-state -> one-line note, NOT silence (corrupt is not absent)", () => {
    const out = runHook(mkTree("{ not json"), PROMPT);
    expect(out).toContain("does not parse");
  });
  it("garbage stdin under --event=SessionStart -> hookEventName stays SessionStart", () => {
    const out = runHook(mkTree(LIVE()), "not json at all", ["--event=SessionStart"]);
    expect(JSON.parse(out).hookSpecificOutput.hookEventName).toBe("SessionStart");
  });
  it("dated session model id -> NO mismatch line", () => {
    const out = runHook(
      mkTree(LIVE()),
      JSON.stringify({ hook_event_name: "SessionStart", model: { id: "claude-opus-5-20260514" } }),
      ["--event=SessionStart"]
    );
    expect(out).not.toContain("MODEL MISMATCH");
  });
  it("wrong-tier session model -> mismatch line names the switch", () => {
    const out = runHook(
      mkTree(LIVE()),
      JSON.stringify({ hook_event_name: "SessionStart", model: { id: "claude-fable-5" } }),
      ["--event=SessionStart"]
    );
    expect(out).toContain("MODEL MISMATCH");
    expect(out).toContain("/model claude-opus-5");
  });
  it("no-set_at arc-state -> staleness note INSTEAD of the requirement", () => {
    const out = runHook(mkTree({ ...FRESH, set_at: undefined }), PROMPT);
    expect(out).toContain("stale");
    expect(out).not.toContain("required /model");
  });
});

/**
 * The message a drift failure carries. It has to name the cross-repo landing rule,
 * because the commonest cause of a red here is NOT drift: it is that this compares
 * two WORKING TREES, so the verdict depends on which branch the neighbouring checkout
 * happens to be on. During a change that spans both repos the honest pair lives in two
 * worktrees, and ADMIN_REPO_DIR is how you point the gate at the pair actually under
 * review -- which runs the whole comparison rather than skipping it, and is not a
 * bypass. Left unexplained, this red reads as "the twin drifted" and invites someone
 * to resync by copying one repo's hooks over the other's, which lands a hook whose
 * ../lib/entry-point.mjs does not exist there.
 */
const TWIN_DRIFT_HINT = (rel: string, sibling: string) =>
  `${rel} has drifted between the two repos (compared against ${sibling}). ` +
  "If a cross-repo change is mid-flight, set ADMIN_REPO_DIR to the checkout holding the paired commit.";

describe("twin parity (skips when the admin checkout is absent, e.g. CI)", () => {
  const fromEnv = Boolean(process.env.ADMIN_REPO_DIR);
  const sibling = process.env.ADMIN_REPO_DIR || path.resolve(REPO_ROOT, "..", "bachata-admin-11april");
  const present = fs.existsSync(path.join(sibling, "scripts", "hooks", "arc-checkpoint.mjs"));
  const lf = (p: string) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

  // SAY WHICH CHECKOUT THIS COMPARED, on the green and skipped paths too -- the
  // failure message already carries it, and by then it is too late to be the
  // thing that prevents the wrong diagnosis. This block's verdict depends on
  // which branch a NEIGHBOURING working tree happens to be on, so a run aimed at
  // the wrong one is indistinguishable from real drift, and a skipped run is
  // indistinguishable from a passing one.
  //
  // Not hypothetical. On 2026-08-13 a PowerShell `$env:ADMIN_REPO_DIR` left set
  // after a cross-repo push (PowerShell has no `VAR=value cmd` prefix, so the
  // assignment persists for the whole shell) pointed a later run in an unrelated
  // worktree at a converted sibling, and its legitimately-unconverted twins
  // reported as `1 failed | 1322 passed`. One line here makes that self-evident.
  // process.stdout.write, NOT console.log, to match the admin twin of this block:
  // console.log prints here but is swallowed there (that suite runs happy-dom on the
  // forks pool, whose DOM console vitest does not intercept -- measured 2026-08-14).
  // These two blocks are read as a pair, so they use the form that works in both.
  const source = fromEnv ? "ADMIN_REPO_DIR" : "default sibling path";
  process.stdout.write(
    (present
      ? `twin parity: comparing against ${sibling} (${source})`
      : `twin parity: SKIPPED -- no admin checkout at ${sibling} (${source})`) + "\n",
  );

  it.skipIf(!present)("hook + lib content-identical modulo line endings", () => {
    // entry-point.mjs joined this list when the two hooks were converted to
    // dispatch through it: a vendored dependency that can drift silently is
    // exactly what this block exists to catch, and both hooks' behaviour now
    // turns on its contents.
    for (const rel of [
      "scripts/hooks/arc-checkpoint.mjs",
      "scripts/lib/arc-state.mjs",
      "scripts/lib/entry-point.mjs",
      "scripts/hooks/session-lock.mjs",
    ]) {
      const there = path.join(sibling, rel);
      // Existence and a length floor BEFORE the compare, matching the admin twin of
      // this block (tests/hookSelfTests.test.ts). Without them a sibling that simply
      // has not received a twin yet dies inside lf() with a bare ENOENT that names no
      // file and reads as a broken spec -- and two empty reads would compare equal.
      expect(fs.existsSync(there), `${rel} is missing from the admin checkout at ${sibling}`).toBe(true);
      expect(lf(there).length, `${rel} read as empty from ${sibling}`).toBeGreaterThan(500);
      expect(lf(there), TWIN_DRIFT_HINT(rel, sibling)).toBe(lf(path.join(REPO_ROOT, rel)));
    }
  });
});
