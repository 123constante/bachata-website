/**
 * Buyer onboarding follow-up, slice A (brief docs/briefs/onboard-a-slice-a.md).
 * ON: a signed-in person with no dancer profile gets one created silently
 * (ensure_my_dancer_profile_v1) before the "Message us" dead end, and the B1
 * picker shows "Tickets go to {email}. Not you?" for a signed-in buyer.
 * OFF (default): both paths are exactly as before. Rollback = flag off.
 */
export const BUYER_ONBOARDING_ENABLED: boolean = import.meta.env.VITE_ENABLE_BUYER_ONBOARDING === 'true';
