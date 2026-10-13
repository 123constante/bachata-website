import { describe, expect, it } from "vitest";
import { classifyChunkInGraph, type ImportersOf } from "../vite.chunks";

// classifyChunkInGraph's one rule (vite.chunks.ts): a node_modules module that a
// vendor-ui module reaches through static imports is filed in vendor-ui, so
// vendor-ui never imports vendor-ui-modal -- the cycle that left PR #747's
// Vercel preview on skeletons (`TypeError: le is not a function`). The graphs
// below are importer maps, the only part of rollup's getModuleInfo it reads.

const nm = (pkg: string) => `/repo/node_modules/${pkg}/dist/index.mjs`;
const APP = "/repo/src/components/ui/dialog.tsx";
const graph = (importers: Record<string, string[]>): ImportersOf => (id) => ({ importers: importers[id] ?? [] });

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
