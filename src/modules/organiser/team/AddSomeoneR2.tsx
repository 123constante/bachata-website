import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ORGANISER_HOME_KEY } from '@/modules/organiser/shared/selfServeApi';
import { TEAM_COPY, selfServeErrorCode, teamErrorMessage } from '@/modules/organiser/shared/selfServeErrors';
import { addTeamMemberByProfile, organiserTeamQueryKey, searchTeamPeople } from '@/modules/organiser/shared/teamRpcApi';
import { ADD_ROLE_REASON, TEAM_FULL_REASON, shortName, teamIsFull } from '@/modules/organiser/shared/teamModel';
import { SEARCH_LIMIT, parsePeople, searchTerm } from '@/modules/organiser/edit-in-place/teamPickerModel';
import { inviteLink } from '../p3/r4/r4TeamR2Api';
import { P3_PATHS } from '../p3/shell/paths';
import { goDone } from '../flows/doneState';
import { useOrgSurface } from '../shell/surface';
import { AnnounceRegion, ErrorState, PrimaryButton, SearchField, SkeletonRows, useAnnounce, useDebounced } from '../ui';
import { Avatar } from './Avatar';
import { AddConfirm } from './AddConfirm';
import { addErrorMessage } from './teamErrors';
import { useTeamContext } from './useTeamContext';
import { PageNameCaption } from './p3TeamBits';

export const ADD_R2_COPY = {
  manager: 'Can edit your events and team.',
  door: 'Scans tickets on one night. Access ends at noon the next day.',
  tooMany: 'You have 10 links waiting. Use one you already sent, or wait for them to expire.',
  linkFail: 'Could not make a link. Try again.',
} as const;

/** The invite-link failure as one plain line; null = the server refused this person (non-owner). */
export function linkErrorLine(err: unknown): string | null {
  const msg = String((err as { message?: unknown } | null)?.message ?? err ?? '').toLowerCase();
  if (msg.includes('too_many_open_links')) return ADD_R2_COPY.tooMany;
  if (/not_owner|not_authori|forbidden|permission|owner_only/.test(msg)) return null;
  return ADD_R2_COPY.linkFail;
}

const chipCls = (on: boolean) => `min-h-[44px] flex-1 rounded-[12px] px-3 text-[16px] font-bold ${on ? 'bg-[var(--fg)] text-[var(--bg)]' : 'bg-[var(--card2)] text-[var(--fg)]'}`;
const bigBtn = 'flex h-[52px] w-full items-center justify-center rounded-[12px] bg-[var(--fg)] text-[16px] font-bold text-[var(--bg)]';

