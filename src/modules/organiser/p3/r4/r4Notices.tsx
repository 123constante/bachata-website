import { useLocation } from 'react-router-dom';
import { ClaimNotice } from '../../home/ClaimNotice';
import { useP3Home } from '../data/useP3Data';
import { P3_PATHS } from '../shell/paths';
import { GraceBanner } from '../screens/GraceBanner';

/** Welcome's claim / create line, carried in the router state (P3 W4b). */
export function confirmationOf(state: unknown): string | null {
  const c = (state as { confirmation?: unknown } | null)?.confirmation;
  return typeof c === 'string' && c.trim() ? c : null;
}

/** The claim / create line, ClaimNotice and GraceBanner: shared by R4 Home and Events. */
export function HomeNotices({ confirmation }: { confirmation: string | null }) {
  return (
    <>
      {confirmation && <p className="p3-ok" role="status" data-testid="p3-home-confirmation">{confirmation}</p>}
      <ClaimNotice />
      <GraceBanner />
    </>
  );
}

/**
 * A signed-in user with no organiser page lands on Welcome, as Home does. A claim or create that just
 * landed waits for the refetch, or the stale "no page" answer would send them straight back.
 */
export function useNoPageRedirect(): { loading: boolean; to: string | null } {
  const home = useP3Home();
  const confirmation = confirmationOf(useLocation().state);
  if (home.isPending) return { loading: true, to: null };
  if (home.isError || home.data.organisers.length > 0) return { loading: false, to: null };
  if (confirmation && home.isFetching) return { loading: true, to: null };
  return { loading: false, to: P3_PATHS.start };
}
