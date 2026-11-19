import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ORGANISER_HOME_KEY, fetchIncomingAccessRequests, incomingAccessRequestsQueryKey } from '@/modules/organiser/shared/selfServeApi';
import { addTeamMemberByProfile, organiserTeamQueryKey, searchTeamPeople } from '@/modules/organiser/shared/teamRpcApi';
import { ROLE_LABEL, TEAM_CAP, TEAM_FULL_REASON, teamIsFull } from '@/modules/organiser/shared/teamModel';
import { MESSAGE_US, NO_PAGE, canDecline, isInterim } from '@/modules/organiser/shared/teamRules';
import { useSeatState } from '@/modules/organiser/shared/useSeatKind';
import { selfServeErrorCode } from '@/modules/organiser/shared/selfServeErrors';
import { SEARCH_LIMIT, inviteShare, parsePeople, searchTerm } from '@/modules/organiser/edit-in-place/teamPickerModel';
import { useTeamContext } from '../../team/useTeamContext';
import { addErrorMessage } from '../../team/teamErrors';
import { JoinRequestCard } from '../../flows/fix/JoinRequest';
import { useDebounced } from '../../ui';
import { Sheet } from '../screens/Sheet';
import { P3_PATHS } from '../shell/paths';
import { R4Chevron } from './R4Shell';
import { ROLE_LINE } from '../dash/team/teamDashModel';
import { R4_ADD_COPY, R4_ADD_ROLES, buildR4Team, r4AddButton, type R4AddRole, type R4TeamGroup, type R4Waiting } from './r4TeamModel';
import { R4_INVITED_COPY, buildR4Invited, type R4InvitedModel } from './r4InvitedModel';
import { fetchInvitesSent, invitesSentQueryKey } from './r4InvitedApi';

const Plus = () => (
  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
);

/** Share the sign-up link (share sheet, else copy). Writes nothing. */
async function shareSignUp(pageName: string, said: (m: string) => void) {
  const s = inviteShare(pageName, window.location.origin);
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
  if (typeof nav.share === 'function') {
    // closing the share sheet throws AbortError: nothing went wrong and nothing was written
    try { await nav.share(s); } catch { /* cancelled */ }
    return;
  }
  try {
    await navigator.clipboard.writeText(s.url);
    said(R4_ADD_COPY.inviteCopied);
  } catch {
    said(`Copy this link and send it to them: ${s.url}`);
  }
}

function Group({ g }: { g: R4TeamGroup }) {
  const id = `r4-team-${g.role}`;
  return (
    <section className="r4-section" aria-labelledby={id} data-testid={`r4-team-group-${g.role}`}>
      <div className="r4-title-block">
        <h2 id={id} className="r4-label r4-h2">{g.title}</h2>
        <p className="r4-sub" data-testid={`r4-team-line-${g.role}`}>{g.line}</p>
      </div>
      <div className="r4-card r4-list">
        {g.rows.map((r) => {
          const body = (
            <>
              <span className="r4-row-t">{r.name}</span>
              {r.end && <span className="r4-row-end" data-testid="r4-team-you">{r.end}</span>}
              {r.userId && <span className="r4-mut"><R4Chevron /></span>}
            </>
          );
          return r.userId
            ? <Link key={r.key} to={P3_PATHS.youTeamPerson(r.userId)} className="r4-row" data-testid="r4-team-row" data-role={g.role}>{body}</Link>
            : <div key={r.key} className="r4-row" data-testid="r4-team-row" data-role={g.role}>{body}</div>;
        })}
      </div>
    </section>
  );
}