/** Flag organiserTeamR2: one Add screen. Role chips (Manager | Door); Manager = WhatsApp link + search. */
export default function AddSomeoneR2() {
  const ctx = useTeamContext();
  const { Shell, paths, doneBack, kind } = useOrgSurface();
  const { organiser, members, viewerRole } = ctx;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [role, setRole] = useState<'manager' | 'door'>('manager');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [refused, setRefused] = useState(false);
  const [confirming, setConfirming] = useState<{ profileId: string; name: string } | null>(null);
  const [serverFull, setServerFull] = useState(false);
  const [message, announce] = useAnnounce();
  const url = useRef<string | null>(null); // ONE minted token per screen visit
  const term = searchTerm(useDebounced(query));
  const namePage = kind === 'p3' && ctx.organisers.length >= 2;
  const pageName = organiser?.name ?? '';
  const full = teamIsFull(members.length, serverFull);
  const allowed = viewerRole === 'owner' || viewerRole === 'manager';
  const memberIds = new Set(members.flatMap((m) => (m.profileId ? [m.userId, m.profileId] : [m.userId])));

  const search = useQuery({
    queryKey: ['organiser-team-search', organiser?.id, term],
    queryFn: async () => parsePeople(await searchTeamPeople(organiser!.id, term!, SEARCH_LIMIT)),
    enabled: !!organiser && allowed && role === 'manager' && !!term,
  });
  const add = useMutation({
    mutationFn: (p: { profileId: string; name: string }) => addTeamMemberByProfile(organiser!.id, p.profileId, 'manager', null),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: organiserTeamQueryKey(organiser!.id) });
      void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
    },
    onError: (err) => {
      if (selfServeErrorCode(err) === 'team_full') setServerFull(true);
      setConfirming(null);
      setError(addErrorMessage(err, 'wall'));
    },
  });
  const mint = useMutation({
    mutationFn: async () => {
      if (url.current) return url.current;
      const { token } = await inviteLink(organiser!.id, 'manager');
      url.current = `${window.location.origin}/invite/${token}`;
      return url.current;
    },
    onError: (e) => { const line = linkErrorLine(e); if (line === null) setRefused(true); else setLinkError(line); },
  });
  const whatsapp = () => {
    setLinkError(null);
    mint.mutate(undefined, {
      onSuccess: (u) => window.open(`https://wa.me/?text=${encodeURIComponent(`Join me on ${pageName} on Bachata Calendar: ${u}`)}`, '_blank', 'noopener'),
    });
  };
  const copy = () => {
    setLinkError(null);
    mint.mutate(undefined, {
      onSuccess: async (u) => {
        try { await navigator.clipboard.writeText(u); announce('Link copied'); setTimeout(() => announce(''), 3000); } catch { announce(`Copy this link: ${u}`); }
      },
    });
  };

  const results = (search.data ?? []).filter((p) => !memberIds.has(p.profileId));
  const confirmAdd = () => {
    if (!confirming || full || add.isPending) return;
    add.mutate(confirming, { onSuccess: (_r, p) => goDone(navigate, { title: 'Added', message: `${shortName(p.name)} is a Manager${namePage ? ` of ${pageName}` : ''}`, seriesId: null }, doneBack, paths.done) });
  };
  const capped = (e: unknown) => teamErrorMessage(e) === TEAM_COPY.lookup_cap;
  const readOnly = (testId: string) => (
    <p className="text-[14px] text-[var(--mut)]" data-testid={testId}>{ADD_ROLE_REASON} <Link to={paths.team} className="inline-flex min-h-[44px] items-center underline">Back to the team</Link></p>
  );

  return (
    <Shell title="Add someone" back={{ to: paths.team, label: 'Team' }} testId="org-page-team-add">
      <div className="flex flex-col gap-3 p-3">
        <PageNameCaption name={organiser?.name} show={namePage} />
        <AnnounceRegion message={message} />
        {ctx.loading ? (
          <SkeletonRows count={3} label="Loading" testId="add-loading" />
        ) : ctx.failed ? (
          <ErrorState title="This did not load" onRetry={ctx.retry} testId="add-load-error" />
        ) : !organiser ? (
          <p className="text-[14px] text-[var(--mut)]" data-testid="add-no-page">Choose a page on Team first. <Link to={paths.team} className="underline">Go to Team</Link></p>
        ) : !allowed ? readOnly('add-read-only') : (
          <>
            <div className="flex gap-2" role="radiogroup" aria-label="Role">
              {(['manager', 'door'] as const).map((r) => (
                <button key={r} type="button" role="radio" aria-checked={role === r} onClick={() => setRole(r)} className={chipCls(role === r)} data-testid={`role-chip-${r}`}>{r === 'manager' ? 'Manager' : 'Door'}</button>
              ))}
            </div>
            <p className="text-[14px] text-[var(--mut)]" data-testid="add-role-help">{role === 'manager' ? ADD_R2_COPY.manager : ADD_R2_COPY.door}</p>
            {role === 'door' ? (
              <Link to={P3_PATHS.youTeamDoorInvite} className={bigBtn} data-testid="add-choose-night">Choose the night</Link>
            ) : refused ? readOnly('add-refused') : (
              <>
                <PrimaryButton loading={mint.isPending} loadingLabel="Making link" onClick={whatsapp} testId="add-whatsapp">Invite by WhatsApp link</PrimaryButton>
                <button type="button" onClick={copy} className="min-h-[44px] text-[15px] font-semibold text-[var(--mut)] underline" data-testid="add-copy-link">Copy link instead</button>
                {linkError && <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="add-link-error">{linkError}</p>}
                <SearchField value={query} onChange={setQuery} aria-label="Search dancers by name" placeholder="Search by name" testId="add-search" />
                {full && !(serverFull && error) && <p className="text-[14px] text-[var(--mut)]" data-testid="add-full">{TEAM_FULL_REASON}</p>}
                {error && <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="add-error">{error}</p>}
                {term && (
                  <ul className="flex flex-col" data-testid="add-results" aria-busy={search.isFetching}>
                    {search.isError && (
                      <li role="alert" className="flex items-center gap-3 text-[14px] text-[var(--mut)]" data-testid="add-search-error">
                        <span className="min-w-0 flex-1">{capped(search.error) ? TEAM_COPY.lookup_cap : 'We could not search just now.'}</span>
                        <button type="button" onClick={() => void search.refetch()} className="min-h-[44px] min-w-[44px] shrink-0 rounded-[12px] bg-[var(--card2)] px-[12px] text-[15px] font-semibold text-[var(--fg)]" data-testid="add-search-retry">Retry</button>
                      </li>
                    )}
                    {results.map((p) => (
                      <li key={p.profileId}>
                        <button type="button" disabled={full || add.isPending} onClick={() => { if (!serverFull) setError(null); setConfirming({ profileId: p.profileId, name: p.name }); }} data-testid="add-result" className="flex min-h-[56px] w-full items-center gap-3 px-1 py-2 text-left disabled:opacity-60">
                          <Avatar name={p.name} photoUrl={p.photoUrl} size={40} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] text-[var(--fg)]">{p.name}</span>
                            {p.city && <span className="block truncate text-[13px] text-[var(--mut)]">{p.city}</span>}
                          </span>
                        </button>
                      </li>
                    ))}
                    {search.data && results.length === 0 && <li className="text-[14px] text-[var(--mut)]" data-testid="add-no-results">No one found. Use the invite link above.</li>}
                  </ul>
                )}
                <AddConfirm person={confirming} pageName={organiser.name} pending={add.isPending} full={full} onAdd={confirmAdd} onCancel={() => setConfirming(null)} />
              </>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}
