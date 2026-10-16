import type { CSSProperties } from 'react';
import { useLazy } from './useLazy';
import { wrap } from './ui';

// The message-us link lives in lib/contactLinks, loaded on demand: see useLazy.

/** Inline links still get a 44px tap target. */
const tapLink: CSSProperties = { textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', minHeight: 44 };

/** Shown on the first card only. */
const FirstCardNotes = ({ linked }: { linked: boolean }) => {
  const messageUs = useLazy(() => import('@/lib/contactLinks'))?.WHATSAPP_GET_LISTED_URL;
  return (
    <div style={{ ...wrap, fontSize: 13, marginTop: 12 }} className="da-muted" data-testid="onboarding-first-notes">
      {linked ? (
        <p data-testid="onboarding-linked-notice" style={{ margin: '0 0 6px' }}>
          We linked your existing profile. Not you?{' '}
          <a href={messageUs} target="_blank" rel="noopener noreferrer" style={tapLink}>
            Message us
          </a>
          .
        </p>
      ) : null}
      {/* Consent is recorded at /auth (lib/termsConsent acceptTerms, D8): the sign-up code screen carries the
          clickwrap and calls accept_terms_v1 once on success; an existing account gets a one-tap card at
          sign-in. This line only repeats it. /terms and /privacy are not routes yet: plain text here. */}
      <p data-testid="onboarding-consent" style={{ margin: 0 }}>
        By continuing you accept the Terms and Privacy policy.
      </p>
    </div>
  );
};

export default FirstCardNotes;
