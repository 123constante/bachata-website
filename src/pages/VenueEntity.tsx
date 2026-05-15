import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ComponentType,
  type ReactNode,
  type RefObject,
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
  Clock,
  Train,
  Share2,
  Play,
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
  Volume2,
  Shirt,
  Accessibility,
  Footprints,
  Wine,
  MapPin,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { fetchPublicVenue } from '@/services/venuePublicService';
import { buildVenueJsonLd } from '@/lib/buildVenueJsonLd';
import { computeVenueOpenStatus } from '@/lib/venueOpenStatus';
import { resolveTubeLine } from '@/lib/tubeLineColour';
import { parseVenueVideoUrl } from '@/lib/parseVenueVideoUrl';

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
// Pulse theme tokens
// ============================================================
const PULSE_VARS: CSSProperties = {
  ['--bg' as string]: '#0a0c0d',
  ['--bg-2' as string]: '#11151a',
  ['--surface' as string]: 'rgba(255,255,255,0.03)',
  ['--surface-2' as string]: 'rgba(255,255,255,0.05)',
  ['--border' as string]: 'rgba(255,255,255,0.08)',
  ['--border-hi' as string]: 'rgba(16,185,129,0.45)',
  ['--text' as string]: '#ECEFEC',
  ['--text-2' as string]: '#9FA8A2',
  ['--text-3' as string]: '#5F6864',
  ['--accent' as string]: '#10b981',
  ['--accent-2' as string]: '#34d399',
  ['--accent-soft' as string]: 'rgba(16,185,129,0.16)',
  ['--glow' as string]:
    'radial-gradient(50% 40% at 50% 5%, rgba(16,185,129,0.20), transparent 70%)',
  ['--spot' as string]: 'rgba(140,255,200,0.16)',
  ['--radius' as string]: '10px',
  ['--card-bg' as string]:
    'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012))',
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

// ============================================================
// Facility icon map (lucide, thin stroke)
// ============================================================
const facIcon = (
  Icon: ComponentType<{ className?: string; strokeWidth?: number }>,
) => <Icon className="w-4 h-4" strokeWidth={1.4} />;

const FACILITY_ICONS: Record<string, ReactNode> = {
  mirrors: facIcon(Sparkles),
  sound_system: facIcon(Volume2),
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
  sound_system: 'Sound system',
  changing_area: 'Changing area',
  wifi: 'Wi-Fi',
  wheelchair_access: 'Step-free entry',
  air_conditioning: 'Air conditioning',
  drinking_water: 'Drinking water',
  bottle_refill: 'Bottle refill',
  lockers: 'Lockers',
  kitchen: 'Kitchen',
  snacks_available: 'Snacks',
  free_parking: 'Free parking',
  late_train_friendly: 'Late train friendly',
  stage: 'Stage',
  outdoor_space: 'Outdoor space',
};

const humaniseKey = (k: string) =>
  k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// ============================================================
// Cursor spotlight hook
// ============================================================
function useCursor(ref: RefObject<HTMLDivElement>, key: string) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      el.style.setProperty('--mx', x.toFixed(3));
      el.style.setProperty('--my', y.toFixed(3));
      el.style.setProperty('--mxp', (x * 100).toFixed(1) + '%');
      el.style.setProperty('--myp', (y * 100).toFixed(1) + '%');
    };
    const onLeave = () => {
      el.style.setProperty('--mx', '0.5');
      el.style.setProperty('--my', '0.2');
      el.style.setProperty('--mxp', '50%');
      el.style.setProperty('--myp', '20%');
    };
    onLeave();
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [ref, key]);
}

// ============================================================
// Striped placeholder for missing images
// ============================================================
function Placeholder({
  label,
  className = '',
  aspect,
  children,
}: {
  label?: string;
  className?: string;
  aspect?: string;
  children?: ReactNode;
}) {
  const style: CSSProperties = {
    backgroundImage:
      'repeating-linear-gradient(135deg, #10151a 0 16px, #161e22 16px 32px, #1d272c 32px 48px)',
    aspectRatio: aspect,
  };
  return (
    <div className={`relative overflow-hidden ${className}`} style={style}>
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.0) 30%, rgba(0,0,0,0.55) 100%)',
        }}
      />
      {label && (
        <div
          className="absolute left-2 bottom-2 text-[10px] uppercase tracking-[0.18em]"
          style={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            color: 'rgba(255,255,255,0.55)',
          }}
        >
          {label}
        </div>
      )}
      {children}
    </div>
  );
}

// ============================================================
// Card (shimmer top edge)
// ============================================================
function Card({
  className = '',
  style: extraStyle = {},
  children,
  highlight = true,
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`relative ${className}`}
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        boxShadow:
          '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 30px rgba(0,0,0,0.35)',
        ...extraStyle,
      }}
    >
      {highlight && (
        <span
          aria-hidden
          className="absolute inset-x-3 top-0 h-px pointer-events-none"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)',
          }}
        />
      )}
      {children}
    </div>
  );
}

function PrimaryButton({
  children,
  className = '',
  onClick,
  type = 'button',
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`relative inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-transform active:scale-[0.98] ${className}`}
      style={{
        background: 'var(--accent)',
        color: '#0a0a0a',
        boxShadow:
          '0 0 0 1px rgba(255,255,255,0.10), 0 8px 24px var(--accent-soft), 0 0 28px var(--accent-soft)',
      }}
    >
      {children}
    </button>
  );
}

function GhostButton({
  children,
  className = '',
  onClick,
  as,
  href,
  target,
  rel,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  as?: 'a';
  href?: string;
  target?: string;
  rel?: string;
}) {
  const styles: CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border-hi)',
    color: 'var(--text)',
    textDecoration: 'none',
  };
  const cls = `inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm transition-colors ${className}`;
  if (as === 'a') {
    return (
      <a href={href} target={target} rel={rel} className={cls} style={styles}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls} style={styles}>
      {children}
    </button>
  );
}

function IconBtn({ children, label, onClick }: { children: ReactNode; label: string; onClick?: () => void }) {
  return (
    <button
      aria-label={label}
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center rounded-full transition-colors select-none active:scale-[0.97] w-9 h-9"
      style={{
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(10px)',
        border: '1px solid var(--border-hi)',
        color: 'var(--text)',
      }}
    >
      {children}
    </button>
  );
}

