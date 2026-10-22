// Pure rules for the "Almost live" bridge, the quick questions and "All set"
// (Arc 1, PR 3 slice B). The question LIST is the server's: the required steps
// my_profile_progress_v1 says are still open, in its order; nothing here keeps
// a field list of its own. Copy is the owner-approved prototype wording (v8).
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import type { ProfileProgress, ProgressStep } from '@/modules/organiser/shared/profileProgress';
import { isRegistered } from '../../../wizard/registry';
import { shownSteps, stepKey } from '../../../wizard/wizardModel';
import type { WizardSources } from '../../../wizard/registry';
import { WIZARD_STEPS } from '../../../wizard/registry';
import { PROFILE_WIZARD_PATH } from '@/modules/organiser/shared/profileProgress';
import { goLiveFixHref, goLiveLabel, withReturnTo, type GoLiveCheck } from '@/modules/organiser/shared/goLiveCheck';

export const ALMOST_LIVE_TITLE = 'Almost live';
export const ALL_SET_TITLE = 'All set';
export const CONTINUE_LABEL = 'Continue';
export const NOT_NOW_LABEL = 'Not now';
export const NEXT_LABEL = 'Next';
export const FINISH_LABEL = 'Finish';
export const GO_LIVE_LABEL = 'Go live';
export const NOT_YET_LABEL = 'Not yet';
export const BACK_LABEL = 'Back';
/** The home card's words, kept as the owner asked (decision 12). */
export const HOME_CARD_LABEL = 'Finish to go live';

export const questionsText = (n: number): string => (n === 1 ? '1 quick question' : `${n} quick questions`);
export const homeCardSub = (n: number): string => `${n} quick ${n === 1 ? 'question' : 'questions'}`;

/** "<event> is saved. N quick questions and you can publish it." */
export const almostLiveLine = (eventName: string, left: number): string =>
  `${eventName} is saved. ${questionsText(left)} and you can publish it.`;

/** The All set line: the event named when it is known, else the first-event line. */
export const allSetLine = (eventName: string | null): string =>
  eventName ? `${eventName} is ready to go live.` : 'You can publish your first event.';

export type SectionId = 'you' | 'page';
export const SECTION_LABEL: Record<SectionId, string> = { you: 'About you', page: 'About your page' };
export const sectionOf = (s: Pick<ProgressStep, 'area'>): SectionId => (s.area === 'dancer' ? 'you' : 'page');

/**
 * The questions to ask: required, not yet answered, and answerable here
 * (registered in the wizard), in the server's order. Taken ONCE at the start so
 * the list does not shrink under the person as each answer saves.
 */
export function openQuestions(p: Pick<ProfileProgress, 'steps'>): ProgressStep[] {
  // Go live's profile rule is the dancer and organiser fields only; a teacher or DJ step (once the wizard can show one) is not a go-live question.
  return shownSteps(p.steps, isRegistered).filter((s) => (s.area === 'dancer' || s.area === 'organiser') && s.required && !s.done);
}

/** "Step k of n" inside the question's own section. */
export function stepInSection(list: readonly ProgressStep[], at: number): { k: number; n: number } {
  const sec = sectionOf(list[at]);
  const same = list.filter((s) => sectionOf(s) === sec);
  return { k: same.indexOf(list[at]) + 1, n: same.length };
}

/** One tap to reuse an answer the person already gave (prototype: "Use mine"). */
export interface UseMine { label: string; value: string }

const clean = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Only the two page questions that repeat a personal answer offer it; everything else returns null. */
export function mineFor(step: Pick<ProgressStep, 'area' | 'field'>, src: Pick<WizardSources, 'dancer'>): UseMine | null {
  if (step.area !== 'organiser' || !src.dancer) return null;
  if (step.field === 'instagram') {
    const v = clean(src.dancer.instagram);
    return v ? { label: 'Use mine', value: v } : null;
  }
  if (step.field === 'contact_phone') {
    const v = clean(src.dancer.whatsapp);
    return v ? { label: 'Use my WhatsApp number', value: v } : null;
  }
  return null;
}

/** Where the flow lives: the event it is finishing and the page it asks about ride in the query. */
export function goLivePath(seriesId: string, organiserId: string | null): string {
  const q = new URLSearchParams({ series: seriesId });
  if (organiserId) q.set('o', organiserId);
  return `${ORG_PATHS.goLive}?${q.toString()}`;
}

export { stepKey };


/** One thing the server still wants that no question on the way covered. */
export interface GoLiveGap { key: string; text: string; href: string | null }

export const GAPS_TITLE = 'Still to do before you can go live';
export const CHECKING_REASON = 'Checking what is left';
export const EVENT_LOADING_REASON = 'Loading your event';
export const EVENT_FAILED_REASON = 'Your event did not load, so Go live cannot start';
export const RETRY_LABEL = 'Retry';

const humanise = (f: string) => f.replace(/_/g, ' ');

/**
 * Everything the server says still blocks Go live: event items and profile
 * answers (any organiser, including fields the wizard has no step for). Each
 * names what to do; a link only where a screen fixes it. Never a bare refusal.
 */
export function goLiveGaps(check: GoLiveCheck, seriesId: string, organiserId: string | null): GoLiveGap[] {
  const gaps: GoLiveGap[] = check.eventMissing.map((m) => ({ key: `event:${m.code}`, text: goLiveLabel(m.code), href: goLiveFixHref(m.section, seriesId) }));
  if (!check.profileRuleApplies) return gaps;
  const back = goLivePath(seriesId, organiserId);
  for (const p of check.profileMissing) {
    for (const f of p.fields) {
      const entry = WIZARD_STEPS.get(`${p.area}:${f}`);
      const what = entry ? entry.title.replace(/\?$/, '') : `Add your ${p.area === 'dancer' ? '' : 'page '}${humanise(f)}`;
      gaps.push({ key: `${p.area}:${p.organiserId ?? ''}:${f}`, text: entry ? `${p.area === 'dancer' ? 'About you' : 'About your page'}: ${what}` : what, href: withReturnTo(PROFILE_WIZARD_PATH, back) });
    }
  }
  return gaps;
}
