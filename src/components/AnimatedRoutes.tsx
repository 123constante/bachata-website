import { Suspense } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { LegacyAccountRedirect } from "@/modules/organiser/shell/LegacyRedirect";
import { AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import ComingSoonGate from "@/components/ComingSoonGate";
import { flags } from "@/lib/featureFlags";
import { buildCityPath } from "@/lib/cityPath";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
// The dancer area (/app/*): ONE lazy chunk, dancer-app. RedirectIfAllowed is the
// small eager wrapper around three of today's account pages: it makes its gate
// request only for a signed-in visitor and loads its organiser check lazily.
import { RedirectIfAllowed } from "@/modules/dancer-app/gate/RedirectIfAllowed";

// --- Landing page: lazy-loaded here (along with all other pages) ---
const Index = lazyWithRetry(() => import("../pages/Index"));
const Parties = lazyWithRetry(() => import("../pages/Parties"));
const Classes = lazyWithRetry(() => import("../pages/Classes"));
const Discounts = lazyWithRetry(() => import("../pages/Discounts"));
const Tonight = lazyWithRetry(() => import("../pages/Tonight"));
const CityMap = lazyWithRetry(() => import("../pages/CityMap"));
const PracticePartners = lazyWithRetry(() => import("../pages/PracticePartners"));
// EventPage + FestivalHub are framework routes now (app/routes/event.tsx,
// festivals.tsx) — no longer referenced from the catchall tree.
const Videographers = lazyWithRetry(() => import("../pages/Videographers"));
const Choreography = lazyWithRetry(() => import("../pages/Choreography"));
const Dancers = lazyWithRetry(() => import("../pages/Dancers"));
const Teachers = lazyWithRetry(() => import("../pages/Teachers"));
const DJs = lazyWithRetry(() => import("../pages/DJs"));
// DancerProfile, TeacherProfile, DJProfile are framework routes now
// (app/routes/{dancers,teachers,djs}.tsx).
const Venues = lazyWithRetry(() => import("../pages/Venues"));
const Organisers = lazyWithRetry(() => import("../pages/Organisers"));
// OrganiserProfile is a framework route now (app/routes/organiser.tsx).
const AllProfiles = lazyWithRetry(() => import("../pages/AllProfiles"));
const SearchResults = lazyWithRetry(() => import("../pages/SearchResults"));
const Cities = lazyWithRetry(() => import("../pages/Cities"));
// PROTOTYPE (search v7): the person-page mockups, dev or VITE_MOCKS=true only.
const MockPersonPage = lazyWithRetry(() => import("../modules/person-page/mockups/MockPersonPage"));
const S8Mock = lazyWithRetry(() => import("../modules/person-page/mockups/S8Mock"));
const S9FaceWall = lazyWithRetry(() => import("../modules/person-page/mockups/S9FaceWall"));
const Vendors = lazyWithRetry(() => import("../pages/Vendors"));
const VendorDetail = lazyWithRetry(() => import("../pages/VendorDetail"));
const Raffles = lazyWithRetry(() => import("../pages/Raffles"));
const Auth = lazyWithRetry(() => import("../pages/Auth"));
// The organiser area (/account/o). Its AuthGuard lives inside this chunk; the
// old /account URLs redirect into it (LegacyAccountRedirect, a tiny eager file).
const OrganiserArea = lazyWithRetry(() => import("@/modules/organiser/shell/OrganiserRoutes"));
// Admin organiser access and the invite landing: lazy chunks, no weight on the public first load.
const AdminOrganisers = lazyWithRetry(() => import("@/modules/admin-organisers/AdminOrganisersPage"));
const InviteRedeem = lazyWithRetry(() => import("@/modules/admin-organisers/InviteRedeemPage"));
const AuthCallback = lazyWithRetry(() => import("../pages/AuthCallback"));
const FinishProfile = lazyWithRetry(() => import("../pages/FinishProfile"));
// /account: the dancer home, or on to the organiser home (lib/accountRouting).
// Its AuthGuard lives inside the chunk, like FinishProfile's.
const Account = lazyWithRetry(() => import("../pages/Account"));
// Where a sign-in with no returnTo lands: straight on to the one side, or "Continue as..." (lib/accountRouting).
const ContinueAs = lazyWithRetry(() => import("./account/profiles/ContinueAsPage"));
const MyAttendance = lazyWithRetry(() => import("../pages/MyAttendance"));
const AccountSettings = lazyWithRetry(() => import("../pages/AccountSettings"));
const AccountDeleted = lazyWithRetry(() => import("../pages/AccountDeleted"));
const Privacy = lazyWithRetry(() => import("../pages/Privacy"));
const Terms = lazyWithRetry(() => import("../pages/Terms"));
const AccountRestore = lazyWithRetry(() => import("../pages/AccountRestore"));
const NotFound = lazyWithRetry(() => import("../pages/NotFound"));
const DancerApp = lazyWithRetry(() => import("@/modules/dancer-app/dancer-app"));
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

/** Every /app URL shares one key, so the dancer app's shell stays mounted across its tabs. */
const routesKey = (pathname: string) => {
  const p = pathname.toLowerCase();
  return p === "/app" || p.startsWith("/app/") ? "/app" : pathname;
};

export const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <ErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <Routes location={location} key={routesKey(location.pathname)}>
            <Route path="/" element={<CityRedirect />} />
            {/* /city/:slug, /parties, /classes are now framework routes
                (app/routes.ts) — prerendered, so their catchall duplicates were
                removed. The /city/:slug/* variants below stay client-rendered. */}
            <Route path="/city/:slug/calendar" element={<Index />} />
            {/* The full map the homepage teaser opens. Client-rendered through
                the catchall: `city/:slug` in app/routes.ts is a ONE-segment
                framework route, so this two-segment path falls through to here.
                No PageTransition -- the transition wrapper animates opacity on
                mount, and Leaflet measures a container mid-fade as zero-height,
                which is the black-map state the shell's ResizeObserver exists
                to recover from. /city/:slug/calendar skips it for its own
                reasons and is the precedent. */}
            <Route path="/city/:slug/map" element={<CityMap />} />
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
            {/* /faq, /london-bachata-guide, /learn-bachata-london,
                /bachata-parties-london, the two /bachata-london-*-parties style
                pages and the seven /bachata-london-{weekday} pages are framework
                routes (app/routes.ts) -- prerendered with real head tags, so
                their catchall duplicates were removed. */}
            {/* /festival/:id is a framework route (app/routes/festival.tsx). */}
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
            <Route path="/videographers" element={<PageTransition><Videographers /></PageTransition>} />
            <Route path="/choreography" element={<PageTransition><Choreography /></PageTransition>} />
            <Route path="/dancers" element={<PageTransition><Dancers /></PageTransition>} />
            {/* /dancers/:id is a framework route (app/routes/dancers.tsx). */}
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
            {/* /teachers/:id is a framework route (app/routes/teachers.tsx),
                which owns the ComingSoonGate + noindex-when-locked meta. */}
            <Route path="/all-profiles" element={<PageTransition><AllProfiles /></PageTransition>} />
            <Route path="/djs" element={<PageTransition><DJs /></PageTransition>} />
            {(import.meta.env.DEV || import.meta.env.VITE_MOCKS === "true") && (<Route path="/__mock/person/:arrangement/:fixture/*" element={<MockPersonPage />} />)}
            {(import.meta.env.DEV || import.meta.env.VITE_MOCKS === "true") && (<Route path="/__mock/s8/:view/:fixture/:role?/*" element={<S8Mock />} />)}
            {(import.meta.env.DEV || import.meta.env.VITE_MOCKS === "true") && (<Route path="/__mock/s9/:view" element={<S9FaceWall />} />)}
            {/* /djs/:id is a framework route (app/routes/djs.tsx). */}
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
            {/* /venue-entity/:id is a framework route (app/routes/venue-entity.tsx),
                which owns the ComingSoonGate + noindex-when-locked meta. */}
            <Route path="/cities" element={<PageTransition><Cities /></PageTransition>} />

            {/* Phase 8 preview routes removed -- winning variants (bento palette
                Vibe F, compact density, strong-button treatment, RaffleBlock B,
                CoverBlock) all promoted into the real /event/:id page. */}

            {/* Website self-service routes (create-event, edit-event, create-profile,
                edit-profile, onboarding, etc.) retired 2026-09-12. Public pages and
                auth remain; use Admin editor (EventEditorV2) for organiser event creation. */}

            {/* Organiser self-serve (Lever 2). Flag-gated like /raffles: off,
                it redirects home rather than rendering a placeholder. The old
                /account URLs redirect into the rebuilt area (query + hash kept).
                Bare /account is the account icon's page: the dancer home, or on
                to /account/o for an organiser (lib/accountRouting). */}
            <Route path="/account" element={
              flags.organiserSelfServe
                ? <RedirectIfAllowed><PageTransition><Account /></PageTransition></RedirectIfAllowed>
                : <Navigate to="/" replace />
            } />
            <Route path="/account/dancer" element={
              flags.organiserSelfServe
                ? <RedirectIfAllowed><PageTransition><Account view="dancer" /></PageTransition></RedirectIfAllowed>
                : <Navigate to="/" replace />
            } />
            <Route path="/account/continue" element={<PageTransition><ContinueAs /></PageTransition>} />
            <Route path="/account/attendance" element={
              flags.organiserSelfServe
                ? <PageTransition><MyAttendance /></PageTransition>
                : <Navigate to="/" replace />
            } />
            <Route path="/account/settings" element={<PageTransition><AccountSettings view="home" /></PageTransition>} />
            <Route path="/account/settings/ownership" element={<PageTransition><AccountSettings view="ownership" /></PageTransition>} />
            <Route path="/account/settings/delete" element={<PageTransition><AccountSettings view="delete" /></PageTransition>} />
            <Route path="/privacy" element={<PageTransition><Privacy /></PageTransition>} />
            <Route path="/terms" element={<PageTransition><Terms /></PageTransition>} />
            <Route path="/account/deleted" element={<PageTransition><AccountDeleted /></PageTransition>} />
            <Route path="/account/restore" element={<PageTransition><AccountRestore /></PageTransition>} />
            <Route path="/account/new" element={
              flags.organiserSelfServe
                ? <LegacyAccountRedirect target="new" />
                : <Navigate to="/" replace />
            } />
            <Route path="/account/series/:seriesId" element={
              flags.organiserSelfServe
                ? <LegacyAccountRedirect target="series" />
                : <Navigate to="/" replace />
            } />
            <Route path="/account/team/:organiserId?" element={
              flags.organiserSelfServe
                ? <LegacyAccountRedirect target="team" />
                : <Navigate to="/" replace />
            } />
            {/* No PageTransition: its transform + filter would turn the shell's
                position:fixed frame into a clipped, offset box mid-animation. */}
            <Route path="/account/o/*" element={
              flags.organiserSelfServe
                ? <OrganiserArea />
                : <Navigate to="/" replace />
            } />

            <Route path="/admin/organisers" element={<PageTransition><AdminOrganisers /></PageTransition>} />
            <Route path="/invite" element={<PageTransition><InviteRedeem /></PageTransition>} />
            <Route path="/invite/:token" element={<PageTransition><InviteRedeem /></PageTransition>} />

            <Route path="/auth" element={<PageTransition><Auth /></PageTransition>} />
            <Route path="/auth/callback" element={<PageTransition><AuthCallback /></PageTransition>} />
            {/* Finish your profile: shown once right after sign-in while
                profile_complete_v1 is false, and linked from the reminder banner
                and the party-rating gate (ProfileCompletionChrome). Its AuthGuard
                lives INSIDE the lazy page chunk, like the organiser area: used
                here, AuthGuard and its imports join the catchall first load. */}
            <Route path="/finish-profile" element={<RedirectIfAllowed><PageTransition><FinishProfile /></PageTransition></RedirectIfAllowed>} />

            {/* The new dancer area (briefs/dancer-rebuild-INTERFACE.md section 5).
                Its AuthGuard and gate live inside the lazy chunk; no
                PageTransition, so the shell's fixed tab bar is never animated. */}
            <Route path="/app/*" element={<DancerApp />} />

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
