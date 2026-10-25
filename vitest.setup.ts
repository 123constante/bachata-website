// input-otp's password-manager badge (use-pwm-badge.tsx) runs a timer after
// render that calls document.elementFromPoint, which happy-dom lacks. The
// timer can fire after the test ends and surfaces as an unhandled error that
// fails the whole run. A harmless stub, only when missing, covers every test
// that renders InputOTP.
if (typeof document !== "undefined" && typeof document.elementFromPoint !== "function") {
  document.elementFromPoint = () => null;
}

// Unit tests must never reach live Supabase (a node/jsdom test once counted ~70 phantom sign-ups on prod
// through the real client). Any fetch to a *.supabase.co host rejects with a clear message. Tests that
// stub fetch or mock the client replace/bypass this and are unaffected. The deliberate read-only live
// contract suites (*.contract.test.*) may reach it, but never a write-style counter RPC (record_*).
import { expect } from "vitest";

if (typeof globalThis.fetch === "function") {
  const realFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    if (/^https?:\/\/[^/]*\.supabase\.co(\/|$|:)/i.test(url)) {
      const testPath = expect.getState().testPath || (globalThis as { __vitest_worker__?: { filepath?: string } }).__vitest_worker__?.filepath || "";
      const liveContract = /\.contract\.test\.[jt]sx?$/.test(testPath) && !/\/rpc\/record_/.test(url);
      if (!liveContract) {
        return Promise.reject(new Error(`Blocked live Supabase request in a unit test: ${url}. Mock the client or stub fetch.`));
      }
    }
    return realFetch(input, init);
  }) as typeof fetch;
}
