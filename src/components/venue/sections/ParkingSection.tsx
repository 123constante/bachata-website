import { Car } from 'lucide-react';
import { VenueSectionTile } from '../VenueSectionTile';

export const ParkingSection = ({
  available,
  notes,
}: {
  available: boolean | null | undefined;
  notes: string | null | undefined;
}) => {
  if (available == null && !notes) return null;
  return (
    <VenueSectionTile eyebrow="PARKING" icon={Car}>
      {available != null && (
        <span
          className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] mb-1 font-semibold ${
            available
              ? 'border-venue-open/40 bg-venue-open/15 text-venue-open'
              : 'border-venue-card-border bg-venue-card-pill text-venue-card-mut'
          }`}
        >
          {available ? 'On-site available' : 'No on-site parking'}
        </span>
      )}
      {notes && <p className="text-xs leading-relaxed text-venue-card-mut">{notes}</p>}
    </VenueSectionTile>
  );
};
export default ParkingSection;
