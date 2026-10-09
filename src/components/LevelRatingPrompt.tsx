import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import {
  LEVEL_OPTIONS,
  useSeriesLevelRating,
  type SeriesLevel,
} from '@/hooks/useSeriesLevelRating';
import { buildLevelResult, levelLabel } from '@/lib/levelRatingModel';
import {
  clearPendingLevelRating,
  stashPendingLevelRating,
  takePendingLevelRating,
} from '@/lib/pendingLevelRating';

// Dialog + auth routing load on the first signed-out tap, not with the page.
const SignInSheet = lazyWithRetry(() => import('@/components/LevelRatingSignInSheet'));

// Sign-in returns to the page AT this card, not the top of the page.
export const LEVEL_RATING_ANCHOR = 'level-rating';

type LevelRatingPromptProps = {
  seriesId: string | null | undefined;
  /** Compact = plain 3-chip row for list cards (My Attendance). */
  compact?: boolean;
  className?: string;
  /** Shown instead of nothing while the summary is absent (server render, RPC
   *  failure), so the page never loses information the card would have shown. */
  fallback?: ReactNode;
};

const ratingErrorMessage = (error: unknown) => {
  const text = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? '');
  if (/organisers cannot rate/i.test(text)) return 'Organisers cannot rate their own event.';
  if (/only dancers/i.test(text)) return 'Create a dancer profile to rate events.';
  return "Couldn't save your rating. Please try again.";
};

const TILE_TONE: Record<SeriesLevel, string> = {
  mostly_beginners: 'bg-[linear-gradient(180deg,#566478_0%,#3b4757_100%)] [--edge:#2b3544]',
  mixed: 'bg-[linear-gradient(180deg,#38a9dd_0%,#1d7fb3_100%)] [--edge:#0f5f86]',
  strong: 'bg-[linear-gradient(180deg,#ff9a3c_0%,#e8590c_100%)] [--edge:#a8420a]',
};
const BAR_TONE: Record<SeriesLevel, string> = {
  mostly_beginners: 'bg-[linear-gradient(180deg,#566478,#3b4757)]',
  mixed: 'bg-[linear-gradient(180deg,#4bb8ea,#1d7fb3)]',
  strong: 'bg-[linear-gradient(180deg,#ffb15c,#e8590c)]',
};
const GOLD_WORD =
  'bg-[linear-gradient(180deg,#fff3c4_0%,#ffc247_45%,#f97316_100%)] bg-clip-text text-transparent';
const MIXED_WORD =
  'bg-[linear-gradient(90deg,#38bdf8_0%,#ffc247_50%,#f97316_100%)] bg-clip-text text-transparent';
const TILE_BASE =
  'relative flex min-h-[104px] flex-col items-center gap-2 rounded-[18px] border border-white/20 px-1 pb-3 pt-3.5 text-[13px] font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,.55)] shadow-[inset_0_1.5px_0_rgba(255,255,255,.38),inset_0_-10px_18px_rgba(0,0,0,.18),0_5px_0_var(--edge),0_12px_18px_-6px_rgba(0,0,0,.65)] transition-transform active:translate-y-1 active:shadow-[inset_0_2px_8px_rgba(0,0,0,.35),0_1px_0_var(--edge)] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white';
const TILE_ON = 'translate-y-1 outline outline-2 outline-offset-2 outline-white brightness-110';

