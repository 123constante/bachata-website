import { LEVEL_OPTIONS } from '@/hooks/useSeriesLevelRating';
import type { EventPageDerivedLevel } from '@/modules/event-page/types';

type DerivedLevelBadgeProps = {
  derivedLevel: EventPageDerivedLevel | null;
  levelVoteCount: number | null;
};

// Source label for the dancer-rated level, the counterpart of the schedule's
// "Organiser says:" line (ScheduleBlock ORGANISER_LEVEL_LABEL).
export const DANCER_LEVEL_LABEL = 'Dancers rate:';

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
        data-testid="derived-level-badge"
        title={hint}
        className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-[6px] text-[12px] font-medium text-white/80"
      >
        <span className="text-white/70">{DANCER_LEVEL_LABEL}</span> {label}
        {/* aria-label on a role-less span is ignored by screen readers, so
            the rating count is announced through visually-hidden text. */}
        <span className="sr-only">. {hint}</span>
      </span>
    </div>
  );
};
