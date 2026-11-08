import type { TicketSymbol } from './ticketSymbol';

/** Glyph paths copied from the round-seven mockup (symbol ids party/class/both/vip/free/early/pass). */
const GLYPHS: Record<TicketSymbol, JSX.Element> = {
  party: (<><path d="M9 18V6l10-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /></>),
  class: (<><ellipse cx="8" cy="8" rx="2.6" ry="4.2" transform="rotate(-12 8 8)" /><ellipse cx="16" cy="16" rx="2.6" ry="4.2" transform="rotate(-12 16 16)" /></>),
  both: (<><path d="M8 18V7l9-2v11" /><circle cx="5.5" cy="18" r="2.2" /><circle cx="14.5" cy="16" r="2.2" /><path d="M20 3v5M17.5 5.5h5" /></>),
  vip: (<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />),
  free: (<><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="8.5" r="1.2" /></>),
  early: (<><path d="M3 18h18M7 18a5 5 0 0 1 10 0" /><path d="M12 5v3M5 9l2 2M19 9l-2 2" /></>),
  generic: (<><path d="M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4z" /><path d="M9 6v12" strokeDasharray="2 2" /></>),
};

export function TicketGlyph({ symbol }: { symbol: TicketSymbol }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={32}
      height={32}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-glyph={symbol}
    >
      {GLYPHS[symbol]}
    </svg>
  );
}
