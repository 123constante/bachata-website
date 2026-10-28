import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ProfileGateContext } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { Check, Plus } from 'lucide-react';
import { searchClaimableOrganisers, type ClaimCandidate, type MyAccessRequest } from '@/modules/organiser/shared/selfServeApi';
import type { ClaimHint } from '@/modules/organiser/shared/claimHint';
import { declinedRequests } from '@/modules/organiser/shared/accessRequestModel';
import { Card, ErrorState, GhostButton, PrimaryButton, SearchField, SheetLookProvider, SkeletonRows, useDebounced, type SheetLook } from '../../ui';
import { askedOn, rowAction } from './onboardingModel';
import { askedToJoinDone, hintRowText } from './claimStates';
import { useOrgSurface } from '../../shell/surface';
import { goDone } from '../../flows/doneState';
import { OrganiserSheet, type DoorTask, type SheetTask } from './OrganiserSheet';
import { tapGate } from './profileGate';
import { SignOutLine } from './SignOutLine';
import { BETA_NOTE } from '../../flows/newpage/cannotCreate';

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
  /**
   * The area's look; defaults to the surface's (R1 at /account/o). P3 (W4b) paints the sheets in
   * P3's tokens, checks an unfinished profile at the tap (owner pick no-city B), and lands a claim
   * on P3 Home with its confirmation.
   */
  look?: SheetLook;
}


/**
 * Signed in, no organiser yet (or adding another): find the organiser we
 * probably already list and claim it or ask to join, or create a new one.
 * Requests waiting for an answer, and recent declines, show underneath.
 */
