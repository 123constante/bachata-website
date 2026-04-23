import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { EventPageModel, FestivalScheduleItem } from '@/modules/event-page/types';

// ─── Shared types ─────────────────────────────────────────────────────────────
// Exported so the new bento ScheduleBlock can reuse this hook without
// duplicating it. EventScheduleGrid is slated for deletion post-bento rollout;
// the hook will relocate at that point.

export type Person = {
  id: string;
  name: string;
  href: string | null;
  avatarUrl: string | null;
  role: string;
  profileType: string | null;
};

export type ScheduleSession = {
  id: string;
  title: string;
  type: string;
  day: string | null;
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

const fmtMins12 = (mins: number): string => {
  const h24 = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  const ampm = h24 < 12 ? 'AM' : 'PM';
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};

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

// ─── Data hook — mirror of useProgramItems from EventTimelineSection ─────────
// Same queryKey so React Query deduplicates across both components.

export function useProgramItems(eventId: string | null | undefined) {
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

          // Extract local-wall-clock date prefix. The RPC stores times as naive
          // local (see toMins, which ignores any offset); the YYYY-MM-DD prefix
          // matches what DayBlock/formatDayLabel expect.
          const dayMatch =
            typeof item.start_time === 'string' ? item.start_time.match(/^(\d{4}-\d{2}-\d{2})/) : null;
          const day = dayMatch ? dayMatch[1] : null;

          return {
            id: item.id,
            title: normalizeTitle(item.title || (item.type === 'party' ? 'Party' : 'Class')),
            type: item.type || 'class',
            day,
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
        id: item.id ?? `${item.type}-${item.day ?? ''}-${item.startTime}`,
        title: normalizeTitle(item.title || (item.type === 'party' ? 'Party' : 'Class')),
        type: item.type,
        day: /^\d{4}-\d{2}-\d{2}$/.test(item.day ?? '') ? item.day : null,
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
    out.push({ id: 'kt-classes', title: 'Classes', type: 'class', day: null, startMins: s, endMins: e, people: [] });
  }
  if (kt.party?.start) {
    const s = toMins(kt.party.start) ?? 0;
    const e = toMins(kt.party.end) ?? s + 60;
    out.push({ id: 'kt-party', title: 'Party', type: 'party', day: null, startMins: s, endMins: e, people: [] });
  }
  return out;
}

// ─── Visual helpers ───────────────────────────────────────────────────────────

const AvatarStack = ({ people }: { people: Person[] }) => {
  if (people.length === 0) return null;
  const visible = people.slice(0, 2);
  const extra = people.length - 2;
  return (
    <div className="flex items-center justify-end">
      {visible.map((p, i) => {
        const initial = (p.name || '?').charAt(0).toUpperCase();
        return (
          <div
            key={p.id}
            className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/15"
            style={{
              marginLeft: i === 0 ? 0 : -8,
              border: '1.5px solid hsl(var(--background))',
            }}
          >
            {p.avatarUrl ? (
              <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-[11px] font-semibold text-white/80">{initial}</span>
            )}
          </div>
        );
      })}
      {extra > 0 && (
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[10px] font-semibold text-white/70"
          style={{
            marginLeft: -8,
            border: '1.5px solid hsl(var(--background))',
          }}
        >
          +{extra}
        </div>
      )}
    </div>
  );
};

const SessionRow = ({ session, isLast }: { session: ScheduleSession; isLast: boolean }) => (
  <div
    className={cn(
      'grid items-center gap-[10px] px-3 py-[9px]',
      !isLast && 'border-b border-black/5',
    )}
    style={{ gridTemplateColumns: '64px minmax(0,1fr) auto' }}
  >
    <span className="text-[13px] font-medium text-black tabular-nums whitespace-nowrap">
      {fmtMins12(session.startMins)}
    </span>
    <span className="text-[13px] text-black/85 line-clamp-2">{session.title}</span>
    <div className="min-w-[32px]">
      <AvatarStack people={session.people} />
    </div>
  </div>
);

const SessionTable = ({ sessions, flushTop = false }: { sessions: ScheduleSession[]; flushTop?: boolean }) => (
  <div
    className={cn(
      'overflow-hidden border-[0.5px] border-black/10 bg-white',
      flushTop ? 'rounded-b-md border-t-0' : 'rounded-md',
    )}
  >
    {sessions.map((s, i) => (
      <SessionRow key={s.id} session={s} isLast={i === sessions.length - 1} />
    ))}
  </div>
);

// ─── Day grouping ─────────────────────────────────────────────────────────────

const formatDayLabel = (day: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
  const d = new Date(`${day}T12:00:00`);
  if (isNaN(d.getTime())) return day;
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};

const todayKeyInTz = (tz: string | null): string => {
  const opts: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: tz ?? undefined,
  };
  try {
    const parts = new Intl.DateTimeFormat('en-CA', opts).format(new Date());
    return parts; // en-CA yields YYYY-MM-DD
  } catch {
    const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    return parts;
  }
};

const DayBlock = ({
  day,
  sessions,
  defaultOpen,
}: {
  day: string;
  sessions: ScheduleSession[];
  defaultOpen: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const label = formatDayLabel(day);
  const count = sessions.length;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center justify-between border-[0.5px] border-black/10 bg-white px-3 py-[9px] text-left',
          open ? 'rounded-t-md' : 'rounded-md',
        )}
      >
        <span className="text-[13px] font-medium text-black">
          {label} <span className="text-black/50">· {count} session{count !== 1 ? 's' : ''}</span>
        </span>
        <ChevronDown
          className={cn('h-3 w-3 shrink-0 text-black/50 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && <SessionTable sessions={sessions} flushTop />}
    </div>
  );
};

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

  const sessions: ScheduleSession[] = useMemo(() => {
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
  }, [programItems, fallbackSchedule, schedule.keyTimes]);

  const hasAny = sessions.length > 0;
  if (!hasAny && !isLoading) return null;

  // Group by day when multiple distinct dated days exist
  const uniqueDays = Array.from(new Set(sessions.map((s) => s.day).filter((d): d is string => Boolean(d)))).sort();
  const isMultiDay = uniqueDays.length > 1;

  if (isLoading && !fallbackSchedule?.length && !schedule.keyTimes) {
    return (
      <section>
        {schedule.isCancelled && <CancelledBanner />}
        <div className="flex h-16 items-center justify-center rounded-md border-[0.5px] border-black/10 bg-white">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-black/15 border-t-black/50" />
        </div>
      </section>
    );
  }

  if (isMultiDay) {
    const defaultOpenDay = uniqueDays.find((d) => d >= todayKeyInTz(schedule.timezoneLabel)) ?? uniqueDays[uniqueDays.length - 1];
    return (
      <section className="space-y-2">
        {schedule.isCancelled && <CancelledBanner />}
        {uniqueDays.map((day) => (
          <DayBlock
            key={day}
            day={day}
            sessions={sessions.filter((s) => s.day === day)}
            defaultOpen={day === defaultOpenDay}
          />
        ))}
      </section>
    );
  }

  return (
    <section>
      {schedule.isCancelled && <CancelledBanner />}
      <SessionTable sessions={sessions} />
    </section>
  );
};

const CancelledBanner = () => (
  <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1">
    <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
    <span className="text-[10px] uppercase tracking-[0.15em] text-red-400">Cancelled</span>
  </div>
);
