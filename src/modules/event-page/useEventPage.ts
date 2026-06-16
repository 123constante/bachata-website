import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useEventPermissions } from '@/hooks/useEventPermissions';
import { buildEventPageModel } from '@/modules/event-page/buildEventPageModel';
import { useEventPageQuery } from '@/modules/event-page/useEventPageQuery';
import { useEventPageRsvpMutation, type RsvpStatus } from '@/modules/event-page/useEventPageRsvpMutation';
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
  // not just festivals. Gate isFestival on:
  // - format === 'festival' (P5 canonical field, Phase 8 primary signal), OR
  // - content-sniff fallback: MULTI-DAY schedule (≥2 distinct YYYY-MM-DD day keys),
  //   OR festival passes (standard events never have passes).
  // The content-sniff is kept as a COALESCE because legacy-only / null-format
  // events must not misroute to "Festival not found" (plan Phase 8, critique P0-5).
  // NB: a single dated day is NOT a festival signal — P5 standard events mirror
  // their program into legacy event_program_items with a concrete day, so
  // "any YYYY-MM-DD day" mis-classified them. ≥2 distinct days keeps real
  // multi-day festivals while letting single-day standard events resolve correctly.
  const festivalQuery = useFestivalDetailQuery(eventId, Boolean(eventId));
  const isFestival = (() => {
    if (query.data?.event.format === 'festival') return true;
    const fd = festivalQuery.data;
    if (!fd) return false;
    const distinctDays = new Set(
      fd.schedule.map((s) => s.day).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)),
    );
    return distinctDays.size >= 2 || fd.passes.length > 0;
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
    // which reads event_program_people across all program items for the event.
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
    // For standard events, expose the meta_data.program schedule as a fallback for the timeline.
    // Festivals use FestivalProgramSection instead.
    eventSchedule: !isFestival ? (festivalQuery.data?.schedule ?? null) : null,
    error: query.error ?? null,
    isLoading: query.isLoading,
    isRsvpPending: rsvpMutation.isPending,
    setRsvp: (status: RsvpStatus) => rsvpMutation.mutateAsync({ status }),
  };
};
