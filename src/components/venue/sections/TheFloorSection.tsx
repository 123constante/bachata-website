import { Layers, Snowflake } from 'lucide-react';
import { VenueSectionTile } from '../VenueSectionTile';

type Props = {
  floorType: string[] | null;
  facilities: string[] | null;
};

/**
 * TheFloorSection — dance-floor essentials only.
 *
 * Decided 2026-04-30 (Ricky): "the floor should only say what type of
 * floor it is and is air conditioning there". Stripped down from the
 * old facilities-list version.
 *
 * Renders:
 *   - Floor type pill(s) in cumin (matches FeaturePillsRow's floor row)
 *   - Air conditioning Y/N badge — yes if `air_conditioning` is in
 *     facilities_new, no otherwise.
 */
export const TheFloorSection = ({ floorType, facilities }: Props) => {
  const hasFloor = Array.isArray(floorType) && floorType.length > 0;
  const hasAc = Array.isArray(facilities) && facilities.includes('air_conditioning');

  if (!hasFloor && !hasAc) return null;

  return (
    <VenueSectionTile eyebrow="THE FLOOR" icon={Layers}>
      {hasFloor && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {floorType!.map((type, i) => (
            <span
              key={i}
              className="inline-flex items-center rounded-md border border-venue-cumin/50 bg-venue-cumin/15 px-1.5 py-0.5 text-[11px] font-bold text-venue-card-fg"
            >
              {type}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5 text-xs text-venue-card-fg">
        <Snowflake className="w-3.5 h-3.5 text-venue-brass flex-shrink-0" aria-hidden="true" />
        <span>Air conditioning:</span>
        <span className={`font-bold ${hasAc ? 'text-venue-open' : 'text-venue-card-mut'}`}>
          {hasAc ? '✓ Yes' : '— No'}
        </span>
      </div>
    </VenueSectionTile>
  );
};
export default TheFloorSection;
