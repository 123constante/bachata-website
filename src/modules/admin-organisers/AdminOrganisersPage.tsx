import { useMemo, useState } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, MessageCircle, Search, UserPlus } from 'lucide-react';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Skeleton } from '@/components/ui/skeleton';
import { CityPicker } from '@/components/ui/city-picker';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { useNoindexMeta } from '@/hooks/useNoindexMeta';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { instantDateLabel } from '@/modules/organiser/shared/teamModel';
import {
  ADMIN_ORGANISERS_KEY,
  INVITE_REQUESTS_KEY,
  addOrganiserPerson,
  adminInvitesQueryKey,
  adminIssueOrganiserInvite,
  adminOwnershipQueryKey,
  fetchAdminOrganisers,
  fetchIsManaged,
  fetchOrganiserInvites,
  revokeOrganiserInvite,
  type AdminOrganiser,
} from './adminApi';
import {
  lifecycleLabel,
  notLiveNote,
  ACCESS_ORDER,
  MEMBER_ROLES,
  MEMBER_ROLE_LABEL,
  accessStatus,
  adminErrorMessage,
  inviteUrl,
  whatsappHref,
  type AccessStatus,
  type InviteRow,
  type MemberRole,
} from './inviteModel';
import {
  ANOTHER_OWNER_NOTE,
  EMAIL_HELP,
  LOAD_FAILED_NOTE,
  ISSUE_REFUSAL,
  NO_EMAIL_NOTE,
  PRIMARY_LABEL,
  PRIMARY_OPENS,
  PREFILL_NEEDS_EMAIL,
  REPLACES_NOTE,
  SENDER_LABEL,
  linkBlockedReason,
  linkOnceNote,
  senderActions,
  senderDetail,
  type InviteChoice,
  type IssueRefusal,
} from './senderModel';

import { InvitePerson } from './InvitePerson';
import { InvitePersonWho } from './InvitePersonWho';
import { DuplicatesAlert } from './duplicates/DuplicatesAlert';
import { InviteRequests } from './InviteRequests';
import { FrontDoorEntry } from './FrontDoorEntry';
import { isPlausibleEmail } from '@/modules/organiser/shared/emailShape';

const PAGE_SIZE = 20;
const BTN = 'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50';
const BTN_PRIMARY = 'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50';
const FIELD = 'w-full min-h-[44px] rounded border border-border bg-background px-2 py-2 text-sm';
const TONE: Record<AccessStatus, string> = {
  unclaimed: 'bg-muted text-muted-foreground',
  invited: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  invite_expired: 'bg-red-500/15 text-destructive',
  managed: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
};

/** The one place a status is drawn: the list, the row and the counts all use it. */
export function StatusTag({ status }: { status: AccessStatus | null }) {
  if (status === null) return <span data-testid="status-tag" data-status="loading" className="rounded px-1.5 py-0.5 text-xs text-muted-foreground">&hellip;</span>;
  return <span data-testid="status-tag" data-status={status} className={`rounded px-1.5 py-0.5 text-xs font-medium ${TONE[status]}`}>{SENDER_LABEL[status]}</span>;
}

/** A link just made: the link itself plus the address it is bound to (null = unbound). */
export interface IssuedLinkView {
  link: string;
  boundEmail: string | null;
}

/** The link, shown once (5c). Held in component state only: never in the query cache, storage or a log. */
function OneTimeLink({ organiser, issued, onDone }: { organiser: string; issued: IssuedLinkView; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(issued.link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div data-testid="one-time-link" className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
      <p className="text-sm font-medium">Link for {organiser}</p>
      <input readOnly value={issued.link} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} className="w-full rounded border border-border bg-background px-2 py-2 text-xs" data-testid="link-field" />
      <p className="text-xs text-muted-foreground" data-testid="link-once-note">{linkOnceNote(issued.boundEmail)}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={BTN_PRIMARY} onClick={copy} data-testid="copy-link"><Copy className="h-4 w-4" aria-hidden="true" /> {copied ? 'Copied' : 'Copy'}</button>
        <a className={BTN} href={whatsappHref(organiser, issued.link)} target="_blank" rel="noopener noreferrer" data-testid="whatsapp-link"><MessageCircle className="h-4 w-4" aria-hidden="true" /> WhatsApp</a>
        <button type="button" className={BTN} onClick={onDone} data-testid="link-done">Done</button>
      </div>
    </div>
  );
}

