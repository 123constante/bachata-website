import { useMemo, useState } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, MessageCircle, Search, UserPlus } from 'lucide-react';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Skeleton } from '@/components/ui/skeleton';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { useNoindexMeta } from '@/hooks/useNoindexMeta';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { instantDateLabel } from '@/modules/organiser/shared/teamModel';
import {
  ADMIN_ORGANISERS_KEY,
  addOrganiserPerson,
  adminInvitesQueryKey,
  adminOwnershipQueryKey,
  fetchAdminOrganisers,
  fetchIsManaged,
  fetchOrganiserInvites,
  issueOrganiserInvite,
  revokeOrganiserInvite,
  type AdminOrganiser,
} from './adminApi';
import {
  ACCESS_LABEL,
  lifecycleLabel,
  notLiveNote,
  ACCESS_ORDER,
  MEMBER_ROLES,
  MEMBER_ROLE_LABEL,
  accessStatus,
  adminErrorMessage,
  inviteUrl,
  rowActions,
  statusDetail,
  whatsappHref,
  type AccessStatus,
  type InviteRow,
  type MemberRole,
} from './inviteModel';

import { InvitePerson } from './InvitePerson';
import { isPlausibleEmail } from '@/modules/organiser/shared/emailShape';

const PAGE_SIZE = 20;
const BTN = 'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50';
const BTN_PRIMARY = 'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50';
const TONE: Record<AccessStatus, string> = {
  unclaimed: 'bg-muted text-muted-foreground',
  invited: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  invite_expired: 'bg-red-500/15 text-destructive',
  managed: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
};

/** The one place a status is drawn: the list, the row and the counts all use it. */
export function StatusTag({ status }: { status: AccessStatus | null }) {
  if (status === null) return <span data-testid="status-tag" data-status="loading" className="rounded px-1.5 py-0.5 text-xs text-muted-foreground">&hellip;</span>;
  return <span data-testid="status-tag" data-status={status} className={`rounded px-1.5 py-0.5 text-xs font-medium ${TONE[status]}`}>{ACCESS_LABEL[status]}</span>;
}

