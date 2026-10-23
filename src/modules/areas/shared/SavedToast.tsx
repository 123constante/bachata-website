import { useEffect } from 'react';
import { Check } from 'lucide-react';

/** The visible green "Saved" (D119 #1): a SOLID pill (review B3), readable over any page content, even the orange footer. The screen-reader announcement stays in AnnounceRegion; this is decoration. */
export function SavedToast({ show, onDone }: { show: boolean; onDone: () => void }) {
  useEffect(() => {
    if (!show) return undefined;
    const t = window.setTimeout(onDone, 2500);
    return () => window.clearTimeout(t);
  }, [show, onDone]);
  if (!show) return null;
  return (
    <div
      aria-hidden="true"
      data-testid="saved-toast"
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center"
      style={{ bottom: 'calc(24px + env(safe-area-inset-bottom))' }}
    >
      <span className="inline-flex h-[44px] items-center gap-[8px] rounded-full border border-transparent bg-[var(--ok-fg)] px-[18px] text-[15px] font-semibold text-[var(--btnfg)] shadow-lg">
        <Check className="h-[18px] w-[18px]" />
        Saved
      </span>
    </div>
  );
}
