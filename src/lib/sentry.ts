// Sentry wire-up for the public site. No-ops gracefully when VITE_SENTRY_DSN
// is unset (so previews and local dev stay quiet). Pairs with src/main.tsx
// (calls initSentry once) and src/components/ErrorBoundary.tsx (captures
// uncaught render errors and surfaces the resulting event ID).

import * as Sentry from '@sentry/react';
import { isStaleChunkError } from './staleChunk';

const viteEnv =
  (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;

const SENTRY_DSN =
  viteEnv?.VITE_SENTRY_DSN && viteEnv.VITE_SENTRY_DSN.trim()
    ? viteEnv.VITE_SENTRY_DSN.trim()
    : null;

const RELEASE_ID =
  (viteEnv?.VITE_VERCEL_GIT_COMMIT_SHA && viteEnv.VITE_VERCEL_GIT_COMMIT_SHA.trim()) ||
  (viteEnv?.VITE_RELEASE && viteEnv.VITE_RELEASE.trim()) ||
  'dev';

const ENVIRONMENT =
  (viteEnv?.VITE_VERCEL_ENV && viteEnv.VITE_VERCEL_ENV.trim()) ||
  (viteEnv?.MODE && viteEnv.MODE.trim()) ||
  'development';

let _initialized = false;

export function isSentryEnabled(): boolean {
  return Boolean(SENTRY_DSN);
}

// --- Injected / third-party-script noise classifier -----------------------
// A recurring class of events (BACHATA-WEBSITE-N "Maximum call stack",
// BACHATA-WEBSITE-2A "Error: he") comes entirely from scripts injected by the
// client &mdash; in-app browsers (WhatsApp/Instagram), content blockers,
// Chrome-iOS injected JS &mdash; never from our bundle. They share one verified
// signature: every stack frame's file location is junk ("undefined" /
// "<anonymous>" / empty).
//
// NOTE: `in_app` is NOT a usable discriminator &mdash; Sentry marks these frames
// in_app:true, identical to our own (verified on the live BACHATA-WEBSITE-N
// event). We key off the file location instead: a genuine error in our code
// always has >=1 frame pointing at an `/assets/*.js` chunk (or, once sourcemaps
// resolve, a `.tsx` source path), so this never drops a real bug.
const JUNK_FRAME_LOCATIONS = new Set([
  '',
  'undefined',
  'null',
  '<anonymous>',
  '[native code]',
  '?',
]);

type MinimalFrame = { filename?: string; abs_path?: string };
type MinimalEvent = {
  exception?: { values?: Array<{ value?: string; stacktrace?: { frames?: MinimalFrame[] } }> };
  message?: string;
};

function frameHasRealSource(frame: MinimalFrame): boolean {
  const loc = frame.abs_path || frame.filename;
  if (!loc || typeof loc !== 'string') return false;
  return !JUNK_FRAME_LOCATIONS.has(loc.trim());
}

// True when the event HAS stack frames but EVERY one lacks a usable source
// location -> it originated entirely in injected/third-party code.
export function isInjectedThirdPartyEvent(event: MinimalEvent): boolean {
  const values = event.exception?.values;
  if (!values?.length) return false;
  let sawFrame = false;
  for (const v of values) {
    for (const f of v.stacktrace?.frames ?? []) {
      sawFrame = true;
      if (frameHasRealSource(f)) return false;
    }
  }
  return sawFrame;
}

// --- Stale-deploy chunk-load noise ----------------------------------------
// After a Vercel deploy, cached HTML references hashed chunk URLs that no longer
// exist, producing a family of handled errors (BACHATA-WEBSITE-7/-2J/-11/-3:
// "Importing a module script failed", "Failed to fetch dynamically imported
// module", "Unable to preload CSS", ...). These are fully recovered:
// lazyWithRetry reloads once and ErrorBoundary skips the pre-reload capture, so
// 0 users are impacted. The events that still reach Sentry are post-reload
// stragglers plus captures from Sentry's global onerror / unhandledrejection
// handlers that bypass the boundary skip. We drop the whole family here.
//
// Tradeoff: this also discards the "reload didn't fix it" tail. Acceptable
// &mdash; it is handled and zero-impact, and a genuinely broken deploy surfaces
// via Vercel build status, not these issues. Reuses STALE_CHUNK_RE
// (staleChunk.ts) so the pattern stays in ONE place.
export function isStaleChunkEvent(
  event: MinimalEvent,
  hint?: { originalException?: unknown },
): boolean {
  const orig = hint?.originalException;
  if (orig != null && isStaleChunkError(orig)) return true;
  for (const v of event.exception?.values ?? []) {
    if (v.value && isStaleChunkError(v.value)) return true;
  }
  return Boolean(event.message && isStaleChunkError(event.message));
}

// Coerces anything thrown/captured into a real Error. Supabase PostgREST errors
// arrive as plain objects ({ code, message, details, hint }); without this they
// surface in Sentry as "Object captured as exception with keys: cod...".
function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>;
    const msg =
      (typeof v.message === 'string' && v.message) ||
      (typeof v.error_description === 'string' && v.error_description) ||
      (typeof v.code === 'string' && `Supabase error ${v.code}`) ||
      JSON.stringify(value);
    const err = new Error(msg);
    (err as Error & { original?: unknown }).original = value;
    return err;
  }
  return new Error(String(value));
}

