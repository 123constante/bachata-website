import * as React from "react";

const MOBILE_BREAKPOINT = 768;

// useSyncExternalStore keeps SSR and the initial hydration render in agreement:
// getServerSnapshot returns false on the server AND for React's first (hydration)
// client render, so the markup matches; React then switches to the real viewport
// value immediately after hydration. Reading window.innerWidth directly in a
// useState initializer instead produced `true` on a mobile client vs `false` on
// the server → a hydration mismatch on every viewport-gated layout (e.g. the
// AppChrome bottom-nav spacer) under framework-mode SSR.
export function useIsMobile() {
  return React.useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.innerWidth < MOBILE_BREAKPOINT,
    () => false,
  );
}
