import { useMemo } from 'react';
import { qrModules, qrPath } from './qr';

/**
 * The door QR as one SVG path. Shared by My tickets and the thank-you page; imported only by
 * lazy chunks so the generator never lands on a first load. The token stays in props: it is
 * never rendered as text or an attribute. `fill` (default off) lets the SVG fill its parent
 * instead of capping at 240px.
 */
export default function TicketQrCode({ token, fill = false }: { token: string; fill?: boolean }) {
  const { size, d } = useMemo(() => {
    const grid = qrModules(token);
    return { size: grid.length + 8, d: qrPath(grid) };
  }, [token]);
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Ticket QR code"
      data-testid="ticket-qr"
      className={fill ? 'block h-full w-full rounded-sm' : 'mx-auto block h-auto w-full max-w-[240px] rounded-sm'}
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}
