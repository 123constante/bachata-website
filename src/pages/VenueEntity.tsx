import {
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInCalendarDays } from 'date-fns';
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  Share2,
  Phone,
  Mail,
  Globe,
  Instagram,
  Facebook,
  Sparkles,
  Wifi,
  Snowflake,
  Droplet,
  Lock,
  Utensils,
  Cookie,
  SquareParking,
  Mic,
  Trees,
  Shirt,
  Accessibility,
  Footprints,
  Wine,
  MapPin,
  Train,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { useSeo, buildSeoForRoute, useEntitySlugOrId, useCanonicalReplaceState } from '@/lib/seo';
import { fetchPublicVenue } from '@/services/venuePublicService';
import { buildVenueJsonLd } from '@/lib/buildVenueJsonLd';
import { computeVenueOpenStatus } from '@/lib/venueOpenStatus';
import { resolveTubeLine } from '@/lib/tubeLineColour';

// ============================================================
// Types
// ============================================================
type VenueOccurrenceRow = {
  event_id: string;
  name: string;
  instance_start: string;
  occurrence_id: string;
  poster_url: string | null;
  type: string | null;
};

type FaqItem = { q: string; a: string };

type TransportJson = {
  notes?: string | null;
  nearest_stations?:
    | {
        station?: string | null;
        line_names?: string[] | null;
        walking_distance_minutes?: number | null;
      }[]
    | null;
};

type ParkingJson = {
  parking_available?: boolean | null;
  nearby_parking_notes?: string | null;
};

// ============================================================
// Helpers
// ============================================================
const parseStrArray = (val: unknown): string[] | null => {
  if (!val) return null;
  if (Array.isArray(val))
    return (val as unknown[]).filter((v): v is string => typeof v === 'string' && v.length > 0);
  if (typeof val === 'string') {
    try {
      const p = JSON.parse(val);
      return Array.isArray(p)
        ? (p as unknown[]).filter((v): v is string => typeof v === 'string' && v.length > 0)
        : null;
    } catch {
      return [val];
    }
  }
  return null;
};

const parseFromEventParam = (search: string): string | null => {
  const raw = new URLSearchParams(search).get('from');
  if (!raw) return null;
  const [kind, value] = raw.split(':');
  if (kind !== 'event' || !value) return null;
  return /^[0-9a-f-]{8,}$/i.test(value) ? value : null;
};

const countdown = (isoStart: string): string => {
  const diff = differenceInCalendarDays(new Date(isoStart), new Date());
  if (diff === 0) return 'Tonight';
  if (diff === 1) return 'Tomorrow';
  return 'in ' + diff + ' days';
};

const DAY_ORDER = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;
const DAY_ABBR: Record<string, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};
const JS_DAY_TO_ORDER = [6, 0, 1, 2, 3, 4, 5];

const humaniseKey = (k: string) =>
  k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// ============================================================
// Facility icon + label maps
// ============================================================
const facIcon = (
  Icon: ComponentType<{ className?: string; strokeWidth?: number }>,
) => <Icon className="w-4 h-4" strokeWidth={1.4} />;

const FACILITY_ICONS: Record<string, ReactNode> = {
  mirrors: facIcon(Sparkles),
  changing_area: facIcon(Shirt),
  wifi: facIcon(Wifi),
  wheelchair_access: facIcon(Accessibility),
  air_conditioning: facIcon(Snowflake),
  drinking_water: facIcon(Droplet),
  bottle_refill: facIcon(Droplet),
  lockers: facIcon(Lock),
  kitchen: facIcon(Utensils),
  snacks_available: facIcon(Cookie),
  free_parking: facIcon(SquareParking),
  late_train_friendly: facIcon(Train),
  stage: facIcon(Mic),
  outdoor_space: facIcon(Trees),
};

const FACILITY_LABELS: Record<string, string> = {
  mirrors: 'Mirrors',
  changing_area: 'Changing',
  wifi: 'Wi-Fi',
  wheelchair_access: 'Step-free',
  air_conditioning: 'Air con',
  drinking_water: 'Water',
  bottle_refill: 'Bottle refill',
  lockers: 'Lockers',
  kitchen: 'Kitchen',
  snacks_available: 'Snacks',
  free_parking: 'Parking',
  late_train_friendly: 'Late train',
  stage: 'Stage',
  outdoor_space: 'Outdoor',
};

// ============================================================
// Latin Warm theme - mirrors --venue-* tokens from src/index.css
// ============================================================
const SERIF = "Georgia,'Times New Roman','Hoefler Text',serif";
const MONO = "'JetBrains Mono',ui-monospace,'SF Mono',monospace";

// ============================================================
// Brass divider
// ============================================================
function BrassDivider() {
  return (
    <div className="flex items-center justify-center my-5">
      <span
        className="flex-1 h-px max-w-[160px]"
        style={{
          background:
            'linear-gradient(90deg,transparent,hsla(var(--venue-brass)/.5),transparent)',
        }}
      />
    </div>
  );
}

// ============================================================
// Section label "// Foo"
// ============================================================
function SectionLabel({
  label,
  action,
}: {
  label: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between mb-3">
      <span
        style={{
          fontFamily: MONO,
          fontSize: '10px',
          letterSpacing: '.26em',
          textTransform: 'uppercase',
          color: 'hsl(var(--venue-brass))',
        }}
      >
        // {label}
      </span>
      {action}
    </div>
  );
}

// ============================================================
// Italic Georgia headline
// ============================================================
function SectionHeadline({ children }: { children: ReactNode }) {
  return (
    <h2
      className="mb-3"
      style={{
        fontFamily: SERIF,
        fontStyle: 'italic',
        fontWeight: 400,
        fontSize: '20px',
        letterSpacing: '-.01em',
        color: 'hsl(var(--venue-cream))',
      }}
    >
      {children}
    </h2>
  );
}

