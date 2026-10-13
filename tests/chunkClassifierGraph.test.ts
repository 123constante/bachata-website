import { describe, expect, it } from "vitest";
import { classifyChunkInGraph, findVendorChunkCycles, vendorChunkCycleGuard, type ImportersOf } from "../vite.chunks";

// classifyChunkInGraph's one rule (vite.chunks.ts): a node_modules module that a
// vendor-ui module reaches through static imports is filed in vendor-ui, so
// vendor-ui never imports vendor-ui-modal -- the cycle that left PR #747's
// Vercel preview on skeletons (`TypeError: le is not a function`). The graphs
// below are importer maps, the only part of rollup's getModuleInfo it reads.

const nm = (pkg: string) => `/repo/node_modules/${pkg}/dist/index.mjs`;
const APP = "/repo/src/components/ui/dialog.tsx";
const graph = (importers: Record<string, string[]>, dropped: string[] = []): ImportersOf => (id) => ({
  importers: importers[id] ?? [],
  isIncluded: !dropped.includes(id),
});

describe("classifyChunkInGraph -- vendor-ui never imports vendor-ui-modal", () => {
  it("leaves a modal package imported only by modal packages and app code in vendor-ui-modal", () => {
    const g = graph({ [nm("@radix-ui/react-focus-scope")]: [nm("@radix-ui/react-dialog"), APP] });
    expect(classifyChunkInGraph(nm("@radix-ui/react-focus-scope"), g)).toBe("vendor-ui-modal");
  });

  it("moves a modal-listed package a shell package imports into vendor-ui", () => {
    const g = graph({ [nm("@radix-ui/react-direction")]: [nm("@radix-ui/react-dialog"), nm("@radix-ui/react-tooltip")] });
    expect(classifyChunkInGraph(nm("@radix-ui/react-direction"), g)).toBe("vendor-ui");
  });

  it("follows the chain through unlisted and modal packages to a shell importer", () => {
    const g = graph({
      [nm("use-callback-ref")]: [nm("unlisted-helper")],
      [nm("unlisted-helper")]: [nm("@radix-ui/react-roving-focus")],
      [nm("@radix-ui/react-roving-focus")]: [nm("@radix-ui/react-toast")],
    });
    expect(classifyChunkInGraph(nm("use-callback-ref"), g)).toBe("vendor-ui");
  });

  it("files an unlisted package a shell package imports in vendor-ui, and leaves other unlisted ones to rollup", () => {
    const g = graph({ [nm("clsx")]: [nm("class-variance-authority"), APP], [nm("date-fns")]: [APP] });
    expect(classifyChunkInGraph(nm("clsx"), g)).toBe("vendor-ui");
    expect(classifyChunkInGraph(nm("date-fns"), g)).toBeUndefined();
  });

  it("does not walk through app code or another pinned group", () => {
    const g = graph({
      [nm("@radix-ui/react-dialog")]: [APP, nm("framer-motion")],
      [APP]: [nm("@radix-ui/react-tooltip")],
      [nm("framer-motion")]: [nm("@radix-ui/react-tooltip")],
    });
    expect(classifyChunkInGraph(nm("@radix-ui/react-dialog"), g)).toBe("vendor-ui-modal");
  });

  it("ignores an importer tree-shaking dropped (no chunk edge, nothing to move)", () => {
    const g = graph({ [nm("@radix-ui/react-focus-scope")]: [nm("unlisted-helper")], [nm("unlisted-helper")]: [nm("@radix-ui/react-tooltip")] }, [nm("unlisted-helper")]);
    expect(classifyChunkInGraph(nm("@radix-ui/react-focus-scope"), g)).toBe("vendor-ui-modal");
  });

  it("finds the shell through an import cycle among node_modules, whichever module is asked first", () => {
    const importers = {
      [nm("aria-hidden")]: [nm("get-nonce")],
      [nm("get-nonce")]: [nm("aria-hidden"), nm("use-sidecar")],
      [nm("use-sidecar")]: [nm("@radix-ui/react-toast")],
    };
    const g1 = graph(importers);
    expect(classifyChunkInGraph(nm("aria-hidden"), g1)).toBe("vendor-ui");
    expect(classifyChunkInGraph(nm("get-nonce"), g1)).toBe("vendor-ui");
    const g2 = graph(importers);
    expect(classifyChunkInGraph(nm("get-nonce"), g2)).toBe("vendor-ui");
    expect(classifyChunkInGraph(nm("aria-hidden"), g2)).toBe("vendor-ui");
  });

  it("terminates on an import cycle among node_modules", () => {
    const g = graph({ [nm("aria-hidden")]: [nm("get-nonce")], [nm("get-nonce")]: [nm("aria-hidden")] });
    expect(classifyChunkInGraph(nm("aria-hidden"), g)).toBe("vendor-ui-modal");
  });

  it("never changes a module classifyChunk pins elsewhere, or app code", () => {
    const g = graph({ [nm("react")]: [nm("@radix-ui/react-tooltip")], [APP]: [nm("@radix-ui/react-tooltip")] });
    expect(classifyChunkInGraph(nm("react"), g)).toBe("vendor-react");
    expect(classifyChunkInGraph(APP, g)).toBeUndefined();
  });
});

