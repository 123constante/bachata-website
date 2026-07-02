import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, ChevronDown, Layers, Lightbulb, MapPin, Music, Users } from 'lucide-react';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { useSeo, buildSeoForRoute } from '@/lib/seo';
import { cn } from '@/lib/utils';
import { fetchPublicVenuesList, type PublicVenueListItem } from '@/services/venuePublicService';
import { parseUtcIso, londonDaysFromToday } from '@/lib/londonDate';
import { useLondonToday } from '@/hooks/useLondonToday';

// ---------------------------------------------------------------------------
// "Tonight First" venues directory (approved mockup 4, 2026-06-12).
// Page shape: hero -> "Dancing tonight" photo rail -> sticky area/day filter
// bar -> collapsible area panels (single-open accordion). Brass/gold palette
// from the raffle surface; area headers wear the gold jackpot frame.
// ---------------------------------------------------------------------------

const LONDON_TZ = 'Europe/London';

// Brass/gold palette lifted verbatim from Raffles.css (rp-* tokens).
const ACCENT = '#f5d563';                    // rp-gold
const ACCENT_WARM = '#f7e08a';               // rp-gold-lt
const ACCENT_DK = '#b38a4e';                 // rp-gold-dk
const ACCENT_DEEP = '#8a6d3c';               // rp-gold-deep (borders on hot surfaces)
const ACCENT_SOFT = 'rgba(245,213,99,0.12)'; // subtle gold tint
const CREAM = '#e9dfc6';                     // rp-cream
const CARD_BG = '#141417';                   // rp-ink-2
const LINE = 'rgba(245,213,99,0.16)';        // rp-line
const MUTED = '#9a917c';                     // rp-muted
const QUIET = '#9a917c';                     // same

type AreaKey = 'Central' | 'North' | 'East' | 'West' | 'South';
const AREA_ORDER: AreaKey[] = ['Central', 'North', 'East', 'West', 'South'];
const AREA_LABEL: Record<AreaKey, string> = {
  Central: 'Central London',
  North: 'North London',
  East: 'East London',
  West: 'West London',
  South: 'South London',
};
const AREA_DOT: Record<AreaKey, string> = {
  Central: '#a855f7',
  North: '#f97316',
  East: '#ec4899',
  West: '#d4a017',
  South: '#ef4444',
};
const areaLabel = (k: string) => (k === 'Elsewhere' ? 'Elsewhere' : AREA_LABEL[k as AreaKey]);
const areaDot = (k: string) => AREA_DOT[k as AreaKey] ?? MUTED;

// Postcode district -> compass area. WC/EC plus the W1/SW1 districts read as
// Central; the SW3/5/6/7/10 Chelsea-Fulham belt reads as West to a Londoner,
// the rest of SW as South.
const WEST_SW = new Set([3, 5, 6, 7, 10]);
const deriveArea = (postcode: string | null): AreaKey | null => {
  if (!postcode) return null;
  const m = postcode.trim().toUpperCase().match(/^([A-Z]{1,2})(\d{1,2})/);
  if (!m) return null;
  const letters = m[1];
  const num = parseInt(m[2], 10);
  if (letters === 'WC' || letters === 'EC') return 'Central';
  if (letters === 'W') return num === 1 ? 'Central' : 'West';
  if (letters === 'SW') return num === 1 ? 'Central' : WEST_SW.has(num) ? 'West' : 'South';
  if (letters === 'N' || letters === 'NW') return 'North';
  if (letters === 'SE') return 'South';
  if (letters === 'E') return 'East';
  return null;
};

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const weekdayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: LONDON_TZ, weekday: 'long' });
const shortDateFmt = new Intl.DateTimeFormat('en-GB', { timeZone: LONDON_TZ, day: 'numeric', month: 'short' });

interface VenueVm {
  v: PublicVenueListItem;
  area: AreaKey | null;
  outward: string | null;
  /** "Tonight" | "Tomorrow" | weekday | "26 Apr"; null when nothing upcoming */
  nextLabel: string | null;
  isTonight: boolean;
  /** London weekday of the next event; drives the day chips together with day_pattern */
  nextWeekday: string | null;
  /** Wall-clock start "18:00" sliced from the stored string (times are stored local-as-UTC, displayed as stored) */
  startTime: string | null;
  sortKey: number;
}

