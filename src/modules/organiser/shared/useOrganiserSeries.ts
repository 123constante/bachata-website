// ONE lookup of "this series, for this login" (ER-S1). Replaces the three copies of
// allSeries/findSeries in flows/add/addModel, flows/change/changeModel and
// events/eventsApi, and tells the not-found cases apart instead of one "Not found".
//
// Order: organiser_home_v1 first (cache already warm); only a series home does not
// carry is asked of admin_event_workspace_p5 (members only), which settles
// archived / no access / gone. A series with 0 dates is still found.

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { isListedSeries, type HomeSeriesFull } from '@/modules/organiser/shared/homeModel';
import {
  fetchOrganiserHome,
  fetchSeriesWorkspace,
  organiserHomeQueryKey,
  seriesWorkspaceQueryKey,
  type HomeOrganiser,
  type OrganiserHome,
} from '@/modules/organiser/shared/selfServeApi';
import { isAccessRefusal } from '@/modules/organiser/shared/selfServeErrors';
import type { SeriesWorkspace } from '@/modules/organiser/shared/seriesModel';

/** Every listed (never archived) series of the login across its pages, once each, in home's order. */
export function listedFromOrganisers(organisers: HomeOrganiser[] | undefined): HomeSeriesFull[] {
  const seen = new Set<string>();
  return (organisers ?? []).flatMap((o) => o.series ?? []).filter((s) => {
    if (!isListedSeries(s) || seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}

export const allSeries = (home: OrganiserHome | undefined): HomeSeriesFull[] => listedFromOrganisers(home?.organisers);

/** The synchronous half: the series if home lists it (screens that already hold the home read). */
export const findSeries = (home: OrganiserHome | undefined, seriesId: string): HomeSeriesFull | null =>
  allSeries(home).find((s) => s.id === seriesId) ?? null;

/** A HomeSeriesFull built from the workspace read, for a series home did not carry. */
export function seriesFromWorkspace(ws: SeriesWorkspace, today: string): HomeSeriesFull {
  const coming = ws.dates.filter((d) => d.occurrence_date >= today);
  const scheduled = coming.filter((d) => d.lifecycle_status === 'scheduled');
  return {
    id: ws.series.id,
    name: ws.series.name,
    slug: ws.series.slug,
    format: ws.series.format,
    category: ws.series.category,
    lifecycle_status: ws.series.lifecycle_status,
    default_local_start_time: ws.series.default_local_start_time,
    default_cover_image_url: ws.series.default_cover_image_url,
    created_at: ws.series.created_at ?? '',
    upcoming_count: scheduled.length,
    cancelled_upcoming_count: coming.length - scheduled.length,
    next_dates: scheduled.slice(0, 3).map((d) => ({
      occurrence_id: d.id,
      occurrence_date: d.occurrence_date,
      lifecycle_status: d.lifecycle_status,
      materialised_start_utc: d.materialised_start_utc,
      has_own_changes: d.has_override,
    })),
    latest_decision: null,
  };
}

export type OrganiserSeriesState =
  | { state: 'loading' }
  | { state: 'found'; series: HomeSeriesFull }
  | { state: 'not-found-archived' }
  | { state: 'no-access' }
  | { state: 'gone' }
  /** A read failed for a reason that is none of the above (offline, server): retry. */
  | { state: 'error'; retry: () => void };

const archivedInHome = (home: OrganiserHome | undefined, seriesId: string): boolean =>
  (home?.organisers ?? []).some((o) => (o.series ?? []).some((s) => s.id === seriesId && !isListedSeries(s)));

type Pending = { state: 'loading' } | { state: 'error' } | null;

/** Pure: the answer from what the two reads hold so far. */
export function resolveSeries(
  home: { data?: OrganiserHome; isError: boolean },
  workspace: { enabled: boolean; data?: SeriesWorkspace; error?: unknown; isError: boolean },
  seriesId: string,
  retry: () => void,
): OrganiserSeriesState {
  const pending: Pending = home.isError ? { state: 'error' } : !home.data ? { state: 'loading' } : null;
  if (pending) return pending.state === 'error' ? { state: 'error', retry } : pending;

  const listed = findSeries(home.data, seriesId);
  if (listed) return { state: 'found', series: listed };
  if (archivedInHome(home.data, seriesId)) return { state: 'not-found-archived' };

  if (!workspace.enabled) return { state: 'gone' };
  if (workspace.isError) return isAccessRefusal(workspace.error) ? { state: 'no-access' } : { state: 'error', retry };
  if (!workspace.data) return { state: 'loading' };
  if (!workspace.data.series.id) return { state: 'gone' };
  if (!isListedSeries(workspace.data.series)) return { state: 'not-found-archived' };
  return { state: 'found', series: seriesFromWorkspace(workspace.data, home.data?.today ?? '') };
}

export function useOrganiserSeries(seriesId: string): OrganiserSeriesState {
  const { user } = useAuth();
  const home = useQuery({ queryKey: organiserHomeQueryKey(user?.id), queryFn: fetchOrganiserHome, enabled: !!user?.id });
  const needWorkspace = !!seriesId && !!home.data && !findSeries(home.data, seriesId) && !archivedInHome(home.data, seriesId);
  const ws = useQuery({
    queryKey: seriesWorkspaceQueryKey(seriesId),
    queryFn: () => fetchSeriesWorkspace(seriesId),
    enabled: needWorkspace,
  });
  const retry = () => { void home.refetch(); if (needWorkspace) void ws.refetch(); };
  return resolveSeries(home, { enabled: needWorkspace || !!ws.data, data: ws.data, error: ws.error, isError: ws.isError }, seriesId, retry);
}
