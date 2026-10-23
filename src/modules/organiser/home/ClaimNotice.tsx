import { useState } from 'react';
import { claimedNoticeText, clearClaimNotice, notYouOrganiserHref, readClaimNotice } from '@/lib/claimMyOrganisers';

/**
 * "You now manage X. Not you? Tell us" for the pages claimed at this sign-in (AuthCallback keeps
 * it in sessionStorage). A line in Home's own flow, never an overlay on its rows (review finding 7),
 * with a visible 44 px Close; it stays until closed, because Tell us is the only way to undo a
 * claim that skipped the confirm screen.
 */
export function ClaimNotice() {
  const [claimed, setClaimed] = useState(readClaimNotice);
  if (claimed.length === 0) return null;
  const close = () => {
    clearClaimNotice();
    setClaimed([]);
  };
  return (
    <div
      role="status"
      data-testid="home-claim-notice"
      className="mb-[12px] flex items-start gap-[8px] rounded-[12px] bg-[var(--ok-bg)] py-[4px] pl-[12px] pr-[4px] text-[14px] text-[var(--ok-fg)]"
    >
      <p className="min-w-0 flex-1 py-[8px]">
        <span className="font-semibold">{claimedNoticeText(claimed)}</span>{' '}
        Not you?{' '}
        <a
          href={notYouOrganiserHref(claimed)}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="home-claim-notice-tell-us"
          className="-my-[12px] inline-flex min-h-[44px] items-center px-[4px] font-semibold underline"
        >
          Tell us
        </a>
      </p>
      <button
        type="button"
        onClick={close}
        data-testid="home-claim-notice-close"
        className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-[8px] px-[8px] text-[14px] font-semibold underline"
      >
        Close
      </button>
    </div>
  );
}
