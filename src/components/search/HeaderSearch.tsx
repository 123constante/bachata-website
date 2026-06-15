import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type KeyboardEvent, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Search, X, Loader2, Clock, CornerDownLeft,
  Calendar, MapPin, Building2, GraduationCap, Music, User, ShoppingBag, Globe,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePublicSearch } from '@/hooks/usePublicSearch';
import { useCity } from '@/contexts/CityContext';
import { buildCityPath } from '@/lib/cityPath';
import type { SearchKind } from '@/lib/searchRpc';

// Inline header omnibox (approach: omnibox typeahead). Lives in GlobalHeader;
// the magnifier expands into a field that fills the bar, and a typeahead panel
// drops from the header (page dimmed behind). Reuses usePublicSearch, so the
// 220ms debounce, 2-char gate and source='header' telemetry come for free.

const MAX_SUGGESTIONS = 7;
const RECENTS_KEY = 'bc_omnibox_recent_v1';
const MAX_RECENTS = 5;
const ELLIPSIS = '...';

const KIND_ICON: Record<SearchKind, LucideIcon> = {
  event: Calendar, venue: MapPin, organiser: Building2,
  teacher: GraduationCap, dj: Music, dancer: User, vendor: ShoppingBag, city: Globe,
};
const KIND_LABEL: Record<SearchKind, string> = {
  event: 'Event', venue: 'Venue', organiser: 'Organiser',
  teacher: 'Teacher', dj: 'DJ', dancer: 'Dancer', vendor: 'Vendor', city: 'City',
};
const CIRCLE_KINDS: SearchKind[] = ['organiser', 'teacher', 'dj', 'dancer'];

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduce(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduce(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduce;
}

function readRecents(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr)
      ? arr.filter((x): x is string => typeof x === 'string').slice(0, MAX_RECENTS)
      : [];
  } catch {
    return [];
  }
}

