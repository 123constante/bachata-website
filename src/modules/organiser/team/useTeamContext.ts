import { useQuery } from '@tanstack/react-query';
import { teamOf, type HomeOrganiser } from '@/modules/organiser/shared/selfServeApi';
import { fetchOrganiserTeam, organiserTeamQueryKey } from '@/modules/organiser/shared/teamRpcApi';
import type { TeamMember, TeamRole } from '@/modules/organiser/shared/teamModel';
import { useOrganiserChoice } from '../switch/useOrganiserChoice';

export interface TeamContext {
  organiser: HomeOrganiser | null;
  members: TeamMember[];
  viewerRole: TeamRole;
  /** The page itself is still loading (home or the team read). */
  loading: boolean;
  failed: boolean;
  retry: () => void;
}

/**
 * The organiser this screen is about, its members (organiser_team_v1, falling back to the
 * Home read's team while it loads) and the viewer's role. Every Team and Hand-over screen
 * reads the team through here, so they agree on who is on it.
 */
export function useTeamContext(): TeamContext & { choose: (id: string) => void; organisers: HomeOrganiser[] } {
  const { home, organisers, selected, choose } = useOrganiserChoice();
  const read = useQuery({
    queryKey: organiserTeamQueryKey(selected?.id),
    queryFn: () => fetchOrganiserTeam(selected!.id),
    enabled: !!selected,
  });
  const homeTeam = teamOf(selected);
  const usable = !!read.data && read.data.myRole !== null;
  // organiser_team_v1 may lack names (A1 not live): keep the ones the Home read has.
  const members = usable
    ? read.data!.members.map((m) => {
        const h = homeTeam.find((x) => x.userId === m.userId);
        return { ...m, displayName: m.displayName ?? h?.displayName ?? null, photoUrl: m.photoUrl ?? h?.photoUrl ?? null };
      })
    : homeTeam;
  const readRole = usable ? read.data!.myRole : null;
  const viewerRole: TeamRole =
    readRole === 'owner' || readRole === 'contributor' ? readRole
    : readRole === 'manager' || readRole === 'admin' ? 'manager'
    : selected?.role === 'owner' ? 'owner' : 'manager';
  return {
    organiser: selected,
    organisers,
    choose,
    members,
    viewerRole,
    loading: home.isPending || (!!selected && read.isPending && homeTeam.length === 0),
    failed: home.isError && !home.data,
    retry: () => { void home.refetch(); void read.refetch(); },
  };
}
