import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { INVITE_REQUESTS_KEY, adminInvitesQueryKey, adminOwnershipQueryKey, type AdminOrganiser } from './adminApi';
import { InviteResult } from './InvitePerson';
import {
  fetchPageTeam,
  fetchUpcoming,
  invitePerson,
  pageTeamQueryKey,
  pageUpcomingQueryKey,
  personSearchQueryKey,
  searchPeople,
} from './invitePersonApi';
import {
  WHO_COPY,
  buildInviteMessage,
  defaultPick,
  inviteBlockedReason,
  invitePersonErrorMessage,
  refusalScreen,
  whoBlockedReason,
  type PersonInvite,
  type WhoPick,
} from './invitePersonModel';
import { DUPLICATES_KEY, fetchDuplicates } from './duplicates/duplicatesApi';

const BTN = 'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50';
const BTN_PRIMARY = 'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50';
const FIELD = 'w-full min-h-[44px] rounded border border-border bg-background px-2 py-2 text-sm';

type Step = 'who' | 'email' | 'result';

const subLine = (p: WhoPick) => (p.hasLogin === undefined ? null : p.hasLogin ? WHO_COPY.hasLogin : WHO_COPY.noLogin);

function PickRow({ p, leader, pressed, onPick }: { p: WhoPick; leader: boolean; pressed: boolean; onPick: () => void }) {
  const sub = subLine(p);
  return (
    <button type="button" aria-pressed={pressed} onClick={onPick} data-testid="who-pick" data-id={p.id}
      className={`flex min-h-[48px] w-full items-center gap-2 rounded-lg border px-3 py-2 text-left ${pressed ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-medium"><span className="truncate">{p.name}</span>{leader && <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground" data-testid="who-leader-tag">{WHO_COPY.leaderTag}</span>}</span>
        {sub && <span className="block text-xs text-muted-foreground">{sub}</span>}
      </span>
      <span aria-hidden="true" className={`h-4 w-4 shrink-0 rounded-full border-2 ${pressed ? 'border-primary bg-primary' : 'border-border'}`} />
    </button>
  );
}

/**
 * "Invite to manage <page>" starts here (W3): the invite always names the person. The page's one Leader
 * is pre-selected, the rest of the team list is one tap away, search finds anyone else, and only
 * "Someone new" makes a person-less page link (the existing link form, via onSomeoneNew).
 * An existing person goes through admin_invite_person_v1, which writes the email on their profile so
 * their sign-in lands on it. The link is held in component state only.
 */
export function InvitePersonWho({ organiser, notes = [], onSomeoneNew, onExistingAccount, onLinkShown, onCancel }: {
  organiser: AdminOrganiser;
  /** The row's own warnings for the email step (another owner; a live link this one replaces). */
  notes?: readonly string[];
  onSomeoneNew: () => void; onExistingAccount: () => void;
  /** The one-time link is on screen: the caller keeps the row open until Done. */
  onLinkShown?: () => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('who');
  const [picked, setPicked] = useState<WhoPick | null>(null);
  const [touched, setTouched] = useState(false);
  const [search, setSearch] = useState('');
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<{ invite: PersonInvite; message: string } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  const team = useQuery({ queryKey: pageTeamQueryKey(organiser.id), queryFn: () => fetchPageTeam(organiser.id), staleTime: 60_000, retry: false });
  const hits = useQuery({ queryKey: personSearchQueryKey(search.trim()), queryFn: () => searchPeople(search), enabled: step === 'who' && search.trim().length >= 2, staleTime: 30_000, retry: false });
  const upcoming = useQuery({ queryKey: pageUpcomingQueryKey(organiser.id), queryFn: () => fetchUpcoming(organiser.id), staleTime: 60_000, retry: false });

  // The one Leader is the pick until the admin taps someone (or nobody when there are none or several).
  const pick: WhoPick | null = touched ? picked : defaultPick(team.data);
  const choose = (p: WhoPick) => { setPicked(p); setTouched(true); };
  const leaders = (team.data ?? []).filter((p) => p.isLeader).length;

  const invite = useMutation({
    mutationFn: () => invitePerson((pick as WhoPick).id, email, organiser.id),
    onSuccess: (inv) => {
      const message = buildInviteMessage({
        personName: pick?.firstName?.split(' ')[0] ?? null,
        serverMessage: inv.message,
        organiserName: organiser.name,
        link: `${window.location.origin}${inv.linkPath}`,
        upcoming: upcoming.data ?? [],
        pageUrl: `${window.location.origin}/organisers/${organiser.id}`,
      });
      setResult({ invite: inv, message });
      setStep('result');
      onLinkShown?.();
      // The same refreshes the link form makes: the row's status, its Withdraw button, waiting requests.
      void queryClient.invalidateQueries({ queryKey: adminInvitesQueryKey(organiser.id) });
      void queryClient.invalidateQueries({ queryKey: adminOwnershipQueryKey(organiser.id) });
      void queryClient.invalidateQueries({ queryKey: INVITE_REQUESTS_KEY });
    },
  });
  // A2 ships the old-login email switch with the duplicate check: whether that RPC exists says which
  // refusal copy is true. Asked only after a refusal, not on every sheet open.
  const a2 = useQuery({ queryKey: DUPLICATES_KEY, queryFn: fetchDuplicates, staleTime: 0, retry: false, enabled: invite.isError });
  const shadowSwitchLive = a2.data?.kind === 'ok';
  const firstName = pick?.firstName?.split(' ')[0] ?? null;
  const screen = invite.isError ? refusalScreen(invite.error, { firstName, hasLogin: pick?.hasLogin, shadowSwitchLive }) : null;
  const backToWho = () => { invite.reset(); setStep('who'); };
  // Focus moves to the new view's heading (PLAN.md section 3); a refusal is its own view inside `email`.
  const view = screen ? `refused:${screen.code}` : step;
  useEffect(() => { if (first.current) { first.current = false; return; } heading.current?.focus(); }, [view]);

  if (step === 'result' && result && pick) {
    return <InviteResult title={WHO_COPY.ready(pick.name)} invite={result.invite} message={result.message} onDone={onCancel} />;
  }

  if (step === 'email' && pick && screen) {
    return (
      <div className="space-y-2 rounded-lg border border-border p-3" data-testid="invite-refused" data-code={screen.code}>
        <span className="inline-block rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-300">Not sent</span>
        <h3 ref={heading} tabIndex={-1} className="text-base font-semibold outline-none" data-testid="invite-refused-title">{screen.title}</h3>
        <p className="text-sm">{screen.body}</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">{screen.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        <p className="text-sm font-medium" data-testid="invite-refused-next">{screen.next}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={BTN_PRIMARY} onClick={() => invite.reset()} data-testid="invite-refused-email">Change the email</button>
          <button type="button" className={BTN} onClick={backToWho} data-testid="invite-refused-who">{WHO_COPY.pickAgain}</button>
        </div>
      </div>
    );
  }

  if (step === 'email' && pick) {
    const blocked = inviteBlockedReason(pick.id, email);
    return (
      <form className="space-y-2 rounded-lg border border-border p-3" data-testid="who-email" onSubmit={(e) => { e.preventDefault(); if (!blocked && !invite.isPending) invite.mutate(); }}>
        <h3 ref={heading} tabIndex={-1} className="text-sm font-semibold outline-none" data-testid="who-email-person">{pick.name}</h3>
        {subLine(pick) && <p className="text-xs text-muted-foreground">{subLine(pick)}</p>}
        <label className="block space-y-1 text-sm font-medium">
          {WHO_COPY.emailLabel}
          <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); invite.reset(); }} placeholder="name@example.com" className={FIELD} aria-describedby="who-email-help" data-testid="who-email-input" />
        </label>
        <p id="who-email-help" className="text-xs text-muted-foreground">{WHO_COPY.emailHelp(firstName)}</p>
        {pick.hasLogin && <p className="text-xs text-muted-foreground" data-testid="who-has-login">{WHO_COPY.hasLoginNote(firstName)}</p>}
        {notes.map((n) => <p key={n} className="text-xs text-muted-foreground" data-testid="who-row-note">{n}</p>)}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={BTN_PRIMARY} disabled={!!blocked || invite.isPending} aria-describedby={blocked ? 'who-email-blocked' : undefined} data-testid="who-submit">{invite.isPending ? WHO_COPY.creating : WHO_COPY.create}</button>
          <button type="button" className={BTN} onClick={backToWho} data-testid="who-back">{WHO_COPY.pickAgain}</button>
        </div>
        {blocked && <p id="who-email-blocked" className="text-xs text-muted-foreground" data-testid="who-email-blocked">{blocked}</p>}
        <div aria-live="polite">{invite.isError && <p role="alert" className="text-sm text-destructive" data-testid="who-error">{invitePersonErrorMessage(invite.error)}</p>}</div>
      </form>
    );
  }

  const blocked = whoBlockedReason(pick);
  const teamIds = new Set((team.data ?? []).map((p) => p.id));
  const others = (hits.data ?? []).filter((h) => !teamIds.has(h.id));
  return (
    <div className="space-y-2 rounded-lg border border-border p-3" data-testid="invite-who">
      <h3 ref={heading} tabIndex={-1} className="text-base font-semibold outline-none">{WHO_COPY.title}</h3>
      <p className="text-sm text-muted-foreground">{WHO_COPY.lead}</p>
      <div aria-live="polite" className="space-y-2">
        {team.isPending && <p className="text-xs text-muted-foreground" data-testid="who-team-loading">{WHO_COPY.teamLoading}</p>}
        {team.isError && (
          <div role="alert" className="space-y-2" data-testid="who-team-error">
            <p className="text-sm text-destructive">{WHO_COPY.teamFailed}</p>
            <button type="button" className={BTN} onClick={() => void team.refetch()}>Try again</button>
          </div>
        )}
        {team.data && team.data.length === 0 && <p className="text-xs text-muted-foreground" data-testid="who-team-empty">{WHO_COPY.teamEmpty}</p>}
        {leaders >= 2 && !touched && <p className="text-xs text-muted-foreground" data-testid="who-several-leaders">{WHO_COPY.severalLeaders}</p>}
      </div>
      {team.data && team.data.length > 0 && (
        <div className="space-y-1.5" data-testid="who-team">
          {team.data.map((p) => <PickRow key={p.id} p={p} leader={p.isLeader} pressed={pick?.id === p.id} onPick={() => choose(p)} />)}
        </div>
      )}
      <label className="block space-y-1 text-sm font-medium">
        {WHO_COPY.searchLabel}
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name" className={FIELD} data-testid="who-search" />
      </label>
      {search.trim().length < 2 && <p className="text-xs text-muted-foreground">{WHO_COPY.searchHint}</p>}
      {hits.isError && <p role="alert" className="text-sm text-destructive" data-testid="who-search-error">The search did not load. Check your connection and try again.</p>}
      {hits.data && hits.data.length === 0 && <p className="text-xs text-muted-foreground" data-testid="who-no-hits">No one matches &ldquo;{search.trim()}&rdquo;. Check the spelling, or pick Someone new.</p>}
      {hits.data && hits.data.length > 0 && others.length === 0 && <p className="text-xs text-muted-foreground" data-testid="who-hits-on-team">Everyone matching &ldquo;{search.trim()}&rdquo; is on the team list above.</p>}
      {others.length > 0 && (
        <div className="space-y-1.5" data-testid="who-hits">
          {others.map((h) => <PickRow key={h.id} p={h} leader={false} pressed={pick?.id === h.id} onPick={() => choose(h)} />)}
        </div>
      )}
      <button type="button" className={`${BTN_PRIMARY} w-full`} disabled={!!blocked} aria-describedby={blocked ? 'who-blocked' : undefined} onClick={() => { if (pick) choose(pick); setStep('email'); }} data-testid="who-next">{WHO_COPY.next}</button>
      {blocked && <p id="who-blocked" className="text-xs text-muted-foreground" data-testid="who-blocked">{blocked}</p>}
      {[
        { id: 'choice-link', title: WHO_COPY.someoneNew, hint: WHO_COPY.someoneNewHint, on: onSomeoneNew },
        { id: 'choice-existing', title: WHO_COPY.hasAccount, hint: WHO_COPY.hasAccountHint, on: onExistingAccount },
      ].map((c) => (
        <button key={c.id} type="button" className="flex min-h-[48px] w-full items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-left" onClick={c.on} data-testid={c.id}>
          <span><span className="block text-sm font-medium">{c.title}</span><span className="block text-xs text-muted-foreground">{c.hint}</span></span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      ))}
      <button type="button" className={BTN} onClick={onCancel} data-testid="choices-cancel">Cancel</button>
    </div>
  );
}
