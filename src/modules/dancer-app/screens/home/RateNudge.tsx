import { Link } from 'react-router-dom';
import { useSeriesLevelRating } from '@/hooks/useSeriesLevelRating';
import type { Night } from '../nights/nightsModel';
import { nightsPath, shortDate } from '../nights/nightsModel';

/**
 * ONE card, "Rate last night's event": the most recent night (last 7 days, Going)
 * whose series the person has not rated. Walks the candidates one hook at a time;
 * a rated (or non-public) series falls through to the next, and after a vote the
 * summary refetches so the card goes away.
 */
const Candidate = ({ candidates, index }: { candidates: readonly Night[]; index: number }) => {
  const night = candidates[index];
  const { summary, isLoading, canRate } = useSeriesLevelRating(night?.seriesId);
  if (!night) return null;
  if (isLoading) return null;
  if (!summary || summary.my_level || !canRate) return <Candidate candidates={candidates} index={index + 1} />;
  return (
    <Link
      to={nightsPath(night.seriesId)}
      className="da-card da-tap"
      data-testid="rate-nudge"
      style={{ display: 'block', textDecoration: 'none', color: 'var(--da-text)' }}
    >
      <b style={{ display: 'block', fontSize: 15 }}>Rate last night&rsquo;s event</b>
      <span className="da-muted" style={{ fontSize: 13 }}>
        {night.name} &middot; {shortDate(night.date)}. How was the dancing level?
      </span>
    </Link>
  );
};

export const RateNudge = ({ candidates }: { candidates: readonly Night[] }) =>
  candidates.length === 0 ? null : <Candidate candidates={candidates} index={0} />;
