import { Suspense, useEffect, useState, type ReactNode } from "react";
import { lazyWithRetry, safeDynamicImport } from "@/lib/lazyWithRetry";
import { RouteOwnsHeadContext } from "@/lib/seo";

// PageTransition is LAZY (perf, Pillar A): every framework route funnels
// through this wrapper, so a static import here was framer-motion's one
// remaining road into the first-load bundle of every page -- for a fade that
// only ever plays on the SECOND-plus client navigation (SSR + first mount
// render the plain div below). The chunk is warmed post-hydration, so the
// first client nav almost always has it cached; when it doesn't, the Suspense
// fallback renders the same plain wrapper (one navigation without the fade --
// unnoticeable, not broken).
const PageTransition = lazyWithRetry(() =>
  import("@/components/PageTransition").then((m) => ({ default: m.PageTransition })),
);

// Module-scoped: true once the app has performed at least one client-side
// navigation (any framework route mount after the first flips it). SSR and the
// initial hydration render read `false` → render the plain, visible wrapper that
// matches the SSR markup; only later CLIENT navigations play PageTransition's
// entrance fade (which serializes opacity:0 and would otherwise render the SSR
// document invisible).
//
// `animate` is FROZEN per-mount via useState and the flag is only mutated inside
// useEffect (never during render) — so a post-mount re-render can't flip the
// wrapper's element type (div ↔ motion.div) and tear down / remount the subtree.
let clientNavigated = false;

export function InitialVisiblePageTransition({ children }: { children: ReactNode }) {
  const [animate] = useState(() => clientNavigated);
  useEffect(() => {
    clientNavigated = true;
    // Warm the transition chunk once the main thread is idle rather than right
    // after hydration (perf, homepage TBT): this fires on every route, and a
    // straight-after-mount import competed with hydration's own long task.
    // requestIdleCallback yields to anything more urgent; the setTimeout
    // fallback (Safari has no rIC) and the 4000ms timeout both still land
    // comfortably before a reader's first navigation.
    const warm = () => {
      void safeDynamicImport(() => import("@/components/PageTransition")).catch(() => {});
    };
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(warm, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(warm, 3000);
    return () => window.clearTimeout(id);
  }, []);
  // Every framework route funnels through here, and every framework route emits
  // its head via meta() — so signal useSeo() to stand down (no double head
  // management / title marquee) for the whole subtree.
  const plain = <div style={{ width: "100%", minHeight: "100vh" }}>{children}</div>;
  return (
    <RouteOwnsHeadContext.Provider value={true}>
      {animate ? (
        <Suspense fallback={plain}>
          <PageTransition>{children}</PageTransition>
        </Suspense>
      ) : (
        plain
      )}
    </RouteOwnsHeadContext.Provider>
  );
}
