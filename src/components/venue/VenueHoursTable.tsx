export interface VenueHoursRow {
  day: string;
  display: string;
  isToday: boolean;
}

interface VenueHoursTableProps {
  rows: VenueHoursRow[];
}

export default function VenueHoursTable({ rows }: VenueHoursTableProps) {
  if (rows.length === 0) return null;
  return (
    <div
      className="overflow-hidden rounded-[18px] border"
      style={{
        background: 'var(--va-surface)',
        borderColor: 'var(--va-accent-line)',
        boxShadow:
          '0 0 0 1px color-mix(in srgb, var(--va-halo) 10%, transparent), 0 18px 44px -22px color-mix(in srgb, var(--va-halo) 32%, transparent)',
      }}
    >
      {rows.map((r, i) => {
        const closed = r.display.toLowerCase() === 'closed';
        return (
          <div
            key={r.day}
            className="flex items-center justify-between px-4 py-3"
            style={{
              borderTop: i ? '1px solid var(--va-line)' : 'none',
              background: r.isToday ? 'var(--va-accent-soft)' : 'transparent',
            }}
          >
            <span
              className="text-[14px]"
              style={{
                fontWeight: r.isToday ? 700 : 600,
                color: r.isToday
                  ? 'var(--va-accent)'
                  : closed
                  ? 'var(--va-text3)'
                  : 'var(--va-text)',
              }}
            >
              {r.day}
              {r.isToday ? ' · Today' : ''}
            </span>
            <span
              className="text-[13.5px] font-semibold"
              style={{
                fontVariantNumeric: 'tabular-nums',
                color: r.isToday
                  ? 'var(--va-accent)'
                  : closed
                  ? 'var(--va-text3)'
                  : 'var(--va-text2)',
              }}
            >
              {r.display}
            </span>
          </div>
        );
      })}
    </div>
  );
}
