import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { reactRouter } from "@react-router/dev/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import path from "path";
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
export default defineConfig(() => ({
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
    // manualChunks intentionally NOT restored: framework mode already does
    // automatic per-route code-splitting, and the old object-form manualChunks
    // (listing external react/react-router-dom) conflicts with the RR7 server
    // build (inlineDynamicImports). Revisit with a function-form guarded on !ssr
    // only if bundle analysis shows a regression vs the SPA's vendor chunks.
  },
}));
