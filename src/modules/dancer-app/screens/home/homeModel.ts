import { EDIT_PATH, NEXT_STEP, REQUIRED_STEPS, nextStepFor, type NextStepProfile } from '../../api/nextStep';
import type { StrengthStep } from '../../api/types';
import type { ClaimStatus } from '@/lib/claimMyDancerProfile';

/**
 * The ONE mapping from a dancer's profile shape (plus nights attended) to what Home's
 * main card says (admin #1534, owner pick: Option A). Home renders this and nothing
 * else decides the words; the table test in __tests__/homeModel.test.ts walks every shape.
 *
 *   stub       D1: none of the 4 required steps done -> "Finish your profile", ONE button.
 *   unfinished D2: some done -> the list of 4 once (done ticked, next marked), ONE button.
 *   complete   D3: all 4 done -> checklist hidden; Nights attended, or one empty-state CTA.
 */
export const REQUIRED_ORDER: readonly StrengthStep[] = ['first_name', 'city', 'role', 'photo'];

export type HomeProfile = NextStepProfile;

export type HomeShape = 'stub' | 'unfinished' | 'complete';

export type ChecklistRow = { step: StrengthStep; label: string; done: boolean; next: boolean };

export type HomeMain =
  | {
      shape: 'stub';
      title: string;
      button: { label: string; focus: string | null; path: string };
      numbersLine: string;
    }
  | {
      shape: 'unfinished';
      title: string;
      rows: ChecklistRow[];
      button: { label: string; focus: string | null; path: string };
      numbersLine: string;
    }
  | {
      shape: 'complete';
      title: string;
      /** null = nothing attended yet: the empty state shows, never a headline "0". */
      attended: number | null;
      empty: { title: string; body: string; cta: string } | null;
    };

export const FINISH_TITLE = 'Finish your profile';
export const NUMBERS_LINE = 'Your numbers start after your first night out.';
export const ATTENDED_TITLE = 'Nights attended';
export const EMPTY_ATTENDED = {
  title: 'Find your first night',
  body: 'Nights you go to are counted here.',
  cta: 'Browse this week',
};

const requiredLeft = (p: HomeProfile): StrengthStep[] => REQUIRED_ORDER.filter((s) => p.strength.missing.includes(s));

export const homeShapeOf = (p: HomeProfile): HomeShape => {
  const left = requiredLeft(p).length;
  if (left === 0) return 'complete';
  return left === REQUIRED_STEPS.size ? 'stub' : 'unfinished';
};

export const homeMain = (p: HomeProfile, nightsWent: number | null): HomeMain => {
  const shape = homeShapeOf(p);
  if (shape === 'complete') {
    const n = nightsWent !== null && nightsWent > 0 ? nightsWent : null;
    return { shape, title: ATTENDED_TITLE, attended: n, empty: n === null ? EMPTY_ATTENDED : null };
  }
  const target = nextStepFor(p) ?? NEXT_STEP[requiredLeft(p)[0]];
  const button = { label: target.label, focus: target.focus, path: target.path ?? EDIT_PATH };
  if (shape === 'stub') return { shape, title: FINISH_TITLE, button, numbersLine: NUMBERS_LINE };
  const nextRequired = requiredLeft(p)[0];
  const rows = REQUIRED_ORDER.map((step) => ({
    step,
    label: NEXT_STEP[step].label,
    done: !p.strength.missing.includes(step),
    next: step === nextRequired,
  }));
  return { shape, title: FINISH_TITLE, rows, button, numbersLine: NUMBERS_LINE };
};

/** The "Preview your page" row's one-line status: placeholders for the gaps, never a blank. */
export const previewLine = (p: { first_name: string | null; avatar_url: string | null }): string => {
  const name = (p.first_name ?? '').trim() || 'Your name here';
  return `${name} \u00B7 ${p.avatar_url ? 'Photo added' : 'No photo'}`;
};

/* ---------- D4: claim your page (re-runs claim_my_dancer_profile_v1, no args) ---------- */

export const CLAIM_BUTTON = 'Claim your page';
export const CLAIM_DISMISS = 'Not me';

export type ClaimView = 'linked' | 'no_match' | 'ambiguous' | 'email_unproven' | 'unavailable';

/** One mapping from the RPC status to words; `already_linked` and `not_applicable` read as "no match here". */
export const claimView = (status: ClaimStatus | 'unavailable'): ClaimView => {
  if (status === 'linked' || status === 'already_linked') return 'linked';
  if (status === 'ambiguous' || status === 'email_unproven' || status === 'unavailable') return status;
  return 'no_match';
};

export const CLAIM_COPY: Record<ClaimView, { title: string; body: string; ok: boolean; retry: boolean }> = {
  linked: { title: 'Your page is yours', body: 'We linked it to your account. Have a look and make it right.', ok: true, retry: false },
  no_match: {
    title: 'No page found for your email',
    body: 'We could not find a page made for this email. Message us and we will check.',
    ok: false,
    retry: false,
  },
  ambiguous: {
    title: 'We found more than one page',
    body: 'We could not tell which is yours. Message us and we will sort it out.',
    ok: false,
    retry: false,
  },
  email_unproven: {
    title: 'Confirm your email first',
    body: 'Open the confirmation email we sent, then try again.',
    ok: false,
    retry: true,
  },
  unavailable: {
    title: 'We could not check just now',
    body: 'Check your connection and try again.',
    ok: false,
    retry: true,
  },
};
