// A LEAF module on purpose: AppChrome (every route's first load) reads it, so an
// import here is one more first-load request on every page (perf-budget ratchet).

/**
 * Sign-up FOCUS MODE (owner decision, 2026-10-16). From "Create account" through
 * email -> code -> first dancer-profile setup, the site shows only the logo and
 * a small "Not now" link: no header links, no section row, no footer, no tabs.
 *
 * This is the ONE mapping every chrome component reads (site AppChrome here, the
 * dancer-app shell in modules/dancer-app). Sign-in of an existing account is
 * NOT focus mode.
 *
 * /auth with no mode (or any mode but signup) renders SIGN-IN (L1, Auth.tsx), so
 * it does not count; only an explicit `mode=signup` does. The
 * code step and the terms card render on the same /auth URL, and the code hand-
 * over lands on /auth/callback?mode=signup, so both are covered by the mode test.
 * The setup screens count only while the profile is not complete.
 */
export const FOCUS_NOT_NOW_LABEL = 'Not now';

const SETUP_PATH = '/app/welcome';
const SETUP_PHOTO_PATH = '/app/me/photo';

const trimSlash = (p: string) => (p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p);

export function isSignupFocusPath(pathname: string, search: string, profileComplete: boolean): boolean {
  // Case-folded, as the router matches.
  const path = trimSlash(pathname.toLowerCase());
  const params = new URLSearchParams(search);
  if (path === '/auth' || path === '/auth/callback') {
    const mode = params.get('mode');
    // L1: a bare /auth opens sign-in, so only an explicit mode=signup is focus mode.
    return mode === 'signup';
  }
  if (profileComplete) return false;
  if (path === SETUP_PATH) return true;
  // The photo hand-off can carry an onward destination inside its own return
  // (/app/me/photo?return=%2Fapp%2Fwelcome%3FreturnTo%3D...): compare the path only.
  const back = (params.get('return') ?? '').split('?')[0];
  return path === SETUP_PHOTO_PATH && trimSlash(back.toLowerCase()) === SETUP_PATH;
}
