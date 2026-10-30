import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Share2 } from 'lucide-react';
import { ORGANISER_HOME_KEY } from '@/modules/organiser/shared/selfServeApi';
import { TEAM_COPY, selfServeErrorCode, teamErrorMessage } from '@/modules/organiser/shared/selfServeErrors';
import { addTeamMemberByProfile, organiserTeamQueryKey, searchTeamPeople } from '@/modules/organiser/shared/teamRpcApi';
import { ADD_ROLE_REASON, TEAM_FULL_REASON, shortName, teamIsFull } from '@/modules/organiser/shared/teamModel';
import { MIN_QUERY, SEARCH_LIMIT, inviteShare, parsePeople, searchTerm } from '@/modules/organiser/edit-in-place/teamPickerModel';
import { goDone } from '../flows/doneState';
import { useOrgSurface } from '../shell/surface';
import { AnnounceRegion, ErrorState, GhostButton, SearchField, SkeletonRows, useAnnounce, useDebounced } from '../ui';
import { Avatar } from './Avatar';
import { BROWSE_PAGE, SHORT_WALL, browseQueryKey, factLabel, fetchBrowsePeople, inviteMessage, shortWallLine, type Face } from './browseApi';
import { addErrorMessage } from './teamErrors';
import { useTeamContext } from './useTeamContext';

/**
 * /account/o/team/add (C25b, D43, D56): a search field (existing RPC, 2-letter minimum, 8 results) over a
 * 3-column wall of faces. A face the server says can be added is ONE tap = ONE add call (Done "Priya S. is a
 * Manager"); any other reads "Invite": tap shares the invite link with their first name in the message
 * (no share sheet -> copy), and writes nothing. Faces are 44px+ targets and never blank circles.
 */
