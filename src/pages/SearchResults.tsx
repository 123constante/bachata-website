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
import { LevelBadge, LevelFilterChips, UnratedLine, parseLevelParam } from '@/components/search/LevelFilter';
import { flags } from '@/lib/featureFlags';
import { recordSearchResultClick } from '@/lib/searchClickTelemetry';
import { hrefFor, personAriaLabel, telemetryKindFor, type SearchKind } from '@/lib/searchEntities';
import { usePeopleBadges, type PersonBadge } from '@/modules/person-page/badges';
import { searchPersonView } from '@/modules/person-page/searchPerson';
import { genreFilterTokens } from '@/lib/genreSynonyms';
import { resolveEventImage } from '@/lib/utils';
import { eventResultSubtitle } from '@/lib/searchEventSubtitle';
import { optimizedImageUrl } from '@/lib/imageCdn';
import { cn } from '@/lib/utils';
import { NationalityFlag, TILE_FLAG_SIZE } from '@/components/people/NationalityFlag';

type PersonLike = { first_name: string | null; surname: string | null; display_name: string | null };
const personName = (p: PersonLike) =>
  p.display_name || [p.first_name, p.surname].filter(Boolean).join(' ') || 'Profile';
const firstVenuePhoto = (urls: string[] | null) => (urls && urls.length > 0 ? urls[0] : null);
const OLD_PERSON_FACETS = ['teachers', 'djs', 'dancers'];

// Reused TimeToggle chip styles (the live facet/filter chip language).
const chipBase = 'text-sm px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap';
const chipOn = 'bg-primary text-primary-foreground border-primary';
const chipOff = 'bg-transparent text-foreground border-primary/20 hover:border-primary/40';

// Phase 8 (format/category split): two orthogonal facet axes.
// Tokens MUST be the stored lowercase forms (the v5 filter is an exact match
// against event_series_p5.format / .category).
//   FORMAT = structural SHAPE (one-off is omitted — not a useful search facet).
//   GENRE  = discovery category. 'social' is gone (folds to Party — genreSynonyms).
const FORMAT_OPTIONS: { token: string; label: string }[] = [
  { token: 'recurring', label: 'Recurring' },
  { token: 'course', label: 'Course' },
  { token: 'festival', label: 'Festival' },
];
const GENRE_OPTIONS: { token: string; label: string }[] = [
  { token: 'party', label: 'Party' },
  { token: 'class', label: 'Class' },
  { token: 'workshop', label: 'Workshop' },
  { token: 'masterclass', label: 'Masterclass' },
];

const FACETS = [
  { key: 'all', label: 'All' },
  { key: 'events', label: 'Events' },
  { key: 'venues', label: 'Venues' },
  { key: 'organisers', label: 'Organisers' },
  { key: 'teachers', label: 'Teachers' },
  { key: 'djs', label: 'DJs' },
  { key: 'dancers', label: 'Dancers' },
  { key: 'people', label: 'People' },
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
  badge?: React.ReactNode;
  /** People only: nationality_code from the search read. */
  nationalityCode?: string | null;
  /** v7 people: the accessible name, "Name, Teacher, DJ". */
  ariaLabel?: string;
  /** Kind logged on click when it differs from `kind` (v7: primary_role). */
  telemetryKind?: SearchKind;
  /** v7 people: let a long name wrap in full instead of clamping to two lines. */
  wrapTitle?: boolean;
};

