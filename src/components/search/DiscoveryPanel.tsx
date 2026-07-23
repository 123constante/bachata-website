import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { readRecents, clearRecents } from '@/lib/searchRecents';
import { usePopularSearches } from '@/hooks/usePopularSearches';
import { useUpcomingFestivalsGlobal } from '@/hooks/useUpcomingFestivalsGlobal';
import { buildCityPath } from '@/lib/cityPath';
import { resolveEventImage } from '@/lib/utils';
import { optimizedImageUrl } from '@/lib/imageCdn';

interface DiscoveryPanelProps {
  citySlug: string | null;
  onPickTerm: (term: string) => void; // fill the input with a term, keep typing
  onNavigate: () => void;             // close the overlay after a Link click
}

// The search empty state (approach A order): recents -> popular chips ->
// browse categories -> upcoming-festival mini-grid. Empty blocks are suppressed
// rather than showing "nothing here".
export function DiscoveryPanel({ citySlug, onPickTerm, onNavigate }: DiscoveryPanelProps) {
  const [recents, setRecents] = useState<string[]>(() => readRecents());
  const { data: popular = [] } = usePopularSearches(citySlug);
  const { data: festivals = [] } = useUpcomingFestivalsGlobal();

  const categories = [
    { label: 'Parties', href: buildCityPath(citySlug, 'parties') },
    { label: 'Classes', href: buildCityPath(citySlug, 'classes') },
    { label: 'Venues', href: buildCityPath(citySlug, 'venues') },
    { label: 'Teachers', href: '/teachers' },
    { label: 'DJs', href: '/djs' },
    { label: 'Organisers', href: '/organisers' },
  ];
  const fests = festivals.slice(0, 6);
  const clear = () => { clearRecents(); setRecents([]); };
  const labelCls = 'mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground';

  return (
    <div className="py-2 pb-[env(safe-area-inset-bottom)]">
      {recents.length > 0 && (
        <section className="px-3 pt-2">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Recent</h3>
            <button type="button" onClick={clear} className="text-xs font-medium text-primary hover:text-primary/80">Clear</button>
          </div>
          <div className="space-y-0.5">
            {recents.map((r) => (
              <button key={r} type="button" onClick={() => onPickTerm(r)} className="flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-left text-sm hover:bg-primary/10">
                <Clock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate">{r}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {popular.length > 0 && (
        <section className="px-3 pt-3">
          <h3 className={labelCls}>Popular searches</h3>
          <div className="flex flex-wrap gap-2">
            {popular.map((p) => (
              <button key={p.query} type="button" onClick={() => onPickTerm(p.query)} className="rounded-full border border-primary/35 bg-primary/5 px-3 py-1.5 text-xs text-primary hover:bg-primary/10">
                {p.query}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="px-3 pt-3">
        <h3 className={labelCls}>Browse</h3>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <Link key={c.label} to={c.href} onClick={onNavigate} className="rounded-full border border-border px-3 py-1.5 text-xs text-foreground hover:border-primary/40 hover:text-primary">
              {c.label}
            </Link>
          ))}
        </div>
      </section>

      {fests.length > 0 && (
        <section className="px-3 pb-3 pt-3">
          <h3 className={labelCls}>Upcoming festivals</h3>
          <div className="grid grid-cols-3 gap-3">
            {fests.map((f) => {
              const img = resolveEventImage(f.poster_url, null);
              return (
                <Link key={f.id} to={`/festival/${f.id}`} onClick={onNavigate} className="group overflow-hidden rounded-xl border border-border bg-surface">
                  <div className="aspect-[4/3] overflow-hidden bg-muted/50">
                    {img ? <img src={optimizedImageUrl(img, 320)} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="truncate px-2 py-1.5 text-[11px] font-semibold group-hover:text-primary">{f.name}</div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