describe("findVendorChunkCycles / vendorChunkCycleGuard -- the build fails on a cycle", () => {
  it("names the #747 cycle and the three-chunk one the classifier does not look through", () => {
    expect(findVendorChunkCycles({
      "assets/vendor-ui-A.js": ["assets/vendor-react-R.js", "assets/vendor-ui-modal-M.js"],
      "assets/vendor-ui-modal-M.js": ["assets/vendor-react-R.js", "assets/vendor-ui-A.js"],
      "assets/vendor-react-R.js": [],
    })).toEqual([
      "assets/vendor-ui-A.js -> assets/vendor-ui-modal-M.js -> assets/vendor-ui-A.js",
      "assets/vendor-ui-modal-M.js -> assets/vendor-ui-A.js -> assets/vendor-ui-modal-M.js",
    ]);
    expect(findVendorChunkCycles({
      "assets/vendor-ui-A.js": ["assets/vendor-motion-X.js"],
      "assets/vendor-motion-X.js": ["assets/vendor-ui-modal-M.js"],
      "assets/vendor-ui-modal-M.js": ["assets/vendor-ui-A.js"],
    })).toHaveLength(3);
  });

  it("passes today's shape: modal -> shell -> react, app chunks importing all of them", () => {
    expect(findVendorChunkCycles({
      "assets/vendor-ui-A.js": ["assets/vendor-react-R.js"],
      "assets/vendor-ui-modal-M.js": ["assets/vendor-react-R.js", "assets/vendor-ui-A.js"],
      "assets/vendor-react-R.js": [],
      "assets/root-1.js": ["assets/vendor-ui-modal-M.js", "assets/vendor-ui-A.js"],
    })).toEqual([]);
  });

  it("ignores a cycle among app chunks only (not this guard's class)", () => {
    expect(findVendorChunkCycles({ "assets/a.js": ["assets/b.js"], "assets/b.js": ["assets/a.js"] })).toEqual([]);
  });

  it("the plugin errors with the cycle, and is silent on a clean bundle", () => {
    const plugin = vendorChunkCycleGuard();
    const errors: string[] = [];
    const ctx = { error: (m: string): never => { errors.push(m); throw new Error(m); } };
    const chunk = (imports: string[]) => ({ type: "chunk", imports });
    expect(() => plugin.generateBundle.call(ctx, {}, {
      "assets/vendor-ui-A.js": chunk(["assets/vendor-ui-modal-M.js"]),
      "assets/vendor-ui-modal-M.js": chunk(["assets/vendor-ui-A.js"]),
      "assets/x.css": { type: "asset" },
    })).toThrow(/vendor-ui-A\.js -> assets\/vendor-ui-modal-M\.js/);
    expect(() => plugin.generateBundle.call(ctx, {}, { "assets/vendor-ui-A.js": chunk([]) })).not.toThrow();
    expect(errors).toHaveLength(1);
  });
});
