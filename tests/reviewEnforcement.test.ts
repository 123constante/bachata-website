/**
 * reviewEnforcement.test.ts -- both-directions proof for the Website review
 * receipt + push gate (arc operating-model-v2, Phase 2).
 *
 * Every rule is proven SICK and HEALTHY. A gate that only ever passes is
 * indistinguishable from no gate at all, and this phase's whole claim is that an
 * unreviewed guard/CI diff physically cannot be pushed -- so the RED direction is
 * the load-bearing half of every case below.
 *
 * The last describe block asserts the WIRING (settings.json matcher, .gitignore
 * entries, the shell of .githooks/pre-push) rather than a pure function. Those are
 * the parts that cannot be unit-tested by calling them, and every one of them has
 * a silent failure mode: a hook that is never registered, a state file that sits
 * in every ship's scope, a shell script with CRLF line endings that /bin/sh
 * refuses to run.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { decide, strictSoftFromEnv, STRICT_SOFT_DEFAULT } from "../scripts/ship-gate.mjs";
import { runHook, isConfirmation, eofHint } from "../scripts/hooks/review-stamp.mjs";
import { REPO_ROOT, mergeReviewStamp, riskTier, TIER_EXEMPT } from "../scripts/lib/review-scope.mjs";

const HOUR = 3600 * 1000;
const NOW = Date.parse("2026-07-30T12:00:00Z");
const iso = (t: number) => new Date(t).toISOString();

type Stamp = {
  version?: number;
  timestamp?: string;
  session_id?: string | null;
  hashes?: Record<string, string>;
  deletions?: string[];
  findings?: unknown[];
};

function stampOf(over: Stamp = {}): Stamp {
  return {
    version: 1,
    timestamp: iso(NOW),
    session_id: "sess",
    hashes: {},
    deletions: [],
    findings: [],
    ...over,
  };
}

/** decide() with the fixed clock and every field defaulted to "nothing here". */
function verdict(over: Record<string, unknown> = {}) {
  return decide({
    scope: { hard: [], soft: [] },
    deleted: { hard: [], soft: [] },
    currentHashes: {},
    stamp: null,
    now: NOW,
    ...over,
  });
}

const joined = (lines: string[]) => lines.join(" | ");

describe("ship-gate decide() -- tier posture (the Website change vs admin)", () => {
  it("BLOCKS an unstamped HARD-tier file and names it", () => {
    const v = verdict({ scope: { hard: ["scripts/check-x.mjs"], soft: [] }, currentHashes: { "scripts/check-x.mjs": "HX" } });
    expect(v.code).toBe(1);
    expect(v.status).toBe("policy");
    expect(joined(v.reasons)).toContain("scripts/check-x.mjs");
    expect(joined(v.reasons)).toContain("no valid review stamp");
  });

  it("PASSES an unstamped SOFT-tier file, but says so out loud", () => {
    const v = verdict({ scope: { hard: [], soft: ["src/pages/Index.tsx"] }, currentHashes: { "src/pages/Index.tsx": "HI" } });
    expect(v.code).toBe(0);
    expect(v.status).toBe("green");
    expect(v.reasons).toHaveLength(1);
    expect(joined(v.warnings)).toContain("src/pages/Index.tsx");
  });

  it("a covered hard file plus an uncovered soft file is green with one warning", () => {
    const v = verdict({
      scope: { hard: ["scripts/check-x.mjs"], soft: ["src/App.tsx"] },
      currentHashes: { "scripts/check-x.mjs": "HX", "src/App.tsx": "HA" },
      stamp: stampOf({ hashes: { "scripts/check-x.mjs": "HX" } }),
    });
    expect(v.code).toBe(0);
    expect(v.warnings).toHaveLength(1);
    expect(joined(v.reasons)).toContain("1 of 2 risky file(s) covered");
  });

  it("everything covered is green with NO warnings", () => {
    const v = verdict({
      scope: { hard: ["scripts/check-x.mjs"], soft: ["src/App.tsx"] },
      currentHashes: { "scripts/check-x.mjs": "HX", "src/App.tsx": "HA" },
      stamp: stampOf({ hashes: { "scripts/check-x.mjs": "HX", "src/App.tsx": "HA" } }),
    });
    expect(v.code).toBe(0);
    expect(v.warnings).toEqual([]);
    expect(joined(v.reasons)).toContain("2 of 2 risky file(s) covered");
  });

  it("an empty scope with no stamp is green (a docs-only ship must not need a review receipt)", () => {
    const v = verdict();
    expect(v.code).toBe(0);
    expect(joined(v.reasons)).toContain("no risky files in ship scope");
  });
});

