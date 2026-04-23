import { Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

interface ShareButtonProps {
  eventName: string;
  dateLabel: string | null;
  venueName: string | null;
  className?: string;
  /**
   * Fallback for browsers without navigator.share.
   * - 'whatsapp' (default): opens a wa.me link, preserving existing behaviour
   *   for any call-site that relied on the original implementation.
   * - 'copy': copies the page URL to the clipboard and surfaces a toast.
   */
  fallback?: 'whatsapp' | 'copy';
  /**
   * - 'default' (default): pill button with "Share" label. Unchanged.
   * - 'icon': small circular icon-only button, suited for overlays.
   */
  variant?: 'default' | 'icon';
}

export const ShareButton = ({
  eventName,
  dateLabel,
  venueName,
  className,
  fallback = 'whatsapp',
  variant = 'default',
}: ShareButtonProps) => {
  const pageUrl = window.location.href;

  const shareText = [
    eventName,
    dateLabel && venueName ? `${dateLabel} at ${venueName}` : dateLabel ?? venueName ?? null,
    pageUrl,
  ]
    .filter(Boolean)
    .join('\n');

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  const runCopyFallback = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      toast.success('Link copied');
    } catch {
      toast.error("Couldn't copy — try again");
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: eventName,
          text: dateLabel && venueName ? `${dateLabel} at ${venueName}` : undefined,
          url: pageUrl,
        });
        return;
      } catch {
        // User cancelled or the share sheet errored — drop through to fallback.
      }
    }
    if (fallback === 'copy') {
      await runCopyFallback();
      return;
    }
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleShare}
        aria-label="Share this event"
        className={
          'flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ' +
          (className ?? '')
        }
      >
        <Share2 className="h-4 w-4" />
      </button>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className={`h-8 rounded-full px-3 text-xs gap-1.5 ${className ?? ''}`}
      onClick={handleShare}
    >
      <Share2 className="h-3.5 w-3.5" />
      Share
    </Button>
  );
};
