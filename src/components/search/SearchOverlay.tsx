import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Search, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePublicSearch } from '@/hooks/usePublicSearch';
import { useSearchOverlay } from '@/contexts/SearchOverlayContext';
import type { SearchResult, SearchKind } from '@/lib/searchRpc';

const KIND_LABEL: Record<SearchKind, string> = { event: 'Events', venue: 'Venues', organiser: 'Organisers' };
const KIND_ORDER: SearchKind[] = ['event', 'venue', 'organiser'];

const TYPE_PILL: Record<string, { label: string; cls: string }> = {
  festival:    { label: 'Festival',      cls: 'bg-primary/20 text-accent' },
  class_party: { label: 'Class & Party', cls: 'bg-festival-purple/20 text-festival-purple' },
  party:       { label: 'Party',         cls: 'bg-festival-pink/20 text-festival-pink' },
  class:       { label: 'Class',         cls: 'bg-festival-blue/20 text-festival-blue' },
  event:       { label: 'Event',         cls: 'bg-white/10 text-muted-foreground' },
};

const fmtDate = (iso: string | null) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
};

const ResultRow = ({ r, onNavigate }: { r: SearchResult; onNavigate: () => void }) => {
  const meta = r.kind === 'event' && r.startTime
    ? fmtDate(r.startTime) + (r.subtitle ? ' \u00b7 ' + r.subtitle : '')
    : r.subtitle;
  return (
    <Link
      to={r.href}
      onClick={onNavigate}
      className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-2 transition-colors hover:border-primary/30 hover:bg-white/[0.06]"
    >
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-surface">
        {r.imageUrl ? <img src={r.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{r.title}</p>
        {meta ? <p className="truncate text-xs text-muted-foreground">{meta}</p> : null}
      </div>
      {r.kind === 'event' && r.eventType ? (() => {
        const pill = TYPE_PILL[r.eventType] ?? TYPE_PILL.event;
        return (
          <span className={cn('ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide', pill.cls)}>
            {pill.label}
          </span>
        );
      })() : null}
    </Link>
  );
};

export const SearchOverlay = () => {
  const { isOpen, close } = useSearchOverlay();
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { results, isLoading, term, hasQuery } = usePublicSearch(q);

  useEffect(() => {
    if (!isOpen) return;
    setQ('');
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, close]);

  const grouped = useMemo(() => {
    const m: Record<SearchKind, SearchResult[]> = { event: [], venue: [], organiser: [] };
    for (const r of results) m[r.kind].push(r);
    return m;
  }, [results]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-black/80 backdrop-blur-sm animate-in fade-in-0"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pt-4">
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-2 shadow-lg">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search events, venues, organisers&hellip;"
            aria-label="Search query"
            className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : null}
          <button onClick={close} aria-label="Close search" className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-3 flex-1 overflow-y-auto pb-8">
          {!hasQuery ? (
            <p className="px-1 pt-6 text-center text-sm text-muted-foreground">
              Type to search across events, venues &amp; organisers.
            </p>
          ) : null}
          {hasQuery && !isLoading && results.length === 0 ? (
            <p className="px-1 pt-6 text-center text-sm text-muted-foreground">No matches for &ldquo;{term}&rdquo;.</p>
          ) : null}
          <div className="space-y-4">
            {KIND_ORDER.map((kind) => grouped[kind].length > 0 ? (
              <section key={kind}>
                <h2 className="mb-1.5 px-1 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  {KIND_LABEL[kind]}
                </h2>
                <div className="space-y-1.5">
                  {grouped[kind].map((r) => <ResultRow key={r.kind + '-' + r.id} r={r} onNavigate={close} />)}
                </div>
              </section>
            ) : null)}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