describe("ship-gate decide() -- the strict-soft toggle (both postures pinned)", () => {
  const input = {
    scope: { hard: [], soft: ["src/pages/Index.tsx"] },
    currentHashes: { "src/pages/Index.tsx": "HI" },
  };

  it("lenient (the shipped default) warns and passes", () => {
    const v = verdict({ ...input, strictSoft: false });
    expect(v.code).toBe(0);
    expect(v.warnings).toHaveLength(1);
    expect(v.reasons).not.toContain("src/pages/Index.tsx");
  });

  it("strict blocks the SAME input -- flipping the default is a one-line change", () => {
    const v = verdict({ ...input, strictSoft: true });
    expect(v.code).toBe(1);
    expect(joined(v.reasons)).toContain("src/pages/Index.tsx");
    expect(v.warnings).toEqual([]);
  });

  it("the toggle never weakens the HARD tier", () => {
    const hard = { scope: { hard: ["bin/check-integrity.sh"], soft: [] }, currentHashes: { "bin/check-integrity.sh": "HB" } };
    expect(verdict({ ...hard, strictSoft: false }).code).toBe(1);
    expect(verdict({ ...hard, strictSoft: true }).code).toBe(1);
  });

  it("the shipped default is lenient, and the verdict reports which posture ran", () => {
    expect(STRICT_SOFT_DEFAULT).toBe(false);
    expect(verdict({ strictSoft: true }).strictSoft).toBe(true);
    expect(verdict({ strictSoft: false }).strictSoft).toBe(false);
  });
});

describe("strictSoftFromEnv -- both directions reachable from the environment", () => {
  it("absent or blank falls back to the shipped default", () => {
    expect(strictSoftFromEnv({})).toBe(STRICT_SOFT_DEFAULT);
    expect(strictSoftFromEnv({ SHIP_GATE_STRICT_SOFT: "" })).toBe(STRICT_SOFT_DEFAULT);
    expect(strictSoftFromEnv({ SHIP_GATE_STRICT_SOFT: "   " })).toBe(STRICT_SOFT_DEFAULT);
  });

  it("affirmatives turn it on", () => {
    for (const v of ["1", "true", "TRUE", "yes", "on"]) {
      expect(strictSoftFromEnv({ SHIP_GATE_STRICT_SOFT: v })).toBe(true);
    }
  });

  it("negatives turn it off (so lenient stays reachable after the default flips)", () => {
    for (const v of ["0", "false", "no", "off"]) {
      expect(strictSoftFromEnv({ SHIP_GATE_STRICT_SOFT: v })).toBe(false);
    }
  });

  it("an unrecognised value is the default, not an accidental flip", () => {
    expect(strictSoftFromEnv({ SHIP_GATE_STRICT_SOFT: "maybe" })).toBe(STRICT_SOFT_DEFAULT);
  });
});

