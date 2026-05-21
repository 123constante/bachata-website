import { createPortal } from 'react-dom';
import { Ticket } from 'lucide-react';
import { recordEventLinkClick } from '@/lib/eventLinkClicks';

type StickyTicketButtonProps = {
  ticketUrl: string | null;
  /** eventId passes through to record_event_link_click_v1 -- no-op when null. */
  eventId: string | null;
  /**
   * When true the date is cancelled -- hide the ticket CTA so dancers can't
   * accidentally buy a ticket for an off date.
   */
  cancelled?: boolean;
};

/**
 * Sticky "Get Tickets" CTA -- Heat Shimmer variant.
 *
 * Gold->coral->orange gradient pill with four stacked animations:
 *   1. gradient-shift : background-position scroll (colour drift)
 *   2. scanlines      : horizontal scanline overlay (heat texture)
 *   3. sheen          : diagonal highlight sweep
 *   4. wobble         : subtle skewX on the label (heat-haze)
 *
 * Styles injected via a secondary portal to document.head so keyframes and
 * ::before/::after rules are available without touching index.css. Content
 * portal targets document.body to escape framer-motion transform ancestors
 * (same reason as the previous brass-pill variant).
 */

const HEAT_CSS = `
  @keyframes sticky-heat-gradient {
    0%   { background-position: 0% 0%; }
    100% { background-position: 220% 0%; }
  }
  @keyframes sticky-heat-scanlines {
    0%   { transform: translateY(0); }
    100% { transform: translateY(11px); }
  }
  @keyframes sticky-heat-sheen {
    0%        { transform: translateX(-100%); }
    55%, 100% { transform: translateX(100%); }
  }
  @keyframes sticky-heat-wobble {
    0%, 100% { transform: skewX(0deg); }
    50%      { transform: skewX(-1.5deg); }
  }
  .sticky-heat-cta {
    position: relative;
    overflow: hidden;
    border-radius: 9999px;
    background: linear-gradient(95deg, #FFD66B 0%, #FF6E4D 45%, #FF9F00 70%, #FF6E4D 100%);
    background-size: 220% 100%;
    animation: sticky-heat-gradient 5s linear infinite;
    padding: 13px 28px;
    color: #1a0a04;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 14px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    box-shadow:
      0 0 36px rgba(255, 110, 77, 0.45),
      0 6px 16px rgba(0, 0, 0, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.25);
    width: 100%;
    max-width: 300px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    transition: filter 0.15s;
    -webkit-tap-highlight-color: transparent;
  }
  .sticky-heat-cta:active {
    filter: brightness(0.88);
  }
  .sticky-heat-cta::before {
    content: '';
    position: absolute;
    inset: -1px;
    background: repeating-linear-gradient(
      0deg,
      transparent 0 5px,
      rgba(255, 255, 255, 0.09) 5px 6px
    );
    animation: sticky-heat-scanlines 1.5s linear infinite;
    pointer-events: none;
    mix-blend-mode: overlay;
    border-radius: inherit;
  }
  .sticky-heat-cta::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      105deg,
      transparent 35%,
      rgba(255, 255, 255, 0.38) 50%,
      transparent 65%
    );
    animation: sticky-heat-sheen 3.5s ease-in-out infinite;
    pointer-events: none;
  }
  .sticky-heat-inner {
    position: relative;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    animation: sticky-heat-wobble 1.4s ease-in-out infinite;
  }
`;

export const StickyTicketButton = ({
  ticketUrl,
  eventId,
  cancelled = false,
}: StickyTicketButtonProps) => {
  if (cancelled) return null;
  if (!ticketUrl) return null;
  if (typeof document === 'undefined') return null;

  return (
    <>
      {createPortal(<style>{HEAT_CSS}</style>, document.head)}
      {createPortal(
        <div
          className="fixed inset-x-0 z-40 flex justify-center px-4 py-3"
          style={{ bottom: 'calc(58px + env(safe-area-inset-bottom))' }}
        >
          <a
            href={ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="sticky-heat-cta"
            onClick={() => {
              recordEventLinkClick({
                eventId,
                linkType: 'ticket',
                targetUrl: ticketUrl,
                source: 'bento_sticky_cta',
              });
            }}
          >
            <span className="sticky-heat-inner">
              <Ticket className="h-4 w-4" strokeWidth={2.2} />
              Get Tickets
            </span>
          </a>
        </div>,
        document.body,
      )}
    </>
  );
};
