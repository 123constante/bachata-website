import { Link } from 'react-router-dom';
import type { Person, SessionLevel } from '@/modules/event-page/sections/EventScheduleGrid';
import { PersonChip } from '@/modules/event-page/bento/blocks/schedule/PersonChip';

// ─── Constants ───────────────────────────────────────────────────────────────
//
// All sizing/threshold knobs live here so the schedule renderer's design
// density rules are codified in one place. Phase 2 of the schedule
// unification plan will move these into a shared `schedule.tokens.ts` file
// once a second consumer lands; until then keeping them local keeps the
// surface contained.

/** Above this many people in a single class/masterclass session, the
 *  wrap-row + wrap-leveled variants collapse to a "+N teachers" overflow
 *  pill rather than rendering every avatar. Decision locked 2026-04-30 —
 *  see plan_schedule_renderer_unification.md (Bachata Calendar PM workspace). */
const MANY_TEACHERS_THRESHOLD = 6;

/** inline-row variant: maximum avatars rendered as overlapping circles
 *  before the remainder collapse to a "+N" pill. Decision locked
 *  2026-04-30 (4 + "+N", matches Sched / Hopin convention over Eventbrite's 3). */
const INLINE_ROW_VISIBLE_MAX = 4;

const AVATAR_SIZES = {
  inline: 32,   // overlapping in single-room rows; tight footprint
  wrap: 64,     // class-card avatars; matches legacy PersonLink lg
  feature: 52,  // party headliner avatars; matches legacy PartyDjRow
} as const;

// Level labels — duplicated here for now; Phase 2 (tokens) consolidates
// into a shared module. Keeping local avoids cross-file churn for Phase 1.
const LEVEL_LABEL_FULL: Record<SessionLevel, string> = {
  beginner: 'Beginner',
  improver: 'Improver',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  open_level: 'Open Level',
};
const LEVEL_ORDER: SessionLevel[] = [
  'beginner',
  'improver',
  'intermediate',
  'advanced',
  'open_level',
];

// ─── Types ───────────────────────────────────────────────────────────────────

export type PeopleStackVariant =
  /** Wrapping horizontal row of (avatar + name) chips. Each chip is its own
   *  PersonChip — a Link with 44 px hit area and click-tracking attributes.
   *  Default discovery layout for single-room schedule rows, search hits,
   *  related-events strips. Decision locked 2026-04-30 — overlap is no
   *  longer the default; opt into chip-overlap explicitly when needed. */
  | 'chip-row'
  /** [LEGACY — kept for backward compatibility while other surfaces migrate]
   *  Overlapping circles only, no names. Was the single-room default
   *  before chip-row was introduced. Avoid for new code. */
  | 'inline-row'
  /** Flex-wrap of (avatar + name beneath). Flat class card layout — used
   *  by RankCard when a session has 0 or 1 levels, or when no person has
   *  a per-person level binding. */
  | 'wrap-row'
  /** Group people by their `level` field, render a level label + wrap-row
   *  per group. Used by RankCard when a session has 2+ levels AND at
   *  least one person carries a level binding. */
  | 'wrap-leveled'
  /** Vertical (role tag / avatar / name) stack. Used by PartyCard for
   *  party / performance / show sessions where each performer gets their
   *  own visual feature row. */
  | 'vertical-feature';

export interface PeopleStackProps {
  people: Person[];
  variant: PeopleStackVariant;
  /** Required for variant='wrap-leveled'. Session's declared levels in
   *  display order; the renderer uses this to drive the per-level grouping. */
  sessionLevels?: SessionLevel[];
  /** Override the >N teacher overflow trigger. Default 6. Festival cells
   *  may want to raise this. Only consulted by wrap-row, wrap-leveled and
   *  chip-row variants. */
  overflowThreshold?: number;
  /** Click handler for the "+N teachers" pill in the overflow variants. If
   *  unset, the pill renders as a non-interactive label with a hover
   *  tooltip listing the full name set. Phase 1 doesn't ship a modal —
   *  parents can wire one up later via this prop. */
  onOverflowClick?: () => void;
  /** Analytics context label forwarded to every PersonChip rendered inside
   *  this stack. Phase 3 will wire the click-tracking pipeline against this
   *  attribute (e.g. 'schedule:event:abc', 'search', 'festival-lineup'). */
  context?: string;
}

// ─── Internal leaf components ────────────────────────────────────────────────

const initialFor = (name: string): string => (name || '?').charAt(0).toUpperCase();

/** Bare avatar circle. Renders an `<img>` (with width/height for CLS
 *  protection) when avatarUrl is present, otherwise the initial inside
 *  a hairline border. Used by every variant — single source of truth. */
