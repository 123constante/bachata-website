import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { EventPageSnapshot } from '@/modules/event-page/types';
import { eventPageQueryKey } from '@/modules/event-page/useEventPageQuery';

/**
 * The caller's RSVP for ONE night, via the admin-owned RPCs (admin PR #634,
 * migration 20261109360000). Never writes event_attendance directly -- the
 * 2026-09-07 removal (#369) was precisely of a direct table writer.
 *
 *   set_my_occurrence_attendance_p5_v1(p_public_event_id, p_occurrence_id, p_status)
 *     p_status interested|going|not_going sets; null clears the caller's row.
 *   get_my_occurrence_attendance_p5_v1(p_public_event_id, p_occurrence_id) -> text
 *
 * Both are authenticated-only and reject anonymous sessions server-side, so the
 * read is gated on a real (non-anonymous) signed-in user, mirroring the
 * is_anonymous check in useSeriesLevelRating.
 */

export type RsvpStatus = 'interested' | 'going' | 'not_going';

export const myOccurrenceRsvpQueryKey = (
  publicEventId: string | null | undefined,
  occurrenceId: string | null | undefined,
  userId: string | null | undefined,
) => ['my-occurrence-rsvp', publicEventId ?? null, occurrenceId ?? null, userId ?? null] as const;

const RSVP_STATUSES: readonly string[] = ['interested', 'going', 'not_going'];
const asStatus = (value: unknown): RsvpStatus | null =>
  typeof value === 'string' && RSVP_STATUSES.includes(value) ? (value as RsvpStatus) : null;

type RpcError = { code?: string; message?: string };

/** Short, dancer-facing copy for the RPC's SQLSTATE + message-prefix contract. */
export const rsvpErrorMessage = (error: unknown): string => {
  const { code, message = '' } = (error ?? {}) as RpcError;
  if (code === '28000') return 'Sign in to RSVP.';
  if (code === '22023') return 'Something went wrong with this event link. Please refresh.';
  if (code === 'P0002') return "We couldn't find this night.";
  if (code === 'P0001') {
    if (message.startsWith('occurrence_cancelled')) return 'This night has been cancelled.';
    if (message.startsWith('occurrence_ended')) return 'This night has already ended.';
    if (message.startsWith('rsvp_closed')) return "This event isn't taking RSVPs right now.";
  }
  return "Couldn't update your RSVP. Please try again.";
};

type Args = {
  /** event_series_p5.public_event_id -- the snapshot's event_id. */
  publicEventId: string | null;
  /** The P5 occurrence the page is showing -- the snapshot's occurrence_id. */
  occurrenceId: string | null;
  /** The id the page's snapshot query is keyed by (the route param). */
  pageEventId: string | null;
  /** Hold the status read (RsvpBlock waits for its post-mount clock check). */
  enabled: boolean;
};

// Only the going count is bumped: snapshot_compat serves interested_count as a
// constant 0 and nothing renders it.
const bumpGoing = (n: number, prev: RsvpStatus | null, next: RsvpStatus | null) =>
  Math.max(0, n - (prev === 'going' ? 1 : 0) + (next === 'going' ? 1 : 0));

export const useOccurrenceRsvp = ({ publicEventId, occurrenceId, pageEventId, enabled }: Args) => {
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const canRsvp = Boolean(user?.id) && !user?.is_anonymous;
  const statusKey = myOccurrenceRsvpQueryKey(publicEventId, occurrenceId, user?.id);
  // Every occurrence variant of this page's snapshot (pinned or not).
  const snapshotPrefix = eventPageQueryKey(pageEventId).slice(0, 2);

  const statusQuery = useQuery({
    queryKey: statusKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_occurrence_attendance_p5_v1', {
        p_public_event_id: publicEventId as string,
        p_occurrence_id: occurrenceId as string,
      });
      if (error) throw error;
      return asStatus(data);
    },
    enabled: enabled && canRsvp && Boolean(publicEventId && occurrenceId),
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: async (next: RsvpStatus | null) => {
      const { data, error } = await supabase.rpc('set_my_occurrence_attendance_p5_v1', {
        p_public_event_id: publicEventId as string,
        p_occurrence_id: occurrenceId as string,
        p_status: next as string,
      });
      if (error) throw error;
      return data;
    },
    onMutate: async (next) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: statusKey }),
        queryClient.cancelQueries({ queryKey: snapshotPrefix }),
      ]);
      const prevStatus = queryClient.getQueryData<RsvpStatus | null>(statusKey) ?? null;
      const prevSnapshots = queryClient.getQueriesData<EventPageSnapshot | null>({ queryKey: snapshotPrefix });

      queryClient.setQueryData(statusKey, next);
      queryClient.setQueriesData<EventPageSnapshot | null>({ queryKey: snapshotPrefix }, (snap) =>
        snap && snap.occurrenceId === occurrenceId
          ? {
              ...snap,
              attendance: {
                ...snap.attendance,
                goingCount: bumpGoing(snap.attendance.goingCount, prevStatus, next),
              },
            }
          : snap,
      );
      return { prevStatus, prevSnapshots };
    },
    onSuccess: (data) => {
      // The RPC echoes the stored status, so no status re-read is needed.
      queryClient.setQueryData(statusKey, asStatus((data as { status?: unknown } | null)?.status));
      // My Attendance lists RSVPs; its comment notes nothing invalidated it before.
      void queryClient.invalidateQueries({ queryKey: ['my-event-attendance', user?.id] });
    },
    onError: (_error, _next, context) => {
      if (context) {
        queryClient.setQueryData(statusKey, context.prevStatus);
        for (const [key, data] of context.prevSnapshots) queryClient.setQueryData(key, data);
      }
      void queryClient.invalidateQueries({ queryKey: statusKey });
    },
    onSettled: () => {
      // Refetches only the ACTIVE snapshot (the one on screen) for the true count.
      void queryClient.invalidateQueries({ queryKey: snapshotPrefix });
    },
  });

  return {
    status: canRsvp ? (statusQuery.data ?? null) : null,
    // True while the caller's status is not known (loading OR failed): a tap
    // then could re-send 'going' when they meant to clear it.
    statusUnknown: statusQuery.isEnabled && statusQuery.data === undefined,
    statusError: statusQuery.isError,
    refetchStatus: statusQuery.refetch,
    canRsvp,
    authLoading,
    setStatus: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
};
