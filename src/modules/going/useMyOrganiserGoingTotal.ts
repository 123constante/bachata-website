import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { GOING_CHECKIN_ENABLED } from '@/lib/goingCheckin';
import { GoingRpcError, fetchMyOrganiserGoingTotal, type MyOrganiserGoingTotal } from './goingRpc';
import { organiserGoingStateFor, type GoingErrorCode, type OrganiserGoingView } from './goingState';
import { goingKeys } from './useNightGoing';

const ORGANISER_TOTAL_STALE_MS = 30_000;

/** A refusal is an answer, not a blip: only a network / unknown failure is retried (once). */
const retryable = (failures: number, error: unknown): boolean =>
  failures < 1 && !(error instanceof GoingRpcError && error.code !== 'network' && error.code !== 'unknown');

export type MyOrganiserGoingTotalResult = {
  /** THE state (organiserGoingStateFor): off / loading / ready / not_signed_in / error. */
  view: OrganiserGoingView;
  /** The total; null until ready. {0,0,0} is a real answer (no upcoming taps, or no seat). */
  total: MyOrganiserGoingTotal | null;
  /** Read again (the error state's Try again). Stable across renders. */
  retry: () => void;
  /** A read is in flight (first load or a retry). */
  fetching: boolean;
  /**
   * A re-read failed (network / unknown) while a total was already on screen: it
   * stays (view stays 'ready') and GoingTotalStat says it may be out of date. A
   * refusal on a re-read is not kept: the view shows that refusal.
   */
  refreshFailed: boolean;
};

/**
 * The signed-in organiser's going total across their upcoming, not-cancelled
 * nights (get_my_organiser_going_total_v1, the Stats total). Off while the
 * going switch is off; never runs for a signed-out or anonymous viewer (that is
 * the not_signed_in state without a request).
 */
export const useMyOrganiserGoingTotal = (opts: { enabled?: boolean } = {}): MyOrganiserGoingTotalResult => {
  const { user, isLoading } = useAuth();
  const signedIn = Boolean(user?.id) && !user?.is_anonymous;
  const on = GOING_CHECKIN_ENABLED && (opts.enabled ?? true);
  const q = useQuery({
    queryKey: goingKeys.organiserTotal(signedIn ? user?.id : null),
    queryFn: fetchMyOrganiserGoingTotal,
    enabled: on && signedIn,
    staleTime: ORGANISER_TOTAL_STALE_MS,
    retry: retryable,
  });
  const { refetch } = q;
  const retry = useCallback(() => void refetch(), [refetch]);
  const error: GoingErrorCode | null = q.error instanceof GoingRpcError ? q.error.code : q.error ? 'unknown' : null;
  // A failed RE-read keeps what loaded (TanStack keeps data, status turns 'error') --
  // but only a blip (network / unknown): a refusal (signed out meanwhile) is its own state.
  const kept = q.status === 'error' && q.data !== undefined && (error === 'network' || error === 'unknown');
  const view = organiserGoingStateFor({
    enabled: on,
    signedIn: isLoading && !signedIn ? null : signedIn,
    status: kept ? 'success' : q.status,
    error,
  });
  return {
    view,
    total: view.state === 'ready' ? q.data ?? null : null,
    retry,
    fetching: q.isFetching,
    refreshFailed: kept,
  };
};
