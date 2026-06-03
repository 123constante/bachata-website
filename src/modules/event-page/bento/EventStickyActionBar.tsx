import { createPortal } from 'react-dom';
import { Navigation, Ticket, CalendarPlus, Share2 } from 'lucide-react';
import { recordEventLinkClick } from '@/lib/eventLinkClicks';
import { shareEvent } from '@/modules/event-page/bento/utils/eventActions';

type EventStickyActionBarProps = {
  eventId: string | null;
  /** Maps target for "Get directions". When null, the button is hidden. */
  directionsUrl: string | null;
  /** External ticket page. When null, the Tickets button is hidden. */
  ticketUrl: string | null;
  /** Title used for the native share sheet / fallback text. */
  shareTitle: string;
  /** Secondary line for the share sheet (date + venue). */
  shareSubtitle: string | null;
  /** When false the calendar button is hidden (no usable start date). */
  canAddToCalendar: boolean;
  /** Opens the AddToCalendarChooser drawer (state owned by BentoPage). */
  onAddToCalendar: () => void;
  /** Override the primary CTA colour (hex). Defaults to yellow when omitted. */
  accentColor?: string;
};

const SOURCE = 'bento_action_bar';

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Ghost styling shared by the secondary Directions button and the two icon
// buttons. Translucent raised surface with a hairline border, matching the
// bento palette tokens used across the rest of the page.
const GHOST_STYLE: React.CSSProperties = {
  background: 'hsl(var(--bento-surface-raised))',
  color: 'hsl(var(--bento-fg))',
  border: '1px solid hsl(var(--bento-fg-muted) / 0.25)',
};

// Primary CTA fills. Tickets is the headline action (yellow); when there is no
// ticket link, Directions inherits the primary slot with the warmer gold fill.
const YELLOW_PRIMARY: React.CSSProperties = {
  background: 'linear-gradient(180deg, #FFD64B, #FFB200)',
  color: '#3A2603',
  boxShadow: '0 10px 26px -10px rgba(255, 190, 40, 0.6)',
};
const GOLD_PRIMARY: React.CSSProperties = {
  background: 'linear-gradient(180deg, #FFC24B, #FF7A2F)',
  color: '#3A1503',
  boxShadow: '0 10px 26px -10px rgba(255, 140, 60, 0.6)',
};

const PRIMARY_CLASS =
  'flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-[14px] font-bold tracking-[0.01em]';
const SECONDARY_CLASS =
  'flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-[13px] font-semibold';
const ICON_CLASS = 'flex h-12 w-12 shrink-0 items-center justify-center rounded-full';

/**
 * Sticky bottom action bar for the bento event page.
 *
 * Recreates the "03 The Night" CTA row from the El Grande mockups. Tickets is
 * the headline action -- the big yellow button -- with Directions, Add-to-
 * calendar and Share alongside. Replaces the standalone floating "Get Tickets"
 * pill so dancers get one consolidated bar.
 *
 * When the event has no ticket link, Directions is promoted into the primary
 * slot (gold) so the bar always leads with a real call to action.
 *
 * Fixed above the BottomNav (58px) with a gradient fade so scrolling content
 * dissolves beneath it. Rendered via a body portal to escape framer-motion
 * transform ancestors (same reason as the old StickyTicketButton).
 */
export const EventStickyActionBar = ({
  eventId,
  directionsUrl,
  ticketUrl,
  shareTitle,
  shareSubtitle,
  canAddToCalendar,
  onAddToCalendar,
  accentColor,
}: EventStickyActionBarProps) => {
  if (typeof document === 'undefined') return null;

  // Tickets owns the primary slot whenever a link exists; otherwise Directions
  // is promoted so the bar never leads with a mere icon.
  const directionsIsPrimary = !ticketUrl;

  const ticketPrimaryStyle: React.CSSProperties = accentColor
    ? {
        background: accentColor,
        color: '#000',
        boxShadow: `0 10px 26px -10px ${hexToRgba(accentColor, 0.6)}`,
      }
    : YELLOW_PRIMARY;

  const handleDirections = () => {
    if (!directionsUrl) return;
    recordEventLinkClick({
      eventId,
      linkType: 'other',
      targetUrl: directionsUrl,
      source: `${SOURCE}:directions`,
    });
  };

  const handleTicket = () => {
    if (!ticketUrl) return;
    recordEventLinkClick({
      eventId,
      linkType: 'ticket',
      targetUrl: ticketUrl,
      source: `${SOURCE}:ticket`,
    });
  };

  const handleShare = () => {
    void shareEvent({ eventId, title: shareTitle, subtitle: shareSubtitle, source: SOURCE });
  };

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 z-40"
      style={{ bottom: 'calc(58px + env(safe-area-inset-bottom))' }}
    >
      <div
        className="mx-auto w-full max-w-[430px] px-3 pb-2 pt-7"
        style={{
          background:
            'linear-gradient(180deg, hsl(var(--bento-surface) / 0) 0%, hsl(var(--bento-surface) / 0.94) 30%)',
        }}
      >
        <div className="pointer-events-auto flex items-center gap-2">
          {ticketUrl && (
            <a
              href={ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleTicket}
              className={PRIMARY_CLASS}
              style={ticketPrimaryStyle}
            >
              <Ticket className="h-[17px] w-[17px]" strokeWidth={2.2} />
              Get Tickets
            </a>
          )}

          {directionsUrl && (
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleDirections}
              className={directionsIsPrimary ? PRIMARY_CLASS : SECONDARY_CLASS}
              style={directionsIsPrimary ? GOLD_PRIMARY : GHOST_STYLE}
            >
              <Navigation className="h-[17px] w-[17px]" strokeWidth={2.2} />
              {directionsIsPrimary ? 'Get directions' : 'Directions'}
            </a>
          )}

          {canAddToCalendar && (
            <button
              type="button"
              onClick={onAddToCalendar}
              aria-label="Add to calendar"
              className={ICON_CLASS}
              style={GHOST_STYLE}
            >
              <CalendarPlus className="h-[18px] w-[18px]" strokeWidth={2.2} />
            </button>
          )}

          <button
            type="button"
            onClick={handleShare}
            aria-label="Share"
            className={ICON_CLASS}
            style={GHOST_STYLE}
          >
            <Share2 className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
