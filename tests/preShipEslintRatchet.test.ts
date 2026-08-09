import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { decideEslintRatchet, eslintBaseCounts, parseEslintJson } from "../scripts/pre-ship.mjs";

describe("decideEslintRatchet", () => {
  it("passes a file whose pre-existing errors are unchanged", () => {
    // The case that blocked the dancer-profile ship: touched a legacy file,
    // introduced nothing, and the absolute gate failed anyway.
    expect(decideEslintRatchet({ now: { "a.ts": 5 }, base: { "a.ts": 5 } }).ok).toBe(true);
  });

  it("passes, and reports, a file that REMOVED a pre-existing error", () => {
    const v = decideEslintRatchet({ now: { "a.ts": 4 }, base: { "a.ts": 5 } });
    expect(v.ok).toBe(true);
    expect(v.improved).toBe(1);
  });

  it("BLOCKS a file that gained one error", () => {
    const v = decideEslintRatchet({ now: { "a.ts": 6 }, base: { "a.ts": 5 } });
    expect(v.ok).toBe(false);
    expect(v.regressions).toEqual([{ file: "a.ts", was: 5, now: 6 }]);
  });

  it("BLOCKS any error in a file the base ref does not contain", () => {
    // A new file has no debt to inherit, so eslintBaseCounts hands it a real
    // baseline of 0 -- and it reads as a regression, not as an unknown.
    const v = decideEslintRatchet({ now: { "new.ts": 1 }, base: { "new.ts": 0 } });
    expect(v.ok).toBe(false);
    expect(v.regressions).toEqual([{ file: "new.ts", was: 0, now: 1 }]);
    expect(v.unmeasured).toEqual([]);
  });

  it("does not let one file's improvement pay for another's regression", () => {
    const v = decideEslintRatchet({ now: { "a.ts": 0, "b.ts": 3 }, base: { "a.ts": 5, "b.ts": 2 } });
    expect(v.ok).toBe(false);
    expect(v.regressions.map((r) => r.file)).toEqual(["b.ts"]);
  });

  it("BLOCKS when a baseline could not be measured, and names the file", () => {
    // The direction the first cut got backwards. An unmeasurable baseline was
    // recorded as Infinity, which no finite count can ever exceed -- so the file
    // became permanently ungateable and the gate reported PASS.
    const v = decideEslintRatchet({ now: { "a.ts": 5 }, base: { "a.ts": null } });
    expect(v.ok).toBe(false);
    expect(v.unmeasured).toEqual(["a.ts"]);
    expect(v.regressions).toEqual([]);
  });

  it("still BLOCKS on a literal Infinity baseline", () => {
    // Guards the exact prior defect, not only its replacement: 0 -> 500 errors
    // used to return ok:true through this door.
    const v = decideEslintRatchet({ now: { "a.ts": 500 }, base: { "a.ts": Infinity } });
    expect(v.ok).toBe(false);
    expect(v.unmeasured).toEqual(["a.ts"]);
  });

  it("never counts an unmeasurable baseline as an improvement", () => {
    // Infinity - 5 = Infinity, which printed the literal ledger line
    // "Infinity pre-existing error(s) removed" at the moment measurement failed.
    const v = decideEslintRatchet({ now: { "a.ts": 5 }, base: { "a.ts": Infinity } });
    expect(v.improved).toBe(0);
    expect(Number.isFinite(v.improved)).toBe(true);
  });

  it("BLOCKS a file the base map never mentions, rather than assuming zero", () => {
    // eslintBaseCounts populates every key it is asked about, so a missing one
    // means the caller and the measurer disagree about the file list. Fail safe.
    const v = decideEslintRatchet({ now: { "a.ts": 5 }, base: {} });
    expect(v.ok).toBe(false);
    expect(v.unmeasured).toEqual(["a.ts"]);
  });

  it("passes cleanly when every baseline is measured and nothing grew", () => {
    const v = decideEslintRatchet({ now: { "a.ts": 5, "b.ts": 2 }, base: { "a.ts": 5, "b.ts": 3 } });
    expect(v).toEqual({ ok: true, regressions: [], unmeasured: [], improved: 1 });
  });
});

describe("eslintBaseCounts", () => {
  // HEAD, never HEAD~1: CI clones shallow (fetch-depth 1), so `git rev-parse
  // HEAD~1` is fatal there. Both assertions below hold on a single-commit clone,
  // and neither is weakened by it -- merge-base(HEAD, HEAD) is still a resolved
  // sha, which is the whole discriminator.
  const revParse = (ref: string) => execFileSync("git", ["rev-parse", ref], { encoding: "utf8" }).trim();

  it("measures against the MERGE BASE, not the tip of the given ref", () => {
    // shipFiles() diffs against merge-base(base, HEAD); reading baselines from
    // the TIP compared the two halves of one ratchet at different commits, so a
    // cleanup landing on the base branch after your cut read as YOUR regression.
    // The SYMBOLIC ref surviving to the output is what a missing diffOrigin()
    // looks like, so a resolved sha is proof it ran.
    expect(eslintBaseCounts([], "HEAD").rev).toBe(revParse("HEAD"));
  });

  it("baselines a path absent from the base tree at zero, not unknown", () => {
    const { counts } = eslintBaseCounts(["src/this/path/never/existed.ts"], "HEAD");
    expect(counts["src/this/path/never/existed.ts"]).toBe(0);
  });

  it("reports every baseline as unmeasured when the base ref itself is unreadable", () => {
    // The case that used to baseline EVERY file at zero -- an unfetched
    // origin/main, a shallow clone, a stale REVIEW_SCOPE_BASE -- turning all
    // pre-existing debt into regressions and leaving --no-verify as the way out.
    const { counts } = eslintBaseCounts(["src/a.ts", "src/b.ts"], "refs/heads/definitely-not-a-real-ref");
    expect(counts).toEqual({ "src/a.ts": null, "src/b.ts": null });
  });
});

describe("parseEslintJson", () => {
  it("sums errorCount per file and ignores warnings", () => {
    const text = JSON.stringify([
      { filePath: "/repo/src/a.ts", errorCount: 2, warningCount: 9 },
      { filePath: "/repo/src/b.ts", errorCount: 0, warningCount: 1 },
    ]);
    expect(parseEslintJson(text, "/repo")).toEqual({ "src/a.ts": 2, "src/b.ts": 0 });
  });

  it("returns null on unparseable output rather than an empty pass", () => {
    // The dangerous direction: a crashed eslint must never read as "no errors".
    expect(parseEslintJson("Oops! Something went wrong")).toBeNull();
    expect(parseEslintJson('{"not":"an array"}')).toBeNull();
  });
});
