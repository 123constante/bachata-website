import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Calendar, Building2, GraduationCap, Music, User, MapPin, ShoppingBag, Globe,
  SlidersHorizontal, Search as SearchIcon,
} from 'lucide-react';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { useSeo, buildSeoForRoute } from '@/lib/seo';
import { useCity } from '@/contexts/CityContext';
import { useSearchResults } from '@/hooks/useSearchResults';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Drawer, DrawerContent, DrawerClose, DrawerTitle } from '@/components/ui/drawer';
import { FAVORITE_STYLE_OPTIONS } from '@/components/profile/dancerConstants';
import { highlight } from '@/components/search/highlight';
import { recordSearchResultClick } from '@/lib/searchClickTelemetry';
import { hrefFor, type SearchKind } from '@/lib/searchEntities';
import { resolveEventImage } from '@/lib/utils';
import { cn } from '@/lib/utils';

type PersonLike = { first_name: string | null; surname: string | null; display_name: string | null };
const personName = (p: PersonLike) =>
  p.display_name || [p.first_name, p.surname].filter(Boolean).join(' ') || 'Profile';
const firstVenuePhoto = (urls: string[] | null) => (urls && urls.length > 0 ? urls[0] : null);

// Reused TimeToggle chip styles (the live facet/filter chip language).
const chipBase = 'text-sm px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap';
const chipOn = 'bg-primary text-primary-foreground border-primary';
const chipOff = 'bg-transparent text-foreground border-primary/20 hover:border-primary/40';

// Event-type tokens MUST be the stored lowercase forms (the v5 filter is a
// case-sensitive exact match against event_series_p5.type).
const TYPE_OPTIONS: { token: string; label: string }[] = [
  { token: 'party', label: 'Party' },
  { token: 'class', label: 'Class' },
  { token: 'workshop', label: 'Workshop' },
  { token: 'course', label: 'Course' },
  { token: 'festival', label: 'Festival' },
  { token: 'social', label: 'Social' },
];

const FACETS = [
  { key: 'all', label: 'All' },
  { key: 'events', label: 'Events' },
  { key: 'venues', label: 'Venues' },
  { key: 'organisers', label: 'Organisers' },
  { key: 'teachers', label: 'Teachers' },
  { key: 'djs', label: 'DJs' },
  { key: 'dancers', label: 'Dancers' },
  { key: 'vendors', label: 'Vendors' },
  { key: 'cities', label: 'Cities' },
] as const;

type ResultCardProps = {
  to: string;
  image: string | null;
  title: string;
  subtitle?: string;
  fallbackIcon: React.ReactNode;
  kind: SearchKind;
  id: string;
  query: string;
};

