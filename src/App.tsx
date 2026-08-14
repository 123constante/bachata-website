import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { captureException } from "@/lib/sentry";
import { pack, unpack } from "@/lib/dehydrateCodec";
import { BrowserRouter } from "react-router-dom";
import { ScrollToTop } from "@/components/ScrollToTop";
import { AuthProvider } from "@/hooks/useAuth";
import { CityProvider } from "@/contexts/CityContext";
import { AppChrome } from "@/components/AppChrome";
import { SearchProvider } from "@/components/search/SearchProvider";

// Global query defaults: 60s staleTime, single retry, refetch on window focus.
// Per-query staleTimes (2--5 min) still override where set.
//
// refetchOnWindowFocus was false for a while ("events change on the scale of
// days") -- but that premise is exactly why it must be true: a phone tab
// restored the next morning kept rendering yesterday's cached data ("in -1
// days" on /organisers, yesterday's events as "tonight"). Focus-refetch only
// refires queries older than their staleTime, so the cost is one request per
// stale query per tab-restore, not a storm.
//
// Phase 2: QueryCache/MutationCache route every silently-swallowed query and
// mutation error to Sentry so consumers that read .data without checking .error
// no longer hide failures from ops.
//
// SSR/ISR migration Phase 2: this construction is a FACTORY, not a module-level
// singleton, so a server render can mint a fresh client per request (React Query
// cache must not leak across requests). The browser keeps ONE shared instance
// via getBrowserQueryClient() below.
export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (err, query) =>
        captureException(err, { queryKey: query.queryKey }),
    }),
    mutationCache: new MutationCache({
      onError: (err, _vars, _ctx, mutation) =>
        captureException(err, { mutationKey: mutation.options.mutationKey }),
    }),
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: 1,
        refetchOnWindowFocus: true,
      },
      // WS14: losslessly columnar-encode dehydrated array payloads (the ~383-row
      // 90-day map-events feed dominates the homepage HTML) to shed turbo-stream's
      // per-row key-ref scaffolding. serializeData packs on dehydrate();
      // deserializeData unpacks on hydrate(). They MUST be set together and be
      // exact inverses: a server render mints its own createQueryClient() (see
      // getBrowserQueryClient) and hydrate() runs deserializeData synchronously
      // inside HydrationBoundary during SSR, so pack-without-unpack would render
      // the server tree from packed data and hydration-mismatch. See lib/dehydrateCodec.
      dehydrate: { serializeData: pack },
      hydrate: { deserializeData: unpack },
    },
  });
}

// The browser's single shared client, built lazily on first access. Lazy (not a
// module-level const) so importing this module on the server never constructs a
// client at module-eval — a per-request server render calls createQueryClient()
// directly for its own fresh instance.
let browserQueryClient: QueryClient | undefined;
export function getBrowserQueryClient(): QueryClient {
  // Self-enforcing SSR invariant: a server render MUST pass a per-request client
  // to AppProviders. If it omits it, the `client ?? getBrowserQueryClient()`
  // fallback would otherwise share one module-scoped cache across every request
  // in the Node process (request B reads request A's cached, city-specific
  // data). Fail loudly here instead of leaking silently in prod.
  if (typeof window === 'undefined') {
    throw new Error(
      'getBrowserQueryClient() called on the server — pass a per-request createQueryClient() to AppProviders instead.',
    );
  }
  browserQueryClient ??= createQueryClient();
  return browserQueryClient;
}

// Everything OUTSIDE the router. Exported so the SSR-safety gate test
// (tests/ssr/eventPageSsr.test.tsx) can wrap the real provider stack around a
// StaticRouter instead of BrowserRouter.
//
// Vercel's <Analytics /> used to sit at the bottom of this provider stack. It
// was removed 2026-08-14: Hobby allows 2,500 events/month, it is unsampled,
// and it fires once per pageview AND once per client-side navigation, so at
// ~14k pageviews it was multiples over its ceiling.
//
// NOTHING REPLACES IT YET -- this site currently collects no pageview
// analytics at all. The intended replacement is Cloudflare Web Analytics
// (free, unmetered, off Vercel's meter), which cannot land until the domain
// is proxied through Cloudflare, and which will ALSO need its beacon host
// added to script-src in app/csp.ts: that header is `'self' 'nonce-...'` with
// no external host, so a beacon added without it is silently CSP-blocked and
// looks exactly like analytics that work.
//
// `client` is optional: the browser omits it (shared getBrowserQueryClient());
// a server render (or the gate test) passes a fresh createQueryClient() so no
// query cache is shared across requests.
export const AppProviders = ({ children, client }: { children: ReactNode; client?: QueryClient }) => (
  <QueryClientProvider client={client ?? getBrowserQueryClient()}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {children}
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

// Everything INSIDE the router (requires a Router context above it).
export const AppShell = () => (
  <>
    <ScrollToTop />
    <CityProvider>
      <SearchProvider>
        <AppChrome />
      </SearchProvider>
    </CityProvider>
  </>
);

const App = () => (
  <AppProviders>
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  </AppProviders>
);

export default App;
