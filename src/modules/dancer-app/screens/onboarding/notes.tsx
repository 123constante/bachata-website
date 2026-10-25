import { NOT_ME_MESSAGE, dancerMessageUsUrl } from '../../api/messageUs';
import { WRAP } from './ui';

/** Inline links still get a 44px tap target. */
const TAP_LINK = 'inline-flex min-h-[44px] items-center underline';

/**
 * Shown on the first card only, and only for a profile we linked from an admin-made one.
 * No consent line here (audit M5): Terms and Privacy are accepted, and recorded, at sign-up.
 * The href is a static string (audit L16): lib/contactLinks already rides every route's chunk.
 */
const FirstCardNotes = ({ linked }: { linked: boolean }) => {
  if (!linked) return null;
  return (
    <div className={`${WRAP} mt-[12px] text-[13px] text-[var(--mut)]`} data-testid="onboarding-first-notes">
      <p data-testid="onboarding-linked-notice" className="m-0">
        We linked your existing profile. Not you?{' '}
        <a href={dancerMessageUsUrl(NOT_ME_MESSAGE)} target="_blank" rel="noopener noreferrer" className={TAP_LINK}>
          Message us
        </a>
        .
      </p>
    </div>
  );
};

export default FirstCardNotes;
