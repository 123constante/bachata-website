/**
 * reviewScope.test.ts -- both-directions proof for the Website ship-gate
 * primitives (arc operating-model-v2, Phase 1).
 *
 * Every guard here is proven SICK and HEALTHY. A gate that only ever passes is
 * indistinguishable from no gate at all, which is the exact failure class this
 * phase exists to close.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  REPO_ROOT,
  riskTier,
  isRiskyPath,
  toPosix,
  hashContent,
  unquoteGitPath,
  shipFiles,
  riskyFilesInScope,
  deletedRiskyFiles,
  diffOrigin,
  pickShipBase,
  resolveShipBase,
  TRUNK_BASE,
  blocksTheShip,
  DECLARED_ALWAYS_EXEMPT,
  classifySurface,
  globToRegExp,
  matchesDeclared,
  resolveDeclaredScope,
  scopeDrift,
  stampCoversHash,
  stampIsFresh,
  mergeReviewStamp,
  unresolvedConfirmedReasons,
} from "../scripts/lib/review-scope.mjs";
import {
  CHECKS,
  APP_PATHS,
  ESLINT_EXTS,
  TYPECHECK_BASELINE,
  decideSmoke,
  decideEslint,
  decideTypecheck,
  countTscErrors,
  hasConfigLevelTscError,
} from "../scripts/pre-ship.mjs";

const BS = String.fromCharCode(92); // a literal backslash
const iso = (ms: number) => new Date(ms).toISOString();

describe("riskTier -- two tiers and a genuine null", () => {
  it("HARD: the whole guard / CI / hook surface, by directory", () => {
    for (const p of [
      "scripts/check-venue-contract.mjs",
      "scripts/check-seo.mjs",
      "scripts/hooks/review-stamp.mjs",
      "scripts/lib/review-scope.mjs",
      "scripts/pre-ship.mjs",
      "scripts/ship-gate.mjs",
      ".github/workflows/db-contract-check.yml",
      "bin/check-integrity.sh",
      ".githooks/pre-push",
      ".claude/hooks/pre-write-block.sh",
      // the files a per-file allowlist had already missed:
      "scripts/safe-write.py",
      "scripts/safe-edit.py",
      "scripts/lint-runtime-architecture.mjs",
      "scripts/lib/previewProbe.mjs",
      // .claude/arc-state.json used to be here; Phase 2 moved it to TIER_EXEMPT
      // (tracked and reviewable, but no longer gating itself) -- see the EXEMPT
      // case below for why, and why gitignoring it was the wrong fix.
      ".claude/settings.json",
      ".github/dependabot.yml",
    ]) {
      expect(riskTier(p), p).toBe("hard");
    }
  });

  it("a scripts/ reorg cannot drop guards out of the hard tier", () => {
    // The old /^scripts.check-[^/]+$/ excluded anything nested, so moving the
    // check suite into scripts/checks/ would have silently un-tiered all of it.
    expect(riskTier("scripts/checks/check-seo.mjs")).toBe("hard");
    expect(riskTier("scripts/a/b/c/deeply-nested.mjs")).toBe("hard");
  });

  it("EXEMPT: the receipt, the session lock and arc-state are never tiered", () => {
    expect(riskTier(".claude/.review-stamp.json")).toBeNull();
    expect(riskTier(".claude/.session-lock.json")).toBeNull();
    /* arc-state.json JOINED the exemption in Phase 2, reversing this test's
     * original assertion, so the reasoning is recorded rather than just edited
     * away. Phase 1 made it hard-tier deliberately: its `scope` array can disarm
     * pre-ship's fatal drift check. But it is rewritten at every phase start, so it
     * sat in EVERY ship's risky scope and demanded a review of itself before any
     * push -- and a gate that is annoying to keep green stops being used. The
     * alternative on the table was to gitignore it, which fixes the annoyance by
     * making the file invisible: an edit widening `scope` would then appear in no
     * diff and need no receipt, and resolveDeclaredScope() would return "none" on
     * CI and in every fresh clone, silently downgrading DECLARED to the advisory
     * INFERRED heuristic. Exempting keeps it TRACKED and reviewable in the PR diff
     * while it stops gating itself; a receipt-level guard on the `scope` array
     * specifically is logged for the plan-hygiene phase. */
    expect(riskTier(".claude/arc-state.json")).toBeNull();
    // ...but the exemption is narrow -- other siblings under .claude/ are hard:
    expect(riskTier(".claude/settings.json")).toBe("hard");
    expect(riskTier(".claude/hooks/pre-write-block.sh")).toBe("hard");
  });

  it("SOFT: app code that deploys prod on merge", () => {
    for (const p of ["src/App.tsx", "src/modules/event-page/BentoPage.tsx", "api/embed/index.ts"]) {
      expect(riskTier(p), p).toBe("soft");
    }
  });

  it("NULL: everything else -- the tier predicate is not a catch-all", () => {
    for (const p of [
      "README.md",
      "CLAUDE.md",
      "package.json",
      "tests/reviewScope.test.ts",
      "public/favicon.ico",
      "tsconfig.json",
      "",
    ]) {
      expect(riskTier(p), p).toBeNull();
      expect(isRiskyPath(p), p).toBe(false);
    }
  });

  it("a Windows-separator path classifies the same as its POSIX twin", () => {
    expect(riskTier("src" + BS + "App.tsx")).toBe("soft");
    expect(riskTier("scripts" + BS + "check-seo.mjs")).toBe("hard");
  });

  it("a directory that merely STARTS with a guard name is not swept in", () => {
    expect(riskTier("scriptsy/thing.mjs")).toBeNull();
    expect(riskTier("binary/thing.sh")).toBeNull();
  });
});

describe("toPosix -- separator normalisation (regression: the backslash literal)", () => {
  it("converts Windows separators and strips a leading ./", () => {
    expect(toPosix("src" + BS + "pages" + BS + "Index.tsx")).toBe("src/pages/Index.tsx");
    expect(toPosix("./src/App.tsx")).toBe("src/App.tsx");
    expect(toPosix("src/App.tsx")).toBe("src/App.tsx");
  });
});

