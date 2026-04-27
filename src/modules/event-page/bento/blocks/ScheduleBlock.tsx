import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BentoTile } from '@/modules/event-page/bento/BentoTile';
import { BLOCK_COLORS, BLOCK_TITLES } from '@/modules/event-page/bento/BentoGrid';
import {
  useProgramItems,
  type Person,
  type ScheduleSession,
  type SessionLevel,
} from '@/modules/event-page/sections/EventScheduleGrid';

// ─── Level → headline text map ───────────────────────────────────────────────
const LEVEL_LABEL_SHORT: Record<SessionLevel, string> = {
  beginner:     'Beg',
  improver:     'Imp',
  intermediate: 'Int',
  advanced:     'Adv',
  open_level:   'Open',
};
const LEVEL_LABEL_FULL: Record<SessionLevel, string> = {
  beginner:     'Beginner',
  improver:     'Improver',
  intermediate: 'Intermediate',
  advanced:     'Advanced',
  open_level:   'Open Level',
};
const LEVEL_ORDER: SessionLevel[] = ['beginner', 'improver', 'intermediate', 'advanced', 'open_level'];

// ─── Session classification helpers ──────────────────────────────────────────

const isClassyType = (type: string): boolean =>
  type === 'class' || type === 'masterclass';

// Default-name detection — used to suppress redundant "Class", "Class 1",
// "Classes 1", "Masterclass 2" titles inside rank cards. The rank IS the
// scaffold; the title only earns space when it adds new info.
const isDefaultClassTitle = (title: string): boolean =>
  /^(class|classes|masterclass|masterclasses)(\s+\d+)?$/i.test(title.trim());

// Rank-card headline text. This is the at-a-glance differentiator for a
// dancer scanning a parallel group of classes — "where do I go?".
//   • masterclass       → "Master"
//   • open_level        → "Open Level" (5th value, mutually exclusive with named 4)
//   • 4 levels          → "All"
//   • 1 level           → full word "Beginner" / "Improver" / "Intermediate" / "Advanced"
//   • 2–3 levels        → joined "/" abbreviations e.g. "Beg/Adv"
//   • no levels (class) → "Class" (muted; signals an absence of level info)
const rankFor = (session: ScheduleSession): { text: string; muted: boolean } => {
  if (session.type === 'masterclass') return { text: 'Master', muted: false };
  if (session.levels.length === 0) return { text: 'Class', muted: true };
  // Open Level wins over everything else if present (UI keeps it exclusive).
  if (session.levels.includes('open_level')) return { text: 'Open Level', muted: false };
  if (session.levels.length === 4) return { text: 'All', muted: false };
  const sorted = [...session.levels].sort(
    (a, b) => LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b),
  );
  // Single level → full word ("Beginner"). Multi-level keeps abbreviations
  // joined with "/" since two full words rarely fit a parallel-class card.
  if (sorted.length === 1) return { text: LEVEL_LABEL_FULL[sorted[0]], muted: false };
  return { text: sorted.map((l) => LEVEL_LABEL_SHORT[l]).join('/'), muted: false };
};

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
  if (isParty) return hasDj ? 'DJ' : 'PERFORMING';
  return 'TEACHING';
};

// ─── Person link (only clickable item inside a session) ──────────────────────

// PersonLink size table — keep all dimension knobs for a given size on one row
// so resizing later is a one-place edit.
//   sm: 32 px avatar (legacy)
//   md: 40 px avatar (legacy)
//   lg: 64 px avatar — current default per Phase 8 visual polish (Ricky picked
//       64 px headshots so the human element is the dominant scan target).
const SIZE_TABLE = {
  sm: { dim: 'h-8 w-8',   font: 'text-[12px]', wrap: 'w-[40px]', name: 'max-w-[60px]' },
  md: { dim: 'h-10 w-10', font: 'text-[15px]', wrap: 'w-11',     name: 'max-w-[60px]' },
  lg: { dim: 'h-16 w-16', font: 'text-[22px]', wrap: 'w-[72px]', name: 'max-w-[80px]' },
} as const;

