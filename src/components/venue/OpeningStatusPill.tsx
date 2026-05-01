import type { VenueOpenStatus } from '@/lib/venueOpenStatus';

/**
 * OpeningStatusPill — colour-keyed live "Open now / Closing soon /
 * Opens at … / Closed" chip.
 *
 * Decided 2026-04-30 (Ricky):
 *   - Open state must look exciting + green with a pulsing "live" dot.
 *   - Pill must be one of the FIRST elements the user sees on the
 *     venue page, so a `size="lg"` variant exists for prominent
 *     placement at the top of the body.
 *
 * Tone map (unchanged):
 *   open          → green pill + pulsing dot
 *   closing-soon  → cumin (warm yellow)
 *   opens-soon    → brass (neutral anticipation)
 *   closed        → muted (no urgency)
 *   unknown       → null (Ricky's rule: never fake content)
 */
export const OpeningStatusPill = ({
  status,
  size = 'sm',
}: {
  status: VenueOpenStatus;
  size?: 'sm' | 'lg';
}) => {
  if (status.status === 'unknown') return null;

  const isLg = size === 'lg';
  const sizeClass = isLg
    ? 'h-10 px-4 text-sm rounded-lg'
    : 'h-7 px-2.5 text-xs rounded-md';
  const dotSize = isLg ? 'h-2.5 w-2.5' : 'h-2 w-2';

  if (status.status === 'open') {
    return (
      <span
        className={`inline-flex items-center gap-2 border-2 border-venue-open/50 bg-venue-open/15 font-bold text-venue-open whitespace-nowrap ${sizeClass}`}
        role="status"
      >
        <span className={`relative flex flex-shrink-0 ${dotSize}`}>
          <span className="absolute inline-flex h-full w-full motion-safe:animate-ping rounded-full bg-venue-open opacity-75" />
          <span className={`relative inline-flex rounded-full bg-venue-open ${dotSize}`} />
        </span>
        {status.label}
      </span>
    );
  }

  const tone =
    status.status === 'closing-soon'
      ? 'bg-venue-cumin/15 text-venue-cumin border-venue-cumin/50'
      : status.status === 'opens-soon'
      ? 'bg-venue-brass/15 text-venue-brass border-venue-brass/50'
      : 'bg-venue-line text-venue-cream-mut border-venue-line';

  return (
    <span
      className={`inline-flex items-center gap-1.5 border-2 font-semibold whitespace-nowrap ${tone} ${sizeClass}`}
    >
      {status.label}
    </span>
  );
};

export default OpeningStatusPill;
