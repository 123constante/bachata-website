// The two decisions auth resolution gained when the Supabase client stopped
// being a static import (supabase-defer arc, P5).
//
// They live here, as named predicates with tests, rather than inline in
// useAuth/AuthGuard, because both are one-liners whose WRONG version is also a
// plausible-looking one-liner -- and in both cases the wrong version fails
// silently in production rather than loudly in review.

/**
 * Whether auth resolution has finished, and if it failed, that it FAILED --
 * which is not the same as being signed out.
 *
 * See useAuth.tsx for the full reasoning; the short version is that
 * `unavailable` carries `user: null` because we do not KNOW, not because the
 * visitor is signed out.
 */
export type AuthStatus = "resolving" | "ready" | "unavailable";

/**
 * May AuthGuard send this visitor to /auth?
 *
 * ONLY on a RESOLVED absence of a user. The predicate this replaced was
 * `!isLoading && !user`, which was equivalent right up until resolution gained
 * a failure mode: acquiring the client is a runtime fetch now, and a transient
 * failure reports exactly the pair a signed-out visitor reports. That bounced
 * genuinely authenticated users to the sign-in page over a dropped chunk
 * request, losing the page they were on.
 */
export function shouldRedirectToAuth(status: AuthStatus, user: unknown): boolean {
  return status === "ready" && !user;
}

/**
 * Whether a session update that was REQUESTED at `seq` may still be applied,
 * given that `applied` was the sequence number of the last one that landed.
 *
 * The provider registers its onAuthStateChange listener BEFORE awaiting the
 * initial getSession, so an auth event can legitimately arrive while that call
 * is still in flight. Without an ordering rule the older getSession result is
 * then applied ON TOP of the newer event, quietly reverting the app to a stale
 * session -- no error, no warning, and indistinguishable from the user simply
 * not being signed in.
 *
 * `>=` rather than `>`: equal sequence numbers cannot occur (every update takes
 * a fresh one from the same counter), and re-applying an identical value would
 * be harmless anyway. Strictness here would only invite an off-by-one.
 */
export function shouldApplySessionUpdate(seq: number, applied: number): boolean {
  return seq >= applied;
}

/** The subset of the Supabase client this module needs, so it stays testable. */
type AuthClientLike<TSession> = {
  auth: {
    onAuthStateChange(
      cb: (event: string, session: TSession | null) => void,
    ): { data: { subscription: { unsubscribe(): void } } };
    getSession(): Promise<{ data: { session: TSession | null } }>;
  };
};

export type AuthResolutionHandle = { cancel: () => void };

/**
 * Bound on resolving auth, measured from the START of acquisition.
 *
 * From the start, NOT from the getSession call: acquiring the client is a
 * runtime chunk fetch now, and a fetch that neither resolves nor rejects (a
 * captive portal, a black-holed CDN edge) is exactly as fatal as a hanging
 * getSession -- it parks the provider in `resolving` forever, which shows as
 * AuthGuard's full-screen spinner with no error path and no retry. An earlier
 * version armed this only around getSession and therefore did not cover the one
 * failure surface this arc newly created.
 */
export const AUTH_RESOLVE_TIMEOUT_MS = 8000;

/**
 * Drive auth resolution: acquire the client, subscribe to changes, read the
 * initial session, and report status -- under a single overall deadline.
 *
 * Extracted from AuthProvider's effect so the risky parts are reachable by a
 * test. The two failures this shape exists to prevent are both invisible to a
 * predicate test: resolution never settling, and a late-arriving session
 * failing to lift an earlier `unavailable`.
 */
export function startAuthResolution<TSession>({
  getClient,
  onSession,
  onStatus,
  onError,
  timeoutMs = AUTH_RESOLVE_TIMEOUT_MS,
}: {
  getClient: () => Promise<AuthClientLike<TSession>>;
  onSession: (session: TSession | null) => void;
  onStatus: (status: AuthStatus) => void;
  onError: (err: unknown, context: string) => void;
  timeoutMs?: number;
}): AuthResolutionHandle {
  let active = true;
  let settled = false;
  let issued = 0;
  let applied = 0;
  let subscription: { unsubscribe(): void } | undefined;

  const settle = (status: AuthStatus) => {
    if (!active) return;
    settled = true;
    clearTimeout(timer);
    onStatus(status);
  };

  const timer = setTimeout(() => {
    if (!active || settled) return;
    onError(new Error(`auth resolution timed out after ${timeoutMs}ms`), "AuthProvider.timeout");
    settle("unavailable");
  }, timeoutMs);

  const apply = (next: TSession | null, seq: number) => {
    if (!active || !shouldApplySessionUpdate(seq, applied)) return;
    applied = seq;
    onSession(next);
    // A genuine auth event PROVES resolution works, so it must lift an earlier
    // `unavailable`. Without this the listener kept updating the session while
    // the status stayed failed, and a signed-in user sat on AuthGuard's error
    // card indefinitely with a live session behind it.
    settle("ready");
  };

  (async () => {
    const client = await getClient();
    if (!active) return;

    const { data: { subscription: sub } } = client.auth.onAuthStateChange((_event, next) => {
      apply(next, ++issued);
    });
    subscription = sub;
    // Cancellation can land while getClient() was in flight, i.e. after the
    // check above but before this assignment -- so honour it here too, or the
    // listener outlives the provider with nothing holding its unsubscribe.
    if (!active) {
      sub.unsubscribe();
      return;
    }

    // Sequence taken at REQUEST time: this value is a snapshot from now, so any
    // event delivered later is genuinely newer and must win. In practice
    // supabase-js emits INITIAL_SESSION on subscribe from the same initialize,
    // so this result is usually superseded before it lands -- harmless, since
    // the two agree. Its load-bearing job is settling the status, and being the
    // fallback when no event arrives at all.
    const seq = ++issued;
    const { data: { session } } = await client.auth.getSession();
    if (!active) return;
    apply(session, seq);
    settle("ready");
  })().catch((err) => {
    onError(err, "AuthProvider.acquire");
    if (!active || settled) return;
    settle("unavailable");
  });

  return {
    cancel() {
      active = false;
      clearTimeout(timer);
      subscription?.unsubscribe();
    },
  };
}
