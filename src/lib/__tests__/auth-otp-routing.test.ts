import { describe, expect, it } from "vitest";
import {
  callbackErrorCopy,
  isOtpSignupDisabledError,
  landingPathAfterAuth,
  SIGNED_IN_LANDING_PATH,
  normalizeLandingRole,
  shouldHonorReturnTo,
} from "@/lib/auth-otp-routing";

describe("isOtpSignupDisabledError", () => {
  it("matches the GoTrue 422 otp_disabled code", () => {
    expect(isOtpSignupDisabledError({ status: 422, code: "otp_disabled", message: "Signups not allowed for otp" })).toBe(true);
  });

  it("matches on the message when the code is missing", () => {
    expect(isOtpSignupDisabledError({ message: "Signups not allowed for otp" })).toBe(true);
    expect(isOtpSignupDisabledError(new Error("Signup not allowed"))).toBe(true);
  });

  it("does not match other errors or non-errors", () => {
    expect(isOtpSignupDisabledError({ code: "over_email_send_rate_limit", message: "rate limited" })).toBe(false);
    expect(isOtpSignupDisabledError(new Error("network"))).toBe(false);
    expect(isOtpSignupDisabledError(null)).toBe(false);
    expect(isOtpSignupDisabledError("otp_disabled")).toBe(false);
  });
});

describe("shouldHonorReturnTo", () => {
  const rt = "/organisers/ritmo";

  it("a sign-in always honours returnTo", () => {
    expect(shouldHonorReturnTo({ returnTo: rt, isSignupFlow: false, organiserSelfServe: false })).toBe(true);
    expect(shouldHonorReturnTo({ returnTo: rt, isSignupFlow: false, organiserSelfServe: true })).toBe(true);
  });

  it("a sign-up honours returnTo once organiser self-serve is on (claim card round-trip)", () => {
    expect(shouldHonorReturnTo({ returnTo: rt, isSignupFlow: true, organiserSelfServe: true })).toBe(true);
  });

  it("a sign-up keeps the legacy create-profile routing with self-serve off", () => {
    expect(shouldHonorReturnTo({ returnTo: rt, isSignupFlow: true, organiserSelfServe: false })).toBe(false);
  });

  it("no returnTo, nothing to honour", () => {
    expect(shouldHonorReturnTo({ returnTo: null, isSignupFlow: false, organiserSelfServe: true })).toBe(false);
  });
});

describe("callbackErrorCopy", () => {
  it.each([
    ["expired", "That link expired or was already used. Enter your email for a new one."],
    ["invalid", "That link didn't work. Enter your email for a new one."],
    ["timeout", "Sign-in took too long. Enter your email for a new link."],
    ["manual", "Enter your email and we'll send you a sign-in link."],
  ])("%s: short, says what to do next", (reason, copy) => {
    expect(callbackErrorCopy(reason)).toBe(copy);
    expect(copy.length).toBeLessThanOrEqual(80);
  });

  it("shows nothing for no reason or an unknown one", () => {
    expect(callbackErrorCopy(null)).toBeNull();
    expect(callbackErrorCopy("")).toBeNull();
    expect(callbackErrorCopy("<script>")).toBeNull();
  });
});

describe("landingPathAfterAuth (no returnTo)", () => {
  const on = { organiserSelfServe: true };

  // Owner workflow 2026-10-15: /account/continue reads the person's sides and
  // goes straight to the only one, or shows "Continue as...".
  it("sends every sign-in to /account/continue, whatever role the metadata carries", () => {
    for (const role of [null, "dancer", "organiser", "teacher", "dj"]) {
      expect(landingPathAfterAuth({ ...on, role, isSignup: false })).toBe(SIGNED_IN_LANDING_PATH);
    }
    expect(SIGNED_IN_LANDING_PATH).toBe("/account/continue");
  });

  it("sends a dancer sign-up to /account/continue (the dancer app's onboarding follows)", () => {
    expect(landingPathAfterAuth({ ...on, role: "dancer", isSignup: true })).toBe(SIGNED_IN_LANDING_PATH);
    expect(landingPathAfterAuth({ ...on, role: null, isSignup: true })).toBe(SIGNED_IN_LANDING_PATH);
  });

  it.each(["organiser", "teacher", "dj", "vendor", "videographer"])("sends a %s sign-up to the organiser onboarding, as before", (role) => {
    expect(landingPathAfterAuth({ ...on, role, isSignup: true })).toBe("/account/o");
  });

  it("keeps the legacy routes with the flag off", () => {
    const off = { organiserSelfServe: false };
    expect(landingPathAfterAuth({ ...off, role: "organiser" })).toBe("/create-organiser-profile");
    expect(landingPathAfterAuth({ ...off, role: "videographer" })).toBe("/create-videographer-profile");
    // /profile was unrouted 2026-09-12 (a 404): the rest land home.
    expect(landingPathAfterAuth({ ...off, role: "dancer" })).toBe("/");
    expect(landingPathAfterAuth({ ...off, role: "dj" })).toBe("/");
    expect(landingPathAfterAuth({ ...off, role: null })).toBe("/");
  });
});

describe("normalizeLandingRole", () => {
  it("normalises role strings and drops non-strings", () => {
    expect(normalizeLandingRole(" Dancer ")).toBe("dancer");
    expect(normalizeLandingRole("")).toBeNull();
    expect(normalizeLandingRole(undefined)).toBeNull();
    expect(normalizeLandingRole(3)).toBeNull();
  });
});
