// input-otp's password-manager badge (use-pwm-badge.tsx) runs a timer after
// render that calls document.elementFromPoint, which happy-dom lacks. The
// timer can fire after the test ends and surfaces as an unhandled error that
// fails the whole run. A harmless stub, only when missing, covers every test
// that renders InputOTP.
if (typeof document !== "undefined" && typeof document.elementFromPoint !== "function") {
  document.elementFromPoint = () => null;
}
