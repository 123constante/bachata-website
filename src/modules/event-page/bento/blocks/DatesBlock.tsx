import { Link } from 'react-router-dom';
import { BentoTile } from '@/modules/event-page/bento/BentoTile';
import { BLOCK_COLORS, BLOCK_TITLES } from '@/modules/event-page/bento/BentoGrid';
import type { EventPageSnapshotOccurrence } from '@/modules/event-page/types';

type DatesBlockProps = {
  occurrences: EventPageSnapshotOccurrence[];
  currentOccurrenceId: string | null;
};

function formatDateLabel(occ: EventPageSnapshotOccurrence): string {
  const src = occ.localDate ?? occ.startsAt;
  if (!src) return '--';
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(src) ? `${src}T12:00:00` : src;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return '--';
  const tz = occ.timezone ?? undefined;
  try {
    const wd = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short' }).format(date);
    const d  = new Intl.DateTimeFormat('en-GB', { timeZone: tz, day: 'numeric' }).format(date);
    const mo = new Intl.DateTimeFormat('en-GB', { timeZone: tz, month: 'short' }).format(date);
    return `${wd} ${d} ${mo}`;
  } catch {
    return `${date.toLocaleDateString('en-GB', { weekday: 'short' })} ${date.getDate()} ${date.toLocaleDateString('en-GB', { month: 'short' })}`;
  }
}

function formatTime(iso: string | null, tz: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  try {
    const s = new Intl.DateTimeFormat('en-US', {
      timeZone: tz ?? undefined,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
    return s.replace(':00 ', ' ');
  } catch {
    return null;
  }
}

function formatDuration(startIso: string | null, endIso: string | null): string | null {
  if (!startIso || !endIso) return null;
  const mins = (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000;
  if (mins <= 0) return null;
  if (mins < 60) return `${Math.round(mins)} min`;
  const hrs = mins / 60;
  return hrs % 1 === 0 ? `${Math.round(hrs)} hr` : `${hrs.toFixed(1)} hr`;
}

function isOccurrenceToday(occ: EventPageSnapshotOccurrence): boolean {
  const src = occ.localDate ?? occ.startsAt;
  if (!src) return false;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(src) ? `${src}T12:00:00` : src;
  const d = new Date(normalized);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export const DatesBlock = ({ occurrences, currentOccurrenceId }: DatesBlockProps) => (
  <BentoTile title={BLOCK_TITLES.dates} color={BLOCK_COLORS.dates} mode="multi-target">
    <div className="overflow-hidden rounded-[12px]">
      {occurrences.map((occ, i) => {
        const isActive  = occ.occurrenceId === currentOccurrenceId;
        const isToday   = isOccurrenceToday(occ);
        const isPastDim = occ.isPast && !isActive;
        const dateLabel = formatDateLabel(occ);
        const time      = formatTime(occ.startsAt, occ.timezone);
        const duration  = formatDuration(occ.startsAt, occ.endsAt);
        const isLast    = i === occurrences.length - 1;

        let rowBg: string | undefined;
        if (isActive)             rowBg = 'rgba(201,168,67,0.13)';
        else if (occ.isCancelled) rowBg = 'rgba(224,82,82,0.10)';
        else if (isToday)         rowBg = 'rgba(201,168,67,0.06)';

        return (
          <Link
            key={occ.occurrenceId}
            to={`?occurrenceId=${occ.occurrenceId}`}
            className="relative flex items-center px-3 py-[9px]"
            style={{
              background: rowBg,
              opacity: isPastDim ? 0.3 : undefined,
              borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.035)',
            }}
          >
            {isActive && (
              <span
                className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-[2px]"
                style={{ background: 'hsl(var(--bento-accent))' }}
              />
            )}

            <div className="flex flex-1 flex-col gap-[2px]">
              <span
                className="text-[10.5px] leading-none"
                style={{
                  fontWeight: isActive ? 800 : 700,
                  color: occ.isCancelled ? 'rgba(248,113,113,0.7)' : 'hsl(var(--bento-fg))',
                  textDecoration: occ.isCancelled ? 'line-through' : undefined,
                }}
              >
                {dateLabel}
              </span>

              {(isToday || occ.isCancelled) && (
                <div className="mt-[2px] flex flex-wrap gap-1">
                  {isToday && !occ.isCancelled && (
                    <span
                      className="rounded-[3px] px-[4px] py-px text-[6.5px] font-extrabold uppercase tracking-[0.06em]"
                      style={{ background: 'hsl(var(--bento-accent))', color: 'hsl(var(--bento-surface))' }}
                    >
                      Today
                    </span>
                  )}
                  {occ.isCancelled && (
                    <span
                      className="rounded-[3px] px-[4px] py-px text-[6.5px] font-extrabold uppercase tracking-[0.06em]"
                      style={{ background: '#dc2626', color: '#fff' }}
                    >
                      Cancelled
                    </span>
                  )}
                </div>
              )}
            </div>

            {!occ.isCancelled && (
              <div className="flex flex-col items-end gap-[2px]">
                {time && (
                  <span
                    className="leading-none tracking-[-0.01em]"
                    style={{
                      fontSize: occ.isPast ? '11px' : '13px',
                      fontWeight: occ.isPast ? 700 : 900,
                      color: occ.isPast
                        ? 'hsl(var(--bento-fg-muted))'
                        : 'hsl(var(--bento-accent))',
                    }}
                  >
                    {time}
                  </span>
                )}
                {duration && (
                  <span
                    className="text-[7.5px] font-semibold leading-none"
                    style={{ color: 'hsl(var(--bento-fg-muted))' }}
                  >
                    {duration}
                  </span>
                )}
              </div>
            )}
          </Link>
        );
      })}
    </div>
  </BentoTile>
);
