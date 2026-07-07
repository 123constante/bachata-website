import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearch } from './SearchProvider';
import { cn } from '@/lib/utils';

// Shortcut label is platform-aware: macOS shows the Command glyph (built from its
// code point to keep the source ASCII), everything else shows "Ctrl" -- both
// because Ctrl+K is the real binding off-Mac and because Inter has no Command
// glyph there (it would render as an empty box). The hotkey handler listens for
// Cmd OR Ctrl regardless of what the label says.
//
// Detection runs POST-MOUNT (not at module load) so the server and the first
// client render agree on "Ctrl K". Reading navigator during render mismatched
// hydration (#418/#425) on iOS -- whose UA contains "Mac OS X", so the client
// rendered the glyph while the server rendered "Ctrl K". iOS/iPadOS also have no
// Command key, so touch devices are excluded: only real macOS desktop gets it.
const CTRL = 'Ctrl K';
const CMD = `${String.fromCharCode(0x2318)}K`;

// Header search trigger. Mobile: a search pill that fills the bar (matches the
// old collapsed HeaderSearch). Desktop: a faux "Search... shortcut" field. Both
// just open the overlay.
export function SearchTrigger() {
  const { openSearch } = useSearch();
  const [shortcut, setShortcut] = useState(CTRL);
  useEffect(() => {
    const ua = navigator.userAgent || '';
    const isMacDesktop =
      /Macintosh|Mac OS X/i.test(ua) &&
      !/iPhone|iPad|iPod/i.test(ua) &&
      !('ontouchstart' in window);
    if (isMacDesktop) setShortcut(CMD);
  }, []);
  return (
    <button
      type="button"
      onClick={openSearch}
      aria-label="Search events, venues, people"
      className={cn(
        'flex items-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        'ml-2 h-9 min-w-0 max-w-xs flex-1 gap-2 rounded-full border border-primary/30 bg-primary/[0.04] px-3 shadow-[0_0_0_3px_hsl(var(--primary)/0.07)] hover:border-primary/50 hover:bg-primary/[0.07]',
        'md:ml-auto md:h-9 md:w-64 md:max-w-none md:flex-none md:justify-start',
      )}
    >
      <Search className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <span className="truncate text-sm text-muted-foreground">Search events, venues, people&hellip;</span>
      <kbd className="ml-auto hidden shrink-0 items-center gap-0.5 rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground md:inline-flex">
        {shortcut}
      </kbd>
    </button>
  );
}
