// Pure auth-routing decisions for the magic-link flow, kept out of the page
// components so they can be unit-tested without a Supabase client.

// Shown when sign-in mode discovers the email has no account (Lever 2 walk B3).
export const OTP_NO_ACCOUNT_NOTICE = "No account for this email yet. Create one to continue.";

// signInWithOtp({ shouldCreateUser: false }) for an email with no account
// answers 422 { code: "otp_disabled", message: "Signups not allowed for otp" }.
// That is the ONLY reliable "no account" signal on the sign-in path:
// account_exists_by_email is deliberately not anon-callable (no email
// enumeration), so the pre-lookup always answers "unknown". Match the code
// first and the message as a fallback for older auth servers that omit it.
export function isOtpSignupDisabledError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (code === "otp_disabled") return true;
  const text = typeof message === "string" ? message.toLowerCase() : "";
  return text.includes("signups not allowed") || text.includes("signup not allowed");
}

// Should the callback send the user back to the page that sent them to /auth?
// A sign-in always does. A sign-up historically did not (it went on to the
// create-<role>-profile pages), but with organiser self-serve on those pages
// are retired and the destination is /account, so a brand-new organiser who
// came from "Sign in to claim" must land back on the claim card instead.
export function shouldHonorReturnTo(input: {
  returnTo: string | null;
  isSignupFlow: boolean;
  organiserSelfServe: boolean;
}): boolean {
  if (!input.returnTo) return false;
  return !input.isSignupFlow || input.organiserSelfServe;
}
