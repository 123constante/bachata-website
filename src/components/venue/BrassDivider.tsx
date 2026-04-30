/**
 * Plain brass hairline divider for the venue page mosaic.
 * No glyph (Ricky's call 2026-04-30) — just a thin tarnished-brass line
 * that gives sectional rhythm without magazine ornament.
 *
 * Usage:
 *   <BrassDivider />               // default 24px vertical margin
 *   <BrassDivider className="my-3" />  // tighter spacing inside a tile cluster
 */
export const BrassDivider = ({ className = 'my-6' }: { className?: string }) => (
  <hr
    aria-hidden="true"
    className={`border-0 h-px bg-venue-brass/40 ${className}`}
  />
);

export default BrassDivider;
