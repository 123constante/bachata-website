import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { sentryVitePlugin } from "@sentry/vite-plugin";

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
    react(),
    mode === "development" && componentTagger(),
    sentryAuthToken && sentryOrg && sentryProject &&
      sentryVitePlugin({
        authToken: sentryAuthToken,
        org: sentryOrg,
        project: sentryProject,
        // Pin the release so uploaded sourcemaps associate with the exact
        // release the client reports at runtime (see comment above).
        release: sentryRelease ? { name: sentryRelease } : undefined,
        sourcemaps: { assets: "./dist/**" },
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
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-motion': ['framer-motion'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-map': ['leaflet', 'leaflet.markercluster'],
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-popover',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-avatar',
            '@radix-ui/react-slot',
          ],
        },
      },
    },
  },
}));
