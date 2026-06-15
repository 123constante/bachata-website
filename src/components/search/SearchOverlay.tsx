import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Search, X, Loader2, CornerDownLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePublicSearch } from '@/hooks/usePublicSearch';
import { useCity } from '@/contexts/CityContext';
import { buildCityPath } from '@/lib/cityPath';
import { useIsMobile } from '@/hooks/use-mobile';
import { KIND_ICON, KIND_LABEL, CIRCLE_KINDS, type SearchKind } from '@/lib/searchEntities';
import { highlight } from './highlight';
import { pushRecent } from '@/lib/searchRecents';
import { recordSearchResultClick } from '@/lib/searchClickTelemetry';
import { DiscoveryPanel } from './DiscoveryPanel';
import type { SearchResult } from '@/lib/searchRpc';

const ELLIPSIS = '...';

// Grouped-by-type typeahead (approach A). Each group caps its rows so every
// type can surface -- a vendor or city is never buried under top-ranked events.
const GROUPS: { label: string; kinds: SearchKind[]; cap: number }[] = [
  { label: 'Events',     kinds: ['event'], cap: 4 },
  { label: 'Venues',     kinds: ['venue'], cap: 3 },
  { label: 'People',     kinds: ['teacher', 'dj', 'dancer'], cap: 5 },
  { label: 'Organisers', kinds: ['organiser'], cap: 3 },
  { label: 'Vendors',    kinds: ['vendor'], cap: 3 },
  { label: 'Places',     kinds: ['city'], cap: 3 },
];

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

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const navigate = useNavigate();
  const { citySlug } = useCity();
  const isMobile = useIsMobile();
  const reduceMotion = usePrefersReducedMotion();
  const [q, setQ] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { results, isLoading, term, hasQuery } = usePublicSearch(q, citySlug);

  const grouped = useMemo(
    () =>
      GROUPS.map((g) => ({
        label: g.label,
        rows: results.filter((r) => g.kinds.includes(r.kind)).slice(0, g.cap),
      })).filter((g) => g.rows.length > 0),
    [results],
  );
  const flatRows = useMemo(() => grouped.flatMap((g) => g.rows), [grouped]);
  const rowCount = hasQuery ? flatRows.length + 1 : 0;

  const reset = useCallback(() => { setQ(''); setActiveIndex(0); }, []);
  const close = useCallback(() => { reset(); onClose(); }, [reset, onClose]);

  const submitSearch = useCallback(() => {
    const t = q.trim();
    if (!t) return;
    pushRecent(t);
    close();
    navigate(`${buildCityPath(citySlug, 'search')}?q=${encodeURIComponent(t)}`);
  }, [q, citySlug, navigate, close]);

  const goTo = useCallback(
    (r: SearchResult, position: number) => {
      const t = (q.trim() || term).trim();
      if (t) {
        pushRecent(t);
        recordSearchResultClick({ query: t, kind: r.kind, id: r.id, position });
      }
      close();
      navigate(r.href);
    },
    [q, term, navigate, close],
  );

  useLayoutEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => { setActiveIndex(0); }, [term, hasQuery]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && rowCount > 0) {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % rowCount);
    } else if (e.key === 'ArrowUp' && rowCount > 0) {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + rowCount) % rowCount);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const picked = activeIndex > 0 && activeIndex <= flatRows.length ? flatRows[activeIndex - 1] : null;
      if (picked) goTo(picked, activeIndex); else submitSearch();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (q) reset(); else close();
    }
  };

  if (!open) return null;

  const panelAnim = reduceMotion ? '' : 'animate-in fade-in-0 slide-in-from-top-2';
  const fadeAnim = reduceMotion ? '' : 'animate-in fade-in-0';

  const inputBar = (
    <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
      <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={rowCount > 0}
        aria-controls="search-overlay-listbox"
        aria-autocomplete="list"
        aria-label="Search events, venues and people"
        placeholder={`Search events, venues, people${ELLIPSIS}`}
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      {isLoading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden="true" /> : null}
      <button type="button" onClick={close} aria-label="Close search" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );

  const body = hasQuery ? (
    <div id="search-overlay-listbox" role="listbox" aria-label="Search suggestions">
      <button
        role="option"
        aria-selected={activeIndex === 0}
        type="button"
        onMouseEnter={() => setActiveIndex(0)}
        onClick={submitSearch}
        className={cn('flex w-full items-center gap-3 px-3 py-2.5 text-left', activeIndex === 0 && 'bg-primary/10')}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-hover text-muted-foreground"><Search className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1 truncate text-sm">Search all for <span className="font-semibold text-foreground">{q.trim()}</span></span>
        <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground"><CornerDownLeft className="h-3 w-3" aria-hidden="true" /> Enter</span>
      </button>

      {flatRows.length === 0 && !isLoading ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">No matches. Press Enter to search all.</p>
      ) : (
        grouped.map((g) => (
          <div key={g.label}>
            <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{g.label}</div>
            {g.rows.map((r) => {
              const idx = flatRows.indexOf(r) + 1;
              const Icon = KIND_ICON[r.kind];
              const round = CIRCLE_KINDS.includes(r.kind) ? 'rounded-full' : 'rounded-lg';
              return (
                <button
                  key={`${r.kind}-${r.id}`}
                  role="option"
                  aria-selected={activeIndex === idx}
                  type="button"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => goTo(r, idx)}
                  className={cn('flex w-full items-center gap-3 px-3 py-2 text-left', activeIndex === idx && 'bg-primary/10')}
                >
                  <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden bg-surface-hover', round)}>
                    {r.imageUrl ? <img src={r.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : <Icon className="h-4 w-4 text-muted-foreground" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">{highlight(r.title, term)}</span>
                    {r.subtitle ? <span className="block truncate text-xs text-muted-foreground">{r.subtitle}</span> : null}
                  </span>
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{KIND_LABEL[r.kind]}</span>
                </button>
              );
            })}
          </div>
        ))
      )}
    </div>
  ) : (
    <DiscoveryPanel citySlug={citySlug} onPickTerm={(t) => { setQ(t); inputRef.current?.focus(); }} onNavigate={close} />
  );

  if (isMobile) {
    return createPortal(
      <div className={cn('fixed inset-0 z-[70] flex flex-col bg-background', fadeAnim)} role="dialog" aria-modal="true" aria-label="Search">
        {inputBar}
        <div className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">{body}</div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <div className={cn('absolute inset-0 bg-black/60 backdrop-blur-[2px]', fadeAnim)} onMouseDown={close} aria-hidden="true" />
      <div className="absolute inset-x-0 top-[10vh] px-3">
        <div className={cn('mx-auto max-w-2xl overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl', panelAnim)} role="dialog" aria-modal="true" aria-label="Search">
          {inputBar}
          <div className="max-h-[min(70vh,32rem)] overflow-y-auto">{body}</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
