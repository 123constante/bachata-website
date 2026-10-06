import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  LEVEL_OPTIONS,
  useSeriesLevelRating,
  type SeriesLevel,
} from '@/hooks/useSeriesLevelRating';

type LevelRatingPromptProps = {
  seriesId: string | null | undefined;
  /**
   * Compact = chip strip for list cards (My Attendance), where the dancer can
   * see and change their vote. The default (event page) variant is one-tap:
   * it only shows while the dancer has not rated, and disappears once they do.
   */
  compact?: boolean;
  className?: string;
};

// Event-page tile presentation (emoji as escapes: raw Unicode corrupts on the
// cp1252 pipeline). The tile says 'Open'; the API value stays open_level.
const TILE_EMOJI: Record<SeriesLevel, string> = {
  beginner: '\u{1F331}',
  improver: '\u{1F642}',
  intermediate: '\u{1F525}',
  advanced: '\u{26A1}',
  open_level: '\u{1F30D}',
};
const TILE_LABEL: Partial<Record<SeriesLevel, string>> = { open_level: 'Open' };

export const RATED_TOAST = 'Thanks! You can change your rating in your dashboard.';

const errorMessage = (error: unknown) => {
  const text = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? '');
  if (/organisers cannot rate/i.test(text)) return 'Organisers cannot rate their own event.';
  if (/only dancers/i.test(text)) return 'Create a dancer profile to rate events.';
  return "Couldn't save your rating. Please try again.";
};

const progressText = (count: number, threshold: number) =>
  count >= threshold ? `${count} ratings` : `${count} of ${threshold} ratings so far`;

export const LevelRatingPrompt = ({ seriesId, compact = false, className }: LevelRatingPromptProps) => {
  const { summary, canRate, rate, isRating } = useSeriesLevelRating(seriesId);
  const [pending, setPending] = useState<SeriesLevel | null>(null);

  // Signed-out / anonymous visitors get no prompt, and nothing renders until the
  // series is known to be public (summary is NULL otherwise).
  if (!canRate || !summary) return null;

  const mine = summary.my_level;

  // One-tap rule: on the event page a dancer who has already rated sees nothing;
  // changing a vote happens on the dashboard (compact variant) only. A
  // successful save writes my_level into the cache (see the hook), so the card
  // unmounts right after the tap.
  if (!compact && mine) return null;

  const onPick = async (level: SeriesLevel) => {
    if (isRating || level === mine) return;
    setPending(level);
    try {
      await rate(level);
      if (!compact) toast.success(RATED_TOAST);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setPending(null);
    }
  };

  const progress = (
    <p className="text-[11px] text-white/55" data-testid="level-rating-progress">
      {progressText(summary.vote_count, summary.threshold)}
    </p>
  );

  if (compact) {
    return (
      <section
        className={cn('mt-2', className)}
        aria-label="Rate the level of this event"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[11px] text-muted-foreground">
          {mine ? 'Your level rating' : 'What level is this event?'}
        </p>
        <div role="radiogroup" className="mt-1.5 flex flex-wrap gap-1.5">
          {LEVEL_OPTIONS.map(({ value, label, meaning }) => {
            const selected = mine === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-busy={pending === value || undefined}
                title={meaning}
                data-testid={`level-rating-${value}`}
                disabled={isRating}
                onClick={() => void onPick(value)}
                className={cn(
                  'min-h-[32px] rounded-full border px-3 py-1 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 disabled:opacity-60',
                  selected
                    ? 'border-cyan-300/70 bg-cyan-500/20 text-cyan-50'
                    : 'border-white/15 bg-white/[0.04] text-white/80 hover:border-cyan-300/40',
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="mt-1.5">{progress}</div>
      </section>
    );
  }

  const pct = summary.threshold > 0 ? Math.min(100, (summary.vote_count / summary.threshold) * 100) : 100;
  const met = summary.vote_count >= summary.threshold;

  return (
    <section
      className={cn(
        'rounded-2xl border border-cyan-400/20 bg-white/[0.04] p-[18px]',
        className,
      )}
      aria-label="Rate the level of this event"
      data-testid="level-rating-card"
      onClick={(e) => e.stopPropagation()}
    >
      <h3 className="text-[15px] font-semibold text-white">Been to this one, or know the level?</h3>
      <div role="radiogroup" aria-label="Level" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {LEVEL_OPTIONS.map(({ value, label }) => {
          const isPending = pending === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={isPending}
              aria-busy={isPending || undefined}
              aria-label={TILE_LABEL[value] ?? label}
              data-testid={`level-rating-${value}`}
              disabled={isRating}
              onClick={() => void onPick(value)}
              className={cn(
                'flex min-h-[76px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl border p-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed',
                value === 'open_level' && 'col-span-2 sm:col-span-1',
                isPending
                  ? 'border-cyan-300/80 bg-cyan-500/20'
                  : 'border-white/15 bg-white/[0.03] hover:border-cyan-300/50 active:bg-cyan-500/10',
                isRating && !isPending && 'opacity-50',
              )}
            >
              <span className="text-2xl leading-none" aria-hidden="true">
                {TILE_EMOJI[value]}
              </span>
              <span className="text-[13px] font-semibold text-white" aria-hidden="true">
                {TILE_LABEL[value] ?? label}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/10" aria-hidden="true">
        <div className="h-full rounded-full bg-cyan-400" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-[11px] text-white/55" data-testid="level-rating-progress">
        {met
          ? `${summary.vote_count} ratings`
          : `${summary.vote_count} of ${summary.threshold} ratings. The level shows publicly at ${summary.threshold}.`}
      </p>
    </section>
  );
};
