import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  fetchOccurrenceProgramme,
  fetchOrganiserHome,
  occurrenceProgrammeQueryKey,
  organiserHomeQueryKey,
  type HomeOrganiser,
} from '@/modules/organiser/shared/selfServeApi';
import { isListedSeries, type HomeSeriesFull } from '@/modules/organiser/shared/homeModel';

// The two event-truth reads every R1 flow sends through (plan 4.3 #11): kept
// here as re-exports so the old import path keeps working.
export { eventWorkspaceQueryKey, fetchEventWorkspace, useEventWorkspace, useRunCommands } from '@/modules/organiser/shared/runCommands';

export function useOrganiserHome() {
  const { user } = useAuth();
  return useQuery({ queryKey: organiserHomeQueryKey(user?.id), queryFn: fetchOrganiserHome, enabled: !!user?.id });
}

/** A series as My events lists it (organiser_home_v1 carries the venue name). */
export type ListedSeries = HomeSeriesFull & { default_venue_name?: string | null };

/** Every listed series (R3-4: never archived) across the caller's organisers, once each, by name. */
export function listedSeries(organisers: HomeOrganiser[] | undefined): ListedSeries[] {
  const seen = new Map<string, ListedSeries>();
  (organisers ?? []).forEach((o) => o.series.filter(isListedSeries).forEach((s) => { if (!seen.has(s.id)) seen.set(s.id, s as ListedSeries); }));
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** The sessions of one date (the line-up row, EditorRows.ScheduleCard). */
export function useNextDateProgramme(occurrenceId: string | undefined) {
  return useQuery({
    queryKey: occurrenceProgrammeQueryKey(occurrenceId),
    queryFn: () => fetchOccurrenceProgramme(occurrenceId as string),
    enabled: !!occurrenceId,
  });
}