export function OnboardingView({ user, mailboxProven, myOrganiserIds, requests, firstRun, onChanged, look: lookProp }: OnboardingViewProps) {
  const surface = useOrgSurface();
  const look = lookProp ?? surface.kind;
  const p3 = look === 'p3';
  const profileGate = useContext(ProfileGateContext);
  const { pathname, search: here } = useLocation();
  const [query, setQuery] = useState('');
  const term = useDebounced(query, 250);
  const searched = term.trim().length >= 2;
  const [task, setTask] = useState<SheetTask | null>(null);
  // P3: an unfinished profile hears it at the tap, before any typing; nothing is sent.
  const openTask = (next: DoorTask) => {
    const gate = p3 && next.kind !== 'yours' ? tapGate(profileGate) : { kind: 'open' as const };
    if (gate.kind === 'open' || !profileGate || profileGate === 'loading') {
      setTask(next);
      return;
    }
    const finishLabel = profileGate.gateFor(`${pathname}${here}`).linkLabel;
    setTask({ kind: 'gate', gate: gate.kind, missing: gate.kind === 'finish' ? gate.missing : [], finishLabel, then: next });
  };
  const [done, setDone] = useState<string | null>(null);
  const navigate = useNavigate();
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
        // The database's hint decides; the home list only covers a failed hint call.
        const hint = org.hint ?? (myOrganiserIds.has(org.id) ? 'yours' : null);
        return { org, hint, action: rowAction(hint, requestedIds.has(org.id)) };
      }),
    [results, myOrganiserIds, requestedIds],
  );

  useEffect(() => {
    if (done) doneRef.current?.focus({ preventScroll: p3 });
  }, [done, p3]);

  const finish = (confirmation: string) => {
    setTask(null);
    setDone(confirmation);
    onChanged(confirmation);
    // R1's Home swaps itself in when the home read sees the page; P3's Welcome is its own route.
    if (p3) navigate(surface.paths.home, { state: { confirmation } });
  };
  // Ask to join ends on the shared Done screen (D29); a new page lands on Home (C1b).
  const requested = (org: ClaimCandidate) => {
    const done = askedToJoinDone(org.name);
    setTask(null);
    onChanged(done.title);
    // P3: its own Done, whose first button comes back to this Welcome.
    if (p3) goDone(navigate, { ...done, seriesId: null }, `${pathname}${here}`, surface.paths.done);
    else goDone(navigate, { ...done, seriesId: null });
  };
  const created = (page: { name: string }) => {
    setTask(null);
    const confirmation = `${page.name} created`;
    onChanged(confirmation);
    navigate(surface.paths.home, p3 ? { state: { confirmation } } : undefined);
  };
  const findPage = (name: string) => {
    setTask(null);
    setQuery(name);
  };

  // Every row opens its claim screen (6a-6e) in the sheet; the sheet's buttons act.
  const startClaim = (org: ClaimCandidate) => openTask({ kind: 'claim', org });
  const startRequest = (org: ClaimCandidate, hint: ClaimHint | null) => openTask({ kind: 'request', org, hint });
  const openYours = (org: ClaimCandidate) => openTask({ kind: 'yours', org });
  const startCreate = () => openTask({ kind: 'create', name: query.trim() });
  const searchFailed = searched && !search.isFetching && !search.data && (search.isError || search.isPaused);

  return (
    <SheetLookProvider value={look}>
    <div className={p3 ? 'p3-onb space-y-[16px]' : 'space-y-[16px]'} data-testid="org-onboarding" data-look={look}>
      {firstRun && (
        <ol className="flex flex-wrap items-center gap-[8px] text-[13px] text-[var(--mut)]" aria-label="Steps">
          <li className="flex items-center gap-[4px] text-[var(--gold)]">
            <Check aria-hidden="true" className="h-[16px] w-[16px]" /> Signed in
          </li>
          <li aria-hidden="true">&rsaquo;</li>
          <li className="font-semibold text-[var(--fg)]" aria-current="step">Your organiser</li>
          <li aria-hidden="true">&rsaquo;</li>
          <li>Your events</li>
        </ol>
      )}

      <SignOutLine email={user.email} />

      {done && (
        <p ref={doneRef} tabIndex={-1} role="status" data-testid="onboarding-done" className="flex items-start gap-[8px] rounded-[12px] bg-[var(--ok-bg)] px-[16px] py-[12px] text-[14px] text-[var(--ok-fg)] outline-none">
          <Check aria-hidden="true" className="mt-[2px] h-[16px] w-[16px] shrink-0" /> {done}
        </p>
      )}

      <div>
        <h2 className="text-[20px] font-bold text-[var(--fg)]">{firstRun ? 'Find your page' : 'Add another page'}</h2>
        {/* W2 walk fix 8: the beta up front, before any name or city. */}
        <p className="mt-[4px] text-[13px] text-[var(--mut)]" data-testid="onboarding-beta-note">{BETA_NOTE}</p>
      </div>

      <SearchField value={query} onChange={setQuery} aria-label="Search pages by name" placeholder="Search pages by name" testId="onboarding-search" />

      <p className="sr-only" role="status" data-testid="onboarding-search-status">
        {searched && search.data ? (results.length === 1 ? '1 organiser found' : `${results.length} organisers found`) : ''}
      </p>

      {searched && search.isFetching && !search.data && <SkeletonRows count={3} label="Searching organisers" testId="onboarding-searching" />}

      {searchFailed && (
        <ErrorState
          quiet
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
            <div key={org.id} className="flex items-center gap-[12px] px-[16px] py-[12px]" data-testid="onboarding-result" data-org={org.id}>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 break-words text-[15px] font-semibold text-[var(--fg)]">{org.name}</p>
                <p className="text-[13px] text-[var(--mut)]" data-testid="onboarding-hint">{hintRowText(hint)}</p>
              </div>
              {action === 'claim' && (
                <GhostButton size="sm" block={false} onClick={() => startClaim(org)} testId="onboarding-claim">
                  Claim
                </GhostButton>
              )}
              {action === 'request' && (
                <GhostButton size="sm" block={false} onClick={() => startRequest(org, hint)} testId="onboarding-request">
                  Ask to join
                </GhostButton>
              )}
              {action === 'home' && (
                <GhostButton size="sm" block={false} onClick={() => openYours(org)} testId="onboarding-home">
                  Home
                </GhostButton>
              )}
              {action === 'requested' && <span className="shrink-0 text-[13px] text-[var(--mut)]" data-testid="onboarding-requested">Asked</span>}
            </div>
          ))}
        </Card>
      )}

      <PrimaryButton onClick={startCreate} testId="onboarding-create">
        <Plus aria-hidden="true" className="h-[20px] w-[20px]" /> Create a new page
      </PrimaryButton>

      {open.length > 0 && (
        <Card label="Waiting for an answer" testId="onboarding-pending">
          {open.map((r) => (
            <div key={r.requestId} className="flex items-center gap-[12px] px-[16px] py-[12px]" data-testid="onboarding-pending-row">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] text-[var(--fg)]">{r.organiserName ?? 'An organiser'}</p>
                <p className="text-[13px] text-[var(--mut)]">Asked {askedOn(r.createdAt)}</p>
              </div>
            </div>
          ))}
        </Card>
      )}

      {declined.length > 0 && (
        <Card label="Request declined" testId="onboarding-declined">
          {declined.map((r) => (
            <div key={r.requestId} className="px-[16px] py-[12px]" data-testid="onboarding-declined-row">
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
        userId={user.id}
        mailboxProven={mailboxProven}
        onClaimed={finish}
        onRequested={requested}
        onCreated={created}
        onFindPage={findPage}
        onHome={() => navigate(surface.paths.home)}
      />
    </div>
    </SheetLookProvider>
  );
}
