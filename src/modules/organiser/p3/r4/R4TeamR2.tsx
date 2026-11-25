import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchIncomingAccessRequests, incomingAccessRequestsQueryKey } from '@/modules/organiser/shared/selfServeApi';
import { TEAM_FULL_REASON, teamIsFull } from '@/modules/organiser/shared/teamModel';
import { canDecline } from '@/modules/organiser/shared/teamRules';
import { useTeamContext } from '../../team/useTeamContext';
import { JoinRequestCard } from '../../flows/fix/JoinRequest';
import { WaitingSection } from './R4Team';
import { buildR4Team, type R4Waiting } from './r4TeamModel';
import { Sheet } from '../screens/Sheet';
import { P3_PATHS } from '../shell/paths';
import { R4Chevron } from './R4Shell';
import {
  fetchTeamR2Changes, fetchTeamR2People, setTeamR2Switches, teamR2ChangesKey, teamR2PeopleKey,
  type R4TeamR2Change, type R4TeamR2Person,
} from './r4TeamR2Api';

export const R4_TEAM_R2_COPY = {
  loadError: 'Could not load your team. Pull to refresh.',
  retry: 'Retry',
  lockOut: "You can't switch off your own sign-in.",
  ownerOnly: 'Only the page owner can change this.',
  generic: 'Could not save. Try again.',
  noChanges: 'No changes yet.',
  invite: 'Invite link sent - waiting',
} as const;

const ROLE_WORD: Record<R4TeamR2Person['role'], string> = { owner: 'Owner', manager: 'Manager', contributor: 'Contributor', door: 'Door' };
const roleWord = (r: string | null) => (r && r in ROLE_WORD ? ROLE_WORD[r as R4TeamR2Person['role']] : r ? r.charAt(0).toUpperCase() + r.slice(1) : 'a role');

/** One plain line under the row for a failed switch save. */
export function switchErrorLine(err: unknown): string {
  const msg = String((err as { message?: unknown } | null)?.message ?? err ?? '').toLowerCase();
  if (msg.includes('cannot_lock_out_owner')) return R4_TEAM_R2_COPY.lockOut;
  if (/not_a_member|not_owner|not_authori|not_allowed|use_transfer|forbidden|permission|owner_only/.test(msg)) return R4_TEAM_R2_COPY.ownerOnly;
  return R4_TEAM_R2_COPY.generic;
}

const LONDON = 'Europe/London';
/** "Thu 14:00" in London time. */
export function doorUntilWords(iso: string | null): string {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return 'Door';
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: LONDON, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `Door until ${get('weekday')} ${get('hour')}:${get('minute')}`;
}

export function expiresWords(iso: string | null): string {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return `expires ${new Intl.DateTimeFormat('en-GB', { timeZone: LONDON, day: 'numeric', month: 'short' }).format(d)}`;
}

const londonDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: LONDON }).format(d);
export function agoWords(iso: string, now: Date): string {
  const d = new Date(iso);
  const mins = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24 && londonDay(d) === londonDay(now)) return `${Math.floor(mins / 60)}h ago`;
  const yesterday = new Date(now.getTime() - 86400000);
  if (londonDay(d) === londonDay(yesterday)) return 'yesterday';
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ago`;
  return new Intl.DateTimeFormat('en-GB', { timeZone: LONDON, day: 'numeric', month: 'short' }).format(d);
}

/** One plain sentence per recent change. */
export function changeSentence(c: R4TeamR2Change, now: Date): string {
  const a = c.actor;
  const p = c.person;
  let s: string;
  switch (c.action) {
    case 'added': s = `${a} added ${p} as ${roleWord(c.toRole)}`; break;
    case 'removed': s = `${a} removed ${p} from the team`; break;
    case 'role_changed': s = `${a} changed ${p} from ${roleWord(c.fromRole)} to ${roleWord(c.toRole)}`; break;
    case 'shown': s = `${a} showed ${p} on the public page`; break;
    case 'hidden': s = `${a} hid ${p} from the public page`; break;
    case 'invite_link': s = `${a} sent an invite link`; break;
    case 'door_added': s = `${a} added ${p} to the door`; break;
    case 'door_removed': s = `${a} removed ${p} from the door`; break;
    case 'owner_handed_over': s = `${a} handed the page over to ${p}`; break;
    default: s = `${a} changed ${p}`;
  }
  return `${s} - ${agoWords(c.at, now)}`;
}

export interface R4TeamR2Row {
  person: R4TeamR2Person;
  /** live door row, expired door row, or a normal row */
  kind: 'normal' | 'door' | 'door-expired';
  roleLine: string;
  signInLocked: boolean;
}

/** Rows in the order the RPC returned them. Sign-in is read-only for the owner row and for a manager viewer. */
export function buildRows(people: R4TeamR2Person[], viewerRole: string): R4TeamR2Row[] {
  return people.map((person) => ({
    person,
    kind: person.role === 'door' ? (person.doorExpired ? 'door-expired' : 'door') : 'normal',
    roleLine: person.role === 'door' && !person.doorExpired ? doorUntilWords(person.doorUntil) : ROLE_WORD[person.role],
    signInLocked: person.role === 'owner' || viewerRole !== 'owner',
  }));
}

function Switch({ label, on, disabled, onToggle, testId }: { label: string; on: boolean; disabled: boolean; onToggle: () => void; testId: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={onToggle} data-testid={testId}
      className="r4-row-btn" style={{ minHeight: 44, display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 0, padding: 0, opacity: disabled ? 0.6 : 1 }}>
      <span className="r4-sub">{label}</span>
      <span className={`r4-pill ${on ? 'r4-pill-live' : 'r4-pill-grey'}`}>{on ? 'On' : 'Off'}</span>
    </button>
  );
}

export function R4TeamR2() {
  const ctx = useTeamContext();
  const qc = useQueryClient();
  const org = ctx.organiser?.id;
  const people = useQuery({ queryKey: teamR2PeopleKey(org), queryFn: () => fetchTeamR2People(org!), enabled: !!org });
  const changes = useQuery({ queryKey: teamR2ChangesKey(org), queryFn: () => fetchTeamR2Changes(org!), enabled: !!org });
  const [over, setOver] = useState<Record<string, { canSignIn: boolean; onPublic: boolean }>>({});
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<R4TeamR2Person | null>(null);
  const [openChanges, setOpenChanges] = useState(false);
  const editor = ctx.viewerRole === 'owner' || ctx.viewerRole === 'manager';
  const requests = useQuery({
    queryKey: incomingAccessRequestsQueryKey(org),
    queryFn: () => fetchIncomingAccessRequests(org!),
    enabled: !!org && editor,
  });
  const [open, setOpen] = useState<R4Waiting | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const answer = params.get('answer');
  const waiting = buildR4Team({ load: 'ready', viewerRole: ctx.viewerRole, members: ctx.members, listed: ctx.listed, requests: requests.data }).waiting;
  const shown = open ?? (answer ? waiting.find((w) => w.key === answer) ?? null : null);
  const full = teamIsFull(ctx.members.length, false);
  const closeShown = () => {
    setOpen(null);
    if (!answer) return;
    const next = new URLSearchParams(params);
    next.delete('answer');
    setParams(next, { replace: true });
  };

  const save = useMutation({
    mutationFn: (v: { userId: string; canSignIn: boolean; onPublic: boolean }) => setTeamR2Switches(org!, v.userId, v.canSignIn, v.onPublic),
  });
  const run = (p: R4TeamR2Person, next: { canSignIn: boolean; onPublic: boolean }, removing: boolean) => {
    setErrs((e) => { const { [p.userId]: _drop, ...rest } = e; return rest; });
    setOver((o) => ({ ...o, [p.userId]: next }));
    if (removing) setGone((g) => new Set(g).add(p.userId));
    save.mutate({ userId: p.userId, ...next }, {
      onError: (err) => {
        setOver((o) => { const { [p.userId]: _drop, ...rest } = o; return rest; });
        setGone((g) => { const n = new Set(g); n.delete(p.userId); return n; });
        setErrs((e) => ({ ...e, [p.userId]: switchErrorLine(err) }));
      },
      onSettled: () => {
        void Promise.all([
          qc.invalidateQueries({ queryKey: teamR2PeopleKey(org) }),
          qc.invalidateQueries({ queryKey: teamR2ChangesKey(org) }),
        ]).then(() => setOver((o) => { const { [p.userId]: _drop, ...rest } = o; return rest; }));
      },
    });
  };
  const flip = (p: R4TeamR2Person, which: 'canSignIn' | 'onPublic') => {
    const cur = over[p.userId] ?? { canSignIn: p.canSignIn, onPublic: p.onPublic };
    const next = { ...cur, [which]: !cur[which] };
    if (!next.canSignIn && !next.onPublic) { setConfirm(p); return; }
    run(p, next, false);
  };

  if (ctx.loading || (!!org && people.isPending)) {
    return <div className="r4-stack" data-testid="r4-team-r2-loading" aria-busy="true"><div className="r4-skel" /><div className="r4-skel" /></div>;
  }
  if (ctx.failed || people.isError || !org) {
    return (
      <div className="r4-card r4-tile" role="alert" data-testid="r4-team-r2-error">
        <p className="r4-sub">{R4_TEAM_R2_COPY.loadError}</p>
        <button type="button" className="r4-btn r4-btn-42 r4-btn-quiet" onClick={() => { ctx.retry(); void people.refetch(); }} data-testid="r4-team-r2-retry">{R4_TEAM_R2_COPY.retry}</button>
      </div>
    );
  }

  const now = new Date();
  const rows = buildRows(people.data!.people, ctx.viewerRole).filter((r) => !gone.has(r.person.userId));
  const invites = people.data!.invites;
  return (
    <div className="r4-stack" data-testid="r4-team-r2">
      <h1 className="r4-label r4-h2">Team</h1>
      <Link to={P3_PATHS.youTeamAdd} className="r4-btn r4-btn-42 r4-btn-link" data-testid="r4-team-r2-add">Add someone</Link>
      {said && <p className="r4-sub" role="status" data-testid="r4-team-said">{said}</p>}
      {editor && requests.isError && (
        <p className="r4-err" role="alert" data-testid="r4-team-requests-error">We could not load join requests. <button type="button" className="r4-linkbtn" onClick={() => void requests.refetch()}>Try again</button></p>
      )}
      <WaitingSection rows={waiting} onOpen={setOpen} />
      <div className="r4-card r4-list" data-testid="r4-team-r2-list">
        {rows.map((r) => {
          const p = r.person;
          const cur = over[p.userId] ?? { canSignIn: p.canSignIn, onPublic: p.onPublic };
          const expired = r.kind === 'door-expired';
          return (
            <div key={p.userId} className="r4-row" data-testid="r4-team-r2-row" data-role={p.role} style={{ display: 'block', opacity: expired ? 0.5 : 1 }}>
              <Link to={P3_PATHS.youTeamPerson(p.userId)} className="r4-row-body" data-testid="r4-team-r2-name" style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44 }}>
                {p.avatarUrl
                  ? <img src={p.avatarUrl} alt="" width={32} height={32} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                  : <span aria-hidden="true" className="r4-pill r4-pill-grey">{p.name.charAt(0).toUpperCase()}</span>}
                <span className="r4-row-t r4-grow r4-ellipsis">{p.name}{p.isYou ? ' (you)' : ''}</span>
                <span className="r4-row-end" data-testid="r4-team-r2-role">{r.roleLine}</span>
                <span className="r4-mut"><R4Chevron /></span>
              </Link>
              {expired ? (
                <Link to={P3_PATHS.youTeamDoorInvite} className="r4-btn r4-btn-42 r4-btn-quiet" data-testid="r4-team-r2-readd">Re-add</Link>
              ) : (
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <Switch label="Can sign in" on={p.role === 'owner' ? true : cur.canSignIn} disabled={r.signInLocked} onToggle={() => flip(p, 'canSignIn')} testId="r4-team-r2-signin" />
                  <Switch label="On public page" on={cur.onPublic} disabled={false} onToggle={() => flip(p, 'onPublic')} testId="r4-team-r2-public" />
                </div>
              )}
              {errs[p.userId] && <p className="r4-err" role="alert" data-testid="r4-team-r2-rowerr">{errs[p.userId]}</p>}
            </div>
          );
        })}
      </div>
      {invites.map((i, n) => (
        <div key={n} className="r4-row r4-mut" data-testid="r4-team-r2-invite">
          <span className="r4-row-t">{R4_TEAM_R2_COPY.invite}</span>
          {i.expiresAt && <span className="r4-row-end">{expiresWords(i.expiresAt)}</span>}
        </div>
      ))}
      {changes.data && (
        <section data-testid="r4-team-r2-changes">
          <button type="button" className="r4-row r4-row-btn" aria-expanded={openChanges} onClick={() => setOpenChanges((v) => !v)} data-testid="r4-team-r2-changes-toggle">
            <span className="r4-row-t r4-grow">Recent changes</span>
            <span className="r4-mut" style={{ transform: openChanges ? 'rotate(90deg)' : undefined }}><R4Chevron /></span>
          </button>
          {openChanges && (changes.data.length === 0
            ? <p className="r4-hint" data-testid="r4-team-r2-nochanges">{R4_TEAM_R2_COPY.noChanges}</p>
            : <ul className="r4-stack">{changes.data.slice(0, 20).map((c, n) => <li key={n} className="r4-sub" data-testid="r4-team-r2-change">{changeSentence(c, now)}</li>)}</ul>)}
        </section>
      )}
      {shown && (
        <Sheet title={shown.name} onClose={closeShown}>
          <div className="r4-sheet" data-testid="r4-team-request">
            <JoinRequestCard organiserId={org} request={shown.request} blockedReason={full ? TEAM_FULL_REASON : null}
              declineGate={canDecline(ctx.viewerRole, ctx.members, full)}
              onAnswered={(msg) => {
                closeShown(); setSaid(msg);
                void qc.invalidateQueries({ queryKey: teamR2PeopleKey(org) });
                void qc.invalidateQueries({ queryKey: teamR2ChangesKey(org) });
              }} />
          </div>
        </Sheet>
      )}
      {confirm && (
        <Sheet title={`Remove ${confirm.name} from the team?`} onClose={() => setConfirm(null)}>
          <div className="r4-sheet r4-stack">
            <button type="button" className="r4-btn r4-btn-42" data-testid="r4-team-r2-remove"
              onClick={() => { const p = confirm; setConfirm(null); run(p, { canSignIn: false, onPublic: false }, true); }}>Remove</button>
            <button type="button" className="r4-btn r4-btn-42 r4-btn-quiet" data-testid="r4-team-r2-cancel" onClick={() => setConfirm(null)}>Cancel</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
