import { Link } from 'react-router-dom';
import { useSeriesLevelRating } from '@/hooks/useSeriesLevelRating';
import type { Night } from '../nights/nightsModel';
import { nightsPath, shortDate } from '../nights/nightsModel';
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
      className="da-card da-tap"
      data-testid="rate-nudge"
      style={{ display: 'block', textDecoration: 'none', color: 'var(--da-text)' }}
    >
      <b style={{ display: 'block', fontSize: 15 }}>{nudgeTitle(night.date, todayKey)}</b>
      <span className="da-muted" style={{ fontSize: 13 }}>
        {night.name}. How was the dancing level?
      </span>
    </Link>
  );
};

export const RateNudge = ({ candidates, todayKey }: { candidates: readonly Night[]; todayKey: string }) =>
  candidates.length === 0 ? null : <Candidate candidates={candidates} index={0} todayKey={todayKey} />;