/** The link, shown once. Held in component state only: never in the query cache, storage or a log. */
function OneTimeLink({ organiser, link, onDone }: { organiser: string; link: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div data-testid="one-time-link" className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
      <p className="text-sm font-medium">Link for {organiser}</p>
      <input readOnly value={link} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} className="w-full rounded border border-border bg-background px-2 py-2 text-xs" data-testid="link-field" />
      <p className="text-xs text-muted-foreground" data-testid="link-once-note">This is the only time the link is shown. Once you tap Done it is gone and cannot be looked up again; generate a new one if you need it. It works once and runs out in 7 days.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={BTN} onClick={copy} data-testid="copy-link"><Copy className="h-4 w-4" aria-hidden="true" /> {copied ? 'Copied' : 'Copy'}</button>
        <a className={BTN} href={whatsappHref(organiser, link)} target="_blank" rel="noopener noreferrer" data-testid="whatsapp-link"><MessageCircle className="h-4 w-4" aria-hidden="true" /> WhatsApp message</a>
        <button type="button" className={BTN_PRIMARY} onClick={onDone} data-testid="link-done">Done</button>
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

function RowDetail({ organiser, status, invites, fresh, issued, warn, loadError, onIssued, onDone, onRetry }: {
  organiser: AdminOrganiser; status: AccessStatus | null; invites: readonly InviteRow[]; fresh: boolean;
  issued: string | undefined; warn: boolean; loadError: boolean;
  onIssued: (link: string) => void; onDone: () => void; onRetry: () => void;
}) {
  const queryClient = useQueryClient();
  const actions = rowActions(status, invites);
  const [confirming, setConfirming] = useState(false);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: adminInvitesQueryKey(organiser.id) });
    void queryClient.invalidateQueries({ queryKey: adminOwnershipQueryKey(organiser.id) });
  };
  const generate = useMutation({
    mutationFn: () => issueOrganiserInvite(organiser.id),
    onSuccess: (r) => { onIssued(inviteUrl(window.location.origin, r.token)); setConfirming(false); refresh(); },
  });
  const revoke = useMutation({ mutationFn: () => revokeOrganiserInvite(organiser.id), onSuccess: refresh });
  const detail = statusDetail(status, invites, (iso) => instantDateLabel(iso) ?? iso, fresh);
  const notLive = notLiveNote(organiser.lifecycle);
  const busy = generate.isPending || revoke.isPending;
  const err = generate.isError ? generate.error : revoke.isError ? revoke.error : null;
  return (
    <div data-testid="row-detail" className="space-y-2 border-t border-border bg-muted/30 p-3">
      {(detail || notLive) && <p className="text-sm text-muted-foreground" data-testid="status-detail">{[detail, notLive].filter(Boolean).join(' ')}</p>}
      {loadError && (
        <div role="alert" id={`row-error-${organiser.id}`} className="space-y-2" data-testid="row-load-error">
          <p className="text-sm text-destructive">Could not load this organiser&rsquo;s invite status. Generate and Revoke stay off until it loads.</p>
          <button type="button" className={BTN} onClick={onRetry} data-testid="row-retry">Retry</button>
        </div>
      )}
      {issued ? (
        <OneTimeLink organiser={organiser.name} link={issued} onDone={onDone} />
      ) : confirming ? (
        <div role="alertdialog" aria-label="Replace the live link?" data-testid="replace-confirm" className="space-y-2">
          <p className="text-sm">{organiser.name} already has a live link. A new one replaces it, so the old one stops working.</p>
          <div className="flex gap-2">
            <button type="button" className={BTN} onClick={() => setConfirming(false)} data-testid="replace-no">Keep the old link</button>
            <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={() => generate.mutate()} data-testid="replace-yes">{generate.isPending ? 'Generating' : 'Replace it'}</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={BTN_PRIMARY} disabled={!actions.canGenerate || busy} onClick={() => (actions.generateConfirms ? setConfirming(true) : generate.mutate())} aria-describedby={loadError ? `row-error-${organiser.id}` : actions.generateNote ? `gen-note-${organiser.id}` : undefined} data-testid="generate-invite">{generate.isPending ? 'Generating' : 'Generate invite'}</button>
          <button type="button" className={BTN} disabled={!actions.canRevoke || busy} onClick={() => revoke.mutate()} aria-describedby={loadError ? `row-error-${organiser.id}` : actions.revokeNote ? `rev-note-${organiser.id}` : undefined} data-testid="revoke-invite">{revoke.isPending ? 'Revoking' : 'Revoke'}</button>
        </div>
      )}
      {!issued && !confirming && !loadError && actions.generateNote && <p id={`gen-note-${organiser.id}`} className="text-xs text-muted-foreground" data-testid="generate-note">{actions.generateNote}</p>}
      {!issued && !confirming && !loadError && actions.revokeNote && <p id={`rev-note-${organiser.id}`} className="text-xs text-muted-foreground" data-testid="revoke-note">{actions.revokeNote}</p>}
      {issued && warn && <p role="alert" className="text-sm text-destructive" data-testid="link-close-warning">Copy the link first: it is shown once.</p>}
      {err != null && <p role="alert" className="text-sm text-destructive" data-testid="invite-error">{adminErrorMessage(err)}</p>}
      {actions.canAddPerson && <AddPerson organiser={organiser} />}
    </div>
  );
}

function AdminOrganisersBody() {
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [open, setOpen] = useState<string | null>(null);
  // One-time links by organiser id. Page state only: never the query cache, storage, a log or Sentry.
  const [issued, setIssued] = useState<Record<string, string>>({});
  const [warned, setWarned] = useState(false);
  const queryClient = useQueryClient();
  // Ownership changes behind the page's back (a link is redeemed elsewhere), so the open row re-reads it.
  const refreshOwnership = (id: string) => void queryClient.invalidateQueries({ queryKey: adminOwnershipQueryKey(id) });
  const toggleRow = (id: string) => {
    // A row holding an unseen link cannot be closed or left until the admin taps Done.
    if (open !== null && issued[open]) { setWarned(true); return; }
    setWarned(false);
    if (open !== id) refreshOwnership(id);
    setOpen(open === id ? null : id);
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
                  issued={issued[organiser.id]} warn={warned}
                  loadError={retry !== null} onRetry={() => retry?.()}
                  onIssued={(link) => setIssued((m) => ({ ...m, [organiser.id]: link }))}
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
