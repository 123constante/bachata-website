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
import { PeopleStack } from '@/modules/event-page/bento/blocks/schedule/PeopleStack';

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

// Same idea for parties: "Party", "Social" and their numbered cousins are
// generic default labels (set by Smart Import / seeds), not distinctive event
// names. The PARTY section header above already says it's a party, so showing
// "Social" / "Party" inside the card is duplicate noise.
const isDefaultPartyTitle = (title: string): boolean =>
  /^(party|parties|social|socials)(\s+\d+)?$/i.test(title.trim());

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
  format,
}: {
  startMins: number;
  endMins: number;
  /** 'duration' renders prominent time + small muted duration ("8:00 PM · 55 MIN").
   *  'range' renders prominent range ("9:20 PM – 3:00 AM").
   *  Direction D — single brass colour for both, no section-specific tints. */
  format: 'duration' | 'range';
}) => (
  <div className="mb-[10px] flex flex-wrap items-baseline justify-center gap-[8px]">
    <span
      className="text-[15px] font-bold leading-none tracking-[-0.005em] tabular-nums"
      style={{ color: 'hsl(var(--bento-accent))' }}
    >
      {format === 'range'
        ? `${fmtMins12(startMins)} – ${fmtMins12(endMins)}`
        : fmtMins12(startMins)}
    </span>
    {format === 'duration' && (
      <span
        className="font-mono text-[9px] uppercase tracking-[0.14em]"
        style={{ color: 'hsl(var(--bento-fg-muted))' }}
      >
        · {fmtDuration(startMins, endMins)}
      </span>
    )}
  </div>
);

// ─── Section header — "centered with rules" pattern (D style) ────────────────
//
// Sits above a run of consecutive same-kind slots. Replaces the per-row
// CLASS / PARTY pill so the type label appears once per section instead of
// once per time row.

