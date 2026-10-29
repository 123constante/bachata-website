// The Home grace banner's pure rules (no imports: P3 Home's chunk carries this, not the onboarding code).

export const thingsLeft = (n: number): string => (n === 1 ? '1 thing left' : `${n} things left`);

/** "Hide for today" is per device, keyed by the London day it was hidden on. */
export const GRACE_HIDE_KEY = 'p3-ob-grace-hidden';

/** Shown while not complete, never to admins, and not on a day it was hidden. No grace end date exists on the server yet (plan Q1), so none is shown. */
export const graceShown = (s: { complete: boolean; isAdmin: boolean } | null, hiddenOn: string | null, today: string): boolean =>
  !!s && !s.complete && !s.isAdmin && hiddenOn !== today;