describe("ship-gate decide() -- content-hash identity", () => {
  it("BLOCKS a hard file edited after the review", () => {
    const v = verdict({
      scope: { hard: ["scripts/check-x.mjs"], soft: [] },
      currentHashes: { "scripts/check-x.mjs": "HX2" },
      stamp: stampOf({ hashes: { "scripts/check-x.mjs": "HX" } }),
    });
    expect(v.code).toBe(1);
    expect(joined(v.reasons)).toContain("changed after review");
  });

  it("a byte-identical RENAME stays green (identity is the hash, not the path)", () => {
    const v = verdict({
      scope: { hard: ["scripts/checks/check-x.mjs"], soft: [] },
      currentHashes: { "scripts/checks/check-x.mjs": "HX" },
      stamp: stampOf({ hashes: { "scripts/check-x.mjs": "HX" } }),
      renames: [{ from: "scripts/check-x.mjs", to: "scripts/checks/check-x.mjs" }],
    });
    expect(v.code).toBe(0);
  });

  it("a NEW path whose bytes collide with a reviewed file is NOT covered", () => {
    // The hole this closes: coverage was decided against a pooled Set of every
    // stamped hash VALUE with the rel keys discarded, so a brand-new workflow file
    // byte-identical to a reviewed check script read as reviewed. No rename links
    // these two paths, so the proxy must not apply.
    const v = verdict({
      scope: { hard: [".github/workflows/deploy.yml"], soft: [] },
      currentHashes: { ".github/workflows/deploy.yml": "HX" },
      stamp: stampOf({ hashes: { "scripts/check-x.mjs": "HX" } }),
      renames: [],
    });
    expect(v.code).toBe(1);
    expect(joined(v.reasons)).toContain("was never reviewed");
  });

  it("a rename whose content ALSO changed is not covered by its source", () => {
    const v = verdict({
      scope: { hard: ["scripts/checks/check-x.mjs"], soft: [] },
      currentHashes: { "scripts/checks/check-x.mjs": "HX2" },
      stamp: stampOf({ hashes: { "scripts/check-x.mjs": "HX" } }),
      renames: [{ from: "scripts/check-x.mjs", to: "scripts/checks/check-x.mjs" }],
    });
    expect(v.code).toBe(1);
  });

  it("a path IN the stamp is compared to its OWN entry, not to the pool", () => {
    const v = verdict({
      scope: { hard: ["scripts/check-a.mjs"], soft: [] },
      // check-a drifted to what check-b was reviewed at. Pooled matching called
      // that covered; per-path matching calls it what it is.
      currentHashes: { "scripts/check-a.mjs": "HB" },
      stamp: stampOf({ hashes: { "scripts/check-a.mjs": "HA", "scripts/check-b.mjs": "HB" } }),
    });
    expect(v.code).toBe(1);
    expect(joined(v.reasons)).toContain("changed after review");
  });

  it("an UNHASHABLE hard path fails CLOSED, not open", () => {
    const v = verdict({
      scope: { hard: ["scripts/newdir"], soft: [] },
      currentHashes: { "scripts/newdir": null },
      stamp: stampOf({ hashes: { "scripts/newdir": "HD" } }),
    });
    expect(v.code).toBe(1);
    expect(joined(v.reasons)).toContain("could not be hashed");
  });

  it("an unhashable SOFT path warns rather than blocks (tier posture still applies)", () => {
    const v = verdict({ scope: { hard: [], soft: ["src/newdir"] }, currentHashes: { "src/newdir": null } });
    expect(v.code).toBe(0);
    expect(joined(v.warnings)).toContain("could not be hashed");
  });
});

describe("ship-gate decide() -- stamp freshness", () => {
  const scope = { hard: ["scripts/check-x.mjs"], soft: [] };
  const currentHashes = { "scripts/check-x.mjs": "HX" };
  const hashes = { "scripts/check-x.mjs": "HX" };

  it("23h old still covers", () => {
    const v = verdict({ scope, currentHashes, stamp: stampOf({ hashes, timestamp: iso(NOW - 23 * HOUR) }) });
    expect(v.code).toBe(0);
  });

  it("25h old BLOCKS and prints the age", () => {
    const v = verdict({ scope, currentHashes, stamp: stampOf({ hashes, timestamp: iso(NOW - 25 * HOUR) }) });
    expect(v.code).toBe(1);
    expect(joined(v.reasons)).toContain("25.0h old");
  });

  it("a FUTURE-dated stamp BLOCKS (a hand-edited timestamp must not disable the window)", () => {
    const v = verdict({ scope, currentHashes, stamp: stampOf({ hashes, timestamp: "2099-01-01T00:00:00Z" }) });
    expect(v.code).toBe(1);
  });

  it("an unparseable timestamp BLOCKS and says so", () => {
    const v = verdict({ scope, currentHashes, stamp: stampOf({ hashes, timestamp: "not-a-date" }) });
    expect(v.code).toBe(1);
    expect(joined(v.reasons)).toContain("no parseable timestamp");
  });
});

