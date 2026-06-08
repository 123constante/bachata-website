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
import { Analytics } from "@vercel/analytics/react";

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
              <AppChrome />
            </CityProvider>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
      <Analytics />
    </QueryClientProvider>
  );
};

export default App;