describe("hashContent -- line-ending and trailing-whitespace invariance", () => {
  it("CRLF and LF forms of the same content share one identity", () => {
    expect(hashContent("line1\r\nline2\r\n")).toBe(hashContent("line1\nline2\n"));
    expect(hashContent("line1\rline2")).toBe(hashContent("line1\nline2"));
  });
  it("a file's final newline does not change identity vs the same body without it", () => {
    expect(hashContent("export const a = 1;\n")).toBe(hashContent("export const a = 1;"));
  });
  it("strips EXACTLY ONE trailing newline, not an unbounded whitespace run", () => {
    // A trailing-whitespace strip made "foo();", "foo();   " and "foo();" plus
    // blank lines all one identity, so a reviewed file could be appended to and
    // blanked, or gain the trailing whitespace the eslint ratchet flags, and
    // still read as covered. The stated rationale needs one newline, no more.
    expect(hashContent("foo();\n")).toBe(hashContent("foo();"));
    expect(hashContent("foo();\n\n\n\n")).not.toBe(hashContent("foo();"));
    expect(hashContent("foo();   ")).not.toBe(hashContent("foo();"));
    // CRLF still normalises first, so the CRLF twin of the one-newline case holds
    expect(hashContent("foo();\r\n")).toBe(hashContent("foo();"));
  });
  it("SICK MIRROR: genuinely different content still hashes differently", () => {
    expect(hashContent("const a = 1;")).not.toBe(hashContent("const a = 2;"));
  });
  it("accepts a Buffer and a string identically", () => {
    expect(hashContent(Buffer.from("abc", "utf8"))).toBe(hashContent("abc"));
  });
});

describe("unquoteGitPath -- git's C-quoted output", () => {
  it("decodes octal byte escapes back to real UTF-8", () => {
    // git prints "caf\303\251.txt" for cafe-with-acute.txt
    const quoted = '"caf' + BS + "303" + BS + '251.txt"';
    expect(unquoteGitPath(quoted)).toBe("caf" + String.fromCharCode(0xe9) + ".txt");
  });
  it("decodes simple escapes", () => {
    expect(unquoteGitPath('"a' + BS + 'tb"')).toBe("a\tb");
    expect(unquoteGitPath('"a' + BS + '"b"')).toBe('a"b');
  });
  it("HEALTHY: an unquoted path is returned verbatim", () => {
    expect(unquoteGitPath("src/App.tsx")).toBe("src/App.tsx");
  });
});

describe("shipFiles -- the git plumbing actually runs", () => {
  it("returns a sorted string array against a resolvable ref", () => {
    const files = shipFiles("HEAD");
    expect(Array.isArray(files)).toBe(true);
    expect(files.every((f: string) => typeof f === "string" && !f.includes(BS))).toBe(true);
    expect([...files].sort()).toEqual(files);
  });
  it("FAIL-CLOSED: an unresolvable ref THROWS rather than reading as an empty scope", () => {
    expect(() => shipFiles("refs/heads/definitely-not-a-real-ref-xyz")).toThrow();
  });
});