const buildVm = (v: PublicVenueListItem): VenueVm => {
  const dt = parseUtcIso(v.next_event_iso);
  let nextLabel: string | null = null;
  let isTonight = false;
  let nextWeekday: string | null = null;
  if (dt) {
    const diff = londonDaysFromToday(dt);
    nextWeekday = weekdayFmt.format(dt);
    if (diff <= 0) {
      nextLabel = 'Tonight';
      isTonight = true;
    } else if (diff === 1) {
      nextLabel = 'Tomorrow';
    } else if (diff < 7) {
      nextLabel = nextWeekday;
    } else {
      nextLabel = shortDateFmt.format(dt);
    }
  }
  return {
    v,
    area: deriveArea(v.postcode),
    outward: v.postcode ? v.postcode.trim().split(/\s+/)[0].toUpperCase() : null,
    nextLabel,
    isTonight,
    nextWeekday,
    startTime: v.next_event_iso?.match(/(\d{2}:\d{2})/)?.[1] ?? null,
    sortKey: dt ? dt.getTime() : Number.POSITIVE_INFINITY,
  };
};

// Soonest event first; dormant venues (Infinity) last, then by activity.
const byNextThenActivity = (a: VenueVm, b: VenueVm): number => {
  if (a.sortKey !== b.sortKey) return a.sortKey < b.sortKey ? -1 : 1;
  const diff = (b.v.upcoming_event_count ?? 0) - (a.v.upcoming_event_count ?? 0);
  if (diff !== 0) return diff;
  return a.v.name.localeCompare(b.v.name);
};

const Chip = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    style={
      on
        ? { background: `linear-gradient(180deg, ${ACCENT_WARM}, ${ACCENT_DK})`, borderColor: ACCENT_DK, color: '#1a1206' }
        : { backgroundColor: '#ffffff08', borderColor: LINE, color: '#cbbf9f' }
    }
    className={cn(
      'shrink-0 whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors',
      on ? 'shadow-md shadow-amber-500/25' : 'hover:!border-amber-400/50 hover:!text-white',
    )}
  >
    {children}
  </button>
);

// Warm near-black bar surface matching the raffle page cabinet tone.
const BAR_STYLE = { backgroundColor: 'rgba(13,10,6,0.55)', borderColor: LINE } as const;

interface FilterBarProps {
  area: 'All' | AreaKey;
  day: string | null;
  days: string[];
  count: number;
  onArea: (a: 'All' | AreaKey) => void;
  onDay: (d: string) => void;
  onClear: () => void;
}

const FilterBarInner = ({ area, day, days, count, onArea, onDay, onClear }: FilterBarProps) => (
  <div className="mx-auto max-w-6xl px-4 py-2">
    <div className="text-[9px] font-extrabold uppercase tracking-[0.14em]" style={{ color: MUTED }}>
      Area
    </div>
    <div className="mt-1 flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
      {(['All', ...AREA_ORDER] as const).map((a) => (
        <Chip key={a} on={area === a} onClick={() => onArea(a)}>
          {a}
        </Chip>
      ))}
    </div>
    <div className="mt-1.5 text-[9px] font-extrabold uppercase tracking-[0.14em]" style={{ color: MUTED }}>
      Day
    </div>
    <div className="mt-1 flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
      {days.map((d, i) => (
        <Chip key={d} on={day === d} onClick={() => onDay(d)}>
          {i === 0 ? <>{d} &middot; today</> : d}
        </Chip>
      ))}
    </div>
    <div className="mt-1.5 flex items-center justify-between text-[11px]" style={{ color: MUTED }}>
      <span>
        <span className="font-bold" style={{ color: CREAM }}>{count}</span>{' '}
        {count === 1 ? 'venue' : 'venues'}
      </span>
      {(area !== 'All' || day !== null) && (
        <button type="button" onClick={onClear} className="text-xs font-bold hover:underline" style={{ color: ACCENT }}>
          Clear
        </button>
      )}
    </div>
  </div>
);