function AddPerson({ organiser }: { organiser: AdminOrganiser }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MemberRole>('manager');
  const [done, setDone] = useState<string | null>(null);
  const add = useMutation({
    mutationFn: () => addOrganiserPerson(organiser.id, email, role),
    onSuccess: () => {
      setDone(`${email.trim()} is now ${MEMBER_ROLE_LABEL[role].toLowerCase()} of ${organiser.name}.`);
      setEmail('');
      void queryClient.invalidateQueries({ queryKey: adminOwnershipQueryKey(organiser.id) });
    },
  });
  const valid = isPlausibleEmail(email);
  return (
    <form
      data-testid="add-person"
      className="space-y-2 rounded-lg border border-border p-3"
      onSubmit={(e) => { e.preventDefault(); setDone(null); if (valid) add.mutate(); }}
    >
      <p className="text-sm font-medium">Add person</p>
      <input type="email" inputMode="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Their account email" aria-label="Email" className="w-full rounded border border-border bg-background px-2 py-2 text-sm" data-testid="add-email" />
      <select value={role} onChange={(e) => setRole(e.target.value as MemberRole)} aria-label="Role" className="w-full rounded border border-border bg-background px-2 py-2 text-sm" data-testid="add-role">
        {MEMBER_ROLES.map((r) => <option key={r} value={r}>{MEMBER_ROLE_LABEL[r]}</option>)}
      </select>
      <button type="submit" className={BTN} disabled={!valid || add.isPending} aria-describedby="add-note" data-testid="add-submit"><UserPlus className="h-4 w-4" aria-hidden="true" /> {add.isPending ? 'Adding' : 'Add'}</button>
      {!valid && <p id="add-note" className="text-xs text-muted-foreground" data-testid="add-note">Enter their email address to add them. They must already have an account.</p>}
      {add.isError && <p role="alert" className="text-sm text-destructive" data-testid="add-error">{adminErrorMessage(add.error)}</p>}
      {done && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300" data-testid="add-done">{done}</p>}
    </form>
  );
}

/**
 * "Send a link": email (binds the link and allow-lists it), optional first name and city (prefill
 * for the newcomer's dancer questions). The three field refusals the RPC returns show under their field.
 */
function LinkForm({ organiser, status, replaces, startEmail, onIssued, onCancel }: {
  organiser: AdminOrganiser; status: AccessStatus | null; replaces: boolean; startEmail: string;
  onIssued: (v: IssuedLinkView) => void; onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState(startEmail);
  const [firstName, setFirstName] = useState('');
  const [cityId, setCityId] = useState('');
  const [refusal, setRefusal] = useState<IssueRefusal | null>(null);
  const issue = useMutation({
    mutationFn: () => adminIssueOrganiserInvite({ organiserId: organiser.id, email, firstName, cityId }),
    onSuccess: (out) => {
      if (out.ok === false) { setRefusal(out.reason); return; }
      onIssued({ link: inviteUrl(window.location.origin, out.link.token), boundEmail: out.link.emailBound ? email.trim().toLowerCase() : null });
      void queryClient.invalidateQueries({ queryKey: adminInvitesQueryKey(organiser.id) });
      void queryClient.invalidateQueries({ queryKey: adminOwnershipQueryKey(organiser.id) });
      // Issuing closes this organiser's waiting "new link" requests on the server.
      void queryClient.invalidateQueries({ queryKey: INVITE_REQUESTS_KEY });
    },
  });
  const blocked = linkBlockedReason(email, firstName);
  // Prefill only reaches the newcomer on a bound link, so these two wait for an email.
  const noEmail = !email.trim();
  const fieldError = (field: 'email' | 'first_name' | 'city') =>
    refusal && ISSUE_REFUSAL[refusal].field === field
      ? <p role="alert" className="text-sm text-destructive" data-testid={`link-error-${field}`}>{ISSUE_REFUSAL[refusal].text}</p>
      : null;
  return (
    <form data-testid="link-form" className="space-y-2 rounded-lg border border-border p-3" onSubmit={(e) => { e.preventDefault(); if (!blocked && !issue.isPending) { setRefusal(null); issue.mutate(); } }}>
      <p className="text-sm font-medium">Send a link</p>
      {replaces && <p className="text-xs text-muted-foreground" data-testid="link-replaces-note">{REPLACES_NOTE}</p>}
      {status === 'managed' && <p className="text-xs text-muted-foreground" data-testid="link-owner-note">{ANOTHER_OWNER_NOTE}</p>}
      <label className="block space-y-1 text-xs text-muted-foreground">
        Their email
        <input type="email" inputMode="email" autoComplete="off" value={email} onChange={(e) => { setEmail(e.target.value); setRefusal(null); }} placeholder="name@example.com" className={FIELD} aria-describedby="link-email-help" data-testid="link-email" />
      </label>
      <p id="link-email-help" className="text-xs text-muted-foreground" data-testid="link-email-help">{email.trim() ? EMAIL_HELP : NO_EMAIL_NOTE}</p>
      {fieldError('email')}
      <label className="block space-y-1 text-xs text-muted-foreground">
        First name (optional)
        <input type="text" autoComplete="off" value={firstName} disabled={noEmail} aria-describedby={noEmail ? 'link-prefill-reason' : undefined} onChange={(e) => { setFirstName(e.target.value); setRefusal(null); }} className={FIELD} data-testid="link-first-name" />
      </label>
      {fieldError('first_name')}
      <div className="space-y-1 text-xs text-muted-foreground">
        <label htmlFor="link-city">City (optional)</label>
        <CityPicker id="link-city" value={cityId || undefined} onChange={(id) => { setCityId(id); setRefusal(null); }} placeholder="Pick their city" disabled={noEmail} className="min-h-[44px] w-full" />
      </div>
      {noEmail && <p id="link-prefill-reason" className="text-xs text-muted-foreground" data-testid="link-prefill-reason">{PREFILL_NEEDS_EMAIL}</p>}
      {fieldError('city')}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={BTN_PRIMARY} disabled={!!blocked || issue.isPending} aria-describedby={blocked ? 'link-blocked' : undefined} data-testid="link-submit">{issue.isPending ? 'Making link' : replaces ? 'Replace and make link' : 'Make link'}</button>
        <button type="button" className={BTN} onClick={onCancel} data-testid="link-cancel">Cancel</button>
      </div>
      {blocked && <p id="link-blocked" className="text-xs text-muted-foreground" data-testid="link-blocked">{blocked}</p>}
      {issue.isError && <p role="alert" className="text-sm text-destructive" data-testid="invite-error">{adminErrorMessage(issue.error)}</p>}
    </form>
  );
}

export type RowMode = 'idle' | 'choose' | InviteChoice;

function RowDetail({ organiser, status, invites, fresh, issued, held, warn, loadError, startMode, startEmail, onIssued, onHold, onDone, onRetry }: {
  organiser: AdminOrganiser; status: AccessStatus | null; invites: readonly InviteRow[]; fresh: boolean;
  issued: IssuedLinkView | undefined; held: boolean; warn: boolean; loadError: boolean; startMode: RowMode; startEmail: string;
  onIssued: (v: IssuedLinkView) => void; onHold: (held: boolean) => void; onDone: () => void; onRetry: () => void;
}) {
  const queryClient = useQueryClient();
  const actions = senderActions(status, invites, loadError);
  const [mode, setMode] = useState<RowMode>(startMode);
  const revoke = useMutation({
    mutationFn: () => revokeOrganiserInvite(organiser.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminInvitesQueryKey(organiser.id) });
      void queryClient.invalidateQueries({ queryKey: adminOwnershipQueryKey(organiser.id) });
    },
  });
  const detail = senderDetail(status, invites, (iso) => instantDateLabel(iso) ?? iso, fresh);
  const notLive = notLiveNote(organiser.lifecycle);
  const noteId = `primary-note-${organiser.id}`;
  const back = () => setMode('idle');
  return (
    <div data-testid="row-detail" className="space-y-2 border-t border-border bg-muted/30 p-3">
      {(detail || notLive) && <p className="text-sm text-muted-foreground" data-testid="status-detail">{[detail, notLive].filter(Boolean).join(' ')}</p>}
      {loadError && (
        <div role="alert" id={noteId} className="space-y-2" data-testid="row-load-error">
          <p className="text-sm text-destructive">{LOAD_FAILED_NOTE}</p>
          <button type="button" className={BTN} onClick={onRetry} data-testid="row-retry">Retry</button>
        </div>
      )}
      {issued ? (
        <OneTimeLink organiser={organiser.name} issued={issued} onDone={() => { setMode('idle'); onDone(); }} />
      ) : mode === 'choose' ? (
        <InvitePersonWho
          organiser={organiser}
          notes={[status === 'managed' ? ANOTHER_OWNER_NOTE : null, actions.replacesLiveLink ? REPLACES_NOTE : null].filter((n): n is string => n !== null)}
          onSomeoneNew={() => setMode('link')} onExistingAccount={() => setMode('existing')}
          // The named-person link is shown once too: the row cannot close until Done, like OneTimeLink.
          onLinkShown={() => onHold(true)}
          onCancel={() => { setMode('idle'); if (held) { onHold(false); onDone(); } }}
        />
      ) : mode === 'link' ? (
        <LinkForm organiser={organiser} status={status} replaces={actions.replacesLiveLink} startEmail={startEmail} onIssued={onIssued} onCancel={back} />
      ) : mode === 'existing' ? (
        <div className="space-y-2"><AddPerson organiser={organiser} /><button type="button" className={BTN} onClick={back} data-testid="mode-back">Back</button></div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={BTN_PRIMARY} disabled={actions.primaryDisabled !== null} onClick={() => setMode(PRIMARY_OPENS[actions.primary])} aria-describedby={actions.primaryDisabled ? noteId : undefined} data-testid="row-primary" data-kind={actions.primary}>{PRIMARY_LABEL[actions.primary]}</button>
            {actions.showWithdraw && <button type="button" className={BTN} disabled={actions.withdrawDisabled !== null || revoke.isPending} onClick={() => revoke.mutate()} aria-describedby={actions.withdrawDisabled ? noteId : undefined} data-testid="withdraw-invite">{revoke.isPending ? 'Withdrawing' : 'Withdraw'}</button>}
          </div>
          {actions.primaryDisabled && !loadError && <p id={noteId} className="text-xs text-muted-foreground" data-testid="primary-note">{actions.primaryDisabled}</p>}
        </>
      )}
      {(issued || held) && warn && <p role="alert" className="text-sm text-destructive" data-testid="link-close-warning">Copy the link first: it is shown once.</p>}
      {revoke.isError && <p role="alert" className="text-sm text-destructive" data-testid="invite-error">{adminErrorMessage(revoke.error)}</p>}
    </div>
  );
}

