/**
 * The ONE mapping for every profile fact more than one dancer screen shows
 * (review S2): the next-step words and where its button goes, the role chips,
 * and the dancing-since bands. Home, Me, Edit and Onboarding import from here;
 * none of them keeps its own copy. tests/client/dancerAppReviewFixesScreens.test.tsx
 * asserts the same words render on Home, Me and Onboarding for every shape.
 *
 * Strength is NEVER computed here: it is `profile.strength` from the server.
 */
import type { DanceRole, MyDancerEdit, StrengthStep } from './types';

export const PHOTO_PATH = '/app/me/photo';
export const EDIT_PATH = '/app/me/edit';

export type EditFocus = 'first_name' | 'city' | 'role' | 'year' | 'styles' | 'bio' | 'instagram';

/** The four steps that make a profile complete (the server's 70%). */
export const REQUIRED_STEPS: ReadonlySet<StrengthStep> = new Set(['first_name', 'city', 'role', 'photo']);

/** What the next step is called (also the Me main button) and where it goes, per `strength.next_step`. */
export const NEXT_STEP: Record<StrengthStep, { label: string; path: string; focus: EditFocus | null }> = {
  first_name: { label: 'Add your first name', path: EDIT_PATH, focus: 'first_name' },
  city: { label: 'Add your city', path: EDIT_PATH, focus: 'city' },
  role: { label: 'Choose how you dance', path: EDIT_PATH, focus: 'role' },
  photo: { label: 'Add your photo', path: PHOTO_PATH, focus: null },
  started_year: { label: 'Add when you started dancing', path: EDIT_PATH, focus: 'year' },
  styles: { label: 'Pick your favourite styles', path: EDIT_PATH, focus: 'styles' },
  bio_social: { label: 'Add a bio and a link', path: EDIT_PATH, focus: 'bio' },
};

export const NEXT_STEP_DONE = 'Your profile is complete.';

/** What a next-step reading needs from the profile: the server's strength, plus the bio and links for bio_social. */
export type NextStepProfile = Pick<MyDancerEdit, 'strength' | 'bio' | 'instagram' | 'facebook' | 'website_url'>;

export type NextStepTarget = { label: string; path: string; focus: EditFocus | null };

const filled = (v: string | null) => (v ?? '').trim() !== '';

/**
 * Real-data fix F1: the ONE reading of the next step FROM THE PROFILE. The server
 * counts bio_social only for a bio AND a link, so the words name the half that is
 * missing (prod 2026-10-15: 68 of 167 have a link but no bio) and Edit focuses it.
 */
export const nextStepFor = (p: NextStepProfile): NextStepTarget | null => {
  const step = p.strength.next_step;
  if (!step) return null;
  if (step !== 'bio_social') return NEXT_STEP[step];
  const hasBio = filled(p.bio);
  const hasLink = filled(p.instagram) || filled(p.facebook) || filled(p.website_url);
  if (hasLink && !hasBio) return { label: 'Add a short bio', path: EDIT_PATH, focus: 'bio' };
  if (hasBio && !hasLink) return { label: 'Add your Instagram, Facebook or website', path: EDIT_PATH, focus: 'instagram' };
  return NEXT_STEP.bio_social;
};

/**
 * "Add your photo to reach 70%": the step plus the goal it moves towards. Only the
 * LAST required step "reaches" 70% (review N8: at 10% the first name only moves
 * towards it).
 */
export const nextStepShort = (p: NextStepProfile): string => {
  const target = nextStepFor(p);
  const step = p.strength.next_step;
  if (!target || !step) return NEXT_STEP_DONE;
  if (!REQUIRED_STEPS.has(step)) return `${target.label} towards 100%`;
  const requiredLeft = p.strength.missing.filter((m) => REQUIRED_STEPS.has(m)).length;
  return requiredLeft <= 1 ? `${target.label} to reach 70%` : `${target.label} towards 70%`;
};

/** The sentence every screen shows under the strength meter: identical words on Home, Me and Onboarding. */
export const nextStepLine = (p: NextStepProfile): string => (p.strength.next_step ? `${nextStepShort(p)}.` : NEXT_STEP_DONE);

/* ---------- role chips ---------- */

/** `Both` is what the person reads; the column holds `Lead and Follow`. */
export const ROLE_CHOICES: ReadonlyArray<{ value: DanceRole; label: string }> = [
  { value: 'Leader', label: 'Leader' },
  { value: 'Follower', label: 'Follower' },
  { value: 'Lead and Follow', label: 'Both' },
];

export const roleLabel = (role: DanceRole | null): string | null => ROLE_CHOICES.find((r) => r.value === role)?.label ?? null;

/* ---------- dancing since: ONE band table, both ways (Onboarding and Edit) ---------- */

export type YearBand = 'new' | 'one-two' | 'three-five' | 'six-plus';

/** Years of dancing -> band; `years` = the representative age the band stores (lands inside the band). */
export const YEAR_BANDS: ReadonlyArray<{ id: YearBand; label: string; years: number }> = [
  { id: 'new', label: 'Just started', years: 0 },
  { id: 'one-two', label: '1 to 2 years', years: 1 },
  { id: 'three-five', label: '3 to 5 years', years: 4 },
  { id: 'six-plus', label: '6 years or more', years: 8 },
];

export const bandForYear = (year: number | null, now: number = new Date().getFullYear()): YearBand | null => {
  if (year === null) return null;
  const age = Math.max(0, now - year);
  if (age < 1) return 'new';
  if (age <= 2) return 'one-two';
  if (age <= 5) return 'three-five';
  return 'six-plus';
};

/** Band -> the year it stands for. */
export const yearForBand = (band: YearBand, now: number = new Date().getFullYear()): number =>
  now - (YEAR_BANDS.find((b) => b.id === band)?.years ?? 0);
