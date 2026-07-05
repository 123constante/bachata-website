import { startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";
import { initSentry } from "@/lib/sentry";
import { attemptChunkReloadOnce } from "@/lib/staleChunk";

// Carries over EVERY browser-only side effect from src/main.tsx (the SPA entry,
// dead on this branch). Dropping any of these is a silent regression:
// - initSentry() — error reporting
// - vite:preloadError → attemptChunkReloadOnce() — lazyWithRetry's deploy-skew recovery
// - history.scrollRestoration='manual' — otherwise the browser fights ScrollToTop
// - async Google-Fonts loader — decorative fonts (Cormorant/Bebas/etc.)
initSentry();

if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", () => {
    attemptChunkReloadOnce();
  });

  if ("scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
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
