import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Plus, UserRound, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { ORGANISER_HOME_KEY, myAccessRequestsQueryKey } from '@/modules/organiser/shared/selfServeApi';
import { isMailboxProvenToken } from '@/modules/organiser/shared/sessionProof';
import { OrganiserShell, ORG_PATHS } from '../shell';
import {
  AttentionStrip,
  Card,
  DateChip,
  EmptyState,
  ErrorState,
  PrimaryButton,
  SectionLabel,
  SkeletonRows,
  StatusTag,
  useAnnounce,
} from '../ui';
import { isClosed } from '@/modules/organiser/shared/eventState';
import { hasAnyEvent, noLineupText, shortDate, type NextDate } from './homeView';
import { useHomeStrips, useOrganiserHome } from './useHomeData';
import { OnboardingView } from './onboarding/OnboardingView';

/** One upcoming date: chip, event name, venue, status. Opens the date editor. */
function DateRow({ d, today }: { d: NextDate; today: string }) {
  return (
    <Link
      to={ORG_PATHS.date(d.seriesId, d.occurrenceId)}
      data-testid="home-date-row"
      data-occurrence={d.occurrenceId}
      className="flex min-h-[68px] items-center gap-[12px] px-[16px] py-[8px]"
    >
      <DateChip date={d.date} today={today} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-[var(--fg)]">{d.seriesName}</span>
        <span className="block truncate text-[13px] text-[var(--mut)]">{d.venueName ?? 'Venue not set'}</span>
      </span>
      <StatusTag tone={d.tag.tone}>{d.tag.label}</StatusTag>
    </Link>
  );
}

function NewEventButton() {
  const navigate = useNavigate();
  return (
    <PrimaryButton onClick={() => navigate(ORG_PATHS.newEvent)} testId="home-new-event">
      <Plus aria-hidden="true" className="h-[20px] w-[20px]" /> New event
    </PrimaryButton>
  );
}

/**
 * /account/o -- Home. With no organiser yet it is the onboarding (find and
 * claim, request access, or create). Otherwise: strips only when something
 * needs the organiser, the big New event button, and the next dates.
 */
export default function HomePage() {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [message, announce] = useAnnounce();
  const { home, requests } = useOrganiserHome(user?.id);
  const strips = useHomeStrips(home.data);
  const { organisers, dates, teamRequests, runway, noLineup, lineupChecked } = strips;
  const lineupText = noLineupText(noLineup.length, lineupChecked);
  const adding = params.get('add') === '1';

  const onChanged = (confirmation: string) => {
    announce(confirmation);
    if (adding) setParams({}, { replace: true });
    void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
    void queryClient.invalidateQueries({ queryKey: myAccessRequestsQueryKey(user?.id) });
  };

  if (!user) return null;

  const loading = home.isPending && !home.isPaused;
  const failed = (home.isError || (home.isPending && home.isPaused)) && !home.data;
  const showOnboarding = !!home.data && (organisers.length === 0 || adding);

  if (showOnboarding) {
    return (
      <OrganiserShell
        title={adding ? 'Add an organiser' : 'Welcome'}
        back={adding ? { to: ORG_PATHS.home, label: 'Home' } : undefined}
        testId="org-page-home"
      >
        {/* No announce region here: OnboardingView shows the confirmation itself in a
            status element, and a second region read the same words twice. */}
        <OnboardingView
          user={{ id: user.id, email: user.email ?? null }}
          mailboxProven={isMailboxProvenToken(session?.access_token)}
          myOrganiserIds={new Set(organisers.map((o) => o.id))}
          requests={requests.data ?? []}
          firstRun={organisers.length === 0}
          onChanged={onChanged}
        />
      </OrganiserShell>
    );
  }

  return (
    <OrganiserShell title="Home" testId="org-page-home">
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
      {loading ? (
        <SkeletonRows count={4} label="Loading your dates" testId="home-loading" />
      ) : failed ? (
        <ErrorState
          title={home.isPaused ? <>You&rsquo;re offline</> : 'Your dates did not load'}
          onRetry={() => void home.refetch()}
          retrying={home.isFetching}
          testId="home-error"
        />
      ) : (
        <div className="space-y-[16px]">
          {(teamRequests > 0 || runway || lineupText) && (
            <div className="space-y-[8px]" data-testid="home-strips">
              {teamRequests > 0 && (
                <AttentionStrip icon={<Users />} onPress={() => navigate(ORG_PATHS.team)} testId="home-strip-team">
                  {teamRequests === 1 ? '1 team request is waiting' : `${teamRequests} team requests are waiting`}
                </AttentionStrip>
              )}
              {runway && (
                <AttentionStrip
                  icon={<CalendarClock />}
                  actionLabel="Extend"
                  onPress={() => navigate(ORG_PATHS.event(runway.seriesId))}
                  testId="home-strip-runway"
                >
                  {runway.seriesName}: dates listed until {shortDate(runway.lastDate, home.data?.today ?? '')}.
                  {runway.others > 0 && ` ${runway.others === 1 ? '1 more event' : `${runway.others} more events`} also running short.`}
                </AttentionStrip>
              )}
              {lineupText && (
                <AttentionStrip
                  icon={<UserRound />}
                  onPress={() => navigate(ORG_PATHS.date(noLineup[0].seriesId, noLineup[0].occurrenceId))}
                  testId="home-strip-lineup"
                >
                  {lineupText}
                </AttentionStrip>
              )}
            </div>
          )}

          {dates.length === 0 ? (
            <EmptyState
              title={hasAnyEvent(organisers) ? 'No dates coming up' : 'No events yet'}
              body={
                !hasAnyEvent(organisers)
                  ? 'Add your first event. You can keep it as a draft until it is ready.'
                  : organisers.every((o) => (o.series ?? []).every((s) => isClosed(s.lifecycle_status)))
                    ? 'Your events have ended. Add a new event to list new dates.'
                    : 'Your events have no upcoming dates. Open one in Events to see its dates, or add a new event.'
              }
              action={<NewEventButton />}
              testId="home-empty"
            />
          ) : (
            <>
              <NewEventButton />
              <section aria-labelledby="home-next-dates">
                <SectionLabel id="home-next-dates">Next dates</SectionLabel>
                <Card testId="home-dates">
                  {dates.map((d) => (
                    <DateRow key={d.occurrenceId} d={d} today={home.data?.today ?? ''} />
                  ))}
                </Card>
              </section>
            </>
          )}

          <Link
            to={`${ORG_PATHS.home}?add=1`}
            data-testid="home-add-organiser"
            className="flex min-h-[44px] items-center justify-center text-[15px] font-semibold text-[var(--gold)]"
          >
            Add another organiser
          </Link>
        </div>
      )}
    </OrganiserShell>
  );
}
