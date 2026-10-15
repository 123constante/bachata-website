import { accountHome } from '@/lib/accountRouting';
import { DANCER_HOME, DANCER_WELCOME } from '../shell/routes';

/**
 * Where RedirectIfAllowed sends an ALLOWED, signed-in person, or null = stay on
 * today's page. The organiser decision is accountHome() from lib/accountRouting
 * -- the exact function src/pages/Account.tsx uses -- fed the same two reads
 * (organiser_home_v1, my access requests) under the same query keys. It is
 * imported, never restated.
 *
 * Fails CLOSED: anything not proven stays on today's page.
 * - organiser-type (organiser, open access request, or an old organiser link)
 *   -> null: /account keeps sending them to /account/o exactly as today;
 * - either organiser read still loading or FAILED -> null (accountHome would
 *   call a failed read "dancer"; for a redirect AWAY from today's page an
 *   unproven answer is not enough);
 * - profile completeness (ProfileGateContext) loading / unknown -> null;
 *   complete -> Home; incomplete -> Welcome (onboarding);
 *   no_profile / error -> null: today's Finish screen has the message-us and
 *   Try-again paths for those, the new area does not yet.
 */
export type ProfileFact = 'complete' | 'incomplete' | 'no_profile' | 'error' | 'loading' | 'signed_out' | null;

export type RedirectFacts = {
  legacyParams: boolean;
  /** undefined = loading, null = the read failed. */
  organiserCount: number | null | undefined;
  openRequestCount: number | null | undefined;
  profile: ProfileFact;
};

export const allowedRedirectTarget = (f: RedirectFacts): string | null => {
  const where = accountHome({ legacyParams: f.legacyParams, organiserCount: f.organiserCount, openRequestCount: f.openRequestCount });
  if (where !== 'dancer') return null;
  if (f.organiserCount === null || f.openRequestCount === null) return null;
  if (f.profile === 'complete') return DANCER_HOME;
  if (f.profile === 'incomplete') return DANCER_WELCOME;
  return null;
};

/** A react-query result -> a fact: undefined while loading, null when failed (or paused offline with nothing cached). */
export const queryFact = <T, R>(
  q: { data: T | undefined; isError: boolean; isPending: boolean; isPaused: boolean },
  pick: (d: T) => R,
): R | null | undefined => (q.data !== undefined ? pick(q.data) : q.isError || (q.isPending && q.isPaused) ? null : undefined);
