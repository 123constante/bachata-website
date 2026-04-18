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
  href: string;
  avatarUrl: string | null;
  role: string;
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

const photoBorderColor = (type: string): string => {
  if (isClassType(type)) return 'rgb(20, 184, 166)'; // teal-500
  if (isPartyType(type)) return 'rgb(236, 72, 153)'; // pink-500
  return 'rgba(255, 255, 255, 0.2)';
};

// ─── Data hook — mirror of useProgramItems from EventTimelineSection ─────────
// Same queryKey so React Query deduplicates across both components.

function useProgramItems(eventId: string | null | undefined) {
  return useQuery<ScheduleSession[]>({
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

      const withTimes = items.filter((i) => toMins(i.start_time) !== null);
      if (!withTimes.length) return [];

      const itemIds = withTimes.map((i) => i.id);

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

      return withTimes.map((item): ScheduleSession => {
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
              role: roleLabel(r.profile_type),
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
        })),
        ...item.djs.map((p) => ({
          id: p.id,
          name: p.displayName ?? 'DJ',
          href: `/djs/${p.id}`,
          avatarUrl: null,
          role: 'DJ',
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

// ─── Avatar stack ─────────────────────────────────────────────────────────────

function AvatarStack({ people, type }: { people: Person[]; type: string }) {
  if (!people.length) return null;
  const borderColor = photoBorderColor(type);
  const shown = people.slice(0, 3);
  return (
    <div className="flex items-center shrink-0">
      {shown.map((p, i) => (
        <div
          key={`${p.id}-${i}`}
          className="relative"
          style={{ marginLeft: i === 0 ? 0 : -8, zIndex: shown.length - i }}
        >
          {p.avatarUrl ? (
            <img
              src={p.avatarUrl}
              alt=""
              className="h-[30px] w-[30px] rounded-full object-cover"
              style={{ border: `1.5px solid ${borderColor}` }}
              loading="lazy"
            />
          ) : (
            <span
              className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold text-white/80"
              style={{ border: `1.5px solid ${borderColor}` }}
            >
              {p.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function ScheduleRow({ session }: { session: ScheduleSession }) {
  const firstPerson = session.people[0];
  const extraCount = Math.max(0, session.people.length - 1);
  const typeUpper = session.type.toUpperCase();

  const rowInner = (
    <div
      className={cn(
        'grid grid-cols-[72px_1fr_120px] items-center gap-2 rounded-lg border-l-[3px] px-3 py-[6px] transition-colors hover:bg-white/[0.03]',
        borderAccentClass(session.type),
      )}
    >
      {/* Column 1 — TIME */}
      <div className="flex flex-col">
        <span className="text-[11px] font-medium text-white tabular-nums leading-tight">
          {fmtMins(session.startMins)}
        </span>
        <span className="text-[10px] text-white/50 tabular-nums leading-tight">
          {fmtMins(session.endMins)}
        </span>
      </div>

      {/* Column 2 — SESSION */}
      <div className="flex min-w-0 flex-col">
        <span
          className={cn('text-[9px] font-semibold uppercase leading-tight', typeLabelColor(session.type))}
          style={{ letterSpacing: '1.5px' }}
        >
          {typeUpper}
        </span>
        <span className="mt-0.5 truncate text-[12px] font-medium leading-tight text-white">
          {session.title}
        </span>
      </div>

      {/* Column 3 — PERSON */}
      <div className="flex min-w-0 items-center justify-end gap-2">
        {firstPerson ? (
          <>
            <div className="flex min-w-0 flex-col items-end">
              <span className="truncate text-[11px] leading-tight text-white/70">
                {firstPerson.name}
                {extraCount > 0 && <span className="text-white/40"> +{extraCount}</span>}
              </span>
              {firstPerson.role && (
                <span className="text-[9px] leading-tight text-white/40">{firstPerson.role}</span>
              )}
            </div>
            <AvatarStack people={session.people} type={session.type} />
          </>
        ) : null}
      </div>
    </div>
  );

  if (firstPerson) {
    return (
      <Link to={firstPerson.href} className="block">
        {rowInner}
      </Link>
    );
  }
  return rowInner;
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
          {/* Header row */}
          <div className="mb-1 grid grid-cols-[72px_1fr_120px] gap-2 border-b border-white/[0.08] px-3 pb-1.5">
            <span
              className="text-[9px] font-semibold uppercase text-white/30"
              style={{ letterSpacing: '1.2px' }}
            >
              Time
            </span>
            <span
              className="text-[9px] font-semibold uppercase text-white/30"
              style={{ letterSpacing: '1.2px' }}
            >
              Session
            </span>
            <span
              className="text-right text-[9px] font-semibold uppercase text-white/30"
              style={{ letterSpacing: '1.2px' }}
            >
              Teacher / DJ
            </span>
          </div>

          {sessions.map((session, i) => (
            <div
              key={session.id}
              className={cn(i < sessions.length - 1 && 'border-b border-white/[0.06]')}
            >
              <ScheduleRow session={session} />
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
};
