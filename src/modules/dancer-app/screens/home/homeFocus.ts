/**
 * Dancer Home, Option B "one thing in focus" (queue-website#1534, owner pick 2026-11-12).
 * The ONE pure mapping from a profile + its numbers + the next night to what the focus card
 * and the rows show. Built on homeModel.homeView (the four required steps, their words and
 * routes: never copied here). Counts are positive-only: a count shows above 0, never a 0.
 */
import type { NextStepTarget } from '../../api/nextStep';
import type { MyDancerEdit } from '../../api/types';
import { HIDDEN_SHARE_REASON } from '../options/optionsModel';
import { homeView, type HomeView } from './homeModel';
import type { HeroNight } from './homeParts';

export const REQUIRED_TOTAL = 4;
export const PAGE_PATH = '/app/page';

/** Why Share is off until the four steps are done (design proposal G-9). */
export const SHARE_INCOMPLETE_REASON = 'Add your photo, home city and how you dance first, so people know it is you.';

export type FocusKind = 'profile' | 'night' | 'find';

export type HomeFocus =
  | { kind: 'profile'; done: number; total: number; lead: string; cta: NextStepTarget }
  | { kind: 'night'; night: HeroNight }
  | { kind: 'find' };

export type ShareRow = { enabled: boolean; reason: string | null };

export type HomeBView = {
  base: HomeView;
  focus: HomeFocus;
  share: ShareRow;
  /** "N more plans": only above 0, only when a next night is the focus. */
  morePlans: number | null;
  /** Nights attended: a count above 0; 'first' = the zero line (no number); 'hidden' = not loaded. */
  attended: { kind: 'count'; n: number } | { kind: 'first' } | { kind: 'hidden' };
};

export const homeBView = (
  p: MyDancerEdit,
  o: { went: number | null; night: HeroNight | null; goingCount: number | null },
): HomeBView => {
  const base = homeView(p);
  let focus: HomeFocus;
  if (base.kind !== 'complete' && base.next) {
    const lead = `Next: ${base.next.label.charAt(0).toLowerCase()}${base.next.label.slice(1)}.`;
    focus = { kind: 'profile', done: base.doneCount, total: REQUIRED_TOTAL, lead, cta: base.next };
  } else if (o.night) {
    focus = { kind: 'night', night: o.night };
  } else {
    focus = { kind: 'find' };
  }
  const share: ShareRow =
    base.kind !== 'complete'
      ? { enabled: false, reason: SHARE_INCOMPLETE_REASON }
      : !p.is_active
        ? { enabled: false, reason: HIDDEN_SHARE_REASON }
        : { enabled: true, reason: null };
  const more = o.night && o.goingCount !== null ? o.goingCount - 1 : 0;
  return {
    base,
    focus,
    share,
    morePlans: focus.kind === 'night' && more > 0 ? more : null,
    attended: o.went === null ? { kind: 'hidden' } : o.went > 0 ? { kind: 'count', n: o.went } : { kind: 'first' },
  };
};

export const morePlansLabel = (n: number): string => (n === 1 ? '1 more plan' : `${n} more plans`);
export const attendedLabel = (n: number): string => (n === 1 ? '1 night attended' : `${n} nights attended`);
