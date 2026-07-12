import { startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";
import { captureException, initSentry } from "@/lib/sentry";
import { initWebVitals } from "@/lib/webVitals";
import { attemptChunkReloadOnce } from "@/lib/staleChunk";

// Carries over EVERY browser-only side effect from src/main.tsx (the SPA entry,
// dead on this branch). Dropping any of these is a silent regression:
// - deferred initSentry() -- error reporting (idle-loaded; see below)
// - vite:preloadError → attemptChunkReloadOnce() — lazyWithRetry's deploy-skew recovery
// - history.scrollRestoration='manual' — otherwise the browser fights ScrollToTop
// - async Google-Fonts loader — decorative fonts (Cormorant/Bebas/etc.)

if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", () => {
    attemptChunkReloadOnce();
  });

  if ("scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
  }

  // Sentry + RUM are observability, not UI: neither is needed to paint, and
  // together they were ~50KB gz of parse/execute BEFORE hydrateRoot. Load them
  // on idle instead. Errors thrown in the pre-init window are buffered here and
  // replayed through the facade's queue, so nothing is lost -- its report is
  // just a second or two late.
  // Bounded like the facade's capture queue: a pre-init error loop must not
  // grow memory unchecked. Keeps the earliest errors (the root cause).
  const EARLY_ERROR_LIMIT = 20;
  const earlyErrors: unknown[] = [];
  const onEarlyError = (e: ErrorEvent) => {
    if (earlyErrors.length < EARLY_ERROR_LIMIT) earlyErrors.push(e.error ?? e.message);
  };
  const onEarlyRejection = (e: PromiseRejectionEvent) => {
    if (earlyErrors.length < EARLY_ERROR_LIMIT) earlyErrors.push(e.reason);
  };
  window.addEventListener("error", onEarlyError);
  window.addEventListener("unhandledrejection", onEarlyRejection);

  const startObservability = () => {
    // Keep the buffer listeners LIVE across the whole SDK-chunk fetch: initSentry
    // only kicks off an async import, so Sentry's own global handlers aren't
    // installed until it resolves. Tearing the listeners down (or flushing the
    // buffer) synchronously would leave uncaught errors thrown during that fetch
    // caught by nobody. Remove them and replay the buffer only once the core has
    // landed -- at which point Sentry's handlers cover everything after.
    void initSentry().finally(() => {
      window.removeEventListener("error", onEarlyError);
      window.removeEventListener("unhandledrejection", onEarlyRejection);
      for (const err of earlyErrors.splice(0)) {
        captureException(err, { boundary: "pre-sentry-init" });
      }
    });
    initWebVitals();
  };
  if ("requestIdleCallback" in window) {
    // timeout caps the wait on busy pages so error cover still arrives promptly.
    window.requestIdleCallback(startObservability, { timeout: 3000 });
  } else {
    window.setTimeout(startObservability, 2000);
  }

  window.addEventListener("load", () => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2" +
      "?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600" +
      "&family=Manrope:wght@400;500;600;700;800" +
      "&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700" +
      "&family=JetBrains+Mono:wght@400;500;700" +
      "&family=Bebas+Neue" +
      "&family=Archivo+Black" +
      "&family=Big+Shoulders+Display:wght@700;800;900" +
      "&display=swap";
    document.head.appendChild(link);
  });
}

startTransition(() => {
  hydrateRoot(document, <HydratedRouter />, {
    // Surface hydration mismatches with their component stack instead of the
    // opaque "Switched to client rendering" — routed to the console (and Sentry
    // captures console.error in prod) so SSR-safety regressions are diagnosable.
    onRecoverableError(error, errorInfo) {
      // eslint-disable-next-line no-console
      console.error("[hydration]", (error as Error)?.message, errorInfo?.componentStack);
    },
  });
});