describe("the gate's own fail-open holes (each proven both directions)", () => {
  it("DELETING a hard-tier guard is tracked, not silently dropped", () => {
    // riskyFilesInScope filters to files that exist (a deletion has no content
    // to hash), which left removing a CI workflow / check script / git hook --
    // the single highest-risk guard edit -- passing unreviewed by construction.
    const files = shipFiles("HEAD");
    expect(Array.isArray(files)).toBe(true);
    // The two halves partition the risky set: present files hash, absent ones
    // are deletions. Neither list can swallow the other.
    const present = riskyFilesInScope("HEAD");
    const gone = deletedRiskyFiles("HEAD");
    for (const p of present) expect(gone).not.toContain(p);
    for (const p of gone) {
      expect(present).not.toContain(p);
      expect(isRiskyPath(p)).toBe(true);
      expect(fs.existsSync(path.join(REPO_ROOT, p))).toBe(false);
    }
  });

  it("a file inside a BRAND-NEW untracked directory is visible to the ship", () => {
    // git status --porcelain collapses a wholly-untracked directory into one
    // "?? tests/dir/" entry. That made every file in a new directory invisible:
    // the eslint ratchet saw one unlintable path and printed SKIP, and
    // hashFile() throws EISDIR on a directory so nothing in it was ever hashed
    // or review-gated -- falsifying this module's own header claim that a
    // brand-new untracked file cannot slip through. --untracked-files=all fixes
    // it. This test creates the exact shape and asserts on the real git output.
    const dir = path.join(REPO_ROOT, "tests", "__tmp_scope_probe");
    const rel = "tests/__tmp_scope_probe/Probe.ts";
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "Probe.ts"), "export const probe = 1;\n");
      const files = shipFiles("HEAD");
      expect(files).toContain(rel);
      expect(files).not.toContain("tests/__tmp_scope_probe/");
      // and the eslint ratchet now sees a lintable file rather than a SKIP
      const plan = decideEslint({ files });
      expect(plan.mode).toBe("scoped");
      expect(plan.files).toContain(rel);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a finding with NO verdict blocks; only an explicit PLAUSIBLE does not", () => {
    // ReportFindings makes verdict optional -- "absent on inline-only reviews"
    // -- so a no-verify review reported every real defect with verdict
    // undefined and a strict === "CONFIRMED" test matched none of them. The
    // stamp came back clean and certified a ship with known bugs.
    expect(blocksTheShip({ summary: "no verdict at all" })).toBe(true);
    expect(blocksTheShip({ verdict: undefined, summary: "x" })).toBe(true);
    expect(blocksTheShip({ verdict: null, summary: "x" })).toBe(true);
    expect(blocksTheShip({ verdict: "CONFIRMED", summary: "x" })).toBe(true);
    expect(blocksTheShip({ verdict: "PLAUSIBLE", summary: "x" })).toBe(false);
    // ...and the whole chain, not just the predicate:
    const stamp = { hashes: { "a.mjs": "H" }, timestamp: new Date().toISOString(), findings: [{ summary: "bug" }] };
    expect(unresolvedConfirmedReasons(stamp)).toEqual(["bug"]);
    expect(stampCoversHash(stamp, "H")).toBe(false);
    // resolving it clears the block, exactly as for a CONFIRMED one
    stamp.findings = [{ summary: "bug", outcome: "fixed" }];
    expect(stampCoversHash(stamp, "H")).toBe(true);
  });

  it("a DECLARED scope never has to name the file that carries it", () => {
    // arc-state.json is rewritten at every phase start, so it is always in the
    // ship. Making it foreign to its own declaration hard-failed legitimate
    // ships, and the fix people reach for is deleting the scope array -- which
    // silently reverts to the advisory heuristic. settings.local.json is the
    // same class: the harness appends a permission grant whenever one is
    // approved, so it is dirty through no act of the ship, and because the gate
    // judges the WORKTREE, declining to stage it could never clear the red.
    const exempt = [
      ".claude/arc-state.json",
      ".claude/.review-stamp.json",
      ".claude/.session-lock.json",
      ".claude/settings.local.json",
    ];
    expect(DECLARED_ALWAYS_EXEMPT).toHaveLength(exempt.length);
    for (const p of exempt) {
      expect(DECLARED_ALWAYS_EXEMPT.some((re: RegExp) => re.test(p)), p).toBe(true);
      expect(scopeDrift(["scripts/a.mjs", p], { declared: ["scripts/"] }).ok, p).toBe(true);
    }
    // SICK MIRROR: a genuinely unrelated .claude/ file IS still foreign
    const r = scopeDrift(["scripts/a.mjs", ".claude/settings.json"], { declared: ["scripts/"] });
    expect(r.ok).toBe(false);
    expect(r.foreign.map((f: Foreign) => f.path)).toEqual([".claude/settings.json"]);
  });

  it("diffOrigin resolves a merge base, so a branch BEHIND its target is not over-scoped", () => {
    // A two-dot `git diff <base>` is symmetric: when the branch is behind, every
    // file the target moved appears in reverse as part of "this ship". PR #149's
    // recorded failure was exactly "a stale base, 12 commits behind main".
    const mb = diffOrigin("origin/main");
    expect(typeof mb).toBe("string");
    expect(mb.length).toBeGreaterThan(0);
    // an unresolvable ref has no merge base -- fall back to the raw ref (wider
    // scope is the safe direction), never throw
    expect(diffOrigin("refs/heads/definitely-not-real-xyz")).toBe("refs/heads/definitely-not-real-xyz");
  });
});

describe("classifySurface -- surface taxonomy", () => {
  it("classifies each surface, and the tests tree never counts as app", () => {
    expect(classifySurface("scripts/safe-edit.py")).toBe("guard");
    expect(classifySurface("bin/check-integrity.sh")).toBe("guard");
    expect(classifySurface(".github/workflows/ci.yml")).toBe("guard");
    expect(classifySurface("src/pages/Index.tsx")).toBe("app");
    expect(classifySurface("api/embed/index.ts")).toBe("app");
    expect(classifySurface("index.html")).toBe("app");
    expect(classifySurface("tests/e2e/smoke.spec.ts")).toBe("test");
    expect(classifySurface("package.json")).toBe("deps");
    expect(classifySurface("CLAUDE.md")).toBe("docs");
    expect(classifySurface("tsconfig.json")).toBe("other");
  });
});

describe("globToRegExp / matchesDeclared -- declared-scope matching", () => {
  it("a doubled star spans separators; a single star does not", () => {
    expect(globToRegExp("src/**/*.tsx").test("src/App.tsx")).toBe(true);
    expect(globToRegExp("src/**/*.tsx").test("src/a/b/C.tsx")).toBe(true);
    expect(globToRegExp("src/**/*.tsx").test("src/a/b/C.ts")).toBe(false);
    expect(globToRegExp("src/*.tsx").test("src/App.tsx")).toBe(true);
    expect(globToRegExp("src/*.tsx").test("src/pages/App.tsx")).toBe(false);
  });
  it("a dot is a literal, not a wildcard", () => {
    expect(globToRegExp("a.txt").test("axtxt")).toBe(false);
    expect(globToRegExp("a.txt").test("a.txt")).toBe(true);
  });
  it("matches surface ids, directory prefixes, exact paths and globs", () => {
    expect(matchesDeclared("scripts/x.mjs", "guard")).toBe(true);
    expect(matchesDeclared("src/App.tsx", "guard")).toBe(false);
    expect(matchesDeclared("src/pages/Index.tsx", "src/pages/")).toBe(true);
    expect(matchesDeclared("src/pagesX/Index.tsx", "src/pages/")).toBe(false);
    expect(matchesDeclared("src/pages/Index.tsx", "src/pages")).toBe(true);
    expect(matchesDeclared("package.json", "package.json")).toBe(true);
    expect(matchesDeclared("package-lock.json", "package.json")).toBe(false);
    expect(matchesDeclared("src/a/b.tsx", "src/**/*.tsx")).toBe(true);
    expect(matchesDeclared("", "src/")).toBe(false);
    expect(matchesDeclared("src/App.tsx", "")).toBe(false);
  });
  it("normalises a Windows-separator path before matching", () => {
    expect(matchesDeclared("src" + BS + "pages" + BS + "Index.tsx", "src/pages/")).toBe(true);
  });
});

