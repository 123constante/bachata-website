import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, Plus } from 'lucide-react';
import { claimHint, searchClaimableOrganisers, type ClaimCandidate, type MyAccessRequest } from '@/modules/organiser-self-serve/selfServeApi';
import { declinedRequests } from '@/modules/organiser-self-serve/accessRequestModel';
import { Card, ErrorState, GhostButton, PrimaryButton, SearchField, SkeletonRows, StatusTag } from '../../ui';
import { HINT_TEXT, askedOn, rowAction } from './onboardingModel';
import { OrganiserSheet, type SheetTask } from './OrganiserSheet';

export interface OnboardingViewProps {
  user: { id: string; email: string | null };
  /** The session already proved the mailbox (a hint; the RPC decides). */
  mailboxProven: boolean;
  myOrganiserIds: ReadonlySet<string>;
  /** The user's own access requests (list_organiser_access_requests_v1 'mine'). */
  requests: readonly MyAccessRequest[];
  /** No organiser yet: show the steps. */
  firstRun: boolean;
  /** After a claim, request or create, with the line to confirm it. */
  onChanged: (confirmation: string) => void;
}

function useDebounced(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/**
 * Signed in, no organiser yet (or adding another): find the organiser we
 * probably already list and claim it or ask to join, or create a new one.
 * Requests waiting for an answer, and recent declines, show underneath.
 */
export function OnboardingView({ user, mailboxProven, myOrganiserIds, requests, firstRun, onChanged }: OnboardingViewProps) {
  const [query, setQuery] = useState('');
  const term = useDebounced(query, 250);
  const searched = term.trim().length >= 2;
  const [task, setTask] = useState<SheetTask | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const doneRef = useRef<HTMLParagraphElement>(null);

  const search = useQuery({
    queryKey: ['claimable-organisers', term],
    queryFn: () => searchClaimableOrganisers(term),
    enabled: searched,
    staleTime: 60_000,
  });
  const results = useMemo(() => search.data ?? [], [search.data]);

  const open = useMemo(() => requests.filter((r) => r.status === 'open'), [requests]);
  const requestedIds = useMemo(() => new Set(open.map((r) => r.organiserId)), [open]);
  const declined = useMemo(() => declinedRequests(requests), [requests]);
  const rows = useMemo(
    () =>
      results.map((org) => {
        const hint = claimHint(org, { id: user.id, email: user.email }, myOrganiserIds);
        return { org, hint, action: rowAction(hint, requestedIds.has(org.id)) };
      }),
    [results, user, myOrganiserIds, requestedIds],
  );

  useEffect(() => {
    if (done) doneRef.current?.focus({ preventScroll: false });
  }, [done]);

  const finish = (confirmation: string) => {
    setTask(null);
    setDone(confirmation);
    onChanged(confirmation);
  };

  const startClaim = (org: ClaimCandidate) => setTask({ kind: 'claim', org });
  const startRequest = (org: ClaimCandidate) => setTask({ kind: 'request', org });
  const startCreate = () => setTask({ kind: 'create', name: query.trim() });
  const searchFailed = searched && !search.isFetching && !search.data && (search.isError || search.isPaused);

  return (
    <div className="space-y-4" data-testid="org-onboarding">
      {firstRun && (
        <ol className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--mut)]" aria-label="Steps">
          <li className="flex items-center gap-1 text-[var(--gold)]">
            <Check aria-hidden="true" className="h-4 w-4" /> Signed in
          </li>
          <li aria-hidden="true">&rsaquo;</li>
          <li className="font-semibold text-[var(--fg)]" aria-current="step">Your organiser</li>
          <li aria-hidden="true">&rsaquo;</li>
          <li>Your events</li>
        </ol>
      )}

      {done && (
        <p ref={doneRef} tabIndex={-1} role="status" data-testid="onboarding-done" className="flex items-start gap-2 rounded-[12px] bg-[var(--ok-bg)] px-4 py-3 text-[14px] text-[var(--ok-fg)] outline-none">
          <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /> {done}
        </p>
      )}

      <div>
        <h2 className="text-[20px] font-bold text-[var(--fg)]">{firstRun ? 'Which organiser are you?' : 'Add another organiser'}</h2>
        <p className="mt-1 text-[14px] text-[var(--mut)]">
          We&rsquo;ve probably listed you already. Find your name, or create a new organiser.
        </p>
      </div>

      <SearchField value={query} onChange={setQuery} aria-label="Search organisers by name" placeholder="Search organisers by name" testId="onboarding-search" />

      <p className="sr-only" role="status" data-testid="onboarding-search-status">
        {searched && search.data ? (results.length === 1 ? '1 organiser found' : `${results.length} organisers found`) : ''}
      </p>

      {searched && search.isFetching && !search.data && <SkeletonRows count={3} label="Searching organisers" testId="onboarding-searching" />}

      {searchFailed && (
        <ErrorState
          title={search.isPaused ? <>You&rsquo;re offline</> : 'The search did not work'}
          body="We cannot tell if this organiser is listed until the search works. Check your connection, then try again."
          onRetry={() => void search.refetch()}
          retrying={search.isFetching}
          testId="onboarding-search-error"
        />
      )}

      {searched && search.data && results.length === 0 && (
        <p className="text-[14px] text-[var(--mut)]" data-testid="onboarding-no-match">
          No organiser matches &ldquo;{term.trim()}&rdquo;. Check the spelling, or{' '}
          <button type="button" onClick={startCreate} className="font-semibold text-[var(--gold)] underline underline-offset-2" data-testid="onboarding-create-from-search">
            create it as a new organiser
          </button>
          .
        </p>
      )}

      {rows.length > 0 && (
        <Card testId="onboarding-results">
          {rows.map(({ org, hint, action }) => (
            <div key={org.id} className="flex items-center gap-3 px-4 py-3" data-testid="onboarding-result" data-org={org.id}>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 break-words text-[15px] font-semibold text-[var(--fg)]">{org.name}</p>
                <p className="text-[13px] text-[var(--mut)]" data-testid="onboarding-hint">{HINT_TEXT[hint]}</p>
              </div>
              {action === 'claim' && (
                <GhostButton size="sm" block={false} onClick={() => startClaim(org)} testId="onboarding-claim">
                  Claim
                </GhostButton>
              )}
              {action === 'request' && (
                <GhostButton size="sm" block={false} onClick={() => startRequest(org)} testId="onboarding-request">
                  Ask to join
                </GhostButton>
              )}
              {action === 'requested' && <StatusTag tone="neutral" testId="onboarding-requested">Asked</StatusTag>}
            </div>
          ))}
        </Card>
      )}

      <PrimaryButton onClick={startCreate} testId="onboarding-create">
        <Plus aria-hidden="true" className="h-5 w-5" /> Create a new organiser
      </PrimaryButton>
      <p className="-mt-2 text-center text-[13px] text-[var(--mut)]">Name and city. The team checks new organisers within a day.</p>

      {open.length > 0 && (
        <Card label="Waiting for an answer" testId="onboarding-pending">
          {open.map((r) => (
            <div key={r.requestId} className="flex items-center gap-3 px-4 py-3" data-testid="onboarding-pending-row">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] text-[var(--fg)]">{r.organiserName ?? 'An organiser'}</p>
                <p className="text-[13px] text-[var(--mut)]">Asked {askedOn(r.createdAt)}. The team usually replies within a day.</p>
              </div>
              <StatusTag tone="draft">Waiting</StatusTag>
            </div>
          ))}
        </Card>
      )}

      {declined.length > 0 && (
        <Card label="Request declined" testId="onboarding-declined">
          {declined.map((r) => (
            <div key={r.requestId} className="px-4 py-3" data-testid="onboarding-declined-row">
              <p className="text-[15px] text-[var(--fg)]">
                {r.organiserName ?? 'An organiser'} said no on {askedOn(r.resolvedAt ?? r.createdAt)}.
              </p>
              <p className="text-[13px] text-[var(--mut)]">
                The reason is not shown here yet. If you are the organiser, search for it above and ask again with a note.
              </p>
            </div>
          ))}
        </Card>
      )}

      {firstRun && (
        <Link to="/" className="flex min-h-[44px] items-center justify-center text-[15px] font-semibold text-[var(--gold)]" data-testid="onboarding-browse">
          Just here to dance? Browse events
        </Link>
      )}

      <OrganiserSheet
        task={task}
        onTaskChange={setTask}
        email={user.email ?? ''}
        mailboxProven={mailboxProven}
        onDone={finish}
      />
    </div>
  );
}
