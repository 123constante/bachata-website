import { LEVEL_OPTIONS } from '@/hooks/useSeriesLevelRating';
import type { EventPageDerivedLevel } from '@/modules/event-page/types';

type DerivedLevelBadgeProps = {
  derivedLevel: EventPageDerivedLevel | null;
  levelVoteCount: number | null;
};

// Dancer-rated level. Renders nothing until the series has enough ratings for
// the server to derive a level (derivedLevel is null below the threshold).
export const DerivedLevelBadge = ({ derivedLevel, levelVoteCount }: DerivedLevelBadgeProps) => {
  if (!derivedLevel) return null;
  const label = LEVEL_OPTIONS.find((o) => o.value === derivedLevel)?.label;
  if (!label) return null;
  const count = levelVoteCount ?? 0;
  const hint = `Rated by dancers (${count} ${count === 1 ? 'rating' : 'ratings'})`;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <span
        title={hint}
        aria-label={`${label}. ${hint}`}
        className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-[6px] text-[12px] font-medium text-white/80"
      >
        {label}
      </span>
    </div>
  );
};
