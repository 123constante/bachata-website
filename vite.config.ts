import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { reactRouter } from "@react-router/dev/vite";
import path from "path";
import { classifyChunk } from "./vite.chunks";
// lovable-tagger (componentTagger) is intentionally NOT restored under framework
// mode: it's a dev-only Lovable annotation, non-essential, and untested against
// the reactRouter() dev plugin. Re-add later behind a dev guard if wanted.

// The manualChunks classifier and its two package lists live in
// ./vite.chunks.ts -- extracted so tests/chunkClassifier.test.ts can call the
// classifier with real module ids. That file carries the full reasoning for
// each group (including the two wider rules that were measured and rejected);
// re-measure with the command in its header before editing either list.

// https://vitejs.dev/config/
export default defineConfig(({ isSsrBuild }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    // reactRouter() owns the React transform in framework mode. vitest cannot
    // load the RR plugin, so fall back to plugin-react-swc under VITEST.
    process.env.VITEST ? react() : reactRouter(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: "hidden",
    // Client-build manifest feeds scripts/check-bundle-budget.mjs (perf
    // programme, Pillar D): it walks the entry/route import graphs to enforce
    // first-load JS budgets in CI. Never emitted for the server build.
    manifest: !isSsrBuild,
    // Function-form manualChunks, CLIENT BUILD ONLY (the guard matters: the RR7
    // server build uses inlineDynamicImports, which any manualChunks breaks --
    // that conflict is why the old object-form config was removed). Pins the
    // stable heavy vendors into their own chunks so a route-code change doesn't
    // re-hash -- and so re-download -- framer-motion/query/supabase/sentry for
    // returning visitors.
    //
    // React core MUST be pinned too, as one chunk with react-dom + scheduler
    // (the lockstep trio -- never split them apart). Left unpinned, rollup fused
    // react into vendor-motion (verified in the build manifest: every chunk
    // imported vendor-motion just to reach useState), which silently dragged
    // framer-motion's ~44KB gz back into the first load of every page -- the
    // exact regression this config exists to prevent. The bundle-budget CI
    // check is the tripwire if this ever recurs.
    //
    // The 2026-08-14 request-count groups below (vendor-icons, vendor-ui,
    // vendor-ui-modal) trade AGAINST that cache-hit argument, and the trade is
    // deliberate rather than overlooked. A single Radix patch inside a routine
    // dependabot batch now re-hashes the whole vendor-ui chunk where it used to
    // re-hash one tiny per-package chunk, and adding one icon re-hashes all of
    // vendor-icons. It is still the right side of the trade while Vercel meters
    // edge REQUESTS and this account is well over allowance on them while
    // comfortable on bytes: the re-download is paid once per deploy by
    // returning visitors, the request count is paid by every visitor on every
    // page. Revisit if that ratio ever inverts. .github/dependabot.yml holds
    // majors of these packages out of the weekly batch for the same reason it
    // already held the older tuned chunks.
    ...(!isSsrBuild
      ? {
          rollupOptions: {
            output: {
              manualChunks: classifyChunk,
            },
          },
        }
      : {}),
  },
}));
