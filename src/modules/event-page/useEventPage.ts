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

  // Always call get_public_festival_detail — the RPC runs for every published event,
  // not just festivals. Gate isFestival on festival-specific content being present:
  // - schedule items with explicit YYYY-MM-DD day keys (multi-day festival), OR
  // - festival passes (standard events never have passes).
  // Standard events with programs return schedule items with empty day strings,
  // so they correctly resolve to isFestival=false.
  const festivalQuery = useFestivalDetailQuery(eventId, Boolean(eventId));
  const isFestival = (() => {
    const fd = festivalQuery.data;
    if (!fd) return false;
    const hasDayedSchedule = fd.schedule.some(
      (s) => s.day && /^\d{4}-\d{2}-\d{2}$/.test(s.day),
    );
    return hasDayedSchedule || fd.passes.length > 0;
  })();

  const pageModel = useMemo(() => {
    const model = buildEventPageModel({
      snapshot: query.data ?? null,
      canEdit,
      isLoading: query.isLoading,
      hasError: Boolean(query.error),
    });

    // The snapshot RPC builds lineup per-occurrence. If the event has no
    // calendar_occurrences (occurrence_effective=null), the lineup is empty.
    // Fall back to the event-level lineup from the festival detail query,
    // which uses event_profile_links without an occurrence filter.
    if (!model.lineup.hasAny && festivalQuery.data?.lineup && !isFestival) {
      const fl = festivalQuery.data.lineup;
      const groups = (
        [
          { key: 'teachers' as const, label: 'Teachers', items: fl.teachers },
          { key: 'djs' as const, label: 'DJs', items: fl.djs },
          { key: 'videographers' as const, label: 'Videographers', items: fl.videographers },
          { key: 'vendors' as const, label: 'Vendors', items: fl.vendors },
        ] as typeof model.lineup.groups
      ).filter((g) => g.items.length > 0);
      if (groups.length > 0) {
        return { ...model, lineup: { groups, hasAny: true } };
      }
    }

    return model;
  }, [canEdit, query.data, query.error, query.isLoading, festivalQuery.data, isFestival]);

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
