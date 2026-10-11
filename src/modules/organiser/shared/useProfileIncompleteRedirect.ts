import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { finishProfileHref } from '@/lib/profileCompletion';

/**
 * An organiser create / claim / request the SERVER refused with
 * PROFILE_INCOMPLETE_CODE (selfServeErrors): the dancer-first gate, enforced
 * by the admin repo's RPCs. Instead of a raw error, the person goes to the
 * gated Finish screen (it says why, no Skip, and re-asks the server on arrival)
 * and comes back to `returnTo` (default: this page) once the profile is complete.
 */
export function useProfileIncompleteRedirect() {
  const navigate = useNavigate();
  const { pathname, search, hash } = useLocation();
  return useCallback(
    (returnTo?: string) => navigate(finishProfileHref(returnTo ?? `${pathname}${search}${hash}`, { gate: true })),
    [navigate, pathname, search, hash],
  );
}
