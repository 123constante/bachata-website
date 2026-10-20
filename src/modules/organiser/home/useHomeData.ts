import { useQuery } from '@tanstack/react-query';
import { londonTodayKey } from '@/lib/londonDate';
import {
  fetchIncomingAccessRequests,
  fetchMyAccessRequests,
  incomingAccessRequestsQueryKey,
  myAccessRequestsQueryKey,
} from '@/modules/organiser/shared/selfServeApi';
import { isListedSeries } from '@/modules/organiser/shared/homeModel';
import { homeJobs } from '@/modules/organiser/jobs/homeJobs';
import { useOrganiserChoice } from '../switch/useOrganiserChoice';
import { readsRequests } from './homeView';

/**
 * Home's reads: organiser_home_v1 (through the shared choice, so Switch and
 * Home agree on the page shown), the page's incoming join requests and the
 * login's own requests (onboarding), all through selfServeApi. Series pass
 * isListedSeries first (R3-4); the rows are homeJobs() and nothing else.
 * `today` is organiser_home_v1's London day, else this device's London day.
 */
export function useHomeData() {
  const { user, home, organisers, selected } = useOrganiserChoice();
  const incoming = useQuery({
    queryKey: incomingAccessRequestsQueryKey(selected?.id),
    queryFn: () => fetchIncomingAccessRequests(selected!.id),
    enabled: readsRequests(selected),
    staleTime: 60_000,
  });
  const mine = useQuery({ queryKey: myAccessRequestsQueryKey(user?.id), queryFn: fetchMyAccessRequests, enabled: !!user });
  // The server's London day when organiser_home_v1 sends one (parseHome gives ''
  // when absent), so a phone with a wrong clock agrees with the server (N4).
  const today = home.data?.today || londonTodayKey();
  const page = selected ? { ...selected, series: (selected.series ?? []).filter(isListedSeries) } : null;
  // A join-request row is a nudge: it waits for its read and never blocks the list.
  const jobs = page ? homeJobs(page, incoming.data ?? [], today) : [];
  return { user, home, organisers, selected, jobs, mine, today };
}
