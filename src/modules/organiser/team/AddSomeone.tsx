import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Share2 } from 'lucide-react';
import { ORGANISER_HOME_KEY } from '@/modules/organiser/shared/selfServeApi';
import { teamErrorMessage } from '@/modules/organiser/shared/selfServeErrors';
import { addTeamMemberByProfile, organiserTeamQueryKey, searchTeamPeople } from '@/modules/organiser/shared/teamRpcApi';
import { TEAM_CAP, TEAM_FULL_REASON, shortName } from '@/modules/organiser/shared/teamModel';
import { MIN_QUERY, SEARCH_LIMIT, inviteShare, parsePeople, searchTerm } from '@/modules/organiser/edit-in-place/teamPickerModel';
import { goDone } from '../flows/doneState';
import { OrganiserShell, ORG_PATHS } from '../shell';
import { AnnounceRegion, ErrorState, GhostButton, SearchField, SkeletonRows, useAnnounce, useDebounced } from '../ui';
import { Avatar } from './Avatar';
import { BROWSE_PAGE, SHORT_WALL, browseQueryKey, factLabel, fetchBrowsePeople, inviteMessage, shortWallLine, type Face } from './browseApi';
import { useTeamContext } from './useTeamContext';

/**
 * /account/o/team/add (C25b, D43, D56): a search field (existing RPC, 2-letter minimum, 8 results) over a
 * 3-column wall of faces. A face the server says can be added is ONE tap = ONE add call (Done "Priya S. is a
 * Manager"); any other reads "Invite": tap shares the invite link with their first name in the message
 * (no share sheet -> copy), and writes nothing. Faces are 44px+ targets and never blank circles.
 */
export default function AddSomeone() {
  const ctx = useTeamContext();
  const { organiser, members, viewerRole } = ctx;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(BROWSE_PAGE);
  const [error, setError] = useState<string | null>(null);
  const [message, announce] = useAnnounce();
  const term = searchTerm(useDebounced(query));
  const full = members.length >= TEAM_CAP;
  const allowed = viewerRole === 'owner' || viewerRole === 'manager';
  const memberIds = new Set(members.map((m) => m.userId));

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
    onSuccess: (_r, p) => {
      void queryClient.invalidateQueries({ queryKey: organiserTeamQueryKey(organiser!.id) });
      void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
      goDone(navigate, { title: 'Added', message: `${shortName(p.name)} is a Manager`, seriesId: null });
    },
    onError: (err) => setError(teamErrorMessage(err)),
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
  const tap = (f: { profileId: string; name: string; canAdd?: boolean }) => {
    if (full || add.isPending) return;
    setError(null);
    if (f.canAdd === false) void share(invite(f.name));
    else add.mutate({ profileId: f.profileId, name: f.name });
  };
  const more = (browse.data?.length ?? 0) >= limit;

  return (
    <OrganiserShell title="Add someone" back={{ to: ORG_PATHS.team, label: 'Team' }} testId="org-page-team-add">
      <div className="flex flex-col gap-3 p-3">
        <AnnounceRegion message={message} />
        {ctx.loading ? (
          <SkeletonRows count={3} label="Loading" testId="add-loading" />
        ) : ctx.failed ? (
          <ErrorState title="This did not load" onRetry={ctx.retry} testId="add-load-error" />
        ) : !organiser ? (
          <p className="text-[14px] text-[var(--mut)]">Choose a page first.</p>
        ) : !allowed ? (
          <p className="text-[14px] text-[var(--mut)]" data-testid="add-read-only">Only an owner or a manager adds people.</p>
        ) : (
          <>
            <SearchField value={query} onChange={setQuery} aria-label="Search dancers by name" placeholder="Search by name" testId="add-search" />
            {full && <p className="text-[14px] text-[var(--mut)]" data-testid="add-full">{TEAM_FULL_REASON}</p>}
            {error && <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="add-error">{error}</p>}

            {term ? (
              <ul className="flex flex-col" data-testid="add-results" aria-busy={search.isFetching}>
                {search.isError && <li className="text-[14px] text-[var(--mut)]">We could not search just now. Try again.</li>}
                {(search.data ?? []).filter((p) => !memberIds.has(p.profileId)).map((p) => (
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
                {search.data && search.data.length === 0 && <li className="text-[14px] text-[var(--mut)]" data-testid="add-no-results">No one found. Share an invite link below.</li>}
              </ul>
            ) : (
              <>
                {query.trim() !== '' && <p className="text-[13px] text-[var(--mut)]">Type at least {MIN_QUERY} letters.</p>}
                {browse.isPending ? (
                  <SkeletonRows count={3} label="Loading dancers" testId="add-wall-loading" />
                ) : browse.isError ? (
                  <ErrorState title="The dancers did not load" onRetry={() => void browse.refetch()} quiet testId="add-wall-error" />
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
                    {faces.length < SHORT_WALL && !more && <p className="text-[14px] text-[var(--mut)]" data-testid="add-short">{shortWallLine(faces.length)}</p>}
                  </>
                )}
              </>
            )}
            <GhostButton testId="add-invite" disabled={full} onClick={() => void share(invite(null))}>
              <Share2 aria-hidden="true" className="h-[18px] w-[18px]" /> Share an invite link
            </GhostButton>
          </>
        )}
      </div>
    </OrganiserShell>
  );
}
