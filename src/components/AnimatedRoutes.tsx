import { Suspense } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import ComingSoonGate from "@/components/ComingSoonGate";
import { flags } from "@/lib/featureFlags";
import { buildCityPath } from "@/lib/cityPath";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

// --- Landing page: lazy-loaded here (along with all other pages) ---
const Index = lazyWithRetry(() => import("../pages/Index"));
const Parties = lazyWithRetry(() => import("../pages/Parties"));
const Classes = lazyWithRetry(() => import("../pages/Classes"));
const Discounts = lazyWithRetry(() => import("../pages/Discounts"));
const Tonight = lazyWithRetry(() => import("../pages/Tonight"));
const PracticePartners = lazyWithRetry(() => import("../pages/PracticePartners"));
// EventPage + FestivalHub are framework routes now (app/routes/event.tsx,
// festivals.tsx) — no longer referenced from the catchall tree.
const FestivalDetail = lazyWithRetry(() => import("../pages/FestivalDetail"));
const Experience = lazyWithRetry(() => import("../pages/Experience"));
const Videographers = lazyWithRetry(() => import("../pages/Videographers"));
const Choreography = lazyWithRetry(() => import("../pages/Choreography"));
const Dancers = lazyWithRetry(() => import("../pages/Dancers"));
const DancerProfile = lazyWithRetry(() => import("../pages/DancerProfile"));
const Teachers = lazyWithRetry(() => import("../pages/Teachers"));
const TeacherProfile = lazyWithRetry(() => import("../pages/TeacherProfile"));
const DJs = lazyWithRetry(() => import("../pages/DJs"));
const DJProfile = lazyWithRetry(() => import("../pages/DJProfile"));
const Venues = lazyWithRetry(() => import("../pages/Venues"));
const Organisers = lazyWithRetry(() => import("../pages/Organisers"));
// OrganiserProfile is a framework route now (app/routes/organiser.tsx).
const AllProfiles = lazyWithRetry(() => import("../pages/AllProfiles"));
const SearchResults = lazyWithRetry(() => import("../pages/SearchResults"));
const VenueEntity = lazyWithRetry(() => import("../pages/VenueEntity"));
const Cities = lazyWithRetry(() => import("../pages/Cities"));
const CreateProfile = lazyWithRetry(() => import("../pages/CreateProfile"));
const CreateOrganiserProfile = lazyWithRetry(() => import("../pages/CreateOrganiserProfile"));
const CreateVideographerProfile = lazyWithRetry(() => import("../pages/CreateVideographerProfile"));
const VendorDashboardPage = lazyWithRetry(() => import("../pages/VendorDashboardPage"));
const Vendors = lazyWithRetry(() => import("../pages/Vendors"));
const VendorDetail = lazyWithRetry(() => import("../pages/VendorDetail"));
const Raffles = lazyWithRetry(() => import("../pages/Raffles"));
const Auth = lazyWithRetry(() => import("../pages/Auth"));
const AuthCallback = lazyWithRetry(() => import("../pages/AuthCallback"));
const Onboarding = lazyWithRetry(() => import("../pages/Onboarding"));
const Profile = lazyWithRetry(() => import("../pages/Profile"));
const MyAttendance = lazyWithRetry(() => import("../pages/MyAttendance"));
const EditProfile = lazyWithRetry(() => import("../pages/EditProfile"));
const EditEvent = lazyWithRetry(() => import("../pages/EditEvent"));
const CreateEvent = lazyWithRetry(() => import("../pages/CreateEvent"));
const NotFound = lazyWithRetry(() => import("../pages/NotFound"));
const Faq = lazyWithRetry(() => import("../pages/seo/Faq"));
const BachataInLondon = lazyWithRetry(() => import("../pages/seo/BachataInLondon"));
const BachataWeekday = lazyWithRetry(() => import("../pages/seo/BachataWeekday"));
const LearnBachataLondon = lazyWithRetry(() => import("../pages/seo/LearnBachataLondon"));
const BachataPartiesLondon = lazyWithRetry(() => import("../pages/seo/BachataPartiesLondon"));
const BachataStyleParties = lazyWithRetry(() => import("../pages/seo/BachataStyleParties"));
const EraseGuestEntry = lazyWithRetry(() => import("../pages/EraseGuestEntry"));
const ExportGuestEntry = lazyWithRetry(() => import("../pages/ExportGuestEntry"));

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
  const stored = typeof window !== 'undefined' ? localStorage.getItem('activeCitySlug') : null;
  const slug = stored || 'london-gb';
  return <Navigate to={buildCityPath(slug)} replace />;
};

