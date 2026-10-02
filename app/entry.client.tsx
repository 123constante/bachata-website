import { startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";
import { initWebVitals } from "@/lib/webVitals";
import { attemptChunkReloadOnce } from "@/lib/staleChunk";
import { scheduleDecorativeFonts } from "@/lib/decorativeFonts";

// Carries over EVERY browser-only side effect from src/main.tsx (the SPA entry,
// dead on this branch). Dropping any of these is a silent regression:

// - async Google-Fonts loader — decorative fonts (Cormorant/Bebas/etc.)

if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", () => {
    attemptChunkReloadOnce();
  });

  if ("scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
  }

  // Initialize web performance monitoring on idle.
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(initWebVitals, { timeout: 3000 });
  } else {
    window.setTimeout(initWebVitals, 2000);
  }

  scheduleDecorativeFonts();
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
