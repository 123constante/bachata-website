import { describe, it, expect, vi, afterEach } from "vitest";
import {
  shouldRedirectToAuth,
  shouldApplySessionUpdate,
  startAuthResolution,
  AUTH_RESOLVE_TIMEOUT_MS,
} from "@/lib/authResolution";

// supabase-defer arc, P5. Both rules exist because auth resolution gained a
// FAILURE mode when the Supabase client stopped being a static import, and in
// both cases the pre-P5 behaviour is a plausible-looking one-liner that fails
// silently in production. Each is therefore pinned in both directions, with the
// regression case named rather than implied.

describe("shouldRedirectToAuth", () => {
  it("redirects a genuinely signed-out visitor once resolution has finished", () => {
    expect(shouldRedirectToAuth("ready", null)).toBe(true);
  });

  it("does not redirect while resolution is still in flight", () => {
    expect(shouldRedirectToAuth("resolving", null)).toBe(false);
  });

  it("does not redirect a resolved, signed-in user", () => {
    expect(shouldRedirectToAuth("ready", { id: "u1" })).toBe(false);
  });

  // THE REGRESSION. Pre-P5 the test was `!isLoading && !user`, and `unavailable`
  // presents exactly that pair: loading finished, no user. A transient failure
  // to fetch the client chunk therefore bounced an authenticated user to /auth
  // and lost the page they were on. If someone reverts the predicate to the
  // isLoading form, this is the case that goes red.
  it("does NOT redirect when resolution failed -- unavailable is not signed out", () => {
    expect(shouldRedirectToAuth("unavailable", null)).toBe(false);
  });
});

describe("shouldApplySessionUpdate", () => {
  it("applies the first update", () => {
    expect(shouldApplySessionUpdate(1, 0)).toBe(true);
  });

  it("applies a newer update", () => {
    expect(shouldApplySessionUpdate(5, 4)).toBe(true);
  });

  // THE REGRESSION. The listener is registered before the initial getSession is
  // awaited, so an auth event can land mid-flight and take a HIGHER sequence
  // number. Without this rule the older getSession result is then applied on
  // top of it, reverting the app to a stale session with nothing logged.
  it("drops an in-flight getSession result that a newer auth event overtook", () => {
    const eventSeq = 2;
    const inFlightGetSessionSeq = 1;
    // the event lands first...
    expect(shouldApplySessionUpdate(eventSeq, 0)).toBe(true);
    // ...and the older, slower getSession must NOT overwrite it.
    expect(shouldApplySessionUpdate(inFlightGetSessionSeq, eventSeq)).toBe(false);
  });
});

// --- startAuthResolution -----------------------------------------------------
//
// These cover the half of P5 that the predicate tests above CANNOT see. Both
// bugs they pin were live in the first draft of this phase and passed the
// predicate suite unchanged: resolution that never settles, and a status that
// can never leave "unavailable". Neither is reachable without driving the real
// orchestration, which is why it was extracted from AuthProvider's effect.

type FakeSession = { user: { id: string } };

function fakeClient() {
  let listener: ((e: string, s: FakeSession | null) => void) | null = null;
  let settle: ((v: { data: { session: FakeSession | null } }) => void) | null = null;
  let unsubscribed = false;
  return {
    unsubscribed: () => unsubscribed,
    emit: (s: FakeSession | null) => listener?.("SIGNED_IN", s),
    settleGetSession: (s: FakeSession | null) => settle?.({ data: { session: s } }),
    client: {
      auth: {
        onAuthStateChange(cb: (e: string, s: FakeSession | null) => void) {
          listener = cb;
          return { data: { subscription: { unsubscribe: () => { unsubscribed = true; } } } };
        },
        getSession: () => new Promise<{ data: { session: FakeSession | null } }>((r) => { settle = r; }),
      },
    },
  };
}

function harness(getClient: () => Promise<any>) {
  const statuses: string[] = [];
  const sessions: (FakeSession | null)[] = [];
  const errors: string[] = [];
  const handle = startAuthResolution<FakeSession>({
    getClient,
    onSession: (s) => sessions.push(s),
    onStatus: (s) => statuses.push(s),
    onError: (_e, context) => errors.push(context),
  });
  return { handle, statuses, sessions, errors, last: () => statuses[statuses.length - 1] };
}

describe("startAuthResolution", () => {
  afterEach(() => { vi.useRealTimers(); });

  it("resolves to ready and applies the session on the happy path", async () => {
    vi.useFakeTimers();
    const c = fakeClient();
    const h = harness(async () => c.client);
    await vi.advanceTimersByTimeAsync(0);
    c.settleGetSession({ user: { id: "u1" } });
    await vi.advanceTimersByTimeAsync(0);
    expect(h.last()).toBe("ready");
    expect(h.sessions.at(-1)).toEqual({ user: { id: "u1" } });
  });

  // FINDING #2. The deadline must cover ACQUISITION, not just getSession. A
  // chunk fetch that neither resolves nor rejects previously parked the
  // provider in "resolving" forever -- AuthGuard's full-screen spinner, no
  // error, no retry path, on the one failure surface this arc created.
  it("times out when the CLIENT never arrives, rather than hanging forever", async () => {
    vi.useFakeTimers();
    const h = harness(() => new Promise(() => {}));
    await vi.advanceTimersByTimeAsync(AUTH_RESOLVE_TIMEOUT_MS + 10);
    expect(h.last()).toBe("unavailable");
    expect(h.errors).toContain("AuthProvider.timeout");
  });

  it("times out when getSession never settles", async () => {
    vi.useFakeTimers();
    const c = fakeClient();
    const h = harness(async () => c.client);
    await vi.advanceTimersByTimeAsync(AUTH_RESOLVE_TIMEOUT_MS + 10);
    expect(h.last()).toBe("unavailable");
  });

  // FINDING #1. The listener stays live after a timeout, so a session CAN still
  // arrive. If it does not lift "unavailable", a fully signed-in user sits on
  // AuthGuard's "Can't verify your sign-in" card indefinitely with a live
  // session behind it, escapable only by clicking Try again.
  it("promotes a late auth event out of unavailable", async () => {
    vi.useFakeTimers();
    const c = fakeClient();
    const h = harness(async () => c.client);
    await vi.advanceTimersByTimeAsync(AUTH_RESOLVE_TIMEOUT_MS + 10);
    expect(h.last()).toBe("unavailable");
    c.emit({ user: { id: "late" } });
    await vi.advanceTimersByTimeAsync(0);
    expect(h.last()).toBe("ready");
    expect(h.sessions.at(-1)).toEqual({ user: { id: "late" } });
  });

  it("reports acquisition failure as unavailable, distinctly from a timeout", async () => {
    vi.useFakeTimers();
    const h = harness(async () => { throw new Error("chunk 404"); });
    await vi.advanceTimersByTimeAsync(0);
    expect(h.last()).toBe("unavailable");
    expect(h.errors).toContain("AuthProvider.acquire");
    expect(h.errors).not.toContain("AuthProvider.timeout");
  });

  it("cancel() unsubscribes and stops further updates", async () => {
    vi.useFakeTimers();
    const c = fakeClient();
    const h = harness(async () => c.client);
    await vi.advanceTimersByTimeAsync(0);
    h.handle.cancel();
    expect(c.unsubscribed()).toBe(true);
    const before = h.statuses.length;
    c.emit({ user: { id: "after-cancel" } });
    await vi.advanceTimersByTimeAsync(AUTH_RESOLVE_TIMEOUT_MS + 10);
    expect(h.statuses.length).toBe(before);
  });
});
