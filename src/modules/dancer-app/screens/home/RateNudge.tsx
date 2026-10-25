import { Link } from 'react-router-dom';
import { Check, ChevronRight } from 'lucide-react';
import { TILE_CLASS } from '../blocks';
import { useSeriesLevelRating } from '@/hooks/useSeriesLevelRating';
import type { Night } from '../nights/nightsModel';
import { nightsPath, shortDate } from '../nights/nightsDates';
import { londonDaysBetweenKeys } from '@/lib/londonDate';

/**
 * Audit L4: the card names the night. "Rate last night" only when it WAS last
 * night; otherwise the date ("Rate Sat 10 Oct"), so a 6-day-old night never
 * reads as last night.
 */
export const nudgeTitle = (dateKey: string | null, todayKey: string): string =>
  dateKey && londonDaysBetweenKeys(dateKey, todayKey) === 1 ? 'Rate last night' : `Rate ${shortDate(dateKey)}`;

/**
 * ONE rating card (title from nudgeTitle): the most recent night (last 7 days, Going)
 * whose series the person has not rated. Walks the candidates one hook at a time;
 * a rated (or non-public) series falls through to the next, and after a vote the
 * summary refetches so the card goes away.
 */
const Candidate = ({ candidates, index, todayKey }: { candidates: readonly Night[]; index: number; todayKey: string }) => {
  const night = candidates[index];
  const { summary, isLoading, canRate } = useSeriesLevelRating(night?.seriesId);
  if (!night) return null;
  if (isLoading) return null;
  if (!summary || summary.my_level || !canRate) return <Candidate candidates={candidates} index={index + 1} todayKey={todayKey} />;
  return (
    <Link
      to={nightsPath(night.seriesId)}
      className={`${TILE_CLASS} da-tap`}
      data-testid="rate-nudge"
    >
      {/* Review S4: the prototype's row -- tick tile, title over body, chevron. */}
      <span className="flex items-center gap-[12px]">
        <span aria-hidden="true" className="da-tone-violet grid h-[40px] w-[40px] shrink-0 place-items-center rounded-[12px]">
          <Check className="h-[22px] w-[22px]" />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-[15px]">{nudgeTitle(night.date, todayKey)}</b>
          <span className="block text-[13px] text-[var(--mut)]">
            {night.name}. How was the dancing level?
          </span>
        </span>
        <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[var(--mut)]" />
      </span>
    </Link>
  );
};

export const RateNudge = ({ candidates, todayKey }: { candidates: readonly Night[]; todayKey: string }) =>
  candidates.length === 0 ? null : <Candidate candidates={candidates} index={0} todayKey={todayKey} />;
