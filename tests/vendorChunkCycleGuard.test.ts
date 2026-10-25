import { describe, expect, it } from "vitest";
import { findVendorChunkCycles, vendorChunkCycleGuard } from "../vite.chunks";

// vendorChunkCycleGuard (vite.chunks.ts) fails every client build -- Vercel's
// included -- on a static import cycle through a vendor chunk: the class behind
// "TypeError: le is not a function" on the #746/#747 previews, which CI's own
// build of the same commit did not have. The bundle shapes below are what
// rollup hands generateBundle (each chunk's static `imports`).

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