const PersonLink = ({
  person,
  size = 'lg',
}: {
  person: Person;
  size?: 'sm' | 'md' | 'lg';
}) => {
  const t = SIZE_TABLE[size];
  const initial = (person.name || '?').charAt(0).toUpperCase();
  const body = (
    <>
      <div
        className={`flex ${t.dim} items-center justify-center overflow-hidden rounded-full border-[1.5px] ${t.font} font-bold`}
        style={{
          background: person.avatarUrl ? undefined : 'hsl(var(--bento-surface))',
          borderColor: 'var(--bento-hairline)',
          color: 'hsl(var(--bento-accent))',
        }}
      >
        {person.avatarUrl ? (
          <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span>{initial}</span>
        )}
      </div>
      <div
        className={`${t.name} truncate text-center text-[9px] leading-[1.1]`}
        title={person.name}
        style={{ color: 'hsl(var(--bento-fg))' }}
      >
        {person.name}
      </div>
    </>
  );

  if (!person.href) {
    return (
      <div className={`flex ${t.wrap} flex-col items-center gap-[3px]`} aria-label={person.name}>
        {body}
      </div>
    );
  }
  return (
    <Link
      to={person.href}
      className={`flex ${t.wrap} flex-col items-center gap-[3px] transition-transform duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40`}
    >
      {body}
    </Link>
  );
};

// ─── Time section header ─────────────────────────────────────────────────────
//
// Renders a horizontal time anchor above the session(s) at that time:
//
//   9:00 PM  · 1 HR · pick your level
//
// "pick your level" suffix only appears when the time slot holds 2+ classy
// sessions (a parallel class group). For a solo class or party, just time + dur.

const TimeSection = ({
  startMins,
  endMins,
  pickYourLevel,
  format,
}: {
  startMins: number;
  endMins: number;
  pickYourLevel: boolean;
  /** 'duration' renders "10:00 PM · 1 HR" — used for classes / masterclasses
   *  where session length is the meaningful timing fact.
   *  'range' renders "10:00 PM – 5:00 AM" — used when a slot includes a party,
   *  because dancers care most about when it ENDS rather than how long it ran. */
  format: 'duration' | 'range';
}) => (
  <div
    className="mb-[10px] flex items-baseline gap-[8px] pb-[6px]"
    style={{ borderBottom: '1px solid var(--bento-hairline)' }}
  >
    {format === 'range' ? (
      <span
        className="text-[15px] font-bold leading-none tracking-[-0.005em] tabular-nums"
        style={{ color: 'hsl(var(--bento-fg))' }}
      >
        {fmtMins12(startMins)} – {fmtMins12(endMins)}
      </span>
    ) : (
      <>
        <span
          className="text-[15px] font-bold leading-none tracking-[-0.005em] tabular-nums"
          style={{ color: 'hsl(var(--bento-fg))' }}
        >
          {fmtMins12(startMins)}
        </span>
        <span
          className="font-mono text-[9px] uppercase tracking-[0.14em]"
          style={{ color: 'hsl(var(--bento-fg-muted))' }}
        >
          · {fmtDuration(startMins, endMins)}
        </span>
      </>
    )}
    {pickYourLevel && (
      <span
        className="font-mono text-[9px] uppercase tracking-[0.14em]"
        style={{ color: 'hsl(var(--bento-fg-muted))' }}
      >
        · pick your level
      </span>
    )}
  </div>
);

// ─── Rank card — used for every class / masterclass session ──────────────────
//
// Layout: serif rank headline (Imp / Adv / Master / All / Class) at the top,
// optional non-default title below, optional room subtitle, optional teacher
// avatars at the bottom. All centred. The card itself sits as a small
// "compartment" — bento-surface (deeper than tile body) + brass hairline.
//
// Sized for use inside a 1–3 column grid below a TimeSection. Minimum width
// works at ~95px (mobile, 3-up); grows happily to full tile width for solo
// classes (1-up).
//
// `inGrid=true` keeps the dark compartment styling (bento-surface bg + brass
// hairline) which gives parallel cards the visual delineation they need to
// read as separate options. Solo cards (`inGrid=false`) drop the card and
// sit flat against the tile body, matching the Party section's treatment.

