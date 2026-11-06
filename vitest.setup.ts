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

// Dummy Supabase env, vitest only (this file is wired through vitest.config.ts `setupFiles` and nowhere else). A worktree with no
// .env made every file that imports the real client fail with "supabaseUrl is required". Fill ONLY keys that are undefined, so a real
// .env / CI value always wins; an empty string is kept (a real misconfiguration). Live-DB contract suites read the env themselves and
// must see it ABSENT, never a fake host, so they are skipped. The host is .invalid: it can never resolve, so nothing can reach prod.
export const DUMMY_SUPABASE_ENV = {
  VITE_SUPABASE_URL: "https://dummy-vitest.invalid",
  VITE_SUPABASE_PUBLISHABLE_KEY: "dummy-vitest-publishable-key",
} as const;
export const CONTRACT_TEST = /\.contract\.test\.[cm]?[jt]sx?$/;
export function fillDummySupabaseEnv(env: Record<string, unknown>, testPath = ""): void {
  if (CONTRACT_TEST.test(testPath)) return;
  for (const [key, dummy] of Object.entries(DUMMY_SUPABASE_ENV)) if (env[key] === undefined) env[key] = dummy;
}
const setupTestPath = expect.getState().testPath || (globalThis as { __vitest_worker__?: { filepath?: string } }).__vitest_worker__?.filepath || "";
fillDummySupabaseEnv(process.env, setupTestPath);
fillDummySupabaseEnv(import.meta.env as Record<string, unknown>, setupTestPath);
