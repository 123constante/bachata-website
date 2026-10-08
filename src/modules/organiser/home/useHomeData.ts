import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import {
  fetchIncomingAccessRequests,
  fetchMyAccessRequests,
  fetchOccurrenceProgramme,
  fetchOrganiserHome,
  fetchSeriesWorkspace,
  incomingAccessRequestsQueryKey,
  myAccessRequestsQueryKey,
  occurrenceProgrammeQueryKey,
  organiserHomeQueryKey,
  seriesWorkspaceQueryKey,
} from '@/modules/organiser/shared/selfServeApi';
import type { Programme } from '@/modules/organiser/shared/programmeModel';
import {
  datesWithoutLineup,
  lastUpcomingDate,
  lineupCheckDates,
  nextDates,
  requestReaders,
  runwayCandidates,
  runwayStrip,
  type NextDate,
} from './homeView';

/** The home read and the user's own access requests (the same keys the old /account uses). */
export function useOrganiserHome(userId: string | undefined) {
  const home = useQuery({ queryKey: organiserHomeQueryKey(userId), queryFn: fetchOrganiserHome, enabled: !!userId });
  const requests = useQuery({ queryKey: myAccessRequestsQueryKey(userId), queryFn: fetchMyAccessRequests, enabled: !!userId });
  return { home, requests };
}

/**
 * The three Home strips. Each is computed from reads the old module already
 * makes (no new RPC); each stays hidden while loading or when its read fails,
 * because a strip is a nudge, never the page.
 */
export function useHomeStrips(home: Awaited<ReturnType<typeof fetchOrganiserHome>> | undefined) {
  const organisers = useMemo(() => home?.organisers ?? [], [home]);
  const today = home?.today ?? '';
  const dates: NextDate[] = useMemo(() => nextDates(organisers, today), [organisers, today]);

  // (a) team requests waiting
  const readers = useMemo(() => requestReaders(organisers), [organisers]);
  const incoming = useQueries({
    queries: readers.map((o) => ({
      queryKey: incomingAccessRequestsQueryKey(o.id),
      queryFn: () => fetchIncomingAccessRequests(o.id),
      staleTime: 60_000,
    })),
  });
  const teamRequests = incoming.reduce((n, q) => n + (q.data?.length ?? 0), 0);

  // (b) runway: only series that may be short need their dates read
  const candidates = useMemo(() => runwayCandidates(organisers), [organisers]);
  const needRead = candidates.filter((c) => c.lastDate === null);
  const workspaces = useQueries({
    queries: needRead.map((c) => ({
      queryKey: seriesWorkspaceQueryKey(c.seriesId),
      queryFn: () => fetchSeriesWorkspace(c.seriesId),
      staleTime: 60_000,
    })),
  });
  const resolved = candidates.map((c) => {
    if (c.lastDate) return c;
    const i = needRead.indexOf(c);
    const ws = workspaces[i]?.data;
    return { ...c, lastDate: ws ? lastUpcomingDate(ws.dates, today) : null };
  });
  const runway = today ? runwayStrip(resolved, today) : null;

  // (c) the first few dates with nobody teaching or DJing
  const checked = useMemo(() => lineupCheckDates(dates), [dates]);
  const programmes = useQueries({
    queries: checked.map((d) => ({
      queryKey: occurrenceProgrammeQueryKey(d.occurrenceId),
      queryFn: () => fetchOccurrenceProgramme(d.occurrenceId),
      staleTime: 60_000,
    })),
  });
  const byId = new Map<string, Programme>();
  programmes.forEach((q, i) => {
    if (q.data) byId.set(checked[i].occurrenceId, q.data);
  });
  const noLineup = datesWithoutLineup(checked, byId);

  return { organisers, today, dates, teamRequests, runway, noLineup };
}
