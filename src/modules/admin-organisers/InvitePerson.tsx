import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Copy, MessageCircle, UserPlus } from 'lucide-react';
import type { AdminOrganiser } from './adminApi';
import {
  fetchPageLeader,
  fetchUpcoming,
  invitePerson,
  pageLeaderQueryKey,
  pageUpcomingQueryKey,
  personSearchQueryKey,
  searchPeople,
  type PageLeader,
  type PersonHit,
} from './invitePersonApi';
import { buildInviteMessage, inviteBlockedReason, invitePersonErrorMessage, isNoPageInvite, shareHref, type PersonInvite } from './invitePersonModel';

const BTN = 'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50';
const BTN_PRIMARY = 'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50';
const FIELD = 'w-full min-h-[44px] rounded border border-border bg-background px-2 py-2 text-sm';

/** The line under the search box: why nobody is prefilled for this page, else how to search. */
const leaderNote = (leader: PageLeader | undefined): string => {
  if (leader?.kind === 'none') return 'This page has no Leader on its team. Search for the person to invite.';
  if (leader?.kind === 'several') return 'This page has more than one Leader. Search for the person to invite.';
  return 'Type at least two letters of their name.';
};

/**
 * Invite a person (an organiser, or a teacher or DJ with no page) by email. The person is prefilled
 * from the chosen page's Leader when it has one, otherwise searched. The result is a ready message with
 * the link: held in component state only, never in the query cache, storage or a log.
 * With `fixedOrganiser` (a row's "Invite by email" choice) it opens at once for that page only.
 */
