import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarDays } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { EventPageModel, FestivalScheduleItem } from '@/modules/event-page/types';

// ─── Shared types ─────────────────────────────────────────────────────────────

type Person = {
  id: string;
  name: string;
  href: string | null;
  avatarUrl: string | null;
  role: string;
  profileType: string | null;
};

type ScheduleSession = {
  id: string;
  title: string;
  type: string;
  startMins: number;
  endMins: number;
  people: Person[];
};

// ─── Time utilities ───────────────────────────────────────────────────────────

const toMins = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const tIdx = value.indexOf('T');
  const part = tIdx !== -1 ? value.slice(tIdx + 1) : value;
  const [h, m] = part.split(':').map(Number);
  if (isNaN(h)) return null;
  return h * 60 + (m || 0);
};

const fmtMins = (mins: number): string =>
  `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

const normalizeTitle = (title: string): string =>
  /^(class|party|workshop|social|show|competition)\s+\d+$/i.test(title.trim())
    ? title.trim().replace(/\s+\d+$/, '')
    : title;

const normalizeSessions = (sessions: ScheduleSession[]): ScheduleSession[] => {
  if (!sessions.length) return [];
  return [...sessions]
    .sort((a, b) => a.startMins - b.startMins)
    .map((s) => {
      let end = s.endMins;
      if (end > 0 && end <= s.startMins) end += 24 * 60;
      return { ...s, endMins: end };
    });
};

// ─── Role / href helpers ──────────────────────────────────────────────────────

const hrefFor = (profileType: string | null, profileId: string | null): string | null => {
  if (!profileId) return null;
  if (profileType === 'teacher') return `/teachers/${profileId}`;
  if (profileType === 'dj') return `/djs/${profileId}`;
  if (profileType === 'dancer') return `/dancers/${profileId}`;
  return null;
};

const roleLabel = (profileType: string | null): string => {
  if (profileType === 'teacher') return 'Teacher';
  if (profileType === 'dj') return 'DJ';
  if (profileType === 'dancer') return 'Dancer';
  if (profileType === 'videographer') return 'Videographer';
  return '';
};

// ─── Styling helpers ──────────────────────────────────────────────────────────

const isClassType = (type: string) =>
  ['class', 'workshop', 'social', 'show', 'competition'].includes(type);
const isPartyType = (type: string) => type === 'party';

const typeLabelColor = (type: string): string => {
  if (isClassType(type)) return 'text-teal-400';
  if (isPartyType(type)) return 'text-pink-400';
  return 'text-white/50';
};

const borderAccentClass = (type: string): string => {
  if (isClassType(type)) return 'border-l-teal-500';
  if (isPartyType(type)) return 'border-l-pink-500';
  return 'border-l-white/10';
};

const avatarBorderColor = (type: string): string => {
  if (isClassType(type)) return 'rgb(94, 234, 212)'; // teal-300
  if (isPartyType(type)) return 'rgb(249, 168, 212)'; // pink-300
  return 'rgba(255, 255, 255, 0.25)';
};

const initialsBgClass = (type: string): string => {
  if (isClassType(type)) return 'bg-teal-500/15 text-teal-300';
  if (isPartyType(type)) return 'bg-pink-500/15 text-pink-300';
  return 'bg-white/10 text-white/80';
};

// ─── Data hook — mirror of useProgramItems from EventTimelineSection ─────────
// Same queryKey so React Query deduplicates across both components.

function useProgramItems(eventId: string | null | undefined) {
  return useQuery<ScheduleSession[]>({
    queryKey: ['event-program-items', eventId],
    queryFn: async () => {
      if (!eventId) return [];

      const { data, error } = await supabase.rpc('get_event_program_v1' as any, {
        p_event_id: eventId,
      });

      if (error || !data) return [];

      type RpcPerson = {
        profile_id: string | null;
        profile_type: string | null;
        display_name: string | null;
        avatar_url: string | null;
        sort_order: number | null;
      };
      type RpcItem = {
        id: string;
        title: string | null;
        type: string | null;
        start_time: string | null;
        end_time: string | null;
        sort_order: number | null;
        people: RpcPerson[] | null;
      };

      const items = (data as unknown as RpcItem[]) ?? [];

      return items
        .filter((item) => toMins(item.start_time) !== null)
        .map((item): ScheduleSession => {
          const startMins = toMins(item.start_time)!;
          const endMins = toMins(item.end_time) ?? startMins + 60;

          const people: Person[] = (item.people ?? [])
            .slice()
            .sort((a, b) => {
              const ao = a.sort_order ?? Number.MAX_SAFE_INTEGER;
              const bo = b.sort_order ?? Number.MAX_SAFE_INTEGER;
              return ao - bo;
            })
            .map((r): Person | null => {
              if (!r.profile_id) return null;
              return {
                id: r.profile_id,
                name: r.display_name || (r.profile_type === 'dj' ? 'DJ' : 'Teacher'),
                href: hrefFor(r.profile_type, r.profile_id),
                avatarUrl: r.avatar_url,
                role: roleLabel(r.profile_type),
                profileType: r.profile_type,
              };
            })
            .filter((x): x is Person => x !== null);

          return {
            id: item.id,
            title: normalizeTitle(item.title || (item.type === 'party' ? 'Party' : 'Class')),
            type: item.type || 'class',
            startMins,
            endMins,
            people,
          };
        });
    },
    enabled: Boolean(eventId),
    staleTime: 1000 * 60 * 5,
  });
}

// ─── Fallback converters ──────────────────────────────────────────────────────

function fromFestivalSchedule(items: FestivalScheduleItem[]): ScheduleSession[] {
  return items
    .map((item): ScheduleSession | null => {
      const startMins = toMins(item.startTime);
      if (startMins === null) return null;
      const endMins = toMins(item.endTime) ?? startMins + 60;
      const people: Person[] = [
        ...item.instructors.map((p) => ({
          id: p.id,
          name: p.displayName ?? 'Teacher',
          href: `/teachers/${p.id}`,
          avatarUrl: null,
          role: 'Teacher',
          profileType: 'teacher',
        })),
        ...item.djs.map((p) => ({
          id: p.id,
          name: p.displayName ?? 'DJ',
          href: `/djs/${p.id}`,
          avatarUrl: null,
          role: 'DJ',
          profileType: 'dj',
        })),
      ];
      return {
        id: item.id ?? `${item.type}-${item.startTime}`,
        title: normalizeTitle(item.title || (item.type === 'party' ? 'Party' : 'Class')),
        type: item.type,
        startMins,
        endMins,
        people,
      };
    })
    .filter((x): x is ScheduleSession => x !== null);
}

function fromKeyTimes(kt: NonNullable<EventPageModel['schedule']['keyTimes']>): ScheduleSession[] {
  const out: ScheduleSession[] = [];
  if (kt.classes?.start) {
    const s = toMins(kt.classes.start) ?? 0;
    const e = toMins(kt.classes.end) ?? s + 60;
    out.push({ id: 'kt-classes', title: 'Classes', type: 'class', startMins: s, endMins: e, people: [] });
  }
  if (kt.party?.start) {
    const s = toMins(kt.party.start) ?? 0;
    const e = toMins(kt.party.end) ?? s + 60;
    out.push({ id: 'kt-party', title: 'Party', type: 'party', startMins: s, endMins: e, people: [] });
  }
  return out;
}

// ─── Person cell ──────────────────────────────────────────────────────────────

function PersonCell({ person, type }: { person: Person; type: string }) {
  const borderColor = avatarBorderColor(type);
  const initialsClass = initialsBgClass(type);

  const avatar = person.avatarUrl ? (
    <img
      src={person.avatarUrl}
      alt=""
      className="h-10 w-10 rounded-full object-cover"
      style={{ border: `1.5px solid ${borderColor}` }}
      loading="lazy"
    />
  ) : (
    <span
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-full text-[13px] font-semibold',
        initialsClass,
      )}
      style={{ border: `1.5px solid ${borderColor}` }}
    >
      {person.name.charAt(0).toUpperCase()}
    </span>
  );

  const body = (
    <>
      {avatar}
      <span
        className="mt-1 block overflow-hidden text-ellipsis whitespace-nowrap text-center text-[11px] text-white/60"
        style={{ maxWidth: '56px' }}
      >
        {person.name.split(' ')[0]}
      </span>
    </>
  );

  if (person.href) {
    return (
      <Link to={person.href} className="flex flex-col items-center">
        {body}
      </Link>
    );
  }
  return <div className="flex flex-col items-center">{body}</div>;
}

// ─── Session block ────────────────────────────────────────────────────────────

function SessionBlock({ session }: { session: ScheduleSession }) {
  const typeUpper = session.type.toUpperCase();
  return (
    <div
      className={cn('border-l-[3px]', borderAccentClass(session.type))}
      style={{ padding: '10px 12px' }}
    >
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="shrink-0 text-[14px] font-medium text-white tabular-nums">
          {fmtMins(session.startMins)} – {fmtMins(session.endMins)}
        </span>
        <span
          className={cn(
            'shrink-0 text-[11px] font-medium uppercase',
            typeLabelColor(session.type),
          )}
          style={{ letterSpacing: '1px' }}
        >
          {typeUpper}
        </span>
        <span className="truncate text-[14px] font-medium text-white">
          {session.title}
        </span>
      </div>

      {session.people.length > 0 && (
        <div
          className="mt-[10px] grid justify-items-center gap-2"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))' }}
        >
          {session.people.map((p) => (
            <PersonCell key={p.id} person={p} type={session.type} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

type EventScheduleGridProps = {
  schedule: EventPageModel['schedule'];
  eventId: string | null;
  fallbackSchedule?: FestivalScheduleItem[] | null;
};

export const EventScheduleGrid = ({
  schedule,
  eventId,
  fallbackSchedule,
}: EventScheduleGridProps) => {
  const { data: programItems = [], isLoading } = useProgramItems(eventId);

  const sessions: ScheduleSession[] = (() => {
    if (programItems.length) {
      if (fallbackSchedule?.length) {
        const fbPeople = new Map<string, Person[]>();
        for (const s of fromFestivalSchedule(fallbackSchedule)) {
          if (s.people.length > 0) {
            fbPeople.set(`${s.startMins}|${s.type}`, s.people);
          }
        }
        return normalizeSessions(
          programItems.map((item) => ({
            ...item,
            people:
              item.people.length > 0
                ? item.people
                : (fbPeople.get(`${item.startMins}|${item.type}`) ?? []),
          })),
        );
      }
      return normalizeSessions(programItems);
    }
    if (fallbackSchedule?.length) return normalizeSessions(fromFestivalSchedule(fallbackSchedule));
    if (schedule.keyTimes) return normalizeSessions(fromKeyTimes(schedule.keyTimes));
    return [];
  })();

  const hasAny = Boolean(schedule.dateLabel) || sessions.length > 0;
  if (!hasAny && !isLoading) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_10px_35px_rgba(0,0,0,0.28)] backdrop-blur-sm">
      <p className="mb-3 text-[10px] uppercase tracking-[0.18em] text-white/45">Schedule</p>

      {schedule.isCancelled && (
        <div className="mb-3 inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
          <span className="text-[10px] uppercase tracking-[0.15em] text-red-400">Cancelled</span>
        </div>
      )}

      {schedule.dateLabel && (
        <div className="mb-4 flex items-center gap-2 text-sm text-white/80">
          <CalendarDays className="h-4 w-4 shrink-0 text-white/40" />
          {schedule.dateLabel}
        </div>
      )}

      {isLoading && !fallbackSchedule?.length && !schedule.keyTimes ? (
        <div className="flex h-24 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/15 border-t-white/50" />
        </div>
      ) : sessions.length > 0 ? (
        <div>
          {sessions.map((session, i) => (
            <div
              key={session.id}
              className={cn(i < sessions.length - 1 && 'border-b border-white/[0.06]')}
            >
              <SessionBlock session={session} />
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
};
