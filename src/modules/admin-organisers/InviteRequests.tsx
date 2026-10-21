import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { instantDateLabel } from '@/modules/organiser/shared/teamModel';
import {
  ACCESS_REQUESTS_KEY,
  INVITE_REQUESTS_KEY,
  fetchAccessRequests,
  fetchInviteRequests,
  resolveAccessRequest,
  resolveInviteRequest,
} from './adminApi';
import { adminErrorMessage } from './inviteModel';
import {
  ACCESS_REQUESTS_EMPTY,
  ACCESS_STATUS_LABEL,
  APPROVE_NOTE,
  LINK_REQUESTS_EMPTY,
  orderAccessRequests,
  pendingInviteRequests,
  resolveRefusalMessage,
  type ResolveOutcome,
} from './senderModel';

const BTN = 'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50';
const BTN_PRIMARY = 'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50';
const when = (iso: string | null) => (iso ? instantDateLabel(iso) ?? iso : null);

/** One collapsible list: a header with its waiting count, then the body. */
function Section({ title, count, testId, children }: { title: string; count: number | null; testId: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="overflow-hidden rounded-lg border border-border" data-testid={testId}>
      <button type="button" className="flex min-h-[48px] w-full items-center justify-between gap-2 px-3 py-2 text-left" aria-expanded={open} onClick={() => setOpen(!open)} data-testid={`${testId}-toggle`}>
        <span className="text-sm font-medium">{title}</span>
        <span className="flex items-center gap-1.5">
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${count ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-muted text-muted-foreground'}`} data-testid={`${testId}-count`}>{count === null ? '\u2026' : count}</span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </span>
      </button>
      {open && <div className="space-y-2 border-t border-border p-3">{children}</div>}
    </section>
  );
}

function LoadFailed({ onRetry, testId }: { onRetry: () => void; testId: string }) {
  return (
    <div role="alert" className="space-y-2" data-testid={testId}>
      <p className="text-sm">This list did not load. Check your connection, then try again.</p>
      <button type="button" className={BTN} onClick={onRetry}>Try again</button>
    </div>
  );
}

/** A resolve answer: ok, or a refusal shown in words (the list is re-read either way). */
function useResolve<A>(fn: (a: A) => Promise<ResolveOutcome>, key: readonly string[]) {
  const queryClient = useQueryClient();
  const [refused, setRefused] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: fn,
    onMutate: () => setRefused(null),
    onSuccess: (out) => { if (out.ok === false) setRefused(resolveRefusalMessage(out.reason)); },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: key }),
  });
  return { m, refused };
}

/** "Request a new link" taps on broken links. Send a new link opens that organiser's link form. */
function LinkRequests({ onSendNewLink }: { onSendNewLink: (o: { id: string; name: string }) => void }) {
  const q = useQuery({ queryKey: INVITE_REQUESTS_KEY, queryFn: fetchInviteRequests, staleTime: 30_000 });
  const { m, refused } = useResolve((id: string) => resolveInviteRequest(id), INVITE_REQUESTS_KEY);
  const rows = q.data ? pendingInviteRequests(q.data) : null;
  return (
    <Section title="New link requests" count={rows ? rows.length : null} testId="link-requests">
      {q.isError ? <LoadFailed onRetry={() => void q.refetch()} testId="link-requests-error" />
        : rows === null ? <p className="text-sm text-muted-foreground">Loading&hellip;</p>
        : rows.length === 0 ? <p className="text-sm text-muted-foreground" data-testid="link-requests-empty">{LINK_REQUESTS_EMPTY}</p>
        : (
          <ul className="divide-y divide-border" data-testid="link-requests-list">
            {rows.map((r) => (
              <li key={r.id} className="space-y-2 py-2" data-testid="link-request-row">
                <p className="text-sm font-medium">{r.organiserName}</p>
                <p className="text-xs text-muted-foreground">{[r.inviteEmail ?? 'Link had no email', when(r.requestedAt) && `asked ${when(r.requestedAt)}`].filter(Boolean).join(' \u00b7 ')}</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={BTN_PRIMARY} onClick={() => onSendNewLink({ id: r.organiserId, name: r.organiserName })} data-testid="link-request-send">Send a new link</button>
                  <button type="button" className={BTN} disabled={m.isPending} onClick={() => m.mutate(r.id)} data-testid="link-request-done">Mark done</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      {refused && <p role="alert" className="text-sm text-destructive" data-testid="link-requests-refused">{refused}</p>}
      {m.isError && <p role="alert" className="text-sm text-destructive" data-testid="link-requests-write-error">{adminErrorMessage(m.error)}</p>}
    </Section>
  );
}

/** "Request access" from the invite-only sign-up wall. Approve allow-lists the email. */
function AccessRequests() {
  const q = useQuery({ queryKey: ACCESS_REQUESTS_KEY, queryFn: fetchAccessRequests, staleTime: 30_000 });
  const { m, refused } = useResolve((a: { id: string; action: 'approve' | 'dismiss' }) => resolveAccessRequest(a.id, a.action), ACCESS_REQUESTS_KEY);
  const rows = q.data ? orderAccessRequests(q.data) : null;
  const waiting = rows ? rows.filter((r) => r.status === 'pending').length : null;
  return (
    <Section title="Access requests" count={waiting} testId="access-requests">
      {q.isError ? <LoadFailed onRetry={() => void q.refetch()} testId="access-requests-error" />
        : rows === null ? <p className="text-sm text-muted-foreground">Loading&hellip;</p>
        : rows.length === 0 ? <p className="text-sm text-muted-foreground" data-testid="access-requests-empty">{ACCESS_REQUESTS_EMPTY}</p>
        : (
          <>
            {waiting ? <p className="text-xs text-muted-foreground" data-testid="approve-note">{APPROVE_NOTE}</p> : null}
            <ul className="divide-y divide-border" data-testid="access-requests-list">
              {rows.map((r) => (
                <li key={r.id} className="space-y-1.5 py-2" data-testid="access-request-row" data-status={r.status}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-medium">{r.email}</span>
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{ACCESS_STATUS_LABEL[r.status]}</span>
                  </div>
                  {r.note && <p className="text-sm" data-testid="access-request-note">{r.note}</p>}
                  {when(r.requestedAt) && <p className="text-xs text-muted-foreground">Asked {when(r.requestedAt)}</p>}
                  {r.status === 'pending' && (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={BTN_PRIMARY} disabled={m.isPending} onClick={() => m.mutate({ id: r.id, action: 'approve' })} data-testid="access-approve">Approve</button>
                      <button type="button" className={BTN} disabled={m.isPending} onClick={() => m.mutate({ id: r.id, action: 'dismiss' })} data-testid="access-dismiss">Dismiss</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      {refused && <p role="alert" className="text-sm text-destructive" data-testid="access-requests-refused">{refused}</p>}
      {m.isError && <p role="alert" className="text-sm text-destructive" data-testid="access-requests-write-error">{adminErrorMessage(m.error)}</p>}
    </Section>
  );
}

/** Both admin request lists, on /admin/organisers above the organiser list. */
export function InviteRequests({ onSendNewLink }: { onSendNewLink: (o: { id: string; name: string }) => void }) {
  return (
    <div className="space-y-2" data-testid="invite-requests">
      <LinkRequests onSendNewLink={onSendNewLink} />
      <AccessRequests />
    </div>
  );
}
