import { GlobalBackground } from "@/components/GlobalBackground";
import React, { Suspense, lazy, type ComponentType, type LazyExoticComponent } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { captureException } from "@/lib/sentry";
import { BrowserRouter, Navigate, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { ScrollToTop } from "@/components/ScrollToTop";
import { GlobalHeader } from "@/components/GlobalHeader";
import { BottomNav } from "@/components/BottomNav";
import { AuthProvider } from "@/hooks/useAuth";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CityProvider } from "@/contexts/CityContext";
import { buildCityPath } from "@/lib/cityPath";
import { Skeleton } from "@/components/ui/skeleton";
import { Analytics } from "@vercel/analytics/react";
import ComingSoonGate from "@/components/ComingSoonGate";
import { flags } from "@/lib/featureFlags";
import { buildBreadcrumbs } from "@/lib/breadcrumbs";

// --- Landing page: eager (most common entry point) ---
import Index from "./pages/Index";

// Wraps lazy() so a chunk-load failure (typically: stale cached HTML referencing
// a chunk URL that 404s after a Vercel deploy → "Failed to fetch dynamically
// imported module" / MIME error) triggers ONE reload to pick up the fresh HTML.
// sessionStorage flag prevents reload loops if the chunk genuinely can't load.
const CHUNK_RELOAD_KEY = 'chunk-reload-attempted';
function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      const mod = await factory();
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
      return mod;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isChunkErr = /Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|is not a valid JavaScript MIME type/i.test(msg);
      if (isChunkErr && !sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
        sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}

// --- All other pages: lazy-loaded ---
const Parties = lazyWithRetry(() => import("./pages/Parties"));
const Classes = lazyWithRetry(() => import("./pages/Classes"));
const Discounts = lazyWithRetry(() => import("./pages/Discounts"));
const Tonight = lazyWithRetry(() => import("./pages/Tonight"));
const EventPage = lazyWithRetry(() => import("./pages/EventPage"));
const PracticePartners = lazyWithRetry(() => import("./pages/PracticePartners"));
const FestivalHub = lazyWithRetry(() => import("./pages/FestivalHub"));
const FestivalDetail = lazyWithRetry(() => import("./pages/FestivalDetail"));
const Experience = lazyWithRetry(() => import("./pages/Experience"));
const Videographers = lazyWithRetry(() => import("./pages/Videographers"));
const Choreography = lazyWithRetry(() => import("./pages/Choreography"));
const Dancers = lazyWithRetry(() => import("./pages/Dancers"));
const DancerProfile = lazyWithRetry(() => import("./pages/DancerProfile"));
const Teachers = lazyWithRetry(() => import("./pages/Teachers"));
const TeacherProfile = lazyWithRetry(() => import("./pages/TeacherProfile"));
const DJs = lazyWithRetry(() => import("./pages/DJs"));
const DJProfile = lazyWithRetry(() => import("./pages/DJProfile"));
const Venues = lazyWithRetry(() => import("./pages/Venues"));
const Organisers = lazyWithRetry(() => import("./pages/Organisers"));
const OrganiserProfile = lazyWithRetry(() => import("./pages/OrganiserProfile"));
const AllProfiles = lazyWithRetry(() => import("./pages/AllProfiles"));
const VenueEntity = lazyWithRetry(() => import("./pages/VenueEntity"));
const Cities = lazyWithRetry(() => import("./pages/Cities"));
const CreateProfile = lazyWithRetry(() => import("./pages/CreateProfile"));
const CreateOrganiserProfile = lazyWithRetry(() => import("./pages/CreateOrganiserProfile"));
const CreateVideographerProfile = lazyWithRetry(() => import("./pages/CreateVideographerProfile"));
const VendorDashboardPage = lazyWithRetry(() => import("./pages/VendorDashboardPage"));
const Vendors = lazyWithRetry(() => import("./pages/Vendors"));
const VendorDetail = lazyWithRetry(() => import("./pages/VendorDetail"));
const Auth = lazyWithRetry(() => import("./pages/Auth"));
const AuthCallback = lazyWithRetry(() => import("./pages/AuthCallback"));
const Onboarding = lazyWithRetry(() => import("./pages/Onboarding"));
const Profile = lazyWithRetry(() => import("./pages/Profile"));
const EditProfile = lazyWithRetry(() => import("./pages/EditProfile"));
const EditEvent = lazyWithRetry(() => import("./pages/EditEvent"));
const CreateEvent = lazyWithRetry(() => import("./pages/CreateEvent"));
// Debug routes removed -- security audit 2026-04-16
// const Debug = lazyWithRetry(() => import("./pages/Debug"));
// const DashboardPatternsDemo = lazyWithRetry(() => import("./pages/DashboardPatternsDemo"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const EraseGuestEntry = lazyWithRetry(() => import("./pages/EraseGuestEntry"));
const ExportGuestEntry = lazyWithRetry(() => import("./pages/ExportGuestEntry"));

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