const Avatar = ({ person, size }: { person: Person; size: number }) => {
  const initial = initialFor(person.name);
  return (
    <div
      className="flex items-center justify-center overflow-hidden rounded-full font-bold"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.34),
        background: person.avatarUrl ? undefined : 'hsl(var(--bento-surface))',
        border: person.avatarUrl ? undefined : '1.5px solid var(--bento-hairline)',
        color: 'hsl(var(--bento-accent))',
      }}
    >
      {person.avatarUrl ? (
        <img
          src={person.avatarUrl}
          alt=""
          width={size}
          height={size}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
};

/** Wrap-cell — avatar + name beneath, optional <Link> wrapper when href is
 *  set. Used by wrap-row and wrap-leveled. Name is small (text-[9px]) to
 *  match the legacy PersonLink lg shape so this is a visual no-op. */
const WrapCell = ({ person, size }: { person: Person; size: number }) => {
  const body = (
    <>
      <Avatar person={person} size={size} />
      <div
        className="truncate text-center text-[9px] leading-[1.1]"
        title={person.name}
        style={{ color: 'hsl(var(--bento-fg))', maxWidth: size + 16 }}
      >
        {person.name}
      </div>
    </>
  );
  const cls = 'flex flex-col items-center gap-[3px]';
  const style = { width: size + 8 };
  if (!person.href) {
    return (
      <div className={cls} style={style} aria-label={person.name}>
        {body}
      </div>
    );
  }
  return (
    <Link
      to={person.href}
      className={`${cls} transition-transform duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40`}
      style={style}
    >
      {body}
    </Link>
  );
};

/** Feature-cell — role tag above, avatar in middle, serif name below.
 *  Matches the legacy PartyDjRow shape so PartyCard renders identically. */
const FeatureCell = ({ person, size }: { person: Person; size: number }) => {
  const body = (
    <>
      {person.role && (
        <div
          className="mb-[3px] text-[9px] font-bold uppercase tracking-[0.10em] leading-tight"
          style={{ color: 'hsl(var(--bento-accent))' }}
        >
          {person.role.toUpperCase()}
        </div>
      )}
      <Avatar person={person} size={size} />
      <div
        className="mt-[4px] text-center leading-[1.2]"
        style={{
          fontFamily: '"Fraunces", Georgia, serif',
          fontSize: '13px',
          color: 'hsl(var(--bento-fg))',
        }}
      >
        {person.name}
      </div>
    </>
  );
  if (!person.href) {
    return (
      <div className="flex flex-col items-center px-1" aria-label={person.name}>
        {body}
      </div>
    );
  }
  return (
    <Link
      to={person.href}
      className="flex flex-col items-center px-1 transition-transform duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
    >
      {body}
    </Link>
  );
};

/** "+N teachers" overflow pill. Tooltip lists all names so the
 *  information isn't lost. Becomes a `<button>` when onClick is wired
 *  (e.g. for a future modal), else a non-interactive `<div>`. */
const OverflowPill = ({
  count,
  names,
  onClick,
}: {
  count: number;
  names: string;
  onClick?: () => void;
}) => {
  const inner = (
    <div
      className="rounded-full px-3 py-1 text-[11px] font-bold"
      style={{
        background: 'hsl(var(--bento-surface))',
        border: '1px solid var(--bento-hairline)',
        color: 'hsl(var(--bento-fg))',
      }}
    >
      +{count} teachers
    </div>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={names}
        className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        {inner}
      </button>
    );
  }
  return <div title={names}>{inner}</div>;
};

// ─── Variants ────────────────────────────────────────────────────────────────

// ─── Variant: chip-row ───────────────────────────────────────────────────────
//
// Wrapping horizontal row of PersonChip (size='sm'). Each person is its own
// link with a 44 px hit area, name visible, no overlap. Above the threshold
// the whole row collapses to a "+N teachers" pill (decision 5).