const ResultCard = ({ to, image, title, subtitle, fallbackIcon, kind, id, query }: ResultCardProps) => (
  <Link to={to} onClick={() => recordSearchResultClick({ query, kind, id })} className="group block">
    <Card className="h-full overflow-hidden border-primary/15 transition-colors hover:border-primary/40">
      <div className="relative aspect-[4/3] bg-muted/50">
        {image ? (
          <img src={image} alt={title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">{fallbackIcon}</div>
        )}
      </div>
      <div className="p-3">
        <h3 className="line-clamp-2 text-sm font-bold text-foreground transition-colors group-hover:text-primary">
          {highlight(title, query)}
        </h3>
        {subtitle && <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </Card>
  </Link>
);

const SectionHeader = ({ icon, title, count }: { icon: React.ReactNode; title: string; count: number }) => (
  <div className="mb-3 flex items-center gap-2">
    {icon}
    <h2 className="text-base font-bold text-foreground">{title}</h2>
    <span className="text-xs text-muted-foreground">({count})</span>
  </div>
);

const SectionGrid = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">{children}</div>
);

const SearchResults = () => {
  useSeo(buildSeoForRoute('search'));
  const [params, setParams] = useSearchParams();
  const { citySlug } = useCity();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const query = (params.get('q') ?? '').trim();
  const facet = params.get('type') ?? 'all';
  const time = params.get('time') === 'all' ? 'all' : 'upcoming';
  const etype = (params.get('etype') ?? '').split(',').filter(Boolean);
  const styles = (params.get('styles') ?? '').split(',').filter(Boolean);
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const cityOverride = params.get('city');

  const { data, isLoading, error } = useSearchResults(query, citySlug, {
    includePast: time === 'all',
    eventTypes: etype,
    styles,
    dateFrom: from || null,
    dateTo: to || null,
    citySlugOverride: cityOverride,
  });

  const update = (mut: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(params);
    mut(p);
    setParams(p, { replace: false });
  };
  const setParam = (key: string, val: string | null) =>
    update((p) => { if (val) p.set(key, val); else p.delete(key); });
  const toggleCsv = (key: string, token: string) =>
    update((p) => {
      const cur = (p.get(key) ?? '').split(',').filter(Boolean);
      const next = cur.includes(token) ? cur.filter((t) => t !== token) : [...cur, token];
      if (next.length) p.set(key, next.join(',')); else p.delete(key);
    });
  const clearAllFilters = () =>
    update((p) => { ['time', 'etype', 'styles', 'from', 'to', 'city'].forEach((k) => p.delete(k)); });

  const dym = data?.did_you_mean ?? null;
  const total = data?.total_count ?? 0;
  const counts: Record<string, number> = {
    events: data?.events.length ?? 0,
    venues: data?.venues.length ?? 0,
    organisers: data?.organisers.length ?? 0,
    teachers: data?.teachers.length ?? 0,
    djs: data?.djs.length ?? 0,
    dancers: data?.dancers.length ?? 0,
    vendors: data?.vendors.length ?? 0,
    cities: data?.cities.length ?? 0,
  };
  const activeGroups =
    (etype.length ? 1 : 0) + (styles.length ? 1 : 0) + (from || to ? 1 : 0) + (time === 'all' ? 1 : 0) + (cityOverride ? 1 : 0);
  const showSection = (key: string) => facet === 'all' || facet === key;
  const facetCount = (key: string) => (key === 'all' ? total : counts[key] ?? 0);

  return (
    <GlobalLayout showSubheader={false}>
      <section className="mx-auto max-w-5xl px-4 py-6">
        <header className="mb-5">
          <h1 className="text-2xl font-black text-foreground md:text-3xl">
            {query ? (<>Results for <span className="text-primary">&ldquo;{query}&rdquo;</span></>) : 'Search'}
          </h1>

          {query && (
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                className="relative inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/40 px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-primary/5"
              >
                <SlidersHorizontal className="h-4 w-4" /> Filters
                {activeGroups > 0 && (
                  <span className="ml-0.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-primary px-1 text-[10px] font-extrabold text-primary-foreground">{activeGroups}</span>
                )}
              </button>
              <span className="h-5 w-px shrink-0 bg-border" />
              <div role="tablist" aria-label="Result type" className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
                {FACETS.map((f) => {
                  const c = facetCount(f.key);
                  if (f.key !== 'all' && c === 0) return null;
                  const active = facet === f.key;
                  return (
                    <button key={f.key} role="tab" aria-selected={active} onClick={() => setParam('type', f.key === 'all' ? null : f.key)} className={cn(chipBase, active ? chipOn : chipOff)}>
                      {f.label} <span className="opacity-70">{c}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {query && total > 0 && dym && (
            <p className="mt-3 text-sm text-muted-foreground">
              Did you mean{' '}
              <button type="button" onClick={() => setParam('q', dym)} className="font-semibold text-primary underline">{dym}</button>?
            </p>
          )}
        </header>

        {!query && (
          <div className="rounded-xl border border-primary/15 bg-card/40 p-6 text-center">
            <p className="text-sm text-muted-foreground">Type a word to search the site.</p>
          </div>
        )}

        {query && isLoading && (
          <div className="space-y-6">
            {[0, 1].map((i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-5 w-32" />
                <SectionGrid>{[0, 1, 2, 3].map((j) => <Skeleton key={j} className="h-40 w-full rounded-xl" />)}</SectionGrid>
              </div>
            ))}
          </div>
        )}

        {query && error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
            <p className="text-sm text-destructive">Couldn&rsquo;t load results. Try again in a moment.</p>
          </div>
        )}

        {query && data && !isLoading && total === 0 && (
          <div className="px-6 py-16 text-center">
            <SearchIcon className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-4 text-base font-semibold text-foreground">No results for &ldquo;{query}&rdquo;</p>
            {dym ? (
              <p className="mt-3 text-base text-muted-foreground">
                Did you mean{' '}
                <button type="button" onClick={() => setParam('q', dym)} className="font-semibold text-primary underline">{dym}</button>?
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Try a different word{time === 'upcoming' ? ', or open Filters and switch to All time' : ''}.</p>
            )}
          </div>
        )}

        {query && data && total > 0 && (
          <div className="space-y-8">
            {showSection('events') && data.events.length > 0 && (
              <section>
                <SectionHeader icon={<Calendar className="h-4 w-4 text-primary" />} title="Events" count={data.events.length} />
                <SectionGrid>
                  {data.events.map((e) => (
                    <ResultCard key={e.id} to={hrefFor('event', e.id)} image={resolveEventImage(e.poster_url, null)} title={e.name} subtitle={e.city_slug ?? undefined} fallbackIcon={<Calendar className="h-8 w-8" />} kind="event" id={e.id} query={query} />
                  ))}
                </SectionGrid>
              </section>
            )}
            {showSection('venues') && data.venues.length > 0 && (
              <section>
                <SectionHeader icon={<MapPin className="h-4 w-4 text-primary" />} title="Venues" count={data.venues.length} />
                <SectionGrid>
                  {data.venues.map((v) => (
                    <ResultCard key={v.id} to={hrefFor('venue', v.id)} image={firstVenuePhoto(v.photo_url)} title={v.name ?? 'Venue'} subtitle={v.address ?? undefined} fallbackIcon={<MapPin className="h-8 w-8" />} kind="venue" id={v.id} query={query} />
                  ))}
                </SectionGrid>
              </section>
            )}
            {showSection('organisers') && data.organisers.length > 0 && (
              <section>
                <SectionHeader icon={<Building2 className="h-4 w-4 text-primary" />} title="Organisers" count={data.organisers.length} />
                <SectionGrid>
                  {data.organisers.map((o) => (
                    <ResultCard key={o.id} to={hrefFor('organiser', o.id)} image={resolveEventImage(o.avatar_url, null)} title={o.name ?? 'Organiser'} fallbackIcon={<Building2 className="h-8 w-8" />} kind="organiser" id={o.id} query={query} />
                  ))}
                </SectionGrid>
              </section>
            )}
            {showSection('teachers') && data.teachers.length > 0 && (
              <section>
                <SectionHeader icon={<GraduationCap className="h-4 w-4 text-primary" />} title="Teachers" count={data.teachers.length} />
                <SectionGrid>
                  {data.teachers.map((t) => (
                    <ResultCard key={t.id} to={hrefFor('teacher', t.id)} image={resolveEventImage(t.photo_url ?? t.avatar_url, null)} title={personName(t)} fallbackIcon={<GraduationCap className="h-8 w-8" />} kind="teacher" id={t.id} query={query} />
                  ))}
                </SectionGrid>
              </section>
            )}
            {showSection('djs') && data.djs.length > 0 && (
              <section>
                <SectionHeader icon={<Music className="h-4 w-4 text-primary" />} title="DJs" count={data.djs.length} />
                <SectionGrid>
                  {data.djs.map((d) => (
                    <ResultCard key={d.id} to={hrefFor('dj', d.id)} image={resolveEventImage(d.photo_url ?? d.avatar_url, null)} title={personName(d)} fallbackIcon={<Music className="h-8 w-8" />} kind="dj" id={d.id} query={query} />
                  ))}
                </SectionGrid>
              </section>
            )}
            {showSection('dancers') && data.dancers.length > 0 && (
              <section>
                <SectionHeader icon={<User className="h-4 w-4 text-primary" />} title="Dancers" count={data.dancers.length} />
                <SectionGrid>
                  {data.dancers.map((d) => (
                    <ResultCard key={d.id} to={hrefFor('dancer', d.id)} image={resolveEventImage(d.avatar_url ?? d.photo_url, null)} title={personName(d)} fallbackIcon={<User className="h-8 w-8" />} kind="dancer" id={d.id} query={query} />
                  ))}
                </SectionGrid>
              </section>
            )}
            {showSection('vendors') && data.vendors.length > 0 && (
              <section>
                <SectionHeader icon={<ShoppingBag className="h-4 w-4 text-primary" />} title="Vendors" count={data.vendors.length} />
                <SectionGrid>
                  {data.vendors.map((v) => (
                    <ResultCard key={v.id} to={hrefFor('vendor', v.id)} image={resolveEventImage(v.photo_url, null)} title={v.name ?? 'Vendor'} subtitle={v.short_description ?? undefined} fallbackIcon={<ShoppingBag className="h-8 w-8" />} kind="vendor" id={v.id} query={query} />
                  ))}
                </SectionGrid>
              </section>
            )}
            {showSection('cities') && data.cities.length > 0 && (
              <section>
                <SectionHeader icon={<Globe className="h-4 w-4 text-primary" />} title="Cities" count={data.cities.length} />
                <SectionGrid>
                  {data.cities.map((c) => (
                    <ResultCard key={c.id} to={hrefFor('city', c.id, c.slug)} image={resolveEventImage(c.image_url, null)} title={c.name ?? 'City'} subtitle={c.country_name ?? undefined} fallbackIcon={<Globe className="h-8 w-8" />} kind="city" id={c.id} query={query} />
                  ))}
                </SectionGrid>
              </section>
            )}
          </div>
        )}
      </section>

      <Drawer open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DrawerContent className="max-h-[86vh]">
          <div className="px-4 pb-2 pt-1">
            <DrawerTitle className="text-base font-bold text-foreground">Filters</DrawerTitle>
          </div>
          <div className="overflow-y-auto px-4 pb-2">
            <div className="border-b border-border/60 py-3">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Type</div>
              <div className="flex flex-wrap gap-2">
                {TYPE_OPTIONS.map((t) => (
                  <button key={t.token} type="button" onClick={() => toggleCsv('etype', t.token)} className={cn(chipBase, etype.includes(t.token) ? chipOn : chipOff)}>{t.label}</button>
                ))}
              </div>
            </div>
            <div className="border-b border-border/60 py-3">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Style</div>
              <div className="flex flex-wrap gap-2">
                {FAVORITE_STYLE_OPTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => toggleCsv('styles', s)} className={cn(chipBase, styles.includes(s) ? chipOn : chipOff)}>{s}</button>
                ))}
              </div>
            </div>
            <div className="border-b border-border/60 py-3">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">When</div>
              <div className="mb-3 flex gap-2">
                <button type="button" onClick={() => setParam('time', null)} className={cn(chipBase, 'flex-1 text-center', time === 'upcoming' ? chipOn : chipOff)}>Upcoming</button>
                <button type="button" onClick={() => setParam('time', 'all')} className={cn(chipBase, 'flex-1 text-center', time === 'all' ? chipOn : chipOff)}>All time</button>
              </div>
              <div className="flex gap-2">
                <label className="flex-1 text-xs text-muted-foreground">From
                  <input type="date" value={from} onChange={(e) => setParam('from', e.target.value || null)} className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground" />
                </label>
                <label className="flex-1 text-xs text-muted-foreground">To
                  <input type="date" value={to} onChange={(e) => setParam('to', e.target.value || null)} className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground" />
                </label>
              </div>
            </div>
            <div className="py-3">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">City</div>
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm">
                <span className="flex items-center gap-2 text-foreground"><MapPin className="h-4 w-4 text-primary" /> {cityOverride ?? citySlug ?? 'All cities'}</span>
                {cityOverride ? (
                  <button type="button" onClick={() => setParam('city', null)} className="text-xs font-medium text-primary">Reset</button>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex gap-3 border-t border-border p-4">
            <button type="button" onClick={clearAllFilters} className="flex-[0_0_38%] rounded-lg border border-border py-3 text-sm font-bold text-foreground">Clear all</button>
            <DrawerClose asChild>
              <button type="button" className="flex-1 rounded-lg bg-primary py-3 text-sm font-bold text-primary-foreground">Show {total} results</button>
            </DrawerClose>
          </div>
        </DrawerContent>
      </Drawer>
    </GlobalLayout>
  );
};

export default SearchResults;
