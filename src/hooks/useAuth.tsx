import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { User, Session, Subscription } from "@supabase/supabase-js";
import { getSupabase } from "@/integrations/supabase/getSupabase";
import { captureException, isSentryEnabled, setSentryUser } from "@/lib/sentry";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let subscription: Subscription | undefined;

    (async () => {
      const supabase = await getSupabase();
      // The client now ARRIVES asynchronously, so this provider can unmount
      // before it lands. Without this guard the listener below would be
      // registered after cleanup already ran, and nothing would ever
      // unsubscribe it -- and React's dev double-invoke makes that the normal
      // first mount, not an edge case.
      if (!isMounted) return;

      // Listener for ONGOING auth changes -- does NOT touch isLoading
      const { data: { subscription: sub } } = supabase.auth.onAuthStateChange(
        (_event, session) => {
          if (!isMounted) return;
          setSession(session);
          setUser(session?.user ?? null);
        }
      );
      subscription = sub;

      // INITIAL load -- the only place isLoading is set to false.
      // AWAITED deliberately: a bare .then() here would settle this IIFE as
      // soon as getSession was CALLED, so the catch below would cover only
      // getSupabase() and a getSession rejection would be an unhandled
      // rejection that leaves isLoading true forever -- the exact failure the
      // catch exists to prevent.
      const { data: { session } } = await supabase.auth.getSession();
      if (!isMounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    })().catch((err) => {
      // Acquiring the client can now FAIL: it is fetched at runtime, where
      // before it was a static import that could not. Leaving isLoading true
      // forever would park AuthGuard on its spinner site-wide, so degrade to
      // the same signed-out state a visitor with no session already gets, and
      // report it rather than swallowing it.
      captureException(err, { context: "AuthProvider.getSupabase" });
      if (!isMounted) return;
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isSentryEnabled()) return;
    setSentryUser(user ? { id: user.id } : null);
  }, [user]);

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
    <AuthContext.Provider value={{ user, session, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