// ============================================================
// Section header
// ============================================================
function SectionHeader({
  children,
  action,
  onAction,
}: {
  children: ReactNode;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-baseline justify-between mb-3 relative">
      <div className="relative inline-flex items-center gap-2">
        <span
          className="text-[10px] uppercase tracking-[0.22em] relative"
          style={{
            color: 'var(--text-3)',
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          }}
        >
          —
        </span>
        <h2
          className="text-[15px] font-medium tracking-tight relative"
          style={{ color: 'var(--text)' }}
        >
          {children}
        </h2>
      </div>
      {action && (
        <button
          type="button"
          onClick={onAction}
          className="text-xs inline-flex items-center gap-1 transition-colors"
          style={{ color: 'var(--accent)' }}
        >
          {action}
          <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.4} />
        </button>
      )}
    </div>
  );
}

// ============================================================
// Status badge
// ============================================================
function StatusBadge({ label, isOpen }: { label: string; isOpen: boolean }) {
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
      style={{
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(10px)',
        border: '1px solid var(--border-hi)',
        color: 'var(--text)',
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{
          background: isOpen ? '#34d399' : 'var(--accent)',
          boxShadow: '0 0 8px var(--accent)',
        }}
      />
      <span style={{ fontWeight: 500 }}>{label}</span>
    </div>
  );
}

