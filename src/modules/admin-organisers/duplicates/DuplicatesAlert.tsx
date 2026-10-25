import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DUPLICATES_KEY, fetchDuplicates } from './duplicatesApi';
import { DUP_COPY, alertTitle, pairSentence, pausedSentence } from './duplicatesCopy';
import { DuplicateReview } from './DuplicateReview';
import type { DuplicatePair } from './duplicatesModel';

const BTN = 'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50';

/**
 * The admin-home alert: computed live from A2's check_invitee_duplicates_v1 each time the page opens
 * (paused not_linked joins included). Until A2 is applied the RPC is missing and it says
 * "available soon" with the reason, never a button that cannot work.
 */
export function DuplicatesAlert() {
  const q = useQuery({ queryKey: DUPLICATES_KEY, queryFn: fetchDuplicates, staleTime: 0, retry: false });
  // The pair under review is held itself, not looked up in the list: after Joined or Not the same
  // person the live re-check drops it, and the review must stay until the admin closes it.
  const [open, setOpen] = useState<DuplicatePair | null>(null);

  if (open) {
    return (
      <section className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3" data-testid="dup-alert">
        <DuplicateReview key={`${open.keepId}:${open.foldId}`} pair={open} onClose={() => setOpen(null)} />
      </section>
    );
  }
  if (q.isPending) return null;
  if (q.isError) {
    return (
      <div role="alert" className="space-y-2 rounded-lg border border-border p-3" data-testid="dup-load-error">
        <p className="text-sm">{DUP_COPY.loadFailed}</p>
        <button type="button" className={BTN} onClick={() => void q.refetch()} data-testid="dup-retry">{DUP_COPY.retry}</button>
      </div>
    );
  }
  if (q.data.kind === 'unavailable') {
    return (
      <div className="rounded-lg border border-border p-3" data-testid="dup-unavailable">
        <p className="text-sm font-medium">{DUP_COPY.unavailableTitle}</p>
        <p className="text-xs text-muted-foreground">{DUP_COPY.unavailable}</p>
      </div>
    );
  }
  const { pairs, notLinked } = q.data;
  // A paused join is counted (the admin should know) but is never a pair of its own.
  const total = pairs.length + notLinked.length;
  if (total === 0) return <p className="text-xs text-muted-foreground" data-testid="dup-none">{DUP_COPY.none}</p>;
  return (
    <section className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3" data-testid="dup-alert" aria-label={alertTitle(total)}>
      <p className="text-sm font-semibold" data-testid="dup-count">{alertTitle(total)}</p>
      <ul className="space-y-2">
        {pairs.map((p) => (
          <li key={`${p.keepId}:${p.foldId}`} className="flex items-start justify-between gap-2" data-testid="dup-pair" data-kind={p.kind}>
            <span className="min-w-0 text-sm">{pairSentence(p)}</span>
            <button type="button" className={`${BTN} shrink-0`} onClick={() => setOpen(p)} data-testid="dup-review">{DUP_COPY.review}</button>
          </li>
        ))}
        {notLinked.map((n) => (
          <li key={`nl:${n.inviteId}:${n.personProfileId ?? ''}`} className="flex items-start justify-between gap-2" data-testid="dup-paused">
            <span className="min-w-0 text-sm">{pausedSentence(n)}</span>
            {n.pair && <button type="button" className={`${BTN} shrink-0`} onClick={() => setOpen(n.pair)} data-testid="dup-paused-review">{DUP_COPY.review}</button>}
          </li>
        ))}
      </ul>
    </section>
  );
}
