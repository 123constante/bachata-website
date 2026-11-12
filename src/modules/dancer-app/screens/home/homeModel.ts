/**
 * Dancer Home (profile-dash slice 1, admin #1534, design Option A): the ONE mapping
 * from a profile + its numbers to what Home shows. Pure, so the table-driven test
 * walks every shape. Step words come from api/nextStep.ts (never copied here).
 * Strength is read from the server (`profile.strength`), never computed.
 */
import { NEXT_STEP, REQUIRED_STEPS, nextStepFor, type NextStepTarget } from '../../api/nextStep';
import type { MyDancerEdit, StrengthStep } from '../../api/types';

/** The four steps in the order the checklist draws them, with the noun the list shows. */
export const CHECKLIST: ReadonlyArray<{ step: StrengthStep; noun: string }> = [
  { step: 'first_name', noun: 'Your first name' },
  { step: 'city', noun: 'Your city' },
  { step: 'role', noun: 'How you dance' },
  { step: 'photo', noun: 'A photo' },
];

export type ChecklistRow = { step: StrengthStep; noun: string; done: boolean; next: boolean };

export type HomeKind = 'new' | 'unfinished' | 'complete';

export type HomeView = {
  kind: HomeKind;
  /** "Welcome" with no name, else "Hi <first name>". */
  title: string;
  /** D1 only: one plain line under the title. D2 shows progress once, in the list. */
  subtitle: string | null;
  /** D1/D2: the one next step (label + route); null once the four steps are done. */
  next: NextStepTarget | null;
  /** D1: the single step line; D2: the four-row list. */
  checklist: ChecklistRow[];
  doneCount: number;
  /** Placeholders for the preview row (design option B, fix 4). */
  preview: { name: string; nameMissing: boolean; photoMissing: boolean; line: string };
};

const filled = (v: string | null | undefined) => (v ?? '').trim() !== '';

export const requiredMissing = (p: Pick<MyDancerEdit, 'strength'>): StrengthStep[] =>
  p.strength.missing.filter((m) => REQUIRED_STEPS.has(m));

export const homeView = (p: MyDancerEdit): HomeView => {
  const missing = new Set(requiredMissing(p));
  const doneCount = CHECKLIST.length - missing.size;
  const firstMissing = CHECKLIST.find((c) => missing.has(c.step))?.step ?? null;
  const kind: HomeKind = missing.size === 0 ? 'complete' : doneCount === 0 ? 'new' : 'unfinished';
  const nameText = [p.first_name, p.surname && !p.hide_surname_publicly ? p.surname : null].filter(filled).join(' ');
  const name = filled(p.first_name) ? p.first_name!.trim() : '';
  const photoMissing = !filled(p.avatar_url);
  const nameMissing = !filled(nameText);
  const line = filled(p.city_name) ? p.city_name!.trim() : 'Your city here';
  return {
    kind,
    title: name ? `Hi ${name}` : 'Welcome',
    subtitle: kind === 'new' ? 'Your dancer profile is ready to fill in.' : kind === 'complete' ? 'Your profile is complete.' : null,
    next: firstMissing ? NEXT_STEP[firstMissing] : kind === 'complete' ? null : nextStepFor(p),
    checklist: CHECKLIST.map((c) => ({ ...c, done: !missing.has(c.step), next: c.step === firstMissing })),
    doneCount,
    preview: { name: nameMissing ? 'Your name here' : nameText, nameMissing, photoMissing, line },
  };
};

/** D3: Nights attended = my_dancer_stats_v1.nights_went. null = not loaded / failed: show nothing, never a "0". */
export const attendedView = (went: number | null): { kind: 'count'; n: number } | { kind: 'empty' } | { kind: 'hidden' } =>
  went === null ? { kind: 'hidden' } : went > 0 ? { kind: 'count', n: went } : { kind: 'empty' };

export const PREVIEW_ROW_LINE = (v: HomeView): string => {
  const bits: string[] = [];
  if (v.preview.nameMissing) bits.push('No name yet');
  if (v.preview.photoMissing) bits.push('No photo');
  return bits.length ? bits.join('. ') + '.' : 'Name, city and photo show.';
};

/** D4 (unclaimed): what each answer of claim_my_dancer_profile_v1 says, and what the person can do next. */
export type ClaimStatusLike =
  | 'linked' | 'already_linked' | 'no_match' | 'ambiguous' | 'email_unproven' | 'not_applicable' | 'unavailable';

export const CLAIM_COPY: Record<ClaimStatusLike, { title: string; body: string; message: boolean }> = {
  linked: { title: 'Your page is yours now', body: 'We linked the page made for you. Have a look and make it right.', message: false },
  already_linked: { title: 'Your page is already yours', body: 'Tap Show my page to open it.', message: false },
  no_match: { title: 'No page found for this email', body: 'Nothing on our side matches the email you signed in with. Message us if you expected one.', message: true },
  ambiguous: { title: 'We found more than one page', body: 'We will not guess which is yours. Message us and we will link the right one.', message: true },
  email_unproven: { title: 'Your email is not confirmed yet', body: 'Open the confirmation email we sent when you signed up and tap its link, then tap Check again. Message us if it never arrived.', message: true },
  not_applicable: { title: 'Nothing to claim here', body: 'This account does not need a claim.', message: false },
  unavailable: { title: 'We could not check just now', body: 'Check your connection and try again, or message us.', message: true },
};
