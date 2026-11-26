import { useEffect, useRef } from "react";
import { useNavigation } from "react-router";

// Stale-tab refresh: a tab on an old deploy gets the new one on its NEXT page tap
// (full load instead of a client-side nav). No banner, nothing typed is lost.
const CHECK_EVERY_MS = 5 * 60 * 1000;
let stale = false;

export const isStaleTab = () => stale;
export const resetStaleTab = () => {
  stale = false;
};

export function idsDiffer(baked: string | undefined, live: string | undefined): boolean {
  return !!baked && !!live && baked !== live;
}

// credentials 'omit' is REQUIRED: the __vdpl skew cookie would pin this request
// to the tab's own old deploy and it would always report "same".
export async function checkStaleTab(baked: string | undefined, fetchFn: typeof fetch = fetch): Promise<void> {
  try {
    const res = await fetchFn("/api/version", { credentials: "omit", cache: "no-store" });
    const body = (await res.json()) as { id?: unknown };
    if (typeof body?.id === "string" && idsDiffer(baked, body.id)) stale = true;
  } catch {
    // network / parse error: do nothing
  }
}

export function startStaleTabChecker(opts: {
  flagOn: boolean;
  deploymentId: string | undefined;
  fetchFn?: typeof fetch;
}): () => void {
  if (!opts.flagOn || !opts.deploymentId || typeof document === "undefined") return () => {};
  const run = () => void checkStaleTab(opts.deploymentId, opts.fetchFn);
  const timer = setInterval(() => {
    if (document.visibilityState === "visible") run();
  }, CHECK_EVERY_MS);
  const onVis = () => {
    if (document.visibilityState === "visible") run();
  };
  document.addEventListener("visibilitychange", onVis);
  return () => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onVis);
  };
}

// The target URL for a reload, or null. Form submissions are never reloaded.
export function staleReloadTarget(
  nav: { state: string; formMethod?: unknown; location?: { pathname: string; search: string; hash: string } },
  isStale: boolean,
): string | null {
  if (!isStale || nav.state !== "loading" || nav.formMethod || !nav.location) return null;
  return nav.location.pathname + nav.location.search + nav.location.hash;
}

// Call once in the root component (inside the router context).
export function useStaleTabRefresh(): void {
  const nav = useNavigation();
  const fired = useRef(false);
  useEffect(
    () =>
      startStaleTabChecker({
        flagOn: import.meta.env.VITE_ENABLE_STALE_TAB_REFRESH === "true",
        deploymentId: import.meta.env.VITE_VERCEL_DEPLOYMENT_ID,
      }),
    [],
  );
  useEffect(() => {
    if (fired.current) return;
    const to = staleReloadTarget(nav, stale);
    if (to) {
      fired.current = true;
      window.location.assign(to);
    }
  }, [nav]);
}
