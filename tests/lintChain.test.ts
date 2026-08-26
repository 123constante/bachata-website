/**
 * lintChain.test.ts -- both-directions proof for the local lint tier's runner.
 *
 * The defect this suite exists to catch is a SILENT one: `npm run lint` going
 * back to stopping at its first red link. That is what it did for years as a
 * shell `&&` chain, and the reason it mattered is that four of the links are
 * `:self-test` canaries sitting immediately ahead of the check they prove --
 * so a canary that red for its own reasons reported "this guard is broken" and
 * the guard never ran to name the actual defect.
 *
 * A reintroduced short-circuit looks EXACTLY like a healthy run on a clean tree:
 * every link passes, so nothing is hidden and nothing is red. It only becomes
 * visible once something fails, which is why the load-bearing cases here drive
 * main() with a stub exec that FAILS a link and then assert on which links were
 * nonetheless invoked. Asserting the exit code alone would not catch it: a
 * short-circuiting runner returns 1 for that input too.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../scripts/lib/review-scope.mjs";
import {
  LINKS,
  TAIL,
  PASS,
  FAIL,
  BROKEN,
  classify,
  decideExit,
  ledger,
  main,
  missingScripts,
} from "../scripts/run-lint-chain.mjs";

const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));

/**
 * An exec stub. Records every id it is asked to run, and throws for the ids in
 * `failures` with that exit status -- or with NO status at all when the mapped
 * value is null, which is what a signal or a spawn failure looks like.
 */
type Failure = number | null | { signal: string };
type Call = { id: string; opts: Record<string, unknown> };

function stubExec(failures: Record<string, Failure>, calls: Call[]) {
  return (cmd: string, opts: Record<string, unknown>) => {
    const id = String(cmd).replace("npm run --silent ", "").trim();
    calls.push({ id, opts });
    if (!Object.hasOwn(failures, id)) return "";
    const err: Error & { status?: number; signal?: string } = new Error("stub failure: " + id);
    const outcome = failures[id];
    if (typeof outcome === "number") err.status = outcome;
    else if (outcome && typeof outcome === "object") err.signal = outcome.signal;
    throw err;
  };
}

/** Drive main() with a stub exec, swallowing its output. */
function run(failures: Record<string, Failure>, opts: { links?: string[]; tail?: string | null } = {}) {
  const raw: Call[] = [];
  const links = opts.links ?? LINKS;
  const tail = opts.tail === undefined ? TAIL : opts.tail;
  const lines: string[] = [];
  const code = main({
    links,
    tail,
    exec: stubExec(failures, raw),
    write: (s: string) => lines.push(s),
    // Every id the suite uses is declared present unless a case says otherwise,
    // so a case about FAILING is never accidentally a case about MISSING.
    scripts: Object.fromEntries([...links, ...(tail ? [tail] : [])].map((id) => [id, "x"])),
  });
  return { code, calls: raw.map((c) => c.id), raw, out: lines.join("") };
}

describe("the chain runs to COMPLETION -- the property this file replaced an && chain for", () => {
  it("a red FIRST link does not stop the run: every later link still runs", () => {
    const { code, calls, out } = run({ "check:integrity": 1 });
    // EVERY link, in order. The tail is absent by design once a link is red --
    // see the tail describe below; that is a reporting decision, not a stop.
    expect(calls).toEqual([...LINKS]);
    expect(out).toContain("[SKIP] " + TAIL);
    expect(code).toBe(1);
  });

  it("a red CANARY does not silence the check it sits in front of", () => {
    // The concrete instance: check:mojibake:self-test is link 2 and
    // check:mojibake is link 3. Under && the canary's red meant the scan never
    // ran, so a corrupt tree reported as "the canary is broken".
    const canary = "check:mojibake:self-test";
    const check = "check:mojibake";
    expect(LINKS.indexOf(canary)).toBe(LINKS.indexOf(check) - 1);
    const { calls } = run({ [canary]: 1 });
    expect(calls).toContain(check);
    expect(calls.indexOf(check)).toBeGreaterThan(calls.indexOf(canary));
  });

  it("EVERY link is red and every link still ran", () => {
    const failures = Object.fromEntries(LINKS.map((id) => [id, 1]));
    const { code, calls } = run(failures);
    expect(calls).toEqual([...LINKS]);
    expect(code).toBe(1);
  });

  it("a link that is not an npm script is REPORTED, not run, and does not stop the rest", () => {
    // What --silent does to a missing script: nothing printed, exit 1. Caught
    // before exec so it reads as infrastructure and names itself.
    const gone = "check:rpc-typing";
    const scripts = Object.fromEntries(
      [...LINKS, TAIL].filter((id) => id !== gone).map((id) => [id, "x"])
    );
    const calls: Call[] = [];
    const lines: string[] = [];
    const code = main({
      exec: stubExec({}, calls),
      write: (s: string) => lines.push(s),
      scripts,
    });
    expect(calls.map((c) => c.id)).toEqual(LINKS.filter((id) => id !== gone));
    expect(lines.join("")).toContain("NOT AN NPM SCRIPT");
    expect(lines.join("")).toContain("[BROKEN] " + gone);
    expect(code).toBe(2);
  });

  it("Ctrl-C STOPS the tier -- the one reason the loop may break", () => {
    // main() is synchronous, so node cannot process its own pending SIGINT
    // until it returns. Without this the operator needed one interrupt per
    // link. The child's signal is the seam.
    const { code, calls, out } = run({ "check:mojibake": { signal: "SIGINT" } });
    expect(calls).toEqual(LINKS.slice(0, LINKS.indexOf("check:mojibake") + 1));
    expect(out).toContain("INTERRUPTED (SIGINT)");
    expect(out).toContain("[SKIP] " + TAIL);
    expect(code).toBe(2);
  });

  it("a link killed by some OTHER signal does NOT stop the tier", () => {
    // The abort predicate is about the operator, not about guards dying. An
    // OOM-killed guard is a broken link, and the rest must still report.
    const { calls } = run({ "check:mojibake": { signal: "SIGKILL" } });
    expect(calls).toEqual([...LINKS]);
  });

  it("a clean tree runs every link exactly once, in order, and passes", () => {
    const { code, calls } = run({});
    expect(calls).toEqual([...LINKS, TAIL]);
    expect(new Set(calls).size).toBe(calls.length);
    expect(code).toBe(0);
  });
});

