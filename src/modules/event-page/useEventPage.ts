import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useEventPermissions } from '@/hooks/useEventPermissions';
import { buildEventPageModel } from '@/modules/event-page/buildEventPageModel';
import { useEventPageQuery } from '@/modules/event-page/useEventPageQuery';
import { useEventPageRsvpMutation } from '@/modules/event-page/useEventPageRsvpMutation';
import { useFestivalDetailQuery } from '@/modules/event-page/useFestivalDetailQuery';

export const useEventPage = (eventId?: string | null, occurrenceId?: string | null) => {
  const { user } = useAuth();
  const query = useEventPageQuery(eventId, occurrenceId);
  const { canEdit } = useEventPermissions(eventId ?? undefined, query.data?.event.createdBy ?? undefined);
  const rsvpMutation = useEventPageRsvpMutation({
    eventId,
    occurrenceId: query.data?.occurrenceId ?? null,
    userId: user?.id ?? null,
  });

  // Always call get_public_festival_detail — it returns null for non-festivals.
  // isFestival is derived from the response being non-null, not from snapshot.event.type
  // (the snapshot RPC does not expose a type field in its event node).
  const festivalQuery = useFestivalDetailQuery(eventId, Boolean(eventId));
  const isFestival = festivalQuery.data !== null && festivalQuery.data !== undefined;

  const pageModel = useMemo(
    () =>
      buildEventPageModel({
        snapshot: query.data ?? null,
        canEdit,
        isLoading: query.isLoading,
        hasError: Boolean(query.error),
      }),
    [canEdit, query.data, query.error, query.isLoading],
  );

  return {
    snapshot: query.data ?? null,
    pageModel,
    festivalDetail: festivalQuery.data ?? null,
    isFestival,
    error: query.error ?? null,
    isLoading: query.isLoading,
    isRsvpPending: rsvpMutation.isPending,
    toggleRsvp: (nextGoing: boolean) => rsvpMutation.mutateAsync({ nextGoing }),
  };
};
