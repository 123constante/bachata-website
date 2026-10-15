import { useEffect, useRef, useState } from 'react';
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }} data-testid="level-vote-done">
        <span style={{ fontSize: 14 }}>You said: {levelLabel(mine)}</span>
        <button type="button" className="da-tap" style={{ background: 'none', border: 0, color: 'var(--da-accent)', fontWeight: 700, fontSize: 14 }} onClick={() => setChanging(true)}>
          Change
        </button>
      </div>
    );
  }

  return (
    <div data-testid="level-vote">
      <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 6px' }}>What level was it?</p>
      <div role="radiogroup" aria-label="What level was it?" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {LEVEL_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mine === value}
            data-testid={`vote-${seriesId}-${value}`}
            disabled={isRating || !canRate}
            onClick={() => void submit(value)}
            className="da-tap"
            style={{
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              padding: '0 6px',
              border: '1px solid var(--da-border)',
              background: mine === value ? 'var(--da-accent)' : 'transparent',
              color: mine === value ? 'var(--da-on-accent)' : 'var(--da-text)',
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {profileIncomplete && (
        <p style={{ fontSize: 13, margin: '6px 0 0' }} data-testid="level-vote-held">
          {PROFILE_INCOMPLETE_COPY} Your answer is saved and will be sent when you finish.{' '}
          <Link to={DANCER_WELCOME} style={{ color: 'var(--da-accent)', fontWeight: 700 }}>
            Finish my profile
          </Link>
        </p>
      )}
      {failed && (
        <p role="alert" style={{ fontSize: 13, margin: '6px 0 0', color: 'var(--da-danger)' }}>
          {SAVE_FAILED}
        </p>
      )}
    </div>
  );
};
