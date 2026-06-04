import { useFacilityLookup } from '@/hooks/useFacilityOptions';

interface VenueFacilitiesCardProps {
  facilitiesNew: string[] | null;
  floorType: string | null;
  capacity: number | null;
}

const FLOOR_LABELS: Record<string, string> = {
  wood: 'Wooden floor',
  wood_floor: 'Wooden floor',
  sprung: 'Sprung floor',
  sprung_wood: 'Sprung floor',
  sprung_wooden: 'Sprung floor',
  parquet: 'Parquet floor',
  vinyl: 'Vinyl floor',
  concrete: 'Concrete floor',
  carpet: 'Carpet floor',
  tile: 'Tile floor',
};

function floorLabel(raw: string): string {
  const key = raw.toLowerCase().replace(/[\s-]+/g, '_');
  return FLOOR_LABELS[key] ?? raw.charAt(0).toUpperCase() + raw.slice(1).replace(/_/g, ' ');
}

export default function VenueFacilitiesCard({
  facilitiesNew,
  floorType,
  capacity,
}: VenueFacilitiesCardProps) {
  const { lookup } = useFacilityLookup({ dancerFacingOnly: true });

  const topChips: { key: string; label: string }[] = [];
  if (floorType) topChips.push({ key: 'floor', label: floorLabel(floorType) });
  if (capacity) topChips.push({ key: 'cap', label: `~${capacity} capacity` });

  const facilityPills: { key: string; emoji: string | null; label: string }[] = [];
  if (Array.isArray(facilitiesNew)) {
    for (const k of facilitiesNew) {
      const meta = lookup.get(k);
      if (!meta) continue;
      facilityPills.push({ key: k, emoji: meta.emoji, label: meta.label });
    }
  }

  if (topChips.length === 0 && facilityPills.length === 0) return null;

  return (
    <div
      className="overflow-hidden rounded-[18px] border p-4"
      style={{
        background: 'var(--va-surface)',
        borderColor: 'var(--va-accent-line)',
        boxShadow:
          '0 0 0 1px color-mix(in srgb, var(--va-halo) 10%, transparent), 0 18px 44px -22px color-mix(in srgb, var(--va-halo) 32%, transparent)',
      }}
    >
      {topChips.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {topChips.map((c) => (
            <span
              key={c.key}
              className="inline-flex items-center rounded-full px-3 py-1 text-[12px] font-bold"
              style={{
                background: 'var(--va-btn-bg)',
                color: 'var(--va-btn-text)',
                border: '1px solid var(--va-btn-border)',
              }}
            >
              {c.key === 'floor' ? '\u{1F483}' : '\u{1F465}'}{' '}
              {c.label}
            </span>
          ))}
        </div>
      )}

      {facilityPills.length > 0 && (
        <>
          <div
            className="mb-2 text-[9.5px] font-bold uppercase tracking-[0.12em]"
            style={{ color: 'var(--va-text3)' }}
          >
            What you&apos;ll find here
          </div>
          <div className="flex flex-wrap gap-1.5">
            {facilityPills.map((p) => (
              <span
                key={p.key}
                className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium"
                style={{
                  background: 'var(--va-surface2)',
                  borderColor: 'var(--va-line)',
                  color: 'var(--va-text)',
                }}
              >
                {p.emoji && (
                  <span className="text-[13px] leading-none" aria-hidden="true">
                    {p.emoji}
                  </span>
                )}
                {p.label}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