const SectionHeader = ({ label }: { label: string }) => (
  <div className="my-[4px] flex items-center gap-[10px]">
    <span
      className="block h-px flex-1"
      style={{ background: 'hsl(var(--bento-accent) / 0.30)' }}
    />
    <span
      className="font-mono text-[10px] font-semibold uppercase"
      style={{
        letterSpacing: '0.18em',
        color: 'hsl(var(--bento-accent))',
      }}
    >
      {label}
    </span>
    <span
      className="block h-px flex-1"
      style={{ background: 'hsl(var(--bento-accent) / 0.30)' }}
    />
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

const RankCard = ({
  session,
  inGrid,
  isMultiRoom,
  roomAccent,
}: {
  session: ScheduleSession;
  inGrid: boolean;
  isMultiRoom: boolean;
  /** Per-room accent color. Drives left-edge stripe + tints rank chip. */
  roomAccent?: string;
}) => {
  const rank = rankFor(session);
  const showTitle = !isDefaultClassTitle(session.title) && session.title.trim().length > 0;
  const titleText = showTitle ? session.title : null;
  // Multi-room: the room is identified by the column header at the top of
  // the schedule, so the card heading is always rank or title (never room).
  const useRoomAsHeading = false;
  // When rank would render the muted "Class" placeholder (i.e. session has no
  // levels set) and we have a real title, promote the title to be the heading
  // — the CLASS pill in the time row already identifies the type, so showing
  // "Class" again as a card heading is redundant.
  const useTitleAsHeading = rank.muted && !!titleText;

  return (
    <div
      className={
        inGrid
          ? 'min-w-0 rounded-[10px] px-[8px] pb-[8px] pt-[10px] text-center'
          : 'min-w-0 px-1 pt-[2px] text-center'
      }
      style={undefined}
    >
{/* Small uppercase level/rank label sits at the top of the card.
           Drops the previous big serif headline so teacher names (below)
           lead the visual hierarchy. Wraps freely if the label is long
           ('Beg/Imp/Int'). */}
      {!rank.muted && (
        <div
          className="leading-tight tracking-[0.08em]"
          style={{
            fontSize: '10px',
            fontWeight: 700,
            textTransform: 'uppercase',
            color: roomAccent ?? 'hsl(var(--bento-accent))',
            wordBreak: 'break-word',
          }}
          title={LEVEL_LABEL_FULL_TOOLTIP(session)}
        >
          {rank.text}
        </div>
      )}
      {rank.muted && !titleText && (
        <div
          className="leading-tight tracking-[0.08em] opacity-60"
          style={{
            fontSize: '10px',
            fontWeight: 700,
            textTransform: 'uppercase',
            color: 'hsl(var(--bento-fg-muted))',
          }}
        >
          {rank.text}
        </div>
      )}

      {/* Teacher names — primary content. Larger, serif, prominent. */}
      {titleText && (
        <div
          className="mt-[4px] leading-[1.2]"
          style={{
            fontFamily: '"Fraunces", Georgia, serif',
            fontSize: '14px',
            fontWeight: 500,
            color: 'hsl(var(--bento-fg))',
          }}
        >
          {titleText}
        </div>
      )}

      {(() => {
        // Per-level teacher rows when the session has 2+ declared levels and
        // at least one person carries a per-person level binding (Phase C —
        // e.g. May Day's Cuban Room 9pm: Beginner=Carlton, Improver=Damarys).
        // Otherwise fall back to a flat avatar wrap. Both branches now go
        // through PeopleStack so the layout is centrally maintained.
        const hasLevelBinding = session.people.some((p) => p.level != null);
        const useLeveled = hasLevelBinding && session.levels.length >= 2;
        return (
          <PeopleStack
            people={session.people}
            variant={useLeveled ? 'wrap-leveled' : 'wrap-row'}
            sessionLevels={session.levels}
          />
        );
      })()}
    </div>
  );
};

// Tooltip helper: spell out the rank for screen-reader / hover context, since
// abbreviations like "Beg/Adv" are ambiguous in isolation.
const LEVEL_LABEL_FULL_TOOLTIP = (session: ScheduleSession): string => {
  if (session.type === 'masterclass') return 'Masterclass — premium session with a master instructor';
  if (session.levels.length === 0) return 'Level not specified';
  if (session.levels.includes('open_level')) return 'Open Level — suitable for all dancers';
  if (session.levels.length === 4) return 'Open Level — suitable for all dancers';
  return session.levels.map((l) => LEVEL_LABEL_FULL[l]).join(', ');
};

// ─── Party DJ row — horizontal: avatar | name + role tag ────────────────────
//
// Used inside PartyCard. Each performer renders as an avatar on the left
// with their name and role label (DJ / DANCER / PERFORMER) stacked on the
// right. Profile-card feel; works for solo DJs and stacks nicely for nights
// with multiple performers.

// ─── Party card — used for party-type sessions ───────────────────────────────
//
// Parties don't have ranks, so they get their own treatment: title in serif
// (when distinctive — generic "Party" / "Social" suppressed), then the
// performer list (rendered by PeopleStack vertical-feature variant).

const PartyCard = ({
  session,
  isMultiRoom,
  roomAccent,
}: {
  session: ScheduleSession;
  isMultiRoom: boolean;
  /** Per-room accent color. Drives left-edge stripe + tints note tag. */
  roomAccent?: string;
}) => {
  const isPerformance = session.type === 'performance' || session.type === 'show';
  // End time is in the TimeSection's "10:00 PM – 5:00 AM" header above, so
  // the card itself doesn't repeat it. Room is identified by the column
  // header strip at the top of the schedule (when multi-room), so we never
  // use it as the card heading. When the title is a generic default
  // ("Party", "Social"), the card heading is suppressed — the PARTY section
  // header above already labels the section. Per-DJ rows below carry their
  // own role tag, so no shared roleLabel here.
  const trimmedTitle = (session.title ?? '').trim();
  const showTitleAsHeading =
    trimmedTitle.length > 0 && !isDefaultPartyTitle(trimmedTitle);
  const headingText = showTitleAsHeading ? trimmedTitle : null;

  return (
    <div className="min-w-0 px-1">
{isPerformance && (
        <div
          className="mb-[4px] inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[9px] font-bold uppercase tracking-[0.1em]"
          style={{
            background: `${roomAccent ?? 'hsl(var(--bento-accent))'}33`,
            color: roomAccent ?? 'hsl(var(--bento-accent))',
            border: `1px solid ${roomAccent ?? 'hsl(var(--bento-accent))'}66`,
          }}
        >
          ✦ Show
        </div>
      )}
      {headingText && (() => {
        // Split title on " · " so a trailing note (e.g. "Dance shows 11:30pm")
        // renders below the main DJ names instead of bloating the heading.
        const parts = headingText.split(' · ');
        const main = parts[0];
        const note = parts.slice(1).join(' · ');
        return (
          <>
            <div
              className="leading-[1.2]"
              style={{
                fontFamily: '"Fraunces", Georgia, serif',
                fontSize: '14px',
                fontWeight: 600,
                color: 'hsl(var(--bento-fg))',
              }}
            >
              {main}
            </div>
            {note && (
              <div
                className="mt-[3px] leading-tight"
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: roomAccent ?? 'hsl(var(--bento-accent))',
                }}
              >
                {note}
              </div>
            )}
          </>
        );
      })()}

      <PeopleStack people={session.people} variant="vertical-feature" />
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
    slot.hasParty = slot.sessions.some(
      (s) => s.type === 'party' || s.type === 'performance' || s.type === 'show',
    );
  }
  return slots;
};

