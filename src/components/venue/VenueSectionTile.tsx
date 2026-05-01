import { type LucideIcon } from 'lucide-react';
import { type ReactNode } from 'react';

/**
 * VenueSectionTile — single primitive for every section in the venue
 * page mosaic grid.
 *
 * Decided 2026-04-30 (Ricky): tiles use the cream palette (#F7F3EA
 * surface + #2A1F10 text) to match the venue directory cards. This
 * inverts the section palette from dark warm-charcoal to cream — the
 * dark page background still contrasts against the light tiles for
 * a magazine-spread feel.
 *
 * Density rule unchanged: mobile is a tight mosaic. Default is
 * col-span-1; tiles whose content cannot read at half-width opt
 * into `wide` and span 2 columns.
 */
export const VenueSectionTile = ({
  eyebrow,
  icon: Icon,
  wide = false,
  children,
}: {
  eyebrow: string;
  icon?: LucideIcon;
  wide?: boolean;
  children: ReactNode;
}) => (
  <div
    className={`bg-venue-card border border-venue-card-border rounded-xl p-3 ${
      wide ? 'col-span-2' : 'col-span-1'
    }`}
  >
    <div className="flex items-center gap-1.5 mb-2">
      {Icon && <Icon className="w-3.5 h-3.5 text-venue-card-mut flex-shrink-0" aria-hidden="true" />}
      <h3 className="text-[11px] uppercase tracking-[0.18em] font-semibold text-venue-card-mut">
        {eyebrow}
      </h3>
    </div>
    {children}
  </div>
);

export default VenueSectionTile;
