// Sentry wire-up for the public site -- split into a lightweight FACADE (this
// file: env parsing, noise classifiers, a capture queue; NO @sentry/react
// import) and the real SDK in ./sentryCore, loaded via dynamic import.
//
// Rationale (perf programme, Pillar A): @sentry/react + browserTracing is
// ~50KB gz and was statically imported by always-loaded modules (root, useAuth,
// App's QueryCache onError), putting it on the hydration critical path of every
// page. As a facade the SDK chunk loads on idle (see entry.client); captures
// that fire before it lands are queued here and replayed after init, so no
// error is lost -- only its report is delayed by a second or two.
//
// No-ops gracefully when VITE_SENTRY_DSN is unset (previews and local dev stay
// quiet). Server-side captures stay console-only: entry.server has its own
// sentry.server wiring, and the browser SDK must never init inside node.

import { isStaleChunkError } from './staleChunk';

const viteEnv =
  (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;

export const SENTRY_DSN =
  viteEnv?.VITE_SENTRY_DSN && viteEnv.VITE_SENTRY_DSN.trim()
    ? viteEnv.VITE_SENTRY_DSN.trim()
    : null;

export const RELEASE_ID =
  (viteEnv?.VITE_VERCEL_GIT_COMMIT_SHA && viteEnv.VITE_VERCEL_GIT_COMMIT_SHA.trim()) ||
  (viteEnv?.VITE_RELEASE && viteEnv.VITE_RELEASE.trim()) ||
  'dev';

export const ENVIRONMENT =
  (viteEnv?.VITE_VERCEL_ENV && viteEnv.VITE_VERCEL_ENV.trim()) ||
  (viteEnv?.MODE && viteEnv.MODE.trim()) ||
  'development';

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
export type MinimalEvent = {
  exception?: { values?: Array<{ value?: string; type?: string; stacktrace?: { frames?: MinimalFrame[] } }> };
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
export function toError(value: unknown): Error {
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

// --- Deferred SDK loading + pre-init capture queue -------------------------

type SentryCore = typeof import('./sentryCore');

let core: SentryCore | null = null;
let coreLoading: Promise<SentryCore | null> | null = null;

type QueuedCapture =
  | {
      kind: 'exception';
      payload: unknown;
      context?: Record<string, unknown>;
      onEventId?: (id: string) => void;
    }
  | { kind: 'message'; payload: string; context?: Record<string, unknown> };

// Bounded so a pre-init error loop can't grow memory unchecked.
const QUEUE_LIMIT = 20;
const queue: QueuedCapture[] = [];

// Last-write-wins user identity set before the SDK lands (undefined = never
// set). Applied before the queue replays so pre-init captures carry the user.
let pendingUser: { id: string } | null | undefined;

function loadCore(): Promise<SentryCore | null> {
  if (core) return Promise.resolve(core);
  coreLoading ??= import('./sentryCore')
    .then((mod) => {
      mod.initSentryCore();
      core = mod;
      if (pendingUser !== undefined) {
        mod.setUserCore(pendingUser);
        pendingUser = undefined;
      }
      for (const q of queue.splice(0)) {
        if (q.kind === 'exception') {
          const id = mod.captureExceptionCore(q.payload, q.context);
          if (id) q.onEventId?.(id);
        } else {
          mod.captureMessageCore(q.payload, q.context);
        }
      }
      return mod;
    })
    .catch(() => {
      // SDK chunk failed to load (offline / stale deploy) -- stay silent; the
      // queued events are lost, which matches the SDK itself failing to boot.
      return null;
    });
  return coreLoading;
}

// Kicks off the deferred SDK load. Call from entry.client on idle -- calling
// it eagerly would defeat the whole point of the facade. Returns a promise that
// resolves once the SDK core has landed (or immediately when disabled / on the
// server), so the caller can keep its own pre-init error buffer alive until
// Sentry's global handlers are installed -- otherwise there's a window during
// the (deliberately un-preloaded) chunk fetch where neither the buffer nor the
// SDK is catching uncaught errors.
export function initSentry(): Promise<void> {
  if (!SENTRY_DSN) {
    if (typeof console !== 'undefined' && ENVIRONMENT !== 'production') {
      // eslint-disable-next-line no-console
      console.info(
        '[sentry] VITE_SENTRY_DSN not set &mdash; Sentry disabled. Add the DSN to ' +
          'Vercel project env (production scope) to enable.',
      );
    }
    return Promise.resolve();
  }
  if (typeof window === 'undefined') return Promise.resolve(); // browser SDK: never init in node
  return loadCore().then(() => undefined);
}

export function captureException(
  err: unknown,
  context?: Record<string, unknown>,
  // Called with the real Sentry event ID -- synchronously when the SDK is
  // already loaded, or later when a queued capture replays after init. The
  // sync return stays undefined in the queued case, so callers that show a
  // user-facing ref (ErrorBoundary) must use this instead of the return.
  onEventId?: (id: string) => void,
): string | undefined {
  if (!SENTRY_DSN || typeof window === 'undefined') {
    if (typeof console !== 'undefined') {
      // eslint-disable-next-line no-console
      console.error('[sentry-disabled] captureException', err, context);
    }
    return undefined;
  }
  if (core) {
    const id = core.captureExceptionCore(err, context);
    if (id) onEventId?.(id);
    return id;
  }
  if (queue.length < QUEUE_LIMIT) {
    queue.push({ kind: 'exception', payload: err, context, onEventId });
  }
  void loadCore();
  // Event ID is unknowable until the SDK lands; it is delivered via onEventId
  // when the queued capture replays after init.
  return undefined;
}

// Associates captures with the signed-in user (id only; no PII). Does NOT
// trigger the SDK load by itself -- entry.client's idle init owns that; the
// identity is stashed and applied when the core lands.
export function setSentryUser(user: { id: string } | null): void {
  if (!SENTRY_DSN || typeof window === 'undefined') return;
  if (core) {
    core.setUserCore(user);
    return;
  }
  pendingUser = user;
}

export function captureMessage(
  message: string,
  context?: Record<string, unknown>,
): string | undefined {
  if (!SENTRY_DSN || typeof window === 'undefined') {
    if (typeof console !== 'undefined') {
      // eslint-disable-next-line no-console
      console.warn('[sentry-disabled] captureMessage', message, context);
    }
    return undefined;
  }
  if (core) return core.captureMessageCore(message, context);
  if (queue.length < QUEUE_LIMIT) queue.push({ kind: 'message', payload: message, context });
  void loadCore();
  return undefined;
}
