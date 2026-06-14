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

// The release name uploaded artifacts are tagged with MUST match the release
// the running client reports (src/lib/sentry.ts reads VITE_VERCEL_GIT_COMMIT_SHA).
// Without pinning it, @sentry/vite-plugin auto-detects a release that can drift
// from the runtime value, leaving prod stack frames minified. VERCEL_GIT_COMMIT_SHA
// is Vercel's build-time auto var; VITE_VERCEL_GIT_COMMIT_SHA is the one mirrored
// to the client bundle.
const sentryRelease =
  process.env.VITE_VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA;

// Self-policing: a Vercel PRODUCTION build with a missing Sentry credential would
// silently ship a sourcemap-less release (every prod error then undebuggable).
// Fail the build instead so the gap can't go unnoticed.
if (process.env.VERCEL_ENV === "production") {
  const missing = [
    !sentryAuthToken && "SENTRY_AUTH_TOKEN",
    !sentryOrg && "SENTRY_ORG",
    !sentryProject && "SENTRY_PROJECT",
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(
      `[sentry] Production build is missing required env var(s): ${missing.join(
        ", ",
      )}. Sourcemaps would not upload — add them to the Vercel Production scope.`,
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
