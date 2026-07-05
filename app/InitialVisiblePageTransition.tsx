import { useEffect, useState, type ReactNode } from "react";
import { PageTransition } from "@/components/PageTransition";
import { RouteOwnsHeadContext } from "@/lib/seo";

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
  }, []);
  // Every framework route funnels through here, and every framework route emits
  // its head via meta() — so signal useSeo() to stand down (no double head
  // management / title marquee) for the whole subtree.
  return (
    <RouteOwnsHeadContext.Provider value={true}>
      {animate ? (
        <PageTransition>{children}</PageTransition>
      ) : (
        <div style={{ width: "100%", minHeight: "100vh" }}>{children}</div>
      )}
    </RouteOwnsHeadContext.Provider>
  );
}
