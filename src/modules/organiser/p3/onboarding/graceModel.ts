// The onboarding "things left" rules, shared by Home's grace banner and the You tab's page row (no imports:
// P3 Home's chunk carries this, not the onboarding code).

export const thingsLeft = (n: number): string => (n === 1 ? '1 thing left' : `${n} things left`);

/**
 * THE time promise (join-gaps-1 gap 4), for every screen that names one: Home's banner, the gate sheet and the
 * onboarding welcome line. Derived from the rows left, never a flat "five minutes" next to 10 rows; a list longer
 * than 3 also says it can be left half-done. null = the count is not known: no time is claimed.
 */
export const STOP_AND_COME_BACK = 'You can stop and come back.';
export function timePromise(left: number | null): string {
  if (left === null) return STOP_AND_COME_BACK;
  if (left <= 0) return '';
  if (left <= 3) return 'It takes a minute or two.';
  if (left <= 6) return `It takes about three minutes. ${STOP_AND_COME_BACK}`;
  if (left <= 10) return `It takes about five minutes. ${STOP_AND_COME_BACK}`;
  return `It takes about ten minutes. ${STOP_AND_COME_BACK}`;
}
const join = (...parts: string[]): string => parts.filter(Boolean).join(' ');

/**
 * Home's banner body (owner words 2026-11-03), the ONE copy: the gate is on, so nothing "works as usual" until
 * the details are done. No other screen repeats the claim. The time is timePromise's, for the count beside it.
 */
export const graceBody = (left: number): string => join('Finish your details first to create or edit events.', timePromise(left));

/** The gate sheet's body: the same promise, for the rows it lists (null while the list is unknown). */
export const gateBody = (left: number | null): string => join('We ask everyone who runs a page, and you only do it once.', timePromise(left));

/** The onboarding welcome line for a page (null = the status read has not answered). */
export const welcomeLine = (left: number | null): string => join('A few quick questions and your page is ready to edit, once only.', timePromise(left));

/** The You row's and the page editor's words for the same count. */
export const toFinish = (n: number): string => `To finish: ${thingsLeft(n)}`;

/** "Hide for today" is per device, keyed by the London day it was hidden on. */
export const GRACE_HIDE_KEY = 'p3-ob-grace-hidden';

export type GraceStatus = { complete: boolean; isAdmin: boolean; left: number; missing: string[]; firstId: string | null; firstName: string };

type RawOrg = { id?: unknown; name?: unknown; complete?: unknown; missing?: unknown };
const codes = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/**
 * organiser_onboarding_status_v1() (no id = every page the person is on), for ONE page: the shown page
 * (`organiserId`; not listed = the person's codes only, never another page's), or with no shown page yet the first
 * page still missing something, else the first. `left` = the person's codes plus that page's, each once. Null = unknown: not an object, or `person.missing` / `organisers` not arrays.
 */
export function graceStatusFrom(raw: unknown, organiserId: string | null = null): GraceStatus | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { complete?: unknown; is_admin?: unknown; person?: { missing?: unknown } | null; organisers?: unknown };
  // A code in both lists counts once (the server strips person codes from organisers[].missing today).
  if (!Array.isArray(r.person?.missing) || !Array.isArray(r.organisers)) return null;
  const orgs = r.organisers as RawOrg[];
  const page = organiserId !== null
    ? orgs.find((o) => o?.id === organiserId)
    : orgs.find((o) => o?.complete !== true && codes(o?.missing).length > 0) ?? orgs[0];
  const missing = [...new Set([...codes(r.person?.missing), ...codes(page?.missing)])];
  return {
    complete: r.complete === true,
    isAdmin: r.is_admin === true,
    left: missing.length,
    missing,
    firstId: typeof page?.id === 'string' ? page.id : null,
    firstName: typeof page?.name === 'string' ? page.name : '',
  };
}

/** THE count both screens show: 0 when unknown, complete or an admin (the gate never holds an admin). */
export const onboardingLeft = (s: GraceStatus | null): number => (!s || s.complete || s.isAdmin ? 0 : s.left);

/** The codes behind that count (the A1 gate screen's list): exactly onboardingLeft(s) of them, never a second count. */
export const onboardingMissing = (s: GraceStatus | null): string[] => (onboardingLeft(s) > 0 && s ? s.missing : []);

/** Shown only with something left to do (never "0 things left"), and not on a day it was hidden. No grace end date exists on the server yet (plan Q1), so none is shown. */
export const graceShown = (s: GraceStatus | null, hiddenOn: string | null, today: string): boolean =>
  onboardingLeft(s) > 0 && hiddenOn !== today;
