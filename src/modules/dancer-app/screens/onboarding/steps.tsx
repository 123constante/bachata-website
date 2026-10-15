import { Suspense, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { DancerDelta, MyDancerEdit } from '../../api/types';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { DISPLAY_NAME_MAX, ROLE_CHOICES } from './model';
import { Chip, ErrorLine, Field, PrimaryButton, Question, Reason, Tag, textInput, wrap } from './ui';

/**
 * The real CityPicker (319 cities), loaded only when the city card shows: it drags cmdk, the popover and
 * the dialog with it, which would put ~27 KB on every /app route's first load (perf-budgets.json).
 */
const CityPicker = lazyWithRetry(() => import('@/components/ui/city-picker').then((m) => ({ default: m.CityPicker })));

/** Where the photo screen sends the person back to. */
export const PHOTO_HANDOFF = '/app/me/photo?return=/app/welcome';

export type CardProps = {
  profile: MyDancerEdit;
  busy: boolean;
  error: string | null;
  /** Save ONLY these keys (the parent diffs them against the server shape). */
  onSubmit: (delta: DancerDelta) => void;
  /** "n of m" for the required cards, else null. */
  tag?: string | null;
};

export const NameCard = ({ profile, busy, error, onSubmit, tag }: CardProps) => {
  const [first, setFirst] = useState(profile.first_name ?? '');
  const [display, setDisplay] = useState(profile.display_name ?? '');
  const ready = first.trim() !== '';
  return (
    <>
      {tag ? <Tag>{tag}</Tag> : null}
      <Question>What&rsquo;s your name?</Question>
      <Field id="ob-first" label="First name">
        <input id="ob-first" autoComplete="given-name" value={first} onChange={(e) => setFirst(e.target.value)} style={textInput} />
      </Field>
      <Field id="ob-display" label="Name shown on your page (optional)" hint={`Up to ${DISPLAY_NAME_MAX} characters, no links.`}>
        <input id="ob-display" value={display} maxLength={DISPLAY_NAME_MAX} onChange={(e) => setDisplay(e.target.value)} style={textInput} />
      </Field>
      <ErrorLine message={error} />
      <PrimaryButton busy={busy} disabled={!ready} onClick={() => onSubmit({ first_name: first.trim(), display_name: display.trim() })}>
        Continue
      </PrimaryButton>
      {!ready ? <Reason>Enter your first name to continue.</Reason> : null}
    </>
  );
};

export const CityCard = ({ profile, busy, error, onSubmit, tag }: CardProps) => {
  const [city, setCity] = useState(profile.based_city_id ?? '');
  return (
    <>
      {tag ? <Tag>{tag}</Tag> : null}
      <Question>Where do you dance?</Question>
      <Field id="ob-city" label="Your city">
        <Suspense fallback={<div aria-busy="true" style={{ minHeight: 48, borderRadius: 12, background: 'var(--da-surface-2)' }} />}>
          <CityPicker value={city} onChange={(id) => setCity(id)} placeholder="Search for your city" className="min-h-[48px] w-full" />
        </Suspense>
      </Field>
      <ErrorLine message={error} />
      <PrimaryButton busy={busy} disabled={!city} onClick={() => onSubmit({ based_city_id: city })}>
        Continue
      </PrimaryButton>
      {!city ? <Reason>Pick your city from the list to continue.</Reason> : null}
    </>
  );
};

export const RoleCard = ({ profile, busy, error, onSubmit, tag }: CardProps) => {
  const [role, setRole] = useState(profile.dance_role);
  return (
    <>
      {tag ? <Tag>{tag}</Tag> : null}
      <Question>How do you dance?</Question>
      <div role="radiogroup" aria-label="How you dance" style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
        {ROLE_CHOICES.map((c) => (
          <Chip key={c.value} label={c.label} selected={role === c.value} onClick={() => setRole(c.value)} />
        ))}
      </div>
      <ErrorLine message={error} />
      <PrimaryButton busy={busy} disabled={!role} onClick={() => role && onSubmit({ dance_role: role })}>
        Continue
      </PrimaryButton>
      {!role ? <Reason>Pick Leader, Follower or Both to continue.</Reason> : null}
    </>
  );
};

/** Cannot be skipped: there is no Continue or Skip, only the hand-off to the photo screen. */
export const PhotoCard = ({ tag }: Pick<CardProps, 'tag'>) => (
  <>
    {tag ? <Tag>{tag}</Tag> : null}
    <Question>Add your photo</Question>
    <div
      aria-hidden="true"
      data-testid="onboarding-photo-guide"
      style={{ height: 150, borderRadius: 14, border: '2px dashed var(--da-border)', display: 'grid', placeItems: 'center', marginBottom: 8 }}
    >
      <svg width="120" height="120" viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="5 4" opacity="0.7">
        <ellipse cx="60" cy="42" rx="22" ry="28" />
        <path d="M14 112c4-26 24-36 46-36s42 10 46 36" />
      </svg>
    </div>
    <p style={{ ...wrap, fontSize: 14, margin: '0 0 12px' }}>Head and shoulders inside the outline. This is how people find you.</p>
    <div style={{ display: 'grid', gap: 8 }}>
      <Link to={PHOTO_HANDOFF} className="da-tap" data-testid="onboarding-take-photo" style={linkBtn(true)}>
        Take photo
      </Link>
      <Link to={PHOTO_HANDOFF} className="da-tap" data-testid="onboarding-choose-photo" style={linkBtn(false)}>
        Choose from my photos
      </Link>
    </div>
    <Reason>A photo is needed to finish setting up your page, so this step cannot be skipped.</Reason>
  </>
);

const linkBtn = (primary: boolean) => ({
  minHeight: 48,
  borderRadius: 12,
  fontSize: 16,
  fontWeight: 700,
  width: '100%',
  background: primary ? 'var(--da-accent)' : 'transparent',
  color: primary ? 'var(--da-on-accent)' : 'inherit',
  border: primary ? 'none' : '1px solid var(--da-border)',
});