describe("the exec OPTIONS are load-bearing, and were asserted by nothing", () => {
  // The stub used to take only `cmd`. Drop `stdio: "inherit"` from runLink and
  // every case still passed -- while the real tier went silent, because execSync
  // then BUFFERS each guard's stdout and runLink discards the return value. The
  // ledger would have said `[FAIL] check:image-widths (exit 1)` with no line
  // naming the file, and any guard over the 1MB default maxBuffer would throw
  // with no numeric status and report as BROKEN. A seam that proves ONE property
  // hides its siblings; these are the siblings.
  it("every link inherits stdio, so the guards' own output reaches the operator", () => {
    const { raw } = run({});
    expect(raw.length).toBeGreaterThan(0);
    for (const c of raw) expect(c.opts.stdio, c.id).toBe("inherit");
  });

  it("every link runs from the repo root, not the caller's cwd", () => {
    const { raw } = run({});
    for (const c of raw) expect(c.opts.cwd, c.id).toBe(REPO_ROOT);
  });

  it("missingScripts is what makes --silent safe", () => {
    // npm run --silent <missing> prints nothing and exits 1 (measured in this
    // tree). The pre-check is the only thing standing between that and an
    // unexplained [FAIL].
    expect(missingScripts(["check:mojibake", "nope"], { "check:mojibake": "x" })).toEqual(["nope"]);
    expect(missingScripts(LINKS, Object.fromEntries(LINKS.map((id) => [id, "x"])))).toEqual([]);
  });
});

describe("an empty links list fails CLOSED", () => {
  it("no links at all is exit 2, never a PASS", () => {
    // "lint PASSED -- 0 of 0 links green" having run no guard at all is the
    // unknown-recorded-as-an-extreme shape this repo has been bitten by. A
    // PARTIALLY truncated list is caught in tests/reviewScope.test.ts, against
    // pre-ship's CHECKS -- deliberately not by a number pinned in the runner.
    expect(decideExit([])).toBe(2);
    const { code, calls, out } = run({}, { links: [], tail: null });
    expect(calls).toEqual([]);
    expect(out).toContain("NO LINKS RAN");
    expect(code).toBe(2);
  });
});

