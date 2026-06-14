// Festival Map mobile -- one-time "the map is interactive" hint for the inset
// map card. Shows once (localStorage-gated), fades itself out after a few
// seconds. Replaces the desktop MapHint on the mobile inset surface. SSR-safe:
// defaults hidden, the post-mount effect promotes it.

import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

// Bump the trailing version if the copy changes meaningfully, so a stale
// dismissal doesn't suppress a hint the user has not actually seen.
const KEY = 'map-inset-hint-v1';

export function MapHintPill({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let seen = false;
    try {
      seen = window.localStorage.getItem(KEY) === '1';
    } catch {
      seen = false;
    }
    if (seen) return;

    setMounted(true);
    // Persist "seen" as soon as the hint is shown, NOT in the drop timeout: if
    // the user taps a chip / opens a preview within the few-second window the
    // pill unmounts and an end-of-timer write would be cancelled, re-showing the
    // "one-time" hint on the next visit. The timers below drive only the visuals.
    try {
      window.localStorage.setItem(KEY, '1');
    } catch {
      /* swallow -- already hidden visually */
    }

    const inId = window.requestAnimationFrame(() => setShown(true));
    const fadeId = window.setTimeout(() => setShown(false), 3000);
    const dropId = window.setTimeout(() => setMounted(false), 3320);
    return () => {
      window.cancelAnimationFrame(inId);
      window.clearTimeout(fadeId);
      window.clearTimeout(dropId);
    };
  }, []);

  if (!mounted) return null;

  return (
    <div
      role="status"
      className={cn(
        'pointer-events-none inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-background/90 px-3 py-1.5 text-xs font-semibold text-foreground shadow-lg backdrop-blur',
        'transition-opacity duration-300 motion-reduce:transition-none',
        shown ? 'opacity-100' : 'opacity-0',
        className,
      )}
    >
      <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
      <span>Tap a pin to preview &middot; drag to explore</span>
    </div>
  );
}