describe("resolveDeclaredScope -- env parsing", () => {
  const withEnv = (v: string | undefined, fn: () => void) => {
    const prev = process.env.REVIEW_SCOPE_DECLARED;
    if (v === undefined) delete process.env.REVIEW_SCOPE_DECLARED;
    else process.env.REVIEW_SCOPE_DECLARED = v;
    try {
      fn();
    } finally {
      if (prev === undefined) delete process.env.REVIEW_SCOPE_DECLARED;
      else process.env.REVIEW_SCOPE_DECLARED = prev;
    }
  };
  it("splits on commas and whitespace", () => {
    withEnv("src/pages/, scripts/lib/  guard", () => {
      expect(resolveDeclaredScope()).toEqual({ status: "ok", scope: ["src/pages/", "scripts/lib/", "guard"] });
    });
  });
  it("set-but-empty means NO declaration (it does not declare an empty scope)", () => {
    withEnv("   ", () => expect(resolveDeclaredScope()).toEqual({ status: "none", scope: null }));
    withEnv("", () => expect(resolveDeclaredScope()).toEqual({ status: "none", scope: null }));
  });
  it("unset falls through to arc-state and yields a valid status", () => {
    withEnv(undefined, () => {
      const got = resolveDeclaredScope();
      expect(["none", "ok", "corrupt"]).toContain(got.status);
      if (got.status === "ok") expect(got.scope.length).toBeGreaterThan(0);
      else expect(got.scope).toBeNull();
    });
  });
  it("CORRUPT is distinguishable from NONE, so a garbled file cannot downgrade the gate", () => {
    // The hazard: a trailing comma in arc-state.json used to be swallowed, and
    // the gate silently dropped from fatal DECLARED to advisory INFERRED with a
    // line indistinguishable from a ship that declared nothing. loadStamp keeps
    // exactly this distinction for the receipt; the two readers now agree.
    const arc = path.join(REPO_ROOT, ".claude", "arc-state.json");
    const had = fs.existsSync(arc);
    const backup = had ? fs.readFileSync(arc) : null;
    try {
      fs.writeFileSync(arc, "{ not json,, }");
      withEnv(undefined, () => expect(resolveDeclaredScope().status).toBe("corrupt"));
      fs.writeFileSync(arc, JSON.stringify({ scope: ["scripts/"] }));
      withEnv(undefined, () => expect(resolveDeclaredScope()).toEqual({ status: "ok", scope: ["scripts/"] }));
      fs.writeFileSync(arc, JSON.stringify({ phase: 1 }));
      withEnv(undefined, () => expect(resolveDeclaredScope()).toEqual({ status: "none", scope: null }));
    } finally {
      if (backup) fs.writeFileSync(arc, backup);
      else fs.rmSync(arc, { force: true });
    }
  });
});

type Foreign = { path: string; surface: string };
const paths = (r: { foreign: Foreign[] }) => r.foreign.map((f) => f.path);

describe("scopeDrift -- INFERRED mode (the PR 161 shape)", () => {
  it("SICK: a guard file riding out on an app ship is flagged", () => {
    // PR 161 verbatim: a festival-times fix that also carried
    // scripts/safe-edit.py and a CLAUDE.md section out of a shared worktree.
    const r = scopeDrift([
      "src/pages/Index.tsx",
      "src/components/home/FestivalCard.tsx",
      "scripts/safe-edit.py",
      "CLAUDE.md",
    ]);
    expect(r.ok).toBe(false);
    expect(r.mode).toBe("inferred");
    expect(r.severity).toBe("warn");
    expect(r.primary).toBe("app");
    expect(paths(r)).toEqual(["scripts/safe-edit.py"]);
  });

  it("SICK (mirror direction): an app file riding out on a guard ship is flagged", () => {
    const r = scopeDrift(["scripts/pre-ship.mjs", "scripts/lib/review-scope.mjs", "src/pages/Index.tsx"]);
    expect(r.ok).toBe(false);
    expect(r.primary).toBe("guard");
    expect(paths(r)).toEqual(["src/pages/Index.tsx"]);
  });

  it("HEALTHY: a guard-only ship with docs, tests and a manifest is clean", () => {
    const r = scopeDrift([
      "scripts/pre-ship.mjs",
      "scripts/lib/review-scope.mjs",
      "tests/reviewScope.test.ts",
      "package.json",
      "CLAUDE.md",
    ]);
    expect(r.ok).toBe(true);
    expect(r.severity).toBe("none");
    expect(r.foreign).toEqual([]);
  });

  it("HEALTHY: an app-only ship is clean", () => {
    expect(scopeDrift(["src/App.tsx", "src/pages/Index.tsx", "public/og.png"]).ok).toBe(true);
  });

  it("HEALTHY: an empty ship is clean, not a crash", () => {
    const r = scopeDrift([]);
    expect(r.ok).toBe(true);
    expect(r.primary).toBeNull();
    expect(scopeDrift(undefined as never).ok).toBe(true);
  });

  it("DOCUMENTED GAP: inferred mode does NOT flag a stray test file, only a declaration does", () => {
    // The dehydrateWiring near-miss of 2026-07-30. The tests tree legitimately
    // travels with app work, so the heuristic stays silent by design; the
    // declared mode is what catches it. Pinned so the gap is a decision.
    const files = ["src/pages/Index.tsx", "tests/dehydrateWiring.test.ts"];
    expect(scopeDrift(files).ok).toBe(true);
    const declaredRun = scopeDrift(files, { declared: ["src/pages/Index.tsx"] });
    expect(declaredRun.ok).toBe(false);
    expect(paths(declaredRun)).toEqual(["tests/dehydrateWiring.test.ts"]);
  });

  it("a tie on file count breaks deterministically on PRIMARY_ORDER (app first)", () => {
    const r = scopeDrift(["src/App.tsx", "scripts/check-x.mjs"]);
    expect(r.ok).toBe(false);
    expect(r.primary).toBe("app");
    expect(paths(r)).toEqual(["scripts/check-x.mjs"]);
  });
});

