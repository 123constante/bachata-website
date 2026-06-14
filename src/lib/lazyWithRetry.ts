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

// The single heal implementation: await the dynamic import; on a deploy-stale
// chunk trigger the once-per-session reload (returning a never-settling promise so
// the caller doesn't act on the failed import in the brief window before
// navigation); any other rejection propagates unchanged. Used directly for
// on-demand library imports (world-countries, …) and wrapped by lazyWithRetry for
// components, so both heal identically.
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

export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  // Delegate to safeDynamicImport so the heal logic lives in ONE place; a
  // never-settling promise keeps React's Suspense fallback up until the reload.
  return lazy(() => safeDynamicImport(factory));
}
