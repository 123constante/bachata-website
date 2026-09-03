import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  VENDOR_UI_MODAL_PACKAGES,
  VENDOR_UI_SHELL_PACKAGES,
  assertDisjoint,
  classifyChunk,
} from "../vite.chunks";

// The chunk classifier decides how many files every route downloads, and until
// it was extracted from vite.config.ts nothing could call it: `manualChunks`
// was an anonymous function on an object returned from a callback, reachable
// only by running a full build. So its rules were enforced by whatever a build
// happened to notice -- and a build notices a mis-chunked package as a KB
// number on an unrelated route, long after the edit.
//
// Importing this module also RUNS the disjointness assertion against the real
// lists (vite.chunks.ts calls it at module load), so a duplicated package name
// fails this file at import rather than in a case below.

const id = (pkg: string, file = "index.js") =>
  `/repo/node_modules/${pkg}/dist/${file}`;

describe("classifyChunk -- the pinned vendor groups", () => {
  it.each([
    ["react", "vendor-react"],
    ["react-dom", "vendor-react"],
    ["scheduler", "vendor-react"],
    ["framer-motion", "vendor-motion"],
    ["@sentry/browser", "vendor-sentry"],
    ["@tanstack/react-query", "vendor-query"],
    ["@supabase/supabase-js", "vendor-supabase"],
    ["lucide-react", "vendor-icons"],
    ["@radix-ui/react-tooltip", "vendor-ui"],
    ["@radix-ui/react-use-callback-ref", "vendor-ui"],
    ["@radix-ui/react-dialog", "vendor-ui-modal"],
    ["maplibre-gl", "vendor-maplibre"],
    ["@maplibre/maplibre-gl-leaflet", "vendor-maplibre"],
    ["leaflet", "vendor-leaflet"],
    ["leaflet.markercluster", "vendor-leaflet"],
  ])("%s -> %s", (pkg, group) => {
    expect(classifyChunk(id(pkg))).toBe(group);
  });

  it("leaves first-party source to rollup", () => {
    expect(classifyChunk("/repo/src/components/Foo.tsx")).toBeUndefined();
    expect(classifyChunk("/repo/app/routes/parties.tsx")).toBeUndefined();
  });

  it("leaves an unlisted dependency in its own chunk -- a missed win, not a regression", () => {
    expect(classifyChunk(id("some-new-package"))).toBeUndefined();
  });
});

describe("classifyChunk -- the ORDER of the branches, which is load-bearing", () => {
  // tslib is tested FIRST in the classifier, and the branch's own comment says
  // why: every test under it is an unbounded substring, so a NESTED copy of
  // tslib inside a heavy package would match that package's rule and land the
  // shared helper runtime inside vendor-sentry -- re-creating, against a
  // different chunk, exactly the false import edge P1 removed from
  // vendor-supabase. The puller ratchet only watches vendor-supabase, so that
  // regression would ship green. Reordering the branches is the way to cause
  // it, and this is the case that catches the reorder.
  it.each([
    "tslib",
    "@sentry/browser/node_modules/tslib",
    "@supabase/supabase-js/node_modules/tslib",
    "framer-motion/node_modules/tslib",
  ])("a tslib at %s rides with vendor-react", (where) => {
    expect(classifyChunk(id(where, "tslib.es6.js"))).toBe("vendor-react");
  });

  it("does not give tslib a chunk of its own -- that would be one MORE request everywhere", () => {
    expect(classifyChunk(id("tslib"))).not.toBe("vendor-tslib");
  });
});

