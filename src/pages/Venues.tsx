import { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

// Dark warm bar surface, sits cleanly over the black page.
const BAR_STYLE = { backgroundColor: 'rgba(8,6,4,0.92)', borderColor: '#241c14' } as const;

// Inner bar content — the 3 filter chips plus the result count and Clear.
// Shared by the in-flow copy and the portalled pinned copy below.
const FilterBarInner = ({
  active,
  onToggle,
  onClear,
  count,
}: {
  active: Set<FilterKey>;
  onToggle: (k: FilterKey) => void;
  onClear: () => void;
  count: number;
}) => (
  <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-2.5">
    <div className="flex gap-2 overflow-x-auto flex-1 min-w-0">
      {CHIPS.map(({ key, label, emoji }) => {
        const isOn = active.has(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => onToggle(key)}
            style={isOn ? undefined : { backgroundColor: '#1a1410', borderColor: '#3a2e1c', color: '#a89875' }}
            className={`shrink-0 inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              isOn
                ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20'
                : 'hover:!border-primary/60 hover:!text-stone-100'
            }`}
          >
            <span aria-hidden="true">{emoji}</span>
            <span>{label}</span>
          </button>
        );
      })}
    </div>
    <div className="flex items-center gap-3 shrink-0">
      <span className="text-xs" style={{ color: '#8a7a5c' }}>
        <span className="font-bold text-stone-300">{count}</span> {count === 1 ? 'venue' : 'venues'}
      </span>
      {active.size > 0 && (
        <button
          type="button"
          onClick={onClear}
          style={{ color: '#d97706' }}
          className="text-xs hover:underline"
        >
          Clear
        </button>
      )}
    </div>
  </div>
);

// Sticky horizontal filter bar (replaces the old left sidebar). The app's
// page wrapper sets overflow-x:hidden (=> overflow-y:auto) and filter:blur(0),
// which between them break position:sticky AND position:fixed for in-page
// content. So we render the bar in normal flow and, once it scrolls under the
// 60px global header, mount a portalled fixed copy on document.body (outside
// those wrappers) so it actually pins to the viewport. A callback ref wires the
// IntersectionObserver the moment the sentinel mounts (i.e. after data loads),
// not at first render when the bar is still null. Hidden while loading or when
// there are no venues at all.
const FilterBar = ({
  active,
  onToggle,
  onClear,
  count,
  total,
  isLoading,
}: {
  active: Set<FilterKey>;
  onToggle: (k: FilterKey) => void;
  onClear: () => void;
  count: number;
  total: number;
  isLoading: boolean;
}) => {
  const [pinned, setPinned] = useState(false);
  const ioRef = useRef<IntersectionObserver | null>(null);

  const setSentinel = useCallback((node: HTMLDivElement | null) => {
    if (ioRef.current) {
      ioRef.current.disconnect();
      ioRef.current = null;
    }
    if (node) {
      const io = new IntersectionObserver(
        ([entry]) => setPinned(!entry.isIntersecting),
        { rootMargin: '-61px 0px 0px 0px', threshold: 0 },
      );
      io.observe(node);
      ioRef.current = io;
    }
  }, []);

  if (isLoading || total === 0) return null;

  return (
    <>
      <div ref={setSentinel} aria-hidden className="h-px -mb-px" />
      <div style={BAR_STYLE} className="border-b backdrop-blur-md">
        <FilterBarInner active={active} onToggle={onToggle} onClear={onClear} count={count} />
      </div>
      {pinned &&
        createPortal(
          <div
            style={BAR_STYLE}
            className="fixed top-[60px] left-0 right-0 z-30 border-b backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <FilterBarInner active={active} onToggle={onToggle} onClear={onClear} count={count} />
          </div>,
          document.body,
        )}
    </>
  );
};

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
      <FilterBar
        active={activeFilters}
        onToggle={toggleFilter}
        onClear={() => setActiveFilters(new Set())}
        count={filteredVenues.length}
        total={venues.length}
        isLoading={isLoading}
      />

      <main>
        {isLoading ? (
          <div className="max-w-6xl mx-auto px-4 pt-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} style={{ backgroundColor: '#f4e9d2', borderColor: '#c9a86a' }} className="rounded-2xl border overflow-hidden">
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
    </GlobalLayout>
  );
};

export default Venues;