describe("ship-gate decide() -- findings block regardless of tier or scope", () => {
  const confirmed = [{ verdict: "CONFIRMED", short_summary: "fail-open in the ratchet" }];

  it("an unresolved CONFIRMED finding blocks even with NOTHING risky in scope", () => {
    const v = verdict({ stamp: stampOf({ findings: confirmed }) });
    expect(v.code).toBe(1);
    expect(joined(v.reasons)).toContain("fail-open in the ratchet");
  });

  it("an unresolved finding blocks a soft-only ship under the LENIENT posture", () => {
    const v = verdict({
      scope: { hard: [], soft: ["src/App.tsx"] },
      currentHashes: { "src/App.tsx": "HA" },
      stamp: stampOf({ hashes: { "src/App.tsx": "HA" }, findings: confirmed }),
      strictSoft: false,
    });
    expect(v.code).toBe(1);
  });

  it("outcome fixed clears it", () => {
    const v = verdict({ stamp: stampOf({ findings: [{ verdict: "CONFIRMED", short_summary: "x", outcome: "fixed" }] }) });
    expect(v.code).toBe(0);
  });

  it("a finding with NO verdict blocks (inline-only review = unverified, not absolved)", () => {
    const v = verdict({ stamp: stampOf({ findings: [{ short_summary: "no verdict field" }] }) });
    expect(v.code).toBe(1);
    expect(joined(v.reasons)).toContain("no verdict field");
  });

  it("PLAUSIBLE does not block", () => {
    const v = verdict({ stamp: stampOf({ findings: [{ verdict: "PLAUSIBLE", short_summary: "maybe" }] }) });
    expect(v.code).toBe(0);
  });
});

describe("ship-gate decide() -- DELETIONS (path identity, because there are no bytes)", () => {
  it("BLOCKS a hard-tier deletion the stamp does not record", () => {
    const v = verdict({
      deleted: { hard: [".github/workflows/db-contract-check.yml"], soft: [] },
      stamp: stampOf({ hashes: { "scripts/check-x.mjs": "HX" } }),
    });
    expect(v.code).toBe(1);
    expect(joined(v.reasons)).toContain("(DELETED)");
    expect(joined(v.reasons)).toContain("records no such deletion");
  });

  it("PASSES the same deletion once the stamp records it", () => {
    const v = verdict({
      deleted: { hard: [".github/workflows/db-contract-check.yml"], soft: [] },
      stamp: stampOf({ deletions: [".github/workflows/db-contract-check.yml"] }),
    });
    expect(v.code).toBe(0);
    expect(joined(v.reasons)).toContain("1 of 1 risky file(s) covered");
  });

  it("a recorded deletion on a STALE stamp still blocks", () => {
    const v = verdict({
      deleted: { hard: [".githooks/pre-push"], soft: [] },
      stamp: stampOf({ deletions: [".githooks/pre-push"], timestamp: iso(NOW - 30 * HOUR) }),
    });
    expect(v.code).toBe(1);
  });

  it("a deleted SOFT file warns under lenient and blocks under strict", () => {
    const input = { deleted: { hard: [], soft: ["src/pages/Gone.tsx"] }, stamp: stampOf() };
    expect(verdict({ ...input, strictSoft: false }).code).toBe(0);
    expect(joined(verdict({ ...input, strictSoft: false }).warnings)).toContain("src/pages/Gone.tsx");
    expect(verdict({ ...input, strictSoft: true }).code).toBe(1);
  });

  it("a Windows-style stamped deletion still matches the POSIX scope path", () => {
    const v = verdict({
      deleted: { hard: ["scripts/check-x.mjs"], soft: [] },
      stamp: stampOf({ deletions: ["scripts\\check-x.mjs"] }),
    });
    expect(v.code).toBe(0);
  });

  it("a non-array deletions field cannot crash the gate, and covers nothing", () => {
    const v = verdict({
      deleted: { hard: ["scripts/check-x.mjs"], soft: [] },
      stamp: stampOf({ deletions: 7 as unknown as string[] }),
    });
    expect(v.code).toBe(1);
  });
});

