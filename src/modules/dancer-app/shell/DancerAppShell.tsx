import { Suspense, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { House, Moon, SlidersHorizontal, UserRound } from 'lucide-react';
import { EmberWorld } from '@/modules/organiser/ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useAuth } from '@/hooks/useAuth';
import { FOCUS_NOT_NOW_LABEL } from '@/lib/focusMode';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import '../theme/dancer.css';
import '../theme/dancer-color.css';
import { fetchMyDancerEdit } from '../api/rpc';
import { myDancerEditKey } from '../api/useMyDancerEdit';
import { mayBeFocus, shellChrome } from './focusChrome';
import { DANCER_TABS, activeTabFor, type DancerTab } from './routes';
import { SiteHomeLink } from './SiteHomeLink';
import { ShellToast } from './shellToast';
import { LeaveGuardProvider, type LeaveGuard } from './leaveGuard';

const TAB_ICON: Record<DancerTab['id'], typeof House> = {
  home: House,
  nights: Moon,
  me: UserRound,
  options: SlidersHorizontal,
};

/**
 * The dancer app frame (Ember look, D115): header with the "Bachata Calendar" home
 * link top-left (D120: the one way out to the site; D131: no Events button), the
 * profile-type label, and the Switch-profile picture top-right, shown only for
 * a person with 2+ profiles (D129); the screen in the middle; four bottom tabs.
 * Every control is at least 44px tall (px, not rem: see theme/dancer.css). The
 * global header, bottom nav and footer are hidden on /app/* by AppChrome, so
 * this is the only chrome on screen.
 *
 * Setup focus mode (audit H5): while the required steps are not done, the
 * setup paths (lib/focusMode isSignupFocusPath) get only the logo and a small
 * "Not now" -- no tabs, no Events, no picture, so one tap cannot abandon setup
 * by accident. "Not now" stays signed in and deletes nothing.
 *
 * The theme sheet is imported HERE and nowhere else, and only applies under
 * [data-profile="dancer"].
 */
// Switch profile: the ONE shared sheet (components/account/profiles), in its own
// lazy chunk so its organiser reads stay off this shell's first load. Declared
// here, not through a shared wrapper module: a module both shells import becomes
// one more first-load chunk on each (perf-budgets.json chunk ratchet).
// D129: SwitcherGate renders it only for a person with 2+ profiles.
const SwitcherGate = lazyWithRetry(() => import('./SwitcherGate'));

export const DancerAppShell = () => {
  const { pathname, search } = useLocation();
  const { user } = useAuth();
  // The same cache entry every dancer screen reads (api/useMyDancerEdit), and only on
  // a path that can be focus: the other screens never wait on it.
  const candidate = mayBeFocus(pathname, search);
  const profile = useQuery({
    queryKey: myDancerEditKey(user?.id),
    queryFn: fetchMyDancerEdit,
    enabled: Boolean(user?.id) && candidate,
  });
  const { focus, notNowTo } = shellChrome(pathname, search, candidate ? profile.data : null);
  const active = activeTabFor(pathname);
  const guardRef = useRef<LeaveGuard | null>(null);
  return (
    <EmberWorld data-profile="dancer" className="dancer-app" data-testid="dancer-app-shell" data-chrome={focus ? 'focus' : 'full'}>
      <LeaveGuardProvider guardRef={guardRef}>
      <header className="da-header" data-testid="dancer-app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <SiteHomeLink onBeforeLeave={() => (guardRef.current ? guardRef.current('/') : true)} />
          {!focus && (
            <span className="da-type-label" data-testid="dancer-app-type-label">
              Dancer
            </span>
          )}
        </div>
        {focus ? (
          <Link to={notNowTo} className="da-tap da-not-now" data-testid="dancer-app-not-now">
            {FOCUS_NOT_NOW_LABEL}
          </Link>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {/* A fragment fallback: ErrorBoundary treats a falsy one as "show the default error card". */}
            <ErrorBoundary fallback={<></>}>
              <Suspense fallback={null}>
                <SwitcherGate />
              </Suspense>
            </ErrorBoundary>
          </div>
        )}
      </header>
      <div
        className="da-content"
        data-testid="dancer-app-content"
        style={focus ? { paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' } : undefined}
      >
        <Outlet />
      </div>
      {!focus && (
        <nav className="da-tabs" aria-label="Dancer app" data-testid="dancer-app-tabs">
          {DANCER_TABS.map((tab) => {
            const Icon = TAB_ICON[tab.id];
            const isActive = active === tab.id;
            return (
              <Link
                key={tab.id}
                to={tab.path}
                className="da-tap da-tab"
                onClick={(e) => {
                  if (guardRef.current && !guardRef.current(tab.path)) e.preventDefault();
                }}
                aria-current={isActive ? 'page' : undefined}
                data-testid={`dancer-app-tab-${tab.id}`}
              >
                <Icon aria-hidden="true" style={{ width: 20, height: 20 }} />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
      <ShellToast />
      </LeaveGuardProvider>
    </EmberWorld>
  );
};

export default DancerAppShell;
