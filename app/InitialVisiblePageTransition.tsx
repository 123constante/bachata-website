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
// Set SYNCHRONOUSLY when a warm is scheduled, so routes mounted while the first
// import is still in flight do not each queue another one. Cleared on failure so
// a genuine retry still happens on the next route mount.
let warming = false;

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
    if (warmed || warming) return;
    warming = true;
    const warm = () => {
      void safeDynamicImport(() => import("@/components/PageTransition"))
        .then(() => {
          warmed = true;
        })
        .catch(() => {
          warming = false;
        });
    };
    // Short deadline on purpose: the point is to yield to hydration's long task,
    // NOT to wait out the reader. A 2s timeout is longer than a typical time to
    // first tap on a feed, so the chunk would still be unloaded when the
    // navigation needs it and the fade would fall back -- the exact thing this
    // warm exists to prevent.
    // typeof, NOT `"requestIdleCallback" in window`: because lib.dom declares the
    // method on Window, the `in` form exhaustively narrows and types `window` as
    // `never` on the else path -- so TypeScript checked NOTHING on the fallback
    // branch, which is the one that matters most here (iOS Safari < 16.4).
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(warm, { timeout: 600 });
      return;
    }
    // No requestIdleCallback: iOS Safari only shipped it in 16.4, and this site
    // is ~95% mobile, so this branch is the one that matters most. A bare timer
    // is wrong here -- it fires on schedule whether or not the main thread is
    // busy, so a 500ms one lands INSIDE hydration on exactly the slow devices
    // this work is meant to help. Wait for load instead, then let two frames
    // pass, which yields until the browser has actually painted.
    // rAF yields until the browser has actually painted -- but it does NOT run
    // in a hidden tab, and `warming` has already latched, so a document that
    // loads in the background would never warm and never retry. The timer is the
    // floor that guarantees warm() itself runs; rAF only gets to move it later,
    // never to cancel it.
    const deferred = () => {
      let ran = false;
      const go = () => {
        if (ran) return;
        ran = true;
        warm();
      };
      requestAnimationFrame(() => requestAnimationFrame(go));
      window.setTimeout(go, 1000);
    };
    if (document.readyState === "complete") {
      deferred();
      return;
    }
    // Raced against a deadline, so `load` is a hint and not a dependency. A
    // single stalled subresource (a hanging third-party image, an iframe that
    // never completes) can keep `load` pending indefinitely -- and because
    // `warming` latches synchronously above, that would mean no route mount ever
    // retries and the chunk is never warmed for the whole session. The rIC
    // branch gets this guarantee from its timeout; this is the equivalent.
    let fired = false;
    const once = () => {
      if (fired) return;
      fired = true;
      window.removeEventListener("load", once);
      deferred();
    };
    window.addEventListener("load", once);
    window.setTimeout(once, 2000);
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
