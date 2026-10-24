import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, MapPin, Loader2 } from 'lucide-react';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useCity } from '@/contexts/CityContext';
import { buildCityPath } from '@/lib/cityPath';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { useSeo } from '@/lib/seo';
import { GOING_CHECKIN_ENABLED } from '@/lib/goingCheckin';
import { GOING_COPY, useMyGoing } from '@/modules/going';
// The dancer app's ONE night mapping (Home, Nights and this page read the same tags and lines).
import {
  NIGHTS_OFF_LINE,
  mapMyGoing,
  nightNote,
  fullDate,
  goingUpcomingCount,
  statusLabel,
  type Night,
} from '@/modules/dancer-app/screens/nights/nightsModel';
// NOT LevelRatingPrompt: importing it here (a lazy chunk) would split it out of
// the /event/:id route chunk, one more first-load request on every event page.
// A past night links to the event's own rating card instead.
import { AuthGuard } from '@/components/auth/AuthGuard';
// /account/dancer, not /account: /account sends an organiser on to the organiser home.
import { DANCER_HOME_PATH } from '@/lib/accountRouting';

/** = LEVEL_RATING_ANCHOR (LevelRatingPrompt; equality asserted in tests/client/myAttendance.test.tsx). */
export const RATE_ANCHOR = 'level-rating';

const statusBadgeClass = (n: Night) => {
  if (n.status === 'cancelled') return 'border-red-400/40 bg-red-500/15 text-red-100';
  if (n.past) return 'border-slate-500/40 bg-slate-700/30 text-slate-200';
  return 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100';
};

/** A past night that went ahead, on a still-listed event, offers its event page's rating card. */
const canRate = (n: Night) => n.past && n.status === 'ended' && n.listed && n.href !== null;

const NightCard = ({ night }: { night: Night }) => {
  const navigate = useNavigate();
  const note = nightNote(night);
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground line-clamp-2 leading-tight">{night.name}</p>
        <Badge className={`text-[10px] border shrink-0 ${statusBadgeClass(night)}`}>{statusLabel(night)}</Badge>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3 w-3" />
          {night.when ?? fullDate(night.date)}
        </span>
        {night.venue && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {night.venue}
          </span>
        )}
      </div>
      {note && <p className="mt-1 text-[11px] text-muted-foreground" data-testid="attendance-note">{note}</p>}
    </>
  );
  return (
    <div
      data-testid="attendance-night"
      data-status={night.status}
      className="rounded-xl border border-slate-700 bg-slate-900/65 p-3 hover:border-cyan-300/45 hover:bg-slate-900/85 transition-colors"
    >
      {night.href ? (
        <button
          type="button"
          onClick={() => navigate(night.href!)}
          className="block w-full min-h-[44px] text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
        >
          {body}
        </button>
      ) : (
        <div>{body}</div>
      )}
      {canRate(night) && (
        <Link
          to={`${night.href}#${RATE_ANCHOR}`}
          className="mt-1 inline-flex min-h-[44px] items-center text-[13px] font-semibold text-primary underline underline-offset-2"
          data-testid="attendance-rate"
        >
          Rate the dancing level
        </Link>
      )}
    </div>
  );
};

const NightList = ({ title, nights, testId }: { title: string; nights: Night[]; testId: string }) => (
  <section aria-label={title} data-testid={testId} className="space-y-2">
    <h2 className="text-sm font-semibold text-foreground">{title}</h2>
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {nights.map((n) => <NightCard key={n.occurrenceId} night={n} />)}
    </div>
  </section>
);

const MyAttendance = () => {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { citySlug } = useCity();
  const navigate = useNavigate();

  useSeo({
    title: 'My event attendance',
    description: 'The Bachata Calendar nights you said you are going to.',
    noindex: true,
  });

  // get_my_going_v1 through the going module (behind the going switch: off = no read at all).
  const { data, isLoading, isError, refetch, isFetching } = useMyGoing();
  const nights = useMemo(() => mapMyGoing(data), [data]);
  const total = nights.upcoming.length + nights.past.length;
  // THE upcoming going count (the same one the dancer app's Home tile shows).
  const goingCount = goingUpcomingCount(nights.upcoming);

  const showLoading = isAuthLoading || (GOING_CHECKIN_ENABLED && Boolean(user?.id) && isLoading);
  const failed = GOING_CHECKIN_ENABLED && isError;
  const calendarPath = citySlug ? buildCityPath(citySlug, 'calendar') : '/parties';

  return (
    <GlobalLayout breadcrumbs={buildBreadcrumbs('dancerProfile.attendance')} backHref={DANCER_HOME_PATH}>
      <div className="px-4 pt-4 pb-24">
        <div className="max-w-5xl mx-auto space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-foreground">My Event Attendance</h1>
            </div>
            {goingCount > 0 && (
              <Badge className="border border-cyan-400/35 bg-cyan-500/10 text-cyan-100" data-testid="attendance-count">
                {goingCount} {goingCount === 1 ? 'night' : 'nights'}
              </Badge>
            )}
          </div>

          {showLoading && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
            </div>
          )}

          {!showLoading && failed && (
            <Card className="border border-red-400/40 bg-red-950/40">
              <CardContent className="p-3 flex flex-col gap-2">
                <p className="text-sm text-red-100">We couldn&rsquo;t load your nights. Check your connection and try again.</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="self-start min-h-[44px] border-red-400/40 bg-red-950/30 hover:bg-red-900/40 text-red-100"
                  onClick={() => void refetch()}
                  disabled={isFetching}
                >
                  {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  {GOING_COPY.retry}
                </Button>
              </CardContent>
            </Card>
          )}

          {!showLoading && !failed && total === 0 && (
            <Card className="border border-dashed border-slate-700 bg-slate-900/40" data-testid="attendance-empty">
              <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-900/80">
                  <CalendarDays className="h-4 w-4 text-slate-400" />
                </span>
                <p className="text-sm text-foreground">{GOING_CHECKIN_ENABLED ? GOING_COPY.myUpcomingEmpty : NIGHTS_OFF_LINE}</p>
                {GOING_CHECKIN_ENABLED && (
                  <p className="text-xs text-muted-foreground max-w-xs">{GOING_COPY.myUpcomingEmptyHow}</p>
                )}
                <Button
                  size="sm"
                  className="mt-1 min-h-[44px] bg-primary hover:bg-primary/90"
                  onClick={() => navigate(calendarPath)}
                >
                  Browse events
                </Button>
              </CardContent>
            </Card>
          )}

          {!showLoading && !failed && total > 0 && (
            <>
              {nights.upcoming.length > 0 ? (
                <NightList title={GOING_COPY.myUpcomingTitle} nights={nights.upcoming} testId="attendance-upcoming" />
              ) : (
                <p className="text-xs text-muted-foreground" data-testid="attendance-upcoming-empty">
                  {GOING_COPY.myUpcomingEmpty} {GOING_COPY.myUpcomingEmptyHow}{' '}
                  <Link to={calendarPath} className="inline-flex min-h-[44px] items-center font-semibold text-primary underline underline-offset-2">
                    Browse events
                  </Link>
                </p>
              )}
              {nights.past.length > 0 && (
                <NightList title={GOING_COPY.myPastTitle} nights={nights.past} testId="attendance-past" />
              )}
            </>
          )}
        </div>
      </div>
    </GlobalLayout>
  );
};

// /account/attendance. Signed out -> /auth with returnTo, like /account itself.
const GuardedMyAttendance = () => (
  <AuthGuard>
    <MyAttendance />
  </AuthGuard>
);

export default GuardedMyAttendance;
