// F.2.b — SessionCell: unified single-cell renderer.
//
// Replaces the inlined RankCard, PartyCard, and the content area of
// SingleRoomScheduleRow that previously lived inside ScheduleBlock.tsx.
//
// Props:
//   session     — the ScheduleSession to render
//   kind        — coarse type bucket used to select the rendering path
//   isMultiRoom — true = multi-room card body; false = single-room row content
//   roomAccent  — per-room accent colour (left stripe + chip tint, multi-room only)
//   eventId     — forwarded to PeopleStack → PersonChip for click attribution

import type {
  ScheduleSession,
  SessionLevel,
} from '@/modules/event-page/sections/EventScheduleGrid';
import { PeopleStack } from './PeopleStack';

// ─── Classification helpers ──────────────────────────────────────────────────

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

const LEVEL_ORDER: SessionLevel[] = [
  'beginner', 'improver', 'intermediate', 'advanced', 'open_level',
];

const isDefaultClassTitle = (title: string): boolean =>
  /^(class|classes|masterclass|masterclasses)(\s+\d+)?$/i.test(title.trim());

const isDefaultPartyTitle = (title: string): boolean =>
  /^(party|parties|social|socials)(\s+\d+)?$/i.test(title.trim());

const rankFor = (session: ScheduleSession): { text: string; muted: boolean } => {
  if (session.type === 'masterclass') return { text: 'Master', muted: false };
  if (session.levels.length === 0)    return { text: 'Class',  muted: true  };
  if (session.levels.includes('open_level')) return { text: 'Open Level', muted: false };
  if (session.levels.length === 4)    return { text: 'All',    muted: false };
  const sorted = [...session.levels].sort(
    (a, b) => LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b),
  );
  if (sorted.length === 1) return { text: LEVEL_LABEL_FULL[sorted[0]], muted: false };
  return { text: sorted.map((l) => LEVEL_LABEL_SHORT[l]).join('/'), muted: false };
};

const rankTooltip = (session: ScheduleSession): string => {
  if (session.type === 'masterclass') return 'Masterclass — premium session with a master instructor';
  if (session.levels.length === 0)    return 'Level not specified';
  if (session.levels.includes('open_level')) return 'Open Level — suitable for all dancers';
  if (session.levels.length === 4)    return 'Open Level — suitable for all dancers';
  return session.levels.map((l) => LEVEL_LABEL_FULL[l]).join(', ');
};

// ─── Types ───────────────────────────────────────────────────────────────────

export type SessionKind =
  | 'class'
  | 'masterclass'
  | 'party'
  | 'performance'
  | 'show';

/** Derive the coarse SessionKind bucket from session.type string.
 *
 *  'social' (festival-only) maps to 'class' rendering — it's a structured
 *  social-dance slot, not a DJ party. Original FestivalProgramSection put
 *  it in the "Classes & Workshops" column, which this preserves. */
export const kindFor = (type: string): SessionKind => {
  if (type === 'masterclass') return 'masterclass';
  if (type === 'performance') return 'performance';
  if (type === 'show')        return 'show';
  if (type === 'party')       return 'party';
  return 'class'; // workshop, bootcamp, competition, class, social → class rendering
};

export type SessionCellProps = {
  session: ScheduleSession;
  kind: SessionKind;
  isMultiRoom: boolean;
  /** Per-room accent hex / hsl string. Drives left-edge tint + rank chip colour. */
  roomAccent?: string;
  eventId: string | null;
};

// ─── Single-room content ─────────────────────────────────────────────────────
// Matches the content area that was inlined in SingleRoomScheduleRow.
// The time column lives in ScheduleGrid — this component renders the right-hand
// "content column" only.

