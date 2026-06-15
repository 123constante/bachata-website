import { Search } from 'lucide-react';
import { useSearch } from './SearchProvider';
import { cn } from '@/lib/utils';

// Shortcut label is platform-aware: Mac shows the Command glyph (built from its
// code point to keep the source ASCII), everything else shows "Ctrl" — both
// because Ctrl+K is the real binding off-Mac and because Inter has no Command
// glyph there (it would render as an empty box). The hotkey handler listens for
// Cmd OR Ctrl regardless of what the label says.
const isMac =
  typeof navigator !== 'undefined' && /Macintosh|Mac OS X/i.test(navigator.userAgent || '');
const SHORTCUT = isMac ? `${String.fromCharCode(0x2318)}K` : 'Ctrl K';

// Header search trigger. Mobile: a search pill that fills the bar (matches the
// old collapsed HeaderSearch). Desktop: a faux "Search... shortcut" field. Both
// just open the overlay.
export function SearchTrigger() {
  const { openSearch } = useSearch();
  return (
    <button
      type="button"
      onClick={openSearch}
      aria-label="Search events, venues, people"
      className={cn(
        'flex items-center text-foreground/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        'ml-2 h-9 min-w-0 max-w-xs flex-1 gap-2 rounded-full border border-border bg-muted/30 px-3 hover:bg-muted/50 hover:text-primary',
        'md:ml-auto md:h-9 md:w-64 md:max-w-none md:flex-none md:justify-start',
      )}
    >
      <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate text-sm text-muted-foreground">Search events, venues, people&hellip;</span>
      <kbd className="ml-auto hidden shrink-0 items-center gap-0.5 rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground md:inline-flex">
        {SHORTCUT}
      </kbd>
    </button>
  );
}