describe("ship-gate decide() -- the stamp-absent label is caller-supplied", () => {
  it("run() can distinguish CORRUPT from MISSING without a post-hoc string replace", () => {
    const v = verdict({
      scope: { hard: ["scripts/check-x.mjs"], soft: [] },
      currentHashes: { "scripts/check-x.mjs": "HX" },
      stampAbsentLabel: "the review stamp is present but CORRUPT (treated as missing)",
    });
    expect(v.code).toBe(1);
    expect(joined(v.reasons)).toContain("present but CORRUPT");
    expect(joined(v.reasons)).not.toContain("run /code-review");
  });
});

describe("mergeReviewStamp -- the deletions half (Phase 2 extension)", () => {
  const nowIso = iso(NOW);

  it("records this review's deletions, sorted and de-duplicated", () => {
    const s = mergeReviewStamp(null, {
      hashes: {},
      deletions: ["scripts/b.mjs", "scripts/a.mjs", "scripts/b.mjs"],
      findings: [],
      nowIso,
      now: NOW,
    });
    expect(s.deletions).toEqual(["scripts/a.mjs", "scripts/b.mjs"]);
  });

  it("always emits an array, even when nothing was deleted", () => {
    const s = mergeReviewStamp(null, { hashes: {}, findings: [], nowIso, now: NOW });
    expect(s.deletions).toEqual([]);
  });

  it("CARRIES a fresh clean prior deletion forward (an incremental review need not re-see it)", () => {
    const prev = stampOf({ deletions: ["scripts/gone.mjs"], hashes: { "scripts/a.mjs": "HA" } });
    const s = mergeReviewStamp(prev, { hashes: {}, deletions: ["scripts/also-gone.mjs"], findings: [], nowIso, now: NOW });
    expect(s.deletions).toEqual(["scripts/also-gone.mjs", "scripts/gone.mjs"]);
  });

  it("DROPS a stale prior deletion (same gate as hashes)", () => {
    const prev = stampOf({ deletions: ["scripts/gone.mjs"], hashes: { "scripts/a.mjs": "HA" }, timestamp: iso(NOW - 25 * HOUR) });
    const s = mergeReviewStamp(prev, { hashes: {}, deletions: [], findings: [], nowIso, now: NOW });
    expect(s.deletions).toEqual([]);
  });

  it("DROPS a prior deletion carried by a stamp with an unresolved blocking finding", () => {
    const prev = stampOf({
      deletions: ["scripts/gone.mjs"],
      hashes: { "scripts/a.mjs": "HA" },
      findings: [{ verdict: "CONFIRMED", short_summary: "unfixed" }],
    });
    const s = mergeReviewStamp(prev, { hashes: {}, deletions: [], findings: [], nowIso, now: NOW });
    expect(s.deletions).toEqual([]);
  });

  it("normalises carried and new paths to POSIX", () => {
    const prev = stampOf({ deletions: ["scripts\\old.mjs"], hashes: { "a.mjs": "HA" } });
    const s = mergeReviewStamp(prev, { hashes: {}, deletions: ["scripts\\new.mjs"], findings: [], nowIso, now: NOW });
    expect(s.deletions).toEqual(["scripts/new.mjs", "scripts/old.mjs"]);
  });

  it("PRUNES a carried deletion whose file is back on disk", () => {
    // hashes self-correct because new content wins on drift; deletions had no
    // equivalent, so a path deleted, reviewed, then RESTORED rode forward across a
    // chain of sub-24h mints -- and cleared a second, unreviewed deletion of the
    // same path later that day.
    const prev = stampOf({ deletions: ["scripts/gone.mjs"], hashes: { "a.mjs": "HA" } });
    const s = mergeReviewStamp(prev, {
      hashes: {},
      deletions: [],
      findings: [],
      nowIso,
      now: NOW,
      exists: (rel: string) => rel === "scripts/gone.mjs", // it is back
    });
    expect(s.deletions).toEqual([]);
  });

  it("KEEPS a carried deletion whose file is still gone", () => {
    const prev = stampOf({ deletions: ["scripts/gone.mjs"], hashes: { "a.mjs": "HA" } });
    const s = mergeReviewStamp(prev, {
      hashes: {},
      deletions: [],
      findings: [],
      nowIso,
      now: NOW,
      exists: () => false,
    });
    expect(s.deletions).toEqual(["scripts/gone.mjs"]);
  });

  it("a non-array deletions argument degrades to empty instead of throwing", () => {
    const s = mergeReviewStamp(null, { hashes: {}, deletions: "scripts/x.mjs" as unknown as string[], findings: [], nowIso, now: NOW });
    expect(s.deletions).toEqual([]);
  });
});

