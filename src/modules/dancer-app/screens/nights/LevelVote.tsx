import { useEffect, useRef, useState } from 'react';
import { TEXT_ACTION } from '../blocks';
import { Link } from 'react-router-dom';
import { LEVEL_OPTIONS, useSeriesLevelRating, type SeriesLevel } from '@/hooks/useSeriesLevelRating';
import { levelLabel } from '@/lib/levelRatingModel';
import { takePendingLevelRating } from '@/lib/pendingLevelRating';
import { DANCER_WELCOME } from '../../shell/routes';

/** The event page's own words for a vote the server refused for an incomplete profile. */
export const PROFILE_INCOMPLETE_COPY = 'Finish your profile to rate.';
const SAVE_FAILED = "Couldn't save your answer. Please try again.";

/**
 * "What level was it?" on a past night. Keyed by SERIES (useSeriesLevelRating),
 * so a second vote replaces the first, exactly as on the event page. A vote the
 * server refuses (`profile_incomplete`) is held by the hook (pendingLevelRating)
 * and replayed here once `profileComplete` is true.
 */
export const LevelVote = ({ seriesId, profileComplete }: { seriesId: string; profileComplete: boolean }) => {
  const { summary, canRate, rate, isRating, profileIncomplete } = useSeriesLevelRating(seriesId);
  const [changing, setChanging] = useState(false);
  const [failed, setFailed] = useState(false);
  const replayed = useRef(false);

  const submit = async (level: SeriesLevel) => {
    setFailed(false);
    try {
      if ((await rate(level)) === 'saved') setChanging(false);
    } catch {
      setFailed(true);
    }
  };

  // Back from onboarding: send the held answer once (take() removes it first).
  useEffect(() => {
    if (!profileComplete || !canRate || replayed.current) return;
    replayed.current = true;
    const held = takePendingLevelRating(seriesId);
    if (held) {
      rate(held).then(() => setChanging(false), () => setFailed(true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileComplete, canRate, seriesId]);

  // Nothing renders until the series is known to be public (summary is NULL otherwise).
  if (!summary) return null;
  const mine = summary.my_level;

  if (mine && !changing) {
    return (
      <div className="flex flex-wrap items-center gap-[8px]" data-testid="level-vote-done">
        <span className="text-[14px]">You said: {levelLabel(mine)}</span>
        <button type="button" className={TEXT_ACTION} onClick={() => setChanging(true)}>
          Change
        </button>
      </div>
    );
  }

  return (
    <div data-testid="level-vote">
      <p className="mb-[6px] mt-0 text-[14px] font-bold">What level was it?</p>
      <div role="radiogroup" aria-label="What level was it?" className="grid grid-cols-3 gap-[6px]">
        {LEVEL_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mine === value}
            data-testid={`vote-${seriesId}-${value}`}
            disabled={isRating || !canRate}
            onClick={() => void submit(value)}
            className={`da-tap rounded-full border px-[6px] text-[13px] font-semibold${mine === value ? ' da-vote-on' : ' border-[var(--line-strong)] bg-transparent text-[var(--fg)]'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {profileIncomplete && (
        <p className="mb-0 mt-[6px] text-[13px]" data-testid="level-vote-held">
          {PROFILE_INCOMPLETE_COPY} Your answer is saved and will be sent when you finish.{' '}
          <Link to={DANCER_WELCOME} className="font-bold text-[var(--gold-fg,#f5865a)]">
            Finish my profile
          </Link>
        </p>
      )}
      {failed && (
        <p role="alert" className="mb-0 mt-[6px] text-[13px] text-[var(--danger)]">
          {SAVE_FAILED}
        </p>
      )}
    </div>
  );
};
