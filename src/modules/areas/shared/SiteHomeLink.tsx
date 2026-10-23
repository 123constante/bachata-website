import { Home } from 'lucide-react';
import { GuardedLink } from './GuardedLink';

export const SITE_HOME_LABEL = 'Bachata Calendar';

/**
 * D120: the top-left "Bachata Calendar" link with a home icon, to the landing page `/`. ONE component for every
 * person-area screen (slice B imports it from `@/modules/areas`). Goes through the Discard sheet when a form is dirty.
 */
export function SiteHomeLink({ className = '' }: { className?: string }) {
  return (
    <GuardedLink
      to="/"
      data-testid="site-home-link"
      className={`inline-flex h-[44px] items-center gap-[6px] rounded-[12px] px-[8px] text-[15px] font-semibold text-[var(--fg)] ${className}`}
    >
      <Home aria-hidden="true" className="h-[18px] w-[18px] text-[var(--gold)]" />
      {SITE_HOME_LABEL}
    </GuardedLink>
  );
}
