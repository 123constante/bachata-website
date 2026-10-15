import { useState } from 'react';
import { useLazy } from './useLazy';
import { EXPERIENCE_BANDS, startedYearForBand, type ExperienceBandId } from './model';
import type { CardProps } from './steps';
import { Chip, ErrorLine, GhostButton, PrimaryButton, Question, Reason, Tag } from './ui';

// The style list is the public page's own (dancerConstants), loaded on demand: see useLazy.

export const YearsCard = ({ busy, error, onSubmit, onSkip }: CardProps & { onSkip: () => void }) => {
  const [band, setBand] = useState<ExperienceBandId | null>(null);
  return (
    <>
      <Tag>Optional &middot; +10%</Tag>
      <Question>How long have you been dancing?</Question>
      <div role="radiogroup" aria-label="How long you have been dancing" style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
        {EXPERIENCE_BANDS.map((b) => (
          <Chip key={b.id} label={b.label} selected={band === b.id} onClick={() => setBand(b.id)} />
        ))}
      </div>
      <ErrorLine message={error} />
      <div style={{ display: 'grid', gap: 8 }}>
        <PrimaryButton busy={busy} disabled={!band} onClick={() => band && onSubmit({ dance_started_year: startedYearForBand(band) })}>
          Continue
        </PrimaryButton>
        <GhostButton onClick={onSkip} testId="onboarding-skip">
          Skip
        </GhostButton>
      </div>
      {!band ? <Reason>Pick one to continue, or skip this question.</Reason> : null}
    </>
  );
};

export const StylesCard = ({ profile, busy, error, onSubmit, onSkip }: CardProps & { onSkip: () => void }) => {
  const [picked, setPicked] = useState<string[]>(profile.favorite_styles);
  const styles = useLazy(() => import('@/components/profile/dancerConstants'))?.FAVORITE_STYLE_OPTIONS ?? [];
  const toggle = (s: string) => setPicked((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
  return (
    <>
      <Tag>Optional &middot; +10%</Tag>
      <Question>Which styles do you love?</Question>
      <div role="group" aria-label="Styles you love" style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
        {styles.map((s) => (
          <Chip key={s} multi label={s} selected={picked.includes(s)} onClick={() => toggle(s)} />
        ))}
      </div>
      <ErrorLine message={error} />
      <div style={{ display: 'grid', gap: 8 }}>
        <PrimaryButton busy={busy} disabled={picked.length === 0} onClick={() => onSubmit({ favorite_styles: picked })}>
          Continue
        </PrimaryButton>
        <GhostButton onClick={onSkip} testId="onboarding-skip">
          Skip
        </GhostButton>
      </div>
      {picked.length === 0 ? <Reason>Pick at least one style to continue, or skip this question.</Reason> : null}
    </>
  );
};
