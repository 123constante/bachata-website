// The REAL Sentry client -- the only module that imports @sentry/react. Loaded
// exclusively via dynamic import from ./sentry (the facade), on idle after
// hydration, so the ~50KB SDK never sits on the critical path. Import this
// module statically from anywhere else and the perf win is silently gone --
// scripts/check-bundle-budget.mjs's entry budget is the tripwire for that.
//
// The import cycle facade -> (dynamic) -> core -> (static) -> facade is
// intentional and safe: the dynamic edge breaks the static cycle, and the
// classifier/env exports the core pulls from the facade have no further deps.

import * as Sentry from '@sentry/react';
import {
  ENVIRONMENT,
  RELEASE_ID,
  SENTRY_DSN,
  isInjectedThirdPartyEvent,
  isStaleChunkEvent,
  toError,
  type MinimalEvent,
} from './sentry';

let _initialized = false;

export function initSentryCore(): void {
  if (_initialized || !SENTRY_DSN) return;

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
      if (isInjectedThirdPartyEvent(event as MinimalEvent)) return null;

      // Drop handled stale-deploy chunk-load failures (see isStaleChunkEvent).
      if (isStaleChunkEvent(event as MinimalEvent, hint)) return null;

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

export function captureExceptionCore(
  err: unknown,
  context?: Record<string, unknown>,
): string | undefined {
  return Sentry.captureException(toError(err), context ? { extra: context } : undefined);
}

export function captureMessageCore(
  message: string,
  context?: Record<string, unknown>,
): string | undefined {
  return Sentry.captureMessage(message, context ? { extra: context } : undefined);
}

export function setUserCore(user: { id: string } | null): void {
  Sentry.setUser(user);
}