describe("scopeDrift -- DECLARED mode is exact and fatal", () => {
  it("SICK: anything outside the declaration is foreign, whatever its surface", () => {
    const r = scopeDrift(["src/pages/Index.tsx", "scripts/safe-edit.py", "CLAUDE.md"], {
      declared: ["src/pages/"],
    });
    expect(r.ok).toBe(false);
    expect(r.mode).toBe("declared");
    expect(r.severity).toBe("error");
    expect(paths(r)).toEqual(["scripts/safe-edit.py", "CLAUDE.md"]);
    expect(r.reason).toContain("outside the declared scope");
  });

  it("HEALTHY: a ship entirely inside its declaration passes", () => {
    const r = scopeDrift(["scripts/pre-ship.mjs", "scripts/lib/review-scope.mjs", "tests/reviewScope.test.ts"], {
      declared: ["scripts/", "tests/"],
    });
    expect(r.ok).toBe(true);
    expect(r.severity).toBe("none");
  });

  it("a declaration may be written as surface ids", () => {
    expect(scopeDrift(["scripts/a.mjs", "tests/b.test.ts"], { declared: ["guard", "test"] }).ok).toBe(true);
    expect(scopeDrift(["scripts/a.mjs", "src/b.tsx"], { declared: ["guard", "test"] }).ok).toBe(false);
  });

  it("an EMPTY declared array falls back to inferred mode rather than flagging everything", () => {
    const r = scopeDrift(["src/App.tsx"], { declared: [] });
    expect(r.mode).toBe("inferred");
    expect(r.ok).toBe(true);
  });
});

describe("stampCoversHash -- hash AND freshness AND findings", () => {
  const now = 1_000_000_000_000;
  const fresh = { hashes: { "scripts/check-x.mjs": "H" }, timestamp: iso(now), findings: [] as unknown[] };
  it("HEALTHY: true for a present hash on a fresh, findings-clean stamp", () => {
    expect(stampCoversHash(fresh, "H", now)).toBe(true);
  });
  it("SICK: false when the hash is absent", () => {
    expect(stampCoversHash(fresh, "OTHER", now)).toBe(false);
  });
  it("SICK: false when the stamp is older than 24h", () => {
    expect(stampCoversHash({ ...fresh, timestamp: iso(now - 25 * 3600 * 1000) }, "H", now)).toBe(false);
  });
  it("SICK: false when a CONFIRMED finding is unresolved (seen is not cleared)", () => {
    expect(stampCoversHash({ ...fresh, findings: [{ verdict: "CONFIRMED", summary: "bug" }] }, "H", now)).toBe(false);
  });
  it("HEALTHY: true once that CONFIRMED finding is resolved", () => {
    const fixed = { ...fresh, findings: [{ verdict: "CONFIRMED", outcome: "fixed", summary: "bug" }] };
    expect(stampCoversHash(fixed, "H", now)).toBe(true);
  });
  it("SICK: a stamp timestamped in the FUTURE is not fresh (it would never expire)", () => {
    // stampAgeMs returns now - parse(ts), which is NEGATIVE for a future
    // timestamp and passes an upper-bound-only test. Clock skew -- or a
    // one-character hand edit to "2030-01-01T00:00:00Z" -- then disables the
    // 24h window entirely, and it is the mechanism's only defence against a
    // stale review. Nothing else inspects it.
    const future = { ...fresh, timestamp: iso(now + 60 * 60 * 1000) };
    expect(stampIsFresh(future, now)).toBe(false);
    expect(stampCoversHash(future, "H", now)).toBe(false);
    // HEALTHY MIRROR: a stamp minted a second ago is fresh
    expect(stampIsFresh({ ...fresh, timestamp: iso(now - 1000) }, now)).toBe(true);
  });
  it("SICK: an unparseable timestamp is not fresh", () => {
    expect(stampIsFresh({ ...fresh, timestamp: "not a date" }, now)).toBe(false);
    expect(stampIsFresh({ ...fresh, timestamp: undefined }, now)).toBe(false);
  });
  it("SICK: a missing stamp or a null hash never covers anything", () => {
    expect(stampCoversHash(null, "H", now)).toBe(false);
    expect(stampCoversHash(fresh, null, now)).toBe(false);
  });
});

