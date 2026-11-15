import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compute, parseLog, areaOf, render } from "../scripts/defect-escape.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DAY = 86400;
const NOW = 1_800_000_000;
const c = (subject: string, ageDays: number, ...files: string[]) => ({
  subject,
  ts: NOW - ageDays * DAY,
  files,
});

describe("defect-escape", () => {
  it("counts a fix landing within 7 days after a same-area non-fix (positive)", () => {
    const m = compute([c("Fix(ui): x", 1, "src/a.tsx"), c("feat: y", 4, "src/b.tsx")], NOW);
    expect(m).toMatchObject({ escaped: 1, merged: 2, subjects: ["Fix(ui): x"] });
    expect(m.rate).toBe(0.5);
  });

  it("does not count different area, stale prior, or fix-only priors (negative)", () => {
    expect(compute([c("fix: x", 1, "src/a.ts"), c("feat: y", 2, "scripts/b.mjs")], NOW).escaped).toBe(0);
    expect(compute([c("fix: x", 1, "src/a.ts"), c("feat: y", 9, "src/b.ts")], NOW).escaped).toBe(0);
    expect(compute([c("fix: x", 1, "src/a.ts"), c("revert: y", 2, "src/b.ts")], NOW).escaped).toBe(0);
  });

  it("handles hotfix/revert prefixes and ignores mid-subject fix", () => {
    const m = compute(
      [c("hotfix: a", 1, "src/a"), c("Revert \"b\"", 1, "src/a"), c("feat: prefix fix", 1, "src/a"), c("feat: p", 3, "src/z")],
      NOW
    );
    expect(m.escaped).toBe(2);
  });

  it("empty window gives zeros, and old fixes are outside the window", () => {
    expect(compute([], NOW)).toMatchObject({ escaped: 0, merged: 0, rate: 0 });
    expect(compute([c("fix: old", 8, "src/a"), c("feat: p", 9, "src/a")], NOW).merged).toBe(0);
  });

  it("parses git log output and maps areas", () => {
    const raw = "\x1e1800000000\tfix: a\n\nsrc/a.ts\nREADME.md\n\x1e1799999000\tfeat: b\n\n.github/x.yml\n";
    const p = parseLog(raw);
    expect(p).toHaveLength(2);
    expect(p[0]).toMatchObject({ subject: "fix: a", files: ["src/a.ts", "README.md"] });
    expect(areaOf("README.md")).toBe("other");
    expect(areaOf(".github/x.yml")).toBe(".github");
  });

  it("non-vacuity: a mutated fix parser fails the positive case", () => {
    const mutated = [c("chore: x", 1, "src/a.tsx"), c("feat: y", 4, "src/b.tsx")];
    expect(compute(mutated, NOW).escaped).toBe(0); // a non-fix subject must NOT count
    const real = [c("fix: x", 1, "src/a.tsx"), c("feat: y", 4, "src/b.tsx")];
    expect(compute(real, NOW).escaped).toBe(1);
  });

  it("caps the listed subjects at 10 and runs as a CLI", () => {
    const many = Array.from({ length: 12 }, (_, i) => c(`fix: n${i}`, 1, "src/a"));
    many.push(c("feat: p", 2, "src/a"));
    const md = render(compute(many, NOW));
    expect(md.match(/^- fix: n/gm)).toHaveLength(10);
    const r = spawnSync(process.execPath, [path.join(ROOT, "scripts/defect-escape.mjs"), "--markdown"], {
      cwd: ROOT,
      encoding: "utf8",
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/^## Defect escape/);
    expect(spawnSync(process.execPath, [path.join(ROOT, "scripts/defect-escape.mjs"), "--self-test"]).status).toBe(0);
  });
});
