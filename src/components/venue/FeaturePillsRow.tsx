import { Layers, Beer, Shirt, BadgeCheck, Sparkles, Users } from 'lucide-react';
import { useFacilityLookup } from '@/hooks/useFacilityOptions';

type Props = {
  facilities: string[] | null;
  floorType: string[] | null;
  capacity: number | string | null | undefined;
  barAvailable?: boolean | null;
  cloakroomAvailable?: boolean | null;
  idRequired?: boolean | null;
};

/**
 * FeaturePillsRow — exciting visual roll-call of every feature this
 * venue has. Sits below the media hero.
 *
 * Decided 2026-04-30 (Ricky):
 *   - Floor type lives in its OWN MINI-ROW at the top, visually
 *     distinct (cumin border) so dancers spot it immediately.
 *   - Capacity becomes a pill with a 👥 emoji in the main row.
 *   - "Features" tile + at-a-glance chip strip both removed elsewhere
 *     so this is the single source of truth for what the venue has.
 *
 * Sources:
 *   - facility_options canonical keys + emojis (via useFacilityLookup)
 *   - floor_type[] (its own mini-row pill)
 *   - capacity (👥 pill)
 *   - bar / cloakroom / ID-required boolean flags
 */
export const FeaturePillsRow = ({
  facilities,
  floorType,
  capacity,
  barAvailable,
  cloakroomAvailable,
  idRequired,
}: Props) => {
  const { lookup } = useFacilityLookup({ dancerFacingOnly: true });

  type Pill = { key: string; emoji: string | null; label: string; tone: 'social' | 'practical' | 'access' | 'capacity' };
  const pills: Pill[] = [];

  if (capacity) {
    pills.push({ key: 'cap', emoji: '👥', label: `Holds ~${capacity}`, tone: 'capacity' });
  }

  if (Array.isArray(facilities)) {
    for (const k of facilities) {
      const meta = lookup.get(k);
      if (!meta) continue;
      pills.push({ key: `fac:${k}`, emoji: meta.emoji ?? null, label: meta.label, tone: 'practical' });
    }
  }

  if (barAvailable) pills.push({ key: 'flag:bar', emoji: '🍹', label: 'Bar available', tone: 'social' });
  if (cloakroomAvailable) pills.push({ key: 'flag:cloak', emoji: '🧥', label: 'Cloakroom', tone: 'practical' });
  if (idRequired) pills.push({ key: 'flag:id', emoji: '🪪', label: 'ID required', tone: 'access' });

  // Floor mini-row (separate, dancer-relevant, sits above the rest).
  const floorPills: { key: string; label: string }[] = [];
  if (Array.isArray(floorType)) {
    for (const ft of floorType) {
      if (!ft) continue;
      const norm = ft.toLowerCase().replace(/[\s_-]+/g, '_');
      const labelMap: Record<string, string> = {
        wood: 'Wooden floor', wood_floor: 'Wooden floor',
        sprung: 'Sprung floor', sprung_wood: 'Sprung wood floor',
        parquet: 'Parquet floor', vinyl: 'Vinyl floor',
        concrete: 'Concrete floor', carpet: 'Carpet floor', tile: 'Tile floor',
      };
      const label = labelMap[norm] ?? ft.charAt(0).toUpperCase() + ft.slice(1).replace(/_/g, ' ') + ' floor';
      floorPills.push({ key: `floor:${ft}`, label });
    }
  }

  if (pills.length === 0 && floorPills.length === 0) return null;

  const toneRing: Record<Pill['tone'], string> = {
    capacity: 'border-venue-ember/50 hover:border-venue-ember bg-venue-ember/10',
    social: 'border-venue-ember/40 hover:border-venue-ember',
    practical: 'border-venue-brass/40 hover:border-venue-brass',
    access: 'border-venue-rose/40 hover:border-venue-rose',
  };
  const toneIcon: Record<Pill['tone'], JSX.Element> = {
    capacity: <Users className="w-3 h-3 text-venue-ember" aria-hidden="true" />,
    social: <Beer className="w-3 h-3 text-venue-ember" aria-hidden="true" />,
    practical: <Sparkles className="w-3 h-3 text-venue-brass" aria-hidden="true" />,
    access: <BadgeCheck className="w-3 h-3 text-venue-rose" aria-hidden="true" />,
  };

  return (
    <section aria-label="Venue features" className="mb-3">
      {floorPills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {floorPills.map((p) => (
            <span
              key={p.key}
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-venue-cumin/50 bg-venue-cumin/15 px-3 py-1 text-sm font-bold text-venue-cumin"
            >
              <Layers className="w-4 h-4" aria-hidden="true" />
              {p.label}
            </span>
          ))}
        </div>
      )}
      {pills.length > 0 && (
        <>
          <h3 className="text-[11px] uppercase tracking-[0.18em] font-semibold text-venue-brass mb-1.5">
            What you'll find here
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {pills.map((p) => (
              <span
                key={p.key}
                className={`inline-flex items-center gap-1.5 rounded-full border bg-venue-surface px-2.5 py-1 text-xs font-medium text-venue-cream transition-colors ${toneRing[p.tone]}`}
              >
                {p.emoji ? (
                  <span className="text-sm leading-none" aria-hidden="true">{p.emoji}</span>
                ) : (
                  toneIcon[p.tone]
                )}
                {p.label}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
};

export default FeaturePillsRow;
