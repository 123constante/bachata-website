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
  return Sentry.captureException(err, context ? { extra: context } : undefined);
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