describe("mergeReviewStamp -- additive across reviews (both directions)", () => {
  const now = 1_000_000_000_000;
  const nowIso = iso(now);
  const values = (s: { hashes: Record<string, string> }) => new Set(Object.values(s.hashes));
  const clean = (hashes: Record<string, string>, tsMs = now) => ({
    version: 1,
    timestamp: iso(tsMs),
    session_id: "s",
    hashes,
    findings: [] as unknown[],
  });

  it("POSITIVE: a fresh, clean prior review's coverage rides forward and unions with the new one", () => {
    const merged = mergeReviewStamp(clean({ "a.mjs": "HA" }), { hashes: { "b.mjs": "HB" }, findings: [], nowIso, now });
    expect(values(merged).has("HA")).toBe(true);
    expect(values(merged).has("HB")).toBe(true);
  });

  it("FAIL-CLOSED: per-rel union lets new content win, so a drifted file's OLD hash is dropped", () => {
    const merged = mergeReviewStamp(clean({ "a.mjs": "HA" }), { hashes: { "a.mjs": "HA2" }, findings: [], nowIso, now });
    expect(merged.hashes["a.mjs"]).toBe("HA2");
    expect(values(merged).has("HA")).toBe(false);
  });

  it("TIME: a single gap over 24h drops the prior coverage", () => {
    const merged = mergeReviewStamp(clean({ "a.mjs": "HA" }, now - 25 * 3600 * 1000), {
      hashes: { "b.mjs": "HB" },
      findings: [],
      nowIso,
      now,
    });
    expect(values(merged).has("HA")).toBe(false);
    expect(merged.hashes["b.mjs"]).toBe("HB");
  });

  it("NO FAIL-OPEN: a prior stamp with an UNRESOLVED CONFIRMED does not launder its hash forward", () => {
    const prev = {
      version: 1,
      timestamp: nowIso,
      session_id: "s",
      hashes: { "buggy.mjs": "HBUG" },
      findings: [{ verdict: "CONFIRMED", file: "buggy.mjs", summary: "real bug" }],
    };
    const merged = mergeReviewStamp(prev, { hashes: { "b.mjs": "HB" }, findings: [], nowIso, now });
    expect(values(merged).has("HBUG")).toBe(false);
    expect(merged.hashes["b.mjs"]).toBe("HB");
  });

  it("POSITIVE mirror: a prev whose CONFIRMED finding is RESOLVED DOES carry forward", () => {
    const prev = {
      version: 1,
      timestamp: nowIso,
      session_id: "s",
      hashes: { "a.mjs": "HA" },
      findings: [{ verdict: "CONFIRMED", file: "a.mjs", summary: "was buggy", outcome: "fixed" }],
    };
    const merged = mergeReviewStamp(prev, { hashes: { "b.mjs": "HB" }, findings: [], nowIso, now });
    expect(values(merged).has("HA")).toBe(true);
    expect(values(merged).has("HB")).toBe(true);
  });

  it("findings reflect the LATEST review only, and the timestamp is RENEWED to now", () => {
    const prev = clean({ "a.mjs": "HA" }, now - 3600 * 1000);
    const merged = mergeReviewStamp(prev, {
      hashes: {},
      findings: [{ verdict: "CONFIRMED", summary: "new" }],
      nowIso,
      now,
    });
    expect(merged.findings).toHaveLength(1);
    expect(merged.timestamp).toBe(nowIso);
    expect(merged.timestamp).not.toBe(prev.timestamp);
  });

  it("a missing or shapeless prior stamp yields a clean mint of just the new coverage", () => {
    for (const prev of [null, undefined, {}, { hashes: null }] as never[]) {
      const merged = mergeReviewStamp(prev, { hashes: { "a.mjs": "HA" }, findings: [], nowIso, now });
      expect(merged.hashes).toEqual({ "a.mjs": "HA" });
    }
  });

  it("TOLERATES a valid-JSON prior stamp whose findings value is not an array", () => {
    expect(() => unresolvedConfirmedReasons({ findings: {} } as never)).not.toThrow();
    expect(unresolvedConfirmedReasons({ findings: 5 } as never)).toEqual([]);
    const prev = { version: 1, timestamp: nowIso, session_id: "s", hashes: { "a.mjs": "HA" }, findings: {} };
    let merged: ReturnType<typeof mergeReviewStamp> | undefined;
    expect(() => {
      merged = mergeReviewStamp(prev as never, { hashes: { "b.mjs": "HB" }, findings: [], nowIso, now });
    }).not.toThrow();
    expect(values(merged as never).has("HA")).toBe(true);
  });

  it("PINNED: unchanged coverage rides across a chain of sub-24h mints, and drift still re-scopes it", () => {
    const t0 = now;
    const s0 = mergeReviewStamp(null, { hashes: { "a.mjs": "HA" }, findings: [], nowIso: iso(t0), now: t0 });
    const t1 = t0 + 23 * 3600 * 1000;
    const s1 = mergeReviewStamp(s0, { hashes: { "b.mjs": "HB" }, findings: [], nowIso: iso(t1), now: t1 });
    const t2 = t1 + 23 * 3600 * 1000; // 46h after a.mjs was last reviewed
    const s2 = mergeReviewStamp(s1, { hashes: { "c.mjs": "HC" }, findings: [], nowIso: iso(t2), now: t2 });
    expect(values(s2).has("HA")).toBe(true);
    expect(s2.timestamp).toBe(iso(t2));
    const s3 = mergeReviewStamp(s2, { hashes: { "a.mjs": "HA2" }, findings: [], nowIso: iso(t2), now: t2 });
    expect(values(s3).has("HA")).toBe(false);
    expect(s3.hashes["a.mjs"]).toBe("HA2");
  });
});

describe("decideSmoke -- the conditional browser gate, both directions", () => {
  it("RUNS when app code is in the ship, naming the base ref", () => {
    const d = decideSmoke({ files: ["src/App.tsx"], base: "origin/main" });
    expect(d.ran).toBe(true);
    expect(d.reason).toContain("origin/main");
  });
  it("RUNS for every declared app trigger", () => {
    for (const f of [
      "src/pages/Index.tsx",
      "api/embed/index.ts",
      "public/og.png",
      "tests/e2e/smoke.spec.ts",
      "index.html",
      "vite.config.ts",
      "react-router.config.ts",
      "package.json",
      "package-lock.json",
      "playwright.config.ts",
    ]) {
      expect(decideSmoke({ files: [f], base: "origin/main" }).ran, f).toBe(true);
    }
  });
  it("SKIPS a docs- or scripts-only ship, and says why", () => {
    const d = decideSmoke({ files: ["CLAUDE.md", "scripts/pre-ship.mjs", "tests/unit.test.ts"], base: "origin/main" });
    expect(d.ran).toBe(false);
    expect(d.reason).toContain("no app code");
    expect(d.reason).toContain("origin/main");
  });
  it("SKIPS an empty ship", () => {
    expect(decideSmoke({ files: [], base: "origin/main" }).ran).toBe(false);
  });
  it("a unit test under tests/ is NOT an app trigger, but tests/e2e IS", () => {
    expect(decideSmoke({ files: ["tests/reviewScope.test.ts"] }).ran).toBe(false);
    expect(decideSmoke({ files: ["tests/e2e/auth.spec.ts"] }).ran).toBe(true);
  });
  it("FAIL-UNSAFE-TO-RUN: an uncomputable diff RUNS smoke rather than silently skipping it", () => {
    const d = decideSmoke({ files: [], base: "(unknown)", diffError: "bad revision" });
    expect(d.ran).toBe(true);
    expect(d.reason).toContain("bad revision");
  });
  it("holds smoke back when the cheap repo checks already failed", () => {
    const d = decideSmoke({ files: ["src/App.tsx"], base: "origin/main", anyFailed: true });
    expect(d.ran).toBe(false);
    expect(d.reason).toContain("repo-only checks failed");
  });
  it("normalises Windows separators before testing the app trigger", () => {
    expect(decideSmoke({ files: ["src" + BS + "App.tsx"] }).ran).toBe(true);
  });
});