const SingleRoomContent = ({
  session,
  eventId,
}: Pick<SessionCellProps, 'session' | 'eventId'>) => {
  const isParty = session.type === 'party';
  const isPerformance = session.type === 'performance' || session.type === 'show';
  const isPartyish = isParty || isPerformance;

  const pillText = isPerformance ? 'Show' : isParty ? 'DJ' : 'Class';
  const trimmed  = (session.title ?? '').trim();
  const showTitle = !isPartyish
    ? !isDefaultClassTitle(session.title) && trimmed.length > 0
    : !isDefaultPartyTitle(session.title) && trimmed.length > 0;
  const titleText  = showTitle ? trimmed : null;
  const rank       = !isPartyish ? rankFor(session) : null;
  const rankInline = rank && !rank.muted ? rank.text : null;
  const headlineRight = [titleText, rankInline].filter(Boolean).join(' · ');
  const fullHeadline  = [pillText, headlineRight].filter(Boolean).join(' · ');

  return (
    <div className="min-w-0">
      <div
        style={{
          fontFamily: 'var(--font-mono, ui-monospace)',
          fontSize: '9px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.10em',
          color: 'hsl(var(--bento-accent))',
          lineHeight: 1.2,
        }}
        title={rankTooltip(session)}
      >
        {fullHeadline}
      </div>
      {session.people.length > 0 ? (
        <div style={{ marginTop: '8px' }}>
          <PeopleStack
            people={session.people}
            variant="chip-row"
            context="schedule:single-room"
            eventId={eventId}
          />
        </div>
      ) : (
        <div
          style={{
            fontFamily: '"Fraunces", Georgia, serif',
            fontSize: '14px',
            color: 'hsl(var(--bento-fg-muted))',
            marginTop: '6px',
            fontStyle: 'italic',
          }}
        >
          {isPartyish ? 'TBA' : 'Teachers TBA'}
        </div>
      )}
    </div>
  );
};

// ─── Multi-room class / masterclass cell ─────────────────────────────────────
// Matches the body of the former RankCard (always inGrid=true in multi-room).

const MultiRoomClassCell = ({
  session,
  roomAccent,
  eventId,
}: Pick<SessionCellProps, 'session' | 'roomAccent' | 'eventId'>) => {
  const rank      = rankFor(session);
  const showTitle = !isDefaultClassTitle(session.title) && session.title.trim().length > 0;
  const titleText = showTitle ? session.title : null;

  const hasLevelBinding = session.people.some((p) => p.level != null);
  const useLeveled      = hasLevelBinding && session.levels.length >= 2;

  return (
    <div className="min-w-0 rounded-[10px] px-[8px] pb-[8px] pt-[10px] text-center">
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
          title={rankTooltip(session)}
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
      <PeopleStack
        people={session.people}
        variant={useLeveled ? 'wrap-leveled' : 'wrap-row'}
        sessionLevels={session.levels}
        context="schedule:multi-room"
        eventId={eventId}
      />
    </div>
  );
};

// ─── Multi-room party / performance / show cell ──────────────────────────────
// Matches the body of the former PartyCard.

const MultiRoomPartyCell = ({
  session,
  roomAccent,
  eventId,
}: Pick<SessionCellProps, 'session' | 'roomAccent' | 'eventId'>) => {
  const isPerformance   = session.type === 'performance' || session.type === 'show';
  const trimmedTitle    = (session.title ?? '').trim();
  const showTitleAsHeading = trimmedTitle.length > 0 && !isDefaultPartyTitle(trimmedTitle);
  const headingText     = showTitleAsHeading ? trimmedTitle : null;

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
        const parts = headingText.split(' · ');
        const main  = parts[0];
        const note  = parts.slice(1).join(' · ');
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
      <PeopleStack
        people={session.people}
        variant="vertical-feature"
        context="schedule:multi-room-party"
        eventId={eventId}
      />
    </div>
  );
};

// ─── SessionCell ─────────────────────────────────────────────────────────────

/**
 * Unified single-cell renderer. Dispatches to the appropriate visual
 * treatment based on `kind` and `isMultiRoom`:
 *
 * - isMultiRoom=false  → single-row pill-headline + chip-row people
 * - isMultiRoom=true, class/masterclass → rank chip + title + wrap people
 * - isMultiRoom=true, party/performance/show → title + vertical-feature people
 *
 * The time column and grid layout live in ScheduleGrid — SessionCell renders
 * cell *content* only.
 */
export const SessionCell = ({
  session,
  kind,
  isMultiRoom,
  roomAccent,
  eventId,
}: SessionCellProps) => {
  if (!isMultiRoom) {
    return <SingleRoomContent session={session} eventId={eventId} />;
  }
  if (kind === 'class' || kind === 'masterclass') {
    return (
      <MultiRoomClassCell
        session={session}
        roomAccent={roomAccent}
        eventId={eventId}
      />
    );
  }
  return (
    <MultiRoomPartyCell
      session={session}
      roomAccent={roomAccent}
      eventId={eventId}
    />
  );
};
