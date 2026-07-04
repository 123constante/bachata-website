import { Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { GlobalBackground } from '@/components/GlobalBackground';
import { GlobalHeader } from '@/components/GlobalHeader';
import { BottomNav } from '@/components/BottomNav';
import { GlobalFooter } from '@/components/layout/GlobalFooter';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import { lazyWithRetry } from '@/lib/lazyWithRetry';

// Lazy-load AnimatedRoutes to defer framer-motion out of the initial bundle.
const AnimatedRoutes = lazyWithRetry(() =>
  import('@/components/AnimatedRoutes').then((m) => ({ default: m.AnimatedRoutes })),
);

const AnimatedRoutesFallback = () => (
  <div className="min-h-screen pt-24 px-4 pb-24 bg-background">
    <div className="max-w-4xl mx-auto space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-xl" />
    </div>
  </div>
);

// The two Festival Map home routes (/city/:slug and /city/:slug/calendar). On
// these the footer is suppressed (full-bleed map) and the BottomNav is hidden on
// desktop; mobile home keeps the BottomNav + its spacer.
const HOME_RE = /^\/city\/[^/]+(\/calendar)?\/?$/i;

/**
 * Route-aware global chrome. Lives inside BrowserRouter + CityProvider so it can
 * read the location and adapt the footer / bottom-nav for the Festival Map home.
 *
 * `children` is optional for the RR7 framework-mode spike: root.tsx passes the
 * route <Outlet/> in place of the hardwired lazy <AnimatedRoutes/>. The legacy
 * SPA path (App.tsx) passes no children and keeps rendering AnimatedRoutes, so
 * this edit is backwards-compatible.
 */
export function AppChrome({ children }: { children?: React.ReactNode }) {
  const { pathname } = useLocation();
  const isMobile = useIsMobile();
  const isHome = HOME_RE.test(pathname);
  const isHomeDesktop = isHome && !isMobile;

  return (
    <>
      <GlobalBackground />
      <GlobalHeader />
      {/* Spacer that matches the sticky header height so NO page is blocked behind it. */}
      <div className="h-[60px] shrink-0" aria-hidden="true" />
      <main id="main-content">
        <ErrorBoundary>
          <Suspense fallback={<AnimatedRoutesFallback />}>
            {children ?? <AnimatedRoutes />}
          </Suspense>
        </ErrorBoundary>
      </main>
      {/* Footer is suppressed on the full-bleed map home (both breakpoints). */}
      {!isHome && <GlobalFooter />}
      {/* Bottom-nav spacer: kept on mobile home (nav still shows), dropped on desktop home. */}
      {!isHomeDesktop && (
        <div className="h-[calc(64px+env(safe-area-inset-bottom))] shrink-0" aria-hidden="true" />
      )}
      <BottomNav className={isHome ? 'md:hidden' : undefined} />
    </>
  );
}