// ─── Section grouping ────────────────────────────────────────────────────────
//
// Walk the time-ordered slots and group consecutive same-kind slots into a
// section. A "kind" is 'party' if the slot contains any party session,
// otherwise 'class'. Most events end up with two sections (classes then
// party); festivals can produce more.

type Section = {
  kind: 'class' | 'party';
  slots: Slot[];
};

const groupIntoSections = (slots: Slot[]): Section[] => {
  const sections: Section[] = [];
  for (const slot of slots) {
    const kind: 'class' | 'party' = slot.hasParty ? 'party' : 'class';
    const last = sections[sections.length - 1];
    if (last && last.kind === kind) {
      last.slots.push(slot);
    } else {
      sections.push({ kind, slots: [slot] });
    }
  }
  return sections;
};

// Section heading text. Plural for class sections with multiple slots OR a
// single slot with multiple parallel cards. Party stays singular regardless.
const sectionLabelFor = (section: Section): string => {
  if (section.kind === 'party') return 'PARTY';
  const isPlural =
    section.slots.length > 1 ||
    (section.slots[0]?.sessions.length ?? 0) > 1;
  return isPlural ? 'CLASSES' : 'CLASS';
};

// ─── Room column headers (multi-room only) ──────────────────────────────────
//
// One sticky-ish row at the top of the schedule that names each room column,
// so individual cards don't have to repeat the room name. Uses the same
// responsive column count as the slot grids below it, so columns align.

const RoomColumnHeaders = ({ rooms }: { rooms: string[] }) => {
  if (rooms.length < 2) return null;
  return (
    <div
      className="mb-[10px] grid gap-[6px]"
      style={{
        gridTemplateColumns: `64px repeat(${rooms.length}, 1fr)`,
        borderBottom: '1px solid var(--bento-hairline)',
        paddingBottom: '6px',
      }}
    >
      {/* Leading spacer aligned with the time column on each slot row below */}
      <div />
      {rooms.map((room) => (
        <div
          key={room}
          className="text-center text-[11px] font-bold uppercase leading-tight"
          style={{
            fontFamily: '"Fraunces", Georgia, serif',
            letterSpacing: '0.06em',
            color: 'hsl(var(--bento-accent))',
          }}
        >
          {room}
        </div>
      ))}
    </div>
  );
};

// ─── Single-room horizontal list row ───────────────────────────────────────
//
// Used when an event has 0 or 1 rooms. Each session renders as a horizontal
// row: time + duration on the left, avatar in the middle, pill + names on the
// right. No TimeSection band above — each row carries its own time.

