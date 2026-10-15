import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { ACCOUNT_HOME_PATH } from '@/lib/accountRouting';
import { useDancerArea } from './useDancerArea';

/**
 * Stands in front of every /app route, INSIDE AuthGuard (so the person is
 * signed in by the time this renders). Allowed -> the app; not allowed, or the
 * gate read failed -> today's /account (fails CLOSED); loading -> a quiet
 * placeholder in the app's own colours (the shell is not drawn until we know).
 */
export const DancerAreaGate = ({ children }: { children: ReactNode }) => {
  const area = useDancerArea();
  if (area.status === 'loading') {
    return (
      <div data-profile="dancer" className="dancer-app-loading" aria-busy="true" data-testid="dancer-app-gate-loading">
        <span className="sr-only">Loading&hellip;</span>
      </div>
    );
  }
  if (area.status === 'error' || !area.allowed) return <Navigate to={ACCOUNT_HOME_PATH} replace />;
  return <>{children}</>;
};