/** Board R4AddTeammate: search by name, pick one person, role chips, "Add to team"; or send the sign-up link. */
function AddTeammateSheet({ organiserId, pageName, memberCount, memberIds, onClose, onAdded }: {
  organiserId: string; pageName: string; memberCount: number; memberIds: ReadonlySet<string>; onClose: () => void; onAdded: (m: string) => void;
}) {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<{ profileId: string; name: string } | null>(null);
  const [role, setRole] = useState<R4AddRole>('manager');
  const [error, setError] = useState<string | null>(null);
  const [serverFull, setServerFull] = useState(false);
  const [linkSaid, setLinkSaid] = useState<string | null>(null);
  const term = searchTerm(useDebounced(query));
  const search = useQuery({
    queryKey: ['organiser-team-search', organiserId, term],
    queryFn: async () => parsePeople(await searchTeamPeople(organiserId, term!, SEARCH_LIMIT)),
    enabled: !!term,
  });
  const results = (search.data ?? []).filter((p) => !memberIds.has(p.profileId));
  const add = useMutation({
    mutationFn: (p: { profileId: string; name: string; role: R4AddRole }) => addTeamMemberByProfile(organiserId, p.profileId, p.role, null),
    onSuccess: (_r, p) => {
      void qc.invalidateQueries({ queryKey: organiserTeamQueryKey(organiserId) });
      void qc.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
      onAdded(R4_ADD_COPY.done(p.name, p.role));
    },
    onError: (err) => {
      if (selfServeErrorCode(err) === 'team_full') setServerFull(true);
      setError(addErrorMessage(err, 'wall'));
    },
  });
  const full = teamIsFull(memberCount, serverFull);
  const btn = r4AddButton({ picked: !!picked, full, pending: add.isPending });
  return (
    <Sheet title={R4_ADD_COPY.title} onClose={onClose} locked={add.isPending}>
      <div className="r4-stack r4-sheet" data-testid="r4-add">
        <div className="r4-field">
          <label htmlFor="r4-add-search" className="r4-sub">{R4_ADD_COPY.search}</label>
          <div className="r4-in-wrap">
            <svg aria-hidden="true" className="r4-in-lead" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#696969" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input id="r4-add-search" type="search" autoComplete="off" className="r4-in r4-in-search" value={query} disabled={add.isPending}
              onChange={(e) => { setQuery(e.target.value); setPicked(null); }} data-testid="r4-add-search" />
          </div>
          {!term && <p className="r4-hint" data-testid="r4-add-idle">{R4_ADD_COPY.idle}</p>}
          {term && search.isError && (
            <p className="r4-err" role="alert" data-testid="r4-add-search-error">{R4_ADD_COPY.searchFailed} <button type="button" className="r4-linkbtn" onClick={() => void search.refetch()}>Try again</button></p>
          )}
          {term && search.isPending && <p className="r4-hint">Searching&hellip;</p>}
          {term && search.data && results.length === 0 && <p className="r4-hint" data-testid="r4-add-none">{R4_ADD_COPY.none}</p>}
          {term && results.length > 0 && (
            <div className="r4-card r4-list" role="radiogroup" aria-label="People found" data-testid="r4-add-results">
              {results.map((p) => (
                <button key={p.profileId} type="button" role="radio" aria-checked={picked?.profileId === p.profileId} disabled={add.isPending}
                  className="r4-row r4-row-btn r4-pickrow" onClick={() => { setPicked({ profileId: p.profileId, name: p.name }); setError(null); }} data-testid="r4-add-result">
                  <span className="r4-row-body"><span className="r4-row-t">{p.name}</span>{p.city && <span className="r4-row-line">{p.city}</span>}</span>
                  {picked?.profileId === p.profileId && <span className="r4-pill r4-pill-live">Picked</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="r4-field" role="group" aria-labelledby="r4-add-role">
          <div id="r4-add-role" className="r4-sub">Role</div>
          <div className="r4-chips" data-testid="r4-add-roles">
            {R4_ADD_ROLES.map((r) => (
              <button key={r} type="button" className="r4-chip" aria-pressed={role === r} disabled={add.isPending} onClick={() => setRole(r)} data-testid={`r4-add-role-${r}`}>{ROLE_LABEL[r]}</button>
            ))}
          </div>
          <p className="r4-hint" data-testid="r4-add-role-line">{ROLE_LINE[role]}</p>
        </div>
        <div className="r4-field">
          {error && <p className="r4-err" role="alert" data-testid="r4-add-error">{error}</p>}
          <button type="button" className="r4-btn r4-btn-42" disabled={btn.disabled} aria-describedby={btn.reason ? 'r4-add-why' : undefined}
            onClick={() => picked && !full && add.mutate({ ...picked, role })} data-testid="r4-add-go">{add.isPending ? R4_ADD_COPY.adding : R4_ADD_COPY.add}</button>
          {btn.reason && <p id="r4-add-why" className="r4-hint r4-center" data-testid="r4-add-why">{btn.reason}</p>}
          <div className="r4-center">
            <button type="button" className="r4-linkbtn r4-link-quiet" disabled={add.isPending} onClick={() => void shareSignUp(pageName, setLinkSaid)} data-testid="r4-add-invite">{R4_ADD_COPY.invite}</button>
            <p className="r4-hint">{R4_ADD_COPY.inviteLine}</p>
            {linkSaid && <p className="r4-hint" role="status" data-testid="r4-add-link-said">{linkSaid}</p>}
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function WaitingSection({ rows, onOpen }: { rows: R4Waiting[]; onOpen: (w: R4Waiting) => void }) {
  if (rows.length === 0) return null;
  return (
    <section className="r4-section" aria-labelledby="r4-team-waiting" data-testid="r4-team-waiting">
      <h2 id="r4-team-waiting" className="r4-label r4-h2">Waiting to join ({rows.length})</h2>
      <div className="r4-card r4-list">
        {rows.map((w) => (
          <button key={w.key} type="button" className="r4-row r4-row-btn" onClick={() => onOpen(w)} data-testid="r4-team-waiting-row">
            <span className="r4-row-t r4-grow r4-ellipsis">{w.name}</span>
            <span className="r4-row-end">{w.word}</span>
            <span className="r4-pill r4-pill-grey">Waiting</span>
            <span className="r4-mut"><R4Chevron /></span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** Boards 13-15: "Invited" under the role groups. Read-only (no revoke command exists); hidden when empty. */
function InvitedSection({ m, onRetry }: { m: R4InvitedModel; onRetry: () => void }) {
  if (m.state === 'hidden') return null;
  if (m.state === 'error') {
    return (
      <p className="r4-err" role="alert" data-testid="r4-team-invited-error">{R4_INVITED_COPY.error} <button type="button" className="r4-linkbtn" onClick={onRetry} data-testid="r4-team-invited-retry">{R4_INVITED_COPY.retry}</button></p>
    );
  }
  return (
    <section className="r4-section" aria-labelledby="r4-team-invited" data-testid="r4-team-invited">
      <h2 id="r4-team-invited" className="r4-label r4-h2">{R4_INVITED_COPY.title} ({m.rows.length})</h2>
      <div className="r4-card r4-list">
        {m.rows.map((r) => (
          <div key={r.key} className="r4-row" data-testid="r4-team-invited-row" data-kind={r.kind}>
            <span className="r4-row-body">
              <span className="r4-row-t r4-ellipsis" data-testid="r4-team-invited-label">{r.label}</span>
              {r.when && <span className="r4-row-line" data-testid="r4-team-invited-when">{r.when}</span>}
            </span>
            <span className="r4-pill r4-pill-grey" data-testid="r4-team-invited-role">{r.role}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Board R4Team (flag organiserR4), Team T1: Add a teammate, one section per role, Waiting to join. */
export function R4Team() {
  const ctx = useTeamContext();
  const { organiser, members, listed, viewerRole } = ctx;
  const { seat, known: seatKnown, failed: seatFailed, retry: retrySeat } = useSeatState(organiser?.id);
  const editor = viewerRole === 'owner' || viewerRole === 'manager';
  const requests = useQuery({
    queryKey: incomingAccessRequestsQueryKey(organiser?.id),
    queryFn: () => fetchIncomingAccessRequests(organiser!.id),
    enabled: !!organiser && editor,
  });
  const sent = useQuery({
    queryKey: invitesSentQueryKey(organiser?.id),
    queryFn: () => fetchInvitesSent(organiser!.id),
    enabled: !!organiser && editor,
  });
  const invited = buildR4Invited({ editor, read: sent.isError ? 'error' : sent.data ? 'ready' : 'loading', data: sent.data, now: new Date() });
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<R4Waiting | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const load = ctx.failed ? 'error' : ctx.loading ? 'loading' : !organiser ? 'nopage' : 'ready';
  const m = useMemo(
    () => buildR4Team({ load, viewerRole, members, listed, requests: requests.data, interim: isInterim(seat), seatKnown, seatFailed }),
    [load, viewerRole, members, listed, requests.data, seat, seatKnown, seatFailed],
  );
  const memberIds = useMemo(() => new Set(members.flatMap((x) => (x.profileId ? [x.userId, x.profileId] : [x.userId]))), [members]);
  const full = members.length >= TEAM_CAP;
  // Home's "Answer" (board R4HomeBefore) lands here with ?answer=<request id>: that request opens once it is listed.
  const [params, setParams] = useSearchParams();
  const answer = params.get('answer');
  const shown = open ?? (answer ? m.waiting.find((w) => w.key === answer) ?? null : null);
  const closeShown = () => {
    setOpen(null);
    if (!answer) return;
    const next = new URLSearchParams(params);
    next.delete('answer');
    setParams(next, { replace: true });
  };

  if (m.load === 'loading') return <div className="r4-stack" data-testid="r4-team-loading" aria-busy="true"><div className="r4-skel" /><div className="r4-skel" /></div>;
  if (m.load === 'error') {
    return (
      <div className="r4-card r4-tile" role="alert" data-testid="r4-team-error">
        <strong>We could not load your team.</strong>
        <p className="r4-sub">Nothing was changed. Check your signal, then try again.</p>
        <button type="button" className="r4-btn r4-btn-42 r4-btn-quiet" onClick={ctx.retry} data-testid="r4-team-retry">Try again</button>
      </div>
    );
  }
  if (m.load === 'nopage' || !organiser) {
    return (
      <div className="r4-stack" data-testid="r4-team-nopage">
        <p className="r4-sub"><strong>{NO_PAGE.title}</strong> {NO_PAGE.body}</p>
        <Link to={P3_PATHS.youHelp} className="r4-in-link r4-accent">{MESSAGE_US}</Link>
      </div>
    );
  }
  const onAdd = () => {
    setSaid(null);
    if (m.addVia === 'share') void shareSignUp(organiser.name, setSaid);
    else setAdding(true);
  };
  return (
    <div className="r4-stack" data-testid="r4-team">
      <h1 className="sr-only">Team</h1>
      {said && <p className="r4-sub" role="status" data-testid="r4-team-said">{said}</p>}
      {m.viewOnlyNote && <p className="r4-sub" role="note" data-testid="r4-team-viewonly">{m.viewOnlyNote}</p>}
      {m.add && (
        <div className="r4-field">
          <button type="button" className="r4-btn r4-btn-42 r4-btn-link" disabled={m.add.disabled} aria-describedby={m.add.reason ? 'r4-team-add-why' : undefined} onClick={onAdd} data-testid="r4-team-add">
            <Plus />{m.add.label}
          </button>
          {m.add.reason && <p id="r4-team-add-why" className="r4-hint" data-testid="r4-team-add-why">{m.add.reason}</p>}
          {m.add.retry && <button type="button" className="r4-linkbtn" onClick={retrySeat}>Try again</button>}
        </div>
      )}
      {m.readNote && <p className="r4-hint" data-testid="r4-team-readnote">{m.readNote}</p>}
      {m.groups.map((g) => <Group key={g.role} g={g} />)}
      {editor && requests.isError && (
        <p className="r4-err" role="alert" data-testid="r4-team-requests-error">We could not load join requests. <button type="button" className="r4-linkbtn" onClick={() => void requests.refetch()}>Try again</button></p>
      )}
      <WaitingSection rows={m.waiting} onOpen={setOpen} />
      <InvitedSection m={invited} onRetry={() => void sent.refetch()} />
      {editor && (
        <div className="r4-card">
          <Link to={P3_PATHS.youTeamDoorInvite} className="r4-row" data-testid="r4-team-door-invite">
            <span className="r4-row-t">Door invite link</span>
            <span className="r4-mut"><R4Chevron /></span>
          </Link>
        </div>
      )}
      {adding && (
        <AddTeammateSheet organiserId={organiser.id} pageName={organiser.name} memberCount={members.length} memberIds={memberIds}
          onClose={() => setAdding(false)} onAdded={(msg) => { setAdding(false); setSaid(msg); }} />
      )}
      {shown && (
        <Sheet title={shown.name} onClose={closeShown}>
          <div className="r4-sheet" data-testid="r4-team-request">
            <JoinRequestCard organiserId={organiser.id} request={shown.request} blockedReason={full ? TEAM_FULL_REASON : null}
              declineGate={canDecline(viewerRole, members, full)} onAnswered={(msg) => { closeShown(); setSaid(msg); }} />
          </div>
        </Sheet>
      )}
    </div>
  );
}
