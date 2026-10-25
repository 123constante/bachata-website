import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { GOING_CHECKIN_ENABLED } from '@/lib/goingCheckin';
import {
  NIGHTS_GOING_DEFAULT_LIMIT,
  fetchMyGoing,
  fetchNightsGoing,
  setMyGoing,
  GoingRpcError,
  type MyGoing,
  type MyGoingNight,
  type NightGoing,
  nightGoingKnown,
} from './goingRpc';
import {
  goingStateFor,
  type GoingErrorCode,
  type GoingNightStatus,
  type GoingView,
  type GoingViewer,
} from './goingState';
import { GOING_COPY } from './goingCopy';
import { useGoingReturnTo, useGoingViewer } from './useGoingViewer';

/**
 * React Query for going. Every key starts with 'going', so a surface that
 * changes going elsewhere can invalidate with goingKeys / invalidateGoing and
 * never guess.
 *
 *   nights(ids, limit) -- get_nights_going_v1 for a SET of nights (sorted, de-duplicated)
 *   mine(userId)       -- get_my_going_v1 for the signed-in viewer
 */
export const goingKeys = {
  all: ['going'] as const,
  nightsPrefix: ['going', 'nights'] as const,
  nights: (occurrenceIds: readonly string[], limit: number = NIGHTS_GOING_DEFAULT_LIMIT) =>
    ['going', 'nights', limit, ...[...new Set(occurrenceIds.filter(Boolean))].sort()] as const,
  mine: (userId: string | null | undefined) => ['going', 'mine', userId ?? null] as const,
  minePrefix: ['going', 'mine'] as const,
  /** get_my_event_going_v1 (Going P3, the organiser read), per viewer and event. */
  event: (userId: string | null | undefined, publicEventId: string | null | undefined) =>
    ['going', 'event', userId ?? null, publicEventId ?? null] as const,
  eventPrefix: ['going', 'event'] as const,
  /** get_my_organiser_going_total_v1 (the Stats total), per viewer. */
  organiserTotal: (userId: string | null | undefined) => ['going', 'organiserTotal', userId ?? null] as const,
  organiserTotalPrefix: ['going', 'organiserTotal'] as const,
};

/** Does a nights key cover this occurrence? */
const nightsKeyHas = (key: QueryKey, occurrenceId: string): boolean =>
  key[0] === 'going' && key[1] === 'nights' && key.slice(3).includes(occurrenceId);

/** Invalidate every nights read that covers this occurrence, the viewer's own list and the organiser reads (incl. the total). */
export const invalidateGoing = (qc: QueryClient, occurrenceId: string): Promise<void> =>
  Promise.all([
    qc.invalidateQueries({ predicate: (q) => nightsKeyHas(q.queryKey, occurrenceId) }),
    qc.invalidateQueries({ queryKey: goingKeys.minePrefix }),
    qc.invalidateQueries({ queryKey: goingKeys.organiserTotalPrefix }),
    // Only the organiser reads that hold this night (or have not loaded yet).
    qc.invalidateQueries({
      queryKey: goingKeys.eventPrefix,
      predicate: (q) => {
        const nights = (q.state.data as { nights?: { occurrence_id: string }[] } | undefined)?.nights;
        return !nights || nights.some((n) => n.occurrence_id === occurrenceId);
      },
    }),
  ]).then(() => undefined);

const GOING_STALE_MS = 30_000;

/** Count + people for many nights in ONE request (chunked at 200 ids). Off while the switch is off. */
export const useNightsGoing = (
  occurrenceIds: readonly string[],
  opts: { enabled?: boolean; limit?: number } = {},
) => {
  const limit = opts.limit ?? NIGHTS_GOING_DEFAULT_LIMIT;
  const key = goingKeys.nights(occurrenceIds, limit);
  const ids = key.slice(3) as string[];
  return useQuery({
    queryKey: key,
    queryFn: () => fetchNightsGoing(ids, limit),
    enabled: GOING_CHECKIN_ENABLED && (opts.enabled ?? true) && ids.length > 0,
    staleTime: GOING_STALE_MS,
  });
};

