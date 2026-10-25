/**
 * The dancer shell's chrome decision (audit H5): full app, or the setup focus
 * frame. lib/focusMode's isSignupFocusPath() is the ONE path mapping every
 * chrome component reads; this file only supplies its `profileComplete` and
 * the "Not now" destination.
 */
import { isSignupFocusPath } from '@/lib/focusMode';
import { RETURN_TO_PARAM, isDancerGatedTarget, onwardReturnTo } from '@/lib/accountRouting';
import type { MyDancerEdit } from '../api/types';
import { firstRequiredStage } from '../screens/onboarding/model';

/** Where "Not now" goes when nothing better is known: the site home (still signed in, nothing deleted). */
export const NOT_NOW_HOME = '/';

/**
 * The required steps are done -- onboarding's own reading (screens/onboarding/model
 * firstRequiredStage over the server's strength.missing), so the frame drops at the
 * same moment the required cards end. Not read yet = not done: a setup path never
 * flashes the full app.
 */
export const requiredDone = (profile: Pick<MyDancerEdit, 'strength'> | null | undefined): boolean =>
  Boolean(profile) && firstRequiredStage(profile!.strength.missing) === null;

/** The onward destination the URL carries: ?returnTo=, or the one inside the photo step's ?return=/app/welcome?returnTo=. */
const carried = (search: string): string | null => {
  const params = new URLSearchParams(search);
  const direct = params.get(RETURN_TO_PARAM);
  if (direct) return direct;
  const back = params.get('return');
  if (!back) return null;
  const q = back.indexOf('?');
  return q < 0 ? null : new URLSearchParams(back.slice(q + 1)).get(RETURN_TO_PARAM);
};

/**
 * "Not now": the carried returnTo when it is a safe, same-site page an unfinished
 * profile may open; else the site home. A dancer-gated target (/account/o, /invite,
 * a claim) would bounce straight back into this setup, so it is never used.
 */
export const notNowTarget = (search: string): string => {
  const onward = onwardReturnTo(carried(search));
  return onward && !isDancerGatedTarget(onward) ? onward : NOT_NOW_HOME;
};

/** Only these paths can be focus at all; the shell reads the profile only for them. */
export const mayBeFocus = (pathname: string, search: string): boolean => isSignupFocusPath(pathname, search, false);

export type ShellChrome = { focus: boolean; notNowTo: string };

export const shellChrome = (pathname: string, search: string, profile: Pick<MyDancerEdit, 'strength'> | null | undefined): ShellChrome => {
  const focus = isSignupFocusPath(pathname, search, requiredDone(profile));
  return { focus, notNowTo: focus ? notNowTarget(search) : NOT_NOW_HOME };
};
