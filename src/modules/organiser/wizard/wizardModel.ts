// The profile wizard's pure rules (C15, C16, D26, D27, D50). The step LIST is
// the server's (my_profile_progress_v1 `steps`, in its order): nothing here
// keeps a list of its own; it only decides which server step is on screen.
import type { ProfileProgress, ProgressStep } from '@/modules/organiser/shared/profileProgress';

export const stepKey = (s: Pick<ProgressStep, 'area' | 'field'>): string => `${s.area}:${s.field}`;

/** The server steps the wizard can show, in server order: a step whose area:field has no component is left out (teacher/DJ until Release B). */
export function shownSteps(steps: readonly ProgressStep[], registered: (key: string) => boolean): ProgressStep[] {
  return steps.filter((s) => registered(stepKey(s)));
}

/** The first step still to answer: not done on the server and not answered or skipped in this visit. */
export function nextOpenStep(steps: readonly ProgressStep[], handled: ReadonlySet<string>): ProgressStep | null {
  return steps.find((s) => !s.done && !handled.has(stepKey(s))) ?? null;
}

/**
 * The milestone to show between two steps, or null. Leaving the last required
 * step for an optional one (or for the end) is the "You can publish now" moment;
 * the screen itself only celebrates once the re-read progress says publish_ready.
 */
export function milestoneBetween(left: ProgressStep, next: ProgressStep | null): 'ready' | null {
  return left.required && (!next || !next.required) ? 'ready' : null;
}

// ---- levels (C16) ------------------------------------------------------------------------

export type LevelId = 'starter' | 'ready' | 'full';

/** The three levels, in track order. One mapping for the ring, the track and Home. */
export const LEVELS: readonly { id: LevelId; name: string }[] = [
  { id: 'starter', name: 'Starter' },
  { id: 'ready', name: 'Ready to publish' },
  { id: 'full', name: 'Full profile' },
];

export function levelOf(p: Pick<ProfileProgress, 'percent' | 'publishReady'>): LevelId {
  if (!p.publishReady) return 'starter';
  return p.percent >= 100 ? 'full' : 'ready';
}

export const levelName = (id: LevelId): string => LEVELS.find((l) => l.id === id)!.name;

/** What reaching a level changes, stated only where it really changes something (C16). */
export const UNLOCK_LINE: Record<LevelId, string | null> = {
  starter: null,
  ready: 'You can now put your events live.',
  full: 'Nothing is left to fill in. You can still change any answer on My page.',
};

// ---- answers -----------------------------------------------------------------------------

/** Typed list text not yet added counts as added (D27): trimmed, de-duplicated (any case), same limits. */
export function withPendingItem(items: readonly string[], pending: string, max = LIST_MAX_ITEMS): string[] {
  const out = [...items];
  const t = pending.trim().slice(0, LIST_ITEM_MAX);
  if (t && out.length < max && !out.some((v) => v.toLowerCase() === t.toLowerCase())) out.push(t);
  return out;
}

export const LIST_MAX_ITEMS = 20;
export const LIST_ITEM_MAX = 60;

/** Two answers that would store the same thing (blank and null are the same, list order counts). */
export function sameAnswer(a: unknown, b: unknown): boolean {
  const norm = (v: unknown): unknown => {
    if (v === undefined || v === null) return null;
    if (typeof v === 'string') return v.trim() === '' ? null : v.trim();
    if (Array.isArray(v)) return v.length === 0 ? null : JSON.stringify(v);
    return v;
  };
  return norm(a) === norm(b);
}

/** An answer with nothing in it (Skip for now instead of Continue, D26). */
export const isBlankAnswer = (v: unknown): boolean => sameAnswer(v, null);

// ---- the Home nudge (D50) ----------------------------------------------------------------

export const FINISH_LATER_MS = 24 * 60 * 60 * 1000;
export const NOT_NOW_MS = 30 * 24 * 60 * 60 * 1000;
/** "Not now" hides the button 30 days, then once more: after the second the button stays. */
export const NOT_NOW_MAX = 2;

export interface NudgeState { finishLaterAt: number | null; notNowAt: number | null; notNowCount: number }
export const EMPTY_NUDGE: NudgeState = { finishLaterAt: null, notNowAt: null, notNowCount: 0 };

/** Home opens the wizard by itself while required answers are missing, unless Finish later was tapped in the last 24 h. */
export function shouldAutoOpen(p: Pick<ProfileProgress, 'requiredLeft'>, n: NudgeState, now: number): boolean {
  if (p.requiredLeft <= 0) return false;
  return n.finishLaterAt === null || now - n.finishLaterAt >= FINISH_LATER_MS;
}

/** Home's "Complete your profile" button: always while required answers are missing; after that until 100%, unless hidden by Not now. */
export function showHomeButton(p: Pick<ProfileProgress, 'requiredLeft' | 'percent'>, n: NudgeState, now: number): boolean {
  if (p.requiredLeft > 0) return true;
  if (p.percent >= 100) return false;
  return n.notNowAt === null || now - n.notNowAt >= NOT_NOW_MS;
}

/** Not now is offered only after the required part, and only while it has been used fewer than twice. */
export const canSayNotNow = (p: Pick<ProfileProgress, 'requiredLeft'>, n: NudgeState): boolean =>
  p.requiredLeft <= 0 && n.notNowCount < NOT_NOW_MAX;
