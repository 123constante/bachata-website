import { Link } from 'react-router-dom';
import { PRIVACY_PATH, TERMS_PATH } from '@/lib/termsConsent';

/** D8 clickwrap: one line, shown at sign-UP only. */
export const ConsentLine = () => (
  <p className="text-xs text-muted-foreground" data-testid="auth-consent">
    By continuing you agree to the{' '}
    <Link to={TERMS_PATH} className="underline">
      Terms
    </Link>{' '}
    and{' '}
    <Link to={PRIVACY_PATH} className="underline">
      Privacy Policy
    </Link>
    .
  </p>
);
