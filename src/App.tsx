import { GlobalBackground } from "@/components/GlobalBackground";
import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { captureException } from "@/lib/sentry";
import { BrowserRouter } from "react-router-dom";
import { ScrollToTop } from "@/components/ScrollToTop";
import { GlobalHeader } from "@/components/GlobalHeader";
import { BottomNav } from "@/components/BottomNav";
import { GlobalFooter } from "@/components/layout/GlobalFooter";
import { AuthProvider } from "@/hooks/useAuth";
import { CityProvider } from "@/contexts/CityContext";
import { SearchOverlayProvider } from "@/contexts/SearchOverlayContext";
import { SearchOverlay } from "@/components/search/SearchOverlay";
import { Skeleton } from "@/components/ui/skeleton";
import { Analytics } from "@vercel/analytics/react";

// Lazy-load AnimatedRoutes to defer framer-motion out of the initial bundle.
// All page components and route definitions live in AnimatedRoutes.tsx.
const AnimatedRoutes = lazy(() => import("./components/AnimatedRoutes").then(m => ({ default: m.AnimatedRoutes })));

// Global query defaults: 60s staleTime, single retry, no window-focus refetches.
// Per-query staleTimes (2--5 min) still override where set. Events data changes on
// the scale of days, not minutes -- focus-refetch adds cost without user benefit.
//
// Phase 2: QueryCache/MutationCache route every silently-swallowed query and
// mutation error to Sentry so consumers that read .data without checking .error
// no longer hide failures from ops.
const queryClient = new QueryClient({
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
      refetchOnWindowFocus: false,
    },
  },
});

const AnimatedRoutesFallback = () => (
  <div className="min-h-screen pt-24 px-4 pb-24 bg-background">
    <div className="max-w-4xl mx-auto space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-xl" />
    </div>
  </div>
);

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <CityProvider>
              <SearchOverlayProvider>
              <GlobalBackground />
              <GlobalHeader />
              {/* Spacer that matches the sticky header height so NO page has content blocked behind it */}
              <div className="h-[60px] shrink-0" aria-hidden="true" />
              <main id="main-content">
                <ErrorBoundary>
                  <Suspense fallback={<AnimatedRoutesFallback />}>
                    <AnimatedRoutes />
                  </Suspense>
                </ErrorBoundary>
              </main>
              <GlobalFooter />
              {/* Spacer reserving space for the fixed BottomNav (incl. iOS safe-area inset) */}
              <div className="h-[calc(64px+env(safe-area-inset-bottom))] shrink-0" aria-hidden="true" />
              <BottomNav />
              <SearchOverlay />
              </SearchOverlayProvider>
            </CityProvider>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
      <Analytics />
    </QueryClientProvider>
  );
};

export default App;
