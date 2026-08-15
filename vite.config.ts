import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { reactRouter } from "@react-router/dev/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import path from "path";
import { classifyChunk } from "./vite.chunks";
// lovable-tagger (componentTagger) is intentionally NOT restored under framework
// mode: it's a dev-only Lovable annotation, non-essential, and untested against
// the reactRouter() dev plugin. Re-add later behind a dev guard if wanted.

// Source-map upload to Sentry only runs when SENTRY_AUTH_TOKEN is set
// (Vercel build-time secret). Local builds without the token still produce
// hidden source maps but skip the upload.
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
const sentryOrg = process.env.SENTRY_ORG;
const sentryProject = process.env.SENTRY_PROJECT;

// Pin the uploaded-artifact release to the EXACT value the runtime client reports
// (src/lib/sentry.ts: RELEASE_ID = VITE_VERCEL_GIT_COMMIT_SHA || VITE_RELEASE).
// Both sides read the same VITE_-prefixed vars in the same order, so the upload
// release == runtime release by construction.
//
// Vercel always exposes the un-prefixed VERCEL_GIT_COMMIT_SHA at build time, but
// Vite never inlines an un-prefixed var into the client bundle — so on its own the
// runtime couldn't report it. Promote it into the VITE_ namespace here (before Vite
// snapshots env for inlining) when no explicit release var is set: now Vite DOES
// inline it AND the upload below reads the same value, so upload release == runtime
// release with zero dashboard env config. An explicit VITE_VERCEL_GIT_COMMIT_SHA /
// VITE_RELEASE still wins.
if (
  !process.env.VITE_VERCEL_GIT_COMMIT_SHA &&
  !process.env.VITE_RELEASE &&
  process.env.VERCEL_GIT_COMMIT_SHA
) {
  process.env.VITE_VERCEL_GIT_COMMIT_SHA = process.env.VERCEL_GIT_COMMIT_SHA;
}

const sentryRelease =
  process.env.VITE_VERCEL_GIT_COMMIT_SHA || process.env.VITE_RELEASE;

// The manualChunks classifier and its two package lists live in
// ./vite.chunks.ts -- extracted so tests/chunkClassifier.test.ts can call the
// classifier with real module ids. That file carries the full reasoning for
// each group (including the two wider rules that were measured and rejected);
// re-measure with the command in its header before editing either list.

// Self-policing: a Vercel PRODUCTION build that can't upload+associate sourcemaps
// would silently ship a release whose prod errors are undebuggable. Fail the build
// instead so the gap can't go unnoticed. The release var is required too — without
// it the upload and the runtime would disagree (see above).
if (process.env.VERCEL_ENV === "production") {
  const missing = [
    !sentryAuthToken && "SENTRY_AUTH_TOKEN",
    !sentryOrg && "SENTRY_ORG",
    !sentryProject && "SENTRY_PROJECT",
    !sentryRelease &&
      "VITE_VERCEL_GIT_COMMIT_SHA (or VITE_RELEASE) — the release the client reports; without it uploaded sourcemaps can't associate",
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(
      `[sentry] Production build is missing required env var(s): ${missing.join(
        ", ",
      )}. Sourcemaps would not upload/resolve — add them to the Vercel Production scope.`,
    );
  }
}

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
    // Sentry sourcemap upload. Framework mode emits to build/client + build/server
    // (was dist/** under the SPA). Runtime Sentry is browser-only, so the client
    // bundle's maps are the ones that resolve prod errors; server maps included so
    // loader/SSR stack frames also symbolicate. Only active with SENTRY_AUTH_TOKEN
    // (Vercel prod scope) — dormant on local + preview builds.
    sentryAuthToken && sentryOrg && sentryProject &&
      sentryVitePlugin({
        authToken: sentryAuthToken,
        org: sentryOrg,
        project: sentryProject,
        release: sentryRelease
          ? {
              name: sentryRelease,
              setCommits: { auto: true, ignoreMissing: true },
            }
          : undefined,
        sourcemaps: { assets: ["./build/client/**", "./build/server/**"] },
        telemetry: false,
      }),
  ].filter(Boolean),
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
