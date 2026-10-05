import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarPlus, ExternalLink, Loader2, Plus, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LIFECYCLE_LABEL, type HomeOrganiser, type SubmittedOrganiser } from '../selfServeApi';
import { selfServeErrorCopy } from '../selfServeErrors';
import { useSendForReview } from './useSendForReview';
import {
  CATEGORY_LABEL,
  FORMAT_LABEL,
  attentionItems,
  dateLabel,
  isCancelled,
  localAsZTime,
  organiserStatusView,
  type HomeSeriesFull,
} from '../homeModel';

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
    <li className="rounded-md border border-border p-3 space-y-2" data-testid="series-card">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Link
            to={`/account/series/${series.id}`}
            className="block text-base font-semibold leading-tight truncate hover:text-primary tap-pad"
            data-testid="series-open"
          >
            {series.name}
          </Link>
          {meta.length > 0 && <p className="text-xs text-muted-foreground">{meta.join(' \u00B7 ')}</p>}
        </div>
        <Badge variant={live ? 'default' : 'secondary'} className="text-[11px] shrink-0">
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
                  <span className="ml-auto text-[11px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
                    Own changes
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

  return (
    <section className="space-y-3" data-testid="organiser-home">
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
            <Badge variant="secondary" className="text-[11px]" data-testid="organiser-status">
              {LIFECYCLE_LABEL[organiser.lifecycle_status] ?? organiser.lifecycle_status}
            </Badge>
          )}
          <Button asChild size="sm" className="min-h-[44px]">
            <Link to={`/account/new?organiser=${organiser.id}`} data-testid="new-event">
              <Plus className="w-4 h-4" aria-hidden="true" /> New event
            </Link>
          </Button>
        </div>
      </div>

      {status.note && (
        <p
          className={cn('text-xs', status.tone === 'destructive' ? 'text-destructive' : 'text-muted-foreground')}
          data-testid="organiser-status-note"
        >
          {status.note}
        </p>
      )}
      {status.canSendForReview && (
        <Button
          size="sm"
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
      )}
      {/* Outside the button's branch: a refusal reloads the home, and when the reloaded
          organiser is no longer sendable the button goes but its explanation stays. */}
      {refusal && (
        <p className="text-xs text-destructive" role="alert" data-testid="send-for-review-error">
          {refusal}
        </p>
      )}

      {attention.length > 0 && (
        <div
          className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm space-y-1"
          role="status"
          data-testid="attention-notice"
        >
          <p className="font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" aria-hidden="true" /> Needs you
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
          <span>
            No events yet. Tap <span className="font-medium">New event</span> to add a party or a weekly class; the team checks it before it goes live.
          </span>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2" data-testid="series-list">
          {series.map((s) => <SeriesCard key={s.id} series={s} today={today} />)}
        </ul>
      )}
    </section>
  );
}
