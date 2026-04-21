import { GlobalBackground } from "@/components/GlobalBackground";
import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

// ─── Landing page: eager (most common entry point) ───────────────────────────
import Index from "./pages/Index";

// ─── All other pages: lazy-loaded ────────────────────────────────────────────
const Parties = lazy(() => import("./pages/Parties"));
const Classes = lazy(() => import("./pages/Classes"));
const Discounts = lazy(() => import("./pages/Discounts"));
const Tonight = lazy(() => import("./pages/Tonight"));
const EventPage = lazy(() => import("./pages/EventPage"));
const PracticePartners = lazy(() => import("./pages/PracticePartners"));
const FestivalHub = lazy(() => import("./pages/FestivalHub"));
const FestivalDetail = lazy(() => import("./pages/FestivalDetail"));
const Experience = lazy(() => import("./pages/Experience"));
const Videographers = lazy(() => import("./pages/Videographers"));
const Choreography = lazy(() => import("./pages/Choreography"));
const Dancers = lazy(() => import("./pages/Dancers"));
const DancerProfile = lazy(() => import("./pages/DancerProfile"));
const Teachers = lazy(() => import("./pages/Teachers"));
const TeacherProfile = lazy(() => import("./pages/TeacherProfile"));
const DJs = lazy(() => import("./pages/DJs"));
const DJProfile = lazy(() => import("./pages/DJProfile"));
const Venues = lazy(() => import("./pages/Venues"));
const Organisers = lazy(() => import("./pages/Organisers"));
const OrganiserProfile = lazy(() => import("./pages/OrganiserProfile"));
const AllProfiles = lazy(() => import("./pages/AllProfiles"));
const VenueEntity = lazy(() => import("./pages/VenueEntity"));
const CreateProfile = lazy(() => import("./pages/CreateProfile"));
const CreateOrganiserProfile = lazy(() => import("./pages/CreateOrganiserProfile"));
const CreateTeacherProfile = lazy(() => import("./pages/CreateTeacherProfile"));
const CreateDJProfile = lazy(() => import("./pages/CreateDJProfile"));
const CreateVideographerProfile = lazy(() => import("./pages/CreateVideographerProfile"));
const CreateVendorProfile = lazy(() => import("./pages/CreateVendorProfile"));
const VendorDashboardPage = lazy(() => import("./pages/VendorDashboardPage"));
const Vendors = lazy(() => import("./pages/Vendors"));
const VendorDetail = lazy(() => import("./pages/VendorDetail"));
const Auth = lazy(() => import("./pages/Auth"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Profile = lazy(() => import("./pages/Profile"));
const EditProfile = lazy(() => import("./pages/EditProfile"));
const EditEvent = lazy(() => import("./pages/EditEvent"));
const CreateEvent = lazy(() => import("./pages/CreateEvent"));
// Debug routes removed — security audit 2026-04-16
// const Debug = lazy(() => import("./pages/Debug"));
// const DashboardPatternsDemo = lazy(() => import("./pages/DashboardPatternsDemo"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Global query defaults: 60s staleTime, single retry, no window-focus refetches.
// Per-query staleTimes (2–5 min) still override where set. Events data changes on
// the scale of days, not minutes — focus-refetch adds cost without user benefit.
const queryClient = new QueryClient({
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

/** Redirect bare `/` to `/city/<slug>` so the city is always visible in the URL. */
const CityRedirect = () => {
  const stored = localStorage.getItem('activeCitySlug');
  const slug = stored || 'london-gb';
  return <Navigate to={buildCityPath(slug)} replace />;
};

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
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
          <Route path="/teachers" element={<PageTransition><Teachers /></PageTransition>} />
          <Route path="/teachers/:id" element={<PageTransition><TeacherProfile /></PageTransition>} />
          <Route path="/all-profiles" element={<PageTransition><AllProfiles /></PageTransition>} />
          <Route path="/djs" element={<PageTransition><DJs /></PageTransition>} />
          <Route path="/djs/:id" element={<PageTransition><DJProfile /></PageTransition>} />
          <Route path="/venues" element={<PageTransition><Venues /></PageTransition>} />
          <Route path="/city/:slug/venues" element={<PageTransition><Venues /></PageTransition>} />
          <Route path="/organisers" element={<PageTransition><Organisers /></PageTransition>} />
          <Route path="/organisers/:id" element={<PageTransition><OrganiserProfile /></PageTransition>} />
          <Route path="/venue-entity/:id" element={<PageTransition><VenueEntity /></PageTransition>} />

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
          <Route path="/create-teacher-profile" element={
            <AuthGuard>
              <PageTransition><CreateTeacherProfile /></PageTransition>
            </AuthGuard>
          } />
          <Route path="/create-dj-profile" element={
            <AuthGuard>
              <PageTransition><CreateDJProfile /></PageTransition>
            </AuthGuard>
          } />
          <Route path="/create-videographer-profile" element={
            <AuthGuard>
              <PageTransition><CreateVideographerProfile /></PageTransition>
            </AuthGuard>
          } />
          <Route path="/create-vendor-profile" element={
            <AuthGuard>
              <PageTransition><CreateVendorProfile /></PageTransition>
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
          {/* Debug routes removed — security audit 2026-04-16.
              Restore behind admin-only AuthGuard if needed for production debugging.
          <Route path="/debug" element={<AuthGuard><PageTransition><Debug /></PageTransition></AuthGuard>} />
          <Route path="/debug/dashboard-patterns" element={<AuthGuard><PageTransition><DashboardPatternsDemo /></PageTransition></AuthGuard>} />
          */}

          <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
        </Routes>
      </Suspense>
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
