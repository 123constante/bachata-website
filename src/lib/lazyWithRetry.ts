// Shared stale-chunk-resilient lazy loading. This is the ONE place `lazy()` is
// called directly — every code-split import in the app must route through
// `lazyWithRetry` (enforced by the `local/no-bare-lazy-imports` ESLint rule) so a
// chunk-load failure after a Vercel deploy is healed identically everywhere.
//
// A bare `lazy(() => import(...))` nested inside an already-lazy component (e.g.
// EventMap inside MobileMapHome, FestivalDetail inside EventPage) was the original
// gap: when its hashed chunk 404s against stale cached HTML, the failure hit the
// error boundary with no retry. Routing through here triggers ONE reload to pick
// up fresh HTML instead. Detection + the once-per-session reload flag live in
// `lib/staleChunk.ts`, shared with the vite:preloadError handler (main.tsx).

import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import {
  isStaleChunkError,
  attemptChunkReloadOnce,
  clearChunkReloadFlag,
} from "@/lib/staleChunk";

export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      const mod = await factory();
      clearChunkReloadFlag();
      return mod;
    } catch (err) {
      if (isStaleChunkError(err) && attemptChunkReloadOnce()) {
        // Reload initiated — return a never-resolving promise so React keeps the
        // Suspense fallback up until the page navigates, instead of flashing an
        // error boundary.
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}

// For non-component dynamic `import()` of on-demand libraries (canvas-confetti,
// world-countries, …). Same stale-chunk healing: a deploy-stale chunk triggers
// the once-per-session reload; any other rejection propagates to the caller
// unchanged.
export async function safeDynamicImport<T>(factory: () => Promise<T>): Promise<T> {
  try {
    const mod = await factory();
    clearChunkReloadFlag();
    return mod;
  } catch (err) {
    if (isStaleChunkError(err) && attemptChunkReloadOnce()) {
      return new Promise<T>(() => {});
    }
    throw err;
  }
}
