import type { AuthFormState } from "@/contexts/AuthFormContext";

type SignupStep = "role" | "details" | "email";
type AuthStepperStage = "email" | "name" | "code";
type AuthStepperIntent = "returning" | "new";

const emailPattern = /^[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9])?@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export const SIGNUP_STEPS: SignupStep[] = ["role", "details", "email"];

export const getNextStep = (formState: AuthFormState): SignupStep => {
  const needsRole = !formState.role;
  const needsDetails = !formState.firstName.trim() || !formState.cityId.trim();
  const needsEmail = !emailPattern.test(formState.email.trim());

  if (needsRole) return "role";
  if (needsDetails) return "details";
  if (needsEmail) return "email";
  return "email";
};

export const getAuthStepperStage = (input: {
  formState: AuthFormState;
  intent: AuthStepperIntent;
  emailConfirmed: boolean;
  otpSent: boolean;
  skipEmailStep: boolean;
  requireSignupDetails: boolean;
}): AuthStepperStage => {
  const { formState, intent, emailConfirmed, otpSent, skipEmailStep, requireSignupDetails } = input;
  const hasValidEmail = emailPattern.test(formState.email.trim());
  const hasDetails = formState.firstName.trim().length > 0 && formState.cityId.trim().length > 0;

  if (otpSent) return "code";

  if (intent === "returning") {
    if (skipEmailStep && hasValidEmail) return "code";
    return emailConfirmed ? "code" : "email";
  }

  if (!requireSignupDetails) {
    if (skipEmailStep && hasValidEmail) return "code";
    return emailConfirmed ? "code" : "email";
  }

  if (skipEmailStep && hasValidEmail && hasDetails) return "code";

  const next = getNextStep(formState);
  if (next === "details") return "name";
  if (emailConfirmed && hasValidEmail && hasDetails) return "code";
  return "email";
};

export const getStepIndex = (step: SignupStep) => SIGNUP_STEPS.indexOf(step);

export const getPreviousStep = (step: SignupStep) => {
  const index = getStepIndex(step);
  const prevIndex = Math.max(0, index - 1);
  return SIGNUP_STEPS[prevIndex];
};

export type { AuthStepperIntent, AuthStepperStage, SignupStep };
