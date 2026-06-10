import { useEffect, useState } from 'react';
import { MapPin, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Bump the trailing version if the copy changes meaningfully, so a stale
// dismissal doesn't suppress a hint the user has not actually seen.
const DISMISS_KEY = 'map-pins-hint-dismissed-v1';

/**
 * Small dismissable pill telling first-time visitors that the map pins are
 * interactive (tap a pin -> the list jumps to that event). Self-dismisses on
 * the X and remembers it via localStorage so repeat visits aren't pestered.
 * SSR-safe: defaults hidden, the post-mount effect promotes it.
 */
export function MapHint({ className }: { className?: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setVisible(window.localStorage.getItem(DISMISS_KEY) !== '1');
    } catch {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* swallow -- already hidden visually */
    }
  };

  if (!visible) return null;

  return (
    <div
      className={cn(
        'pointer-events-auto inline-flex items-center gap-2 rounded-full border border-primary/40 bg-background/90 px-3 py-1.5 text-xs font-semibold text-foreground shadow-lg backdrop-blur',
        className,
      )}
    >
      <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
      <span>Tap a pin to jump to its event</span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss hint"
        className="-mr-1 shrink-0 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
