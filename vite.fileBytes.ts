import { readFile } from "node:fs/promises";
import type { Plugin } from "vite";

// `import b64 from "./x.ttf?bytes"` -> the file's bytes as a base64 string
// literal, baked into whichever bundle imports it. Used by the OG card renderer
// (app/lib/ogCardRender.ts) so its fonts need no network at runtime: before
// 2026-11-04 they were fetched from the site's own public origin on every cold
// start, and when that connect stalled every share preview broke.
//
// A plugin rather than Vite's built-in `?inline` because vitest does NOT
// inline `?inline` assets (it returns the file path), so a test could never
// exercise the decode path the build ships. This plugin is registered in BOTH
// vite.config.ts and vitest.config.ts, so tests and the server build read the
// fonts through the same code. Only the server graph imports a `?bytes` id;
// scripts/check-bundle-budget.mjs is what proves no client chunk grew.
export const BYTES_QUERY = "?bytes";

export function fileBytesPlugin(): Plugin {
  return {
    name: "file-bytes-base64",
    enforce: "pre",
    async load(id) {
      if (!id.endsWith(BYTES_QUERY)) return null;
      const file = id.slice(0, -BYTES_QUERY.length);
      this.addWatchFile(file);
      const b64 = (await readFile(file)).toString("base64");
      return { code: `export default ${JSON.stringify(b64)};`, map: null };
    },
  };
}