export function InvitePerson({ organisers, fixedOrganiser }: { organisers: readonly AdminOrganiser[]; fixedOrganiser?: AdminOrganiser }) {
  const [open, setOpen] = useState(!!fixedOrganiser);
  const [organiserId, setOrganiserId] = useState<string>(fixedOrganiser?.id ?? '');
  const [picked, setPicked] = useState<PersonHit | null>(null);
  const [unpicked, setUnpicked] = useState(false);
  const [search, setSearch] = useState('');
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<{ invite: PersonInvite; message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const organiser = organisers.find((o) => o.id === organiserId) ?? null;

  const leader = useQuery({ queryKey: pageLeaderQueryKey(organiserId || null), queryFn: () => fetchPageLeader(organiserId), enabled: open && !!organiserId, staleTime: 60_000, retry: false });
  // The page's Leader is the default until someone is picked by hand or "Change" is tapped.
  const person: PersonHit | null = picked ?? (unpicked || leader.data?.kind !== 'one' ? null : leader.data.person);
  const setPerson = (p: PersonHit | null) => { setPicked(p); setUnpicked(p === null); };

  const hits = useQuery({ queryKey: personSearchQueryKey(search.trim()), queryFn: () => searchPeople(search), enabled: open && !person && search.trim().length >= 2, staleTime: 30_000, retry: false });
  const upcoming = useQuery({ queryKey: pageUpcomingQueryKey(organiserId || null), queryFn: () => fetchUpcoming(organiserId), enabled: open && !!organiserId, staleTime: 60_000, retry: false });

  const invite = useMutation({
    mutationFn: () => invitePerson((person as PersonHit).id, email, organiserId || null),
    onSuccess: (inv) => {
      const message = buildInviteMessage({
        personName: person?.firstName?.split(' ')[0] ?? null,
        serverMessage: inv.message,
        organiserName: organiser?.name ?? null,
        link: `${window.location.origin}${inv.linkPath}`,
        upcoming: upcoming.data ?? [],
        pageUrl: organiser ? `${window.location.origin}/organisers/${organiser.id}` : null,
      });
      setResult({ invite: inv, message });
      setCopied(false);
    },
  });

  const blocked = inviteBlockedReason(person?.id ?? null, email);
  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.message);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  const reset = () => { setResult(null); setPicked(null); setUnpicked(false); setSearch(''); setEmail(''); setOrganiserId(fixedOrganiser?.id ?? ''); invite.reset(); };

  if (!open) {
    return <button type="button" className={`${BTN} w-full`} onClick={() => setOpen(true)} data-testid="invite-person-open"><UserPlus className="h-4 w-4" aria-hidden="true" /> Invite person</button>;
  }

  if (result) {
    return (
      <div data-testid="invite-person-result" className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
        <p className="text-sm font-medium">Invite ready for {result.invite.email}</p>
        <textarea readOnly rows={8} value={result.message} aria-label="Invite message" onFocus={(e) => e.currentTarget.select()} className="w-full rounded border border-border bg-background px-2 py-2 text-xs" data-testid="invite-person-message" />
        {isNoPageInvite(result.invite) ? (
          <p className="text-xs text-muted-foreground" data-testid="invite-person-no-page">Their profile now has this email. Send them the message: when they sign in with that email, the profile is theirs.</p>
        ) : (
          <p className="text-xs text-muted-foreground" data-testid="invite-person-once">This is the only time the link is shown. Once you tap Done it is gone; invite them again if you need a new one.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={BTN} onClick={() => void copy()} data-testid="invite-person-copy"><Copy className="h-4 w-4" aria-hidden="true" /> {copied ? 'Copied' : 'Copy'}</button>
          <a className={BTN} href={shareHref(result.message)} target="_blank" rel="noopener noreferrer" data-testid="invite-person-whatsapp"><MessageCircle className="h-4 w-4" aria-hidden="true" /> WhatsApp</a>
          <button type="button" className={BTN_PRIMARY} onClick={reset} data-testid="invite-person-done">Done</button>
        </div>
      </div>
    );
  }

  return (
    <form data-testid="invite-person" className="space-y-2 rounded-lg border border-border p-3" onSubmit={(e) => { e.preventDefault(); if (!blocked && !invite.isPending) invite.mutate(); }}>
      <p className="text-sm font-medium">{fixedOrganiser ? `Invite by email to ${fixedOrganiser.name}` : 'Invite person'}</p>
      {!fixedOrganiser && <label className="block space-y-1 text-xs text-muted-foreground">
        Organiser page (optional)
        <select value={organiserId} onChange={(e) => { setOrganiserId(e.target.value); setPicked(null); setUnpicked(false); setSearch(''); }} className={FIELD} data-testid="invite-person-page">
          <option value="">No page (teacher, DJ or other)</option>
          {organisers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </label>}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Person</p>
        {person ? (
          <div className="flex items-center justify-between gap-2 rounded border border-border px-2" data-testid="invite-person-chosen">
            <span className="min-w-0 truncate text-sm">{person.name}</span>
            <button type="button" className={BTN} onClick={() => { setPerson(null); setSearch(''); }} data-testid="invite-person-change">Change</button>
          </div>
        ) : (
          <>
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people by name" aria-label="Search people" className={FIELD} data-testid="invite-person-search" />
            {search.trim().length < 2 && <p className="text-xs text-muted-foreground" data-testid="invite-person-search-note">{leaderNote(organiserId ? leader.data : undefined)}</p>}
            {hits.isError && <p role="alert" className="text-sm text-destructive" data-testid="invite-person-search-error">The search did not load. Check your connection and try again.</p>}
            {hits.data && hits.data.length === 0 && <p className="text-xs text-muted-foreground" data-testid="invite-person-no-hits">No one matches &ldquo;{search.trim()}&rdquo;. Check the spelling, or search for another name they use.</p>}
            {hits.data && hits.data.length > 0 && (
              <ul className="divide-y divide-border overflow-hidden rounded border border-border" data-testid="invite-person-hits">
                {hits.data.map((h) => <li key={h.id}><button type="button" className="min-h-[44px] w-full px-2 text-left text-sm" onClick={() => setPerson(h)}>{h.name}</button></li>)}
              </ul>
            )}
          </>
        )}
      </div>
      <input type="email" inputMode="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Their email" aria-label="Email" className={FIELD} data-testid="invite-person-email" />
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={BTN_PRIMARY} disabled={!!blocked || invite.isPending} aria-describedby={blocked ? 'invite-person-note' : undefined} data-testid="invite-person-submit">{invite.isPending ? 'Inviting' : 'Invite'}</button>
        {!fixedOrganiser && <button type="button" className={BTN} onClick={() => { setOpen(false); reset(); }} data-testid="invite-person-cancel">Cancel</button>}
      </div>
      {blocked && <p id="invite-person-note" className="text-xs text-muted-foreground" data-testid="invite-person-note">{blocked}</p>}
      {invite.isError && <p role="alert" className="text-sm text-destructive" data-testid="invite-person-error">{invitePersonErrorMessage(invite.error)}</p>}
    </form>
  );
}
