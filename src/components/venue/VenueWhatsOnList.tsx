import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';

export interface VenueWhatsOnEvent {
  event_id: string;
  occurrence_id: string;
  instance_start: string;
  name: string;
  poster_url: string | null;
  type: string | null;
}

interface VenueWhatsOnListProps {
  events: VenueWhatsOnEvent[];
  venueName: string;
  onSeeAll?: () => void;
}

const POSTER_FALLBACKS = [
  'linear-gradient(135deg,#c42b7a,#7a1f6a)',
  'linear-gradient(135deg,#7c3fd0,#3a2160)',
  'linear-gradient(135deg,#2e73b8,#1f3a6a)',
  'linear-gradient(135deg,#1f8a6b,#0e5e47)',
];

function buildHref(ev: VenueWhatsOnEvent): string {
  return `/event/${ev.event_id}?occurrenceId=${ev.occurrence_id}`;
}

function dayParts(iso: string): { day: string; mon: string; weekday: string } {
  try {
    const d = parseISO(iso);
    return {
      day: format(d, 'dd'),
      mon: format(d, 'MMM'),
      weekday: format(d, 'EEEE'),
    };
  } catch {
    return { day: '?', mon: '', weekday: '' };
  }
}

function countdown(iso: string): string {
  try {
    const diff = differenceInCalendarDays(parseISO(iso), new Date());
    if (diff < 0) return 'Past';
    if (diff === 0) return 'Tonight';
    if (diff === 1) return 'Tomorrow';
    if (diff < 7) return `in ${diff} days`;
    if (diff < 14) return 'next week';
    const weeks = Math.round(diff / 7);
    return `in ${weeks} weeks`;
  } catch {
    return '';
  }
}

export default function VenueWhatsOnList({
  events,
  venueName,
  onSeeAll,
}: VenueWhatsOnListProps) {
  if (events.length === 0) return null;
  const visible = events.slice(0, 3);

  return (
    <div
      className="overflow-hidden rounded-[18px] border p-4"
      style={{
        background: 'var(--va-surface)',
        borderColor: 'var(--va-accent-line)',
        boxShadow:
          '0 0 0 1px color-mix(in srgb, var(--va-halo) 10%, transparent), 0 18px 44px -22px color-mix(in srgb, var(--va-halo) 32%, transparent)',
      }}
    >
      <div className="flex flex-col gap-2.5">
        {visible.map((ev, i) => {
          const dp = dayParts(ev.instance_start);
          const grad = POSTER_FALLBACKS[i % POSTER_FALLBACKS.length];
          return (
            <Link
              key={ev.occurrence_id}
              to={buildHref(ev)}
              className="flex items-center gap-3 rounded-2xl border p-2.5 no-underline"
              style={{
                background: 'var(--va-surface2)',
                borderColor: 'var(--va-line)',
              }}
            >
              <div
                className="relative h-[58px] w-[58px] flex-shrink-0 overflow-hidden rounded-xl text-white"
                style={{ background: ev.poster_url ? '#0E0F13' : grad }}
              >
                {ev.poster_url ? (
                  <img
                    src={ev.poster_url}
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
                  className="absolute left-1 top-1 z-[2] flex h-7 w-7 flex-col items-center justify-center rounded-lg border"
                  style={{
                    background: 'rgba(10,11,14,0.78)',
                    borderColor: 'rgba(255,255,255,0.18)',
                    boxShadow: '0 4px 10px -4px rgba(0,0,0,0.6)',
                  }}
                >
                  <span
                    className="text-[12px] font-extrabold leading-none text-white"
                    style={{ fontFamily: 'var(--va-display)' }}
                  >
                    {dp.day}
                  </span>
                  <span
                    className="mt-px text-[6.5px] font-bold uppercase tracking-[0.1em]"
                    style={{ color: 'var(--va-ink-gold)' }}
                  >
                    {dp.mon}
                  </span>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="truncate text-[14.5px] font-bold leading-tight"
                  style={{ color: 'var(--va-text)' }}
                >
                  {ev.name}
                </div>
                <div
                  className="mt-0.5 text-[12px]"
                  style={{ color: 'var(--va-text3)' }}
                >
                  {countdown(ev.instance_start)}
                </div>
              </div>
              <ChevronRight
                className="h-[18px] w-[18px] flex-shrink-0"
                style={{ color: 'var(--va-text3)' }}
              />
            </Link>
          );
        })}
      </div>
      {events.length > 3 && onSeeAll ? (
        <button
          type="button"
          onClick={onSeeAll}
          className="mt-3 flex h-[46px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-[13px] border text-[14px] font-bold"
          style={{
            background: 'var(--va-surface2)',
            borderColor: 'var(--va-line)',
            color: 'var(--va-text)',
          }}
          aria-label={`See all events at ${venueName}`}
        >
          See all events at this venue
          <ChevronRight className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