// The app's page wrapper sets overflow-x:hidden and filter:blur(0), which
// between them break position:sticky AND position:fixed for in-page content.
// So the bar renders in normal flow and, once it scrolls under the 60px global
// header, a portalled fixed copy mounts on document.body (outside those
// wrappers) so it actually pins to the viewport. Same mechanism as the
// previous directory's filter bar.
const FilterBar = (props: FilterBarProps) => {
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

  return (
    <>
      <div ref={setSentinel} aria-hidden className="-mb-px h-px" />
      <div style={BAR_STYLE} className="border-y backdrop-blur-md">
        <FilterBarInner {...props} />
      </div>
      {pinned &&
        createPortal(
          <div
            style={BAR_STYLE}
            className="fixed left-0 right-0 top-[60px] z-30 border-b backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <FilterBarInner {...props} />
          </div>,
          document.body,
        )}
    </>
  );
};

const TonightRail = ({ items }: { items: VenueVm[] }) => {
  if (items.length === 0) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 pb-1 pt-4">
      <div className="text-[10px] font-extrabold uppercase tracking-[0.15em]" style={{ color: ACCENT }}>
        Dancing tonight &middot; {items.length} {items.length === 1 ? 'venue' : 'venues'}
      </div>
      <div className="mt-3 flex gap-3 overflow-x-auto pb-2 pt-1.5 [scrollbar-width:none]">
        {items.map(({ v, startTime }) => (
          <Link key={v.id} to={`/venue-entity/${v.slug ?? v.id}`} className="w-[88px] shrink-0 text-center">
            <div className="relative">
              <span
                className="absolute -top-1.5 left-1/2 z-10 -translate-x-1/2 rounded-md px-1.5 py-0.5 text-[8px] font-extrabold tracking-wider"
                style={{ background: `linear-gradient(180deg, ${ACCENT_WARM}, ${ACCENT_DK})`, color: '#1a1206' }}
              >
                TONIGHT
              </span>
              {v.cover_image ? (
                <img
                  src={v.cover_image}
                  alt={v.name}
                  loading="lazy"
                  className="h-[88px] w-[88px] rounded-2xl border-2 object-cover"
                  style={{ borderColor: ACCENT_DEEP, boxShadow: `0 5px 15px rgba(184,134,11,0.25)` }}
                />
              ) : (
                <div
                  className="flex h-[88px] w-[88px] items-center justify-center rounded-2xl border-2"
                  style={{ borderColor: ACCENT_DEEP, backgroundColor: CARD_BG }}
                >
                  <Building2 className="h-6 w-6" style={{ color: MUTED }} />
                </div>
              )}
            </div>
            <div className="mt-1.5 truncate text-[11px] font-bold" style={{ color: CREAM }}>{v.name}</div>
            {startTime && (
              <div className="text-[10px]" style={{ color: MUTED }}>
                from {startTime}
              </div>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
};

const VenueRow = ({ vm }: { vm: VenueVm }) => {
  const { v } = vm;
  const dormant = vm.nextLabel === null;
  return (
    <Link to={`/venue-entity/${v.slug ?? v.id}`} className="block">
      <div
        style={{ backgroundColor: CARD_BG, borderColor: LINE }}
        className="mx-3 mb-2 flex items-center gap-2.5 rounded-2xl border p-2.5 transition-colors hover:border-amber-400/40 lg:mx-0 lg:mb-0"
      >
        {v.cover_image ? (
          <img
            src={v.cover_image}
            alt={v.name}
            loading="lazy"
            className={cn('h-14 w-14 shrink-0 rounded-xl object-cover', dormant && 'opacity-60 grayscale')}
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: '#0d0a06' }}>
            <Building2 className="h-5 w-5" style={{ color: MUTED }} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate">
            <span
              className="text-sm font-bold"
              style={{ color: dormant ? '#78716c' : CREAM }}
            >
              {v.name}
            </span>
            {(v.neighbourhood ?? vm.outward) && (
              <span className="ml-1.5 text-[11px] font-medium" style={{ color: MUTED }}>
                ({v.neighbourhood ?? vm.outward})
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate text-xs" style={{ color: MUTED }}>
            <span aria-hidden="true" className="mr-1">
              &#x1F4CD;
            </span>
            {v.nearest_station ? (
              v.nearest_station_minutes != null ? (
                <>
                  {v.nearest_station_minutes} min from {v.nearest_station}
                </>
              ) : (
                <>near {v.nearest_station}</>
              )
            ) : (
              v.address ?? 'London'
            )}
          </div>
          {dormant ? (
            <div className="mt-0.5 truncate text-xs font-medium" style={{ color: QUIET }}>
              No upcoming events
            </div>
          ) : (
            <div className="mt-0.5 truncate text-xs font-bold" style={{ color: ACCENT_WARM }}>
              {v.next_event_name ?? 'Upcoming event'}
            </div>
          )}
        </div>
        {dormant ? (
          <span className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold" style={{ color: QUIET }}>
            quiet
          </span>
        ) : (
          <span
            className={cn('shrink-0 rounded-lg px-2 py-1 text-[11px] font-extrabold', vm.isTonight && 'animate-pulse')}
            style={
              vm.isTonight
                ? { background: `linear-gradient(180deg, ${ACCENT_WARM}, ${ACCENT_DK})`, color: '#1a1206' }
                : { backgroundColor: ACCENT_SOFT, color: ACCENT }
            }
          >
            {vm.nextLabel}
          </span>
        )}
      </div>
    </Link>
  );
};

const AreaPanel = ({
  areaKey,
  rows,
  open,
  onToggle,
}: {
  areaKey: string;
  rows: VenueVm[];
  open: boolean;
  onToggle: () => void;
}) => (
  <div>
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      style={{
        background: 'radial-gradient(120% 100% at 50% 0%, #2a1f08, #0d0a06)',
        borderColor: ACCENT_DEEP,
        boxShadow: `0 0 0 3px #0a0805, inset 0 0 26px rgba(245,213,99,0.08)`,
      }}
      className="mx-3 mb-2 flex w-[calc(100%-1.5rem)] items-center justify-between rounded-xl border-2 px-3.5 py-2.5 text-sm font-extrabold transition-colors hover:border-amber-500/70"
    >
      <span className="flex items-center gap-2" style={{ color: CREAM }}>
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: areaDot(areaKey) }} />
        {areaLabel(areaKey)}
        <span className="text-[11px] font-bold" style={{ color: MUTED }}>
          {rows.length}
        </span>
      </span>
      <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} style={{ color: MUTED }} />
    </button>
    {open && (
      <div className="space-y-0 lg:mb-2 lg:grid lg:grid-cols-2 lg:gap-2 lg:px-3 xl:grid-cols-3">
        {rows.map((vm) => (
          <VenueRow key={vm.v.id} vm={vm} />
        ))}
      </div>
    )}
  </div>
);

const VenuesSkeleton = () => (
  <div className="mx-auto max-w-6xl px-4 pt-5">
    <div className="flex gap-3 overflow-hidden pb-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-[88px] w-[88px] shrink-0 rounded-2xl" />
      ))}
    </div>
    <Skeleton className="mt-3 h-[108px] w-full rounded-xl" />
    <div className="mt-4 space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-[76px] w-full rounded-2xl" />
      ))}
    </div>
  </div>
);

