import { useMemo, useState } from 'react';
import { Building2, MapPin, Users, Music, Layers, Lightbulb } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { StaggerContainer, StaggerItem } from '@/components/ScrollReveal';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
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

const getThisWeekendRange = (): { start: Date; end: Date } => {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat

  // Calculate days until Friday
  let daysUntilFriday: number;
  if (dayOfWeek <= 5) {
    // Mon-Fri: this coming weekend is Fri-Sun
    daysUntilFriday = 5 - dayOfWeek;
  } else {
    // Sat-Sun: next weekend is next Fri-Sun
    daysUntilFriday = 5 + (7 - dayOfWeek);
  }

  const friday = new Date(now);
  friday.setDate(friday.getDate() + daysUntilFriday);
  friday.setHours(0, 0, 0, 0);

  const sunday = new Date(friday);
  sunday.setDate(sunday.getDate() + 2); // Friday + 2 = Sunday
  sunday.setHours(23, 59, 59, 999);

  return { start: friday, end: sunday };
};

const matchesFilters = (v: PublicVenueListItem, active: Set<FilterKey>): boolean => {
  if (active.has('tonight') && !isToday(v.next_event_iso)) return false;
  if (active.has('weekend')) {
    const range = getThisWeekendRange();
    const eventDate = v.next_event_iso ? new Date(v.next_event_iso) : null;
    if (!eventDate || isNaN(eventDate.getTime()) || eventDate < range.start || eventDate > range.end) {
      return false;
    }
  }
  if (active.has('wood') && v.floor_type !== 'wood') return false;
  return true;
};

const sortVenues = (venues: PublicVenueListItem[]): PublicVenueListItem[] => {
  return [...venues].sort((a, b) => {
    const diff = (b.upcoming_event_count ?? 0) - (a.upcoming_event_count ?? 0);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name);
  });
};

type ChipDef = { key: FilterKey; label: string; emoji: string };
const CHIPS: ChipDef[] = [
  { key: 'tonight', label: 'Tonight', emoji: '🌙' },
  { key: 'weekend', label: 'This weekend', emoji: '🎉' },
  { key: 'wood', label: 'Wood floor', emoji: '🪵' },
];

const FilterSidebar = ({
  active,
  onToggle,
}: {
  active: Set<FilterKey>;
  onToggle: (k: FilterKey) => void;
}) => (
  <aside
    style={{ borderColor: '#3a2e1c', backgroundColor: '#1a1410' }}
    className="sticky top-0 w-52 border-r py-6 px-4 flex flex-col gap-3 h-screen"
  >
    <div style={{ color: '#a89875' }} className="text-xs font-semibold uppercase tracking-wide mb-3">
      Filters
    </div>
    {CHIPS.map(({ key, label, emoji }) => {
      const isOn = active.has(key);
      return (
        <button
          key={key}
          type="button"
          onClick={() => onToggle(key)}
          style={isOn ? undefined : { backgroundColor: '#1a1410', borderColor: '#3a2e1c', color: '#a89875' }}
          className={`w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors text-left ${
            isOn
              ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20'
              : 'hover:!border-primary/60 hover:!text-stone-100'
          }`}
        >
          <span aria-hidden="true">{emoji}</span>
          <span className="flex-1">{label}</span>
        </button>
      );
    })}
    {active.size > 0 && (
      <button
        type="button"
        onClick={() => CHIPS.forEach((c) => active.has(c.key) && onToggle(c.key))}
        style={{ color: '#d97706' }}
        className="text-xs hover:underline mt-2 pt-2 border-t border-slate-800"
      >
        Clear filters
      </button>
    )}
  </aside>
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
    () => sortVenues(venues.filter((v) => matchesFilters(v, activeFilters))),
    [venues, activeFilters]
  );

  return (
    <GlobalLayout
      breadcrumbs={buildBreadcrumbs('venues')}
      hero={{
        emoji: '🏛️',
        titleWhite: 'Dance',
        titleOrange: 'Venues',
        floatingIcons: [Building2, MapPin, Users, Music, Layers, Lightbulb],
      }}
    >
      <div className="flex">
        <FilterSidebar active={activeFilters} onToggle={toggleFilter} />

        <main className="flex-1">
          {isLoading ? (
            <div className="max-w-6xl mx-auto px-4 pt-6">
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
            </div>
          ) : venues.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">No venues yet.</p>
            </div>
          ) : filteredVenues.length === 0 ? (
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
            <div className="max-w-6xl mx-auto px-4 pt-6">
              <StaggerContainer className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredVenues.map((venue) => (
                  <StaggerItem key={venue.id}>
                    <VenueCard
                      venue={venue}
                      isWeekendFilterActive={activeFilters.has('weekend')}
                      isWoodFloorFilterActive={activeFilters.has('wood')}
                    />
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </div>
          )}
        </main>
      </div>
    </GlobalLayout>
  );
};

export default Venues;
