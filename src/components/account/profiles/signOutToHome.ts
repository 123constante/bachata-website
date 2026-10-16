import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

/** Where a signed-out person lands: the public site home, never the sign-in form (audit H10). */
export const SIGN_OUT_HOME_PATH = '/';

/** The one sign-out failure line (switcher sheet, dancer Options). */
export const SIGN_OUT_FAILED = 'Sign-out did not complete. Check your connection and try again.';

/** Upper bound on waiting for the move to "/" to commit; sign-out still happens after it. */
const LEAVE_WAIT_MS = 2000;

/**
 * Sign out and land on the site home.
 *
 * ORDER MATTERS (audit H10). Signing out first nulls `user` while the person is
 * still inside an AuthGuard-wrapped route; AuthGuard then navigates to
 * /auth?mode=signin, and in framework mode that navigation ABORTS our pending
 * navigate('/') -- the person ended on "Welcome back". So we leave first and
 * sign out only once the move has COMMITTED: this hook's own component has
 * either re-rendered on "/" or unmounted with the guarded page. React Router
 * applies location changes in a transition, so neither the navigate() call nor
 * its promise alone proves the guarded tree is gone.
 *
 * Failure is still told truthfully: nothing was signed out, so we go back to
 * the screen the person was on and raise a toast (the calling sheet has
 * unmounted by then, so an inline line could not be seen).
 */
export function useSignOutToHome(): { signOutToHome: () => Promise<'ok' | 'failed'>; busy: boolean } {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const from = `${location.pathname}${location.search}${location.hash}`;
  const waiters = useRef<Array<() => void>>([]);

  const release = () => {
    const pending = waiters.current;
    waiters.current = [];
    pending.forEach((done) => done());
  };
  useEffect(() => {
    if (location.pathname === SIGN_OUT_HOME_PATH) release();
  }, [location.pathname]);
  useEffect(() => release, []);

  const signOutToHome = useCallback(async (): Promise<'ok' | 'failed'> => {
    setBusy(true);
    try {
      if (from.split(/[?#]/, 1)[0] !== SIGN_OUT_HOME_PATH) {
        const left = new Promise<void>((done) => {
          waiters.current.push(done);
          setTimeout(done, LEAVE_WAIT_MS);
        });
        await navigate(SIGN_OUT_HOME_PATH, { replace: true, flushSync: true });
        await left;
      }
      const outcome = await signOut();
      if (outcome === 'failed') {
        toast.error(SIGN_OUT_FAILED);
        if (from !== SIGN_OUT_HOME_PATH) await navigate(from, { replace: true });
        return 'failed';
      }
      return 'ok';
    } finally {
      setBusy(false);
    }
  }, [navigate, signOut, from]);

  return { signOutToHome, busy };
}