const RankCard = ({ session, inGrid }: { session: ScheduleSession; inGrid: boolean }) => {
  const rank = rankFor(session);
  const showTitle = !isDefaultClassTitle(session.title) && session.title.trim().length > 0;
  const titleText = showTitle ? session.title : null;

  return (
    <div
      className={
        inGrid
          ? 'min-w-0 rounded-[10px] px-[8px] pb-[8px] pt-[10px] text-center'
          : 'min-w-0 px-1 pt-[2px] text-center'
      }
      style={
        inGrid
          ? {
              background: 'hsl(var(--bento-surface))',
              border: '1px solid var(--bento-hairline)',
            }
          : undefined
      }
    >
      <div
        className="font-medium leading-none"
        style={{
          fontFamily: '"Fraunces", Georgia, serif',
          fontSize: '22px',
          letterSpacing: '0.02em',
          color: rank.muted ? 'hsl(var(--bento-fg-muted))' : 'hsl(var(--bento-accent))',
        }}
        title={LEVEL_LABEL_FULL_TOOLTIP(session)}
      >
        {rank.text}
      </div>

      {titleText && (
        <div
          className="mt-[6px] leading-[1.2]"
          style={{
            fontFamily: '"Fraunces", Georgia, serif',
            fontSize: '12px',
            color: 'hsl(var(--bento-fg))',
          }}
        >
          {titleText}
        </div>
      )}

      {session.room && (
        <div
          className="mt-[2px] text-[10px]"
          style={{ color: 'hsl(var(--bento-fg-muted))' }}
        >
          {session.room}
        </div>
      )}

      {session.people.length > 0 && (
        <div className="mt-[8px] flex flex-wrap justify-center gap-[6px]">
          {session.people.map((p, i) => (
            <PersonLink key={`${p.id}-${i}`} person={p} />
          ))}
        </div>
      )}
    </div>
  );
};

// Tooltip helper: spell out the rank for screen-reader / hover context, since
// abbreviations like "Beg/Adv" are ambiguous in isolation.
const LEVEL_LABEL_FULL_TOOLTIP = (session: ScheduleSession): string => {
  if (session.type === 'masterclass') return 'Masterclass — premium session with a master instructor';
  if (session.levels.length === 0) return 'Level not specified';
  if (session.levels.includes('open_level')) return 'Open Level — suitable for all dancers';
  if (session.levels.length === 4) return 'All four levels';
  return session.levels.map((l) => LEVEL_LABEL_FULL[l]).join(', ');
};

// ─── Party card — used for party-type sessions ───────────────────────────────
//
// Parties don't have ranks, so they get their own treatment: title in serif,
// "DJING" / "PERFORMING" role label, then DJs / performers.

