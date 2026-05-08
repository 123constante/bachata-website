import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
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
  inline: 32,   // overlapping circles in the legacy InlineRow variant.
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
  /** F.1.b — opt-in compact variant. Renders overlapping circles as a single
   *  44 px tap target (or Enter / Space when keyboard-focused). Tapping opens
   *  a popover (or bottom-sheet on mobile <640px) with a chip-row of full
   *  PersonChips for individual click-through. Use ONLY where density is the
   *  hard constraint and per-person tap-through can live one tap deeper —
   *  e.g. ultra-dense listing pages, calendar day cells. WCAG 2.5.5 hit area
   *  on the trigger; popover is keyboard-traversable, Esc closes. */
  | 'chip-overlap'
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
   *  this stack (e.g. 'schedule:single-room', 'schedule:multi-room',
   *  'search', 'festival-lineup'). */
  context?: string;
  /** Event id, forwarded to PersonChip → emitProfileView so click telemetry
   *  can attribute discovery to a specific event. Pass when the stack
   *  renders inside a schedule surface; leave null on listings / search. */
  eventId?: string | null;
}

// ─── Internal leaf components ────────────────────────────────────────────────

const initialFor = (name: string): string => (name || '?').charAt(0).toUpperCase();

/** Bare avatar circle. Renders an `<img>` (with width/height for CLS
 *  protection) when avatarUrl is present, otherwise the initial inside
 *  a hairline border. Used by every variant — single source of truth.
 *
 *  Avatar load failure → fall back to initials (mirrors OrganiserAvatar in
 *  OrganiserCardBlock.tsx). Without this, broken/expired storage URLs render
 *  the browser's missing-image glyph. */
const Avatar = ({ person, size }: { person: Person; size: number }) => {
  const initial = initialFor(person.name);
  const [errored, setErrored] = useState(false);
  const showAvatar = Boolean(person.avatarUrl) && !errored;
  return (
    <div
      className="flex items-center justify-center overflow-hidden rounded-full font-bold"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.34),
        background: showAvatar ? undefined : 'hsl(var(--bento-surface))',
        border: showAvatar ? undefined : '1.5px solid var(--bento-hairline)',
        color: 'hsl(var(--bento-accent))',
      }}
    >
      {showAvatar ? (
        <img
          src={person.avatarUrl as string}
          alt=""
          width={size}
          height={size}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setErrored(true)}
        />
      ) : (
        <span>{initial}</span>
      )}
    </div>
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
  eventId,
}: {
  people: Person[];
  threshold: number;
  onOverflowClick?: () => void;
  context?: string;
  eventId?: string | null;
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
        <PersonChip key={p.id} person={p} size="sm" context={context} eventId={eventId} />
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

/** wrap-row — flex-wrap of <PersonChip size="xl" layout="stacked">, with overflow collapse at threshold. */
const WrapRow = ({
  people,
  threshold,
  onOverflowClick,
  context,
  eventId,
}: {
  people: Person[];
  threshold: number;
  onOverflowClick?: () => void;
  context?: string;
  eventId?: string | null;
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
        <PersonChip key={p.id} person={p} size="xl" layout="stacked" context={context} eventId={eventId} />
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
  context,
  eventId,
}: {
  people: Person[];
  sessionLevels: SessionLevel[];
  threshold: number;
  onOverflowClick?: () => void;
  context?: string;
  eventId?: string | null;
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
              <PersonChip key={p.id} person={p} size="xl" layout="stacked" context={context} eventId={eventId} />
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
            <PersonChip key={p.id} person={p} size="xl" layout="stacked" context={context} eventId={eventId} />
          ))}
        </div>
      )}
    </div>
  );
};

/** vertical-feature — stacked PersonChips (lg + showRole) for parties /
 *  performances. Phase 2 collapses the former FeatureCell into PersonChip's
 *  layout='stacked'+showRole shape. Visual no-op. */
const VerticalFeature = ({
  people,
  context,
  eventId,
}: {
  people: Person[];
  context?: string;
  eventId?: string | null;
}) => {
  if (people.length === 0) return null;
  return (
    <div className="mt-[10px] flex flex-col items-center gap-[10px]">
      {people.map((p) => (
        <PersonChip
          key={p.id}
          person={p}
          size="lg"
          layout="stacked"
          showRole
          context={context}
          eventId={eventId}
        />
      ))}
    </div>
  );
};

// ─── Variant: chip-overlap ───────────────────────────────────────────────────
//
// Single-tap-target overlapping avatars (visual lookalike of inline-row) that
// open a popover with a real chip-row underneath. The trigger respects WCAG
// 2.5.5 (44 px minimum hit target). Popover handles Esc + click-outside +
// focus-return-on-close. Mobile (<640 px) renders as a bottom-sheet so the
// popover doesn't fall outside the viewport on tight calendar cells.

const MOBILE_BREAKPOINT_PX = 640;

const useIsMobile = (): boolean => {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < MOBILE_BREAKPOINT_PX;
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener?.('change', handler);
    return () => mql.removeEventListener?.('change', handler);
  }, []);
  return isMobile;
};

