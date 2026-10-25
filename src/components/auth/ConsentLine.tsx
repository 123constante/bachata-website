import { PRIVACY_PATH, TERMS_PATH } from '@/lib/termsConsent';

// A new tab, not a route change: leaving the code step or the terms card
// threw away the step behind it (audit H8). A 44px tap area in px (M6), drawn by an
// invisible before: box so the sentence keeps normal line spacing.
const LINK_CLASS = "relative underline underline-offset-2 before:absolute before:-inset-x-1 before:-inset-y-[14px] before:content-['']";

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
