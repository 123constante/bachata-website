// Pure model for /start-organiser. The server (organiser_name_matches_v1, organiser_onboard_v1) owns every
// rule; this maps its answers to plain words. Raw reasons are never shown.

export const DEBOUNCE_MS = 350;
export const MIN_NAME_LETTERS = 2;

export interface NameMatch {
  organiserId: string;
  displayName: string;
  city: string;
  claimed: boolean;
  emailMatch: boolean;
}

/** The "Is this you?" lookup runs only for 2+ letters of name and a chosen city. */
export function shouldSearchMatches(name: string, cityId: string | null): boolean {
  return name.trim().length >= MIN_NAME_LETTERS && !!cityId;
}

/** ok:false (flag_off, not_authenticated) and anything odd show nothing. Only the five safe fields are read. */
export function parseNameMatches(raw: unknown): NameMatch[] {
  if (!raw || typeof raw !== 'object') return [];
  const r = raw as Record<string, unknown>;
  if (r.ok === false || !Array.isArray(r.items)) return [];
  return r.items.flatMap((it): NameMatch[] => {
    if (!it || typeof it !== 'object') return [];
    const i = it as Record<string, unknown>;
    if (typeof i.organiser_id !== 'string' || typeof i.display_name !== 'string') return [];
    return [{
      organiserId: i.organiser_id,
      displayName: i.display_name,
      city: typeof i.city === 'string' ? i.city : '',
      claimed: i.claimed === true,
      emailMatch: i.email_match === true,
    }];
  });
}

export type OnboardOutcomeKind = 'claimed' | 'created_claim_waiting' | 'created';

export type OnboardResult =
  | { kind: 'success'; outcome: OnboardOutcomeKind; organiserId: string; slug: string | null; displayName: string }
  | { kind: 'refused'; reason: string }
  | { kind: 'signed_out' }
  | { kind: 'failed' };

const OUTCOMES: readonly string[] = ['claimed', 'created_claim_waiting', 'created'];

export function parseOnboardResult(raw: unknown): OnboardResult {
  if (!raw || typeof raw !== 'object') return { kind: 'failed' };
  const r = raw as Record<string, unknown>;
  if (r.ok === true && typeof r.outcome === 'string' && OUTCOMES.includes(r.outcome) && typeof r.organiser_id === 'string') {
    return {
      kind: 'success',
      outcome: r.outcome as OnboardOutcomeKind,
      organiserId: r.organiser_id,
      slug: typeof r.slug === 'string' ? r.slug : null,
      displayName: typeof r.display_name === 'string' ? r.display_name : '',
    };
  }
  if (r.ok === false && typeof r.reason === 'string') return { kind: 'refused', reason: r.reason };
  return { kind: 'failed' };
}

export function outcomeCopy(outcome: OnboardOutcomeKind, displayName: string): string {
  if (outcome === 'claimed') return `${displayName} is yours.`;
  if (outcome === 'created_claim_waiting') return `Your page is live. The team is checking your claim of ${displayName}; keep going.`;
  return 'Your page is live.';
}

export type RefusalAction = 'not_found' | 'back_to_email' | 'back' | 'own_page' | 'retry' | 'back_to_event';

export interface FirstEventInput { name: string; date: string }

/** The p_first_event payload: {name, date} trimmed, or null (Skip / claim). */
export const firstEventPayload = (e: FirstEventInput | null): FirstEventInput | null =>
  e ? { name: e.name.trim(), date: e.date } : null;
export interface RefusalView { action: RefusalAction; message: string }

const CALM: Record<string, string> = {
  limit_reached: 'You have reached the limit for pages. Nothing was saved.',
  suspended: 'This account cannot create a page right now. Nothing was saved.',
  not_live: 'This is not open yet. Nothing was saved.',
  page_already_owned: 'That page already has an owner. Nothing was saved.',
  page_already_member: 'You are already part of that page. Nothing was saved.',
  claim_target_not_found: 'We could not find that page. Nothing was saved.',
  not_publishable: 'That name cannot be used for a page. Nothing was saved.',
  city_not_found: 'We could not find that city. Nothing was saved.',
  name_or_city_missing: 'Please add a name and a city. Nothing was saved.',
  name_invalid: 'That name does not look right. Nothing was saved.',
};

export const GENERIC_FAILURE = 'Something went wrong. Nothing was saved.';

export function refusalView(reason: string): RefusalView {
  if (reason === 'flag_off') return { action: 'not_found', message: '' };
  if (reason === 'email_not_proven') return { action: 'back_to_email', message: 'Please confirm your email first.' };
  if (reason === 'first_event_invalid') return { action: 'back_to_event', message: 'Check the event name and date.' };
  if (reason === 'name_taken') return { action: 'back', message: 'That name is taken in this city. Try adding a word.' };
  if (reason === 'already_owns_page') return { action: 'own_page', message: 'You already have a page.' };
  if (CALM[reason]) return { action: 'back', message: CALM[reason] };
  return { action: 'retry', message: GENERIC_FAILURE };
}
