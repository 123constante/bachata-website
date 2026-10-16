import { PRIVACY_PATH, TERMS_PATH } from '@/lib/termsConsent';

// A new tab, not a route change: leaving the code step or the terms card
// threw away the step behind it (audit H8). 44px tall in px, not rem (M6).
const LINK_CLASS = 'inline-flex min-h-[44px] items-center px-1 align-middle underline underline-offset-2';

/**
 * D8 clickwrap: one line naming the action that agrees. `lead` is the words
 * before "the Terms and Privacy Policy", worded for the control on screen
 * (never "By continuing" where nothing says Continue).
 */
export const ConsentLine = ({ lead = 'By continuing you agree to our' }: { lead?: string }) => (
  <p className="text-[13px] leading-snug text-muted-foreground" data-testid="auth-consent">
    {lead}{' '}
    <a href={TERMS_PATH} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
      Terms
    </a>{' '}
    and{' '}
    <a href={PRIVACY_PATH} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
      Privacy Policy
    </a>
    .
  </p>
);
