import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  LEVEL_OPTIONS,
  useSeriesLevelRating,
  type SeriesLevel,
} from '@/hooks/useSeriesLevelRating';

type LevelRatingPromptProps = {
  seriesId: string | null | undefined;
  /** Compact = single-row chip strip for list cards (My Attendance). */
  compact?: boolean;
  className?: string;
};

const errorMessage = (error: unknown) => {
  const text = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? '');
  if (/organisers cannot rate/i.test(text)) return 'Organisers cannot rate their own event.';
  if (/only dancers/i.test(text)) return 'Create a dancer profile to rate events.';
  return "Couldn't save your rating. Please try again.";
};

export const LevelRatingPrompt = ({ seriesId, compact = false, className }: LevelRatingPromptProps) => {
  const { summary, canRate, rate, isRating } = useSeriesLevelRating(seriesId);

  // Signed-out / anonymous visitors get no prompt, and nothing renders until the
  // series is known to be public (summary is NULL otherwise).
  if (!canRate || !summary) return null;

  const mine = summary.my_level;

  const onPick = async (level: SeriesLevel) => {
    if (isRating || level === mine) return;
    try {
      await rate(level);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <section
      className={cn(
        compact ? 'mt-2' : 'rounded-lg border-[0.5px] border-white/15 bg-white/[0.04] p-[14px]',
        className,
      )}
      aria-label="Rate the level of this event"
      onClick={(e) => e.stopPropagation()}
    >
      <p className={cn(compact ? 'text-[11px] text-muted-foreground' : 'text-[14px] font-medium text-white')}>
        {mine ? 'Your level rating' : 'What level is this event?'}
      </p>
      <div role="radiogroup" className="mt-2 flex flex-wrap gap-1.5">
        {LEVEL_OPTIONS.map(({ value, label }) => {
          const selected = mine === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              data-testid={`level-rating-${value}`}
              disabled={isRating}
              onClick={() => void onPick(value)}
              className={cn(
                'rounded-full border px-3 py-1 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 disabled:opacity-60',
                selected
                  ? 'border-cyan-300/60 bg-cyan-500/25 text-cyan-50'
                  : 'border-white/20 bg-white/[0.04] text-white/80 hover:border-white/40',
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-white/55" data-testid="level-rating-progress">
        {summary.vote_count >= summary.threshold
          ? `${summary.vote_count} ratings`
          : `${summary.vote_count} of ${summary.threshold} ratings so far`}
      </p>
    </section>
  );
};
