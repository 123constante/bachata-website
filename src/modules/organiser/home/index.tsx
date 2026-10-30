import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Plus } from 'lucide-react';
import { useId } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ORGANISER_HOME_KEY, incomingAccessRequestsQueryKey, myAccessRequestsQueryKey } from '@/modules/organiser/shared/selfServeApi';
import { isMailboxProvenToken } from '@/modules/organiser/shared/sessionProof';
import { supportLinks } from '@/modules/organiser/shared/support';
import type { Job } from '@/modules/organiser/jobs/homeJobs';
import { cn } from '@/lib/utils';
import { flags } from '@/lib/featureFlags';
import { organiserHomeHandoff } from '@/lib/auth-otp-routing';
import { OrganiserShell, ORG_PATHS } from '../shell';
import { ErrorState, GhostButton, PrimaryButton, SkeletonRows, useAnnounce } from '../ui';
import { SMALL_BUTTONS, TODO_EMPTY, TODO_HEADING, isFirstSteps, newEventBlock } from './homeView';
import { useHomeData } from './useHomeData';
import { OnboardingView } from './onboarding/OnboardingView';
import { ProfileButton } from './ProfileButton';
import { ClaimNotice } from './ClaimNotice';

const BADGE: Record<Job['tone'], string> = {
  gold: 'bg-[var(--gold)] text-[var(--btnfg)]',
  plain: 'bg-[var(--card2)] text-[var(--fg)]',
  problem: 'bg-[var(--warn-bg)] text-[var(--warn-fg)]',
};

/** One numbered job (D37): a button, never a link styled as text; the tap goes into the job. */
function JobRow({ job }: { job: Job }) {
  const navigate = useNavigate();
  return (
    <li>
      <button
        type="button"
        onClick={() => navigate(job.to)}
        data-testid="home-job"
        data-kind={job.kind}
        data-tone={job.tone}
        className="flex min-h-[56px] w-full items-center gap-[12px] border-b border-[var(--line)] px-[16px] py-[8px] text-left"
      >
        <span
          data-testid="home-job-n"
          aria-hidden="true"
          className={cn('flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full text-[15px] font-bold', BADGE[job.tone])}
        >
          {job.n}
        </span>
        <span className="min-w-0 flex-1">
          <span data-testid="home-job-title" className="line-clamp-2 break-words text-[16px] font-semibold leading-[20px] text-[var(--fg)]">{job.title}</span>
          {job.sub && <span data-testid="home-job-sub" className="block truncate text-[13px] text-[var(--warn-fg)]">{job.sub}</span>}
        </span>
      </button>
    </li>
  );
}

/** `pageId`: the page on screen when the login has two or more (New event then keeps it in ?o=). */
function NewEventButton({ block, pageId }: { block: string | null; pageId: string | null }) {
  const navigate = useNavigate();
  const reasonId = useId();
  return (
    <div className="space-y-[8px]">
      <PrimaryButton
        onClick={() => navigate(ORG_PATHS.newWhatFor(pageId))}
        disabled={!!block}
        aria-describedby={block ? reasonId : undefined}
        className="bg-[var(--gold)] text-[var(--btnfg)]"
        testId="home-new-event"
      >
        <Plus aria-hidden="true" className="h-[20px] w-[20px]" /> New event
      </PrimaryButton>
      {block && <p id={reasonId} className="text-[13px] text-[var(--mut)]" data-testid="home-new-event-reason">{block}</p>}
    </div>
  );
}

/** Support rows (D7) on the first-steps page; a row whose value is not set is not drawn. */
function SupportRows() {
  const { whatsapp, email } = supportLinks();
  if (!whatsapp && !email) return null;
  const row = 'flex min-h-[44px] items-center justify-center rounded-[12px] bg-[var(--card2)] px-[12px] text-[15px] font-semibold text-[var(--fg)]';
  return (
    <div className="grid grid-cols-2 gap-[8px]" data-testid="home-support">
      {whatsapp && <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={row} data-testid="home-support-whatsapp">WhatsApp us</a>}
      {email && <a href={`mailto:${email}`} className={row} data-testid="home-support-email">Email us</a>}
    </div>
  );
}

/**
 * /account/o -- Home under rule 2 (C1 running page, C1b brand-new page). With
 * no organiser yet it is the onboarding (S9's). Otherwise: the page name (a
 * link to Switch with 2+ pages), the numbered jobs from homeJobs() in its
 * order, gold New event, then Team - My page, My events - More. No section
 * labels (D22), no sentences (D28), no Tonight card (D37).
 */