describe("pre-ship CHECKS covers the whole lint chain (anti-under-run)", () => {
  // The failure this guards: someone adds a link to the "lint" chain in
  // package.json and pre-ship silently stops being equivalent to CI. A gate
  // that quietly under-runs is indistinguishable from a gate that passes.
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
  const ids = new Set(CHECKS.map(([id]: [string, string, string[]?]) => id));

  it("every npm-run link in the lint chain has its own pre-ship entry", () => {
    const links = [...String(pkg.scripts.lint).matchAll(/npm run ([\w:-]+)/g)].map((m) => m[1]);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(ids.has(link), link).toBe(true);
  });

  it("the eslint tail of the chain has a dedicated script, run as its own step", () => {
    expect(String(pkg.scripts.lint).trim().endsWith("eslint .")).toBe(true);
    expect(pkg.scripts["lint:eslint"]).toBe("eslint .");
    // eslint is NOT a CHECKS entry: it is a ship-scoped ratchet with its own
    // decision function, because whole-tree eslint is red on main.
    expect(ids.has("lint:eslint")).toBe(false);
  });

  it("test:unit is a CHECKS entry; typecheck is its own ratchet step", () => {
    expect(ids.has("test:unit")).toBe(true);
    expect(ids.has("typecheck")).toBe(false);
    // A bare "npx tsc --noEmit" reads the wrong tsconfig in this repo and is a
    // known false-green; the npm script pins tsconfig.app.json.
    expect(pkg.scripts.typecheck).toContain("tsconfig.app.json");
  });

  it("every pre-ship check id is a real npm script", () => {
    for (const id of ids) expect(Object.hasOwn(pkg.scripts, id), id).toBe(true);
  });

  it("decideEslint SCOPES to the ship's own lintable files", () => {
    const d = decideEslint({
      files: ["scripts/pre-ship.mjs", "tests/reviewScope.test.ts", "CLAUDE.md", "public/og.png"],
      exists: () => true,
    });
    expect(d.mode).toBe("scoped");
    expect(d.files).toEqual(["scripts/pre-ship.mjs", "tests/reviewScope.test.ts"]);
    expect(d.reason).toContain("2 file(s)");
  });
  it("decideEslint SKIPS when the ship has nothing lintable", () => {
    const d = decideEslint({ files: ["CLAUDE.md", "package.json"], exists: () => true });
    expect(d.mode).toBe("skip");
    expect(d.reason).toContain("no lintable files");
  });
  it("decideEslint drops a deleted file rather than asking eslint to lint a ghost", () => {
    const d = decideEslint({ files: ["src/Gone.tsx", "src/Here.tsx"], exists: (p: string) => p.includes("Here") });
    expect(d.mode).toBe("scoped");
    expect(d.files).toEqual(["src/Here.tsx"]);
  });
  it("decideEslint goes WHOLE-TREE on the explicit opt-in", () => {
    const d = decideEslint({ files: ["CLAUDE.md"], all: true, exists: () => true });
    expect(d.mode).toBe("all");
    expect(d.reason).toContain("PRE_SHIP_ESLINT_ALL");
  });
  it("an uncomputable diff falls back to the WHOLE tree rather than skipping", () => {
    const d = decideEslint({ files: [], diffError: "bad revision", exists: () => true });
    expect(d.mode).toBe("all");
    expect(d.reason).toContain("whole tree");
  });
  it("whole-tree modes are NON-BLOCKING, so they cannot switch the smoke gate off", () => {
    // 189 pre-existing errors mean whole-tree eslint always fails. As a
    // blocking check its failure fed anyFailed, which decideSmoke reads as
    // "repo-only checks failed" and SKIPS the browser gate -- so the flag
    // documented as "the full picture" silently removed coverage.
    expect(decideEslint({ files: [], all: true, exists: () => true }).blocking).toBe(false);
    expect(decideEslint({ files: [], diffError: "boom", exists: () => true }).blocking).toBe(false);
    expect(decideEslint({ files: ["a.ts"], exists: () => true }).blocking).toBe(true);
  });
  it("reports how many scoped files eslint actually has RULES for", () => {
    // eslint.config.js globs ts/tsx only, so .mjs is linted with no rules and
    // always passes. A green tick over a file with zero coverage is a lie.
    const d = decideEslint({ files: ["a.ts", "b.tsx", "c.mjs", "d.js"], exists: () => true });
    expect(d.files).toHaveLength(4);
    expect(d.ruleCovered).toBe(2);
    expect(d.reason).toContain("2 of them rule-covered");
  });
  it("ESLINT_EXTS covers the repo's real source extensions and nothing else", () => {
    expect(ESLINT_EXTS).toEqual([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
    const d = decideEslint({ files: ["a.py", "b.sh", "c.yml", "d.json"], exists: () => true });
    expect(d.mode).toBe("skip");
  });

  it("countTscErrors counts diagnostic lines, not continuation lines", () => {
    const out = [
      "src/pages/A.tsx(10,5): error TS2339: Property x does not exist.",
      "  Property x does not exist on type Y.",
      "src/pages/B.tsx(3,1): error TS2345: Argument of type a is not assignable.",
      "src/pages/B.tsx(3,1): error TS2769: No overload matches this call.",
    ].join("\n");
    expect(countTscErrors(out)).toBe(3);
    expect(countTscErrors("")).toBe(0);
    expect(countTscErrors("nothing to see here")).toBe(0);
  });

  it("FAIL-CLOSED: a CONFIG-level tsc error is never a green zero", () => {
    // TS5083 "Cannot read file tsconfig.app.json" / TS18003 "No inputs were
    // found" carry no (line,col) anchor, so countTscErrors sees ZERO of them.
    // Left unguarded that reported PASS on a broken tsconfig AND told the
    // operator to set the baseline to 0, permanently disarming the ratchet.
    const configOnly = "error TS5083: Cannot read file 'tsconfig.app.json'.";
    expect(countTscErrors(configOnly)).toBe(0);
    expect(hasConfigLevelTscError(configOnly)).toBe(true);
    const verdict = decideTypecheck({ count: 0, configError: true });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toContain("CONFIG-level");
    // HEALTHY MIRROR: ordinary anchored diagnostics are not config errors.
    const normal = "src/a.tsx(1,1): error TS2339: nope.";
    expect(hasConfigLevelTscError(normal)).toBe(false);
    expect(decideTypecheck({ count: 1, baseline: 107, configError: false }).ok).toBe(true);
  });

  it("decideTypecheck: AT the baseline is green, ABOVE it is red naming the delta", () => {
    expect(decideTypecheck({ count: 107, baseline: 107 }).ok).toBe(true);
    const worse = decideTypecheck({ count: 109, baseline: 107 });
    expect(worse.ok).toBe(false);
    expect(worse.reason).toContain("ADDED 2");
  });

  it("decideTypecheck: BELOW the baseline is green and asks for the baseline to be lowered", () => {
    const better = decideTypecheck({ count: 100, baseline: 107 });
    expect(better.ok).toBe(true);
    expect(better.reason).toContain("lower TYPECHECK_BASELINE to 100");
  });

  it("FAIL-CLOSED: tsc failing to run is NOT a clean zero-error pass", () => {
    expect(decideTypecheck({ count: null }).ok).toBe(false);
    expect(decideTypecheck({ ran: false, count: 0 }).ok).toBe(false);
    // and the healthy mirror: a genuine zero is green
    expect(decideTypecheck({ count: 0, baseline: 107 }).ok).toBe(true);
  });

  it("the baseline is a concrete non-negative number, not a placeholder", () => {
    expect(Number.isInteger(TYPECHECK_BASELINE)).toBe(true);
    expect(TYPECHECK_BASELINE).toBeGreaterThanOrEqual(0);
  });

  it("APP_PATHS is non-empty and anchored", () => {
    expect(APP_PATHS.length).toBeGreaterThan(0);
    for (const re of APP_PATHS) expect(re.source.startsWith("^"), re.source).toBe(true);
  });

  it("build/style/type config fires the browser gate (it changes what ships)", () => {
    for (const f of [
      "tailwind.config.ts",
      "postcss.config.js",
      "tsconfig.app.json",
      "tsconfig.json",
      "eslint.config.js",
      ".env.production",
      ".env",
    ]) {
      expect(decideSmoke({ files: [f], base: "origin/main" }).ran, f).toBe(true);
    }
  });
});

/* THE EMPTY-SCOPE BYPASS (supabase-defer P6).
 *
 * Found during P5's push: resolveBaseRef() returns the branch's OWN upstream, so
 * once origin/<branch> equals HEAD the ship diff is a ref against itself, the
 * risky scope comes back empty, and ship-gate printed "no risky files in ship
 * scope" -- exit 0 -- while the branch carried risky files no reviewer had seen.
 * Reproduced end-to-end against a real remote before the fix was written; these
 * cases pin the POLICY that closes it, which is why pickShipBase() is split out
 * of resolveShipBase() as a pure function.
 *
 * The load-bearing case is the FIRST one. The rest exist so a later "simplify
 * this" cannot quietly turn the widening on permanently (which would re-scope
 * every already-reviewed commit on a long branch, the exact cost resolveBaseRef()
 * was introduced to avoid) or off again. */
describe("pickShipBase() -- a pushed branch cannot empty its own ship scope", () => {
  it("WIDENS to the trunk when the branch's upstream carries no risky content", () => {
    // The bypass: HEAD == origin/feat/x, so the narrow base scopes in nothing.
    expect(pickShipBase("origin/feat/x", 0)).toBe(TRUNK_BASE);
  });

  it("KEEPS the narrow base when the incremental ship has risky content", () => {
    // The optimisation resolveBaseRef() exists for: a long-lived branch must not
    // re-scope commits reviewed days ago just because it has many of them.
    expect(pickShipBase("origin/feat/x", 1)).toBe("origin/feat/x");
    expect(pickShipBase("origin/feat/x", 12)).toBe("origin/feat/x");
  });

  it("never widens past the trunk -- an empty trunk scope is a genuinely empty ship", () => {
    // A docs-only ship must still not need a review receipt. Widening origin/main
    // to origin/main is a no-op, so the honest empty case stays green.
    expect(pickShipBase(TRUNK_BASE, 0)).toBe(TRUNK_BASE);
    expect(pickShipBase(TRUNK_BASE, 3)).toBe(TRUNK_BASE);
  });

  it("takes an operator-named REVIEW_SCOPE_BASE as final, ABOVE this policy", () => {
    /* Pinned because the two halves of the apparatus have to agree: review-stamp's
     * empty-scope refusal instructs the operator to name the base, so the gate
     * overriding that name would break its own printed remedy. Asserted on
     * resolveShipBase(), not pickShipBase(), because the env var is handled before
     * the policy is ever consulted -- and it short-circuits before any git call,
     * so this stays a pure unit test. */
    const prev = process.env.REVIEW_SCOPE_BASE;
    process.env.REVIEW_SCOPE_BASE = "abc1234";
    try {
      expect(resolveShipBase()).toBe("abc1234");
    } finally {
      if (prev === undefined) delete process.env.REVIEW_SCOPE_BASE;
      else process.env.REVIEW_SCOPE_BASE = prev;
    }
  });
});
