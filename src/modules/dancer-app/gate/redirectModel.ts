import { DANCER_HOME_PATH, oldDancerHomeRedirect, type OldDancerHomeFacts } from '@/lib/accountRouting';

/**
 * Where RedirectIfAllowed sends an ALLOWED, signed-in person, or null = stay on
 * today's page. The decision is lib/accountRouting's oldDancerHomeRedirect --
 * the ONE mapping the sign-in chooser and the profile switcher also read --
 * fed the same two organiser reads src/pages/Account.tsx makes (organiser_home_v1,
 * my access requests) under the same query keys. Imported, never restated.
 *
 * - /account/dancer is the dancer side itself: anyone allowed goes to the app,
 *   organisers included (owner report 2026-10-15);
 * - /account and /finish-profile fail CLOSED as before: organiser-type, a
 *   loading or failed organiser read, or an unknown profile stays put.
 */
export type ProfileFact = OldDancerHomeFacts['profile'];

export type RedirectFacts = Omit<OldDancerHomeFacts, 'view' | 'allowed'>;

/** Which old page is showing: /account/dancer, /finish-profile, else /account. Case-folded, as the router matches. */
export const oldDancerView = (pathname: string): OldDancerHomeFacts['view'] => {
  const p = pathname.toLowerCase().replace(/\/+$/, '');
  if (p === DANCER_HOME_PATH) return 'dancer';
  if (p === '/finish-profile') return 'finish';
  return 'resolve';
};

/** RedirectIfAllowed only mounts this for an allowed person; `view` defaults to /account's. */
export const allowedRedirectTarget = (f: RedirectFacts, view: OldDancerHomeFacts['view'] = 'resolve'): string | null =>
  oldDancerHomeRedirect({ ...f, view, allowed: true });

/** A react-query result -> a fact: undefined while loading, null when failed (or paused offline with nothing cached). */
export const queryFact = <T, R>(
  q: { data: T | undefined; isError: boolean; isPending: boolean; isPaused: boolean },
  pick: (d: T) => R,
): R | null | undefined => (q.data !== undefined ? pick(q.data) : q.isError || (q.isPending && q.isPaused) ? null : undefined);
