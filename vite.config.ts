import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { reactRouter } from "@react-router/dev/vite";
import path from "path";
// SPIKE (spike/rr7-framework-mode): componentTagger + sentryVitePlugin are
// dropped from the plugin list below to isolate framework-mode variables.
// Imports kept so the diff is minimal / easy to restore in Phase 3.
// import { componentTagger } from "lovable-tagger";
// import { sentryVitePlugin } from "@sentry/vite-plugin";

// Source-map upload to Sentry only runs when SENTRY_AUTH_TOKEN is set
// (Vercel build-time secret). Local builds without the token still produce
// hidden source maps but skip the upload.
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
const sentryOrg = process.env.SENTRY_ORG;
const sentryProject = process.env.SENTRY_PROJECT;

// Pin the uploaded-artifact release to the EXACT value the runtime client reports
// (src/lib/sentry.ts: RELEASE_ID = VITE_VERCEL_GIT_COMMIT_SHA || VITE_RELEASE).
// Both sides read the same VITE_-prefixed vars in the same order, so the upload
// release == runtime release by construction. We must NOT fall back to the
// un-prefixed VERCEL_GIT_COMMIT_SHA: Vite never inlines it into the client bundle,
// so the runtime can't report it — pinning to it would guarantee the very
// release-name mismatch this is meant to prevent.
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
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    // SPIKE: reactRouter() owns the React transform in framework mode. vitest
    // cannot load the RR plugin, so fall back to plugin-react-swc under VITEST.
    process.env.VITEST ? react() : reactRouter(),
    // componentTagger + sentryVitePlugin removed for the spike (see import note).
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: "hidden",
    // SPIKE: manualChunks removed — object-form manualChunks that lists external
    // deps (react / react-router-dom) conflicts with the RR7 server build
    // (inlineDynamicImports). Phase 3 re-adds it as function-form guarded on !ssr.
  },
}));
