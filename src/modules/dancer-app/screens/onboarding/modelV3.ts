import type { BuyerRole, MyDancerEdit } from '../../api/types';

/** Dancer onboarding v3 step model (pure; no screens). Prototype v8: STEPS / ORDER / go(). */
export const STEPS_V3 = ['roles', 'styles', 'years', 'partner', 'photo', 'bio'] as const;
export type StepV3 = (typeof STEPS_V3)[number];

/** Progress segments = this list's length. `partner` is skipped (both directions) without the dancer role. */
export const stepsFor = (buyerRoles: readonly BuyerRole[]): StepV3[] =>
  STEPS_V3.filter((s) => s !== 'partner' || buyerRoles.includes('dancer'));

export type YearBandV3 = 'under-1' | 'one-two' | 'three-five' | 'six-ten' | 'over-10';

/** `back` = N in `now.getFullYear() - N` (prototype 2026 -> 2026, 2024, 2021, 2016, 2010). */
export const YEAR_BANDS_V3: ReadonlyArray<{ id: YearBandV3; label: string; back: number }> = [
  { id: 'under-1', label: 'Under 1 year', back: 0 },
  { id: 'one-two', label: '1 to 2 years', back: 2 },
  { id: 'three-five', label: '3 to 5 years', back: 5 },
  { id: 'six-ten', label: '6 to 10 years', back: 10 },
  { id: 'over-10', label: 'Over 10 years', back: 16 },
];

export const yearForBandV3 = (band: YearBandV3, now: number = new Date().getFullYear()): number =>
  now - (YEAR_BANDS_V3.find((b) => b.id === band)?.back ?? 0);

export const bandForYearV3 = (year: number | null, now: number = new Date().getFullYear()): YearBandV3 | null => {
  if (year === null) return null;
  const age = Math.max(0, now - year);
  if (age < 1) return 'under-1';
  if (age <= 2) return 'one-two';
  if (age <= 5) return 'three-five';
  if (age <= 10) return 'six-ten';
  return 'over-10';
};

export type DraftV3 = {
  roles: readonly BuyerRole[];
  styles: readonly string[];
  band: YearBandV3 | null;
  /** null = not answered. */
  lookingForPartner: boolean | null;
  partnerRole: string | null;
  hasPhoto: boolean;
};

/** Can Continue be pressed on this step? `bio` is optional ("Skip for now"). */
export const stepIsSatisfied = (step: StepV3, d: DraftV3): boolean => {
  switch (step) {
    case 'roles': return d.roles.length >= 1;
    case 'styles': return d.styles.length >= 1;
    case 'years': return d.band !== null;
    case 'partner':
      if (d.lookingForPartner === null) return false;
      return d.lookingForPartner ? !!d.partnerRole : true;
    case 'photo': return d.hasPhoto;
    case 'bio': return true;
  }
};

/** Celebrate when LEAVING a step going forward (never Back). `bio` only when a bio or a link was filled. */
export const celebratesOnLeave = (step: StepV3, filled: { bio: boolean; link: boolean }): boolean => {
  switch (step) {
    case 'styles':
    case 'years':
    case 'partner':
    case 'photo': return true;
    case 'bio': return filled.bio || filled.link;
    case 'roles': return false;
  }
};

type ResumeProfile = Pick<MyDancerEdit, 'buyer_roles' | 'favorite_styles' | 'dance_started_year' | 'avatar_url' | 'looking_for_partner'>;

/** First v3 step still missing from SERVER data; all done -> 'done'. `bio` never counts as missing. */
export const resumeStep = (p: ResumeProfile): StepV3 | 'done' => {
  if (p.buyer_roles.length === 0) return 'roles';
  if (p.favorite_styles.length === 0) return 'styles';
  if (p.dance_started_year === null) return 'years';
  if (p.buyer_roles.includes('dancer') && (p.looking_for_partner === null || p.looking_for_partner === undefined)) return 'partner';
  if (p.avatar_url === null) return 'photo';
  return 'done';
};