const SingleRoomScheduleRow = ({ session }: { session: ScheduleSession }) => {
  const isParty = session.type === 'party';
  const isPerformance = session.type === 'performance' || session.type === 'show';
  const isPartyish = isParty || isPerformance;
  const startStr = fmtMins12(session.startMins);
  const endStr = fmtMins12(session.endMins);
  const duration = fmtDuration(session.startMins, session.endMins);

  const pillText = isPerformance ? 'Show' : isParty ? 'DJ' : 'Class';

  // Title display — drop default placeholder titles ("Class 1", "Party"...).
  const trimmed = (session.title ?? '').trim();
  const showTitle = !isPartyish
    ? !isDefaultClassTitle(session.title) && trimmed.length > 0
    : !isDefaultPartyTitle(session.title) && trimmed.length > 0;
  const titleText = showTitle ? trimmed : null;

  // Rank chip text (Beg/Imp etc) for class/masterclass with levels.
  const rank = !isPartyish ? rankFor(session) : null;
  const rankInline = rank && !rank.muted ? rank.text : null;

  const peopleNames = session.people.map((p) => p.name).filter(Boolean).join(' / ');

  // Compose the right-side label: title and people separated by " · " when both
  // exist. e.g. "Bachata · Juan Soto" or just "Juan Soto" or "Bachata".
  const rightLine = [titleText, peopleNames].filter(Boolean).join(' · ');

  return (
    <div
      className="grid items-center gap-[12px] px-1 py-1"
      style={{ gridTemplateColumns: '64px auto 1fr' }}
    >
      {/* Time column */}
      <div className="text-center">
        <div
          style={{
            fontSize: '12px',
            fontWeight: 700,
            color: 'hsl(var(--bento-accent))',
            lineHeight: 1.1,
          }}
        >
          {startStr}
        </div>
        <div
          className="font-mono"
          style={{
            fontSize: '9px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.10em',
            color: 'hsl(var(--bento-fg-muted))',
            marginTop: '3px',
          }}
        >
          {isPartyish ? `– ${endStr}` : duration}
        </div>
      </div>

      {/* Avatar(s) — every session.people stacked overlapping. Was previously
           hard-coded to people[0], silently dropping every other teacher/DJ
           (the bug Phase 1 of the schedule renderer unification fixes). Now
           routes through PeopleStack inline-row variant — first 4 visible,
           rest collapse to a "+N" pill (plan_schedule_renderer_unification.md). */}
      <div>
        {session.people.length > 0 ? (
          <PeopleStack people={session.people} variant="inline-row" />
        ) : (
          <div
            className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full"
            style={{
              background: 'hsl(var(--bento-surface))',
              border: '1.5px solid var(--bento-hairline)',
            }}
          />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0">
        <div
          style={{
            fontSize: '9px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.10em',
            color: 'hsl(var(--bento-accent))',
            lineHeight: 1.1,
          }}
          title={LEVEL_LABEL_FULL_TOOLTIP(session)}
        >
          {pillText}
          {rankInline ? ` · ${rankInline}` : ''}
        </div>
        <div
          style={{
            fontFamily: '"Fraunces", Georgia, serif',
            fontSize: '14px',
            fontWeight: 500,
            color: 'hsl(var(--bento-fg))',
            marginTop: '3px',
            lineHeight: 1.2,
          }}
        >
          {rightLine || (isPartyish ? 'TBA' : pillText)}
        </div>
      </div>
    </div>
  );
};

// ─── Main component ──────────────────────────────────────────────────────────

export const ScheduleBlock = ({ eventId }: ScheduleBlockProps) => {
  const { data: rawSessions = [], isLoading } = useProgramItems(eventId);

  const sessions = useMemo(() => normalize(rawSessions), [rawSessions]);

  // Multi-room mode = ≥ 2 distinct non-null rooms anywhere in the event's
  // sessions. When false, room names are hidden across the schedule.
  const isMultiRoom = useMemo(() => {
    const distinct = new Set<string>();
    for (const s of sessions) {
      if (s.room) distinct.add(s.room);
    }
    return distinct.size >= 2;
  }, [sessions]);

  // Phase C — ordered list of rooms used as 2D-grid columns when isMultiRoom.
  // Order = first appearance in the (already-sort_order-respecting) sessions
  // array. This matches the venue's intended room order rather than the
  // accident of alphabetical (e.g. flyer-order Salsa → Bachata → Cuban
  // instead of alphabetical Bachata → Cuban → Salsa).
  const orderedRooms = useMemo(() => {
    if (!isMultiRoom) return [] as string[];
    const seen = new Set<string>();
    const order: string[] = [];
    for (const s of sessions) {
      if (s.room && !seen.has(s.room)) {
        seen.add(s.room);
        order.push(s.room);
      }
    }
    return order;
  }, [isMultiRoom, sessions]);

  // Phase C polish — schedule-card background shading. Each room column sits
  // on a different shade (alternating dark/light/dark for 3 rooms; alternating
  // pattern continues for any N >= 2). The bg lives on the schedule's wrapper,
  // not on per-column overlays — so the shading is part of the card itself
  // rather than separate coloured columns. Hidden below sm: cards stack
  // vertically and the stripes would be confusing.
  const scheduleStripeBg = useMemo(() => {
    if (!isMultiRoom || orderedRooms.length < 2) return undefined;
    const n = orderedRooms.length;
    const stops: string[] = [];
    for (let i = 0; i < n; i++) {
      const start = ((i / n) * 100).toFixed(4);
      const end = (((i + 1) / n) * 100).toFixed(4);
      const color = i % 2 === 0
        ? 'transparent'              // even-index (leftmost / outer) — no tint
        : 'rgba(255,255,255,0.08)';  // odd-index (right / inner) — lighter side
      stops.push(`${color} ${start}% ${end}%`);
    }
    return `linear-gradient(to right, ${stops.join(', ')})`;
  }, [isMultiRoom, orderedRooms.length]);

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
  const sections = useMemo(() => groupIntoSections(slots), [slots]);

  return (
    <BentoTile title="" color={BLOCK_COLORS.schedule} mode="container">
      {isMultiDay && currentDay && (
        <DayTabs days={uniqueDays} active={currentDay} onPick={setActiveDay} />
      )}

      <div style={{ position: 'relative' }}>
        {/* Unified stripe overlay — sits behind the room column headers AND
             all sections, so the L/D shading runs continuously top-to-bottom
             as one rectangle per room. left=32px (24px label + 8px gap)
             aligns the stripe boundaries with the card-column grid. */}
        {scheduleStripeBg && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '-10px',
              bottom: '-10px',
              left: '102px',
              right: '-10px',
              backgroundImage: scheduleStripeBg,
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
        )}

        {/* Room column headers — aligned to the section grid below
             (24px spacer for the vertical CLASSES/PARTY label + 1fr containing
             the room labels). */}
        <div
          aria-hidden="true"
          style={{
            display: 'grid',
            gridTemplateColumns: '24px 1fr',
            gap: '8px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div />
          <RoomColumnHeaders rooms={orderedRooms} />
        </div>

        {sessions.length === 0 ? (
          <div
            className="py-2 text-center text-[11px]"
            style={{ color: 'hsl(var(--bento-fg-muted))' }}
          >
            {isLoading ? 'Loading…' : 'Schedule coming soon'}
          </div>
        ) : (
          <div className="flex flex-col gap-[14px]" style={{ position: 'relative', zIndex: 1 }}>
          {sections.map((section, sectionIdx) => (
            <div
              key={`section-${section.kind}-${sectionIdx}-${section.slots[0]?.startMins ?? 'x'}`}
              style={{
                // Direction D — no section bg tints. Hairline rule divides classes
                // from party. Horizontal padding dropped so cards line up with the
                // unified stripe overlay (at left=32px = 24px label + 8px gap).
                padding: '8px 0',
                display: 'grid',
                gridTemplateColumns: '24px 1fr',
                alignItems: 'stretch',
                gap: '8px',
                borderTop:
                  sectionIdx > 0
                    ? '0.5px solid hsl(var(--bento-accent) / 0.30)'
                    : 'none',
                paddingTop: sectionIdx > 0 ? '16px' : '8px',
                marginTop: sectionIdx > 0 ? '4px' : '0',
                position: 'relative',
                zIndex: 1,
              }}
            >
              {/* Vertical section label — book-spine style: rotated 180deg
                   so it reads bottom-to-top with letters right-side up. */}
              <div
                style={{
                  writingMode: 'vertical-rl',
                  transform: 'rotate(180deg)',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.20em',
                  fontFamily: '"Fraunces", Georgia, serif',
                  color: 'hsl(var(--bento-accent))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px 0',
                }}
                aria-label={section.kind === 'party' ? 'Party section' : 'Classes section'}
              >
                {section.kind === 'party' ? 'Party' : 'Classes'}
              </div>
              <div className="flex flex-col gap-[14px] min-w-0">
              {section.slots.map((slot) => {
                const format: 'duration' | 'range' = slot.hasParty ? 'range' : 'duration';

                // Phase C — multi-room 2D grid. When the event has ≥ 2 rooms,
                // each slot renders as fixed columns (one per room), with empty
                // cells shown as a muted "—". Column order is stable across
                // slots (alphabetical), so the user reads top-to-bottom in
                // each room. Mobile collapses to single-column stacking via
                // Tailwind's responsive grid (sm:grid-cols-N).
                if (isMultiRoom && orderedRooms.length >= 2) {
                  const startStr = fmtMins12(slot.startMins);
                  const endStr = fmtMins12(slot.endMins);
                  const durStr = fmtDuration(slot.startMins, slot.endMins);
                  const isPartyish = format === 'range';
                  return (
                    <div
                      key={`slot-${slot.startMins}-${slot.sessions[0]?.id ?? 'x'}`}
                      className="grid items-center gap-[6px]"
                      style={{ gridTemplateColumns: `64px repeat(${orderedRooms.length}, 1fr)` }}
                    >
                      <div className="text-center">
                        <div
                          style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            color: 'hsl(var(--bento-accent))',
                            lineHeight: 1.1,
                          }}
                        >
                          {startStr}
                        </div>
                        <div
                          className="font-mono"
                          style={{
                            fontSize: '9px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.10em',
                            color: 'hsl(var(--bento-fg-muted))',
                            marginTop: '3px',
                          }}
                        >
                          {isPartyish ? `– ${endStr}` : durStr}
                        </div>
                      </div>
                      {orderedRooms.map((room) => {
                        const cellSessions = slot.sessions.filter((s) => s.room === room);
                        if (cellSessions.length === 0) {
                          return (
                            <div
                              key={`empty-${room}`}
                              className="flex items-center justify-center rounded-[10px] py-2 opacity-25"
                              style={{
                                color: 'hsl(var(--bento-fg-muted))',
                              }}
                              aria-label={`No session in ${room} at this time`}
                            >
                              —
                            </div>
                          );
                        }
                        return (
                          <div
                            key={`cell-${room}`}
                            className="flex flex-col gap-[6px]"
                          >
                            {cellSessions.map((s) =>
                              s.type === 'party' || s.type === 'performance' || s.type === 'show' ? (
                                <PartyCard
                                  key={s.id}
                                  session={s}
                                  isMultiRoom={isMultiRoom}
                                />
                              ) : (
                                <RankCard
                                  key={s.id}
                                  session={s}
                                  inGrid={true}
                                  isMultiRoom={isMultiRoom}
                                />
                              ),
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                }

                // Single-room (or zero-room) layout — horizontal list rows.
                // Time column on the left, avatar in the middle, pill+name on
                // the right. No TimeSection band — each row carries its own time.
                return (
                  <div
                    key={`slot-${slot.startMins}-${slot.sessions[0]?.id ?? 'x'}`}
                    className="flex flex-col gap-[6px]"
                  >
                    {slot.sessions.map((s) => (
                      <SingleRoomScheduleRow key={s.id} session={s} />
                    ))}
                  </div>
                );
              })}
              </div>
            </div>
          ))}
          </div>
        )}
      </div>
    </BentoTile>
  );
};
