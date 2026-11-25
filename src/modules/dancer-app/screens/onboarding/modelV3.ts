import type { BuyerRole, MyDancerEdit } from '../../api/types';

/** Dancer onboarding v3 step model (pure; no screens). Prototype v8: STEPS / ORDER / go(). */
export const STEPS_V3 = ['roles', 'styles', 'years', 'partner', 'photo', 'bio'] as const;
export type StepV3 = (typeof STEPS_V3)[number];

/** Progress segments = this list's length. OWNER 2026-11-25: every role has a dancer profile, so `partner` is shown to everyone. */
export const stepsFor = (_buyerRoles: readonly BuyerRole[]): StepV3[] => [...STEPS_V3];

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
  /** Partner YES needs kind + role + years (v8). Absent = not picked. */
  partnerKinds?: readonly string[];
  partnerYears?: string | null;
  hasPhoto: boolean;
};

/** Parts of the YES sheet still missing, in order (mockup pmiss()). */
export const partnerMissing = (d: Pick<DraftV3, 'partnerRole' | 'partnerKinds' | 'partnerYears'>): string[] => {
  const out: string[] = [];
  if (!d.partnerKinds || d.partnerKinds.length === 0) out.push('a kind');
  if (!d.partnerRole) out.push('their role');
  if (!d.partnerYears) out.push('years dancing');
  return out;
};

/** "Pick a kind, their role and years dancing to save." */
export const PARTNER_HINT = (missing: readonly string[]): string =>
  `Pick ${missing.join(', ').replace(/, ([^,]*)$/, ' and $1')} to save.`;

export const partnerCanSave = (d: Pick<DraftV3, 'partnerRole' | 'partnerKinds' | 'partnerYears'>): boolean => partnerMissing(d).length === 0;

/** Save in the sheet closes it and continues to the next step (the consumer wires it). */
export const partnerSaveAdvances = true;

/** Continue on the partner step: YES with an incomplete sheet reopens the sheet, never advances. */
export const partnerContinue = (d: DraftV3): 'reopen-sheet' | 'advance' | 'blocked' => {
  if (d.lookingForPartner === null) return 'blocked';
  if (d.lookingForPartner && !partnerCanSave(d)) return 'reopen-sheet';
  return 'advance';
};

/** Can Continue be pressed on this step? `bio` is optional ("Skip for now"). */
export const stepIsSatisfied = (step: StepV3, d: DraftV3): boolean => {
  switch (step) {
    case 'roles': return d.roles.length >= 1;
    case 'styles': return d.styles.length >= 1;
    case 'years': return d.band !== null;
    case 'partner':
      if (d.lookingForPartner === null) return false;
      return d.lookingForPartner ? partnerCanSave(d) : true;
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

/** Partner sheet vocabulary: prototype label -> the value the server stores (client-only map, no DB change). */
export const PARTNER_KINDS_V3 = [
  { label: 'Social dancing', value: 'Social dancing' },
  { label: 'Classes', value: 'Practice' },
  { label: 'Performance', value: 'Performance' },
  { label: 'Competition', value: 'Competition' },
] as const;
export const PARTNER_ROLES_V3 = [
  { label: 'Leader', value: 'Leader' },
  { label: 'Follower', value: 'Follower' },
  { label: 'Either', value: 'Lead and Follow' },
] as const;
export const PARTNER_YEARS_V3 = [
  { id: '0-2', label: '0-2', min: 0, max: 2 as number | null },
  { id: '2-5', label: '2-5', min: 2, max: 5 as number | null },
  { id: '5+', label: '5+', min: 5, max: null as number | null },
  { id: 'any', label: 'Any', min: null as number | null, max: null as number | null },
] as const;
export type PartnerYearsId = (typeof PARTNER_YEARS_V3)[number]['id'];
export const PARTNER_DETAILS_MAX = 300;

/** The partner screen's answers (stored values for kinds and role). */
export type PartnerDraftV3 = {
  answer: 'yes' | 'no' | null;
  kinds: string[];
  role: string | null;
  years: PartnerYearsId | null;
  details: string;
};

type PartnerProfile = Pick<MyDancerEdit, 'looking_for_partner' | 'partner_search_role' | 'partner_years_min' | 'partner_years_max' | 'partner_details' | 'partner_practice_goals'>;

const yearsIdFor = (min: number | null | undefined, max: number | null | undefined): PartnerYearsId | null => {
  if (min === null || min === undefined) return null;
  return PARTNER_YEARS_V3.find((y) => y.min === min && y.max === (max ?? null))?.id ?? null;
};

/** Draft from SERVER values (resume). */
export const partnerDraftFrom = (p: PartnerProfile): PartnerDraftV3 => ({
  answer: p.looking_for_partner === true ? 'yes' : p.looking_for_partner === false ? 'no' : null,
  kinds: [...(p.partner_practice_goals ?? [])],
  role: p.partner_search_role ?? null,
  years: yearsIdFor(p.partner_years_min, p.partner_years_max),
  details: p.partner_details ?? '',
});

/** Keys to send: "No" sends only looking_for_partner:false. The caller diffs against the server shape. */
export const partnerDelta = (d: PartnerDraftV3): Pick<MyDancerEdit, 'looking_for_partner'> & Partial<PartnerProfile> => {
  if (d.answer !== 'yes') return { looking_for_partner: false };
  const y = PARTNER_YEARS_V3.find((x) => x.id === d.years);
  return {
    looking_for_partner: true,
    partner_search_role: d.role,
    partner_years_min: y ? y.min : null,
    partner_years_max: y ? y.max : null,
    partner_practice_goals: d.kinds,
    partner_details: d.details.trim() === '' ? null : d.details.trim().slice(0, PARTNER_DETAILS_MAX),
  };
};