const ChipRow = ({
  people,
  threshold,
  onOverflowClick,
  context,
}: {
  people: Person[];
  threshold: number;
  onOverflowClick?: () => void;
  context?: string;
}) => {
  if (people.length === 0) return null;
  if (people.length > threshold) {
    const overflowNames = people.map((p) => p.name).join(', ');
    return (
      <div className="flex">
        <OverflowPill count={people.length} names={overflowNames} onClick={onOverflowClick} />
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center" style={{ gap: '8px 14px' }}>
      {people.map((p) => (
        <PersonChip key={p.id} person={p} size="sm" context={context} />
      ))}
    </div>
  );
};

/** inline-row — overlapping avatars, no names, fixed footprint. */
const InlineRow = ({ people }: { people: Person[] }) => {
  if (people.length === 0) return null;
  const visible = people.slice(0, INLINE_ROW_VISIBLE_MAX);
  const overflow = people.length - visible.length;
  const overflowNames = people.slice(INLINE_ROW_VISIBLE_MAX).map((p) => p.name).join(', ');
  const size = AVATAR_SIZES.inline;
  // Ring color uses the schedule tile background so circles read as
  // separate even when overlapping. Falls back to bento-surface where
  // --bento-bg is unset.
  const ringStyle = '1.5px solid hsl(var(--bento-bg, var(--bento-surface)))';
  return (
    <div
      className="flex items-center"
      aria-label={people.map((p) => p.name).join(', ')}
    >
      {visible.map((p, i) => {
        const wrapStyle = {
          marginLeft: i === 0 ? 0 : -10,
          zIndex: visible.length - i,
          border: ringStyle,
          borderRadius: '9999px',
        };
        const inner = <Avatar person={p} size={size} />;
        return p.href ? (
          <Link
            key={p.id}
            to={p.href}
            style={wrapStyle}
            className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            aria-label={p.name}
          >
            {inner}
          </Link>
        ) : (
          <div key={p.id} style={wrapStyle} aria-label={p.name}>
            {inner}
          </div>
        );
      })}
      {overflow > 0 && (
        <div
          className="flex items-center justify-center rounded-full text-[11px] font-bold"
          title={overflowNames}
          style={{
            width: size,
            height: size,
            marginLeft: -10,
            background: 'hsl(var(--bento-surface))',
            border: ringStyle,
            color: 'hsl(var(--bento-fg))',
            zIndex: 0,
          }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
};

/** wrap-row — flex-wrap of WrapCell, with overflow collapse at threshold. */
const WrapRow = ({
  people,
  threshold,
  onOverflowClick,
}: {
  people: Person[];
  threshold: number;
  onOverflowClick?: () => void;
}) => {
  if (people.length === 0) return null;
  if (people.length > threshold) {
    const overflowNames = people.map((p) => p.name).join(', ');
    return (
      <div className="mt-[8px] flex justify-center">
        <OverflowPill count={people.length} names={overflowNames} onClick={onOverflowClick} />
      </div>
    );
  }
  return (
    <div className="mt-[8px] flex flex-wrap justify-center gap-[6px]">
      {people.map((p) => (
        <WrapCell key={p.id} person={p} size={AVATAR_SIZES.wrap} />
      ))}
    </div>
  );
};

/** wrap-leveled — group people by level, with overflow collapse on total. */
const WrapLeveled = ({
  people,
  sessionLevels,
  threshold,
  onOverflowClick,
}: {
  people: Person[];
  sessionLevels: SessionLevel[];
  threshold: number;
  onOverflowClick?: () => void;
}) => {
  if (people.length === 0) return null;
  if (people.length > threshold) {
    const overflowNames = people.map((p) => p.name).join(', ');
    return (
      <div className="mt-[8px] flex justify-center">
        <OverflowPill count={people.length} names={overflowNames} onClick={onOverflowClick} />
      </div>
    );
  }
  const sortedLevels = LEVEL_ORDER.filter((l) => sessionLevels.includes(l));
  const buckets = new Map<SessionLevel | 'whole', Person[]>();
  for (const p of people) {
    const key: SessionLevel | 'whole' = p.level ?? 'whole';
    const arr = buckets.get(key) ?? [];
    arr.push(p);
    buckets.set(key, arr);
  }
  const wholePpl = buckets.get('whole');
  return (
    <div className="mt-[8px] flex flex-col gap-[6px]">
      {sortedLevels.map((lvl) => {
        const ppl = buckets.get(lvl);
        if (!ppl || ppl.length === 0) return null;
        return (
          <div key={lvl} className="flex flex-wrap items-center justify-center gap-[6px]">
            <span
              className="text-[10px] uppercase tracking-wider opacity-70"
              style={{ color: 'hsl(var(--bento-fg))' }}
            >
              {LEVEL_LABEL_FULL[lvl]}
            </span>
            {ppl.map((p) => (
              <WrapCell key={p.id} person={p} size={AVATAR_SIZES.wrap} />
            ))}
          </div>
        );
      })}
      {wholePpl && wholePpl.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-[6px]">
          <span
            className="text-[10px] uppercase tracking-wider opacity-70"
            style={{ color: 'hsl(var(--bento-fg))' }}
          >
            Open Level
          </span>
          {wholePpl.map((p) => (
            <WrapCell key={p.id} person={p} size={AVATAR_SIZES.wrap} />
          ))}
        </div>
      )}
    </div>
  );
};

/** vertical-feature — stacked FeatureCells for parties / performances. */
const VerticalFeature = ({ people }: { people: Person[] }) => {
  if (people.length === 0) return null;
  return (
    <div className="mt-[10px] flex flex-col items-center gap-[10px]">
      {people.map((p) => (
        <FeatureCell key={p.id} person={p} size={AVATAR_SIZES.feature} />
      ))}
    </div>
  );
};

// ─── Main component ──────────────────────────────────────────────────────────

export const PeopleStack = ({
  people,
  variant,
  sessionLevels,
  overflowThreshold = MANY_TEACHERS_THRESHOLD,
  onOverflowClick,
  context,
}: PeopleStackProps) => {
  switch (variant) {
    case 'chip-row':
      return (
        <ChipRow
          people={people}
          threshold={overflowThreshold}
          onOverflowClick={onOverflowClick}
          context={context}
        />
      );
    case 'inline-row':
      return <InlineRow people={people} />;
    case 'wrap-row':
      return (
        <WrapRow
          people={people}
          threshold={overflowThreshold}
          onOverflowClick={onOverflowClick}
        />
      );
    case 'wrap-leveled':
      return (
        <WrapLeveled
          people={people}
          sessionLevels={sessionLevels ?? []}
          threshold={overflowThreshold}
          onOverflowClick={onOverflowClick}
        />
      );
    case 'vertical-feature':
      return <VerticalFeature people={people} />;
    default:
      return null;
  }
};
