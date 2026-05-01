import { resolveTubeLine } from '@/lib/tubeLineColour';

/**
 * TubeLineChip — solid pill in the official TfL line colour, name baked
 * inside as text. Locked 2026-04-30 (Ricky): the colour is visually
 * inseparable from the name — no floating colour swatches.
 *
 * Two display modes:
 *   - default ("full") — full line name in the pill, generous letter
 *     spacing for the TfL service-tile look. Use in the Getting Here
 *     section where space allows.
 *   - "abbr" — 2-4 char abbreviation, denser, for the at-a-glance row
 *     where each station chip already squeezes minutes + station name.
 */
export const TubeLineChip = ({
  name,
  variant = 'full',
}: {
  name: string;
  variant?: 'full' | 'abbr';
}) => {
  const line = resolveTubeLine(name);
  const label = variant === 'abbr' ? line.abbr : line.name || name;
  const baseClass =
    'inline-flex items-center justify-center rounded-full font-semibold whitespace-nowrap select-none';
  const sizeClass =
    variant === 'abbr'
      ? 'h-4 min-w-[1.25rem] px-1.5 text-[10px] tracking-tight'
      : 'h-5 px-2 text-[11px] tracking-wide';

  return (
    <span
      className={`${baseClass} ${sizeClass}`}
      style={{ backgroundColor: line.bg, color: line.fg }}
      aria-label={`${line.name || name} line`}
      title={line.name || name}
    >
      {label}
    </span>
  );
};

export default TubeLineChip;
