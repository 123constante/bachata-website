import { createContext, startTransition, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { getSupabase } from "@/integrations/supabase/getSupabase";
import type { ProfileCompletionStatus, RatingGate } from "@/lib/profileCompletion";
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

/**
 * The party-rating gate (profile completeness) for the signed-in user. The lazy,
 * signed-in-only ProfileCompletionChrome computes it (lib/profileCompletion) and
 * AppChrome provides it; LevelRatingPrompt reads it -- so the rating card never
 * imports the completion hook. It lives in THIS module only because useAuth
 * already has its own first-load chunk on every route: a module of its own was
 * one more request on every page (perf-budgets.json chunk ratchet).
 *
 * null = signed out or no provider (never blocks: the card has its own sign-in
 * sheet). "loading" = signed in, no answer yet (nothing blocked; a vote stashed
 * before sign-in waits).
 */
export type ProfileGateValue = {
  status: ProfileCompletionStatus;
  gateFor: (returnTo: string) => RatingGate;
  /** The gate to show when rate_series_level_p5_v1 refuses with `profile_incomplete` (the server is the authority). */
  refusedGateFor: (returnTo: string) => RatingGate;
};
export const ProfileGateContext = createContext<ProfileGateValue | "loading" | null>(null);

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
    // Every update below is a TRANSITION, and that is load-bearing (React
    // #421). This provider sits above the route's <Suspense> (root.tsx ->
    // AppChrome), and auth resolves asynchronously right after hydrateRoot --
    // while React 18 still holds that boundary dehydrated (its content
    // hydrates in a later low-priority pass, longer if a chunk is pending). A
    // context change from above marks a dehydrated boundary as updated, and an
    // urgent one makes React discard the server HTML and client-render the
    // route subtree (#421, seen on signed-in loads of /event/:id and the
    // organiser area). A transition instead waits for hydration to finish.
    // Proven by src/hooks/__tests__/useAuthHydration.test.tsx.
    const handle = startAuthResolution<Session>({
      getClient: getSupabase,
      onSession: (next) => {
        startTransition(() => {
          setSession(next);
          setUser(next?.user ?? null);
        });
      },
      onStatus: (status) => {
        startTransition(() => setAuthStatus(status));
      },
      // The context is passed through rather than fixed, because these failures
      // are no longer one thing: a chunk that would not load and an auth
      // endpoint that would not answer group separately, and the
      // reader needs to know which one is happening.
      onError: (err, context) => {
        // eslint-disable-next-line no-console
        console.error('useAuth error:', err, { context });
      },
    });
    return handle.cancel;
  }, [attempt]);

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
    
    /* The global revoke did not land. Clearing the LOCAL session is a different
     * operation -- storage, not network -- so it can still succeed, and on a
     * shared device it is the half that actually protects the user. Wrapped
     * because scope:"local" can still throw on a storage failure (Safari private
     * mode, a full quota), which is exactly the case that must not read as
     * success. */
    try {
      const { error: localError } = await supabase.auth.signOut({ scope: "local" });
      if (localError) {
                return "failed";
      }
    } catch (err) {
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