function pushRecent(term: string): void {
  if (typeof window === 'undefined') return;
  const t = term.trim();
  if (t.length < 2) return;
  try {
    const cur = readRecents().filter((x) => x.toLowerCase() !== t.toLowerCase());
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify([t, ...cur].slice(0, MAX_RECENTS)));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Wrap matched query tokens in an amber mark. Cosmetic only: the RPC already
// ranked the match, so if the client-side match misses (e.g. diacritics) we
// just render the plain title.
function highlight(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return text;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (!tokens.length) return text;
  let re: RegExp;
  try {
    re = new RegExp(`(${tokens.map(escapeRegExp).join('|')})`, 'ig');
  } catch {
    return text;
  }
  const lower = new Set(tokens.map((t) => t.toLowerCase()));
  return text.split(re).filter(Boolean).map((part, i) =>
    lower.has(part.toLowerCase())
      ? <mark key={i} className="bg-transparent font-bold text-primary">{part}</mark>
      : <span key={i}>{part}</span>,
  );
}

interface HeaderSearchProps {
  expanded: boolean;
  onExpandedChange: (next: boolean) => void;
}

export const HeaderSearch = ({ expanded, onExpandedChange }: HeaderSearchProps) => {
  const navigate = useNavigate();
  const { citySlug } = useCity();
  const reduceMotion = usePrefersReducedMotion();
  const [q, setQ] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [recents, setRecents] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef(false);

  const { results, isLoading, term, hasQuery } = usePublicSearch(q, citySlug);
  const suggestions = useMemo(() => results.slice(0, MAX_SUGGESTIONS), [results]);
  const showRecents = !hasQuery && q.trim() === '' && recents.length > 0;
  // Keyboard rows: results mode -> [search-all, ...suggestions]; recents mode -> recents.
  const rowCount = hasQuery ? suggestions.length + 1 : (showRecents ? recents.length : 0);

  const collapse = useCallback(() => {
    onExpandedChange(false);
    setQ('');
    setActiveIndex(0);
  }, [onExpandedChange]);

  // Close via Escape / the X / the backdrop: flag a focus-return to the trigger.
  const closeAndRefocus = useCallback(() => {
    returnFocusRef.current = true;
    collapse();
  }, [collapse]);

  const goTo = useCallback((href: string, recentTerm?: string) => {
    if (recentTerm) pushRecent(recentTerm);
    collapse();
    navigate(href);
  }, [collapse, navigate]);

  const submitSearch = useCallback(() => {
    const t = q.trim();
    if (!t) return;
    goTo(`${buildCityPath(citySlug, 'search')}?q=${encodeURIComponent(t)}`, t);
  }, [q, citySlug, goTo]);

  // Refresh recents when the bar opens.
  useEffect(() => {
    if (expanded) setRecents(readRecents());
  }, [expanded]);

  // Focus the input synchronously once it has mounted (no setTimeout race).
  useLayoutEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  // Lock body scroll while the panel is open (restored on close).
  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [expanded]);

  // Return focus to the trigger after an Escape/X/backdrop close (not navigation).
  useEffect(() => {
    if (!expanded && returnFocusRef.current) {
      returnFocusRef.current = false;
      triggerRef.current?.focus();
    }
  }, [expanded]);

  // New results / mode change -> reset the highlight to the first row.
  useEffect(() => { setActiveIndex(0); }, [term, hasQuery, recents.length]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && rowCount > 0) {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % rowCount);
    } else if (e.key === 'ArrowUp' && rowCount > 0) {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + rowCount) % rowCount);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (hasQuery) {
        const picked = activeIndex > 0 && activeIndex <= suggestions.length ? suggestions[activeIndex - 1] : null;
        if (picked) goTo(picked.href, q.trim());
        else submitSearch();
      } else if (showRecents && recents[activeIndex]) {
        setQ(recents[activeIndex]);
        setActiveIndex(0);
      } else {
        submitSearch();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (q) { setQ(''); setActiveIndex(0); }
      else closeAndRefocus();
    }
  };

  // ----- collapsed: mobile = a visible search pill, desktop = the icon button.
  // The pill makes navigational search discoverable on mobile, where the in-feed
  // map filter was removed in favour of this omnibox; md+ keeps the compact icon.
  if (!expanded) {
    return (
      <button
        ref={triggerRef}
        type="button"
        onClick={() => onExpandedChange(true)}
        aria-label="Search events, venues, people"
        aria-expanded={false}
        className={cn(
          'flex items-center text-foreground/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          // mobile: a search pill that fills the bar (GlobalHeader hides its spacer < md)
          'ml-2 h-9 min-w-0 max-w-xs flex-1 gap-2 rounded-full border border-border bg-muted/30 px-3 hover:bg-muted/50 hover:text-primary',
          // desktop (md+): collapse back to the icon-only circle
          'md:ml-auto md:h-9 md:w-9 md:max-w-none md:flex-none md:justify-center md:gap-0 md:rounded-full md:border-0 md:bg-transparent md:px-0 md:hover:bg-primary/10',
        )}
      >
        <Search className="h-4 w-4 shrink-0 md:h-5 md:w-5" aria-hidden="true" />
        <span className="truncate text-sm text-muted-foreground md:hidden">
          Search events, venues, people&hellip;
        </span>
      </button>
    );
  }

  const fadeAnim = reduceMotion ? '' : 'animate-in fade-in-0';
  const panelAnim = reduceMotion ? '' : 'animate-in fade-in-0 slide-in-from-top-2';

  // ----- expanded: inline field (in the bar) + portalled typeahead panel -----
  return (
    <>
      <div className={cn('mx-auto flex h-9 w-full max-w-2xl items-center gap-2 rounded-full border border-primary/40 bg-surface px-3 shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]', fadeAnim)}>
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={rowCount > 0}
          aria-controls="omnibox-listbox"
          aria-autocomplete="list"
          aria-activedescendant={rowCount > 0 ? `omnibox-opt-${activeIndex}` : undefined}
          aria-label="Search events, venues and people"
          placeholder={`Search events, venues, people${ELLIPSIS}`}
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {isLoading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden="true" /> : null}
        <button
          type="button"
          onClick={closeAndRefocus}
          aria-label="Close search"
          title="Close search (Esc)"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {createPortal(
        <div className="fixed inset-0 z-[58]">
          <div
            className={cn('absolute inset-x-0 bottom-0 top-[60px] bg-black/60 backdrop-blur-[2px]', fadeAnim)}
            onMouseDown={closeAndRefocus}
            aria-hidden="true"
          />
          <div className="absolute inset-x-0 top-[60px] px-3">
            <div className={cn('mx-auto max-w-2xl overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl', panelAnim)}>
              {hasQuery ? (
                <div
                  id="omnibox-listbox"
                  role="listbox"
                  aria-label="Search suggestions"
                  className="max-h-[min(75dvh,28rem)] overflow-y-auto py-1 pb-[env(safe-area-inset-bottom)]"
                >
                  {/* row 0 -- run the full search */}
                  <button
                    id="omnibox-opt-0"
                    role="option"
                    aria-selected={activeIndex === 0}
                    type="button"
                    onMouseEnter={() => setActiveIndex(0)}
                    onClick={submitSearch}
                    className={cn('flex w-full items-center gap-3 px-3 py-2.5 text-left', activeIndex === 0 && 'bg-primary/10')}
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-hover text-muted-foreground">
                      <Search className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      Search for <span className="font-semibold text-foreground">{q.trim()}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      <CornerDownLeft className="h-3 w-3" aria-hidden="true" /> Enter
                    </span>
                  </button>

                  {suggestions.map((r, i) => {
                    const idx = i + 1;
                    const Icon = KIND_ICON[r.kind];
                    const round = CIRCLE_KINDS.includes(r.kind) ? 'rounded-full' : 'rounded-lg';
                    return (
                      <button
                        key={`${r.kind}-${r.id}`}
                        id={`omnibox-opt-${idx}`}
                        role="option"
                        aria-selected={activeIndex === idx}
                        type="button"
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => goTo(r.href, q.trim())}
                        className={cn('flex w-full items-center gap-3 px-3 py-2 text-left', activeIndex === idx && 'bg-primary/10')}
                      >
                        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden bg-surface-hover', round)}>
                          {r.imageUrl
                            ? <img src={r.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                            : <Icon className="h-4 w-4 text-muted-foreground" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-foreground">{highlight(r.title, term)}</span>
                          {r.subtitle ? <span className="block truncate text-xs text-muted-foreground">{r.subtitle}</span> : null}
                        </span>
                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{KIND_LABEL[r.kind]}</span>
                      </button>
                    );
                  })}

                  {isLoading && suggestions.length === 0 ? (
                    <p className="px-3 py-3 text-sm text-muted-foreground">{`Searching${ELLIPSIS}`}</p>
                  ) : null}
                  {!isLoading && suggestions.length === 0 ? (
                    <p className="px-3 py-3 text-sm text-muted-foreground">No results. Press Enter to search all.</p>
                  ) : null}
                </div>
              ) : showRecents ? (
                <div
                  id="omnibox-listbox"
                  role="listbox"
                  aria-label="Recent searches"
                  className="max-h-[min(75dvh,28rem)] overflow-y-auto py-1 pb-[env(safe-area-inset-bottom)]"
                >
                  <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Recent</div>
                  {recents.map((rec, i) => (
                    <button
                      key={rec}
                      id={`omnibox-opt-${i}`}
                      role="option"
                      aria-selected={activeIndex === i}
                      type="button"
                      onMouseEnter={() => setActiveIndex(i)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setQ(rec); setActiveIndex(0); inputRef.current?.focus(); }}
                      className={cn('flex w-full items-center gap-3 px-3 py-2 text-left', activeIndex === i && 'bg-primary/10')}
                    >
                      <Clock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="truncate text-sm">{rec}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="px-3 py-3 text-center text-sm text-muted-foreground">
                  Search events, venues, organisers, teachers, DJs and dancers.
                </p>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};
