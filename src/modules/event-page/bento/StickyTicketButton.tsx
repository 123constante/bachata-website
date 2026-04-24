import { createPortal } from 'react-dom';
import { Ticket } from 'lucide-react';

type StickyTicketButtonProps = {
  ticketUrl: string | null;
};

/**
 * Floating brass pill that links out to the organiser's external ticket page.
 * Sits fixed above the 58 px BottomNav with a small breathing gap, plus iOS
 * safe-area offset. Returns null when there is no ticket URL so free / no-link
 * events render nothing. Uses the bento brass accent (distinct from the site's
 * orange brand) to stay inside the bento theme language.
 *
 * IMPORTANT: Rendered via a portal to document.body. The route tree is wrapped
 * in <PageTransition> which uses framer-motion transforms; any CSS `transform`
 * or `filter` on an ancestor makes `position: fixed` behave like
 * `position: absolute`, so the pill would scroll with the page. Portalling
 * escapes that ancestor and restores true viewport-fixed behaviour.
 */
export const StickyTicketButton = ({ ticketUrl }: StickyTicketButtonProps) => {
  if (!ticketUrl) return null;
  if (typeof document === 'undefined') return null;

  const node = (
    <div
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4"
      style={{ bottom: 'calc(58px + env(safe-area-inset-bottom) + 12px)' }}
    >
      <a
        href={ticketUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-bold tracking-wide transition-[filter] hover:brightness-110 active:brightness-95"
        style={{
          background: 'hsl(var(--bento-accent))',
          color: '#1a2018',
          boxShadow:
            '0 8px 24px rgba(0, 0, 0, 0.55), 0 2px 6px rgba(208, 168, 89, 0.35)',
        }}
      >
        <Ticket className="h-4 w-4" strokeWidth={2.2} />
        Get Tickets
      </a>
    </div>
  );

  return createPortal(node, document.body);
};