export const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <ErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<CityRedirect />} />
            {/* /city/:slug, /parties, /classes are now framework routes
                (app/routes.ts) — prerendered, so their catchall duplicates were
                removed. The /city/:slug/* variants below stay client-rendered. */}
            <Route path="/city/:slug/calendar" element={<Index />} />
            <Route path="/city/:slug/parties" element={<PageTransition><Parties /></PageTransition>} />
            <Route path="/city/:slug/classes" element={<PageTransition><Classes /></PageTransition>} />
            <Route path="/discounts" element={<PageTransition><Discounts /></PageTransition>} />
            <Route path="/city/:slug/discounts" element={<PageTransition><Discounts /></PageTransition>} />

            <Route path="/tonight" element={<PageTransition><Tonight /></PageTransition>} />
            <Route path="/city/:slug/tonight" element={<PageTransition><Tonight /></PageTransition>} />
            {/* /event/:id is a framework route (app/routes/event.tsx). */}
            <Route path="/practice-partners" element={<PageTransition><PracticePartners /></PageTransition>} />
            <Route path="/city/:slug/practice-partners" element={<PageTransition><PracticePartners /></PageTransition>} />
            {/* /festivals is a framework route (app/routes/festivals.tsx). */}
            <Route path="/faq" element={<PageTransition><Faq /></PageTransition>} />
            <Route path="/london-bachata-guide" element={<PageTransition><BachataInLondon /></PageTransition>} />
            <Route path="/learn-bachata-london" element={<PageTransition><LearnBachataLondon /></PageTransition>} />
            <Route path="/bachata-london-monday" element={<PageTransition><BachataWeekday /></PageTransition>} />
            <Route path="/bachata-london-tuesday" element={<PageTransition><BachataWeekday /></PageTransition>} />
            <Route path="/bachata-london-wednesday" element={<PageTransition><BachataWeekday /></PageTransition>} />
            <Route path="/bachata-london-thursday" element={<PageTransition><BachataWeekday /></PageTransition>} />
            <Route path="/bachata-london-friday" element={<PageTransition><BachataWeekday /></PageTransition>} />
            <Route path="/bachata-london-saturday" element={<PageTransition><BachataWeekday /></PageTransition>} />
            <Route path="/bachata-london-sunday" element={<PageTransition><BachataWeekday /></PageTransition>} />
            <Route path="/bachata-parties-london" element={<PageTransition><BachataPartiesLondon /></PageTransition>} />
            <Route path="/bachata-london-sensual-parties" element={<PageTransition><BachataStyleParties /></PageTransition>} />
            <Route path="/bachata-london-dominican-parties" element={<PageTransition><BachataStyleParties /></PageTransition>} />
            <Route path="/festival/:id" element={<PageTransition><FestivalDetail /></PageTransition>} />
            <Route path="/vendors" element={<PageTransition><Vendors /></PageTransition>} />
            <Route path="/vendors/:id" element={<PageTransition><VendorDetail /></PageTransition>} />
            {/* Standalone raffles landing page. Flag-gated (rafflesPage): default
                true in dev, false in prod. When off, redirect home rather than
                render a ComingSoonGate placeholder (this is a marketing page,
                not a listing-request surface). */}
            <Route path="/raffles" element={
              flags.rafflesPage
                ? <PageTransition><Raffles /></PageTransition>
                : <Navigate to="/" replace />
            } />
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
              >
                <PageTransition><Teachers /></PageTransition>
              </ComingSoonGate>
            } />
            <Route path="/teachers/:id" element={
              <ComingSoonGate
                enabled={flags.teacherDetail}
                title="Teacher"
                section="teacher_detail"
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
              >
                <PageTransition><Organisers /></PageTransition>
              </ComingSoonGate>
            } />
            {/* /organisers/:id is a framework route (app/routes/organiser.tsx),
                which owns the ComingSoonGate + noindex-when-locked meta. */}
            <Route path="/venue-entity/:id" element={
              <ComingSoonGate
                enabled={flags.venueDetail}
                title="Venue"
                section="venue_detail"
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
            <Route path="/my-attendance" element={
              <AuthGuard>
                <PageTransition><MyAttendance /></PageTransition>
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

            <Route path="/erase/:token" element={<PageTransition><EraseGuestEntry /></PageTransition>} />
            <Route path="/export/:token" element={<PageTransition><ExportGuestEntry /></PageTransition>} />
            <Route path="/search" element={<PageTransition><SearchResults /></PageTransition>} />
            <Route path="/city/:slug/search" element={<PageTransition><SearchResults /></PageTransition>} />
            <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </AnimatePresence>
  );
};