// ============================================================
// Stat tile
// ============================================================
function StatTile({
  value,
  sub,
  label,
}: {
  value: ReactNode;
  sub?: string;
  label: string;
}) {
  return (
    <div className="text-center relative">
      <div
        style={{
          fontFamily: SERIF,
          fontStyle: 'italic',
          fontSize: '28px',
          fontWeight: 400,
          color: 'hsl(var(--venue-ember))',
          letterSpacing: '-.02em',
          lineHeight: 1,
        }}
      >
        {value}
        {sub && (
          <span
            style={{
              fontStyle: 'normal',
              fontSize: '13px',
              color: 'hsl(var(--venue-cream-mut))',
              marginLeft: '2px',
            }}
          >
            {sub}
          </span>
        )}
      </div>
      <div
        className="mt-1.5"
        style={{
          fontFamily: MONO,
          fontSize: '9px',
          letterSpacing: '.22em',
          textTransform: 'uppercase',
          color: 'hsl(var(--venue-brass))',
        }}
      >
        {label}
      </div>
    </div>
  );
}

// ============================================================
// Status badge (Open / Closed pill)
// ============================================================
function StatusBadge({ label, isOpen }: { label: string; isOpen: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
      style={{
        background: 'hsla(var(--venue-bg)/.65)',
        backdropFilter: 'blur(10px)',
        border: '1px solid hsla(var(--venue-brass)/.32)',
        color: 'hsl(var(--venue-cream))',
        fontFamily: 'system-ui, -apple-system, Inter, sans-serif',
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{
          background: isOpen
            ? 'hsl(var(--venue-open))'
            : 'hsl(var(--venue-brass))',
          boxShadow: isOpen ? '0 0 8px hsl(var(--venue-open))' : 'none',
        }}
      />
      <span style={{ fontWeight: 500 }}>{label}</span>
    </span>
  );
}

// ============================================================
// Icon button (hero chrome)
// ============================================================
function IconBtn({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      aria-label={label}
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center rounded-full transition-colors select-none active:scale-[0.97] w-9 h-9"
      style={{
        background: 'hsla(var(--venue-bg)/.55)',
        backdropFilter: 'blur(10px)',
        border: '1px solid hsla(var(--venue-brass)/.3)',
        color: 'hsl(var(--venue-cream))',
      }}
    >
      {children}
    </button>
  );
}

// ============================================================
// TfL Roundel station card (Approach A)
// ============================================================
function StationRoundel({
  stationName,
  lineNames,
  walkMin,
  isStepFree,
}: {
  stationName: string;
  lineNames: string[];
  walkMin: number | null;
  isStepFree: boolean;
}) {
  const lines = lineNames.map((n) => ({ raw: n, tfl: resolveTubeLine(n) }));
  return (
    <div
      className="relative overflow-hidden p-4 text-center"
      style={{
        background: 'hsl(var(--venue-surface))',
        border: '1px solid hsl(var(--venue-line))',
        borderRadius: '14px',
      }}
    >
      <span
        aria-hidden
        className="absolute top-0 left-[14%] right-[14%] h-px"
        style={{
          background:
            'linear-gradient(90deg,transparent,hsla(var(--venue-brass)/.5),transparent)',
        }}
      />

      {/* Roundel */}
      <div className="relative w-[132px] h-[132px] mx-auto mb-2 flex items-center justify-center">
        <span
          className="absolute inset-0 rounded-full"
          style={{
            border: '15px solid #DC241F',
            background: 'hsl(var(--venue-bg))',
            boxShadow:
              '0 0 0 1px hsla(var(--venue-brass)/.3), 0 8px 24px rgba(220,36,31,.18)',
          }}
        />
        <span
          className="absolute left-[6px] right-[6px] top-1/2 -translate-y-1/2 flex items-center justify-center"
          style={{
            height: '28px',
            background: '#DC241F',
            color: '#fff',
            fontFamily: "'Helvetica Neue', Inter, system-ui, sans-serif",
            fontWeight: 700,
            fontSize: '13px',
            letterSpacing: '.04em',
          }}
        >
          UNDERGROUND
        </span>
      </div>

      <div
        style={{
          fontFamily: SERIF,
          fontStyle: 'italic',
          fontSize: '24px',
          fontWeight: 400,
          letterSpacing: '-.015em',
          color: 'hsl(var(--venue-cream))',
          marginTop: '8px',
        }}
      >
        {stationName}
      </div>

      {/* Line chips */}
      {lines.length > 0 && (
        <div
          className="flex flex-col gap-1.5 my-3 py-3"
          style={{
            borderTop: '1px solid hsl(var(--venue-line))',
            borderBottom: '1px solid hsl(var(--venue-line))',
          }}
        >
          {lines.map((l) => (
            <div
              key={l.raw}
              className="flex items-center gap-2.5 px-1"
            >
              <span
                className="block h-2 rounded-full shrink-0"
                style={{
                  width: '50px',
                  background: l.tfl.bg,
                  boxShadow: 'inset 0 -1px 0 rgba(0,0,0,.25)',
                }}
              />
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'hsl(var(--venue-cream))',
                  flex: 1,
                  textAlign: 'left',
                }}
              >
                {l.tfl.name || l.raw}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Walk pill + step-free */}
      <div className="flex gap-1.5 flex-wrap justify-center">
        {walkMin != null && (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{
              background: 'hsla(var(--venue-ember)/.08)',
              border: '1px solid hsla(var(--venue-ember)/.35)',
              color: 'hsl(var(--venue-ember))',
            }}
          >
            <Footprints className="w-3 h-3" strokeWidth={1.6} />
            {walkMin} min walk
          </span>
        )}
        {isStepFree && (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{
              background: 'hsla(var(--venue-open)/.1)',
              border: '1px solid hsla(var(--venue-open)/.4)',
              color: 'hsl(var(--venue-open))',
            }}
          >
            <Accessibility className="w-3 h-3" strokeWidth={1.6} />
            Step-free
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Hours table
// ============================================================
function HoursList({
  rows,
}: {
  rows: { day: string; display: string; isToday: boolean }[];
}) {
  return (
    <div
      className="p-3 px-4"
      style={{
        background: 'hsl(var(--venue-surface))',
        border: '1px solid hsl(var(--venue-line))',
        borderRadius: '12px',
      }}
    >
      {rows.map((row, i) => {
        const closed = row.display.toLowerCase() === 'closed';
        return (
          <div
            key={row.day}
            className="flex items-center justify-between py-1.5"
            style={{
              borderBottom:
                i < rows.length - 1
                  ? '1px solid hsl(var(--venue-line))'
                  : 'none',
            }}
          >
            <span
              style={{
                fontSize: '12.5px',
                color: row.isToday
                  ? 'hsl(var(--venue-cream))'
                  : closed
                  ? 'hsla(var(--venue-cream-mut)/.5)'
                  : 'hsl(var(--venue-cream-mut))',
                fontWeight: row.isToday ? 500 : 400,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {row.day}
              {row.isToday && (
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: '8.5px',
                    letterSpacing: '.18em',
                    textTransform: 'uppercase',
                    color: 'hsl(var(--venue-ember))',
                    fontWeight: 400,
                  }}
                >
                  today
                </span>
              )}
            </span>
            <span
              style={{
                fontSize: '12px',
                fontVariantNumeric: 'tabular-nums',
                color: row.isToday
                  ? 'hsl(var(--venue-cream))'
                  : closed
                  ? 'hsla(var(--venue-cream-mut)/.5)'
                  : 'hsl(var(--venue-cream-mut))',
                fontWeight: row.isToday ? 500 : 400,
              }}
            >
              {row.display}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// FAQ accordion
// ============================================================
function FAQList({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState(0);
  return (
    <div>
      {items.map((f, i) => (
        <div
          key={i}
          style={{ borderBottom: '1px solid hsl(var(--venue-line))' }}
        >
          <button
            type="button"
            onClick={() => setOpen(open === i ? -1 : i)}
            className="w-full flex items-start justify-between gap-3 py-3 text-left"
          >
            <span
              style={{
                fontSize: '13.5px',
                color: 'hsl(var(--venue-cream))',
                lineHeight: 1.35,
                fontWeight: 500,
              }}
            >
              {f.q}
            </span>
            <ChevronDown
              className="mt-0.5 shrink-0 transition-transform w-4 h-4"
              strokeWidth={1.6}
              style={{
                color: 'hsl(var(--venue-ember))',
                transform: open === i ? 'rotate(180deg)' : 'none',
              }}
            />
          </button>
          <div
            className="grid transition-all duration-300 ease-out"
            style={{ gridTemplateRows: open === i ? '1fr' : '0fr' }}
          >
            <div className="overflow-hidden">
              <p
                className="pb-3 pr-2"
                style={{
                  fontSize: '12.5px',
                  lineHeight: 1.55,
                  color: 'hsl(var(--venue-cream-mut))',
                }}
              >
                {f.a}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Event tile (3-col grid)
// ============================================================
function EventTile({
  ev,
  isRecurring,
}: {
  ev: VenueOccurrenceRow;
  isRecurring?: boolean;
}) {
  const start = new Date(ev.instance_start);
  return (
    <Link
      to={`/event/${ev.event_id}?occurrenceId=${ev.occurrence_id}`}
      className="group block overflow-hidden"
      style={{
        background: 'hsl(var(--venue-surface))',
        border: '1px solid hsl(var(--venue-line))',
        borderRadius: '10px',
        textDecoration: 'none',
      }}
    >
      <div className="relative" style={{ aspectRatio: '3 / 4' }}>
        {ev.poster_url ? (
          <img
            src={ev.poster_url}
            alt={ev.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background:
                'linear-gradient(135deg,#5c2f18,hsl(var(--venue-bg)))',
            }}
          />
        )}
        <span
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg,transparent 45%,rgba(0,0,0,.75) 100%)',
          }}
        />
        <span
          className="absolute top-1.5 left-1.5 z-10 px-1.5 py-1 rounded text-center"
          style={{
            background: 'hsla(var(--venue-bg)/.78)',
            backdropFilter: 'blur(8px)',
            border: '1px solid hsl(var(--venue-brass))',
            minWidth: '28px',
          }}
        >
          <span
            style={{
              display: 'block',
              fontFamily: SERIF,
              fontStyle: 'italic',
              fontSize: '13px',
              color: 'hsl(var(--venue-ember))',
              fontWeight: 400,
              lineHeight: 1,
            }}
          >
            {format(start, 'd')}
          </span>
          <span
            style={{
              display: 'block',
              fontFamily: MONO,
              fontSize: '7px',
              letterSpacing: '.16em',
              textTransform: 'uppercase',
              color: 'hsl(var(--venue-cream-mut))',
              marginTop: '1px',
            }}
          >
            {format(start, 'EEE')}
          </span>
        </span>
        {isRecurring && (
          <span
            className="absolute top-1.5 right-1.5 z-10 px-1.5 py-0.5 rounded text-[8px]"
            style={{
              fontFamily: MONO,
              letterSpacing: '.12em',
              textTransform: 'uppercase',
              background: 'hsla(var(--venue-open)/.15)',
              border: '1px solid hsla(var(--venue-open)/.4)',
              color: 'hsl(var(--venue-open))',
              fontWeight: 600,
            }}
          >
            Weekly
          </span>
        )}
      </div>
      <div className="p-2">
        <div
          className="line-clamp-2"
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'hsl(var(--venue-cream))',
            lineHeight: 1.2,
          }}
        >
          {ev.name}
        </div>
        <div
          className="mt-1"
          style={{
            fontFamily: MONO,
            fontSize: '8.5px',
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            color: 'hsl(var(--venue-cream-mut))',
          }}
        >
          {format(start, 'HH:mm')}
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: '8.5px',
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            color: 'hsl(var(--venue-ember))',
            marginTop: '2px',
          }}
        >
          {countdown(ev.instance_start)}
        </div>
      </div>
    </Link>
  );
}

// ============================================================
// Main page
// ============================================================
const VenueEntity = () => {
  const { id: routeParam } = useParams<{ id: string }>();
  const resolved = useEntitySlugOrId(routeParam, 'venues');
  const id = resolved.id ?? undefined;
  useCanonicalReplaceState({
    arrivedViaUuid: resolved.arrivedViaUuid,
    slug: resolved.slug,
    buildPath: (s) => `/venue-entity/${s}`,
  });
  const navigate = useNavigate();
  const location = useLocation();

  const fromEventId = parseFromEventParam(location.search);
  const rawOcc = new URLSearchParams(location.search).get('occ') ?? null;
  const fromOccurrenceId =
    rawOcc &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      rawOcc,
    )
      ? rawOcc
      : null;

  const { data: venue, isLoading } = useQuery({
    queryKey: ['public-venue', id],
    queryFn: () => fetchPublicVenue(id!),
    enabled: !!id,
  });

  const { data: events } = useQuery({
    queryKey: ['venue-upcoming-events', id, fromEventId, fromOccurrenceId],
    queryFn: async () => {
      const now = new Date().toISOString();
      const sixtyDaysLater = new Date(
        Date.now() + 60 * 86400000,
      ).toISOString();
      const { data } = await supabase.rpc('calendar_events_dto' as never, {
        p_from: now,
        p_to: sixtyDaysLater,
        p_city_id: null,
        p_venue_id: id,
      } as never);
      const rows = (data as VenueOccurrenceRow[] | null) ?? [];
      const filtered = fromOccurrenceId
        ? rows.filter((r) => r.occurrence_id !== fromOccurrenceId)
        : fromEventId
        ? rows.filter((r) => r.event_id !== fromEventId)
        : rows;
      return filtered.slice(0, 9);
    },
    enabled: !!id && !!venue,
  });
  useSeo(
    buildSeoForRoute('venue.detail', {
      entityName: venue?.name,
      entitySlug: resolved.slug ?? id ?? undefined,
      cityDisplay: venue?.city_name ?? undefined,
      ogImage: Array.isArray(venue?.image_url) ? venue?.image_url[0] : (venue?.image_url ?? undefined),
      isLoading,
    }),
  );
  const backHref = fromEventId ? '/event/' + fromEventId : '/venues';

  // ----------------------------------------------------------
  // Loading
  // ----------------------------------------------------------
  if (isLoading) {
    return (
      <GlobalLayout
        showSubheader={false}
        backHref={backHref}
        showGradientBg={false}
      >
        <div
          className="relative antialiased min-h-screen"
          style={{
            background: 'hsl(var(--venue-bg))',
            color: 'hsl(var(--venue-cream))',
            fontFamily: 'system-ui, -apple-system, Inter, sans-serif',
          }}
        >
          <div className="px-4 pt-4">
            <Skeleton
              className="w-full rounded-xl bg-white/15"
              style={{ height: 280 }}
            />
            <div className="mt-4 space-y-2">
              <Skeleton className="h-4 w-1/3 bg-white/15" />
              <Skeleton className="h-8 w-2/3 bg-white/15" />
            </div>
          </div>
        </div>
      </GlobalLayout>
    );
  }

  // ----------------------------------------------------------
  // Not found
  // ----------------------------------------------------------
  if (!venue) {
    return (
      <GlobalLayout
        showSubheader={false}
        backHref={backHref}
        showGradientBg={false}
      >
        <div
          className="relative antialiased min-h-screen flex flex-col items-center justify-center p-6"
          style={{
            background: 'hsl(var(--venue-bg))',
            color: 'hsl(var(--venue-cream))',
            fontFamily: 'system-ui, -apple-system, Inter, sans-serif',
          }}
        >
          <p
            className="text-sm mb-4"
            style={{
              fontFamily: SERIF,
              fontStyle: 'italic',
              color: 'hsl(var(--venue-cream-mut))',
            }}
          >
            This venue doesn&rsquo;t exist or has been removed.
          </p>
          <Button
            onClick={() => navigate(backHref)}
            variant="outline"
            size="sm"
          >
            <ArrowLeft className="w-3 h-3 mr-1" />
            {fromEventId ? 'Back to event' : 'Back to venues'}
          </Button>
        </div>
      </GlobalLayout>
    );
  }

  // ----------------------------------------------------------
  // Data parsing
  // ----------------------------------------------------------
  const facilitiesRaw = parseStrArray(venue.facilities_new ?? venue.facilities);
  const transportJson: TransportJson | null =
    venue.transport_json &&
    typeof venue.transport_json === 'object' &&
    !Array.isArray(venue.transport_json)
      ? (venue.transport_json as TransportJson)
      : null;
  const parkingJson: ParkingJson | null =
    venue.parking_json &&
    typeof venue.parking_json === 'object' &&
    !Array.isArray(venue.parking_json)
      ? (venue.parking_json as ParkingJson)
      : null;
  const openingHours =
    venue.opening_hours &&
    typeof venue.opening_hours === 'object' &&
    !Array.isArray(venue.opening_hours)
      ? (venue.opening_hours as Record<string, unknown>)
      : null;

  const addressLine = [venue.address, venue.postcode].filter(Boolean).join(', ');
  const mapsUrl =
    venue.google_maps_href ||
    venue.google_maps_link ||
    venue.google_maps_url ||
    (addressLine
      ? 'https://www.google.com/maps/dir/?api=1&destination=' +
        encodeURIComponent(
          [venue.name, addressLine, venue.city_name].filter(Boolean).join(', '),
        )
      : null);
  const citymapperUrl = addressLine
    ? 'https://citymapper.com/directions?endaddress=' +
      encodeURIComponent(addressLine) +
      '&endname=' +
      encodeURIComponent(venue.name)
    : null;

  const heroImagesRaw = [
    ...(Array.isArray(venue.image_url) ? venue.image_url : []),
    ...(parseStrArray(venue.gallery_urls) ?? []),
  ].filter((u): u is string => typeof u === 'string' && u.length > 0);
  const heroImages = Array.from(new Set(heroImagesRaw)).slice(0, 8);

  const openStatus = computeVenueOpenStatus(
    openingHours as Parameters<typeof computeVenueOpenStatus>[0],
    venue.timezone ?? null,
    new Date(),
  );
  const isVenueOpen =
    openStatus.status === 'open' || openStatus.status === 'closing-soon';
  const statusText = (() => {
    if (openStatus.status === 'open' || openStatus.status === 'closing-soon')
      return 'Open \u00B7 until ' + openStatus.closesAt;
    if (openStatus.status === 'opens-soon')
      return 'Closed \u00B7 opens ' + openStatus.opensAt;
    if (openStatus.status === 'closed') {
      if (
        openStatus.opensAt &&
        openStatus.opensDayLabel &&
        openStatus.opensDayLabel !== 'today'
      )
        return 'Closed \u00B7 opens ' + openStatus.opensDayLabel;
      if (openStatus.opensAt) return 'Closed \u00B7 opens ' + openStatus.opensAt;
      return 'Closed';
    }
    return null;
  })();

  // Facilities
  const facilities: { key: string; icon: ReactNode; label: string }[] = [];
  if (facilitiesRaw) {
    for (const key of facilitiesRaw) {
      facilities.push({
        key,
        icon: FACILITY_ICONS[key] ?? facIcon(Sparkles),
        label: FACILITY_LABELS[key] ?? humaniseKey(key),
      });
    }
  }
  if (venue.bar_available) {
    facilities.push({ key: 'bar', icon: facIcon(Wine), label: 'Bar' });
  }
  if (venue.cloakroom_available) {
    facilities.push({
      key: 'cloakroom',
      icon: facIcon(Shirt),
      label: 'Cloakroom',
    });
  }
  if (venue.id_required) {
    facilities.push({
      key: 'id_required',
      icon: facIcon(Lock),
      label: 'ID required',
    });
  }
  if (venue.floor_type) {
    facilities.push({
      key: 'floor_' + venue.floor_type,
      icon: facIcon(Sparkles),
      label: humaniseKey(venue.floor_type) + ' floor',
    });
  }

  const hasFacilities = facilities.length > 0;

  const station = transportJson?.nearest_stations?.[0] ?? null;
  const hasStation = !!station?.station;
  const facilityKeys = facilitiesRaw ?? [];
  const isStepFree = facilityKeys.includes('wheelchair_access');

  // Hours rows
  const todayDayKey = DAY_ORDER[JS_DAY_TO_ORDER[new Date().getDay()]];
  const hoursRows: { day: string; display: string; isToday: boolean }[] = [];
  if (openingHours) {
    for (let i = 0; i < 7; i++) {
      const dayKey = DAY_ORDER[i];
      let raw: unknown;
      for (const k of Object.keys(openingHours)) {
        if (k.toLowerCase() === dayKey) {
          raw = (openingHours as Record<string, unknown>)[k];
          break;
        }
      }
      if (raw == null) continue;
      let display = '';
      if (typeof raw === 'string') {
        display = raw;
      } else if (typeof raw === 'object') {
        const h = raw as { open?: string; close?: string; isOpen?: boolean };
        if (h.isOpen === false) display = 'Closed';
        else if (h.open && h.close) display = h.open + '-' + h.close;
      }
      if (display)
        hoursRows.push({
          day: DAY_ABBR[dayKey],
          display,
          isToday: dayKey === todayDayKey,
        });
    }
  }
  const hasHours = hoursRows.length > 0;

  const parkingBullets: string[] = [];
  if (parkingJson?.nearby_parking_notes) {
    parkingBullets.push(
      ...parkingJson.nearby_parking_notes
        .split('. ')
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }
  if (venue.parking_cost_notes) {
    parkingBullets.push(
      ...venue.parking_cost_notes
        .split('. ')
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }
  const hasParking =
    parkingBullets.length > 0 ||
    (parkingJson?.parking_available !== null &&
      parkingJson?.parking_available !== undefined);

  const faqItems = Array.isArray(venue.faq_json)
    ? (venue.faq_json as unknown[]).filter(
        (item): item is FaqItem =>
          typeof item === 'object' && item !== null && 'q' in item && 'a' in item,
      )
    : [];

  const rulesArr = Array.isArray(venue.rules)
    ? (venue.rules as string[]).filter(Boolean)
    : [];

  // Essentials
  type Essential = { key: string; label: string; text: string };
  const essentials: Essential[] = [];
  if (venue.water_situation)
    essentials.push({ key: 'water', label: 'Water', text: venue.water_situation });
  if (venue.food_situation)
    essentials.push({ key: 'food', label: 'Food', text: venue.food_situation });
  if (venue.late_night_notes)
    essentials.push({
      key: 'late',
      label: 'Late',
      text: venue.late_night_notes,
    });

  // Contact links
  const contactLinks: {
    key: string;
    href: string;
    label: string;
    icon: ReactNode;
  }[] = [];
  if (venue.phone) {
    contactLinks.push({
      key: 'phone',
      href: 'tel:' + venue.phone.replace(/\s+/g, ''),
      label: venue.phone,
      icon: <Phone className="w-4 h-4" strokeWidth={1.4} />,
    });
  }
  if (venue.email) {
    contactLinks.push({
      key: 'email',
      href: 'mailto:' + venue.email,
      label: venue.email,
      icon: <Mail className="w-4 h-4" strokeWidth={1.4} />,
    });
  }
  if (venue.website) {
    const display = venue.website.replace(/^https?:\/\//, '').replace(/\/$/, '');
    contactLinks.push({
      key: 'website',
      href: venue.website,
      label: display,
      icon: <Globe className="w-4 h-4" strokeWidth={1.4} />,
    });
  }
  if (venue.instagram) {
    const handle = venue.instagram.startsWith('@')
      ? venue.instagram.slice(1)
      : venue.instagram
          .replace(/^https?:\/\/(www\.)?instagram\.com\//, '')
          .replace(/\/$/, '');
    contactLinks.push({
      key: 'instagram',
      href: 'https://instagram.com/' + handle,
      label: '@' + handle,
      icon: <Instagram className="w-4 h-4" strokeWidth={1.4} />,
    });
  }
  if (venue.facebook) {
    const display = venue.facebook
      .replace(/^https?:\/\/(www\.)?facebook\.com\//, '')
      .replace(/\/$/, '');
    contactLinks.push({
      key: 'facebook',
      href: venue.facebook.startsWith('http')
        ? venue.facebook
        : 'https://facebook.com/' + venue.facebook,
      label: display || 'Facebook',
      icon: <Facebook className="w-4 h-4" strokeWidth={1.4} />,
    });
  }

  const eventList = Array.isArray(events) ? events : [];
  const heroEvents = eventList.slice(0, 6);
  const eventsPerMonth =
    eventList.length > 0 ? Math.max(1, Math.round(eventList.length / 2)) : null;

  const eventIdCounts = new Map<string, number>();
  eventList.forEach((ev) =>
    eventIdCounts.set(ev.event_id, (eventIdCounts.get(ev.event_id) ?? 0) + 1),
  );
  const recurringEventIds = new Set(
    [...eventIdCounts.entries()].filter(([, c]) => c > 1).map(([id]) => id),
  );

  // Stat tiles - Years running gated on founded_year being available in DB
  // (currently not on PublicVenue type; pending admin migration). Shows
  // Capacity + Events/month for now; lights up to 3 once founded_year lands.
  const yearsRunning = (() => {
    const yr = (venue as unknown as { founded_year?: number | null })
      .founded_year;
    if (!yr || yr < 1900) return null;
    return new Date().getFullYear() - yr;
  })();
  const showCapacity = venue.capacity != null && venue.capacity > 0;
  const statTiles = [
    yearsRunning != null && (
      <StatTile
        key="years"
        value={yearsRunning}
        label="Years running"
      />
    ),
    showCapacity && (
      <StatTile
        key="cap"
        value={venue.capacity}
        label="Capacity"
      />
    ),
    eventsPerMonth != null && (
      <StatTile
        key="evt"
        value={eventsPerMonth}
        label="Events / month"
      />
    ),
  ].filter(Boolean) as ReactNode[];

  const heroEyebrow = (() => {
    const postcodeDistrict = venue.postcode
      ? venue.postcode.split(' ')[0]
      : null;
    const parts = [postcodeDistrict, venue.city_name].filter(Boolean);
    return parts.join(' \u00B7 ').toUpperCase();
  })();

  const tagline = (() => {
    if (facilities.length === 0) return null;
    const top = facilities.slice(0, 3).map((f) => f.label.toLowerCase());
    return top.join(' \u00B7 ');
  })();

  const handleShare = () => {
    const url = window.location.href;
    const title = venue?.name ?? '';
    if (navigator.share) {
      navigator.share({ title, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).catch(() => {});
    }
  };

  return (
    <GlobalLayout
      showSubheader={false}
      backHref={backHref}
      showGradientBg={false}
    >
      <div
        className="relative antialiased"
        style={{
          background: 'hsl(var(--venue-bg))',
          color: 'hsl(var(--venue-cream))',
          fontFamily: 'system-ui, -apple-system, Inter, sans-serif',
          minHeight: '100vh',
        }}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              buildVenueJsonLd({
                name: venue.name,
                description: venue.description,
                image: heroImages,
                address: venue.address,
                postcode: venue.postcode,
                city_name: venue.city_name,
                country: venue.country,
                telephone: venue.phone,
                url:
                  typeof window !== 'undefined' ? window.location.href : '',
                opening_hours: openingHours as Parameters<
                  typeof buildVenueJsonLd
                >[0]['opening_hours'],
              }),
            ),
          }}
        />

        <div className="mx-auto" style={{ maxWidth: '520px' }}>
          {/* ============ HERO ============ */}
          <div
            className="relative overflow-hidden"
            style={{
              height: '300px',
              background:
                'radial-gradient(120% 80% at 50% -10%, hsl(var(--venue-spice)) 0%, hsl(var(--venue-surface-hi)) 50%, hsl(var(--venue-bg)) 100%)',
            }}
          >
            {/* Photo backdrop (single image, low opacity behind ornament) */}
            {heroImages.length > 0 && (
              <div
                className="absolute inset-0"
                style={{ opacity: 0.35, mixBlendMode: 'overlay' }}
              >
                <img
                  src={heroImages[0]}
                  alt={venue.name}
                  loading="eager"
                  fetchPriority="high"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Ember glow */}
            <span
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(60% 50% at 50% 0%, hsla(var(--venue-ember)/.32), transparent 70%)',
                mixBlendMode: 'screen',
              }}
            />

            {/* Pilcrow ornament */}
            <span
              aria-hidden
              className="absolute left-1/2 top-1/2"
              style={{
                transform: 'translate(-50%,-58%)',
                fontFamily: SERIF,
                fontStyle: 'italic',
                fontSize: '200px',
                color: 'hsla(var(--venue-cream)/.045)',
                lineHeight: 1,
                fontWeight: 400,
                letterSpacing: '-.04em',
              }}
            >
              &para;
            </span>

            {/* Status pill + Share */}
            {statusText && (
              <div className="absolute top-4 left-4 z-10">
                <StatusBadge label={statusText} isOpen={isVenueOpen} />
              </div>
            )}
            <div className="absolute top-4 right-4 z-10 flex gap-2">
              {fromEventId && (
                <IconBtn label="Back">
                  <Link
                    to={backHref}
                    className="w-full h-full flex items-center justify-center"
                    style={{ color: 'hsl(var(--venue-cream))' }}
                  >
                    <ChevronLeft className="w-4 h-4" strokeWidth={1.4} />
                  </Link>
                </IconBtn>
              )}
              <IconBtn label="Share" onClick={handleShare}>
                <Share2 className="w-4 h-4" strokeWidth={1.4} />
              </IconBtn>
            </div>

            {/* Bottom vignette into venue-bg */}
            <span
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(180deg, transparent 50%, hsl(var(--venue-bg)) 100%)',
              }}
            />
          </div>

          {/* ============ TITLE BLOCK ============ */}
          <div className="px-5 pt-5 pb-4 text-center relative -mt-12 z-10">
            {heroEyebrow && (
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: '10px',
                  letterSpacing: '.28em',
                  textTransform: 'uppercase',
                  color: 'hsl(var(--venue-brass))',
                  marginBottom: '12px',
                }}
              >
                {heroEyebrow}
              </div>
            )}
            <h1
              style={{
                fontFamily: SERIF,
                fontSize: '38px',
                fontStyle: 'italic',
                fontWeight: 400,
                lineHeight: 1,
                letterSpacing: '-.015em',
                color: 'hsl(var(--venue-cream))',
                marginBottom: '8px',
              }}
            >
              {venue.name}
            </h1>
            {tagline && (
              <p
                style={{
                  fontFamily: SERIF,
                  fontSize: '14px',
                  fontStyle: 'italic',
                  color: 'hsl(var(--venue-cream-mut))',
                  lineHeight: 1.45,
                  margin: '0 auto 14px',
                  maxWidth: '300px',
                }}
              >
                &mdash; {tagline} &mdash;
              </p>
            )}
            {addressLine && (
              <a
                href={mapsUrl ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs"
                style={{
                  color: 'hsl(var(--venue-ember))',
                  textDecoration: 'underline',
                  textDecorationColor: 'hsla(var(--venue-ember)/.35)',
                  textUnderlineOffset: '3px',
                }}
              >
                <MapPin className="w-3.5 h-3.5" strokeWidth={1.4} />
                {addressLine}
              </a>
            )}
          </div>

          {/* ============ CTA ============ */}
          {mapsUrl && (
            <div className="px-5 mt-2 mb-3">
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-transform active:scale-[0.98]"
                style={{
                  background:
                    'linear-gradient(180deg, hsl(var(--venue-ember)), hsl(var(--venue-spice)))',
                  color: '#160E08',
                  padding: '11px 16px',
                  fontSize: '12.5px',
                  letterSpacing: '-.01em',
                  boxShadow:
                    '0 6px 18px hsla(var(--venue-ember)/.25), inset 0 1px 0 rgba(255,255,255,.18)',
                  textDecoration: 'none',
                }}
              >
                Get directions
                <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.6} />
              </a>
            </div>
          )}

          {/* ============ STATS ============ */}
          {statTiles.length > 0 && (
            <>
              <BrassDivider />
              <div
                className="px-5 grid"
                style={{
                  gridTemplateColumns: `repeat(${statTiles.length}, 1fr)`,
                  gap: '14px',
                }}
              >
                {statTiles.map((tile, i) => (
                  <div key={i} className="relative">
                    {i > 0 && (
                      <span
                        aria-hidden
                        className="absolute left-0 top-[14%] bottom-[14%]"
                        style={{
                          width: '1px',
                          background:
                            'linear-gradient(180deg, transparent, hsla(var(--venue-brass)/.5) 30%, hsla(var(--venue-brass)/.5) 70%, transparent)',
                          marginLeft: '-7px',
                        }}
                      />
                    )}
                    {tile}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ============ GETTING HERE ============ */}
          {hasStation && station && (
            <>
              <BrassDivider />
              <section className="px-5">
                <SectionLabel label="Getting here" />
                <SectionHeadline>
                  {station.walking_distance_minutes != null
                    ? `By tube, ${station.walking_distance_minutes} min walk.`
                    : 'By tube.'}
                </SectionHeadline>
                <StationRoundel
                  stationName={station.station ?? ''}
                  lineNames={station.line_names ?? []}
                  walkMin={station.walking_distance_minutes ?? null}
                  isStepFree={isStepFree}
                />
                {(citymapperUrl || mapsUrl) && (
                  <div className="flex gap-2 mt-3">
                    {citymapperUrl && (
                      <a
                        href={citymapperUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full"
                        style={{
                          background: 'transparent',
                          border:
                            '1px solid hsla(var(--venue-brass)/.45)',
                          color: 'hsl(var(--venue-cream))',
                          padding: '9px 10px',
                          fontSize: '11px',
                          fontWeight: 500,
                          textDecoration: 'none',
                        }}
                      >
                        <Train
                          className="w-3.5 h-3.5"
                          strokeWidth={1.6}
                        />
                        Citymapper
                      </a>
                    )}
                    {mapsUrl && (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full"
                        style={{
                          background: 'transparent',
                          border:
                            '1px solid hsla(var(--venue-brass)/.45)',
                          color: 'hsl(var(--venue-cream))',
                          padding: '9px 10px',
                          fontSize: '11px',
                          fontWeight: 500,
                          textDecoration: 'none',
                        }}
                      >
                        <MapPin
                          className="w-3.5 h-3.5"
                          strokeWidth={1.6}
                          style={{ color: 'hsl(var(--venue-ember))' }}
                        />
                        Open in maps
                      </a>
                    )}
                  </div>
                )}
              </section>
            </>
          )}

          {/* ============ ESSENTIALS ============ */}
          {essentials.length > 0 && (
            <>
              <BrassDivider />
              <section className="px-5">
                <SectionLabel label="Essentials" />
                <div className="grid grid-cols-3 gap-2">
                  {essentials.map((e) => (
                    <div
                      key={e.key}
                      className="p-3 px-2.5"
                      style={{
                        background: 'hsl(var(--venue-surface))',
                        border: '1px solid hsl(var(--venue-line))',
                        borderRadius: '10px',
                      }}
                    >
                      <div
                        style={{
                          fontFamily: MONO,
                          fontSize: '8.5px',
                          letterSpacing: '.2em',
                          textTransform: 'uppercase',
                          color: 'hsl(var(--venue-brass))',
                          marginBottom: '5px',
                        }}
                      >
                        {e.label}
                      </div>
                      <div
                        style={{
                          fontSize: '11.5px',
                          color: 'hsl(var(--venue-cream-mut))',
                          lineHeight: 1.35,
                        }}
                      >
                        {e.text}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* ============ GET IN TOUCH ============ */}
          {contactLinks.length > 0 && (
            <>
              <BrassDivider />
              <section className="px-5">
                <SectionLabel label="Get in touch" />
                <div className="grid grid-cols-3 gap-2">
                  {contactLinks.map((c) => (
                    <a
                      key={c.key}
                      href={c.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 px-1.5 text-center block"
                      style={{
                        background: 'hsl(var(--venue-surface))',
                        border: '1px solid hsl(var(--venue-line))',
                        borderRadius: '10px',
                        color: 'hsl(var(--venue-cream))',
                        textDecoration: 'none',
                      }}
                    >
                      <span
                        className="inline-flex items-center justify-center w-6 h-6 mb-1"
                        style={{ color: 'hsl(var(--venue-brass))' }}
                      >
                        {c.icon}
                      </span>
                      <div
                        style={{
                          fontSize: '10.5px',
                          color: 'hsl(var(--venue-cream-mut))',
                          lineHeight: 1.25,
                          wordBreak: 'break-all',
                        }}
                      >
                        {c.label}
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* ============ WHAT'S HERE ============ */}
          {hasFacilities && (
            <>
              <BrassDivider />
              <section className="px-5">
                <SectionLabel label="What's here" />
                <div className="grid grid-cols-3 gap-2">
                  {facilities.map((f) => (
                    <div
                      key={f.key}
                      className="text-center p-2.5"
                      style={{
                        background: 'hsl(var(--venue-surface))',
                        border: '1px solid hsl(var(--venue-line))',
                        borderRadius: '10px',
                      }}
                    >
                      <span
                        className="inline-flex items-center justify-center w-6 h-6 mb-1"
                        style={{ color: 'hsl(var(--venue-brass))' }}
                      >
                        {f.icon}
                      </span>
                      <div
                        style={{
                          fontSize: '11px',
                          color: 'hsl(var(--venue-cream-mut))',
                          lineHeight: 1.25,
                        }}
                      >
                        {f.label}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* ============ HOURS ============ */}
          {hasHours && (
            <>
              <BrassDivider />
              <section className="px-5">
                <SectionLabel label="Hours" />
                <HoursList rows={hoursRows} />
              </section>
            </>
          )}

          {/* ============ UPCOMING ============ */}
          {heroEvents.length > 0 && (
            <>
              <BrassDivider />
              <section className="px-5">
                <SectionLabel
                  label="Upcoming"
                  action={
                    heroEvents.length > 3 ? (
                      <button
                        type="button"
                        onClick={() => navigate('/calendar')}
                        className="inline-flex items-center gap-1 text-xs"
                        style={{
                          color: 'hsl(var(--venue-ember))',
                          fontWeight: 500,
                        }}
                      >
                        See all
                        <ArrowRight className="w-3 h-3" strokeWidth={1.6} />
                      </button>
                    ) : undefined
                  }
                />
                <div className="grid grid-cols-3 gap-2">
                  {heroEvents.slice(0, 6).map((ev) => (
                    <EventTile
                      key={ev.occurrence_id}
                      ev={ev}
                      isRecurring={recurringEventIds.has(ev.event_id)}
                    />
                  ))}
                </div>
              </section>
            </>
          )}

          {/* ============ PARKING ============ */}
          {hasParking && (
            <>
              <BrassDivider />
              <section className="px-5">
                <SectionLabel label="Parking" />
                <div
                  className="p-3.5 px-4"
                  style={{
                    background: 'hsl(var(--venue-surface))',
                    border: '1px solid hsl(var(--venue-line))',
                    borderRadius: '12px',
                  }}
                >
                  {parkingBullets.length > 0 ? (
                    parkingBullets.map((b, i) => (
                      <p
                        key={i}
                        className="pl-2.5"
                        style={{
                          fontSize: '12.5px',
                          lineHeight: 1.55,
                          color: 'hsl(var(--venue-cream-mut))',
                          borderLeft:
                            '1px solid hsl(var(--venue-brass))',
                          marginBottom:
                            i < parkingBullets.length - 1 ? '6px' : 0,
                        }}
                      >
                        {b}
                      </p>
                    ))
                  ) : (
                    <p
                      style={{
                        fontSize: '12.5px',
                        color: 'hsl(var(--venue-cream-mut))',
                      }}
                    >
                      {parkingJson?.parking_available
                        ? 'Parking available nearby.'
                        : 'No parking nearby.'}
                    </p>
                  )}
                </div>
              </section>
            </>
          )}

          {/* ============ HOUSE RULES ============ */}
          {rulesArr.length > 0 && (
            <>
              <BrassDivider />
              <section className="px-5">
                <SectionLabel label="House rules" />
                <div
                  className="p-3.5 px-4"
                  style={{
                    background: 'hsl(var(--venue-surface))',
                    border: '1px solid hsl(var(--venue-line))',
                    borderRadius: '12px',
                  }}
                >
                  {rulesArr.map((rule, i) => (
                    <div
                      key={i}
                      className="flex gap-2.5 items-start py-1.5"
                      style={{
                        fontSize: '12.5px',
                        color: 'hsl(var(--venue-cream-mut))',
                        lineHeight: 1.45,
                      }}
                    >
                      <span
                        className="shrink-0 inline-block w-1 h-1 rounded-full mt-2"
                        style={{ background: 'hsl(var(--venue-brass))' }}
                      />
                      <span>{rule}</span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* ============ FAQ ============ */}
          {faqItems.length > 0 && (
            <>
              <BrassDivider />
              <section className="px-5">
                <SectionLabel label="Common questions" />
                <FAQList items={faqItems} />
              </section>
            </>
          )}

          {/* ============ THE ROOM (about) ============ */}
          {venue.description && (
            <>
              <BrassDivider />
              <section className="px-5">
                <SectionLabel label="The room" />
                <SectionHeadline>A studio in the arches.</SectionHeadline>
                <p
                  style={{
                    fontSize: '13.5px',
                    lineHeight: 1.6,
                    color: 'hsl(var(--venue-cream-mut))',
                  }}
                >
                  {venue.description}
                </p>
              </section>
            </>
          )}

          {/* ============ INSIDE (gallery) ============ */}
          {heroImages.length > 0 && (
            <>
              <BrassDivider />
              <section className="px-5">
                <SectionLabel label="Inside" />
                <div className="grid grid-cols-3 gap-1.5">
                  {heroImages.slice(0, 6).map((src, idx) => (
                    <div
                      key={src + idx}
                      className="relative overflow-hidden"
                      style={{
                        aspectRatio: '1 / 1',
                        borderRadius: '6px',
                      }}
                    >
                      <img
                        src={src}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {idx === 5 && heroImages.length > 6 && (
                        <span
                          className="absolute inset-0 flex items-center justify-center"
                          style={{
                            background: 'hsla(var(--venue-bg)/.5)',
                            backdropFilter: 'blur(2px)',
                            fontFamily: SERIF,
                            fontStyle: 'italic',
                            fontSize: '17px',
                            color: 'hsl(var(--venue-cream))',
                          }}
                        >
                          + {heroImages.length - 6}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* ============ FOOT ============ */}
          <div className="text-center pt-6 pb-8 px-5">
            <span
              style={{
                fontFamily: SERIF,
                fontStyle: 'italic',
                fontSize: '20px',
                color: 'hsl(var(--venue-brass))',
                opacity: 0.6,
                lineHeight: 1,
              }}
            >
              &para;
            </span>
            <div
              className="mt-2"
              style={{
                fontFamily: MONO,
                fontSize: '9px',
                letterSpacing: '.32em',
                textTransform: 'uppercase',
                color: 'hsla(var(--venue-cream-mut)/.5)',
              }}
            >
              End of listing
            </div>
          </div>
        </div>
      </div>
    </GlobalLayout>
  );
};

export default VenueEntity;
