import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { GOING_CHECKIN_ENABLED } from '@/lib/goingCheckin';
import { GoingRpcError, fetchMyEventGoing, fetchMySeriesGoing, type MyEventGoing, type MyEventGoingNight } from './goingRpc';
import { organiserGoingStateFor, type GoingErrorCode, type OrganiserGoingView } from './goingState';
import { goingKeys } from './useNightGoing';

const ORGANISER_GOING_STALE_MS = 30_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A refusal is an answer, not a blip: only a network / unknown failure is retried (once). */
const retryable = (failures: number, error: unknown): boolean =>
  failures < 1 && !(error instanceof GoingRpcError && error.code !== 'network' && error.code !== 'unknown');

export type MyEventGoingResult = {
  /** THE state (organiserGoingStateFor): off / loading / ready / a refusal / error. */
  view: OrganiserGoingView;
  /** The event's upcoming nights (cancelled included), in start order; [] until ready. */
  nights: MyEventGoingNight[];
  data: MyEventGoing | undefined;
  /**
   * A re-read failed while nights were already on screen: they stay (view stays
   * 'ready'); the host may say the list could be out of date. false otherwise.
   */
  refreshFailed: boolean;
  /** Read again (the error state's Try again). Stable across renders. */
  retry: () => void;
  /** A read is in flight (first load or a retry). */
  fetching: boolean;
};

/**
 * Who is going to each upcoming night of ONE event, for its owner/managers
 * (get_my_event_going_v1, Going P3). Off while the going switch is off; never
 * runs for a signed-out or anonymous viewer (that is the not_signed_in state
 * without a request), nor for an id that is not a uuid (not_found without a
 * request: the database would answer 22P02, which no retry fixes). Pass
 * `publicEventId` null to wait.
 */
export const useMyEventGoing = (
  publicEventId: string | null | undefined,
  opts: { enabled?: boolean; /** the id is a SERIES id (organiser rows): read via get_my_series_going_v1 */ bySeries?: boolean } = {},
): MyEventGoingResult => {
  const { user, isLoading } = useAuth();
  const signedIn = Boolean(user?.id) && !user?.is_anonymous;
  const on = GOING_CHECKIN_ENABLED && (opts.enabled ?? true);
  const validId = Boolean(publicEventId) && UUID.test(publicEventId as string);
  const q = useQuery({
    queryKey: goingKeys.event(signedIn ? user?.id : null, opts.bySeries && publicEventId ? `series:${publicEventId}` : publicEventId),
    queryFn: () => (opts.bySeries ? fetchMySeriesGoing : fetchMyEventGoing)(publicEventId as string),
    enabled: on && signedIn && validId,
    staleTime: ORGANISER_GOING_STALE_MS,
    retry: retryable,
  });
  const { refetch } = q;
  const retry = useCallback(() => void refetch(), [refetch]);
  // A failed RE-read keeps what loaded (TanStack keeps data, status turns 'error').
  const kept = q.status === 'error' && q.data !== undefined;
  const error: GoingErrorCode | null = !publicEventId
    ? null
    : !validId
      ? 'not_found'
      : q.error instanceof GoingRpcError
        ? q.error.code
        : q.error
          ? 'unknown'
          : null;
  const view = organiserGoingStateFor({
    enabled: on,
    signedIn: isLoading && !signedIn ? null : signedIn,
    status: !publicEventId ? 'pending' : !validId ? 'error' : kept ? 'success' : q.status,
    error,
  });
  return {
    view,
    nights: view.state === 'ready' ? q.data?.nights ?? [] : [],
    data: q.data,
    refreshFailed: kept,
    retry,
    fetching: q.isFetching,
  };
};
