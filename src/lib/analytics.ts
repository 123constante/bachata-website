import type { MapTab } from '@/modules/home-map/mapTypes';

type ProfileEntryState = 'unauthenticated' | 'zero_roles' | 'single_role' | 'multi_role';

type AnalyticsEventMap = {
  profile_entry_opened: { source?: string };
  profile_entry_state_detected: { state: ProfileEntryState };
  profile_role_switched: { role: string; source?: string };
  profile_add_role_clicked: { role?: string; action?: 'create' | 'claim' | 'dashboard' };
  auth_viewed: { mode: 'signin' | 'signup'; source?: string };
  signup_step_viewed: { step: 1 | 2; role: string };
  signup_step_completed: { step: 1 | 2; role: string };
  signup_failed: { step: 2; role: string; reason?: string };
  signup_completed: { role: string; verification: 'session' | 'email_confirmation' };
  auth_email_checked: { source?: string; result: 'valid' | 'invalid' };
  auth_auto_switched_to_signup: { source?: string; reason: 'email_not_found' };
  auth_email_lookup_routed: { source?: string; route: 'returning' | 'new' | 'fallback' };
  auth_code_send_clicked: { source?: string; route: 'returning' | 'new' | 'unknown' };
  auth_code_verified: { source?: string; route: 'returning' | 'new' | 'unknown' };
  auth_change_email_clicked: { source?: string };
  /** `tab` is MapTab itself, not a hand-copied union: adding a tab (the planned
   *  Festivals one) must widen this contract by construction rather than break
   *  TabBar at a call site unrelated to the change. */
  home_tab_selected: { tab: MapTab };
  /** Dancer-app funnel (modules/dancer-app/analytics/events.ts); signed-in people only. */
  dancer_app_entered: { source?: string };
  onboarding_step: { step: string };
  profile_strength_70: { pct: number };
  first_going_tap: { surface?: string };
  first_level_vote: { level?: string };
  feedback_sent: { channel?: string };
};

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

export const trackAnalyticsEvent = <T extends keyof AnalyticsEventMap>(
  eventName: T,
  payload: AnalyticsEventMap[T]
) => {
  const eventPayload = { event: eventName, ...payload };

  if (typeof window !== 'undefined' && Array.isArray(window.dataLayer)) {
    window.dataLayer.push(eventPayload);
  }

  if (import.meta.env.DEV) {
    console.debug('[analytics]', eventPayload);
  }
};