/** The signed-in viewer's nights (get_my_going_v1). Never runs for signed-out or anonymous viewers. */
export const useMyGoing = (opts: { enabled?: boolean } = {}) => {
  const { user } = useAuth();
  const signedIn = Boolean(user?.id) && !user?.is_anonymous;
  return useQuery({
    queryKey: goingKeys.mine(signedIn ? user?.id : null),
    queryFn: fetchMyGoing,
    enabled: GOING_CHECKIN_ENABLED && signedIn && (opts.enabled ?? true),
    staleTime: GOING_STALE_MS,
  });
};

/** Is this occurrence in the viewer's list? */
export const isInMyGoing = (mine: MyGoing | undefined, occurrenceId: string): boolean =>
  Boolean(mine && [...mine.upcoming, ...mine.past].some((n) => n.occurrence_id === occurrenceId));

const stubNight = (occurrenceId: string): MyGoingNight => ({
  occurrence_id: occurrenceId,
  public_event_id: null,
  event_title: null,
  occurrence_date: null,
  starts_at_local: null,
  venue_id: null,
  venue_name: null,
  event_lifecycle: null,
  night_lifecycle: null,
  is_cancelled: false,
});

const withGoing = (mine: MyGoing | undefined, occurrenceId: string, going: boolean): MyGoing | undefined => {
  if (!mine) return mine;
  const drop = (l: MyGoingNight[]) => l.filter((n) => n.occurrence_id !== occurrenceId);
  if (!going) return { upcoming: drop(mine.upcoming), past: drop(mine.past) };
  if (isInMyGoing(mine, occurrenceId)) return mine;
  return { upcoming: [...mine.upcoming, stubNight(occurrenceId)], past: mine.past };
};

const bumpCount = (map: Record<string, NightGoing> | undefined, occurrenceId: string, delta: number) => {
  const night = map?.[occurrenceId];
  if (!map || !night) return map;
  return {
    ...map,
    [occurrenceId]: { ...night, going_count: Math.max(0, night.going_count + delta), people_count: night.people_count ?? night.going_count },
  };
};

const setCount = (map: Record<string, NightGoing> | undefined, occurrenceId: string, count: number) => {
  const night = map?.[occurrenceId];
  if (!map || !night) return map;
  return {
    ...map,
    [occurrenceId]: { ...night, going_count: Math.max(0, count), people_count: night.people_count ?? night.going_count },
  };
};

export type UseNightGoingArgs = {
  occurrenceId: string | null | undefined;
  /** The night's status (goingNightStatus). */
  night: GoingNightStatus;
  /**
   * Every occurrence id on the screen, so many rows share ONE nights request.
   * Defaults to just this night.
   */
  batchIds?: readonly string[];
  limit?: number;
  /** Hold every read (e.g. until the clock has been read after mount). */
  enabled?: boolean;
  /** Override the viewer (tests, or a surface that already knows it). */
  viewer?: GoingViewer;
};

export type NightGoingResult = {
  view: GoingView;
  /** going_count (optimistic while a save is in flight); 0 when not known -- check countKnown. */
  count: number;
  /** false = the read failed, is loading, or the database dropped the id: no count may be claimed. */
  countKnown: boolean;
  /** The count `people` was read with (GoingPeople's peopleCount): keeps "+N more" stable during a save. */
  peopleCount: number;
  people: NightGoing['people'];
  peopleLoading: boolean;
  peopleError: boolean;
  refetchPeople: () => void;
  /** The viewer's own list failed: going is unknown (the button is off) until retryMine succeeds. */
  mineError: boolean;
  retryMine: () => void;
  /** Do what view.control.action says (go / ungo). sign_in and none are the caller's to handle. */
  tap: () => void;
};

/**
 * ONE night's going: the count and people (batched read), whether the viewer
 * is going (from get_my_going_v1), and the write (set_my_going_v1) with an
 * optimistic count + list and a rollback on refusal. Its view comes from
 * goingStateFor, so the words and button are the module's, never the surface's.
 */
