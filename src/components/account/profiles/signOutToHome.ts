import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth, type SignOutOutcome } from '@/hooks/useAuth';

/** Where a signed-out person lands: the public site home, never the sign-in form (audit H10). */
export const SIGN_OUT_HOME_PATH = '/';

/** The one sign-out failure line (switcher sheet, dancer Options, Account settings, restore). */
export const SIGN_OUT_FAILED = 'Sign-out did not complete. Check your connection and try again.';

/** Upper bound on waiting for the move to commit once navigate() has resolved; the in-memory sign-out still happens after it. */
const LEAVE_WAIT_MS = 2000;

export type SignOutToHomeOptions = {
  /** End every session of the account (other phones and laptops too), this one included. */
  everywhere?: boolean;
  /** Where to land. A page OUTSIDE AuthGuard; default the site home. */
  to?: string;
  /** Router state for `to`. */
  state?: unknown;
  /**
   * On a failed sign-out: 'return' (default) goes back to the page and toasts SIGN_OUT_FAILED;
   * 'stay' leaves the person on `to` and the caller says what happened (account delete).
   */
  onFailed?: 'return' | 'stay';
};

/**
 * Sign out and land on the site home (or `to`). THE one sign-out path: every sign-out button
 * goes through it (review #789 B1; signOutEntryPoints.test.tsx is the table of them).
 *
 * ORDER MATTERS, and useAuth().signOut owns it (its `leave` step):
 *  1. the server revoke, capped (useAuth SIGN_OUT_SERVER_WAIT_MS);
 *  2. the person's data leaves this browser's storage -- on success, failure AND timeout --
 *     BEFORE the page is left (#789 storage race: navigating first let the next person
 *     find A's e-mail, form and session token on a shared phone);
 *  3. `leave`, below: the move home, while `user` is still set. Signing out first nulled
 *     `user` inside an AuthGuard-wrapped route; AuthGuard then navigated to
 *     /auth?mode=signin and, in framework mode, ABORTED our navigate('/') (audit H10).
 *     So the in-memory sign-out waits until the move has COMMITTED: this hook's own
 *     component has re-rendered on the target or unmounted with the guarded page (React
 *     Router applies location changes in a transition, so neither the navigate() call nor
 *     its promise alone proves the guarded tree is gone). The time cap is armed only AFTER
 *     navigate() resolves (review S7): a slow route chunk on 3G must not let the in-memory
 *     sign-out run while the guarded page is still up;
 *  4. the in-memory sign-out (user -> null).
 *
 * Returns the sign-out outcome, so a caller can still speak about 'signed-out-locally'
 * (a toast outlives the page). 'failed' means nothing was signed out (the client never
 * loaded, or the local sign-out itself threw): by default we stay on, or go back to, the
 * screen the person was on and raise a toast (the calling sheet has unmounted by then, so
 * an inline line could not be seen).
 */
export function useSignOutToHome(): {
  signOutToHome: (opts?: SignOutToHomeOptions) => Promise<SignOutOutcome>;
  busy: boolean;
} {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const from = `${location.pathname}${location.search}${location.hash}`;
  const target = useRef(SIGN_OUT_HOME_PATH);
  const waiters = useRef<Array<() => void>>([]);

  const release = () => {
    const pending = waiters.current;
    waiters.current = [];
    pending.forEach((done) => done());
  };
  useEffect(() => {
    if (location.pathname === target.current) release();
  }, [location.pathname]);
  useEffect(() => release, []);

  const signOutToHome = useCallback(
    async ({ everywhere = false, to = SIGN_OUT_HOME_PATH, state, onFailed = 'return' }: SignOutToHomeOptions = {}): Promise<SignOutOutcome> => {
      setBusy(true);
      let left = false;
      const leave = async () => {
        if (left) return;
        left = true;
        if (from.split(/[?#]/, 1)[0] === to) return;
        target.current = to;
        const committed = new Promise<void>((done) => {
          waiters.current.push(done);
        });
        await navigate(to, { replace: true, flushSync: true, state });
        await Promise.race([committed, new Promise<void>((done) => setTimeout(done, LEAVE_WAIT_MS))]);
      };
      try {
        let outcome: SignOutOutcome = 'failed';
        try {
          outcome = await signOut({ everywhere, leave });
        } catch {
          /* told as a failure below */
        }
        if (outcome === 'failed' && onFailed === 'return') {
          toast.error(SIGN_OUT_FAILED);
          if (left && from !== to) await navigate(from, { replace: true });
        } else {
          // Signed out without a leave step having run, or 'stay' on a failure: land on `to` now.
          await leave();
        }
        return outcome;
      } finally {
        setBusy(false);
      }
    },
    [navigate, signOut, from],
  );

  return { signOutToHome, busy };
}
