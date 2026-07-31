import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { optimizedImageUrl } from '@/lib/imageCdn';

export const EVENT_ROW_POSTER_FALLBACKS = [
  'linear-gradient(135deg,#c42b7a,#7a1f6a)',
  'linear-gradient(135deg,#7c3fd0,#3a2160)',
  'linear-gradient(135deg,#2e73b8,#1f3a6a)',
  'linear-gradient(135deg,#1f8a6b,#0e5e47)',
];

export interface EventRowProps {
  href: string;
  name: string;
  posterUrl: string | null;
  /** already-formatted, e.g. "12" */
  dateDay: string;
  /** already-formatted, e.g. "AUG" */
  dateMon: string;
  /** already-formatted single line, e.g. "Tonight \u00b7 Forge \u00b7 7:30pm" */
  meta: string;
  /** cycles EVENT_ROW_POSTER_FALLBACKS when posterUrl is null */
  fallbackIndex?: number;
  /** renders a small pill left of the chevron, e.g. "15 dates" */
  chip?: string;
  /** when present, row renders as a button (opens a sheet) instead of a Link */
  onClick?: () => void;
}

/**
 * Shared row for "an upcoming event, tap to view" across entity detail pages.
 * Deliberately has no dependency on Supabase/WallClock/date-fns -- callers
 * pre-format dateDay/dateMon/meta so this stays reusable regardless of which
 * time library produced them.
 */
export default function EventRow({
  href,
  name,
  posterUrl,
  dateDay,
  dateMon,
  meta,
  fallbackIndex = 0,
  chip,
  onClick,
}: EventRowProps) {
  const fallback =
    EVENT_ROW_POSTER_FALLBACKS[fallbackIndex % EVENT_ROW_POSTER_FALLBACKS.length];

  const content = (
    <>
      <div
        className="relative h-[52px] w-[52px] flex-shrink-0 overflow-hidden rounded-xl text-white"
        style={{ background: posterUrl ? '#0E0F13' : fallback }}
      >
        {posterUrl ? (
          <img
            src={optimizedImageUrl(posterUrl, 160)}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(160deg,rgba(0,0,0,0.05),rgba(0,0,0,0.35))',
            }}
          />
        )}
        <div
          className="absolute left-1 top-1 z-[2] flex h-[26px] w-[26px] flex-col items-center justify-center rounded-lg border"
          style={{
            background: 'rgba(10,11,14,0.8)',
            borderColor: 'rgba(255,255,255,0.16)',
          }}
        >
          <span className="text-[11px] font-extrabold leading-none text-white">
            {dateDay}
          </span>
          <span className="mt-px text-[6px] font-bold uppercase tracking-[0.08em] text-[#E7BE6E]">
            {dateMon}
          </span>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold leading-tight text-[#F6F1EA]">
          {name}
        </div>
        <div className="mt-0.5 truncate text-[11.5px] text-[rgba(246,241,234,0.55)]">
          {meta}
        </div>
      </div>
      {chip ? (
        <span className="flex-shrink-0 whitespace-nowrap rounded-full border border-[rgba(231,190,110,0.3)] bg-[rgba(231,190,110,0.14)] px-2 py-0.5 text-[10px] font-bold text-[#E7BE6E]">
          {chip}
        </span>
      ) : null}
      <ChevronRight
        className="h-[18px] w-[18px] flex-shrink-0 text-[rgba(246,241,234,0.4)]"
      />
    </>
  );

  const rowClass =
    'flex w-full items-center gap-3 rounded-2xl border p-3 text-left no-underline transition-colors hover:bg-[rgba(246,241,234,0.05)]';
  const rowStyle = {
    background: 'rgba(246,241,234,0.03)',
    borderColor: 'rgba(246,241,234,0.07)',
  };

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={rowClass} style={rowStyle}>
        {content}
      </button>
    );
  }

  return (
    <Link to={href} className={rowClass} style={rowStyle}>
      {content}
    </Link>
  );
}
