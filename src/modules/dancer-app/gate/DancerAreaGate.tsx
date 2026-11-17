import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ACCOUNT_HOME_PATH } from '@/lib/accountRouting';
import { flags } from '@/lib/featureFlags';
import { useDancerArea } from './useDancerArea';
import { ViewOnlyContext, admitsViewOnly } from './viewOnly';

/**
 * Stands in front of every /app route, INSIDE AuthGuard (so the person is
 * signed in by the time this renders). Allowed -> the app; not allowed, or the
 * gate read failed -> today's /account (fails CLOSED); loading -> a quiet
 * placeholder in the app's own colours (the shell is not drawn until we know).
 * The one exception (gate/viewOnly): with ticketing on, a not-allowed person may
 * open /app/tickets view-only; every other path still goes to /account.
 */
export const DancerAreaGate = ({ children }: { children: ReactNode }) => {
  const area = useDancerArea();
  const { pathname } = useLocation();
  if (area.status === 'loading') {
    return (
      <div data-profile="dancer" className="dancer-app-loading" aria-busy="true" data-testid="dancer-app-gate-loading">
        <span className="sr-only">Loading&hellip;</span>
      </div>
    );
  }
  if (area.status === 'error' || !area.allowed) {
    if (admitsViewOnly(pathname, flags.publicTicketing)) {
      // A failed gate read is not a 'no': the person is admitted to the tickets route only, but not
      // marked view-only, so a finished dancer is never shown as locked out by a network blip.
      return <ViewOnlyContext.Provider value={area.status !== 'error'}>{children}</ViewOnlyContext.Provider>;
    }
    return <Navigate to={ACCOUNT_HOME_PATH} replace />;
  }
  return <>{children}</>;
};
