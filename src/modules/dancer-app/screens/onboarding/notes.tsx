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
      {/* TODO(1b): accept_terms_v1 -- release 1a only shows the line; the RPC ships in PR A2.
          ORCHESTRATOR: the brief asks for links, but no Terms or Privacy page exists on the site (/terms and
          /privacy are not routes; navigateTargetsRoutable refuses them). Plain text until the pages exist. */}
      <p data-testid="onboarding-consent" style={{ margin: 0 }}>
        By continuing you accept the Terms and Privacy policy.
      </p>
    </div>
  );
};

export default FirstCardNotes;
