import { useState } from 'react';
import { Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { optimizedImageUrl } from '@/lib/imageCdn';

export type VenueUpcomingEvent = {
  event_id: string;
  occurrence_id: string;
  slug?: string | null;
  name: string;
  instance_start: string;
  poster_url: string | null;
};

const PREVIEW_COUNT = 3;

/**
 * VenueUpcomingTile — cream-card "what's on here" block at the bottom
 * of the venue page.
 *
 * Decided 2026-04-30 (Ricky): show the next 3 events as small cards
 * by default. If more events exist, an inline "Show all N" expander
 * reveals the rest without leaving the page.
 *
 * Heading flips to "Other events here" on warm entry.
 */
export const VenueUpcomingTile = ({
  events,
  fromEventContext,
}: {
  events: VenueUpcomingEvent[] | null | undefined;
  fromEventContext: boolean;
}) => {
  const list = Array.isArray(events) ? events : [];
  const [expanded, setExpanded] = useState(false);

  const visible = expanded ? list : list.slice(0, PREVIEW_COUNT);
  const hiddenCount = Math.max(0, list.length - PREVIEW_COUNT);

  return (
    <div
      id="venue-upcoming-events"
      className="bg-venue-card border border-venue-card-border rounded-xl p-3 mb-3"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-venue-card-mut flex-shrink-0" aria-hidden="true" />
          <h3 className="text-[11px] uppercase tracking-[0.18em] font-semibold text-venue-card-mut">
            {fromEventContext ? 'Other events here' : 'Other events here'}
          </h3>
        </div>
        {list.length > 0 && (
          <span className="inline-flex items-center rounded-full bg-venue-ember/15 border border-venue-ember/40 px-2 text-[10px] font-bold text-venue-ember">
            {list.length}
          </span>
        )}
      </div>

      {visible.length > 0 ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            {visible.map((event) => (
              <Link
                key={event.occurrence_id}
                to={`/event/${event.slug || event.event_id}?occurrenceId=${event.occurrence_id}`}
                className="group flex flex-col gap-1.5 rounded-md bg-venue-card-pill hover:bg-white border border-transparent hover:border-venue-card-border p-2 transition-colors"
              >
                <div className="aspect-square rounded-md overflow-hidden bg-venue-card-border">
                  {event.poster_url ? (
                    <img
                      src={optimizedImageUrl(event.poster_url, 320)}
                      alt={event.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-venue-card-mut" aria-hidden="true" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-venue-card-fg line-clamp-2 leading-tight">
                    {event.name}
                  </p>
                  <p className="text-[10px] text-venue-card-mut mt-0.5">
                    {format(new Date(event.instance_start), 'EEE d MMM')}
                    <br />
                    {format(new Date(event.instance_start), 'HH:mm')}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-venue-card-border bg-venue-card-pill hover:bg-white px-3 py-2 text-xs font-semibold text-venue-card-fg transition-colors min-h-[44px]"
              aria-expanded={expanded}
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                  Show fewer
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                  Show all {list.length} events
                </>
              )}
            </button>
          )}
        </>
      ) : (
        <p className="text-xs text-venue-card-mut italic">
          Nothing on here yet — check back soon.
        </p>
      )}
    </div>
  );
};

export default VenueUpcomingTile;