const ChipOverlapPopover = ({
  people,
  context,
  eventId,
  triggerRect,
  isMobile,
  onClose,
  popoverId,
  labelId,
}: {
  people: Person[];
  context?: string;
  eventId?: string | null;
  triggerRect: DOMRect | null;
  isMobile: boolean;
  onClose: () => void;
  popoverId: string;
  labelId: string;
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Esc closes; click-outside closes. Run on mount; re-bind only if onClose
  // identity changes (it's stable from useCallback in the parent).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const node = containerRef.current;
      const target = e.target;
      if (!node || !(target instanceof Node)) return;
      if (!node.contains(target)) onClose();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onPointer, true);
    document.addEventListener('touchstart', onPointer, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onPointer, true);
      document.removeEventListener('touchstart', onPointer, true);
    };
  }, [onClose]);

  // Focus the first focusable on mount so keyboard users land inside the
  // popover. Light focus-return is handled by the trigger button's parent.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const focusable = node.querySelector<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus({ preventScroll: true });
  }, []);

  if (typeof document === 'undefined') return null;

  // Positioning — desktop: float above/below the trigger; mobile: bottom sheet
  // anchored to the viewport bottom so it never clips off-screen.
  const positionStyle: React.CSSProperties = isMobile
    ? {
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        maxHeight: '60vh',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        boxShadow: '0 -10px 30px rgba(0,0,0,0.45)',
      }
    : (() => {
        const rect = triggerRect;
        const top = rect ? rect.bottom + window.scrollY + 8 : 0;
        const left = rect ? Math.max(8, rect.left + window.scrollX) : 8;
        return {
          position: 'absolute',
          top,
          left,
          maxWidth: 'min(calc(100vw - 16px), 360px)',
          borderRadius: 12,
          boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
        };
      })();

  const node = (
    <>
      {/* Backdrop on mobile only — desktop click-outside is enough. */}
      {isMobile && (
        <div
          className="fixed inset-0 z-[60] bg-black/55"
          aria-hidden
          onClick={onClose}
        />
      )}
      <div
        ref={containerRef}
        id={popoverId}
        role="dialog"
        aria-modal={isMobile ? 'true' : 'false'}
        aria-labelledby={labelId}
        className="z-[61] p-3"
        style={{
          ...positionStyle,
          background: 'hsl(var(--bento-surface))',
          border: '1px solid var(--bento-hairline)',
          color: 'hsl(var(--bento-fg))',
        }}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span id={labelId} className="text-[11px] uppercase tracking-[0.12em] opacity-70">
            {people.length} {people.length === 1 ? 'person' : 'people'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 opacity-70 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-wrap items-center" style={{ gap: '8px 14px' }}>
          {people.map((p) => (
            <PersonChip
              key={p.id}
              person={p}
              size="sm"
              context={context ? `${context}:overlap-popover` : 'overlap-popover'}
              eventId={eventId}
            />
          ))}
        </div>
      </div>
    </>
  );

  return createPortal(node, document.body);
};

const ChipOverlap = ({
  people,
  context,
  eventId,
}: {
  people: Person[];
  context?: string;
  eventId?: string | null;
}) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const triggerRectRef = useRef<DOMRect | null>(null);
  const isMobile = useIsMobile();
  const popoverId = useId();
  const labelId = useId();

  const handleClose = useCallback(() => {
    setOpen(false);
    // Return focus to the trigger when the popover closes.
    triggerRef.current?.focus({ preventScroll: true });
  }, []);

  const handleOpen = () => {
    triggerRectRef.current = triggerRef.current?.getBoundingClientRect() ?? null;
    setOpen(true);
  };

  if (people.length === 0) return null;

  const visible = people.slice(0, INLINE_ROW_VISIBLE_MAX);
  const overflow = people.length - visible.length;
  const overflowNames = people.slice(INLINE_ROW_VISIBLE_MAX).map((p) => p.name).join(', ');
  const allNames = people.map((p) => p.name).join(', ');
  const size = AVATAR_SIZES.inline;
  const ringStyle = '1.5px solid hsl(var(--bento-bg, var(--bento-surface)))';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center rounded-full p-1 transition-transform duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 motion-reduce:transition-none"
        style={{ minHeight: 44, minWidth: 44 }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        aria-label={`${people.length} ${people.length === 1 ? 'person' : 'people'}: ${allNames}. Open list.`}
        title={allNames}
      >
        {visible.map((p, i) => (
          <span
            key={p.id}
            style={{
              marginLeft: i === 0 ? 0 : -10,
              zIndex: visible.length - i,
              border: ringStyle,
              borderRadius: '9999px',
              display: 'inline-flex',
            }}
          >
            <Avatar person={p} size={size} />
          </span>
        ))}
        {overflow > 0 && (
          <span
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
          </span>
        )}
      </button>
      {open && (
        <ChipOverlapPopover
          people={people}
          context={context}
          eventId={eventId}
          triggerRect={triggerRectRef.current}
          isMobile={isMobile}
          onClose={handleClose}
          popoverId={popoverId}
          labelId={labelId}
        />
      )}
    </>
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
  eventId,
}: PeopleStackProps) => {
  switch (variant) {
    case 'chip-row':
      return (
        <ChipRow
          people={people}
          threshold={overflowThreshold}
          onOverflowClick={onOverflowClick}
          context={context}
          eventId={eventId}
        />
      );
    case 'inline-row':
      return <InlineRow people={people} />;
    case 'chip-overlap':
      return <ChipOverlap people={people} context={context} eventId={eventId} />;
    case 'wrap-row':
      return (
        <WrapRow
          people={people}
          threshold={overflowThreshold}
          onOverflowClick={onOverflowClick}
          context={context}
          eventId={eventId}
        />
      );
    case 'wrap-leveled':
      return (
        <WrapLeveled
          people={people}
          sessionLevels={sessionLevels ?? []}
          threshold={overflowThreshold}
          onOverflowClick={onOverflowClick}
          context={context}
          eventId={eventId}
        />
      );
    case 'vertical-feature':
      return <VerticalFeature people={people} context={context} eventId={eventId} />;
    default:
      return null;
  }
};
