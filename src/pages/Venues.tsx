import { useMemo, useState } from 'react';
import { Building2, MapPin, Users, Music, Layers, Lightbulb } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { StaggerContainer, StaggerItem } from '@/components/ScrollReveal';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { fetchPublicVenuesList, type PublicVenueListItem } from '@/services/venuePublicService';
import { VenueCard } from '@/components/venue/VenueCard';

const UNKNOWN_CITY = 'Other';
const PINNED_CITY = 'London';

type VenueGroup = { city: string; venues: PublicVenueListItem[] };
type FilterKey = 'tonight' | 'weekend' | 'wood';

const WEEKEND_DAYS = new Set(['Fri', 'Sat', 'Sun']);

const isToday = (iso: string | null): boolean => {
  if (!iso) return false;
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return false;
  const now = new Date();
  return dt.getFullYear() === now.getFullYear()
    && dt.getMonth() === now.getMonth()
    && dt.getDate() === now.getDate();
};

const matchesFilters = (v: PublicVenueListItem, active: Set<FilterKey>): boolean => {
  if (active.has('tonight') && !isToday(v.next_event_iso)) return false;
  if (active.has('weekend') && !v.day_pattern.some((d) => WEEKEND_DAYS.has(d))) return false;
  // Floor type lives on its own column now — wood_floor was migrated out of
  // facilities_new[] and into venues.floor_type during the data-quality pass.
  if (active.has('wood') && v.floor_type !== 'wood') return false;
  return true;
};

const groupVenuesByCity = (venues: PublicVenueListItem[]): VenueGroup[] => {
  const buckets = new Map<string, PublicVenueListItem[]>();
  for (const v of venues) {
    const city = v.city_name?.trim() || UNKNOWN_CITY;
    const list = buckets.get(city) ?? [];
    list.push(v);
    buckets.set(city, list);
  }
  for (const list of buckets.values()) {
    list.sort((a, b) => {
      const diff = (b.upcoming_event_count ?? 0) - (a.upcoming_event_count ?? 0);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    });
  }
  const cities = Array.from(buckets.keys()).sort((a, b) => {
    if (a === PINNED_CITY) return -1;
    if (b === PINNED_CITY) return 1;
    if (a === UNKNOWN_CITY) return 1;
    if (b === UNKNOWN_CITY) return -1;
    return a.localeCompare(b);
  });
  return cities.map((city) => ({ city, venues: buckets.get(city) ?? [] }));
};

type ChipDef = { key: FilterKey; label: string; emoji: string };
const CHIPS: ChipDef[] = [
  { key: 'tonight', label: 'Tonight', emoji: '🌙' },
  { key: 'weekend', label: 'This weekend', emoji: '🎉' },
  { key: 'wood', label: 'Wood floor', emoji: '🪵' },
];

const FilterChips = ({
  active,
  onToggle,
  visibleCount,
  totalCount,
}: {
  active: Set<FilterKey>;
  onToggle: (k: FilterKey) => void;
  visibleCount: number;
  totalCount: number;
}) => (
  <div className="flex flex-wrap items-center gap-2 mb-6">
    {CHIPS.map(({ key, label, emoji }) => {
      const isOn = active.has(key);
      return (
        <button
          key={key}
          type="button"
          onClick={() => onToggle(key)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            isOn
              ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20'
              : 'bg-black border-slate-800 text-muted-foreground hover:border-primary/40 hover:text-white'
          }`}
        >
          <span aria-hidden="true">{emoji}</span>
          {label}
        </button>
      );
    })}
    {active.size > 0 && (
      <>
        <button
          type="button"
          onClick={() => CHIPS.forEach((c) => active.has(c.key) && onToggle(c.key))}
          className="text-xs text-muted-foreground hover:text-white underline underline-offset-2"
        >
          Clear
        </button>
        <span className="text-xs text-muted-foreground ml-auto">
          {visibleCount} of {totalCount}
        </span>
      </>
    )}
  </div>
);

const Venues = () => {
  const { data: venues = [], isLoading } = useQuery({
    queryKey: ['venues-directory'],
    queryFn: fetchPublicVenuesList,
    staleTime: 5 * 60 * 1000,
  });

  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set());

  const toggleFilter = (k: FilterKey) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const filteredVenues = useMemo(
    () => venues.filter((v) => matchesFilters(v, activeFilters)),
    [venues, activeFilters]
  );

  const groups = useMemo(() => groupVenuesByCity(filteredVenues), [filteredVenues]);
  const totalCount = venues.length;
  const visibleCount = filteredVenues.length;

  return (
    <GlobalLayout
      breadcrumbs={[{ label: 'Venues' }]}
      hero={{
        emoji: '🏛️',
        titleWhite: 'Dance',
        titleOrange: 'Venues',
        subtitle: 'Find the perfect space for bachata — studios, clubs, and event halls.',
        floatingIcons: [Building2, MapPin, Users, Music, Layers, Lightbulb],
      }}
    >
      <div className="max-w-6xl mx-auto px-4">
        {!isLoading && totalCount > 0 && (
          <FilterChips
            active={activeFilters}
            onToggle={toggleFilter}
            visibleCount={visibleCount}
            totalCount={totalCount}
          />
        )}

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} style={{ backgroundColor: '#f7f3ea', borderColor: '#e0d6bc' }} className="rounded-2xl border overflow-hidden">
                <Skeleton className="aspect-[4/3] w-full" />
                <div className="p-3 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : totalCount === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">No venues yet.</p>
          </div>
        ) : visibleCount === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">
              No venues match your filters.
            </p>
            <button
              type="button"
              onClick={() => setActiveFilters(new Set())}
              className="text-xs text-primary hover:underline mt-2"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map(({ city, venues: cityVenues }) => (
              <section key={city}>
                <header className="flex items-baseline justify-between mb-3 border-b border-slate-800 pb-2">
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    {city}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {cityVenues.length} {cityVenues.length === 1 ? 'venue' : 'venues'}
                  </span>
                </header>

                <StaggerContainer className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {cityVenues.map((venue) => (
                    <StaggerItem key={venue.id}>
                      <VenueCard venue={venue} />
                    </StaggerItem>
                  ))}
                </StaggerContainer>
              </section>
            ))}
          </div>
        )}
      </div>
    </GlobalLayout>
  );
};

export default Venues;
