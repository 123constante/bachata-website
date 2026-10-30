// The onboarding "things left" rules, shared by Home's grace banner and the You tab's page row (no imports:
// P3 Home's chunk carries this, not the onboarding code).

export const thingsLeft = (n: number): string => (n === 1 ? '1 thing left' : `${n} things left`);

/** "Hide for today" is per device, keyed by the London day it was hidden on. */
export const GRACE_HIDE_KEY = 'p3-ob-grace-hidden';

export type GraceStatus = { complete: boolean; isAdmin: boolean; left: number; firstId: string | null; firstName: string };

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
  if (!Array.isArray(r.person?.missing) || !Array.isArray(r.organisers)) return null;
  const orgs = r.organisers as RawOrg[];
  const page = organiserId !== null
    ? orgs.find((o) => o?.id === organiserId)
    : orgs.find((o) => o?.complete !== true && codes(o?.missing).length > 0) ?? orgs[0];
  return {
    complete: r.complete === true,
    isAdmin: r.is_admin === true,
    left: new Set([...codes(r.person?.missing), ...codes(page?.missing)]).size,
    firstId: typeof page?.id === 'string' ? page.id : null,
    firstName: typeof page?.name === 'string' ? page.name : '',
  };
}

/** THE count both screens show: 0 when unknown, complete or an admin (the gate never holds an admin). */
export const onboardingLeft = (s: GraceStatus | null): number => (!s || s.complete || s.isAdmin ? 0 : s.left);

/** Shown only with something left to do (never "0 things left"), and not on a day it was hidden. No grace end date exists on the server yet (plan Q1), so none is shown. */
export const graceShown = (s: GraceStatus | null, hiddenOn: string | null, today: string): boolean =>
  onboardingLeft(s) > 0 && hiddenOn !== today;