describe("review-stamp runHook -- the self-mint guard", () => {
  type WriteArg = { sessionId: string | null; findings: unknown[] };

  function spyWrite() {
    const calls: WriteArg[] = [];
    const write = (arg: WriteArg) => {
      calls.push(arg);
      return { hashes: { "scripts/a.mjs": "HA" }, deletions: [], findings: arg.findings };
    };
    return { calls, write };
  }

  it("REFUSES to mint on empty stdin (the documented footgun)", () => {
    const { calls, write } = spyWrite();
    const r = runHook({ readInput: () => "", write });
    expect(r.minted).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("REFUSES on whitespace-only stdin", () => {
    const { calls, write } = spyWrite();
    expect(runHook({ readInput: () => "  \n\t ", write }).minted).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("MINTS on a real ReportFindings payload, carrying the findings and session id", () => {
    const { calls, write } = spyWrite();
    const payload = JSON.stringify({
      session_id: "abc123",
      tool_input: { findings: [{ verdict: "CONFIRMED", short_summary: "leak" }] },
    });
    expect(runHook({ readInput: () => payload, write }).minted).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].sessionId).toBe("abc123");
    expect(calls[0].findings).toHaveLength(1);
  });

  it("MINTS a clean receipt for a zero-findings review", () => {
    const { calls, write } = spyWrite();
    expect(runHook({ readInput: () => JSON.stringify({ tool_input: { findings: [] } }), write }).minted).toBe(true);
    expect(calls[0].findings).toEqual([]);
  });

  it("coerces a non-array findings payload to empty rather than throwing", () => {
    const { calls, write } = spyWrite();
    expect(runHook({ readInput: () => JSON.stringify({ tool_input: { findings: "nope" } }), write }).minted).toBe(true);
    expect(calls[0].findings).toEqual([]);
  });

  it("non-JSON but non-empty stdin still mints (a real fire is indistinguishable from piped JSON)", () => {
    const { calls, write } = spyWrite();
    expect(runHook({ readInput: () => "not json at all", write }).minted).toBe(true);
    expect(calls[0].findings).toEqual([]);
  });

  it("FAILS OPEN AND LOUD when the writer throws -- a review must never be broken by the receipt", () => {
    const boom = () => {
      throw new Error("disk on fire");
    };
    let r: { minted: boolean; code: number } | undefined;
    expect(() => {
      r = runHook({ readInput: () => "{}", write: boom });
    }).not.toThrow();
    expect(r?.minted).toBe(false);
    // The soft exit is the RETURNED code. Asserting process.exitCode here was
    // tautological: runHook used to set it to 0 in a finally one statement earlier,
    // so the assertion held whether or not the fail-open worked.
    expect(r?.code).toBe(0);
  });

  it("every path returns code 0, and NONE of them touches process.exitCode", () => {
    const { write } = spyWrite();
    const before = process.exitCode;
    try {
      process.exitCode = 7; // a value only this test would ever set
      const results = [
        runHook({ readInput: () => "", write }),
        runHook({ readInput: () => JSON.stringify({ tool_input: { findings: [] } }), write }),
        runHook({
          readInput: () => "{}",
          write: () => {
            throw new Error("nope");
          },
        }),
      ];
      for (const r of results) expect(r.code).toBe(0);
      // If runHook still wrote process.exitCode, this would be 0 and the vitest
      // worker's own exit code would have been clobbered as a side effect.
      expect(process.exitCode).toBe(7);
    } finally {
      process.exitCode = before;
    }
  });
});

describe("--manual confirmation -- the EOF keystroke lands IN the input", () => {
  // 0x04 is what Ctrl-D produces on Windows (it is NOT end-of-file there); 0x1a is
  // Ctrl-Z, which IS. Both arrive as characters in the buffer, and String.trim()
  // removes whitespace but not control characters -- so `raw.trim() === "CONFIRM"`
  // rejected a correctly-typed confirmation with no clue as to why. Observed live
  // on PowerShell, twice, before this was fixed.
  const CTRL_D = String.fromCharCode(4);
  const CTRL_Z = String.fromCharCode(26);

  it("accepts the two sequences that actually failed on PowerShell", () => {
    expect(isConfirmation("CONFIRM\n" + CTRL_D + "\n" + CTRL_Z + "\n")).toBe(true);
    expect(isConfirmation("CONFIRM\n\n" + CTRL_D + "\n\n\n" + CTRL_Z + "\n")).toBe(true);
  });

  it("accepts the plain and CRLF forms", () => {
    expect(isConfirmation("CONFIRM")).toBe(true);
    expect(isConfirmation("CONFIRM\r\n" + CTRL_Z + "\r\n")).toBe(true);
    expect(isConfirmation("   CONFIRM   \n")).toBe(true);
  });

  it("still REFUSES anything that is not the word", () => {
    for (const raw of ["confirm", "CONFIRMED", "CONFIRM ME", "no", "", "  ", "yes\nok\n"]) {
      expect(isConfirmation(raw), JSON.stringify(raw)).toBe(false);
    }
  });

  it("does not throw on null or undefined input", () => {
    expect(isConfirmation(null as unknown as string)).toBe(false);
    expect(isConfirmation(undefined as unknown as string)).toBe(false);
  });

  it("prints the EOF keystroke that the operator's platform actually uses", () => {
    expect(eofHint("win32")).toContain("Ctrl-Z");
    expect(eofHint("linux")).toContain("Ctrl-D");
    expect(eofHint("darwin")).toContain("Ctrl-D");
    // and the hint the prompt prints is the one for THIS platform
    const src = fs.readFileSync(path.join(REPO_ROOT, "scripts", "hooks", "review-stamp.mjs"), "utf8");
    expect(src).toContain("eofHint()");
  });
});

describe("Phase 2 WIRING -- the parts that fail silently if never registered", () => {
  const read = (rel: string) => fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");

  it("settings.json registers the ReportFindings mint AND keeps the Edit|Write hook", () => {
    const settings = JSON.parse(read(".claude/settings.json"));
    const post = settings.hooks.PostToolUse as Array<{ matcher: string; hooks: Array<{ command: string }> }>;
    const matchers = post.map((e) => e.matcher);
    expect(matchers).toContain("ReportFindings");
    expect(matchers).toContain("Edit|Write");
    const mint = post.find((e) => e.matcher === "ReportFindings");
    expect(mint?.hooks[0].command).toContain("scripts/hooks/review-stamp.mjs");
  });

  it("the two self-referential state files are gitignored", () => {
    const ignored = read(".gitignore");
    for (const rel of ["/.claude/.review-stamp.json", "/.claude/.session-lock.json"]) {
      expect(ignored).toContain(rel);
    }
  });

  it("arc-state.json is EXEMPT from the tier but NOT hidden from git", () => {
    // Exempting it stops it gating itself; ignoring it would also stop it being
    // reviewable -- and it carries the declared-scope array that can disarm
    // pre-ship's fatal drift check, so an untracked copy means widening that array
    // never appears in a diff and resolveDeclaredScope() silently returns "none" on
    // CI and in every fresh clone.
    expect(read(".gitignore")).not.toContain("/.claude/arc-state.json");
    expect(riskTier(".claude/arc-state.json")).toBeNull();
    expect(TIER_EXEMPT.some((re: RegExp) => re.test(".claude/arc-state.json"))).toBe(true);
    // ...and the exemption is narrow: a sibling under .claude/ is still hard-tier.
    expect(riskTier(".claude/hooks/pre-write-block.sh")).toBe("hard");
    expect(riskTier(".claude/settings.json")).toBe("hard");
  });

  it("a MISSING ship-gate.mjs is a hard failure in pre-push, never a silent skip", () => {
    // The first form wrapped step 2 in `if [ -f ... ]`, so the one ship that most
    // needs gating -- the one deleting or moving the gate -- turned it off silently.
    const hook = read(".githooks/pre-push");
    expect(hook).toContain('if [ ! -f "$REPO_ROOT/scripts/ship-gate.mjs" ]');
    const missing = hook.slice(hook.indexOf('if [ ! -f "$REPO_ROOT/scripts/ship-gate.mjs" ]'));
    expect(missing.slice(0, missing.indexOf("fi"))).toContain("exit 1");
  });

  it("pre-push refuses a pushed ref it cannot scope, and says how to proceed", () => {
    const hook = read(".githooks/pre-push");
    expect(hook).toContain("$local_sha\" != \"$HEAD_SHA");
    expect(hook).toContain("SHIP_GATE_ALLOW_UNSCOPED_REF");
    // tags are exempt: an annotated tag's sha is the tag object, never HEAD
    expect(hook).toContain("refs/tags/*) continue ;;");
    const block = hook.slice(hook.indexOf('if [ -n "$unscoped" ]'));
    expect(block.slice(0, block.indexOf("fi"))).toContain("exit 1");
  });

  it("pre-push early-exits on a deletion-only push, runs the unit gate, then the ship gate", () => {
    const hook = read(".githooks/pre-push");
    expect(hook).toContain("*[!0]*"); // the all-zero local sha test
    expect(hook).toContain("npm run test:unit");
    expect(hook).toContain("scripts/ship-gate.mjs");
    // the ORDER matters: triage before the unit suite, or a deletion push pays for
    // it. Anchor on the EXECUTABLE lines, not the bare names -- the header docblock
    // mentions both steps, so indexOf on a plain name finds the COMMENT and the
    // ordering assertion then passes however the script is actually sequenced.
    // (That is not hypothetical: this assertion was written the naive way first and
    // failed on its own docblock.)
    const triage = hook.indexOf("*[!0]*");
    const unit = hook.indexOf("if ! npm run test:unit");
    const gate = hook.indexOf("$REPO_ROOT/scripts/ship-gate.mjs");
    expect(triage).toBeGreaterThan(-1);
    expect(unit).toBeGreaterThan(-1);
    expect(gate).toBeGreaterThan(-1);
    expect(triage).toBeLessThan(unit);
    expect(unit).toBeLessThan(gate);
  });

  it("pre-push blocks on gate exit 1 and only WARNS on exit 2 (infra is not policy)", () => {
    const hook = read(".githooks/pre-push");
    // Slice from the NODE INVOCATION, not from the bare script name: the header
    // docblock names the gate first, so slicing there swept in step 1's own
    // `exit 1` and the assertion passed even with the review gate's exit deleted.
    // A control mutation caught exactly that, which is the whole point of running
    // them -- this assertion was inert on its first draft.
    const block = hook.slice(hook.indexOf('node "$REPO_ROOT/scripts/ship-gate.mjs"'));
    const rc1 = block.indexOf('"$rc" -eq 1');
    const rc2 = block.indexOf('"$rc" -eq 2');
    expect(rc1).toBeGreaterThan(-1);
    expect(rc2).toBeGreaterThan(rc1);
    // exit 1 must live INSIDE the rc==1 branch...
    expect(block.slice(rc1, rc2)).toContain("exit 1");
    // ...and the infra branch must not block at all.
    expect(block.slice(rc2)).not.toContain("exit 1");
  });

  it("pre-push is LF-only -- CRLF would make /bin/sh refuse to run it", () => {
    const raw = fs.readFileSync(path.join(REPO_ROOT, ".githooks", "pre-push"));
    expect(raw.includes("\r\n")).toBe(false);
  });
});
