import { Suspense, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { House, Lock, Moon, SlidersHorizontal, Ticket, UserRound } from 'lucide-react';
import { EmberWorld } from '@/modules/organiser/ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useAuth } from '@/hooks/useAuth';
import { flags } from '@/lib/featureFlags';
import { FOCUS_NOT_NOW_LABEL } from '@/lib/focusMode';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import '../theme/dancer.css';
import '../theme/dancer-color.css';
import { fetchMyDancerEdit } from '../api/rpc';
import { myDancerEditKey } from '../api/useMyDancerEdit';
import { DancerApiError } from '../api/errors';
import { useViewOnly } from '../gate/viewOnly';
import { profileIncomplete } from '../screens/tickets/model';
import '../screens/tickets/tickets.css';
import { mayBeFocus, requiredDone, shellChrome } from './focusChrome';
import { ProfileSheetProvider, useProfileSheet } from './profileSheet';
import { activeTabFor, shellTabs, type DancerTab } from './routes';
import { SiteHomeLink } from './SiteHomeLink';
import { ShellToast } from './shellToast';
import { LeaveGuardProvider, type LeaveGuard } from './leaveGuard';

const TAB_ICON: Record<DancerTab['id'], typeof House> = {
  tickets: Ticket,
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
  // Option A: with ticketing on, the same read also says whether the profile is unfinished
  // (the amber bar and the tab locks). Never for a view-only visitor: the member RPC refuses them.
  const viewOnly = useViewOnly();
  const ticketsOn = flags.publicTicketing;
  const profile = useQuery({
    queryKey: myDancerEditKey(user?.id),
    queryFn: fetchMyDancerEdit,
    enabled: Boolean(user?.id) && (candidate || (ticketsOn && !viewOnly)),
  });
  const noProfile = profile.error instanceof DancerApiError && profile.error.code === 'no_profile';
  const incomplete =
    ticketsOn &&
    profileIncomplete(viewOnly, {
      status: profile.data ? 'success' : noProfile ? 'no_profile' : profile.isError ? 'error' : 'pending',
      requiredDone: requiredDone(profile.data),
    });
  // Locked tabs: only for a person with no dancer profile to show (view-only, or no_profile).
  // A dancer mid-setup keeps their tabs and sees only the bar.
  const tabsLocked = ticketsOn && (viewOnly || noProfile);
  const { focus, notNowTo } = shellChrome(pathname, search, candidate ? profile.data : null);
  const active = activeTabFor(pathname);
  const guardRef = useRef<LeaveGuard | null>(null);
  return (
    <EmberWorld data-profile="dancer" className="dancer-app" data-testid="dancer-app-shell" data-chrome={focus ? 'focus' : 'full'}>
      <LeaveGuardProvider guardRef={guardRef}>
      <ProfileSheetProvider incomplete={incomplete} viewOnly={viewOnly}>
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
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
            // Review S1: the shared switcher's rows (portalled, but React events still reach here) go
            // through the same leave guard. Only preventDefault: the row's own onClick still closes the
            // switcher, and react-router's Link skips navigating once the default is prevented.
            onClickCapture={(e) => {
              const href = e.target instanceof Element ? e.target.closest('a[href]')?.getAttribute('href') : null;
              if (href && guardRef.current && !guardRef.current(href)) e.preventDefault();
            }}
          >
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
        <nav className={ticketsOn ? 'da-tabs dt-tabs-5' : 'da-tabs'} aria-label="Dancer app" data-testid="dancer-app-tabs">
          {shellTabs(ticketsOn).map((tab) => (
            <ShellTab key={tab.id} tab={tab} isActive={active === tab.id} locked={tabsLocked && tab.id !== 'tickets'} guardRef={guardRef} />
          ))}
        </nav>
      )}
      <ShellToast />
      </ProfileSheetProvider>
      </LeaveGuardProvider>
    </EmberWorld>
  );
};

/**
 * One bottom tab. Locked (Option A: unfinished profile, ticketing on) = the lock mark, and the
 * tap opens the "What are you?" sheet instead of the screen, so it is never a dead control.
 */
const ShellTab = ({ tab, isActive, locked, guardRef }: { tab: DancerTab; isActive: boolean; locked: boolean; guardRef: { current: LeaveGuard | null } }) => {
  const sheet = useProfileSheet();
  const Icon = TAB_ICON[tab.id];
  if (locked) {
    return (
      <button
        type="button"
        className="da-tap da-tab dt-tab-locked"
        onClick={sheet.open}
        aria-label={`${tab.label}, locked: finish your profile to unlock`}
        data-testid={`dancer-app-tab-${tab.id}`}
        data-locked="true"
      >
        <span className="dt-tab-icon">
          <Icon aria-hidden="true" style={{ width: 20, height: 20 }} />
          <Lock aria-hidden="true" className="dt-tab-lock" style={{ width: 11, height: 11 }} />
        </span>
        <span>{tab.label}</span>
      </button>
    );
  }
  return (
    <Link
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
};

export default DancerAppShell;
