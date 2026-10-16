import { Link, useLocation } from 'react-router-dom';
import bachataCalendarLogo from '@/assets/brand/bachata-calendar-logo.png';
import { isSignedInOnlyTarget } from '@/lib/accountRouting';
import { sanitizeReturnTo } from '@/lib/authRouting';
import { FOCUS_NOT_NOW_LABEL, isSignupFocusPath } from '@/lib/focusMode';

/**
 * Where "Not now" goes: the safe in-site returnTo the flow was opened with,
 * else home. A plain link: the person stays signed in and nothing is deleted.
 * Never back into the focus flow itself, and never a page behind AuthGuard or the
 * dancer gate (review #789 S2: signed out it opened "Welcome back"; mid-setup it
 * sent the person back into setup). Mirrors the dancer shell's notNowTarget. Lives here, not in lib/focusMode, so
 * the every-page mapping stays a leaf (authRouting rides this lazy chunk).
 */
export function focusNotNowHref(search: string): string {
  const params = new URLSearchParams(search);
  const target = sanitizeReturnTo(params.get('returnTo'));
  if (!target) return '/';
  const [targetPath, targetSearch = ''] = target.split('#', 1)[0].split('?');
  if (isSignedInOnlyTarget(target)) return '/';
  return isSignupFocusPath(targetPath, targetSearch, false) ? '/' : target;
}

/**
 * Sign-up focus mode top bar (lib/focusMode): the logo (not a link -- one exit,
 * not two) and a small "Not now". Same 60px box as GlobalHeader so the page
 * spacer still fits. Lazy-loaded by AppChrome: only focus paths ever fetch it.
 */
export default function FocusHeader() {
  const { search } = useLocation();
  return (
    <header
      id="app-header"
      data-testid="focus-header"
      className="fixed top-0 left-0 right-0 z-[60] h-[60px] border-b border-primary/10 bg-background/95"
    >
      <div className="flex h-[58px] items-center justify-between gap-3 px-4">
        <img
          src={bachataCalendarLogo}
          alt="Bachata Calendar"
          width={1639}
          height={192}
          className="h-5 w-auto"
          loading="eager"
          decoding="async"
        />
        <Link
          to={focusNotNowHref(search)}
          className="inline-flex min-h-[44px] items-center px-2 text-[14px] font-medium text-muted-foreground underline underline-offset-2"
        >
          {FOCUS_NOT_NOW_LABEL}
        </Link>
      </div>
    </header>
  );
}
