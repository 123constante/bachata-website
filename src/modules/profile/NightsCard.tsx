import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { optimizedImageUrl, srcWidthFor } from '@/lib/imageCdn';

const SERIF = "'Cormorant Garamond', Georgia, serif";
const GOLD = '#E7BE6E';
const FALLBACKS = [
  'linear-gradient(135deg,#c42b7a,#7a1f6a)',
  'linear-gradient(135deg,#7c3fd0,#3a2160)',
  'linear-gradient(135deg,#2e73b8,#1f3a6a)',
  'linear-gradient(135deg,#1f8a6b,#0e5e47)',
];

export interface NightsCardProps {
  /** Single night: link target. Ignored when onClick is set. */
  href: string;
  /** Series: opens the dates sheet (card renders as a button). */
  onClick?: () => void;
  name: string;
  posterUrl: string | null;
  /** Full weekday name, e.g. "Friday". */
  weekday: string;
  day: string;
  month: string;
  /** Countdown chip text (<= 11 chars) or null for none. */
  chipText: string | null;
  chipSoon: boolean;
  /** Venue name / city and time, or null for no line. */
  metaLine: string | null;
  actionLabel: string;
  initials: string;
  fallbackIndex?: number;
  impressionRef?: (el: Element | null) => void;
}

/** Next nights card (design D4): flyer left at 50% / 200px, details right, 44px action row. */
export default function NightsCard(p: NightsCardProps) {
  const fallback = FALLBACKS[(p.fallbackIndex ?? 0) % FALLBACKS.length];
  const content = (
    <>
      <div className="relative flex-shrink-0 overflow-hidden" style={{ width: '50%', height: 200, background: p.posterUrl ? '#0E0F13' : fallback }}>
        {p.posterUrl ? (
          <img src={optimizedImageUrl(p.posterUrl, srcWidthFor(190))} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        ) : (
          <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center" style={{ fontFamily: SERIF, fontSize: 44, color: 'rgba(251,239,196,0.85)' }}>
            {p.initials}
          </span>
        )}
        {p.chipText && (
          <span
            data-testid="nights-card-chip"
            data-soon={p.chipSoon ? 'true' : 'false'}
            className="absolute whitespace-nowrap"
            style={{
              left: 8, bottom: 8, padding: '3px 8px', borderRadius: 100, fontSize: 11, fontWeight: 800, lineHeight: '14px',
              background: p.chipSoon ? GOLD : 'rgba(10,11,14,0.88)',
              color: p.chipSoon ? '#0A0B0E' : GOLD,
              border: `1px solid ${GOLD}`,
            }}
          >
            {p.chipText}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col" style={{ padding: '12px 4px 0 12px', height: 200 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: GOLD }}>{p.weekday}</div>
        <div className="flex items-baseline" style={{ gap: 6, marginTop: 2 }}>
          <span style={{ fontFamily: SERIF, fontSize: 38, fontWeight: 600, lineHeight: 1, color: '#F6F1EA' }}>{p.day}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(246,241,234,0.75)' }}>{p.month}</span>
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 700, lineHeight: 1.2, marginTop: 6, color: '#F6F1EA', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflowWrap: 'anywhere' }}>
          {p.name}
        </div>
        {p.metaLine && (
          <div className="truncate" style={{ fontSize: 12, marginTop: 4, color: 'rgba(246,241,234,0.7)' }}>{p.metaLine}</div>
        )}
        <div
          data-testid="nights-card-action"
          className="mt-auto flex items-center justify-between"
          style={{ minHeight: 44, color: GOLD, fontSize: 13, fontWeight: 700 }}
        >
          <span>{p.actionLabel}</span>
          <ChevronRight aria-hidden="true" style={{ width: 18, height: 18 }} />
        </div>
      </div>
    </>
  );
  const cls = 'flex w-full overflow-hidden rounded-2xl border text-left no-underline transition-colors hover:bg-[rgba(246,241,234,0.05)]';
  const style = { background: 'rgba(246,241,234,0.03)', borderColor: 'rgba(246,241,234,0.07)' };
  if (p.onClick) {
    return (
      <button type="button" ref={p.impressionRef} onClick={p.onClick} className={cls} style={style}>
        {content}
      </button>
    );
  }
  return (
    <Link to={p.href} ref={p.impressionRef} className={cls} style={style}>
      {content}
    </Link>
  );
}