const ResultCard = ({ to, image, title, subtitle, fallbackIcon, kind, id, query, badge, nationalityCode, ariaLabel, telemetryKind, wrapTitle }: ResultCardProps) => (
  <Link to={to} aria-label={ariaLabel} onClick={() => recordSearchResultClick({ query, kind: telemetryKind ?? kind, id })} className="group block">
    <Card className="h-full overflow-hidden border-primary/15 transition-colors hover:border-primary/40">
      <div className="relative aspect-[4/3] bg-muted/50">
        {image ? (
          <img src={optimizedImageUrl(image, 320)} alt={title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">{fallbackIcon}</div>
        )}
        <NationalityFlag code={nationalityCode} size={TILE_FLAG_SIZE} placement="inset" />
      </div>
      <div className="p-3">
        <h3 className={cn(wrapTitle ? 'break-words' : 'line-clamp-2', 'text-sm font-bold text-foreground transition-colors group-hover:text-primary')}>
          {highlight(title, query)}
        </h3>
        {subtitle && <p className={cn('mt-1 text-xs text-muted-foreground', wrapTitle ? 'break-words' : 'line-clamp-1')}>{subtitle}</p>}
        {badge}
      </div>
    </Card>
  </Link>
);

type PersonRowData = {
  id: string; name: string; image: string | null; roles: string[] | undefined;
  primaryRole: string | undefined; nationalityCode: string | null | undefined;
};

// ONE full-width row per person. Tags, stage name and link come from the people-badges
// mapping: roles are always public (the Teacher tag shows plain while the teacher pages are
// closed) and the row links DJ page, else dancer page, else nowhere (owner decision: separate
// role pages, not /people/:id). The header overlay row (searchRpc mapPersonV7) is the same answer.
export const PersonRow = ({ p, query, badge }: { p: PersonRowData; query: string; badge: PersonBadge | undefined }) => {
  const opts = { teacherPagesOpen: flags.teacherDetail };
  const [imgFailed, setImgFailed] = useState(false);
  // The search read carries the roles; the stage name arrives with the badges read. The ONE
  // function the header overlay uses too (searchPerson.ts).
  const { tags, href: to } = searchPersonView(p.id, p.roles, badge, opts);
  const inner = (
    <>
      <span className="relative shrink-0">
        <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-primary/30 bg-muted/50 text-lg font-semibold text-primary">
          {p.image && !imgFailed ? <img src={optimizedImageUrl(p.image, 96)} alt="" width={48} height={48} className="h-full w-full object-cover" loading="lazy" onError={() => setImgFailed(true)} /> : <span aria-hidden="true">{(p.name.trim().charAt(0) || '?').toUpperCase()}</span>}
        </span>
        <NationalityFlag code={p.nationalityCode} size={48} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block break-words text-sm font-bold text-foreground">{highlight(p.name, query)}</span>
        {tags.length > 0 && (
          <span className="mt-1 flex flex-wrap gap-1">
            {tags.map((t) => <span key={t.role} data-person-tag={t.role} className="rounded-full border border-primary/40 px-2 py-0.5 text-[12px] font-semibold leading-tight text-foreground/90">{t.label}</span>)}
          </span>
        )}
      </span>
    </>
  );
  const cls = 'flex w-full items-center gap-3 rounded-lg border border-primary/15 bg-card p-3';
  return to ? (
    <Link to={to} data-person-id={p.id} aria-label={personAriaLabel(p.name, tags.map((t) => t.role))} onClick={() => recordSearchResultClick({ query, kind: telemetryKindFor(p.primaryRole, p.roles), id: p.id })} className={cn(cls, 'min-h-[56px] transition-colors hover:border-primary/40')}>{inner}</Link>
  ) : (
    <div data-person-row="plain" data-person-id={p.id} className={cls}>{inner}</div>
  );
};

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
  // v7 (review F6): teachers / DJs / dancers became ONE People facet, so an old shared or
  // back-navigated ?type=teachers|djs|dancers link opens People instead of an empty page.
  const rawFacet = params.get('type') ?? 'all';
  const facet = flags.searchV7 && OLD_PERSON_FACETS.includes(rawFacet) ? 'people' : rawFacet;
  const time = params.get('time') === 'all' ? 'all' : 'upcoming';
  const eformat = (params.get('eformat') ?? '').split(',').filter(Boolean);
  const ecat = (params.get('ecat') ?? '').split(',').filter(Boolean);
  const styles = (params.get('styles') ?? '').split(',').filter(Boolean);
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const cityOverride = params.get('city');
  // Dancer-rated level (search_public_v6). Ignored entirely while the flag is off.
  const levelsOn = flags.searchV6 || flags.searchV7;
  const levels = levelsOn ? parseLevelParam(params.get('level')) : [];

  const { data, isLoading, error } = useSearchResults(query, citySlug, {
    includePast: time === 'all',
    formats: eformat,
    // Fold legacy/synonym genre tokens (e.g. a bookmarked `ecat=social`) to the
    // canonical category, and widen Class to masterclass + workshop, before it
    // hits the RPC (genreFilterTokens dedupes).
    categories: genreFilterTokens(ecat),
    styles,
    dateFrom: from || null,
    dateTo: to || null,
    citySlugOverride: cityOverride,
    ...(levelsOn ? { levels } : {}),
  });
  const { badges: peopleBadges } = usePeopleBadges(useMemo(() => (data?.people ?? []).map((p) => p.id), [data]));

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
    update((p) => { ['time', 'eformat', 'ecat', 'styles', 'from', 'to', 'city'].forEach((k) => p.delete(k)); });

  const dym = data?.did_you_mean ?? null;
  const total = data?.total_count ?? 0;
  const counts: Record<string, number> = {
    events: data?.events.length ?? 0,
    venues: data?.venues.length ?? 0,
    organisers: data?.organisers.length ?? 0,
    teachers: data?.teachers.length ?? 0,
    djs: data?.djs.length ?? 0,
    dancers: data?.dancers.length ?? 0,
    people: data?.people?.length ?? 0,
    vendors: data?.vendors.length ?? 0,
    cities: data?.cities.length ?? 0,
  };
  const activeGroups =
    (eformat.length ? 1 : 0) + (ecat.length ? 1 : 0) + (styles.length ? 1 : 0) + (from || to ? 1 : 0) + (time === 'all' ? 1 : 0) + (cityOverride ? 1 : 0);
  const showSection = (key: string) => facet === 'all' || facet === key;
  const facetCount = (key: string) => (key === 'all' ? total : counts[key] ?? 0);
  // The chosen facet has no hits although others do (review F6): say so, and offer the rest.
  const facetEmpty = facet !== 'all' && total > 0 && facetCount(facet) === 0;

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
                  const active = facet === f.key;
                  // The chosen facet stays on screen (selected) even at 0, so the empty state below has a selected tab.
                  if (f.key !== 'all' && c === 0 && !active) return null;
                  return (
                    <button key={f.key} role="tab" aria-selected={active} onClick={() => setParam('type', f.key === 'all' ? null : f.key)} className={cn(chipBase, active ? chipOn : chipOff)}>
                      {f.label} <span className="opacity-70">{c}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {levelsOn && query && (facet === 'all' || facet === 'events') && (
            <div className="mt-3">
              <LevelFilterChips
                selected={levels}
                onChange={(next) => setParam('level', next.length ? next.join(',') : null)}
              />
              <UnratedLine levelSelected={levels.length > 0} count={data?.unrated_event_count} />
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

        {query && data && !isLoading && facetEmpty && (
          <div className="px-6 py-16 text-center" data-testid="search-facet-empty">
            <SearchIcon className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-4 text-base font-semibold text-foreground">
              No {FACETS.find((f) => f.key === facet)?.label.toLowerCase() ?? 'results of this type'} for &ldquo;{query}&rdquo;
            </p>
            <button type="button" onClick={() => setParam('type', null)} className="mt-3 inline-flex min-h-[44px] items-center px-3 text-sm font-semibold text-primary underline">
              Show all {total} {total === 1 ? 'result' : 'results'}
            </button>
          </div>
        )}

        {query && data && total > 0 && !facetEmpty && (
          <div className="space-y-8">
            {showSection('events') && data.events.length > 0 && (
              <section>
                <SectionHeader icon={<Calendar className="h-4 w-4 text-primary" />} title="Events" count={data.events.length} />
                <SectionGrid>
                  {data.events.map((e) => (
                    <ResultCard key={e.id} to={hrefFor('event', e.id)} image={resolveEventImage(e.poster_url, null)} title={e.name} subtitle={eventResultSubtitle(e) ?? undefined} fallbackIcon={<Calendar className="h-8 w-8" />} kind="event" id={e.id} query={query} badge={levelsOn ? <LevelBadge level={e.derived_level} /> : undefined} />
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
            {showSection('people') && (data.people?.length ?? 0) > 0 && (
              <section>
                <SectionHeader icon={<User className="h-4 w-4 text-primary" />} title="People" count={data.people?.length ?? 0} />
                <div className="flex flex-col gap-2">
                  {(data.people ?? []).map((p) => (
                    <PersonRow key={p.id} query={query} badge={peopleBadges.get(p.id)} p={{ id: p.id, name: personName(p), image: resolveEventImage(p.photo_url ?? p.avatar_url, null), roles: p.roles, primaryRole: p.primary_role, nationalityCode: p.nationality_code }} />
                  ))}
                </div>
              </section>
            )}
            {showSection('teachers') && data.teachers.length > 0 && (
              <section>
                <SectionHeader icon={<GraduationCap className="h-4 w-4 text-primary" />} title="Teachers" count={data.teachers.length} />
                <SectionGrid>
                  {data.teachers.map((t) => (
                    <ResultCard key={t.id} to={hrefFor('teacher', t.id)} image={resolveEventImage(t.photo_url ?? t.avatar_url, null)} title={personName(t)} fallbackIcon={<GraduationCap className="h-8 w-8" />} kind="teacher" id={t.id} query={query} nationalityCode={t.nationality_code} />
                  ))}
                </SectionGrid>
              </section>
            )}
            {showSection('djs') && data.djs.length > 0 && (
              <section>
                <SectionHeader icon={<Music className="h-4 w-4 text-primary" />} title="DJs" count={data.djs.length} />
                <SectionGrid>
                  {data.djs.map((d) => (
                    <ResultCard key={d.id} to={hrefFor('dj', d.id)} image={resolveEventImage(d.photo_url ?? d.avatar_url, null)} title={personName(d)} fallbackIcon={<Music className="h-8 w-8" />} kind="dj" id={d.id} query={query} nationalityCode={d.nationality_code} />
                  ))}
                </SectionGrid>
              </section>
            )}
            {showSection('dancers') && data.dancers.length > 0 && (
              <section>
                <SectionHeader icon={<User className="h-4 w-4 text-primary" />} title="Dancers" count={data.dancers.length} />
                <SectionGrid>
                  {data.dancers.map((d) => (
                    <ResultCard key={d.id} to={hrefFor('dancer', d.id)} image={resolveEventImage(d.avatar_url ?? d.photo_url, null)} title={personName(d)} fallbackIcon={<User className="h-8 w-8" />} kind="dancer" id={d.id} query={query} nationalityCode={d.nationality_code} />
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
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Format</div>
              <div className="flex flex-wrap gap-2">
                {FORMAT_OPTIONS.map((t) => (
                  <button key={t.token} type="button" onClick={() => toggleCsv('eformat', t.token)} className={cn(chipBase, eformat.includes(t.token) ? chipOn : chipOff)}>{t.label}</button>
                ))}
              </div>
            </div>
            <div className="border-b border-border/60 py-3">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Genre</div>
              <div className="flex flex-wrap gap-2">
                {GENRE_OPTIONS.map((t) => (
                  <button key={t.token} type="button" onClick={() => toggleCsv('ecat', t.token)} className={cn(chipBase, ecat.includes(t.token) ? chipOn : chipOff)}>{t.label}</button>
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