describe("the eslint tail is informational, and cannot become a gate by accident", () => {
  it("every link green + a red tail is a PASS", () => {
    const { code, calls } = run({ [TAIL]: 1 });
    expect(calls).toEqual([...LINKS, TAIL]);
    expect(code).toBe(0);
  });

  it("decideExit takes no SECOND POSITIONAL parameter for the tail", () => {
    // Narrowly what it says, because the obvious stronger claim is false.
    // Function.length stops counting at the first DEFAULTED parameter, so
    // `decideExit(results, tail = null)` still reports 1 and this case is blind
    // to it -- measured, not assumed. What actually holds the line is the
    // behavioural case above ("every link green + a red tail is a PASS"), which
    // fails the moment main() feeds the tail into the verdict however the
    // signature is spelled. This one only catches the un-defaulted form, and is
    // kept for that.
    expect(decideExit.length).toBe(1);
  });

  it("the ledger labels a RED tail [WARN] and says why, never [FAIL]", () => {
    const lines = ledger(LINKS.map((id) => ({ id, code: 0 })), { code: 1 }).join("\n");
    expect(lines).toContain("[WARN] " + TAIL);
    expect(lines).not.toContain("[FAIL] " + TAIL);
    expect(lines).toContain("INFORMATIONAL");
    expect(lines).toContain("lint PASSED");
  });

  it("a GREEN tail is [PASS], not [WARN] over an explanation of a redness that is gone", () => {
    // The state after someone burns the eslint backlog down. Flagging that
    // [WARN] trains the reader to ignore [WARN] -- the same habituation this
    // file removed from the exit code.
    const lines = ledger(LINKS.map((id) => ({ id, code: 0 })), { code: 0 }).join("\n");
    expect(lines).toContain("[PASS] " + TAIL);
    expect(lines).not.toContain("[WARN]");
    expect(lines).not.toContain("red on main");
  });

  it("the tail is SKIPPED behind a red link, and the ledger says so rather than going quiet", () => {
    // ~35s and ~290 lines of eslint between the failing guard remediation line
    // and the prompt buried the one thing the operator needs.
    const { calls, out } = run({ "check:image-widths": 1 });
    expect(calls).not.toContain(TAIL);
    expect(out).toContain("[SKIP] " + TAIL);
    expect(out).toContain("read that, not the eslint backlog");
  });
});

describe("exit codes keep the 0 / 1 / 2 convention every guard in the chain follows", () => {
  it("classify maps the three documented codes", () => {
    expect(classify(0)).toBe(PASS);
    expect(classify(1)).toBe(FAIL);
    expect(classify(2)).toBe(BROKEN);
  });

  it("an UNRECOGNISED code blocks rather than excusing itself", () => {
    // 127 (missing binary) and 3 are not in the convention. The safe direction
    // for a code this function has never seen is the one that fails the tier:
    // "I do not know what happened" is not evidence the tree is fine.
    expect(classify(127)).toBe(FAIL);
    expect(classify(3)).toBe(FAIL);
  });

  it("a link that could not be spawned at all is BROKEN, not a violation", () => {
    const { code } = run({ "check:rpc-typing": null });
    expect(code).toBe(2);
  });

  it("exit 2 is reported as 2, not collapsed into 1", () => {
    const { code } = run({ "check:mojibake": 2 });
    expect(code).toBe(2);
    const lines = ledger([{ id: "check:mojibake", code: 2 }]).join("\n");
    expect(lines).toContain("[BROKEN] check:mojibake");
    expect(lines).toContain("COULD NOT VOUCH");
  });

  it("a real violation OUTRANKS a broken guard", () => {
    const { code } = run({ "check:mojibake": 2, "check:image-widths": 1 });
    expect(code).toBe(1);
    expect(decideExit([{ id: "a", code: 2 }, { id: "b", code: 1 }])).toBe(1);
    expect(decideExit([{ id: "a", code: 1 }, { id: "b", code: 2 }])).toBe(1);
  });

  it("an all-green tier is 0", () => {
    expect(decideExit(LINKS.map((id) => ({ id, code: 0 })))).toBe(0);
  });
});

describe("LINKS is the chain, and package.json is still what each link INVOKES", () => {
  it('"lint" runs the runner and nothing else', () => {
    expect(pkg.scripts.lint).toBe("node scripts/run-lint-chain.mjs");
  });

  it("every link, and the tail, is a real npm script", () => {
    for (const id of [...LINKS, TAIL]) expect(Object.hasOwn(pkg.scripts, id), id).toBe(true);
  });

  it("the tail is whole-tree eslint", () => {
    expect(TAIL).toBe("lint:eslint");
    expect(pkg.scripts[TAIL]).toBe("eslint .");
  });

  it("no link is listed twice", () => {
    expect(new Set(LINKS).size).toBe(LINKS.length);
  });

  it("every canary in the chain sits immediately ahead of the check it proves", () => {
    // The pairing invariant, mechanical at last, and scoped to the chain BY
    // CONSTRUCTION: LINKS is the chain, so this cannot red on the guards that
    // live in other tiers (check:plan-hygiene, check:bundle-budget,
    // check:first-load-requests), which is what blocked writing it against
    // pre-ship's CHECKS -- there the band is delimited by a prose comment.
    const canaries = LINKS.filter((id) => id.endsWith(":self-test"));
    expect(canaries.length).toBeGreaterThan(0);
    for (const canary of canaries) {
      const check = canary.replace(/:self-test$/, "");
      expect(LINKS.indexOf(check), canary).toBe(LINKS.indexOf(canary) + 1);
    }
  });
});