const Venues = () => {
  useSeo(buildSeoForRoute('venues'));
  const {
    data: venues = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['venues-directory'],
    queryFn: fetchPublicVenuesList,
    staleTime: 5 * 60 * 1000,
  });

  const [area, setArea] = useState<'All' | AreaKey>('All');
  const [day, setDay] = useState<string | null>(null);
  const [openArea, setOpenArea] = useState<string | null>(null);
  const didInitOpen = useRef(false);

  // todayKey re-derives the "Tonight"/"Tomorrow" labels when the London day
  // flips — without it a tab open past midnight kept yesterday's labels
  // (buildVm reads the current date internally, so the dep is the trigger).
  const todayKey = useLondonToday();
  const vms = useMemo(() => venues.map(buildVm), [venues, todayKey]);
  const tonight = useMemo(() => vms.filter((x) => x.isTonight).sort(byNextThenActivity), [vms]);

  // Day chips run today-first on London's calendar.
  const todayName = weekdayFmt.format(new Date());
  const todayIdx = WEEKDAYS.indexOf(todayName);
  const days = todayIdx < 0 ? WEEKDAYS : [...WEEKDAYS.slice(todayIdx), ...WEEKDAYS.slice(0, todayIdx)];

  // A venue matches a day chip when its regular pattern includes that day OR
  // its next event falls on it (catches one-off events at venues whose
  // pattern says otherwise).
  const filtered = useMemo(
    () =>
      vms.filter((x) => {
        if (area !== 'All' && x.area !== area) return false;
        if (day !== null && x.nextWeekday !== day && !x.v.day_pattern.includes(day)) return false;
        return true;
      }),
    [vms, area, day],
  );

  const groups = useMemo(() => {
    const map = new Map<string, VenueVm[]>();
    filtered.forEach((x) => {
      const key = x.area ?? 'Elsewhere';
      const bucket = map.get(key);
      if (bucket) bucket.push(x);
      else map.set(key, [x]);
    });
    return [...AREA_ORDER, 'Elsewhere']
      .filter((k) => map.has(k))
      .map((k) => ({ key: k, rows: map.get(k)!.sort(byNextThenActivity) }));
  }, [filtered]);

  // Open the area with tonight's dancing by default (first load only, so a
  // deliberately closed panel stays closed).
  useEffect(() => {
    if (didInitOpen.current || vms.length === 0) return;
    didInitOpen.current = true;
    const tonightArea = vms.find((x) => x.isTonight)?.area;
    if (tonightArea) {
      setOpenArea(tonightArea);
      return;
    }
    const present = new Set(vms.map((x) => x.area ?? 'Elsewhere'));
    setOpenArea([...AREA_ORDER, 'Elsewhere'].find((k) => present.has(k)) ?? null);
  }, [vms]);

  const clearFilters = () => {
    setArea('All');
    setDay(null);
  };

  return (
    <GlobalLayout
      breadcrumbs={buildBreadcrumbs('venues')}
      gradientPalette="brass"
      hero={{
        emoji: '\u{1F3DB}\uFE0F',
        titleWhite: 'Dance',
        titleOrange: 'Venues',
        highlightColor: 'text-amber-300',
        floatingIcons: [Building2, MapPin, Users, Music, Layers, Lightbulb],
      }}
    >
      <section className="mx-auto max-w-3xl px-4 pb-1 pt-3 text-center">
        <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
          Every bachata venue in London &mdash; filter by area or by night, or check{' '}
          <Link to="/tonight" className="font-semibold underline" style={{ color: ACCENT_WARM }}>
            what&rsquo;s on tonight
          </Link>
          .
        </p>
      </section>

      {isLoading ? (
        <VenuesSkeleton />
      ) : isError ? (
        <div className="py-14 text-center">
          <Building2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm" style={{ color: MUTED }}>Couldn&rsquo;t load venues.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 rounded-lg px-3 py-1.5 text-xs font-bold"
            style={{ background: `linear-gradient(180deg, ${ACCENT_WARM}, ${ACCENT_DK})`, color: '#1a1206' }}
          >
            Try again
          </button>
        </div>
      ) : venues.length === 0 ? (
        <div className="py-14 text-center">
          <Building2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
          <p className="text-xs" style={{ color: MUTED }}>No venues yet.</p>
        </div>
      ) : (
        <>
          <TonightRail items={tonight} />
          <FilterBar
            area={area}
            day={day}
            days={days}
            count={filtered.length}
            onArea={setArea}
            onDay={(d) => setDay((prev) => (prev === d ? null : d))}
            onClear={clearFilters}
          />
          <main className="mx-auto max-w-6xl pb-10 pt-4">
            {groups.length === 0 ? (
              <div className="py-12 text-center">
                <Building2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                <p className="text-xs" style={{ color: MUTED }}>No venues match your filters.</p>
                <button type="button" onClick={clearFilters} className="mt-2 text-xs font-bold hover:underline" style={{ color: ACCENT }}>
                  Clear filters
                </button>
              </div>
            ) : (
              groups.map((g) => (
                <AreaPanel
                  key={g.key}
                  areaKey={g.key}
                  rows={g.rows}
                  open={groups.length === 1 || openArea === g.key}
                  onToggle={() => setOpenArea((prev) => (prev === g.key ? null : g.key))}
                />
              ))
            )}
          </main>
        </>
      )}
    </GlobalLayout>
  );
};

export default Venues;