const PartyCard = ({ session }: { session: ScheduleSession }) => {
  const roleLabel = roleLabelFor(session);
  // End time is now baked into the TimeSection's "10:00 PM – 5:00 AM" range
  // header above, so the card itself doesn't repeat it.
  return (
    <div className="min-w-0 px-1 text-center">
      <div
        className="text-[16px] font-semibold leading-[1.15] tracking-[-0.005em]"
        style={{ fontFamily: '"Fraunces", Georgia, serif', color: 'hsl(var(--bento-fg))' }}
      >
        {session.title || 'Party'}
      </div>

      {session.room && (
        <div
          className="mt-[4px] text-[11px]"
          style={{ color: 'hsl(var(--bento-fg-muted))' }}
        >
          {session.room}
        </div>
      )}

      {roleLabel && (
        <div
          className="mt-[6px] font-mono text-[9px] uppercase tracking-[0.14em]"
          style={{ color: 'hsl(var(--bento-fg-muted))' }}
        >
          {roleLabel}
        </div>
      )}

      {session.people.length > 0 && (
        <div className="mt-[8px] flex flex-wrap justify-center gap-[10px]">
          {session.people.map((p, i) => (
            <PersonLink key={`${p.id}-${i}`} person={p} />
          ))}
        </div>
      )}
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
}) => (
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
          className="flex-shrink-0 rounded-full px-[10px] py-[4px] text-[10px] font-bold uppercase tracking-[0.06em] transition-transform duration-150 active:scale-[0.97]"
          style={
            selected
              ? {
                  background: 'hsl(var(--bento-accent))',
                  color: 'hsl(var(--bento-surface))',
                  border: '1px solid hsl(var(--bento-accent))',
                }
              : {
                  background: 'transparent',
                  color: 'hsl(var(--bento-fg))',
                  border: '1px solid var(--bento-hairline)',
                }
          }
        >
          {fmtDayPill(day)}
        </button>
      );
    })}
  </div>
);

// ─── Normalization (sort + overnight fold) ───────────────────────────────────

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

// ─── Time-slot grouping ──────────────────────────────────────────────────────
//
// Group consecutive sessions sharing a start_time into a single "slot". The
// slot is "parallel-classy" only when it has 2+ sessions AND every session in
// it is class/masterclass — that's when we render side-by-side rank cards
// under a "pick your level" header. Mixed-type or solo slots stack vertically.

type Slot = {
  startMins: number;
  endMins: number;
  sessions: ScheduleSession[];
  isParallelClassy: boolean;
  hasParty: boolean;
};

const groupIntoSlots = (sessions: ScheduleSession[]): Slot[] => {
  const slots: Slot[] = [];
  for (const s of sessions) {
    const last = slots[slots.length - 1];
    if (last && last.startMins === s.startMins) {
      last.sessions.push(s);
      last.endMins = Math.max(last.endMins, s.endMins);
    } else {
      slots.push({
        startMins: s.startMins,
        endMins: s.endMins,
        sessions: [s],
        isParallelClassy: false,
        hasParty: false,
      });
    }
  }
  for (const slot of slots) {
    slot.isParallelClassy =
      slot.sessions.length >= 2 && slot.sessions.every((s) => isClassyType(s.type));
    slot.hasParty = slot.sessions.some((s) => s.type === 'party');
  }
  return slots;
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

  const slots = useMemo(() => groupIntoSlots(visibleSessions), [visibleSessions]);

  return (
    <BentoTile title={BLOCK_TITLES.schedule} color={BLOCK_COLORS.schedule} mode="container">
      {isMultiDay && currentDay && (
        <DayTabs days={uniqueDays} active={currentDay} onPick={setActiveDay} />
      )}

      {sessions.length === 0 ? (
        <div
          className="py-2 text-center text-[11px]"
          style={{ color: 'hsl(var(--bento-fg-muted))' }}
        >
          {isLoading ? 'Loading…' : 'Schedule coming soon'}
        </div>
      ) : (
        <div className="flex flex-col gap-[18px]">
          {slots.map((slot) => (
            <div key={`slot-${slot.startMins}-${slot.sessions[0]?.id ?? 'x'}`}>
              <TimeSection
                startMins={slot.startMins}
                endMins={slot.endMins}
                pickYourLevel={slot.isParallelClassy}
                format={slot.hasParty ? 'range' : 'duration'}
              />
              {slot.isParallelClassy ? (
                <div
                  className="grid gap-[6px]"
                  style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(95px, 1fr))' }}
                >
                  {slot.sessions.map((s) => (
                    <RankCard key={s.id} session={s} inGrid={true} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-[8px]">
                  {slot.sessions.map((s) =>
                    s.type === 'party' ? (
                      <PartyCard key={s.id} session={s} />
                    ) : (
                      <RankCard key={s.id} session={s} inGrid={false} />
                    ),
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </BentoTile>
  );
};
