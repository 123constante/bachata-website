import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchIncomingAccessRequests, incomingAccessRequestsQueryKey, removeOrganiserMember } from '@/modules/organiser/shared/selfServeApi';
import { organiserTeamQueryKey, setTeamMember } from '@/modules/organiser/shared/teamRpcApi';
import { TEAM_CAP, TEAM_FULL_REASON, type TeamRole } from '@/modules/organiser/shared/teamModel';
import { canDecline, isInterim } from '@/modules/organiser/shared/teamRules';
import { useSeatKind } from '@/modules/organiser/shared/useSeatKind';
import { callerSeatOf } from '@/modules/organiser/edit-in-place/teamVisibilityModel';
import { inviteShare } from '@/modules/organiser/edit-in-place/teamPickerModel';
import { hideErrorMessage, organiserPublicTeamKey, setTeamMemberHidden } from '../../../team/publicTeamApi';
import { teamErrorMessage } from '@/modules/organiser/shared/selfServeErrors';
import { useTeamContext } from '../../../team/useTeamContext';
import { PublicToggle } from '../../../team/PublicToggle';
import { PageNameCaption, RequestsError, requestsErrorShown } from '../../../team/p3TeamBits';
import { JoinRequestCard } from '../../../flows/fix/JoinRequest';
import { useOrgSurface } from '../../../shell/surface';
import { Card } from '../../../ui';
import { buildPersonSheet, buildTeamDash, type PersonView } from './teamDashModel';
import { TeamDashView } from './TeamDashView';

const FIRST = (n: string) => n.split(' ')[0];

/** The Team tab for the organiser dashboard flag (admin #1535, Option B). Same reads and RPCs as the old Team tab. */
export function TeamDashRoute() {
  const ctx = useTeamContext();
  const { organiser, members, listed, viewerRole } = ctx;
  const { paths } = useOrgSurface();
  const qc = useQueryClient();
  const seat = useSeatKind(organiser?.id);
  const [open, setOpen] = useState<ReadonlySet<TeamRole>>(new Set());
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [linkNotice, setLinkNotice] = useState<string | null>(null);
  const requests = useQuery({
    queryKey: incomingAccessRequestsQueryKey(organiser?.id),
    queryFn: () => fetchIncomingAccessRequests(organiser!.id),
    enabled: !!organiser && (viewerRole === 'owner' || viewerRole === 'manager'),
  });
  const load = ctx.failed ? 'error' : ctx.loading ? 'loading' : !organiser ? 'nopage' : 'ready';
  const model = useMemo(
    () => buildTeamDash({ load, viewerRole, members, listed, interim: isInterim(seat), openGroups: open }),
    [load, viewerRole, members, listed, seat, open],
  );
  const me = members.find((m) => m.isSelf);
  const caller = { seat: callerSeatOf(viewerRole), personId: me?.personId ?? null };
  const full = members.length >= TEAM_CAP;
  const refresh = async () => {
    if (!organiser) return;
    await Promise.all([qc.invalidateQueries({ queryKey: organiserTeamQueryKey(organiser.id) }), qc.invalidateQueries({ queryKey: organiserPublicTeamKey(organiser.id) })]);
  };
  const guard = async (f: () => Promise<string>, errOf: (e: unknown) => string) => {
    setNotice(null);
    try { setNotice({ tone: 'ok', text: await f() }); await refresh(); } catch (e) { setNotice({ tone: 'error', text: errOf(e) }); }
  };
  const actions = {
    onRetry: ctx.retry,
    onOpenMore: (r: TeamRole) => setOpen((s) => new Set(s).add(r)),
    onChangeRole: (p: PersonView, role: TeamRole) => guard(async () => {
      if (!organiser || !p.email || role === 'owner') throw new Error('no_email');
      await setTeamMember(organiser.id, p.email, role);
      return `${p.name} is now a ${role}.`;
    }, teamErrorMessage),
    onSetHidden: (p: PersonView, hide: boolean) => guard(async () => {
      if (!organiser || !p.personId) throw new Error('no_person');
      await setTeamMemberHidden(organiser.id, p.personId, hide);
      return hide ? `${p.name} is hidden from your public page.` : `${p.name} shows on your public page.`;
    }, hideErrorMessage),
    onRemove: (p: PersonView) => guard(async () => {
      if (!organiser || !p.userId) throw new Error('no_user');
      await removeOrganiserMember(organiser.id, p.userId);
      return p.isSelf ? 'You left the team.' : `${p.name} was removed. Their dancer profile stays.`;
    }, teamErrorMessage),
    onShareLink: async () => {
      if (!organiser) return;
      const share = inviteShare(organiser.name, window.location.origin);
      const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
      try {
        if (typeof nav.share === 'function') { await nav.share(share); setLinkNotice(null); return; }
        await navigator.clipboard.writeText(share.url);
        setLinkNotice('Link copied. Send it to them; once they have a profile, Find will list them.');
      } catch {
        setLinkNotice(`Copy this link and send it to them: ${share.url}`);
      }
    },
  };
  const declineGate = canDecline(viewerRole, members, full);
  const editor = viewerRole === 'owner' || viewerRole === 'manager';
  const requestsCard = organiser && (requests.data ?? []).length > 0 && editor ? (
    <Card label="Wants to join" testId="requests-card">
      {(requests.data ?? []).map((r) => (
        <JoinRequestCard key={r.requestId} organiserId={organiser.id} request={r} blockedReason={full ? TEAM_FULL_REASON : null} declineGate={declineGate} onAnswered={(m) => setNotice({ tone: 'ok', text: m })} />
      ))}
    </Card>
  ) : null;
  // A failed requests read says so (a contributor's not_authorised stays silent).
  const above = (
    <>
      {organiser && editor && requestsErrorShown(requests) && <RequestsError onRetry={() => void requests.refetch()} />}
      {requestsCard}
    </>
  );
  const below = organiser && me ? (
    <Card label="Public team" testId="team-public-card">
      <PublicToggle organiserId={organiser.id} profileId={me.profileId ?? null} onChanged={(text) => setNotice({ tone: 'ok', text })} />
    </Card>
  ) : null;
  return (
    <>
      <PageNameCaption name={organiser?.name} show={ctx.organisers.length >= 2} />
      <TeamDashView
        model={model} people={model.people} sheetFor={(p) => buildPersonSheet(p, viewerRole, members, caller)}
        actions={actions} addTo={paths.teamAdd} moreTo={paths.more} helpTo={paths.help} above={above} below={below} notice={notice} linkNotice={linkNotice}
      />
    </>
  );
}
