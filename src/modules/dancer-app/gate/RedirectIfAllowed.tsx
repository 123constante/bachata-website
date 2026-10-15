import { Suspense, type ReactNode } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useAuth } from '@/hooks/useAuth';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { useDancerArea } from './useDancerArea';

const AllowedRedirect = lazyWithRetry(() => import('./AllowedRedirect'));

/**
 * Wraps the /account, /account/dancer and /finish-profile route ELEMENTS
 * (AnimatedRoutes.tsx). Today's page ALWAYS renders; on top of it, an allowed,
 * signed-in, non-organiser person is replace-redirected into /app/home (or
 * /app/welcome while the profile is incomplete).
 *
 * - signed out: no gate request (useDancerArea is disabled), today's page, whose
 *   own AuthGuard sends them to sign in;
 * - gate loading: today's page (never a blank screen);
 * - gate error or not allowed: today's page (fails CLOSED);
 * - allowed: the organiser check (AllowedRedirect, lazy) decides; if it fails
 *   to load, today's page stays.
 */
export const RedirectIfAllowed = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const area = useDancerArea();
  const signedIn = Boolean(user && !user.is_anonymous);
  const decide = signedIn && area.status === 'ready' && area.allowed;
  return (
    <>
      {children}
      {/* A fragment, not null: ErrorBoundary treats a falsy fallback as "use the default error card". */}
      {decide && (
        <ErrorBoundary fallback={<></>}>
          <Suspense fallback={null}>
            <AllowedRedirect />
          </Suspense>
        </ErrorBoundary>
      )}
    </>
  );
};

export default RedirectIfAllowed;
