import { createPortal } from 'react-dom';
import { Ticket } from 'lucide-react';

type StickyTicketButtonProps = {
  ticketUrl: string | null;
};

/**
 * Sticky "Get Tickets" CTA — Variant A (translucent bar + brass pill).
 *
 * Full-width blurred dark bar sitting flush above the 58 px BottomNav, with
 * a centred brass pill inside. Backdrop blur lets bento content show through
 * as you scroll. Returns null when there is no ticket URL so free / no-link
 * events render nothing.
 *
 * IMPORTANT: Rendered via a portal to document.body. The route tree is wrapped
 * in <PageTransition> which uses framer-motion transforms; any CSS `transform`
 * or `filter` on an ancestor makes `position: fixed` behave like
 * `position: absolute`, so the bar would scroll with the page. Portalling
 * escapes that ancestor and restores true viewport-fixed behaviour.
 */
export const StickyTicketButton = ({ ticketUrl }: StickyTicketButtonProps) => {
  if (!ticketUrl) return null;
  if (typeof document === 'undefined') return null;

  const node = (
    <div
      className="fixed inset-x-0 z-40 flex justify-center px-4 py-3"
      style={{
        bottom: 'calc(58px + env(safe-area-inset-bottom))',
        background: 'rgba(10, 18, 14, 0.72)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid hsl(var(--bento-hairline))',
      }}
    >
      <a
        href={ticketUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-full max-w-[300px] items-center justify-center gap-2 rounded-full px-5 py-[11px] text-sm font-bold tracking-wide transition-[filter] hover:brightness-110 active:brightness-95"
        style={{
          background: 'hsl(var(--bento-accent))',
          color: '#1a2018',
          boxShadow: '0 4px 14px rgba(208, 168, 89, 0.25)',
        }}
      >
        <Ticket className="h-4 w-4" strokeWidth={2.2} />
        Get Tickets
      </a>
    </div>
  );

  return createPortal(node, document.body);
};
