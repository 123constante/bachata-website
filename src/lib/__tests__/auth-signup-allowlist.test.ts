import { describe, expect, it } from "vitest";
import { isSignupAllowlistRefusal } from "@/lib/auth-otp-routing";

const ALLOWLIST_MSG = "Sign-up is limited to approved organisers.";

describe("isSignupAllowlistRefusal", () => {
  const cases: Array<[string, unknown, boolean, boolean]> = [
    ["allowlist 403 message while creating", { status: 403, message: ALLOWLIST_MSG }, true, true],
    ["allowlist message without status", { message: ALLOWLIST_MSG }, true, true],
    ["403 with another message while creating", { status: 403, message: "Forbidden" }, true, true],
    ["uppercase variant", { message: ALLOWLIST_MSG.toUpperCase() }, true, true],
    ["lowercase variant", { message: ALLOWLIST_MSG.toLowerCase() }, true, true],
    ["signups not allowed", { status: 422, code: "otp_disabled", message: "Signups not allowed for otp" }, true, false],
    ["network error", new Error("Failed to fetch"), true, false],
    ["empty error object", {}, true, false],
    ["null error", null, true, false],
    ["login path with allowlist-like 403", { status: 403, message: ALLOWLIST_MSG }, false, false],
    ["login path with plain 403", { status: 403, message: "Forbidden" }, false, false],
  ];

  it.each(cases)("%s", (_name, error, shouldCreateUser, expected) => {
    expect(isSignupAllowlistRefusal(error, shouldCreateUser)).toBe(expected);
  });
});
