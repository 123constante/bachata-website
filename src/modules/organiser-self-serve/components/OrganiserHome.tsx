import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarPlus, ExternalLink, Loader2, Plus, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LIFECYCLE_LABEL, type HomeOrganiser, type SubmittedOrganiser } from '@/modules/organiser/shared/selfServeApi';
import { selfServeErrorCopy } from '@/modules/organiser/shared/selfServeErrors';
import { useSendForReview } from '@/modules/organiser/shared/useSendForReview';
import {
  CATEGORY_LABEL,
  FORMAT_LABEL,
  attentionItems,
  dateLabel,
  isCancelled,
  localAsZTime,
  organiserStatusView,
  type HomeSeriesFull,
} from '@/modules/organiser/shared/homeModel';

/**
 * The organiser home (Lever 2 W2): mockup 01-B, series cards with their next
 * dates, under 01-C's "needs you" notice. Each card opens the series page
 * (W4, /account/series/:id), where one date is changed too (W5); "New event"
 * opens the create screen (W3, /account/new) for this organiser. The other write
 * here is the organiser's own "Send for review" (admin D6, mockup 05-A).
 */

function SeriesCard({ series, today }: { series: HomeSeriesFull; today: string }) {
  const live = series.lifecycle_status === 'live';
  const meta = [
    series.category ? CATEGORY_LABEL[series.category] ?? series.category : null,
    series.format ? FORMAT_LABEL[series.format] ?? series.format : null,
    series.default_local_start_time ? series.default_local_start_time.slice(0, 5) : null,
  ].filter(Boolean);
  const more = Math.max(0, (Number(series.upcoming_count) || 0) - series.next_dates.length);

  return (
    // min-w-0: a grid item is never narrower than its content by default, so one long
    // name widened the whole column past a phone screen and pushed every card off it.
    <li className="min-w-0 rounded-md border border-border p-3 space-y-2" data-testid="series-card">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Link
            to={`/account/series/${series.id}`}
            className="block text-base font-semibold leading-tight line-clamp-2 break-words hover:text-primary tap-pad"
            data-testid="series-open"
          >
            {series.name}
          </Link>
          {meta.length > 0 && <p className="text-xs text-muted-foreground">{meta.join(' \u00B7 ')}</p>}
        </div>
        <Badge variant={live ? 'default' : 'secondary'} className="text-xs shrink-0">
          {LIFECYCLE_LABEL[series.lifecycle_status] ?? series.lifecycle_status}
        </Badge>
      </div>

      {series.next_dates.length === 0 ? (
        <p className="text-xs text-muted-foreground">No upcoming dates.</p>
      ) : (
        <ul className="divide-y divide-border/60" aria-label={`Next dates for ${series.name}`}>
          {series.next_dates.map((d) => {
            const cancelled = isCancelled(d);
            const time = localAsZTime(d.materialised_start_utc);
            return (
              <li key={d.occurrence_id} className="flex items-center gap-2 py-1.5 text-sm" data-testid="series-date">
                <span className={cn('w-20 shrink-0 font-medium', d.occurrence_date === today && 'text-primary')}>
                  {dateLabel(d.occurrence_date, today)}
                </span>
                {cancelled ? (
                  <span className="text-destructive text-xs font-medium" data-testid="date-cancelled">Cancelled</span>
                ) : (
                  <span className="text-muted-foreground text-xs">{time ?? 'Time to be confirmed'}</span>
                )}
                {d.has_own_changes && (
                  <span className="ml-auto text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5">
                    Changed for this date
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center gap-3 text-xs">
        <span className="text-muted-foreground">
          {Number(series.upcoming_count) || 0} upcoming {Number(series.upcoming_count) === 1 ? 'date' : 'dates'}
          {more > 0 ? ` (${more} more)` : ''}
        </span>
        <Link to={`/account/series/${series.id}`} className="ml-auto text-primary font-medium tap-link" data-testid="series-manage">
          Edit and dates
        </Link>
        {live && (
          <Link
            to={`/event/${series.slug ?? series.id}`}
            className="tap-link gap-1 text-primary"
            data-testid="view-as-dancer"
          >
            View as a dancer <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </Link>
        )}
      </div>
    </li>
  );
}

export function OrganiserHome({
  organiser,
  today,
  onSentForReview,
}: {
  organiser: HomeOrganiser;
  today: string;
  /** After a successful "Send for review" (the home is already patched and reloading): the page confirms it. */
  onSentForReview: (sent: SubmittedOrganiser) => void;
}) {
  const series = organiser.series as HomeSeriesFull[];
  const attention = attentionItems(series, today);
  const live = organiser.lifecycle_status === 'live';
  const status = organiserStatusView(organiser.name, organiser.lifecycle_status, organiser.latest_decision?.reason);
  // The page keys this component by organiser, so a send's state is one organiser's.
  const send = useSendForReview(onSentForReview);
  const refusal = send.error ? selfServeErrorCopy(send.error).message : null;

  // Inside the next-step card when it shows, so a rejection reason reads before the button.
  const statusNote = status.note ? (
    <p
      className={cn('text-xs', status.tone === 'destructive' ? 'text-destructive' : 'text-muted-foreground')}
      data-testid="organiser-status-note"
    >
      {status.note}
    </p>
  ) : null;

  return (
    <section className="space-y-3" data-testid="organiser-home">
      {status.canSendForReview && (
        <div className="rounded-lg border border-primary/40 bg-card p-3 space-y-3" data-testid="next-step-card">
          {/* The status note below says what review unlocks; events wait for the approval. */}
          <p className="text-sm font-semibold break-words" data-testid="next-step-title">
            Next: send {organiser.name} for review{organiser.lifecycle_status === 'rejected' ? ' again' : ''}.
          </p>
          {statusNote}
          <Button
            className="rounded-full min-h-[44px] w-full sm:w-auto"
            disabled={send.isPending}
            aria-busy={send.isPending}
            onClick={() => send.mutate(organiser.id)}
            data-testid="send-for-review"
          >
            {send.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="w-4 h-4" aria-hidden="true" />
            )}
            Send for review
          </Button>
        </div>
      )}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">My events</h2>
          <p className="text-xs text-muted-foreground truncate">
            {organiser.name}
            {live && (
              <>
                {' '}&middot;{' '}
                <Link to={`/organisers/${organiser.slug ?? organiser.id}`} className="text-primary tap-link-inline gap-1">
                  Public page <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!live && (
            <Badge variant="secondary" className="text-xs" data-testid="organiser-status">
              {LIFECYCLE_LABEL[organiser.lifecycle_status] ?? organiser.lifecycle_status}
            </Badge>
          )}
          <Button asChild size="sm" variant={status.canSendForReview ? 'outline' : 'default'} className="min-h-[44px]">
            <Link to={`/account/new?organiser=${organiser.id}`} data-testid="new-event">
              <Plus className="w-4 h-4" aria-hidden="true" /> New event
            </Link>
          </Button>
        </div>
      </div>

      {!status.canSendForReview && statusNote}
      {/* Outside the card's branch: a refusal reloads the home, and when the reloaded
          organiser is no longer sendable the button goes but its explanation stays. */}
      {refusal && (
        <p className="text-xs text-destructive" role="alert" data-testid="send-for-review-error">
          {refusal}
        </p>
      )}

      {attention.length > 0 && (
        <div
          className="rounded-md border border-primary/40 bg-primary/10 p-3 text-sm space-y-1"
          role="status"
          data-testid="attention-notice"
        >
          <p className="font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-primary" aria-hidden="true" /> Needs you
          </p>
          <ul className="space-y-0.5">
            {attention.map((item, i) => (
              <li key={`${item.kind}-${item.seriesId}-${i}`} data-testid={`attention-${item.kind}`}>{item.text}</li>
            ))}
          </ul>
        </div>
      )}

      {series.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-3 text-sm flex items-start gap-2" data-testid="home-empty">
          <CalendarPlus className="w-4 h-4 mt-0.5 text-primary shrink-0" aria-hidden="true" />
          {live ? (
            <span>
              No events yet. Tap <span className="font-medium">New event</span> to add a party or a weekly class; the team checks it before it goes live.
            </span>
          ) : (
            // A create needs a live organiser (createBlock), so "Tap New event" would lead to a refusal here.
            <span>
              No events yet. Once the team approves {organiser.name}, you can add your parties and weekly classes here.
            </span>
          )}
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2" data-testid="series-list">
          {series.map((s) => <SeriesCard key={s.id} series={s} today={today} />)}
        </ul>
      )}
    </section>
  );
}
