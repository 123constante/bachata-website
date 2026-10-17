import { Suspense } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { CalendarDays, House, Moon, SlidersHorizontal, UserRound } from 'lucide-react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import '../theme/dancer.css';
import { DANCER_TABS, activeTabFor, type DancerTab } from './routes';

const TAB_ICON: Record<DancerTab['id'], typeof House> = {
  home: House,
  nights: Moon,
  me: UserRound,
  options: SlidersHorizontal,
};

/**
 * The dancer app frame (mockups v8): header with the logo top-left (back to
 * the main site), the profile-type label, "Events" and the Switch-profile
 * picture top-right; the screen in
 * the middle; four bottom tabs. Every control is at least 44px tall (px, not
 * rem: see theme/dancer.css). The global header, bottom nav and footer are
 * hidden on /app/* by AppChrome, so this is the only chrome on screen.
 *
 * The theme sheet is imported HERE and nowhere else, and only applies under
 * [data-profile="dancer"].
 */
// Switch profile: the ONE shared sheet (components/account/profiles), in its own
// lazy chunk so its organiser reads stay off this shell's first load. Declared
// here, not through a shared wrapper module: a module both shells import becomes
// one more first-load chunk on each (perf-budgets.json chunk ratchet).
const ProfileSwitcher = lazyWithRetry(() => import('@/components/account/profiles/ProfileSwitcher'));
const DANCER_SWITCHER = { area: 'dancer' } as const;

export const DancerAppShell = () => {
  const { pathname } = useLocation();
  const active = activeTabFor(pathname);
  return (
    <div data-profile="dancer" className="dancer-app" data-testid="dancer-app-shell">
      <header className="da-header" data-testid="dancer-app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <Link to="/" className="da-tap da-logo" data-testid="dancer-app-logo">
            Bachata Calendar
          </Link>
          <span className="da-type-label" data-testid="dancer-app-type-label">
            Dancer
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Link to="/" className="da-tap da-events" data-testid="dancer-app-events">
            <CalendarDays aria-hidden="true" style={{ width: 16, height: 16, marginRight: 4 }} />
            Events
          </Link>
          {/* A fragment fallback: ErrorBoundary treats a falsy one as "show the default error card". */}
          <ErrorBoundary fallback={<></>}>
            <Suspense fallback={<span aria-hidden="true" style={{ display: 'inline-block', width: 44, height: 44 }} />}>
              <ProfileSwitcher where={DANCER_SWITCHER} />
            </Suspense>
          </ErrorBoundary>
        </div>
      </header>
      <div className="da-content" data-testid="dancer-app-content">
        <Outlet />
      </div>
      <nav className="da-tabs" aria-label="Dancer app" data-testid="dancer-app-tabs">
        {DANCER_TABS.map((tab) => {
          const Icon = TAB_ICON[tab.id];
          const isActive = active === tab.id;
          return (
            <Link
              key={tab.id}
              to={tab.path}
              className="da-tap da-tab"
              aria-current={isActive ? 'page' : undefined}
              data-testid={`dancer-app-tab-${tab.id}`}
            >
              <Icon aria-hidden="true" style={{ width: 20, height: 20 }} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default DancerAppShell;