export const useNightGoing = (args: UseNightGoingArgs): NightGoingResult => {
  const { occurrenceId, night, limit = NIGHTS_GOING_DEFAULT_LIMIT, enabled = true } = args;
  const id = occurrenceId ?? '';
  const qc = useQueryClient();
  const { user } = useAuth();
  const hookViewer = useGoingViewer();
  const viewer = args.viewer ?? hookViewer;
  const returnTo = useGoingReturnTo();
  const [lastError, setLastError] = useState<GoingErrorCode | null>(null);

  const batch = useMemo(() => (args.batchIds && args.batchIds.length > 0 ? [...args.batchIds, id] : [id]), [args.batchIds, id]);
  const nightsKey = goingKeys.nights(batch, limit);
  const nights = useNightsGoing(batch, { enabled: enabled && Boolean(id), limit });
  const signedIn = viewer.kind !== 'signed_out' && viewer.kind !== 'anonymous' && viewer.kind !== 'loading';
  const mine = useMyGoing({ enabled: enabled && signedIn && Boolean(id) });
  const mineKey = goingKeys.mine(user?.id);

  const mutation = useMutation({
    mutationFn: (next: boolean) => setMyGoing(id, next),
    onMutate: async (next) => {
      setLastError(null);
      await Promise.all([qc.cancelQueries({ queryKey: mineKey }), qc.cancelQueries({ queryKey: nightsKey })]);
      const prevMine = qc.getQueryData<MyGoing>(mineKey);
      const prevNights = qc.getQueriesData<Record<string, NightGoing>>({ predicate: (q) => nightsKeyHas(q.queryKey, id) });
      const was = isInMyGoing(prevMine, id);
      qc.setQueryData<MyGoing | undefined>(mineKey, (m) => withGoing(m, id, next));
      if (was !== next) {
        for (const [key] of prevNights) {
          qc.setQueryData<Record<string, NightGoing> | undefined>(key, (m) => bumpCount(m, id, next ? 1 : -1));
        }
      }
      return { prevMine, prevNights };
    },
    onSuccess: (data) => {
      for (const [key] of qc.getQueriesData<Record<string, NightGoing>>({ predicate: (q) => nightsKeyHas(q.queryKey, id) })) {
        qc.setQueryData<Record<string, NightGoing> | undefined>(key, (m) => setCount(m, id, data.going_count));
      }
      qc.setQueryData<MyGoing | undefined>(mineKey, (m) => withGoing(m, id, data.going));
    },
    onError: (error, _next, context) => {
      setLastError(error instanceof GoingRpcError ? error.code : 'unknown');
      if (context) {
        qc.setQueryData(mineKey, context.prevMine);
        for (const [key, data] of context.prevNights) qc.setQueryData(key, data);
      }
    },
    onSettled: () => {
      // The true people list (the viewer's own face/name) and every list that shows this night.
      void invalidateGoing(qc, id);
    },
  });

  const row = nights.data?.[id];
  // A count the database did not give (read failed / loading / id dropped) is never claimed.
  const countKnown = !nights.isError && nightGoingKnown(row);
  const count = countKnown ? row.going_count : 0;
  const peopleCount = countKnown ? (row.people_count ?? row.going_count) : 0;
  // A failed own-list read leaves "is the viewer going?" UNKNOWN (null = the
  // loading state, button off), never "not going": that would show someone who
  // IS going the go / Finish-your-profile control and no way to take their name
  // off. The retry below re-reads it (review R13).
  const going: boolean | null = !signedIn ? false : mine.data ? isInMyGoing(mine.data, id) : null;
  const mineError = signedIn && mine.isError && !mine.data;

  const baseView = goingStateFor({
    viewer,
    night,
    going: mutation.isPending && mutation.variables !== undefined ? mutation.variables : going,
    pending: mutation.isPending,
    error: lastError,
    count: countKnown ? count : null,
    returnTo,
  });
  // The people and count still show (they loaded); only the viewer's own line says why the button is off.
  const view = mineError && baseView.state === 'loading' ? { ...baseView, words: GOING_COPY.mineLoadFailed } : baseView;

  return {
    view,
    count,
    countKnown,
    peopleCount,
    people: row?.people ?? [],
    peopleLoading: nights.isPending && nights.fetchStatus !== 'idle',
    // A dropped id (no row for it) is as unknown as a failed read: the retry state, never "0 going".
    peopleError: nights.isError || (nights.isSuccess && !countKnown),
    refetchPeople: () => void nights.refetch(),
    mineError,
    retryMine: () => void mine.refetch(),
    tap: () => {
      if (!id || !view.control.enabled || mutation.isPending) return;
      if (view.control.action === 'go') mutation.mutate(true);
      else if (view.control.action === 'ungo') mutation.mutate(false);
    },
  };
};