export const LevelRatingPrompt = ({ seriesId, compact = false, className, fallback = null }: LevelRatingPromptProps) => {
  const { summary, canRate, rate, isRating } = useSeriesLevelRating(seriesId);
  const location = useLocation();
  const [tapped, setTapped] = useState<SeriesLevel | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [changing, setChanging] = useState(false);
  const cardRef = useRef<HTMLElement | null>(null);
  const scrolled = useRef(false);
  const hasCard = Boolean(seriesId && summary);

  const submit = async (level: SeriesLevel) => {
    try {
      await rate(level);
      setChanging(false);
    } catch (e) {
      // Show the tiles again so "try again" has something to tap.
      setChanging(true);
      toast.error(ratingErrorMessage(e));
    }
  };

  // Back from sign-in: send the level they tapped, once. The stash is removed
  // inside take(), before the call, so a re-render cannot send it twice.
  useEffect(() => {
    if (!seriesId || !canRate) return;
    const pending = takePendingLevelRating(seriesId);
    if (pending) void submit(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId, canRate]);

  // Back from sign-in with #level-rating: bring the card into view once it exists.
  useEffect(() => {
    if (!hasCard || scrolled.current || location.hash !== `#${LEVEL_RATING_ANCHOR}`) return;
    scrolled.current = true;
    cardRef.current?.scrollIntoView({ block: 'center' });
  }, [hasCard, location.hash]);

  // Signed in while the sheet is open (auth finished resolving, or another tab
  // signed in): the vote is sent by the effect above, so the sheet has no job left.
  useEffect(() => {
    if (canRate) {
      setSheetOpen(false);
      setTapped(null);
    }
  }, [canRate]);

  // Nothing renders until the series is known to be public (summary is NULL otherwise).
  if (!seriesId || !summary) return <>{fallback}</>;

  const mine = summary.my_level;
  const result = buildLevelResult(summary);
  const returnTo = `${location.pathname}${location.search}#${LEVEL_RATING_ANCHOR}`;

  const onPick = (level: SeriesLevel) => {
    if (isRating) return;
    if (!canRate) {
      setTapped(level);
      stashPendingLevelRating({ seriesId, level });
      setSheetOpen(true);
      return;
    }
    if (level === mine) {
      setChanging(false);
      return;
    }
    void submit(level);
  };

  const onSheetChange = (open: boolean) => {
    setSheetOpen(open);
    if (!open) {
      clearPendingLevelRating();
      setTapped(null);
    }
  };

  const mineOption = LEVEL_OPTIONS.find((o) => o.value === mine);

  if (compact) {
    if (!canRate) return null;
    return (
      <section
        className={cn('mt-2', className)}
        aria-label="Rate the dancing level of this event"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[11px] text-muted-foreground">{mine ? 'Your rating' : 'What level was the dancing?'}</p>
        <div role="radiogroup" className="mt-1.5 grid grid-cols-3 gap-1.5">
          {LEVEL_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mine === value}
              data-testid={`level-rating-${value}`}
              disabled={isRating}
              onClick={() => onPick(value)}
              className={cn(
                'min-h-[44px] rounded-full border px-2 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 disabled:opacity-60',
                mine === value
                  ? 'border-cyan-300/60 bg-cyan-500/25 text-cyan-50'
                  : 'border-white/20 bg-white/[0.04] text-white/80 hover:border-white/40',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </section>
    );
  }

  const showTiles = result ? changing : !mine || changing;
  const toggleLabel = changing ? 'Hide' : mine ? 'Change your rating' : 'Rate it too';

  return (
    <section
      id={LEVEL_RATING_ANCHOR}
      ref={cardRef}
      aria-label="Rate the dancing level of this event"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'relative overflow-hidden rounded-[20px] border border-[#f5a60a]/35 bg-[linear-gradient(160deg,#1b2f29_0%,#142521_60%,#1a2a22_100%)] px-3.5 pb-3.5 pt-4 shadow-[0_0_0_1px_rgba(245,166,10,.08),0_10px_30px_-12px_rgba(245,166,10,.35)]',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[-40px] h-[200px] w-[340px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,196,80,.34),rgba(249,115,22,.1)_45%,transparent_70%)]"
      />

      {result ? (
        <div className="relative text-center" data-testid="level-rating-result">
          <span className="block text-[11px] font-extrabold uppercase tracking-[.38em] text-[#e9c46a]">
            The dancing was
          </span>
          <span
            data-testid="level-rating-winner"
            className={cn(
              'my-1 block text-[42px] font-black uppercase leading-none tracking-[.03em]',
              result.winner === 'mixed' ? MIXED_WORD : GOLD_WORD,
            )}
          >
            {levelLabel(result.winner)}
          </span>
          {result.line && (
            <span data-testid="level-rating-line" className="block font-serif text-[17px] italic text-[#f6ead0]">
              {result.line}
            </span>
          )}
          {result.bars.length > 0 && (
            <div
              className="mt-4"
              data-testid="level-rating-chart"
              role="img"
              aria-label={result.bars.map((b) => `${b.label}: ${b.count}`).join(', ')}
            >
              <div className="grid h-[170px] grid-cols-3 items-end gap-3.5 border-b-2 border-white/35 px-1.5">
                {result.bars.map((bar) => (
                  <div
                    key={bar.value}
                    data-testid={`level-rating-bar-${bar.value}`}
                    data-zero={bar.count === 0 ? 'true' : undefined}
                    className="flex h-full flex-col items-center justify-end"
                  >
                    <span
                      className={cn(
                        'mb-1.5 font-black leading-none drop-shadow-md',
                        result.soleLeader === bar.value ? 'text-[30px] text-[#ffe08a]' : 'text-[26px]',
                        bar.count === 0 && 'opacity-50',
                      )}
                    >
                      {bar.count}
                    </span>
                    <div
                      className={cn(
                        'min-h-[4px] w-full max-w-[74px] rounded-t-xl rounded-b-sm shadow-[inset_0_2px_0_rgba(255,255,255,.4),0_8px_16px_-6px_rgba(0,0,0,.6)]',
                        BAR_TONE[bar.value],
                        result.soleLeader === bar.value &&
                          'shadow-[inset_0_2px_0_rgba(255,255,255,.5),0_0_0_2px_#ffe08a,0_0_26px_2px_rgba(255,170,40,.65)]',
                        bar.count === 0 && 'opacity-50',
                      )}
                      style={{ height: `${bar.heightPct}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3.5 px-1.5 pt-2 text-center">
                {result.bars.map((bar) => (
                  <div key={bar.value} className="text-[11px] font-bold leading-tight text-[#f6ead0]">
                    <span aria-hidden="true" className="block text-[20px]">
                      {bar.emoji}
                    </span>
                    {bar.label}
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="mt-3 text-[11px] uppercase tracking-[.14em] text-white/60" data-testid="level-rating-based-on">
            Based on {result.total} dancers
          </p>
        </div>
      ) : mine && !changing ? (
        <div className="relative flex items-center gap-3" data-testid="level-rating-thanks">
          <span aria-hidden="true" className="text-[38px] leading-none">
            {mineOption?.emoji}
          </span>
          <div>
            <b className="block text-[18px] text-white">You rated it {mineOption?.label}</b>
            <span className="text-[12px] text-white/60">Thanks for helping other dancers choose.</span>
          </div>
        </div>
      ) : (
        <div className="relative pt-0.5 text-center">
          <span className="block text-[11px] font-extrabold uppercase tracking-[.42em] text-[#e9c46a]">What</span>
          <span className={cn('my-0.5 block text-[54px] font-black uppercase leading-[.95] tracking-[.04em]', GOLD_WORD)}>
            Level
          </span>
          <span className="block font-serif text-[19px] italic text-[#f6ead0]">was the dancing?</span>
        </div>
      )}

      {showTiles && (
        <div
          role="radiogroup"
          aria-label="Choose the level of the dancing"
          className="relative mt-[18px] grid grid-cols-3 gap-2.5 pb-1.5"
        >
          {LEVEL_OPTIONS.map(({ value, label, emoji }) => {
            const on = (canRate ? mine : tapped) === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={on}
                data-testid={`level-rating-${value}`}
                disabled={isRating}
                onClick={() => onPick(value)}
                className={cn(TILE_BASE, TILE_TONE[value], on && TILE_ON)}
              >
                <span aria-hidden="true" className="text-[34px] leading-none drop-shadow-md">
                  {emoji}
                </span>
                {label}
              </button>
            );
          })}
        </div>
      )}

      {(result || mine) && (
        <button
          type="button"
          data-testid="level-rating-toggle"
          aria-expanded={changing}
          onClick={() => setChanging((v) => !v)}
          className="relative mt-3 block min-h-[44px] w-full text-center text-[12px] font-semibold text-[#e9c46a] underline-offset-2 hover:underline"
        >
          {toggleLabel}
        </button>
      )}

      {sheetOpen && (
        <Suspense fallback={null}>
          <SignInSheet open={sheetOpen} onOpenChange={onSheetChange} tappedLabel={tapped ? levelLabel(tapped) : null} returnTo={returnTo} />
        </Suspense>
      )}
    </section>
  );
};
