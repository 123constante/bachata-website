import { Share2 } from 'lucide-react';
import { LINK_COPIED, SHARE_JOIN_LINE, SHARE_JOIN_LINK } from '@/modules/organiser/shared/teamRules';
import { GhostButton } from '../ui';

/** The public page URL. Slug-free on purpose: /organisers/:id is the route that always resolves. */
export const publicPageUrl = (origin: string, organiserId: string) => `${origin.replace(/\/+$/, '')}/organisers/${organiserId}`;

/** An interim manager cannot add people; they share the page and the person taps "Ask to join" themselves. */
export function ShareJoinLink({ organiserId, organiserName, announce }: { organiserId: string; organiserName: string; announce: (m: string) => void }) {
  const press = async () => {
    const url = publicPageUrl(typeof window === 'undefined' ? '' : window.location.origin, organiserId);
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (typeof nav.share === 'function') {
      try { await nav.share({ title: organiserName, url }); } catch { /* cancelled: nothing was written */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      announce(LINK_COPIED);
    } catch {
      announce(`Copy this link and send it to them: ${url}`);
    }
  };
  return (
    <>
      <GhostButton testId="team-share-join-link" aria-describedby="team-share-join-line" onClick={() => void press()}><Share2 aria-hidden="true" className="h-[18px] w-[18px]" /> {SHARE_JOIN_LINK}</GhostButton>
      <p id="team-share-join-line" className="text-[13px] text-[var(--mut)]" data-testid="team-share-join-line">{SHARE_JOIN_LINE}</p>
    </>
  );
}
