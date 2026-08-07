import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { getSupabase } from "@/integrations/supabase/getSupabase";
import { captureException, isSentryEnabled, setSentryUser } from "@/lib/sentry";
import {
  startAuthResolution,
  AUTH_RESOLVE_TIMEOUT_MS,
  type AuthStatus,
} from "@/lib/authResolution";

export type { AuthStatus } from "@/lib/authResolution";
export { AUTH_RESOLVE_TIMEOUT_MS } from "@/lib/authResolution";

/**
 * What a sign-out ACTUALLY achieved. This is a return value rather than a
 * void-or-throw because the three cases need three different things from the UI,
 * and collapsing them is what made the old signOut() dangerous: it reported
 * nothing, so a failed sign-out and a successful one were indistinguishable and
 * the UI proceeded as signed-out with the session still live -- worst on a shared
 * or public device.
 *
 * "signed-out-locally" is a genuine outcome, not a euphemism for failure: the
 * server revoke did not land (offline, 5xx, already-expired refresh token) but
 * the tokens ARE gone from this browser, which is the half that matters on a
 * borrowed laptop. Sessions on the user's OTHER devices may survive, so the UI
 * says so rather than claiming a clean sign-out.
 */
export type SignOutOutcome = "signed-out" | "signed-out-locally" | "failed";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  authStatus: AuthStatus;
  signOut: () => Promise<SignOutOutcome>;
  retryAuth: () => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  authStatus: "resolving",
  // "failed", not a silent no-op: outside a provider nothing was signed out, and
  // the default value of this context must not be the one that lies.
  signOut: async () => "failed",
  retryAuth: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("resolving");
  // Bumped by retryAuth() to re-run resolution. The getSupabase() memo clears
  // itself on rejection, so a retry genuinely re-attempts the fetch rather than
  // re-reading a cached failure.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // All of the ordering, deadline and status logic lives in
    // startAuthResolution, where it is reachable by a test. This effect is
    // wiring: it maps callbacks onto React state and cancels on unmount.
    const handle = startAuthResolution<Session>({
      getClient: getSupabase,
      onSession: (next) => {
        setSession(next);
        setUser(next?.user ?? null);
      },
      onStatus: setAuthStatus,
      // The context is passed through rather than fixed, because these failures
      // are no longer one thing: a chunk that would not load and an auth
      // endpoint that would not answer group separately in Sentry, and the
      // reader needs to know which one is happening.
      onError: (err, context) => captureException(err, { context }),
    });
    return handle.cancel;
  }, [attempt]);

  useEffect(() => {
    if (!isSentryEnabled()) return;
    setSentryUser(user ? { id: user.id } : null);
  }, [user]);

  const retryAuth = useCallback(() => {
    setAuthStatus("resolving");
    setAttempt((n) => n + 1);
  }, []);

  /* THE DEFECT THIS REPLACES (carried through P4c and P5 as pre-existing context,
   * fixed here in P6). The old body caught every failure, reported it to Sentry
   * and RETURNED NORMALLY. A failed sign-out was therefore indistinguishable from
   * a successful one: the caller navigated away, the UI showed signed-out, and the
   * session was still live. Sentry is a record for us, not a signal to the person
   * standing at the machine.
   *
   * And it was worse than "swallowed", which is the part a reader should not miss:
   * supabase-js RESOLVES with { error } rather than rejecting, so the try/catch
   * never saw the ORDINARY failure at all -- only a thrown one. The common case
   * (offline, 5xx) sailed straight through the happy path.
   *
   * Structured as three explicit outcomes; see SignOutOutcome. */
  const signOut = async (): Promise<SignOutOutcome> => {
    let supabase: Awaited<ReturnType<typeof getSupabase>>;
    try {
      // getSupabase() is a runtime fetch (the arc deferred this client off the
      // first-load graph), so it has a rejection path a static import did not.
      supabase = await getSupabase();
    } catch (err) {
      // Nothing local changed and no request was sent: the user is still signed
      // in, and must be told so.
      captureException(err, { context: "AuthProvider.signOut.getSupabase" });
      return "failed";
    }

    /* BOTH failure shapes, one path. supabase-js normally RESOLVES with { error },
     * but the call can still THROW (a fetch-layer failure, an aborted request).
     * The old body caught only the thrown shape and let the returned one through;
     * catching only the returned shape would just invert the same bug, so a throw
     * is funnelled into `error` and treated identically. */
    let error: unknown = null;
    try {
      ({ error } = await supabase.auth.signOut());
    } catch (err) {
      error = err;
    }
    if (!error) return "signed-out";
    captureException(error, { context: "AuthProvider.signOut" });

    /* The global revoke did not land. Clearing the LOCAL session is a different
     * operation -- storage, not network -- so it can still succeed, and on a
     * shared device it is the half that actually protects the user. Wrapped
     * because scope:"local" can still throw on a storage failure (Safari private
     * mode, a full quota), which is exactly the case that must not read as
     * success. */
    try {
      const { error: localError } = await supabase.auth.signOut({ scope: "local" });
      if (localError) {
        captureException(localError, { context: "AuthProvider.signOut.local" });
        return "failed";
      }
    } catch (err) {
      captureException(err, { context: "AuthProvider.signOut.local" });
      return "failed";
    }
    return "signed-out-locally";
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        // UNCHANGED SEMANTICS for the 29 consumers that are not AuthGuard:
        // loading means "still working". `unavailable` is deliberately NOT
        // loading -- on a public surface "we could not tell" and "signed out"
        // look the same to a visitor, and spinning forever there would be a
        // worse regression than showing a Sign in button.
        isLoading: authStatus === "resolving",
        authStatus,
        signOut,
        retryAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
