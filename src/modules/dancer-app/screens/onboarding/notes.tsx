import type { CSSProperties } from 'react';
import { NOT_ME_MESSAGE, dancerMessageUsUrl } from '../../api/messageUs';
import { wrap } from './ui';

/** Inline links still get a 44px tap target. */
const tapLink: CSSProperties = { textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', minHeight: 44 };

/**
 * Shown on the first card only, and only for a profile we linked from an admin-made one.
 * No consent line here (audit M5): Terms and Privacy are accepted, and recorded, at sign-up.
 * The href is a static string (audit L16): lib/contactLinks already rides every route's chunk.
 */
const FirstCardNotes = ({ linked }: { linked: boolean }) => {
  if (!linked) return null;
  return (
    <div style={{ ...wrap, fontSize: 13, marginTop: 12 }} className="da-muted" data-testid="onboarding-first-notes">
      <p data-testid="onboarding-linked-notice" style={{ margin: 0 }}>
        We linked your existing profile. Not you?{' '}
        <a href={dancerMessageUsUrl(NOT_ME_MESSAGE)} target="_blank" rel="noopener noreferrer" style={tapLink}>
          Message us
        </a>
        .
      </p>
    </div>
  );
};

export default FirstCardNotes;
