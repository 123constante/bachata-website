import { useCallback, useState } from 'react';
import { Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

/**
 * VenueActionRow — single Share button (post 2026-04-30 Ricky decisions).
 *
 * Decided 2026-04-30:
 *   - NO Save / favourite button.
 *   - NO Directions button (address text-link replaces it).
 *   - NO Events button (the upcoming-events tile lives at the bottom
 *     of the page and is independently scrollable).
 *
 * What remains is just Share. Kept as a small horizontal button so
 * the share affordance stays one-tap.
 */
export const VenueActionRow = ({ venueName }: { venueName: string }) => {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const handleShare = useCallback(async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        setBusy(true);
        await navigator.share({ title: venueName, url });
      } catch (err) {
        if ((err as { name?: string })?.name !== 'AbortError') {
          console.warn('[VenueActionRow] share failed', err);
        }
      } finally {
        setBusy(false);
      }
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        toast({ title: 'Link copied', description: 'Paste it anywhere to share this venue.' });
      } catch {
        toast({
          title: 'Could not copy link',
          description: 'Long-press the address bar to copy manually.',
          variant: 'destructive',
        });
      }
    }
  }, [venueName, toast]);

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-md border border-venue-line bg-venue-surface hover:bg-venue-surface-hi transition-colors px-3.5 py-2.5 text-xs font-medium min-h-[44px] min-w-[44px] text-venue-cream-mut hover:text-venue-cream disabled:opacity-60 disabled:cursor-not-allowed"
      aria-label="Share this venue"
    >
      <Share2 className="w-3.5 h-3.5 flex-shrink-0 text-venue-brass" aria-hidden="true" />
      Share
    </button>
  );
};

export default VenueActionRow;
