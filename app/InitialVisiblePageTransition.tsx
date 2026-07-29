import { Suspense, useEffect, useState, type ReactNode } from "react";
import { lazyWithRetry, safeDynamicImport } from "@/lib/lazyWithRetry";
import { RouteOwnsHeadContext } from "@/lib/seo";

// PageTransition is LAZY (perf, Pillar A): every framework route funnels
// through this wrapper, so a static import here was framer-motion's one
// remaining road into the first-load bundle of every page -- for a fade that
// only ever plays on the SECOND-plus client navigation (SSR + first mount
// render the plain div below). The chunk is warmed at the first idle moment
// after hydration (short deadline -- see below), so the first client nav
// usually has it cached; when it doesn't, the Suspense fallback renders the
// same plain wrapper (one navigation without the fade -- unnoticeable, not
// broken).
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

// Whether the PageTransition chunk warm has SUCCEEDED this session. Module-scoped
// so it survives the route unmounts that this component sees. Latched on the
// resolved import, never on merely attempting one: setting it up-front meant a
// single failed warm (offline, captive portal, an unhealable chunk 404) disabled
// warming for the rest of the session, so every later navigation fell back.
let warmed = false;

export function InitialVisiblePageTransition({ children }: { children: ReactNode }) {
  const [animate] = useState(() => clientNavigated);
  useEffect(() => {
    clientNavigated = true;
    // Warm the transition chunk once the main thread is idle rather than right
    // after hydration (perf, homepage TBT): this fires on every route, and a
    // straight-after-mount import competed with hydration's own long task.
    //
    // Deliberately NOT cancelled on unmount, and guarded to fire once per
    // session: the unmount that would cancel it IS the first client navigation
    // -- the exact moment the warmed chunk is needed. Cancelling there would
    // guarantee the Suspense fallback on every reader who taps through before
    // the idle callback runs. Nothing here touches state, so a callback landing
    // after unmount is inert.
    if (warmed) return;
    const warm = () => {
      void safeDynamicImport(() => import("@/components/PageTransition"))
        .then(() => {
          warmed = true;
        })
        .catch(() => {});
    };
    // Short deadlines on purpose: the point is to yield to hydration's long task,
    // NOT to wait out the reader. A 2s timeout is longer than a typical time to
    // first tap on a feed, so the chunk would still be unloaded when the
    // navigation needs it and the fade would fall back -- the exact thing this
    // warm exists to prevent.
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(warm, { timeout: 600 });
    } else {
      window.setTimeout(warm, 500);
    }
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