export default function AddSomeone() {
  const ctx = useTeamContext();
  const { Shell, paths, doneBack } = useOrgSurface();
  const { organiser, members, viewerRole } = ctx;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // ?q= prefills the search: Person's "Add them back" lands here on that person (A-N7).
  const [params] = useSearchParams();
  const [query, setQuery] = useState(() => params.get('q') ?? '');
  const [limit, setLimit] = useState(BROWSE_PAGE);
  const [error, setError] = useState<string | null>(null);
  // The server said team_full (a race): Add stays disabled, the message stays on screen.
  const [serverFull, setServerFull] = useState(false);
  const [message, announce] = useAnnounce();
  const term = searchTerm(useDebounced(query));
  const full = teamIsFull(members.length, serverFull);
  const allowed = viewerRole === 'owner' || viewerRole === 'manager';
  // Faces and results carry profile ids; a member's profile id is their user id unless organiser_team_v1
  // says otherwise, so exclude by both (REVIEW-S6 S3). The server should exclude members too.
  const memberIds = new Set(members.flatMap((m) => (m.profileId ? [m.userId, m.profileId] : [m.userId])));

  const browse = useQuery({
    queryKey: browseQueryKey(organiser?.id, limit),
    queryFn: () => fetchBrowsePeople(organiser!.id, limit),
    enabled: !!organiser && allowed,
    placeholderData: (prev) => prev,
  });
  const search = useQuery({
    queryKey: ['organiser-team-search', organiser?.id, term],
    queryFn: async () => parsePeople(await searchTeamPeople(organiser!.id, term!, SEARCH_LIMIT)),
    enabled: !!organiser && allowed && !!term,
  });

  const add = useMutation({
    mutationFn: (p: { profileId: string; name: string }) => addTeamMemberByProfile(organiser!.id, p.profileId, 'manager', null),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: organiserTeamQueryKey(organiser!.id) });
      void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
    },
    onError: (err) => {
      if (selfServeErrorCode(err) === 'team_full') setServerFull(true);
      setError(addErrorMessage(err, 'wall'));
    },
  });

  const share = async (payload: { title: string; text: string; url?: string }) => {
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (typeof nav.share === 'function') {
      try { await nav.share(payload); } catch { /* cancelled: nothing was written either way */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(payload.text);
      announce('Link copied');
    } catch {
      announce(`Copy this link and send it to them: ${payload.url ?? payload.text}`);
    }
  };
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const invite = (name: string | null) => {
    const base = inviteShare(organiser?.name ?? 'my page', origin);
    return name ? { title: base.title, text: inviteMessage(name, organiser?.name ?? 'my page', base.url), url: base.url } : { title: base.title, text: `${base.text} ${base.url}`, url: base.url };
  };

  const faces: Face[] = (browse.data ?? []).filter((f) => !memberIds.has(f.profileId));
  // "No one found" tests the list the person SEES: hits already on the team are not shown (B-S5).
  const results = (search.data ?? []).filter((p) => !memberIds.has(p.profileId));
  const tap = (f: { profileId: string; name: string; canAdd?: boolean }) => {
    if (full || add.isPending) return;
    if (!serverFull) setError(null);
    if (f.canAdd === false) void share(invite(f.name));
    // Done rides mutate()'s own callback: TanStack drops it once this screen unmounts (a late answer stays put).
    else add.mutate({ profileId: f.profileId, name: f.name }, { onSuccess: (_r, p) => goDone(navigate, { title: 'Added', message: `${shortName(p.name)} is a Manager`, seriesId: null }, doneBack, paths.done) });
  };
  const more = (browse.data?.length ?? 0) >= limit;
  // The lookup cap (permission_denied: lookup_cap) says what to do instead of "did not load" (W4a fix 3, F8).
  const capped = (e: unknown) => teamErrorMessage(e) === TEAM_COPY.lookup_cap;

  return (
    <Shell title="Add someone" back={{ to: paths.team, label: 'Team' }} testId="org-page-team-add">
      <div className="flex flex-col gap-3 p-3">
        <AnnounceRegion message={message} />
        {ctx.loading ? (
          <SkeletonRows count={3} label="Loading" testId="add-loading" />
        ) : ctx.failed ? (
          <ErrorState title="This did not load" onRetry={ctx.retry} testId="add-load-error" />
        ) : !organiser ? (
          <p className="text-[14px] text-[var(--mut)]" data-testid="add-no-page">Choose a page on Team first. <Link to={paths.team} className="underline">Go to Team</Link></p>
        ) : !allowed ? (
          <p className="text-[14px] text-[var(--mut)]" data-testid="add-read-only">{ADD_ROLE_REASON} <Link to={paths.team} className="inline-flex min-h-[44px] items-center underline">Back to the team</Link></p>
        ) : (
          <>
            <SearchField value={query} onChange={setQuery} aria-label="Search dancers by name" placeholder="Search by name" testId="add-search" />
            {full && !(serverFull && error) && <p className="text-[14px] text-[var(--mut)]" data-testid="add-full">{TEAM_FULL_REASON}</p>}
            {error && <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="add-error">{error}</p>}

            {term ? (
              <ul className="flex flex-col" data-testid="add-results" aria-busy={search.isFetching}>
                {search.isError && (
                  <li role="alert" className="flex items-center gap-3 text-[14px] text-[var(--mut)]" data-testid="add-search-error">
                    <span className="min-w-0 flex-1">{capped(search.error) ? TEAM_COPY.lookup_cap : 'We could not search just now.'}</span>
                    <button type="button" onClick={() => void search.refetch()} className="min-h-[44px] min-w-[44px] shrink-0 rounded-[12px] bg-[var(--card2)] px-[12px] text-[15px] font-semibold text-[var(--fg)]" data-testid="add-search-retry">Retry</button>
                  </li>
                )}
                {results.map((p) => (
                  <li key={p.profileId}>
                    <button type="button" disabled={full || add.isPending} onClick={() => tap({ profileId: p.profileId, name: p.name })} data-testid="add-result" className="flex min-h-[56px] w-full items-center gap-3 px-1 py-2 text-left disabled:opacity-60">
                      <Avatar name={p.name} photoUrl={p.photoUrl} size={40} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] text-[var(--fg)]">{p.name}</span>
                        {p.city && <span className="block truncate text-[13px] text-[var(--mut)]">{p.city}</span>}
                      </span>
                    </button>
                  </li>
                ))}
                {search.data && results.length === 0 && <li className="text-[14px] text-[var(--mut)]" data-testid="add-no-results">No one found. Share an invite link below.</li>}
              </ul>
            ) : (
              <>
                {query.trim() !== '' && <p className="text-[13px] text-[var(--mut)]">Type at least {MIN_QUERY} letters.</p>}
                {browse.isPending ? (
                  <SkeletonRows count={3} label="Loading dancers" testId="add-wall-loading" />
                ) : browse.isError ? (
                  <ErrorState title={capped(browse.error) ? TEAM_COPY.lookup_cap : 'The dancers did not load'} onRetry={() => void browse.refetch()} quiet testId="add-wall-error" />
                ) : (
                  <>
                    {faces.length > 0 && (
                      <ul className="grid grid-cols-3 gap-2" data-testid="add-wall">
                        {faces.map((f) => (
                          <li key={f.profileId}>
                            <button
                              type="button"
                              onClick={() => tap(f)}
                              disabled={full || add.isPending}
                              data-testid="add-face"
                              data-can-add={f.canAdd ? 'true' : 'false'}
                              aria-label={f.canAdd ? `Add ${f.name} as Manager` : `Invite ${f.name}`}
                              className="flex min-h-[44px] w-full flex-col items-center gap-1 rounded-[12px] bg-[var(--card)] px-1 py-2 text-center disabled:opacity-60"
                            >
                              <Avatar name={f.name} photoUrl={f.photoUrl} size={56} />
                              <span className="block w-full truncate text-[14px] text-[var(--fg)]">{shortName(f.name)}</span>
                              <span className="block w-full truncate text-[12px] text-[var(--mut)]">{f.canAdd ? factLabel(f.fact) ?? 'Add' : 'Invite'}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {more && (
                      <GhostButton testId="add-show-more" loading={browse.isFetching} loadingLabel="Loading" onClick={() => setLimit((n) => n + BROWSE_PAGE)}>Show more</GhostButton>
                    )}
                    {faces.length < SHORT_WALL && !more && <p className="text-[14px] text-[var(--mut)]" data-testid="add-short">{shortWallLine(faces.length, faces.every((f) => !!f.photoUrl))}</p>}
                  </>
                )}
              </>
            )}
            <GhostButton testId="add-invite" onClick={() => void share(invite(null))}>
              <Share2 aria-hidden="true" className="h-[18px] w-[18px]" /> Share an invite link
            </GhostButton>
          </>
        )}
      </div>
    </Shell>
  );
}