// ============================================================
// Hero â€” cycling cover + parallax + spotlight
// ============================================================
function Hero({
  images,
  height,
  rounded,
  venueName,
}: {
  images: string[];
  height: string;
  rounded: boolean;
  venueName: string;
}) {
  const [i, setI] = useState(0);
  const hasImages = images.length > 0;
  const count = hasImages ? images.length : 1;
  useEffect(() => {
    if (count <= 1) return;
    const t = window.setInterval(() => setI((v) => (v + 1) % count), 4500);
    return () => window.clearInterval(t);
  }, [count]);

  return (
    <div
      className="relative overflow-hidden"
      style={{ height, borderRadius: rounded ? 'var(--radius)' : 0 }}
    >
      {/* Parallax wrapper */}
      <div
        className="absolute"
        style={{
          inset: '-6%',
          transform:
            'translate3d(calc((var(--mx, .5) - .5) * -20px), calc((var(--my, .2) - .2) * -16px), 0) scale(1.06)',
          transition: 'transform 240ms cubic-bezier(.2,.7,.2,1)',
        }}
      >
        {hasImages ? (
          images.map((src, idx) => (
            <div
              key={src + idx}
              className="absolute inset-0 transition-opacity duration-1000"
              style={{ opacity: idx === i ? 1 : 0 }}
            >
              <img
                src={src}
                alt={idx === 0 ? venueName : ''}
                className="w-full h-full object-cover"
                loading={idx === 0 ? 'eager' : 'lazy'}
              />
            </div>
          ))
        ) : (
          <Placeholder className="w-full h-full" label={venueName} />
        )}
      </div>

      {/* Themed hero glow */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'var(--glow)', mixBlendMode: 'screen' }}
      />

      {/* Cursor spotlight inside hero */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(360px circle at var(--mxp, 50%) var(--myp, 30%), var(--spot), transparent 60%)',
          mixBlendMode: 'screen',
        }}
      />

      {/* Bottom vignette */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, transparent 55%, var(--bg) 100%)',
        }}
      />

      {/* Counter chip */}
      {count > 1 && (
        <>
          <div
            className="absolute bottom-3 right-3 z-10 text-[10px] px-2 py-1 rounded uppercase tracking-[0.18em]"
            style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              background: 'rgba(0,0,0,0.55)',
              color: 'rgba(255,255,255,0.8)',
              backdropFilter: 'blur(8px)',
            }}
          >
            {String(i + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
          </div>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex gap-1.5">
            {Array.from({ length: count }).map((_, idx) => (
              <button
                type="button"
                key={idx}
                onClick={() => setI(idx)}
                aria-label={`Show image ${idx + 1}`}
                className="h-1 rounded-full transition-all"
                style={{
                  width: idx === i ? 24 : 6,
                  background:
                    idx === i ? 'var(--text)' : 'rgba(255,255,255,0.4)',
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// Hours list
// ============================================================
function HoursList({
  rows,
}: {
  rows: { day: string; display: string; isToday: boolean }[];
}) {
  return (
    <ul className="text-sm">
      {rows.map((row, i) => {
        const muted = row.display.toLowerCase() === 'closed';
        return (
          <li
            key={row.day}
            className="flex items-center justify-between py-1.5"
            style={{
              color: row.isToday
                ? 'var(--text)'
                : muted
                ? 'var(--text-3)'
                : 'var(--text-2)',
              borderTop: i === 0 ? 'none' : '1px solid var(--border)',
            }}
          >
            <span className="flex items-center gap-2">
              {row.day}
              {row.isToday && (
                <span
                  className="text-[10px] uppercase tracking-[0.18em]"
                  style={{
                    color: 'var(--accent)',
                    fontFamily:
                      "'JetBrains Mono', ui-monospace, monospace",
                  }}
                >
                  Today
                </span>
              )}
            </span>
            <span style={{ fontWeight: row.isToday ? 500 : 400 }}>
              {row.display}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ============================================================
// Video tile
// ============================================================
function VideoTile({
  url,
  className = '',
}: {
  url: string;
  className?: string;
}) {
  const label = url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
  const parsed = parseVenueVideoUrl(url);
  const thumbUrl = parsed?.kind === 'youtube'
    ? `https://img.youtube.com/vi/${parsed.videoId}/hqdefault.jpg`
    : null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group relative overflow-hidden block ${className}`}
      style={{ borderRadius: 'var(--radius)' }}
    >
      {thumbUrl ? (
        <div style={{ aspectRatio: '16/10' }}>
          <img src={thumbUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
        </div>
      ) : (
        <Placeholder aspect="16/10" />
      )}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to top, rgba(0,0,0,0.78), rgba(0,0,0,0.08))',
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
          style={{
            background: 'var(--accent)',
            color: '#000',
            boxShadow: '0 8px 28px var(--accent-soft)',
          }}
        >
          <Play className="w-4 h-4" strokeWidth={1.6} fill="currentColor" />
        </div>
      </div>
      <div className="absolute left-2.5 bottom-2 right-2.5 flex items-end justify-between gap-2">
        <span
          className="text-sm font-medium drop-shadow truncate"
          style={{ color: 'var(--text)' }}
        >
          {label}
        </span>
      </div>
    </a>
  );
}

// ============================================================
// FAQ
// ============================================================
function FAQList({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState(0);
  return (
    <div>
      {items.map((f, i) => (
        <div key={i} style={{ borderBottom: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={() => setOpen(open === i ? -1 : i)}
            className="w-full flex items-start justify-between gap-3 py-3 text-left transition-colors"
          >
            <span
              className="text-sm font-medium"
              style={{ color: 'var(--text)' }}
            >
              {f.q}
            </span>
            <span
              className="mt-0.5 shrink-0 transition-transform"
              style={{
                color: open === i ? 'var(--accent)' : 'var(--text-2)',
                transform: open === i ? 'rotate(180deg)' : 'none',
              }}
            >
              <ChevronDown className="w-4 h-4" strokeWidth={1.4} />
            </span>
          </button>
          <div
            className="grid transition-all duration-300 ease-out"
            style={{ gridTemplateRows: open === i ? '1fr' : '0fr' }}
          >
            <div className="overflow-hidden">
              <p
                className="text-sm pb-3 pr-6 leading-relaxed"
                style={{ color: 'var(--text-2)' }}
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
// Nearest station (TfL-style legend)
// ============================================================
function NearestStation({
  stationName,
  lineNames,
  walkMin,
  notes,
}: {
  stationName: string;
  lineNames: string[];
  walkMin: number | null;
  notes: string | null;
}) {
  const [active, setActive] = useState<string | null>(null);
  const lines = lineNames.map((n) => ({ raw: n, tfl: resolveTubeLine(n) }));
  const activeLine = active ? lines.find((l) => l.raw === active) : null;

  return (
    <Card>
      <div className="p-4">
        <div
          className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] font-medium mb-4"
          style={{
            color: 'var(--text-3)',
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          }}
        >
          <span style={{ color: 'var(--accent)' }}>
            <Train className="w-4 h-4" strokeWidth={1.4} />
          </span>
          <span>Nearest station</span>
        </div>

        {/* Route ribbon */}
        {walkMin != null && (
          <div className="flex items-start gap-2 mb-4 px-1">
            <div className="flex flex-col items-center shrink-0 w-10">
              <span
                className="w-3 h-3 rounded-full mt-1"
                style={{
                  background: 'var(--accent)',
                  boxShadow: '0 0 0 4px var(--accent-soft)',
                }}
              />
              <span
                className="text-[9px] mt-1.5 uppercase tracking-[0.18em]"
                style={{
                  color: 'var(--text-3)',
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                }}
              >
                Venue
              </span>
            </div>
            <div className="flex-1 flex items-center mt-[6px] min-w-0">
              <div
                className="flex-1 h-0"
                style={{ borderTop: '1px dashed var(--border-hi)' }}
              />
              <span
                className="text-[10px] uppercase tracking-[0.18em] px-2 py-0.5 rounded-full inline-flex items-center gap-1 whitespace-nowrap"
                style={{
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  color: 'var(--accent)',
                  background: 'var(--accent-soft)',
                  border: '1px solid var(--border-hi)',
                }}
              >
                <Footprints className="w-3.5 h-3.5" strokeWidth={1.4} />
                {walkMin} min
              </span>
              <div
                className="flex-1 h-0"
                style={{ borderTop: '1px dashed var(--border-hi)' }}
              />
            </div>
            <div className="flex flex-col items-center shrink-0 w-10">
              <span
                className="w-3 h-3 rounded-full mt-1"
                style={{
                  background: 'var(--text)',
                  boxShadow: '0 0 0 4px rgba(255,255,255,0.10)',
                }}
              />
              <span
                className="text-[9px] mt-1.5 uppercase tracking-[0.18em]"
                style={{
                  color: 'var(--text-3)',
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                }}
              >
                Station
              </span>
            </div>
          </div>
        )}

        {/* Station plate */}
        <div
          className="relative overflow-hidden p-4"
          style={{
            background:
              'linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.25))',
            border: '1px solid var(--border)',
            borderRadius: 'calc(var(--radius) - 2px)',
          }}
        >
          <div
            className="absolute inset-0 opacity-50 pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)',
              backgroundSize: '5px 5px',
            }}
          />

          <div className="relative">
            {lines.length > 0 && (
              <div className="flex flex-col gap-1 mb-4">
                {lines.map((l) => {
                  const isActive = active === l.raw;
                  return (
                    <button
                      key={l.raw}
                      type="button"
                      onClick={() => setActive(isActive ? null : l.raw)}
                      className="group w-full text-left flex items-center gap-3 px-2 py-2 rounded-md transition-colors"
                      style={{
                        background: isActive
                          ? 'rgba(255,255,255,0.08)'
                          : 'transparent',
                      }}
                    >
                      <span
                        className="block h-2.5 rounded-full shrink-0 transition-all duration-200"
                        style={{
                          width: isActive ? 80 : 64,
                          background: l.tfl.bg,
                          boxShadow: isActive
                            ? `0 0 14px ${l.tfl.bg}66, inset 0 -1px 0 rgba(0,0,0,0.25)`
                            : 'inset 0 -1px 0 rgba(0,0,0,0.25)',
                        }}
                      />
                      <span
                        className="flex-1 text-base font-semibold tracking-tight"
                        style={{ color: 'var(--text)' }}
                      >
                        {l.tfl.name || l.raw}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <h3
              className="text-2xl font-bold leading-tight tracking-tight"
              style={{ color: 'var(--text)' }}
            >
              {stationName}
            </h3>
            <p
              className="text-[11px] mt-1.5 uppercase tracking-[0.18em] min-h-[14px]"
              style={{
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                color: 'var(--text-2)',
              }}
            >
              {activeLine ? (
                <span className="inline-flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-block w-3 h-1.5 rounded-full"
                      style={{ background: activeLine.tfl.bg }}
                    />
                    <span style={{ color: 'var(--accent)' }}>
                      {activeLine.tfl.name || activeLine.raw}
                    </span>
                  </span>
                </span>
              ) : (
                <span>
                  {lines.length} {lines.length === 1 ? 'line' : 'lines'}
                  {walkMin != null && (
                    <span style={{ color: 'var(--text-3)' }}>
                      {' '}
                      · {walkMin} min walk
                    </span>
                  )}
                </span>
              )}
            </p>
          </div>
        </div>

        {notes && (
          <p
            className="text-xs leading-relaxed mt-3"
            style={{ color: 'var(--text-2)' }}
          >
            {notes}
          </p>
        )}
      </div>
    </Card>
  );
}

// ============================================================
// Event card â€” horizontal (desktop grid) and row (mobile list)
// ============================================================
function EventCardTile({ ev, isRecurring }: { ev: VenueOccurrenceRow; isRecurring?: boolean }) {
  const start = new Date(ev.instance_start);
  const dayLabel = format(start, 'EEE');
  const dateLabel = format(start, 'd MMM');
  const timeLabel = format(start, 'HH:mm');
  return (
    <Link
      to={`/event/${ev.event_id}?occurrenceId=${ev.occurrence_id}`}
      className="group relative overflow-hidden cursor-pointer transition-all block"
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        textDecoration: 'none',
      }}
    >
      <div className="relative">
        {ev.poster_url ? (
          <div style={{ aspectRatio: '16/9' }}>
            <img
              src={ev.poster_url}
              alt={ev.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        ) : (
          <Placeholder aspect="16/9" />
        )}
        <div
          className="absolute inset-x-0 bottom-0 h-1/2"
          style={{
            background:
              'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
          }}
        />
        <div
          className="absolute left-3 top-3 flex flex-col items-center justify-center w-10 h-12 rounded-md text-center"
          style={{
            background: 'rgba(0,0,0,0.78)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--border-hi)',
          }}
        >
          <span
            className="text-[9px] uppercase tracking-[0.18em] font-semibold"
            style={{
              color: 'var(--accent)',
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            }}
          >
            {dayLabel}
          </span>
          <span
            className="text-sm font-semibold leading-none mt-0.5"
            style={{ color: 'var(--text)' }}
          >
            {format(start, 'd')}
          </span>
        </div>
      </div>
      <div className="p-3">
        <div
          className="text-xs mb-1"
          style={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            color: 'var(--text-3)',
          }}
        >
          {dateLabel} · {timeLabel}
        </div>
        <h3
          className="text-sm font-medium leading-snug line-clamp-2 mb-1"
          style={{ color: 'var(--text)' }}
        >
          {ev.name}
        </h3>
        <div className="flex items-center justify-between mt-2">
          <span
            className="text-xs"
            style={{ color: 'var(--text-2)' }}
          >
            {countdown(ev.instance_start)}
          </span>
          <span
            className="text-xs inline-flex items-center gap-1"
            style={{ color: 'var(--accent)' }}
          >
            Tickets <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.4} />
          </span>
        </div>
        {isRecurring && (
          <span
            className="text-[9px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded mt-1 inline-block"
            style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--accent-2)', border: '1px solid rgba(16,185,129,0.28)' }}
          >
            Recurring
          </span>
        )}
      </div>
      <span
        aria-hidden
        className="absolute inset-x-3 top-0 h-px pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)',
        }}
      />
    </Link>
  );
}

function EventCardRow({ ev, isRecurring }: { ev: VenueOccurrenceRow; isRecurring?: boolean }) {
  const start = new Date(ev.instance_start);
  return (
    <Link
      to={`/event/${ev.event_id}?occurrenceId=${ev.occurrence_id}`}
      className="group flex gap-3 py-3 cursor-pointer"
      style={{
        borderBottom: '1px solid var(--border)',
        textDecoration: 'none',
      }}
    >
      <div
        className="relative w-16 h-16 overflow-hidden shrink-0"
        style={{ borderRadius: 'var(--radius)' }}
      >
        {ev.poster_url ? (
          <img
            src={ev.poster_url}
            alt={ev.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <Placeholder className="w-full h-full" />
        )}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.55)' }}
        >
          <span
            className="text-[9px] uppercase tracking-[0.18em] font-semibold"
            style={{
              color: 'var(--accent)',
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            }}
          >
            {format(start, 'EEE')}
          </span>
          <span
            className="text-base font-semibold leading-none"
            style={{ color: 'var(--text)' }}
          >
            {format(start, 'd')}
          </span>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <span
            className="text-[11px]"
            style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              color: 'var(--text-3)',
            }}
          >
            {format(start, 'HH:mm')}
          </span>
          <span
            className="text-[10px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded font-medium"
            style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              background: 'rgba(52,211,153,0.10)',
              color: '#6ee7b7',
              border: '1px solid rgba(52,211,153,0.32)',
            }}
          >
            {countdown(ev.instance_start)}
          </span>
        </div>
        <h3
          className="text-sm font-medium leading-snug line-clamp-2"
          style={{ color: 'var(--text)' }}
        >
          {ev.name}
        </h3>
        {isRecurring && (
          <span
            className="text-[9px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded mt-1 inline-block"
            style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--accent-2)', border: '1px solid rgba(16,185,129,0.28)' }}
          >
            Recurring
          </span>
        )}
      </div>
    </Link>
  );
}

// ============================================================
// Facility row
// ============================================================
function FacilityRow({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <div
      className="flex items-center gap-2.5 py-2 text-sm"
      style={{ color: 'var(--text)' }}
    >
      <span style={{ color: 'var(--accent)' }} className="shrink-0">
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </div>
  );
}

// ============================================================
// Ambient cursor spotlight (whole-page faint)
// ============================================================
function AmbientBg() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none"
      style={{
        background:
          'radial-gradient(600px circle at var(--mxp, 50%) var(--myp, 20%), var(--spot), transparent 60%)',
        mixBlendMode: 'screen',
      }}
    />
  );
}

// ============================================================
// Main page
// ============================================================
const VenueEntity = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const rootRef = useRef<HTMLDivElement>(null);

  const fromEventId = parseFromEventParam(location.search);
  const fromOccurrenceId = new URLSearchParams(location.search).get('occ') ?? null;

  const { data: venue, isLoading } = useQuery({
    queryKey: ['public-venue', id],
    queryFn: () => fetchPublicVenue(id!),
    enabled: !!id,
  });

  const { data: events } = useQuery({
    queryKey: ['venue-upcoming-events', id, fromEventId, fromOccurrenceId],
    queryFn: async () => {
      const now = new Date().toISOString();
      const sixtyDaysLater = new Date(Date.now() + 60 * 86400000).toISOString();
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

  const venueBreadcrumbs = buildBreadcrumbs('venue.detail', {
    entityName: venue?.name,
    isLoading,
  });
  const backHref = fromEventId ? '/event/' + fromEventId : '/venues';
  // Re-bind cursor listeners when the render branch swaps (loading -> venue -> notfound).
  const cursorKey = isLoading ? 'loading' : venue ? 'venue' : 'notfound';
  useCursor(rootRef, cursorKey);

  // ----------------------------------------------------------
  // Loading
  // ----------------------------------------------------------
  if (isLoading) {
    return (
      <GlobalLayout breadcrumbs={venueBreadcrumbs} backHref={backHref} showSubheader={false}>
        <div
          ref={rootRef}
          className="relative antialiased min-h-screen"
          style={{
            ...PULSE_VARS,
            background: 'var(--bg)',
            color: 'var(--text)',
            fontFamily: "'Geist', 'Inter', system-ui, sans-serif",
          }}
        >
          <AmbientBg />
          <div className="px-4 pt-4">
            <Skeleton
              className="w-full rounded-md"
              style={{
                height: 260,
                background: 'rgba(255,255,255,0.04)',
              }}
            />
            <div className="mt-4 space-y-2">
              <Skeleton
                className="h-4 w-1/3"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              />
              <Skeleton
                className="h-7 w-2/3"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              />
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
      <GlobalLayout breadcrumbs={venueBreadcrumbs} backHref={backHref} showSubheader={false}>
        <div
          className="relative antialiased min-h-screen flex flex-col items-center justify-center p-6"
          style={{
            ...PULSE_VARS,
            background: 'var(--bg)',
            color: 'var(--text)',
            fontFamily: "'Geist', 'Inter', system-ui, sans-serif",
          }}
        >
          <p
            className="text-sm mb-4"
            style={{ color: 'var(--text-2)' }}
          >
            This venue doesn't exist or has been removed.
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
      ? 'https://www.google.com/maps/search/?api=1&query=' +
        encodeURIComponent(
          [venue.name, addressLine, venue.city_name].filter(Boolean).join(', '),
        )
      : null);

  // Cover images: dedupe image_url[] + gallery_urls, cap at 6
  const heroImagesRaw = [
    ...(Array.isArray(venue.image_url) ? venue.image_url : []),
    ...(parseStrArray(venue.gallery_urls) ?? []),
  ].filter((u): u is string => typeof u === 'string' && u.length > 0);
  const heroImages = Array.from(new Set(heroImagesRaw)).slice(0, 6);

  const openStatus = computeVenueOpenStatus(
    openingHours as Parameters<typeof computeVenueOpenStatus>[0],
    venue.timezone ?? null,
    new Date(),
  );
  const isVenueOpen =
    openStatus.status === 'open' || openStatus.status === 'closing-soon';
  const statusText = (() => {
    if (openStatus.status === 'open' || openStatus.status === 'closing-soon')
      return 'Open · until ' + openStatus.closesAt;
    if (openStatus.status === 'opens-soon')
      return 'Closed · opens ' + openStatus.opensAt;
    if (openStatus.status === 'closed') {
      if (
        openStatus.opensAt &&
        openStatus.opensDayLabel &&
        openStatus.opensDayLabel !== 'today'
      )
        return 'Closed · opens ' + openStatus.opensDayLabel;
      if (openStatus.opensAt) return 'Closed · opens ' + openStatus.opensAt;
      return 'Closed';
    }
    return null;
  })();

  // Facilities â€” list of { key, icon, label }
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
  if (venue.capacity != null) {
    facilities.push({
      key: 'capacity',
      icon: facIcon(Accessibility),
      label: `Capacity ${venue.capacity}`,
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

  // Hours rows in fixed Mon-first order. Today is highlighted, order never changes.
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
        else if (h.open && h.close) display = h.open + '–' + h.close;
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
    parkingJson?.parking_available !== null &&
      parkingJson?.parking_available !== undefined;

  const faqItems = Array.isArray(venue.faq_json)
    ? (venue.faq_json as unknown[]).filter(
        (item): item is FaqItem =>
          typeof item === 'object' && item !== null && 'q' in item && 'a' in item,
      )
    : [];

  const videoUrls = parseStrArray(venue.video_urls) ?? [];

  const rulesArr = Array.isArray(venue.rules)
    ? (venue.rules as string[]).filter(Boolean)
    : [];

  // Essentials (bachata-specific: water/food/late-night)
  type Essential = { key: string; label: string; text: string };
  const essentials: Essential[] = [];
  if (venue.water_situation)
    essentials.push({
      key: 'water',
      label: 'Water',
      text: venue.water_situation,
    });
  if (venue.food_situation)
    essentials.push({
      key: 'food',
      label: 'Food',
      text: venue.food_situation,
    });
  if (venue.late_night_notes)
    essentials.push({
      key: 'late',
      label: 'Late night',
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
      icon: <Phone className="w-3.5 h-3.5" strokeWidth={1.4} />,
    });
  }
  if (venue.email) {
    contactLinks.push({
      key: 'email',
      href: 'mailto:' + venue.email,
      label: venue.email,
      icon: <Mail className="w-3.5 h-3.5" strokeWidth={1.4} />,
    });
  }
  if (venue.website) {
    const display = venue.website.replace(/^https?:\/\//, '').replace(/\/$/, '');
    contactLinks.push({
      key: 'website',
      href: venue.website,
      label: display,
      icon: <Globe className="w-3.5 h-3.5" strokeWidth={1.4} />,
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
      icon: <Instagram className="w-3.5 h-3.5" strokeWidth={1.4} />,
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
      icon: <Facebook className="w-3.5 h-3.5" strokeWidth={1.4} />,
    });
  }

  const eventList = Array.isArray(events) ? events : [];
  const nextEvent = eventList[0] ?? null;
  const mobileEvents = eventList.slice(0, 4);

  const eventIdCounts = new Map<string, number>();
  eventList.forEach(ev => eventIdCounts.set(ev.event_id, (eventIdCounts.get(ev.event_id) ?? 0) + 1));
  const recurringEventIds = new Set([...eventIdCounts.entries()].filter(([, c]) => c > 1).map(([id]) => id));

  const heroEyebrow = (() => {
    const postcodeDistrict = venue.postcode
      ? venue.postcode.split(' ')[0]
      : null;
    const parts = [postcodeDistrict, venue.city_name].filter(Boolean);
    return parts.join(' · ').toUpperCase();
  })();

  const tagline = (() => {
    if (facilities.length === 0) return null;
    const top = facilities.slice(0, 3).map((f) => f.label);
    return top.join(' · ');
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
    <GlobalLayout breadcrumbs={venueBreadcrumbs} backHref={backHref} showSubheader={false}>
      <div
        ref={rootRef}
        className="relative antialiased overflow-hidden"
        style={{
          ...PULSE_VARS,
          background: 'var(--bg)',
          color: 'var(--text)',
          fontFamily: "'Geist', 'Inter', system-ui, sans-serif",
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
                url: typeof window !== 'undefined' ? window.location.href : '',
                opening_hours: openingHours as Parameters<
                  typeof buildVenueJsonLd
                >[0]['opening_hours'],
              }),
            ),
          }}
        />

        <AmbientBg />

        {/* ============ MOBILE LAYOUT (â‰¤ md) ============ */}
        <div className="md:hidden">
          {/* Hero */}
          <div className="relative">
            <Hero
              images={heroImages}
              height="260px"
              rounded={false}
              venueName={venue.name}
            />
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-20">
              <IconBtn label="Back">
                <Link
                  to={backHref}
                  className="w-full h-full flex items-center justify-center"
                  style={{ color: 'var(--text)' }}
                >
                  <ChevronLeft className="w-4 h-4" strokeWidth={1.4} />
                </Link>
              </IconBtn>
              <div className="flex gap-1.5">
                <IconBtn label="Share" onClick={handleShare}>
                  <Share2 className="w-4 h-4" strokeWidth={1.4} />
                </IconBtn>
              </div>
            </div>
            {statusText && (
              <div className="absolute bottom-12 left-3 z-20">
                <StatusBadge label={statusText} isOpen={isVenueOpen} />
              </div>
            )}
          </div>

          {/* Title block */}
          <div className="px-4 pt-4 relative">
            {heroEyebrow && (
              <div
                className="text-[10px] uppercase tracking-[0.28em] mb-2"
                style={{
                  color: 'var(--text-3)',
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                }}
              >
                {heroEyebrow}
              </div>
            )}
            <h1
              className="text-[26px] font-semibold tracking-tight leading-tight"
              style={{ color: 'var(--text)' }}
            >
              {venue.name}
            </h1>
            {tagline && (
              <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>
                {tagline}
              </p>
            )}
            {addressLine && (
              <a
                href={mapsUrl ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 mt-3 text-sm"
                style={{ color: 'var(--accent)' }}
              >
                <MapPin className="w-3.5 h-3.5" strokeWidth={1.4} />
                <span
                  className="truncate"
                  style={{
                    textDecoration: 'underline',
                    textUnderlineOffset: 4,
                    textDecorationColor: 'var(--accent-soft)',
                  }}
                >
                  {addressLine}
                </span>
              </a>
            )}
            <div className="flex gap-2 mt-4">
              {mapsUrl ? (
                <GhostButton
                  as="a"
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="!rounded-full !py-2 !px-4 !text-sm flex-1 font-medium"
                >
                  <span style={{ color: 'var(--text)' }}>
                    Get directions
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.4} />
                </GhostButton>
              ) : null}
            </div>
          </div>

          {/* About */}
          {venue.description && (
            <section className="px-4 pt-6">
              <SectionHeader>About</SectionHeader>
              <p
                className="text-sm leading-relaxed"
                style={{ color: 'var(--text-2)' }}
              >
                {venue.description}
              </p>
            </section>
          )}

          {/* What's here */}
          {hasFacilities && (
            <section className="px-4 pt-6">
              <SectionHeader>What's here</SectionHeader>
              <Card className="px-3 py-1">
                <div className="grid grid-cols-2 gap-x-3">
                  {facilities.map((f) => (
                    <FacilityRow key={f.key} icon={f.icon} label={f.label} />
                  ))}
                </div>
              </Card>
            </section>
          )}

          {/* Practical info */}
          {(hasStation || hasHours || hasParking) && (
            <section className="px-4 pt-6">
              <SectionHeader>Practical info</SectionHeader>
              <div className="space-y-3">
                {hasStation && station && (
                  <NearestStation
                    stationName={station.station ?? ''}
                    lineNames={station.line_names ?? []}
                    walkMin={station.walking_distance_minutes ?? null}
                    notes={transportJson?.notes ?? null}
                  />
                )}
                {hasHours && (
                  <Card className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div
                        className="flex items-center gap-1.5 text-xs"
                        style={{
                          color: 'var(--text-3)',
                          fontFamily:
                            "'JetBrains Mono', ui-monospace, monospace",
                        }}
                      >
                        <span style={{ color: 'var(--accent)' }}>
                          <Clock
                            className="w-3.5 h-3.5"
                            strokeWidth={1.4}
                          />
                        </span>
                        HOURS
                      </div>
                      {venue.last_entry_time && (
                        <span
                          className="text-[10px] uppercase tracking-[0.18em] font-medium"
                          style={{
                            color: 'var(--accent)',
                            fontFamily:
                              "'JetBrains Mono', ui-monospace, monospace",
                          }}
                        >
                          Last entry{' '}
                          {venue.last_entry_time.match(/^(\d{2}:\d{2})/)?.[1] ??
                            venue.last_entry_time}
                        </span>
                      )}
                    </div>
                    <HoursList rows={hoursRows} />
                  </Card>
                )}
                {hasParking && (
                  <Card className="p-4">
                    <div
                      className="flex items-center gap-1.5 text-xs mb-2"
                      style={{
                        color: 'var(--text-3)',
                        fontFamily:
                          "'JetBrains Mono', ui-monospace, monospace",
                      }}
                    >
                      <span style={{ color: 'var(--accent)' }}>
                        <SquareParking
                          className="w-3.5 h-3.5"
                          strokeWidth={1.4}
                        />
                      </span>
                      PARKING
                    </div>
                    {parkingBullets.length > 0 ? (
                      <ul className="space-y-1.5">
                        {parkingBullets.map((b, i) => (
                          <li
                            key={i}
                            className="text-sm leading-relaxed flex gap-2"
                            style={{ color: 'var(--text-2)' }}
                          >
                            <span
                              style={{ color: 'var(--accent)' }}
                              className="shrink-0"
                            >
                              •
                            </span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p
                        className="text-sm leading-relaxed"
                        style={{ color: 'var(--text-2)' }}
                      >
                        {parkingJson?.parking_available
                          ? 'Parking available nearby.'
                          : 'No parking nearby.'}
                      </p>
                    )}
                  </Card>
                )}
              </div>
            </section>
          )}

          {/* Dancer essentials */}
          {essentials.length > 0 && (
            <section className="px-4 pt-6">
              <SectionHeader>Dancer essentials</SectionHeader>
              <Card className="p-4 space-y-3">
                {essentials.map((e) => (
                  <div key={e.key}>
                    <div
                      className="text-[10px] uppercase tracking-[0.18em] font-medium mb-1"
                      style={{
                        color: 'var(--accent)',
                        fontFamily:
                          "'JetBrains Mono', ui-monospace, monospace",
                      }}
                    >
                      {e.label}
                    </div>
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: 'var(--text-2)' }}
                    >
                      {e.text}
                    </p>
                  </div>
                ))}
              </Card>
            </section>
          )}

          {/* House rules */}
          {rulesArr.length > 0 && (
            <section className="px-4 pt-6">
              <SectionHeader>House rules</SectionHeader>
              <Card className="p-4">
                <ul className="space-y-1.5">
                  {rulesArr.map((rule, i) => (
                    <li
                      key={i}
                      className="text-sm leading-relaxed flex gap-2"
                      style={{ color: 'var(--text-2)' }}
                    >
                      <span
                        style={{ color: 'var(--accent)' }}
                        className="shrink-0"
                      >
                        •
                      </span>
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )}

          {/* Videos */}
          {videoUrls.length > 0 && (
            <section className="px-4 pt-6">
              <SectionHeader>Videos</SectionHeader>
              <div
                className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1"
                style={{ scrollbarWidth: 'none' }}
              >
                {videoUrls.map((url) => (
                  <VideoTile key={url} url={url} className="w-56 shrink-0" />
                ))}
              </div>
            </section>
          )}

          {/* FAQ */}
          {faqItems.length > 0 && (
            <section className="px-4 pt-6">
              <SectionHeader>FAQ</SectionHeader>
              <Card className="px-3">
                <FAQList items={faqItems} />
              </Card>
            </section>
          )}

          {/* Contact */}
          {contactLinks.length > 0 && (
            <section className="px-4 pt-6">
              <SectionHeader>Contact</SectionHeader>
              <Card className="p-4">
                <ul className="space-y-2">
                  {contactLinks.map((c) => (
                    <li
                      key={c.key}
                      className="flex items-center gap-2.5 text-sm"
                    >
                      <span
                        style={{ color: 'var(--accent)' }}
                        className="shrink-0"
                      >
                        {c.icon}
                      </span>
                      <a
                        href={c.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: 'var(--text-2)',
                          wordBreak: 'break-all',
                        }}
                      >
                        {c.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )}

          {/* Upcoming events */}
          <section className="px-4 pt-6 pb-6">
            <SectionHeader
              action={eventList.length > 4 ? 'See all' : undefined}
              onAction={
                eventList.length > 4
                  ? () => navigate('/calendar')
                  : undefined
              }
            >
              Upcoming events
            </SectionHeader>
            {mobileEvents.length === 0 ? (
              <Card className="p-4">
                <p
                  className="text-sm text-center"
                  style={{ color: 'var(--text-3)' }}
                >
                  No upcoming events yet.
                </p>
              </Card>
            ) : (
              <Card className="px-3">
                {mobileEvents.map((ev) => (
                  <EventCardRow key={ev.occurrence_id} ev={ev} isRecurring={recurringEventIds.has(ev.event_id)} />
                ))}
              </Card>
            )}
          </section>

          {/* Sticky CTA */}
          {nextEvent && (
            <div
              className="sticky bottom-0 p-3 flex items-center gap-2 relative z-30"
              style={{
                background:
                  'linear-gradient(180deg, transparent, var(--bg) 30%)',
                borderTop: '1px solid var(--border)',
              }}
            >
              <div
                className="absolute inset-0 -z-10"
                style={{
                  background: 'var(--bg)',
                  opacity: 0.85,
                  backdropFilter: 'blur(14px)',
                }}
              />
              <div className="flex-1 min-w-0">
                <div
                  className="text-[10px] uppercase tracking-[0.22em]"
                  style={{
                    color: 'var(--text-3)',
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  }}
                >
                  Next event · {countdown(nextEvent.instance_start)}
                </div>
                <div
                  className="text-sm font-medium truncate"
                  style={{ color: 'var(--text)' }}
                >
                  {nextEvent.name}
                </div>
              </div>
              <PrimaryButton
                onClick={() =>
                  navigate(
                    `/event/${nextEvent.event_id}?occurrenceId=${nextEvent.occurrence_id}`,
                  )
                }
              >
                Get tickets
              </PrimaryButton>
            </div>
          )}
        </div>

        {/* ============ DESKTOP LAYOUT (â‰¥ md) ============ */}
        <div className="hidden md:block">
          {/* Hero */}
          <div className="px-8 pt-5">
            <div className="relative">
              <Hero
                images={heroImages}
                height="440px"
                rounded
                venueName={venue.name}
              />
              <div className="absolute top-3 left-3 z-20">
                <IconBtn label="Back">
                  <Link
                    to={backHref}
                    className="w-full h-full flex items-center justify-center"
                    style={{ color: 'var(--text)' }}
                  >
                    <ChevronLeft className="w-4 h-4" strokeWidth={1.4} />
                  </Link>
                </IconBtn>
              </div>
            </div>
          </div>

          {/* Title strip */}
          <div
            className="px-8 pt-6 pb-5 flex items-end justify-between gap-6 relative"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <div>
              {statusText && (
                <div className="flex items-center gap-3 mb-2">
                  <StatusBadge label={statusText} isOpen={isVenueOpen} />
                </div>
              )}
              {heroEyebrow && (
                <div
                  className="text-[10px] uppercase tracking-[0.28em] mb-1"
                  style={{
                    color: 'var(--text-3)',
                    fontFamily:
                      "'JetBrains Mono', ui-monospace, monospace",
                  }}
                >
                  {heroEyebrow}
                </div>
              )}
              <h1
                className="text-[32px] font-semibold tracking-tight leading-tight"
                style={{ color: 'var(--text)' }}
              >
                {venue.name}
              </h1>
              {tagline && (
                <p
                  className="text-sm mt-1"
                  style={{ color: 'var(--text-2)' }}
                >
                  {tagline}
                </p>
              )}
              {addressLine && (
                <a
                  href={mapsUrl ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 mt-2 text-sm"
                  style={{ color: 'var(--accent)' }}
                >
                  <MapPin className="w-3.5 h-3.5" strokeWidth={1.4} />
                  <span
                    style={{
                      textDecoration: 'underline',
                      textUnderlineOffset: 4,
                      textDecorationColor: 'var(--accent-soft)',
                    }}
                  >
                    {addressLine}
                  </span>
                  {venue.city_name && (
                    <span style={{ color: 'var(--text-3)' }}>
                      · View on map
                    </span>
                  )}
                </a>
              )}
            </div>
            <div className="flex items-center gap-2">
              <GhostButton onClick={handleShare}>
                <Share2 className="w-4 h-4" strokeWidth={1.4} /> Share
              </GhostButton>
              {mapsUrl && (
                <PrimaryButton
                  onClick={() => {
                    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
                  }}
                >
                  Get directions
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.4} />
                </PrimaryButton>
              )}
            </div>
          </div>

          {/* Mosaic grid */}
          <div className="px-8 py-6 grid grid-cols-12 gap-5 relative">
            <div className="col-span-7 space-y-6">
              {venue.description && (
                <section>
                  <SectionHeader>About</SectionHeader>
                  <p
                    className="text-sm leading-relaxed max-w-prose"
                    style={{ color: 'var(--text-2)' }}
                  >
                    {venue.description}
                  </p>
                </section>
              )}

              {hasFacilities && (
                <section>
                  <SectionHeader>What's here</SectionHeader>
                  <Card className="px-4 py-2">
                    <div className="grid grid-cols-2 gap-x-6">
                      {facilities.map((f) => (
                        <FacilityRow
                          key={f.key}
                          icon={f.icon}
                          label={f.label}
                        />
                      ))}
                    </div>
                  </Card>
                </section>
              )}

              {(hasStation || hasHours || hasParking) && (
                <section>
                  <SectionHeader>Practical info</SectionHeader>
                  {hasStation && station && (
                    <NearestStation
                      stationName={station.station ?? ''}
                      lineNames={station.line_names ?? []}
                      walkMin={station.walking_distance_minutes ?? null}
                      notes={transportJson?.notes ?? null}
                    />
                  )}
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    {hasHours && (
                      <Card className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div
                            className="flex items-center gap-1.5 text-xs"
                            style={{
                              color: 'var(--text-3)',
                              fontFamily:
                                "'JetBrains Mono', ui-monospace, monospace",
                            }}
                          >
                            <span style={{ color: 'var(--accent)' }}>
                              <Clock
                                className="w-3.5 h-3.5"
                                strokeWidth={1.4}
                              />
                            </span>
                            HOURS
                          </div>
                          {venue.last_entry_time && (
                            <span
                              className="text-[10px] uppercase tracking-[0.18em] font-medium"
                              style={{
                                color: 'var(--accent)',
                                fontFamily:
                                  "'JetBrains Mono', ui-monospace, monospace",
                              }}
                            >
                              Last entry{' '}
                              {venue.last_entry_time.match(
                                /^(\d{2}:\d{2})/,
                              )?.[1] ?? venue.last_entry_time}
                            </span>
                          )}
                        </div>
                        <HoursList rows={hoursRows} />
                      </Card>
                    )}
                    {hasParking && (
                      <Card className="p-4">
                        <div
                          className="flex items-center gap-1.5 text-xs mb-2"
                          style={{
                            color: 'var(--text-3)',
                            fontFamily:
                              "'JetBrains Mono', ui-monospace, monospace",
                          }}
                        >
                          <span style={{ color: 'var(--accent)' }}>
                            <SquareParking
                              className="w-3.5 h-3.5"
                              strokeWidth={1.4}
                            />
                          </span>
                          PARKING
                        </div>
                        {parkingBullets.length > 0 ? (
                          <ul className="space-y-1.5">
                            {parkingBullets.map((b, i) => (
                              <li
                                key={i}
                                className="text-sm leading-relaxed flex gap-2"
                                style={{ color: 'var(--text-2)' }}
                              >
                                <span
                                  style={{ color: 'var(--accent)' }}
                                  className="shrink-0"
                                >
                                  •
                                </span>
                                <span>{b}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p
                            className="text-sm leading-relaxed"
                            style={{ color: 'var(--text-2)' }}
                          >
                            {parkingJson?.parking_available
                              ? 'Parking available nearby.'
                              : 'No parking nearby.'}
                          </p>
                        )}
                      </Card>
                    )}
                  </div>
                </section>
              )}

              {essentials.length > 0 && (
                <section>
                  <SectionHeader>Dancer essentials</SectionHeader>
                  <Card className="p-4 grid grid-cols-3 gap-4">
                    {essentials.map((e) => (
                      <div key={e.key}>
                        <div
                          className="text-[10px] uppercase tracking-[0.18em] font-medium mb-1"
                          style={{
                            color: 'var(--accent)',
                            fontFamily:
                              "'JetBrains Mono', ui-monospace, monospace",
                          }}
                        >
                          {e.label}
                        </div>
                        <p
                          className="text-sm leading-relaxed"
                          style={{ color: 'var(--text-2)' }}
                        >
                          {e.text}
                        </p>
                      </div>
                    ))}
                  </Card>
                </section>
              )}

              {rulesArr.length > 0 && (
                <section>
                  <SectionHeader>House rules</SectionHeader>
                  <Card className="p-4">
                    <ul className="space-y-1.5">
                      {rulesArr.map((rule, i) => (
                        <li
                          key={i}
                          className="text-sm leading-relaxed flex gap-2"
                          style={{ color: 'var(--text-2)' }}
                        >
                          <span
                            style={{ color: 'var(--accent)' }}
                            className="shrink-0"
                          >
                            •
                          </span>
                          <span>{rule}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </section>
              )}
            </div>

            <div className="col-span-5 space-y-6">
              {videoUrls.length > 0 && (
                <section>
                  <SectionHeader>Videos</SectionHeader>
                  <div className="grid grid-cols-2 gap-2">
                    {videoUrls.map((url, idx) => (
                      <VideoTile
                        key={url}
                        url={url}
                        className={idx === 0 ? 'col-span-2' : ''}
                      />
                    ))}
                  </div>
                </section>
              )}

              {faqItems.length > 0 && (
                <section>
                  <SectionHeader>FAQ</SectionHeader>
                  <Card className="px-4">
                    <FAQList items={faqItems} />
                  </Card>
                </section>
              )}

              {contactLinks.length > 0 && (
                <section>
                  <SectionHeader>Contact</SectionHeader>
                  <Card className="p-4">
                    <ul className="space-y-2">
                      {contactLinks.map((c) => (
                        <li
                          key={c.key}
                          className="flex items-center gap-2.5 text-sm"
                        >
                          <span
                            style={{ color: 'var(--accent)' }}
                            className="shrink-0"
                          >
                            {c.icon}
                          </span>
                          <a
                            href={c.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: 'var(--text-2)',
                              wordBreak: 'break-all',
                            }}
                          >
                            {c.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </section>
              )}
            </div>

            {/* Full-width upcoming events */}
            <section className="col-span-12 mt-3">
              <div className="flex items-end justify-between mb-3">
                <div>
                  <h2
                    className="text-base font-medium tracking-tight"
                    style={{ color: 'var(--text)' }}
                  >
                    Upcoming events
                  </h2>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: 'var(--text-3)' }}
                  >
                    {eventList.length === 0
                      ? 'Nothing scheduled in the next 60 days'
                      : eventList.length === 1
                      ? '1 event in the next 60 days'
                      : `${eventList.length} events in the next 60 days`}
                  </p>
                </div>
                {eventList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => navigate('/calendar')}
                    className="text-xs inline-flex items-center gap-1"
                    style={{ color: 'var(--accent)' }}
                  >
                    View calendar
                    <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.4} />
                  </button>
                )}
              </div>
              {eventList.length === 0 ? (
                <Card className="p-6">
                  <p
                    className="text-sm text-center"
                    style={{ color: 'var(--text-3)' }}
                  >
                    No upcoming events yet — check back soon.
                  </p>
                </Card>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {eventList.map((ev) => (
                    <EventCardTile key={ev.occurrence_id} ev={ev} isRecurring={recurringEventIds.has(ev.event_id)} />
                  ))}
                </div>
              )}
            </section>
          </div>

          <div
            className="px-8 py-5 text-xs flex items-center justify-between relative"
            style={{
              borderTop: '1px solid var(--border)',
              color: 'var(--text-3)',
            }}
          >
            <span>Venue details maintained by the venue and organisers.</span>
            <div className="flex gap-4">
              <Link to="/contact" style={{ color: 'var(--text-3)' }}>
                Report listing
              </Link>
              <Link to="/contact" style={{ color: 'var(--text-3)' }}>
                Claim this venue
              </Link>
            </div>
          </div>
        </div>
      </div>
    </GlobalLayout>
  );
};

export default VenueEntity;