export default function HomePage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [message, announce] = useAnnounce();
  const { user, home, organisers, selected, jobs, mine } = useHomeData();
  const adding = params.get('add') === '1';

  const onChanged = (confirmation: string) => {
    announce(confirmation);
    if (adding) setParams({}, { replace: true });
    void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
    void queryClient.invalidateQueries({ queryKey: myAccessRequestsQueryKey(user?.id) });
    void queryClient.invalidateQueries({ queryKey: incomingAccessRequestsQueryKey(selected?.id) });
  };

  if (!user) return null;

  const loading = home.isPending && !home.isPaused;
  const failed = (home.isError || (home.isPending && home.isPaused)) && !home.data;

  // P3 live and no page yet: P3's Welcome, never R1's (lib/auth-otp-routing organiserHomeHandoff).
  const handoff = organiserHomeHandoff(flags.organiserP3 && flags.organiserSelfServe, home.data ? organisers.length : undefined);
  if (handoff) return <Navigate to={handoff} replace />;

  if (home.data && (organisers.length === 0 || adding)) {
    return (
      <OrganiserShell
        title={adding ? 'Add a page' : 'Welcome'}
        back={adding ? { to: ORG_PATHS.home, label: 'Home' } : undefined}
        testId="org-page-home"
      >
        {/* No announce region here: OnboardingView shows the confirmation itself in a
            status element, and a second region read the same words twice. */}
        <OnboardingView
          user={{ id: user.id, email: user.email ?? null }}
          mailboxProven={isMailboxProvenToken(session?.access_token)}
          myOrganiserIds={new Set(organisers.map((o) => o.id))}
          requests={mine.data ?? []}
          firstRun={organisers.length === 0}
          onChanged={onChanged}
        />
      </OrganiserShell>
    );
  }

  const title = !selected ? 'Home' : organisers.length > 1 ? (
    <Link to={ORG_PATHS.switch} data-testid="home-switch" className="inline-flex min-h-[44px] max-w-full items-center gap-[4px]">
      <span data-testid="home-page-name" className="truncate">{selected.name}</span>
      <ChevronDown aria-hidden="true" className="h-[20px] w-[20px] shrink-0 text-[var(--gold)]" />
    </Link>
  ) : (
    <span data-testid="home-page-name">{selected.name}</span>
  );

  return (
    <OrganiserShell title={title} testId="org-page-home">
      {/* Shows and announces a confirmation that arrives here (a claim or create that
          moved Home out of onboarding); one element, so it is never said twice. */}
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="home-confirmation"
        className={message ? 'mb-[16px] rounded-[12px] bg-[var(--ok-bg)] px-[16px] py-[12px] text-[14px] text-[var(--ok-fg)]' : 'sr-only'}
      >
        {message}
      </p>
      {/* Pages claimed at this sign-in: an in-flow line with its own Close, never over the rows. */}
      <ClaimNotice />
      {loading ? (
        <SkeletonRows count={4} label="Loading your jobs" testId="home-loading" />
      ) : failed ? (
        <ErrorState
          title={home.isPaused ? <>You&rsquo;re offline</> : 'Home did not load'}
          onRetry={() => void home.refetch()}
          retrying={home.isFetching}
          testId="home-error"
        />
      ) : (
        <div className="space-y-[12px]">
          <ProfileButton key={selected?.id ?? 'none'} organiserId={selected?.id ?? null} userId={user.id} />
          <h2 data-testid="home-todo-heading" className="px-[4px] text-[15px] font-bold text-[var(--fg)]">{TODO_HEADING}</h2>
          {jobs.length === 0 ? (
            <p data-testid="home-todo-empty" className="rounded-[16px] border border-[var(--line)] bg-[var(--card)] px-[16px] py-[12px] text-[14px] text-[var(--mut)]">{TODO_EMPTY}</p>
          ) : (
            <ol data-testid="home-jobs" className="overflow-hidden rounded-[16px] border border-[var(--line)] bg-[var(--card)] [&>li:last-child>button]:border-b-0">
              {jobs.map((job) => <JobRow key={`${job.kind}-${job.n}`} job={job} />)}
            </ol>
          )}
          <NewEventButton block={newEventBlock(selected)} pageId={organisers.length > 1 ? selected?.id ?? null : null} />
          <div className="grid grid-cols-2 gap-[8px]" data-testid="home-small-buttons">
            {SMALL_BUTTONS.map((b) => (
              <GhostButton key={b.to} size="sm" onClick={() => navigate(b.to)} testId="home-small">{b.label}</GhostButton>
            ))}
          </div>
          {isFirstSteps(jobs) && <SupportRows />}
        </div>
      )}
    </OrganiserShell>
  );
}
