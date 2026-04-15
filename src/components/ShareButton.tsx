import { Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ShareButtonProps {
  eventName: string;
  dateLabel: string | null;
  venueName: string | null;
  className?: string;
}

export const ShareButton = ({ eventName, dateLabel, venueName, className }: ShareButtonProps) => {
  const pageUrl = window.location.href;

  const shareText = [
    eventName,
    dateLabel && venueName ? `${dateLabel} at ${venueName}` : dateLabel ?? venueName ?? null,
    pageUrl,
  ]
    .filter(Boolean)
    .join('\n');

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

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
        // User cancelled or error — fall through to WhatsApp
      }
    }
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

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
