import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { BentoTile } from '@/modules/event-page/bento/BentoTile';
import { BLOCK_COLORS, BLOCK_TITLES } from '@/modules/event-page/bento/BentoGrid';
import {
  useProgramItems,
  type Person,
  type ScheduleSession,
} from '@/modules/event-page/sections/EventScheduleGrid';

type ScheduleBlockProps = {
  eventId: string | null;
};

// ─── Format helpers ──────────────────────────────────────────────────────────

const fmtMins12 = (mins: number): string => {
  const h24 = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  const ampm = h24 < 12 ? 'AM' : 'PM';
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};

const fmtDuration = (startMins: number, endMins: number): string => {
  const diff = Math.max(0, endMins - startMins);
  if (diff < 60) return `${diff} MIN`;
  const hrs = diff / 60;
  if (Number.isInteger(hrs)) return hrs === 1 ? '1 HR' : `${hrs} HRS`;
  // Non-integer hour: show minutes if short, else 1 decimal
  return diff < 90 ? `${diff} MIN` : `${hrs.toFixed(1)} HRS`;
};

const fmtDayPill = (day: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return day;
  const anchored = new Date(`${day}T12:00:00`);
  if (Number.isNaN(anchored.getTime())) return day;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric' }).format(anchored);
    return parts.toUpperCase();
  } catch {
    return day;
  }
};

// ─── Role label ──────────────────────────────────────────────────────────────

const roleLabelFor = (session: ScheduleSession): string | null => {
  if (session.people.length === 0) return null;
  const isParty = session.type === 'party';
  const hasDj = session.people.some((p) => p.profileType === 'dj');
  if (isParty) return hasDj ? 'DJING' : 'PERFORMING';
  return 'TEACHING';
};

// ─── Person link (only clickable item inside a session) ──────────────────────

const PersonLink = ({ person, index }: { person: Person; index: number }) => {
  const initial = (person.name || '?').charAt(0).toUpperCase();
  // Stable-feeling hue per person index — matches the design's avatar rainbow.
  const hue = (index * 53) % 360;
  const body = (
    <>
      <div
        className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-[1.5px] border-black/35 text-[15px] font-bold text-white/95"
        style={{ background: person.avatarUrl ? undefined : `hsl(${hue} 35% 35%)` }}
      >
        {person.avatarUrl ? (
          <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span>{initial}</span>
        )}
      </div>
      <div
        className="max-w-[60px] truncate text-center text-[9px] leading-[1.1] text-white/92"
        title={person.name}
      >
        {person.name}
      </div>
    </>
  );

  if (!person.href) {
    return (
      <div className="flex w-11 flex-col items-center gap-[4px]" aria-label={person.name}>
        {body}
      </div>
    );
  }
  return (
    <Link
      to={person.href}
      className="flex w-11 flex-col items-center gap-[4px] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
    >
      {body}
    </Link>
  );
};

// ─── Session row ─────────────────────────────────────────────────────────────