const RouteFallback = () => (
  <div className="min-h-screen pt-24 px-4 pb-24 bg-background">
    <div className="max-w-4xl mx-auto space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-xl" />
    </div>
  </div>
);

/** Redirect bare slash to /city/<slug> so the city is always visible in the URL. */
const CityRedirect = () => {
  const stored = localStorage.getItem('activeCitySlug');
  const slug = stored || 'london-gb';
  return <Navigate to={buildCityPath(slug)} replace />;
};

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <ErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <Routes location={location} key={location.pathname}>
          <Route path="/" element={<CityRedirect />} />
          <Route path="/city/:slug" element={<PageTransition><Index /></PageTransition>} />
          <Route path="/city/:slug/calendar" element={<PageTransition><Index /></PageTransition>} />
          <Route path="/parties" element={<PageTransition><Parties /></PageTransition>} />
          <Route path="/city/:slug/parties" element={<PageTransition><Parties /></PageTransition>} />
          <Route path="/classes" element={<PageTransition><Classes /></PageTransition>} />
          <Route path="/city/:slug/classes" element={<PageTransition><Classes /></PageTransition>} />
          <Route path="/discounts" element={<PageTransition><Discounts /></PageTransition>} />
          <Route path="/city/:slug/discounts" element={<PageTransition><Discounts /></PageTransition>} />

          <Route path="/tonight" element={<PageTransition><Tonight /></PageTransition>} />
          <Route path="/city/:slug/tonight" element={<PageTransition><Tonight /></PageTransition>} />
          <Route path="/event/:id" element={<PageTransition><EventPage /></PageTransition>} />
          <Route path="/practice-partners" element={<PageTransition><PracticePartners /></PageTransition>} />
          <Route path="/city/:slug/practice-partners" element={<PageTransition><PracticePartners /></PageTransition>} />
          <Route path="/festivals" element={<PageTransition><FestivalHub /></PageTransition>} />
          <Route path="/festival/:id" element={<PageTransition><FestivalDetail /></PageTransition>} />
          <Route path="/vendors" element={<PageTransition><Vendors /></PageTransition>} />
          <Route path="/vendors/:id" element={<PageTransition><VendorDetail /></PageTransition>} />
          <Route path="/experience" element={<PageTransition><Experience /></PageTransition>} />
          <Route path="/videographers" element={<PageTransition><Videographers /></PageTransition>} />
          <Route path="/choreography" element={<PageTransition><Choreography /></PageTransition>} />
          <Route path="/dancers" element={<PageTransition><Dancers /></PageTransition>} />
          <Route path="/dancers/:id" element={<PageTransition><DancerProfile /></PageTransition>} />
          {/* Phase 5 listing-request gate: 5 routes wrapped. Flags default true
              in dev (.env.development) and false in prod (.env.production /
              Vercel project env). When gated, page component never mounts --
              the gate renders GlobalLayout placeholder + ListingRequestForm
              and sets noindex,nofollow on the document head. */}
          <Route path="/teachers" element={
            <ComingSoonGate
              enabled={flags.teachersDirectory}
              title="Teachers"
              section="teachers_directory"
              breadcrumbs={buildBreadcrumbs('teachers')}
            >
              <PageTransition><Teachers /></PageTransition>
            </ComingSoonGate>
          } />
          <Route path="/teachers/:id" element={
            <ComingSoonGate
              enabled={flags.teacherDetail}
              title="Teacher"
              section="teacher_detail"
              breadcrumbs={buildBreadcrumbs('teacher.detail', { entityName: undefined, isLoading: false })}
            >
              <PageTransition><TeacherProfile /></PageTransition>
            </ComingSoonGate>
          } />
          <Route path="/all-profiles" element={<PageTransition><AllProfiles /></PageTransition>} />
          <Route path="/djs" element={<PageTransition><DJs /></PageTransition>} />
          <Route path="/djs/:id" element={<PageTransition><DJProfile /></PageTransition>} />
          <Route path="/venues" element={<PageTransition><Venues /></PageTransition>} />
          <Route path="/city/:slug/venues" element={<PageTransition><Venues /></PageTransition>} />
          <Route path="/organisers" element={
            <ComingSoonGate
              enabled={flags.organisersDirectory}
              title="Organisers"
              section="organisers_directory"
              breadcrumbs={buildBreadcrumbs('organisers')}
            >
              <PageTransition><Organisers /></PageTransition>
            </ComingSoonGate>
          } />
          <Route path="/organisers/:id" element={
            <ComingSoonGate
              enabled={flags.organiserDetail}
              title="Organiser"
              section="organiser_detail"
              breadcrumbs={buildBreadcrumbs('organiser.detail', { entityName: undefined, isLoading: false })}
            >
              <PageTransition><OrganiserProfile /></PageTransition>
            </ComingSoonGate>
          } />
          <Route path="/venue-entity/:id" element={
            <ComingSoonGate
              enabled={flags.venueDetail}
              title="Venue"
              section="venue_detail"
              breadcrumbs={buildBreadcrumbs('venue.detail', { entityName: undefined, isLoading: false })}
            >
              <PageTransition><VenueEntity /></PageTransition>
            </ComingSoonGate>
          } />
          <Route path="/cities" element={<PageTransition><Cities /></PageTransition>} />

          {/* Phase 8 preview routes removed -- winning variants (bento palette
              Vibe F, compact density, strong-button treatment, RaffleBlock B,
              CoverBlock) all promoted into the real /event/:id page. */}

          {/* Protected Routes */}
          <Route path="/create-dancers-profile" element={
            <AuthGuard>
              <PageTransition><CreateProfile /></PageTransition>
            </AuthGuard>
          } />
          <Route path="/create-organiser-profile" element={
            <AuthGuard>
              <PageTransition><CreateOrganiserProfile /></PageTransition>
            </AuthGuard>
          } />
          <Route path="/create-videographer-profile" element={
            <AuthGuard>
              <PageTransition><CreateVideographerProfile /></PageTransition>
            </AuthGuard>
          } />
          <Route path="/profile" element={
            <AuthGuard>
              <PageTransition><Profile /></PageTransition>
            </AuthGuard>
          } />
          <Route path="/dashboard/vendor" element={
            <AuthGuard>
              <PageTransition><Navigate to="/profile?role=vendor" replace /></PageTransition>
            </AuthGuard>
          } />
          <Route path="/vendor-dashboard/edit" element={
            <AuthGuard>
              <PageTransition><VendorDashboardPage /></PageTransition>
            </AuthGuard>
          } />
          <Route path="/edit-profile" element={
            <AuthGuard>
              <PageTransition><EditProfile /></PageTransition>
            </AuthGuard>
          } />
          <Route path="/create-event" element={
            <AuthGuard>
              <PageTransition><CreateEvent /></PageTransition>
            </AuthGuard>
          } />
          <Route path="/event/:id/edit" element={
            <AuthGuard>
              <PageTransition><EditEvent /></PageTransition>
            </AuthGuard>
          } />

          <Route path="/auth" element={<PageTransition><Auth /></PageTransition>} />
          <Route path="/auth/callback" element={<PageTransition><AuthCallback /></PageTransition>} />
          <Route path="/onboarding" element={
            <AuthGuard>
              <PageTransition><Onboarding /></PageTransition>
            </AuthGuard>
          } />
          {/* Debug routes removed -- security audit 2026-04-16.
              Restore behind admin-only AuthGuard if needed for production debugging.
          <Route path="/debug" element={<AuthGuard><PageTransition><Debug /></PageTransition></AuthGuard>} />
          <Route path="/debug/dashboard-patterns" element={<AuthGuard><PageTransition><DashboardPatternsDemo /></PageTransition></AuthGuard>} />
          */}

          <Route path="/erase/:token" element={<PageTransition><EraseGuestEntry /></PageTransition>} />
          <Route path="/export/:token" element={<PageTransition><ExportGuestEntry /></PageTransition>} />
          <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </AnimatePresence>
  );
};

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
              <GlobalBackground />
              <GlobalHeader />
              {/* Spacer that matches the sticky header height so NO page has content blocked behind it */}
              <div className="h-[60px] shrink-0" aria-hidden="true" />
              <main id="main-content">
                <AnimatedRoutes />
              </main>
              {/* Spacer reserving space for the fixed BottomNav (incl. iOS safe-area inset) */}
              <div className="h-[calc(64px+env(safe-area-inset-bottom))] shrink-0" aria-hidden="true" />
              <BottomNav />
            </CityProvider>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
      <Analytics />
    </QueryClientProvider>
  );
};

export default App;
