import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { captureException } from "@/lib/sentry";
import { BrowserRouter } from "react-router-dom";
import { ScrollToTop } from "@/components/ScrollToTop";
import { AuthProvider } from "@/hooks/useAuth";
import { CityProvider } from "@/contexts/CityContext";
import { AppChrome } from "@/components/AppChrome";
import { SearchProvider } from "@/components/search/SearchProvider";
import { Analytics } from "@vercel/analytics/react";

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
      refetchOnWindowFocus: true,
    },
  },
});

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
              <SearchProvider>
                <AppChrome />
              </SearchProvider>
            </CityProvider>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
      <Analytics />
    </QueryClientProvider>
  );
};

export default App;
