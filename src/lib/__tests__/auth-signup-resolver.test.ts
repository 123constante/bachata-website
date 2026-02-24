import { describe, expect, it } from "vitest";
import { getAuthStepperStage, getNextStep } from "@/lib/auth-signup-resolver";
import type { AuthFormState, EntryRole } from "@/contexts/AuthFormContext";

const baseState: AuthFormState = {
  email: "",
  firstName: "",
  surname: "",
  cityId: "",
  cityName: "",
  otpCode: "",
  role: null,
};

describe("getNextStep", () => {
  it("returns email when email is missing", () => {
    const state: AuthFormState = {
      ...baseState,
      role: "dancer" as EntryRole,
      firstName: "Ana",
      cityId: "city-1",
    };

    expect(getNextStep(state)).toBe("email");
  });

  it("returns email when email is invalid", () => {
    const state: AuthFormState = {
      ...baseState,
      role: "dancer" as EntryRole,
      firstName: "Ana",
      cityId: "city-1",
      email: "not-an-email",
    };

    expect(getNextStep(state)).toBe("email");
  });

  it("returns details when first name is missing", () => {
    const state: AuthFormState = {
      ...baseState,
      role: "dancer" as EntryRole,
      cityId: "city-1",
      email: "ana@example.com",
    };

    expect(getNextStep(state)).toBe("details");
  });

  it("returns details when city is missing", () => {
    const state: AuthFormState = {
      ...baseState,
      role: "dancer" as EntryRole,
      firstName: "Ana",
      email: "ana@example.com",
    };

    expect(getNextStep(state)).toBe("details");
  });

  it("returns email when state is complete", () => {
    const state: AuthFormState = {
      ...baseState,
      role: "dancer" as EntryRole,
      firstName: "Ana",
      cityId: "city-1",
      email: "ana@example.com",
    };

    expect(getNextStep(state)).toBe("email");
  });
});

describe("getAuthStepperStage", () => {
  it("switches stage based on mode", () => {
    const state: AuthFormState = {
      ...baseState,
      role: "dancer" as EntryRole,
      email: "ana@example.com",
    };

    expect(
      getAuthStepperStage({
        formState: state,
        intent: "returning",
        emailConfirmed: true,
        otpSent: false,
        skipEmailStep: false,
        requireSignupDetails: true,
      })
    ).toBe("code");

    expect(
      getAuthStepperStage({
        formState: state,
        intent: "new",
        emailConfirmed: true,
        otpSent: false,
        skipEmailStep: false,
        requireSignupDetails: true,
      })
    ).toBe("name");
  });

  it("skips email step when allowed", () => {
    const state: AuthFormState = {
      ...baseState,
      role: "dancer" as EntryRole,
      firstName: "Ana",
      cityId: "city-1",
      email: "ana@example.com",
    };

    expect(
      getAuthStepperStage({
        formState: state,
        intent: "returning",
        emailConfirmed: false,
        otpSent: false,
        skipEmailStep: true,
        requireSignupDetails: true,
      })
    ).toBe("code");
  });

  it("skips signup details in quick-finish mode", () => {
    const state: AuthFormState = {
      ...baseState,
      role: "organiser" as EntryRole,
      email: "owner@example.com",
    };

    expect(
      getAuthStepperStage({
        formState: state,
        intent: "new",
        emailConfirmed: true,
        otpSent: false,
        skipEmailStep: false,
        requireSignupDetails: false,
      })
    ).toBe("code");
  });
});
