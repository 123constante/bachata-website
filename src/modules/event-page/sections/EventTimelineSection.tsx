import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarDays } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { EventPageModel, FestivalScheduleItem } from '@/modules/event-page/types';

// ─── Shared types ─────────────────────────────────────────────────────────────

type Person = { id: string; name: string; href: string; avatarUrl: string | null };

type TimelineSession = {
  id: string;
  title: string;
  type: string;
  startMins: number;
  endMins: number;
  durationMins: number;
  people: Person[];
};

// ─── Time utilities ───────────────────────────────────────────────────────────

/** Extract minutes-since-midnight from "HH:MM", "HH:MM:SS", or ISO timestamp */
function toMins(value: string | null | undefined): number | null {
  if (!value) return null;
  const tIdx = value.indexOf('T');
  const part = tIdx !== -1 ? value.slice(tIdx + 1) : value;
  const [h, m] = part.split(':').map(Number);
  if (isNaN(h)) return null;
  return h * 60 + (m || 0);
}

/** Format minutes-since-midnight as "HH:MM", wrapping at 24h */
function fmtMins(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Strip trailing auto-number from default names: "Class 1" → "Class", "Party 2" → "Party" */
function normalizeTitle(title: string): string {
  return /^(class|party|workshop|social|show|competition)\s+\d+$/i.test(title.trim())
    ? title.trim().replace(/\s+\d+$/, '')
    : title;
}

// ─── Session normalization ────────────────────────────────────────────────────

/** Sort sessions by start time and fix midnight-crossing end times */
function normalizeSessions(sessions: TimelineSession[]): TimelineSession[] {
  if (!sessions.length) return [];
  return [...sessions]
    .sort((a, b) => a.startMins - b.startMins)
    .map((s) => {
      let end = s.endMins;
      // End before start = crosses midnight, add 24h
      if (end > 0 && end <= s.startMins) end += 24 * 60;
      const dur = Math.max(15, end - s.startMins);
      return { ...s, endMins: end, durationMins: dur };
    });
}

// ─── Data hook: event_program_items ──────────────────────────────────────────

function useProgramItems(eventId: string | null | undefined) {
  return useQuery<TimelineSession[]>({
    queryKey: ['event-program-items', eventId],
    queryFn: async () => {
      if (!eventId) return [];

      const { data: items, error: itemsErr } = await supabase
        .from('event_program_items')
        .select('id, title, type, start_time, end_time, sort_order')
        .eq('event_id', eventId)
        .order('sort_order', { nullsFirst: false })
        .order('start_time', { nullsFirst: false });

      if (itemsErr || !items?.length) return [];

      // Filter items that have parseable start times
      const withTimes = items.filter((i) => toMins(i.start_time) !== null);
      if (!withTimes.length) return [];

      const itemIds = withTimes.map((i) => i.id);

      // Read lineup from event_program_people (single authority).
      // display_name + avatar_url are already denormalized on the row,
      // so no secondary joins to teacher_profiles / dj_profiles are needed.
      const { data: peopleRows } = await supabase
        .from('event_program_people' as never)
        .select('program_item_id, profile_id, profile_type, display_name, avatar_url, sort_order')
        .in('program_item_id', itemIds)
        .order('sort_order', { ascending: true, nullsFirst: false });

      type PeopleRow = {
        program_item_id: string;
        profile_id: string | null;
        profile_type: string | null;
        display_name: string | null;
        avatar_url: string | null;
      };
      const rows = (peopleRows ?? []) as unknown as PeopleRow[];

      const hrefFor = (t: string | null, id: string | null): string | null => {
        if (!id) return null;
        if (t === 'teacher') return `/teachers/${id}`;
        if (t === 'dj') return `/djs/${id}`;
        if (t === 'dancer') return `/dancers/${id}`;
        return null;
      };

      return withTimes.map((item): TimelineSession => {
        const startMins = toMins(item.start_time)!;
        const endMins = toMins(item.end_time) ?? startMins + 60;

        const people: Person[] = rows
          .filter((r) => r.program_item_id === item.id)
          .map((r): Person | null => {
            const href = hrefFor(r.profile_type, r.profile_id);
            if (!href) return null;
            return {
              id: r.profile_id!,
              name: r.display_name || (r.profile_type === 'dj' ? 'DJ' : 'Teacher'),
              href,
              avatarUrl: r.avatar_url,
            };
          })
          .filter((x): x is Person => x !== null);

        return {
          id: item.id,
          title: normalizeTitle(item.title || (item.type === 'party' ? 'Party' : 'Class')),
          type: item.type || 'class',
          startMins,
          endMins,
          durationMins: endMins - startMins,
          people,
        };
      });
    },
    enabled: Boolean(eventId),
    staleTime: 1000 * 60 * 5,
  });
}

// ─── Converters: fallback data sources → TimelineSession ─────────────────────

function fromFestivalSchedule(items: FestivalScheduleItem[]): TimelineSession[] {
  return items
    .map((item): TimelineSession | null => {
      const startMins = toMins(item.startTime);
      if (startMins === null) return null;
      const endMins = toMins(item.endTime) ?? startMins + 60;
      const people: Person[] = [
        ...item.instructors.map((p) => ({
          id: p.id,
          name: p.displayName ?? 'Teacher',
          href: `/teachers/${p.id}`,
          avatarUrl: null,
        })),
        ...item.djs.map((p) => ({
          id: p.id,
          name: p.displayName ?? 'DJ',
          href: `/djs/${p.id}`,
          avatarUrl: null,
        })),
      ];
      return {
        id: item.id ?? `${item.type}-${item.startTime}`,
        title: normalizeTitle(item.title || (item.type === 'party' ? 'Party' : 'Class')),
        type: item.type,
        startMins,
        endMins,
        durationMins: endMins - startMins,
        people,
      };
    })
    .filter((x): x is TimelineSession => x !== null);
}

function fromKeyTimes(kt: NonNullable<EventPageModel['schedule']['keyTimes']>): TimelineSession[] {
  const out: TimelineSession[] = [];
  if (kt.classes?.start) {
    const s = toMins(kt.classes.start) ?? 0;
    const e = toMins(kt.classes.end) ?? s + 60;
    out.push({ id: 'kt-classes', title: 'Classes', type: 'class', startMins: s, endMins: e, durationMins: e - s, people: [] });
  }
  if (kt.party?.start) {
    const s = toMins(kt.party.start) ?? 0;
    const e = toMins(kt.party.end) ?? s + 60;
    out.push({ id: 'kt-party', title: 'Party', type: 'party', startMins: s, endMins: e, durationMins: e - s, people: [] });
  }
  return out;
}

// ─── Session colour helper ────────────────────────────────────────────────────

function sessionStyle(type: string) {
  const isClass = ['class', 'workshop', 'social', 'show', 'competition'].includes(type);
  const isParty = type === 'party';
  return {
    isClass,
    isParty,
    bg: isClass
      ? 'bg-teal-500/[0.13] border-teal-500/25'
      : isParty
        ? 'bg-pink-500/[0.13] border-pink-500/25'
        : 'bg-white/[0.05] border-white/10',
    badge: isClass ? 'text-teal-400' : isParty ? 'text-pink-400' : 'text-white/50',
    title: isClass ? 'text-teal-100/90' : isParty ? 'text-pink-100/90' : 'text-white/85',
    link: isClass
      ? 'text-teal-300/75 hover:text-teal-200'
      : 'text-pink-300/75 hover:text-pink-200',
  };
}

// ─── Timeline renderer ────────────────────────────────────────────────────────

const PX_PER_MIN = 1.35;
const MIN_BLOCK_PX = 54;

function Timeline({ sessions }: { sessions: TimelineSession[] }) {
  const normalized = normalizeSessions(sessions);
  if (!normalized.length) return null;

  const allStarts = normalized.map((s) => s.startMins);
  const allEnds = normalized.map((s) => s.endMins);
  const rangeStart = Math.floor(Math.min(...allStarts) / 60) * 60;
  const rangeEnd = Math.ceil(Math.max(...allEnds) / 60) * 60;
  const totalMins = Math.max(60, rangeEnd - rangeStart);

  const containerPx = Math.max(160, totalMins * PX_PER_MIN);
  const pxPerMin = containerPx / totalMins;

  // Hour marks within the range
  const hourMarks: { label: string; top: number }[] = [];
  for (let m = rangeStart; m <= rangeEnd; m += 60) {
    hourMarks.push({ label: fmtMins(m), top: (m - rangeStart) * pxPerMin });
  }

  return (
    <div
      className="relative flex"
      style={{ height: containerPx + 20 + 'px' }} /* +20 for last label */
    >
      {/* ── Time axis ───────────────────────── */}
      <div className="relative w-11 shrink-0">
        {hourMarks.map((mark) => (
          <div
            key={mark.label}
            className="absolute right-2 text-[10px] tabular-nums leading-none text-white/35"
            style={{ top: mark.top - 5 }}
          >
            {mark.label}
          </div>
        ))}
      </div>

      {/* ── Vertical guide line ─────────────── */}
      <div className="relative w-px shrink-0 bg-white/10">
        {hourMarks.map((mark) => (
          <div
            key={mark.label}
            className="absolute right-0 h-px w-2 bg-white/20"
            style={{ top: mark.top }}
          />
        ))}
      </div>

      {/* ── Session blocks ──────────────────── */}
      <div className="relative ml-2 flex-1">
        {/* Faint hour grid lines */}
        {hourMarks.map((mark) => (
          <div
            key={mark.label}
            className="absolute inset-x-0 border-t border-white/[0.04]"
            style={{ top: mark.top }}
          />
        ))}

        {normalized.map((session) => {
          const top = (session.startMins - rangeStart) * pxPerMin;
          const height = Math.max(MIN_BLOCK_PX, session.durationMins * pxPerMin);
          const s = sessionStyle(session.type);

          return (
            <div
              key={session.id}
              className={`absolute inset-x-0 overflow-hidden rounded-xl border ${s.bg}`}
              style={{ top, height }}
            >
              <div className="flex h-full flex-col justify-start px-3 py-2 gap-0.5">
                {/* Type badge + duration */}
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[9px] font-semibold uppercase tracking-wider ${s.badge}`}>
                    {session.type}
                  </span>
                  <span className="shrink-0 tabular-nums text-[10px] text-white/35">
                    {fmtMins(session.startMins)} – {fmtMins(session.endMins)}
                  </span>
                </div>

                {/* Title */}
                <p className={`text-sm font-semibold leading-tight line-clamp-1 ${s.title}`}>
                  {session.title}
                </p>

                {/* People pills: avatar + name, clickable */}
                {session.people.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {session.people.slice(0, 4).map((p) => (
                      <Link
                        key={p.id}
                        to={p.href}
                        onClick={(e) => e.stopPropagation()}
                        className={`inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] py-0.5 pl-0.5 pr-2 text-[11px] leading-none transition-colors hover:border-white/25 ${s.link}`}
                      >
                        {p.avatarUrl ? (
                          <img
                            src={p.avatarUrl}
                            alt=""
                            className="h-4 w-4 rounded-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[9px] font-semibold text-white/70">
                            {p.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="max-w-[90px] truncate">{p.name}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

type EventTimelineSectionProps = {
  schedule: EventPageModel['schedule'];
  eventId: string | null;
  /** Fallback: schedule from meta_data.program (already fetched by festival detail query) */
  fallbackSchedule?: FestivalScheduleItem[] | null;
};

export const EventTimelineSection = ({
  schedule,
  eventId,
  fallbackSchedule,
}: EventTimelineSectionProps) => {
  const { data: programItems = [], isLoading } = useProgramItems(eventId);

  // Resolve which data source to use.
  // When programItems exist, prefer them but backfill people from fallbackSchedule for
  // any item whose event_program_instructors rows are missing (data gap between JSONB
  // meta_data.program and the relational table). Match by startMins|type — unique in
  // practice since no festival has two items of the same type at the exact same minute.
  const sessions: TimelineSession[] = (() => {
    if (programItems.length) {
      if (fallbackSchedule?.length) {
        const fbPeople = new Map<string, Person[]>();
        for (const s of fromFestivalSchedule(fallbackSchedule)) {
          if (s.people.length > 0) {
            fbPeople.set(`${s.startMins}|${s.type}`, s.people);
          }
        }
        return programItems.map((item) => ({
          ...item,
          people:
            item.people.length > 0
              ? item.people
              : (fbPeople.get(`${item.startMins}|${item.type}`) ?? []),
        }));
      }
      return programItems;
    }
    if (fallbackSchedule?.length) return fromFestivalSchedule(fallbackSchedule);
    if (schedule.keyTimes) return fromKeyTimes(schedule.keyTimes);
    return [];
  })();

  const hasAnySchedule =
    Boolean(schedule.dateLabel) ||
    sessions.length > 0;

  if (!hasAnySchedule && !isLoading) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_10px_35px_rgba(0,0,0,0.28)] backdrop-blur-sm">
      <p className="mb-3 text-[10px] uppercase tracking-[0.18em] text-white/45">Schedule</p>

      {schedule.isCancelled && (
        <div className="mb-3 inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
          <span className="text-[10px] uppercase tracking-[0.15em] text-red-400">Cancelled</span>
        </div>
      )}

      {/* Date + overall start–end */}
      {schedule.dateLabel && (
        <div className="mb-4">
          <div className="flex items-center gap-2 text-sm text-white/80">
            <CalendarDays className="h-4 w-4 shrink-0 text-white/40" />
            {schedule.dateLabel}
          </div>
        </div>
      )}

      {/* Timeline or loading skeleton */}
      {isLoading && !fallbackSchedule?.length && !schedule.keyTimes ? (
        <div className="flex h-36 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/15 border-t-white/50" />
        </div>
      ) : sessions.length > 0 ? (
        <Timeline sessions={sessions} />
      ) : null}
    </section>
  );
};
