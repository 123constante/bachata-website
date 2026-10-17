// Sign-up focus mode: ONE shared mapping every chrome component reads.
// Pinned interface (briefs/dancer-journey-fixes.md). Owned by Slice A
// (claude/djf-auth-chrome); this copy exists only so Slice B builds before
// the slices merge -- on merge, Slice A's version wins.

export const FOCUS_NOT_NOW_LABEL = 'Not now';

export function isSignupFocusPath(pathname: string, search: string, profileComplete: boolean): boolean {
  const params = new URLSearchParams(search);
  if (pathname === '/auth' || pathname === '/auth/') {
    return params.get('mode') === 'signup';
  }
  if (profileComplete) return false;
  if (pathname === '/app/welcome' || pathname === '/app/welcome/') return true;
  if (pathname === '/app/me/photo' && params.get('return') === '/app/welcome') return true;
  return false;
}
