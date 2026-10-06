import { describe, expect, it } from "vitest";
import {
  callbackErrorCopy,
  isOtpSignupDisabledError,
  landingPathAfterAuth,
  needsOrganiserLookup,
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
  it("explains each reason the callback can bounce with", () => {
    expect(callbackErrorCopy("expired")).toMatch(/expired or was already used/);
    expect(callbackErrorCopy("invalid")).toMatch(/didn't work/);
    expect(callbackErrorCopy("timeout")).toMatch(/too long/);
    expect(callbackErrorCopy("manual")).toMatch(/enter your email/i);
  });

  it("shows nothing for no reason or an unknown one", () => {
    expect(callbackErrorCopy(null)).toBeNull();
    expect(callbackErrorCopy("")).toBeNull();
    expect(callbackErrorCopy("<script>")).toBeNull();
  });
});

describe("landingPathAfterAuth (no returnTo)", () => {
  const on = { organiserSelfServe: true };

  it("sends a dancer home, not to the organiser form", () => {
    expect(landingPathAfterAuth({ ...on, role: "dancer", managesOrganiser: null })).toBe("/");
  });

  it.each(["organiser", "teacher", "dj", "vendor", "videographer"])("sends a %s to /account", (role) => {
    expect(landingPathAfterAuth({ ...on, role, managesOrganiser: null })).toBe("/account");
  });

  it("sends a role-less sign-in to /account only when they manage an organiser", () => {
    expect(landingPathAfterAuth({ ...on, role: null, managesOrganiser: true })).toBe("/account");
    expect(landingPathAfterAuth({ ...on, role: null, managesOrganiser: false })).toBe("/");
  });

  it("falls back to /account when the organiser lookup failed", () => {
    expect(landingPathAfterAuth({ ...on, role: null, managesOrganiser: null })).toBe("/account");
  });

  it("keeps the legacy routes with the flag off", () => {
    const off = { organiserSelfServe: false, managesOrganiser: null };
    expect(landingPathAfterAuth({ ...off, role: "organiser" })).toBe("/create-organiser-profile");
    expect(landingPathAfterAuth({ ...off, role: "videographer" })).toBe("/create-videographer-profile");
    expect(landingPathAfterAuth({ ...off, role: "dancer" })).toBe("/profile");
    expect(landingPathAfterAuth({ ...off, role: "dj" })).toBe("/profile");
    expect(landingPathAfterAuth({ ...off, role: null })).toBe("/profile");
  });
});

describe("needsOrganiserLookup / normalizeLandingRole", () => {
  it("looks up only for a role-less user with the flag on", () => {
    expect(needsOrganiserLookup({ organiserSelfServe: true, role: null })).toBe(true);
    expect(needsOrganiserLookup({ organiserSelfServe: true, role: "dancer" })).toBe(false);
    expect(needsOrganiserLookup({ organiserSelfServe: false, role: null })).toBe(false);
  });

  it("normalises role strings and drops non-strings", () => {
    expect(normalizeLandingRole(" Dancer ")).toBe("dancer");
    expect(normalizeLandingRole("")).toBeNull();
    expect(normalizeLandingRole(undefined)).toBeNull();
    expect(normalizeLandingRole(3)).toBeNull();
  });
});