const SessionRow = ({ session }: { session: ScheduleSession }) => {
  const isParty = session.type === 'party';
  const roleLabel = roleLabelFor(session);

  return (
    <div className="grid grid-cols-[44px_1fr] items-start gap-[10px]">
      {/* Time rail — not clickable */}
      <div className="flex flex-col items-start pt-[2px]">
        <div className="text-[13px] font-bold leading-none tracking-[-0.01em] tabular-nums text-white">
          {fmtMins12(session.startMins)}
        </div>
        <div className="mt-[2px] font-mono text-[8px] uppercase tracking-[0.12em] text-white/70">
          {fmtDuration(session.startMins, session.endMins)}
        </div>
      </div>

      {/* Content — not clickable except the avatar/name links */}
      <div
        className={cn(
          'min-w-0',
          isParty && 'rounded-[12px] border border-white/25 bg-black/15 px-3 py-[10px]',
        )}
      >
        <span
          className="text-[14px] font-semibold leading-[1.15] tracking-[-0.005em] text-white"
          style={{ fontFamily: '"Fraunces", Georgia, serif' }}
        >
          {session.title}
        </span>

        {roleLabel && (
          <div className="mt-[8px] font-mono text-[8px] uppercase tracking-[0.14em] text-white/65">
            {roleLabel}
          </div>
        )}

        {session.people.length > 0 && (
          <div className="mt-[6px] flex flex-wrap gap-[10px]">
            {session.people.map((p, i) => (
              <PersonLink key={`${p.id}-${i}`} person={p} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Day tabs ────────────────────────────────────────────────────────────────

const DayTabs = ({
  days,
  active,
  onPick,
}: {
  days: string[];
  active: string;
  onPick: (day: string) => void;
}) => {
  return (
    <div
      className="-mx-1 mb-3 flex shrink-0 gap-1 overflow-x-auto pb-1"
      style={{ scrollbarWidth: 'none' }}
    >
      {days.map((day) => {
        const selected = day === active;
        return (
          <button
            key={day}
            type="button"
            onClick={() => onPick(day)}
            className={cn(
              'flex-shrink-0 rounded-full px-[10px] py-[4px] text-[10px] font-bold uppercase tracking-[0.06em] transition',
              selected
                ? 'border border-white/95 bg-white/95 text-black'
                : 'border border-white/25 bg-transparent text-white/90',
            )}
          >
            {fmtDayPill(day)}
          </button>
        );
      })}
    </div>
  );
};

// ─── Normalization (mirrors EventScheduleGrid's normalizeSessions) ───────────

const normalize = (sessions: ScheduleSession[]): ScheduleSession[] => {
  if (!sessions.length) return [];
  return [...sessions]
    .sort((a, b) => a.startMins - b.startMins)
    .map((s) => {
      let end = s.endMins;
      if (end > 0 && end <= s.startMins) end += 24 * 60;
      return { ...s, endMins: end };
    });
};

// ─── Main component ──────────────────────────────────────────────────────────

export const ScheduleBlock = ({ eventId }: ScheduleBlockProps) => {
  const { data: rawSessions = [], isLoading } = useProgramItems(eventId);

  const sessions = useMemo(() => normalize(rawSessions), [rawSessions]);
  const uniqueDays = useMemo(
    () => Array.from(new Set(sessions.map((s) => s.day).filter((d): d is string => Boolean(d)))).sort(),
    [sessions],
  );
  const isMultiDay = uniqueDays.length > 1;

  const [activeDay, setActiveDay] = useState<string | null>(null);
  const currentDay = activeDay ?? uniqueDays[0] ?? null;

  const visibleSessions = useMemo(() => {
    if (!isMultiDay || !currentDay) return sessions;
    return sessions.filter((s) => s.day === currentDay);
  }, [sessions, isMultiDay, currentDay]);

  return (
    <BentoTile title={BLOCK_TITLES.schedule} color={BLOCK_COLORS.schedule}>
      {isMultiDay && currentDay && (
        <DayTabs days={uniqueDays} active={currentDay} onPick={setActiveDay} />
      )}

      {sessions.length === 0 ? (
        // Empty-state copy sits in a naturally short box — no flex-1 so the
        // bento row collapses to minimum cell height instead of inflating.
        <div className="py-2 text-center text-[11px] text-white/70">
          {isLoading ? 'Loading…' : 'Schedule coming soon'}
        </div>
      ) : (
        // No flex-1, no overflow-y-auto. Height = sessions stacked with their
        // inter-row gap + the tile's padding. Anything taller just grows the
        // grid row (gridAutoRows is minmax(cell, auto)).
        <div className="flex flex-col gap-[22px]">
          {visibleSessions.map((s) => (
            <SessionRow key={s.id} session={s} />
          ))}
        </div>
      )}
    </BentoTile>
  );
};
