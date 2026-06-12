// Sentry wire-up for the public site. No-ops gracefully when VITE_SENTRY_DSN
// is unset (so previews and local dev stay quiet). Pairs with src/main.tsx
// (calls initSentry once) and src/components/ErrorBoundary.tsx (captures
// uncaught render errors and surfaces the resulting event ID).

import * as Sentry from '@sentry/react';

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
        '[sentry] VITE_SENTRY_DSN not set — Sentry disabled. Add the DSN to ' +
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
    // — the affected queries already retry once and surface RetryNotice.
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
      const orig = hint?.originalException;
      if (orig && !(orig instanceof Error) && typeof orig === 'object') {
        const e = toError(orig);
        // Override only the message — replacing event.exception wholesale
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
