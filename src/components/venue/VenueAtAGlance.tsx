import { Users, Layers, Beer, Shirt, BadgeCheck } from 'lucide-react';
import { OpeningStatusPill } from './OpeningStatusPill';
import type { VenueOpenStatus } from '@/lib/venueOpenStatus';

type AtAGlanceVenue = {
  capacity?: number | string | null;
  floor_type?: unknown;
  bar_available?: boolean | null;
  cloakroom_available?: boolean | null;
  id_required?: boolean | null;
};

/**
 * VenueAtAGlance — chip strip between gallery hero and action row.
 *
 * Decided 2026-04-30 (Ricky):
 *   - The "X min from station" chip used to sit here; removed because
 *     the Getting Here section already carries that info richly.
 *     Avoid duplication — let Getting Here own the journey UX.
 *
 * Remaining chips: open status, capacity, floor type, bar / cloakroom
 * / ID-required. Each is data-gated.
 */
export const VenueAtAGlance = ({
  venue,
  status,
}: {
  venue: AtAGlanceVenue;
  status: VenueOpenStatus;
}) => {
  const floorType = Array.isArray(venue.floor_type) && venue.floor_type.length > 0
    ? String(venue.floor_type[0])
    : typeof venue.floor_type === 'string' && venue.floor_type.length > 0
    ? venue.floor_type
    : null;

  const chips: React.ReactNode[] = [];

  if (status.status !== 'unknown') {
    chips.push(<OpeningStatusPill key="status" status={status} />);
  }

  if (venue.capacity) {
    chips.push(
      <span key="cap" className={CHIP_CLASS}>
        <Users className="w-3 h-3 flex-shrink-0 text-venue-brass" aria-hidden="true" />
        Holds ~{venue.capacity}
      </span>,
    );
  }

  if (floorType) {
    chips.push(
      <span key="floor" className={CHIP_CLASS}>
        <Layers className="w-3 h-3 flex-shrink-0 text-venue-brass" aria-hidden="true" />
        {labelForFloor(floorType)}
      </span>,
    );
  }

  if (venue.bar_available) {
    chips.push(
      <span key="bar" className={CHIP_CLASS}>
        <Beer className="w-3 h-3 flex-shrink-0 text-venue-brass" aria-hidden="true" />
        Bar
      </span>,
    );
  }

  if (venue.cloakroom_available) {
    chips.push(
      <span key="cloak" className={CHIP_CLASS}>
        <Shirt className="w-3 h-3 flex-shrink-0 text-venue-brass" aria-hidden="true" />
        Cloakroom
      </span>,
    );
  }

  if (venue.id_required) {
    chips.push(
      <span key="id" className={CHIP_CLASS}>
        <BadgeCheck className="w-3 h-3 flex-shrink-0 text-venue-brass" aria-hidden="true" />
        ID required
      </span>,
    );
  }

  if (chips.length === 0) return null;

  return (
    <div
      className="-mx-3 mb-3 flex gap-2 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
      role="list"
      aria-label="Venue at a glance"
    >
      {chips.map((c, i) => (
        <div role="listitem" key={i} className="snap-start">
          {c}
        </div>
      ))}
    </div>
  );
};

const CHIP_CLASS =
  'inline-flex h-7 items-center gap-1.5 rounded-md border border-venue-line bg-venue-surface px-2.5 text-xs font-medium text-venue-cream whitespace-nowrap';

const labelForFloor = (raw: string): string => {
  const k = raw.toLowerCase().replace(/[\s_-]+/g, '_');
  const map: Record<string, string> = {
    wood: 'Wooden floor',
    wood_floor: 'Wooden floor',
    sprung: 'Sprung floor',
    sprung_wood: 'Sprung wood floor',
    parquet: 'Parquet floor',
    vinyl: 'Vinyl floor',
    concrete: 'Concrete floor',
    carpet: 'Carpet floor',
    tile: 'Tile floor',
  };
  if (k in map) return map[k];
  return raw.charAt(0).toUpperCase() + raw.slice(1).replace(/_/g, ' ') + ' floor';
};

export default VenueAtAGlance;