export function initSentry(): void {
  if (_initialized) return;
  if (!SENTRY_DSN) {
    if (typeof console !== 'undefined' && ENVIRONMENT !== 'production') {
      // eslint-disable-next-line no-console
      console.info(
        '[sentry] VITE_SENTRY_DSN not set &mdash; Sentry disabled. Add the DSN to ' +
          'Vercel project env (production scope) to enable.',
      );
    }
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    release: RELEASE_ID,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    // Browser network-layer fetch failures (Safari "Load failed", Chrome
    // "Failed to fetch") are users losing signal or navigating away mid-fetch
    // &mdash; the affected queries already retry once and surface RetryNotice.
    // Genuine PostgREST errors carry a code/details message and still report.
    ignoreErrors: [
      'Load failed',
      'Failed to fetch',
      'NetworkError when attempting to fetch resource',
    ],
    // Synthesize a stack for thrown non-Errors (strings, plain objects) so
    // events like "Error: he" are attributable to a frame.
    attachStacktrace: true,
    beforeSend(event, hint) {
      // Drop injected / third-party-script noise (see isInjectedThirdPartyEvent).
      // Safe: only fires when every frame lacks a real source location, which our
      // own bundle errors never do.
      if (isInjectedThirdPartyEvent(event)) return null;

      // Drop handled stale-deploy chunk-load failures (see isStaleChunkEvent).
      if (isStaleChunkEvent(event, hint)) return null;

      const orig = hint?.originalException;
      if (orig && !(orig instanceof Error) && typeof orig === 'object') {
        const e = toError(orig);
        // Override only the message &mdash; replacing event.exception wholesale
        // discards the stacktrace and mechanism Sentry already attached.
        const first = event.exception?.values?.[0];
        if (first) {
          first.type = 'Error';
          first.value = e.message;
        } else {
          event.exception = { values: [{ type: 'Error', value: e.message }] };
        }
        event.message = e.message;
      }
      return event;
    },
  });
  _initialized = true;
}

export function captureException(
  err: unknown,
  context?: Record<string, unknown>,
): string | undefined {
  if (!isSentryEnabled()) {
    if (typeof console !== 'undefined') {
      // eslint-disable-next-line no-console
      console.error('[sentry-disabled] captureException', err, context);
    }
    return undefined;
  }
  return Sentry.captureException(toError(err), context ? { extra: context } : undefined);
}

export function captureMessage(
  message: string,
  context?: Record<string, unknown>,
): string | undefined {
  if (!isSentryEnabled()) {
    if (typeof console !== 'undefined') {
      // eslint-disable-next-line no-console
      console.warn('[sentry-disabled] captureMessage', message, context);
    }
    return undefined;
  }
  return Sentry.captureMessage(message, context ? { extra: context } : undefined);
}
