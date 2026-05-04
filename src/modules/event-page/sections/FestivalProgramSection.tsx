// F.2.c — FestivalProgramSection: thin adapter over ScheduleGrid.
//
// Previously ~370 lines of duplicated FestivalRankCard / FestivalPartyCard /
// ArtistLink rendering. The session-rendering body is now delegated to
// ScheduleGrid + SessionCell (the same components used by ScheduleBlock).
//
// What stays here:
//   - outer section chrome (rounded card, Schedule header)
//   - day-tab strip (festival UI shell — one tab per festival day)
//   - FestivalScheduleItem -> ScheduleSession conversion (thin, inlined)
//   - orderedRooms computation for multi-venue festivals

import { useMemo, useState } from 'react';
import type {
  FestivalScheduleItem,
  FestivalSessionLevel,
} from '@/modules/event-page/types';
import type {
  Person,
  ScheduleSession,
  SessionLevel,
} from '@/modules/event-page/sections/EventScheduleGrid';
import { ScheduleGrid } from '@/modules/event-page/bento/blocks/schedule/ScheduleGrid';

// ─── Type helpers ─────────────────────────────────────────────────────────────

const toMins = (time: string | null | undefined): number | null => {
  if (!time) return null;
  const tIdx = time.indexOf('T');
  const part = tIdx !== -1 ? time.slice(tIdx + 1) : time;
  const [h, m] = part.split(':').map(Number);
  if (isNaN(h)) return null;
  return h * 60 + (m || 0);
};

// FestivalSessionLevel values are identical to SessionLevel values.
// Cast is safe — both share the same string union.
const toSessionLevels = (levels: FestivalSessionLevel[]): SessionLevel[] =>
  levels as unknown as SessionLevel[];

const festivalItemToSession = (item: FestivalScheduleItem): ScheduleSession | null => {
  const startMins = toMins(item.startTime);
  if (startMins === null) return null;
  const endMins = toMins(item.endTime) ?? startMins + 60;

  const people: Person[] = [
    ...item.instructors.map((p): Person => ({
      id: p.id,
      name: p.displayName ?? 'Teacher',
      href: p.href,
      avatarUrl: p.avatarUrl,
      role: 'Teacher',
      profileType: 'teacher',
      level: null,
    })),
    ...item.djs.map((p): Person => ({
      id: p.id,
      name: p.displayName ?? 'DJ',
      href: p.href,
      avatarUrl: p.avatarUrl,
      role: 'DJ',
      profileType: 'dj',
      level: null,
    })),
  ];

  return {
    id: item.id ?? ${item.type}--,
    title: item.title || (item.type === 'party' ? 'Party' : 'Class'),
    // Honour the isMasterclass flag when the type field lacks it.
    type: item.isMasterclass && item.type !== 'masterclass' ? 'masterclass' : item.type,
    day: /^\d{4}-\d{2}-\d{2}$/.test(item.day) ? item.day : null,
    startMins,
    endMins,
    levels: toSessionLevels(item.levels),
    room: item.venueRoom?.trim() || null,
    people,
  };
};

// ─── Day label helper ─────────────────────────────────────────────────────────

const formatDayLabel = (day: string): string => {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return day || 'TBD';
  const d = new Date(day + 'T12:00:00');
  if (isNaN(d.getTime())) return day;
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};

// ─── FestivalProgramSection ───────────────────────────────────────────────────

type FestivalProgramSectionProps = {
  schedule: FestivalScheduleItem[] | null;
};

export const FestivalProgramSection = ({ schedule }: FestivalProgramSectionProps) => {
  if (!schedule || schedule.length === 0) return null;

  // Derive ordered unique days.
  const uniqueDays = useMemo(
    () =>
      Array.from(new Set(schedule.map((it) => it.day).filter(Boolean)))
        .sort() as string[],
    [schedule],
  );

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const currentDay = selectedDay ?? uniqueDays[0] ?? null;

  // Current day's sessions converted to ScheduleSession shape.
  const daySessions = useMemo(() => {
    const raw = currentDay
      ? schedule.filter((it) => it.day === currentDay)
      : schedule;
    return raw.map(festivalItemToSession).filter((s): s is ScheduleSession => s !== null);
  }, [schedule, currentDay]);

  // Ordered room list for multi-venue festivals (e.g. Latin Room / Cuban Room).
  const orderedRooms = useMemo(() => {
    const seen  = new Set<string>();
    const order: string[] = [];
    for (const s of daySessions) {
      if (s.room && !seen.has(s.room)) {
        seen.add(s.room);
        order.push(s.room);
      }
    }
    return order.length >= 2 ? order : ([] as string[]);
  }, [daySessions]);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_10px_35px_rgba(0,0,0,0.28)] backdrop-blur-sm">
      <p className="mb-4 text-[10px] uppercase tracking-[0.18em] text-white/45">Schedule</p>

      {/* Day tabs — festival UI shell; stays here per architecture contract */}
      {uniqueDays.length > 1 && (
        <div className="flex gap-2 mb-5 overflow-x-auto pb-2">
          {uniqueDays.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={[
                'px-3 py-2 rounded-lg text-xs font-medium shrink-0 transition-all',
                currentDay === day
                  ? 'bg-pink-500/30 text-pink-200 border border-pink-400/50'
                  : 'bg-white/10 text-white/60 border border-white/10 hover:bg-white/15',
              ].join(' ')}
            >
              {formatDayLabel(day)}
            </button>
          ))}
        </div>
      )}

      {/* Session grid — unified renderer */}
      {daySessions.length === 0 ? (
        <p className="text-xs text-white/40 italic">No sessions scheduled</p>
      ) : (
        <ScheduleGrid rooms={orderedRooms} sessions={daySessions} eventId={null} />
      )}
    </section>
  );
};
