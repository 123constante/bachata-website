import { useEffect } from 'react';
import { Check } from 'lucide-react';

/** The visible green "Saved" (D119 #1). The screen-reader announcement stays in AnnounceRegion; this is decoration. */
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
      <span className="inline-flex h-[44px] items-center gap-[8px] rounded-full border border-[var(--ok-fg)] bg-[var(--ok-bg)] px-[18px] text-[15px] font-semibold text-[var(--ok-fg)] backdrop-blur">
        <Check className="h-[18px] w-[18px]" />
        Saved
      </span>
    </div>
  );
}