function AdminOrganisersBody() {
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [open, setOpen] = useState<string | null>(null);
  // One-time links by organiser id. Page state only: never the query cache, storage, a log or Sentry.
  const [issued, setIssued] = useState<Record<string, IssuedLinkView>>({});
  // The mode a row opens in: a link request's "Send a new link" opens the link form directly.
  const [startMode, setStartMode] = useState<RowMode>('idle');
  const [startEmail, setStartEmail] = useState('');
  const [warned, setWarned] = useState(false);
  // The row whose "Who is this for?" is showing its one-time link (held in that component, never here).
  const [held, setHeld] = useState<string | null>(null);
  const queryClient = useQueryClient();
  // Ownership changes behind the page's back (a link is redeemed elsewhere), so the open row re-reads it.
  const refreshOwnership = (id: string) => void queryClient.invalidateQueries({ queryKey: adminOwnershipQueryKey(id) });
  const toggleRow = (id: string) => {
    // A row holding an unseen link cannot be closed or left until the admin taps Done.
    if (open !== null && (issued[open] || held === open)) { setWarned(true); return; }
    setWarned(false);
    if (open !== id) refreshOwnership(id);
    setStartMode('idle');
    setStartEmail('');
    setOpen(open === id ? null : id);
  };
  /** From a link request: show that organiser's row with the link form open. */
  const sendNewLink = (o: { id: string; name: string; inviteEmail: string | null }) => {
    if (open !== null && (issued[open] || held === open)) { setWarned(true); return; }
    setWarned(false);
    setQuery(o.name);
    setLimit(PAGE_SIZE);
    refreshOwnership(o.id);
    setStartMode('link');
    setStartEmail(o.inviteEmail ?? '');
    setOpen(o.id);
  };
  const forget = (id: string) => { refreshOwnership(id); setWarned(false); setIssued((m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== id))); };
  const list = useQuery({ queryKey: ADMIN_ORGANISERS_KEY, queryFn: fetchAdminOrganisers, staleTime: 60_000 });
  const filtered = useMemo(() => {
    const all = list.data ?? [];
    const q = query.trim().toLowerCase();
    return q ? all.filter((o) => o.name.toLowerCase().includes(q)) : all;
  }, [list.data, query]);
  const visible = filtered.slice(0, limit);

  // Ownership is one tiny read per organiser. Invites are per organiser too and load for the
  // visible rows only (managed or not: an owned organiser can still hold a live link).
  const managed = useQueries({
    queries: visible.map((o) => ({ queryKey: adminOwnershipQueryKey(o.id), queryFn: () => fetchIsManaged(o.id), staleTime: 60_000 })),
  });
  const managedById = new Map(visible.map((o, i) => [o.id, managed[i]?.data] as const));
  const invitesQ = useQueries({
    queries: visible.map((o) => ({
      queryKey: adminInvitesQueryKey(o.id),
      queryFn: () => fetchOrganiserInvites(o.id),
      staleTime: 30_000,
    })),
  });
  const rows = visible.map((o, i) => {
    const isManaged = managedById.get(o.id);
    const invites = invitesQ[i]?.data ?? null;
    const status = isManaged === undefined ? null : accessStatus(isManaged, invites);
    const failed = managed[i]?.isError ? managed[i] : invitesQ[i]?.isError ? invitesQ[i] : null;
    return { organiser: o, status, invites: invites ?? [], fresh: !managed[i]?.isFetching, retry: failed ? () => void failed.refetch() : null };
  });
  const counts = new Map<AccessStatus, number>();
  for (const r of rows) if (r.status) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);

  return (
    <div className="mx-auto max-w-2xl space-y-3 px-3 pb-24 pt-3" data-testid="admin-organisers">
      <h1 className="text-lg font-semibold">Organiser access</h1>
      <FrontDoorEntry />
      <DuplicatesAlert />
      <InviteRequests onSendNewLink={sendNewLink} />
      <InvitePerson organisers={list.data ?? []} />
      <label className="relative block">
        <Search className="pointer-events-none absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE_SIZE); }} placeholder="Search organisers" aria-label="Search organisers" className="h-11 w-full rounded-lg border border-border bg-background pl-8 pr-2 text-sm" data-testid="admin-search" />
      </label>
      <div className="flex flex-wrap gap-1.5" data-testid="status-counts">
        {ACCESS_ORDER.map((s) => <span key={s} className="flex items-center gap-1 text-xs" data-testid={`count-${s}`}><StatusTag status={s} /> {counts.get(s) ?? 0}</span>)}
        <span className="text-xs text-muted-foreground">of the {rows.length} shown</span>
      </div>
      {list.isPending ? (
        <div className="space-y-2" data-testid="admin-loading">{[0, 1, 2, 3].map((k) => <Skeleton key={k} className="h-14 w-full rounded-lg" />)}</div>
      ) : list.isError ? (
        <div role="alert" className="space-y-2 rounded-lg border border-border p-3" data-testid="admin-load-error">
          <p className="text-sm">The organiser list did not load. Check your connection, then try again.</p>
          <button type="button" className={BTN} onClick={() => void list.refetch()}>Try again</button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-lg border border-border p-3 text-sm text-muted-foreground" data-testid="admin-empty">{query.trim() ? `No organiser matches “${query.trim()}”. Clear the search to see them all.` : 'There are no organisers yet.'}</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {rows.map(({ organiser, status, invites, fresh, retry }) => (
            <li key={organiser.id} data-testid="organiser-row" data-status={status ?? 'loading'}>
              <button type="button" className="flex min-h-[48px] w-full items-center justify-between gap-2 px-3 py-2 text-left" aria-expanded={open === organiser.id} onClick={() => toggleRow(organiser.id)}>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{organiser.name}</span>
                {lifecycleLabel(organiser.lifecycle) && <span data-testid="lifecycle-tag" className="rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">{lifecycleLabel(organiser.lifecycle)}</span>}
                <StatusTag status={status} />
              </button>
              {open === organiser.id && (
                <RowDetail
                  organiser={organiser} status={status} invites={invites} fresh={fresh}
                  key={`${organiser.id}-${startMode}-${startEmail}`}
                  issued={issued[organiser.id]} held={held === organiser.id} onHold={(h) => setHeld(h ? organiser.id : null)} warn={warned} startMode={startMode} startEmail={startEmail}
                  loadError={retry !== null} onRetry={() => retry?.()}
                  onIssued={(v) => setIssued((m) => ({ ...m, [organiser.id]: v }))}
                  onDone={() => forget(organiser.id)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {filtered.length > limit && <button type="button" className={`${BTN} w-full`} onClick={() => setLimit(limit + PAGE_SIZE)} data-testid="show-more">Show more ({filtered.length - limit} left)</button>}
    </div>
  );
}

function NotAvailable() {
  return (
    <div className="mx-auto max-w-md px-4 pt-16 text-center" data-testid="admin-not-available">
      <h1 className="text-lg font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">This page is not available.</p>
      <a href="/" className="mt-4 inline-block text-sm underline">Go to Bachata Calendar</a>
    </div>
  );
}

function AdminGate() {
  const admin = useIsAdmin();
  // Breadcrumbs only for a confirmed admin: for anyone else the layout must not name this page.
  if (admin.isAdmin) {
    return <GlobalLayout breadcrumbs={buildBreadcrumbs('admin.organisers')}><AdminOrganisersBody /></GlobalLayout>;
  }
  return (
    <GlobalLayout>
      {admin.isPending ? (
        <div className="mx-auto max-w-2xl space-y-2 px-3 pt-3" data-testid="admin-checking"><Skeleton className="h-8 w-48" /><Skeleton className="h-11 w-full" /></div>
      ) : admin.isError ? (
        <div role="alert" className="mx-auto max-w-md space-y-2 px-4 pt-16 text-center" data-testid="admin-check-error">
          <p className="text-sm">We could not check your access. Check your connection, then try again.</p>
          <button type="button" className={BTN} onClick={() => void admin.refetch()}>Try again</button>
        </div>
      ) : (
        <NotAvailable />
      )}
    </GlobalLayout>
  );
}

/** /admin/organisers. Signed out: sign in and return. Signed in, not an admin: a plain not-found that reveals nothing. */
export default function AdminOrganisersPage() {
  useNoindexMeta(true);
  return (
    <AuthGuard>
      <AdminGate />
    </AuthGuard>
  );
}
