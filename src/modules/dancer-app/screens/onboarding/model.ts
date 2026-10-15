import type { DanceRole, MyDancerEdit, StrengthStep } from '../../api/types';

/** The cards, in the order the mockup shows them. */
export type Stage = 'name' | 'city' | 'role' | 'photo' | 'in' | 'years' | 'styles' | 'nice';

/** The four steps that make a profile complete (the server's 70%): asked only while missing. */
export const REQUIRED_STAGES = ['name', 'city', 'role', 'photo'] as const;
export type RequiredStage = (typeof REQUIRED_STAGES)[number];

const MISSING_TO_STAGE: Record<RequiredStage, StrengthStep> = {
  name: 'first_name',
  city: 'city',
  role: 'role',
  photo: 'photo',
};

/** Is this required card still missing on the server? */
export const requiredMissing = (profile: Pick<MyDancerEdit, 'strength'>, s: RequiredStage): boolean =>
  profile.strength.missing.includes(MISSING_TO_STAGE[s]);

/** The first required card still missing on the server, or null when the profile is complete. */
export const firstRequiredStage = (missing: readonly StrengthStep[]): RequiredStage | null =>
  REQUIRED_STAGES.find((s) => missing.includes(MISSING_TO_STAGE[s])) ?? null;

/** The two optional cards still worth asking, in order. */
export const optionalStagesLeft = (missing: readonly StrengthStep[]): Array<'years' | 'styles'> => {
  const out: Array<'years' | 'styles'> = [];
  if (missing.includes('started_year')) out.push('years');
  if (missing.includes('styles')) out.push('styles');
  return out;
};

/** Where the person is (re)started from the server shape alone: this is also the resume rule. */
export const stageFor = (profile: Pick<MyDancerEdit, 'strength'>): Stage | 'done' => {
  const { missing } = profile.strength;
  const required = firstRequiredStage(missing);
  if (required) return required;
  return optionalStagesLeft(missing).length > 0 ? 'in' : 'done';
};

/** After a save: the next card, from the shape the server just returned. */
export const stageAfterSave = (profile: Pick<MyDancerEdit, 'strength'>, from: Stage): Stage => {
  const required = firstRequiredStage(profile.strength.missing);
  if (required) return required;
  if (from === 'years' || from === 'styles') {
    return optionalStagesLeft(profile.strength.missing).find((s) => s !== from) ?? 'nice';
  }
  return 'in';
};

/** The card that follows "Skip" on an optional card. */
export const stageAfterSkip = (profile: Pick<MyDancerEdit, 'strength'>, from: 'years' | 'styles'): Stage =>
  from === 'years' && optionalStagesLeft(profile.strength.missing).includes('styles') ? 'styles' : 'nice';

/** The "Boost" button: the first optional card left, else the closing card. */
export const stageForBoost = (profile: Pick<MyDancerEdit, 'strength'>): Stage =>
  optionalStagesLeft(profile.strength.missing)[0] ?? 'nice';

/** Big role chips; "Both" is the database's 'Lead and Follow'. */
export const ROLE_CHOICES: ReadonlyArray<{ label: string; value: DanceRole }> = [
  { label: 'Leader', value: 'Leader' },
  { label: 'Follower', value: 'Follower' },
  { label: 'Both', value: 'Lead and Follow' },
];

/**
 * "How long have you been dancing?" -> dance_started_year. The ONE mapping:
 * the middle of each band, counted back from the current year, so the stored
 * year lands inside the band the person picked.
 */
export const EXPERIENCE_BANDS = [
  { id: 'just_started', label: 'Just started', yearsAgo: 0 },
  { id: 'one_to_three', label: '1 to 3 years', yearsAgo: 2 },
  { id: 'three_to_six', label: '3 to 6 years', yearsAgo: 4 },
  { id: 'over_six', label: 'More than 6 years', yearsAgo: 8 },
] as const;
export type ExperienceBandId = (typeof EXPERIENCE_BANDS)[number]['id'];

export const startedYearForBand = (id: ExperienceBandId, now: Date = new Date()): number => {
  const band = EXPERIENCE_BANDS.find((b) => b.id === id);
  if (!band) throw new Error(`unknown experience band: ${id}`);
  return now.getFullYear() - band.yearsAgo;
};

/** Display name rule the server enforces (1 to 40 after trim); the server still has the last word. */
export const DISPLAY_NAME_MAX = 40;
