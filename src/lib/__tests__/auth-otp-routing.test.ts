import { describe, expect, it } from "vitest";
import { isOtpSignupDisabledError, shouldHonorReturnTo } from "@/lib/auth-otp-routing";

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
