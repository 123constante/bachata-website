// Server-side Sentry for SSR loader/render errors. The client SDK (src/lib/
// sentry.ts) only sees the browser; before this, a throw in an RR7 loader or
// during server render was invisible to Sentry (only reachable via Vercel
// function logs). This module initialises @sentry/react-router's Node client
// ONCE per function instance and exposes a capture helper wired into
// entry.server's handleError.
//
// Scope deliberately narrow: ERROR capture only. We do NOT enable performance
// tracing / OpenTelemetry auto-instrumentation here, because that needs a
// preloaded instrumentation module (`--import`) which the Vercel react-router
// preset does not make straightforward — and error capture works without it.
// Runtime capture should still be confirmed on a Vercel PREVIEW deploy, since
// the serverless runtime differs from a local build.
import * as Sentry from "@sentry/react-router";

// Server env is process.env (not Vite's inlined import.meta.env). VITE_-prefixed
// vars are present in the Vercel Node runtime too, so we accept either name.
const DSN =
  process.env.SENTRY_DSN?.trim() || process.env.VITE_SENTRY_DSN?.trim() || null;

const RELEASE =
  process.env.VITE_VERCEL_GIT_COMMIT_SHA?.trim() ||
  process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
  process.env.VITE_RELEASE?.trim() ||
  "dev";

const ENVIRONMENT =
  process.env.VITE_VERCEL_ENV?.trim() ||
  process.env.VERCEL_ENV?.trim() ||
  process.env.NODE_ENV?.trim() ||
  "development";

let initialised = false;

function ensureInit(): boolean {
  if (initialised) return true;
  if (!DSN) return false;
  Sentry.init({
    dsn: DSN,
    environment: ENVIRONMENT,
    release: RELEASE,
    // Errors only — no tracing (see module header).
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
  initialised = true;
  return true;
}

/**
 * Capture an SSR-side exception. No-ops (returns undefined) when no DSN is
 * configured — previews/local stay quiet, exactly like the client SDK.
 */
export function captureServerException(
  error: unknown,
  context?: Record<string, unknown>,
): string | undefined {
  if (!ensureInit()) return undefined;
  const err = error instanceof Error ? error : new Error(String(error));
  return Sentry.captureException(err, {
    tags: { boundary: "ssr" },
    extra: context,
  });
}
