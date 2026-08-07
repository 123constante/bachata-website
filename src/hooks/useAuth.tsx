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

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  authStatus: AuthStatus;
  signOut: () => Promise<void>;
  retryAuth: () => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  authStatus: "resolving",
  signOut: async () => {},
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

  const signOut = async () => {
    // getSupabase() is a runtime fetch, so this call gained a rejection path a
    // static import did not have. Callers await signOut() in a try/finally
    // without a catch, so an escaping rejection would be unhandled AND would
    // leave the user believing they had signed out. Report it instead.
    try {
      const supabase = await getSupabase();
      await supabase.auth.signOut();
    } catch (err) {
      captureException(err, { context: "AuthProvider.signOut" });
    }
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
