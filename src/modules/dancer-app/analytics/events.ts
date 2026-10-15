import { useLayoutEffect } from 'react';
import { trackAnalyticsEvent } from '@/lib/analytics';

/**
 * The dancer-app funnel events (owner decision D11c). Typed in
 * src/lib/analytics.ts AnalyticsEventMap and sent through the existing
 * trackAnalyticsEvent (dataLayer); no new storage.
 *
 * NEVER for a signed-out visitor: trackDancerEvent is a no-op unless the shell
 * has published a signed-in person (useDancerAnalyticsIdentity, called by
 * DancerAppRoutes inside AuthGuard). A layout effect, so the identity is set
 * before any screen's ordinary useEffect fires an event, and cleared when the
 * app unmounts (sign-out unmounts it via AuthGuard).
 */
export const DANCER_EVENTS = [
  'dancer_app_entered',
  'onboarding_step',
  'profile_strength_70',
  'first_going_tap',
  'first_level_vote',
  'feedback_sent',
] as const;
export type DancerEventName = (typeof DANCER_EVENTS)[number];

/** The payload AnalyticsEventMap (src/lib/analytics.ts) declares for an event. */
export type DancerEventProps<N extends DancerEventName> = Parameters<typeof trackAnalyticsEvent<N>>[1];

let signedInUserId: string | null = null;

/** Tests and the shell only. */
export const setDancerAnalyticsUser = (userId: string | null): void => {
  signedInUserId = userId;
};

/** Send a funnel event. Returns whether it was sent (false = signed out, nothing sent). */
export const trackDancerEvent = <N extends DancerEventName>(name: N, props: DancerEventProps<N>): boolean => {
  if (!signedInUserId) return false;
  trackAnalyticsEvent(name, props);
  return true;
};

/** Publish who is signed in for trackDancerEvent; null (or an anonymous user) = nobody. */
export const useDancerAnalyticsIdentity = (user: { id: string; is_anonymous?: boolean } | null | undefined): void => {
  const id = user && !user.is_anonymous ? user.id : null;
  useLayoutEffect(() => {
    setDancerAnalyticsUser(id);
    return () => setDancerAnalyticsUser(null);
  }, [id]);
};