describe("classifyChunk -- the needles are bounded on both sides", () => {
  it("requires the whole package directory, not a prefix", () => {
    expect(classifyChunk(id("sonner-x"))).toBeUndefined();
    expect(classifyChunk(id("aria-hidden-fork"))).toBeUndefined();
    expect(classifyChunk(id("react-dom-factories"))).toBeUndefined();
  });

  // MUTATION FOUND THIS CASE, and the first version of it proved nothing. It
  // asserted the leading `node_modules/` bound with first-party paths --
  // /repo/src/lib/sonner/toast.ts -- which never reach a needle at all: the
  // classifier's first line returns undefined for any id without
  // "node_modules" in it. So deleting the bound from every needle left the
  // whole file green. What the bound actually protects is a path that IS in
  // node_modules and merely CONTAINS a package name as a nested directory, and
  // nothing had ever asked about one.
  it("requires the package to be a whole directory under node_modules, not a nested folder that shares its name", () => {
    expect(classifyChunk("/repo/node_modules/some-lib/dist/sonner/index.js")).toBeUndefined();
    expect(classifyChunk("/repo/node_modules/some-lib/src/react-dialog/x.js")).toBeUndefined();
    expect(classifyChunk("/repo/node_modules/@scope/pkg/lib/aria-hidden/i.js")).toBeUndefined();
    // The two map groups get the same treatment. `maplibre` in particular was
    // written as a bare unbounded substring first, which this case rejects.
    expect(classifyChunk("/repo/node_modules/some-lib/dist/maplibre/index.js")).toBeUndefined();
    expect(classifyChunk("/repo/node_modules/some-lib/vendor/leaflet/index.js")).toBeUndefined();
  });

  it("returns early for anything outside node_modules -- the OTHER half of the bound", () => {
    expect(classifyChunk("/repo/src/lib/sonner/toast.ts")).toBeUndefined();
    expect(classifyChunk("/repo/src/vendor/framer-motion.ts")).toBeUndefined();
  });

  it("pins the commonjs helper by its VIRTUAL id, not by the bare word", () => {
    // This branch is the one exception to the rule the case above states: it
    // sits BEFORE the node_modules gate, so it is the only needle that can
    // reach a first-party path, and it needs its own bound. Rollup's real id
    // carries a leading NUL, which nothing on disk can.
    expect(classifyChunk("\0commonjsHelpers.js")).toBe("vendor-react");

    // The hole this closes: before the id was bounded, every one of these was
    // silently reassigned to vendor-react -- a first-party module by that
    // name, and the hashed copy that rollup-built packages ship inside their
    // own dist. The second must fall through to its PACKAGE's group instead.
    expect(classifyChunk("/repo/src/lib/commonjsHelpers.ts")).toBeUndefined();
    expect(
      classifyChunk("/repo/node_modules/leaflet/dist/commonjsHelpers-a1b2c3.js"),
    ).toBe("vendor-leaflet");
  });

  it("ignores anything outside node_modules before testing a single needle", () => {
    expect(classifyChunk("/repo/src/react/index.ts")).toBeUndefined();
  });
});

describe("the two lists", () => {
  it("are disjoint -- and this is what the module asserts at load", () => {
    expect(() =>
      assertDisjoint(VENDOR_UI_SHELL_PACKAGES, VENDOR_UI_MODAL_PACKAGES),
    ).not.toThrow();
  });

  it("reject an overlap, naming the package", () => {
    expect(() => assertDisjoint(["a", "dup"], ["dup"])).toThrow(/dup/);
  });

  it("route every listed package into their OWN group, not the other one", () => {
    for (const pkg of VENDOR_UI_SHELL_PACKAGES) {
      expect(classifyChunk(id(pkg))).toBe("vendor-ui");
    }
    for (const pkg of VENDOR_UI_MODAL_PACKAGES) {
      expect(classifyChunk(id(pkg))).toBe("vendor-ui-modal");
    }
  });

  // A misspelt entry is DEAD TEXT: it matches no id, so the package keeps its
  // own chunk and the list reads as covering something it does not. Nothing
  // else in the repo can see that -- the build succeeds, the budgets pass, and
  // the only symptom is one extra request nobody is looking for.
  it("name packages that are actually installed", () => {
    const modules = path.join(process.cwd(), "node_modules");
    expect(
      existsSync(modules),
      "node_modules is absent, so this case would pass without checking anything",
    ).toBe(true);
    const missing = [...VENDOR_UI_SHELL_PACKAGES, ...VENDOR_UI_MODAL_PACKAGES].filter(
      (pkg) => !existsSync(path.join(modules, pkg)),
    );
    expect(missing).toEqual([]);
  });
});
