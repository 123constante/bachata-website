import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Person } from '@/modules/event-page/sections/EventScheduleGrid';
import { emitProfileView } from '@/lib/profileViewEmit';
import { optimizedImageUrl, srcWidthFor } from '@/lib/imageCdn';

// --- PersonChip - atomic per-person render primitive ---
//
// Phase 1.5 of the schedule renderer unification (decision locked 2026-04-30):
// every place on the platform that names a person - schedule rows, class cards,
// party headliners, search results, festival lineups, listing pages - funnels
// through this one component. That guarantees:
//
//   * Every avatar+name is a real <Link> with a 44 px hit area (WCAG 2.5.5).
//   * Focus ring + active state are consistent everywhere.
//   * The "no profile yet" state is rendered uniformly (dim/hide/placeholder).
//   * Click instrumentation lands once and works across every surface (Phase 3).
//
// PersonChip is intentionally low-level. It does NOT decide layout (overlap vs
// row vs grid). PeopleStack picks the layout and renders zero or more chips
// inside it. See plan_person_discoverability.md.

// --- Sizes ---
//
// Picked at the callsite. The avatar visual size shrinks down to 24 px for
// dense surfaces; the outer hit area NEVER drops below 44 px (transparent
// padding does the work - invisible but tappable).

export type PersonChipSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_TABLE: Record<
  PersonChipSize,
  {
    avatarPx: number;
    nameFontPx: number;
    showName: boolean;
    initialFontPx: number;
    gapPx: number;
    nameMaxCh: number;
  }
> = {
  xs: { avatarPx: 24, nameFontPx: 0,  showName: false, initialFontPx: 11, gapPx: 0, nameMaxCh: 0 },
  sm: { avatarPx: 28, nameFontPx: 13, showName: true,  initialFontPx: 12, gapPx: 7, nameMaxCh: 18 },
  md: { avatarPx: 40, nameFontPx: 14, showName: true,  initialFontPx: 15, gapPx: 8, nameMaxCh: 18 },
  lg: { avatarPx: 52, nameFontPx: 13, showName: true,  initialFontPx: 18, gapPx: 9, nameMaxCh: 18 },
  xl: { avatarPx: 64, nameFontPx: 9,  showName: true,  initialFontPx: 22, gapPx: 0, nameMaxCh: 0  },
};

// Minimum interactive hit area, per WCAG 2.5.5 / Material's 48 dp guideline.
// Outer wrapper enforces this with transparent padding so the visual chip can
// stay compact without sacrificing tap reliability on mobile.
const HIT_AREA_MIN_PX = 44;

// --- Names print whole ---
//
// A stacked chip used to print only parts[0] of a multi-word name unless it
// matched a title-prefix allowlist ("Dj", "Mr") or a group keyword ("Team",
// "Academy"). Those allowlists could only spare the shapes someone had thought
// of, so on production it mangled 54 of 73 distinct names across 27 of 29 event
// pages and erased the partner from 32 teaching couples ("Abdel & Lety" ->
// "Abdel"). title= and aria-label= carried the full text throughout, so on a
// LINKED chip -- which lands on a real <a>, an element ARIA permits naming --
// hover and screen readers were right and only the eye was wrong. Do NOT read
// that as blanket accessible coverage: an unlinked chip is a bare <span> with
// no role, and ARIA prohibits an accessible name on a generic, so there the
// aria-label may never be announced and only the title tooltip carries it.
//
// Clipping is allowed, but only where the reader can SEE it -- an ellipsis or
// the line clamp below. Never a dropped word.

// --- Unlinked behaviour ---
//
// When a session names a person who doesn't yet have a profile in our DB
// (Person.href is null), the chip needs a defined fallback:
//
//   * 'dim'         - show the chip greyed out, name visible, tooltip explains
//                     why it's not a link. (Default, decision 2 locked
//                     2026-04-30.)
//   * 'hide'        - render nothing. Cheaper UX but loses the discovery hint.
//   * 'placeholder' - show the chip at full opacity, but rendered as a non-link
//                     `<div>`. Useful when the person is a known placeholder
//                     name that shouldn't visually de-emphasise.

export type UnlinkedMode = 'dim' | 'hide' | 'placeholder';

// --- Props ---

export interface PersonChipProps {
  person: Person;
  size?: PersonChipSize;
  /** Optional override - Person.role is the default. Passing here lets the
   *  callsite force a contextual label (e.g. show "DJ" on a party row even
   *  if Person.role is empty). */
  roleOverride?: string;
  /** When true, render the role tag above the avatar in `lg` / `xl` size.
   *  Used by party headliner cards. */
  showRole?: boolean;
  /** Override the chip's internal layout.
   *   * 'row'     - avatar + name horizontal (default). Used by chip-row.
   *   * 'stacked' - avatar above name, vertical. Used by class cards and
   *                 party headliners. With showRole, the role tag stacks
   *                 above the avatar.
   *  When omitted, defaults to 'row' for sm/md and 'stacked' for lg/xl
   *  with showRole, matching the most common callsite for each size. */
  layout?: 'row' | 'stacked';
  /** Where this chip is being rendered. Currently unused; Phase 3 will wire
   *  click instrumentation against this label so we can attribute profile
   *  views per source ("schedule:event:abc", "search", "festival-lineup"). */
  context?: string;
  /** Behaviour when person.href is null. Default 'dim'. */
  unlinked?: UnlinkedMode;
  /** When this chip is rendered inside a specific event surface (schedule
   *  row, related-events strip), pass the event id so click telemetry can
   *  attribute the discovery to that event. Optional - listings / search
   *  callsites leave it null. */
  eventId?: string | null;
}

// --- Implementation ---

// Trimmed on the way in. The chip text below is a trimmed `chipName`, so an
// untrimmed read here renders a correct name beside a blank circle -- for a
// leading-space name, `' '.charAt(0)` is a space. 8 rows in `dancer_profiles`
// carry surrounding whitespace today.
const initialFor = (name: string): string =>
  ((name ?? '').trim() || '?').charAt(0).toUpperCase();

/** The visible avatar circle. All sizes use the same anatomy - only the
 *  pixel knobs differ. The outer wrapper handles hit-area, not this.
 *
 *  Avatar load failure -> fall back to initials (mirrors OrganiserAvatar in
 *  OrganiserCardBlock.tsx). Without this, broken/expired storage URLs render
 *  the browser's missing-image glyph. */
const AvatarCircle = ({
  person,
  size,
  dimmed,
}: {
  person: Person;
  size: PersonChipSize;
  dimmed: boolean;
}) => {
  const t = SIZE_TABLE[size];
  const [errored, setErrored] = useState(false);
  const showAvatar = Boolean(person.avatarUrl) && !errored;
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold"
      style={{
        width: t.avatarPx,
        height: t.avatarPx,
        fontSize: t.initialFontPx,
        background: showAvatar ? undefined : 'hsl(var(--bento-surface))',
        border: showAvatar ? undefined : '1.5px solid var(--bento-hairline)',
        color: 'hsl(var(--bento-accent))',
        opacity: dimmed ? 0.55 : 1,
      }}
    >
      {showAvatar ? (
        <img
          src={optimizedImageUrl(person.avatarUrl as string, srcWidthFor(t.avatarPx))}
          alt=""
          width={t.avatarPx}
          height={t.avatarPx}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setErrored(true)}
        />
      ) : (
        <span>{initialFor(person.name)}</span>
      )}
    </div>
  );
};

export const PersonChip = ({
  person,
  size = 'sm',
  roleOverride,
  showRole = false,
  context,
  unlinked = 'dim',
  layout,
  eventId,
}: PersonChipProps) => {
  const t = SIZE_TABLE[size];
  const role = (roleOverride ?? person.role ?? '').trim();
  const isLinked = !!person.href;

  // Decide what to render based on linkedness + unlinked mode.
  if (!isLinked && unlinked === 'hide') return null;
  const isDimmed = !isLinked && unlinked === 'dim';
  // One resolved name, reused by every slot below -- the stacked text, the row
  // text, the title and the aria-label. The original defect hid because the row
  // branch printed the full name while the stacked branch printed one word, so
  // it read as intermittent rather than broken. (The avatar initial is derived
  // separately inside AvatarCircle and does not read this.)
  const chipName = (person.name ?? '').trim();
  const tooltip = isLinked
    ? chipName
    : `${chipName} - profile not yet on Bachata Calendar`;

  // Default layout picker - 'stacked' when the callsite asked for a role tag
  // (party headliner) or when the size is 'xl' (class-card cell), 'row'
  // otherwise (chip-row, default discovery shape).
  const effectiveLayout: 'row' | 'stacked' =
    layout ?? ((size === 'lg' && showRole) || size === 'xl' ? 'stacked' : 'row');

  const stacked = effectiveLayout === 'stacked';
  // Hide the role tag when the name already starts with that role word, e.g.
  // name "DJ Tony Spark" + role "DJ" would otherwise render "DJ" twice.
  const roleLeadsName =
    !!role && chipName.toLowerCase().startsWith(role.trim().toLowerCase() + ' ');
  const inner = stacked ? (
    <div className="flex flex-col items-center" style={{ minWidth: HIT_AREA_MIN_PX }}>
      <AvatarCircle person={person} size={size} dimmed={isDimmed} />
      {t.showName && (
        <div
          className="text-center leading-[1.2]"
          style={{
            // 'xl' (class-card) uses sans + 9 px to match the legacy WrapCell;
            // 'lg' (party headliner) uses serif + 13 px to match FeatureCell.
            fontFamily: size === 'xl' ? undefined : '"Fraunces", Georgia, serif',
            fontSize: t.nameFontPx,
            color: 'hsl(var(--bento-fg))',
            opacity: isDimmed ? 0.7 : 1,
            marginTop: 5,
            // Settled 2026-08-23 (Ricky): a stacked chip prints the WHOLE name
            // and clips with a VISIBLE ellipsis when it will not fit. This box
            // is deliberately narrow and is NOT to be widened. At `md` a name
            // past roughly 16 characters clamps -- "Cristian & Gabriella" ->
            // "Cristian & Ga..." -- and that is the intended outcome, not a
            // defect. An ellipsis is acceptable; a silently dropped word is
            // not. Do not reintroduce any shortening rule to make it fit, and
            // least of all an allowlist sparing couples or stage names: that
            // exclusion-shaped predicate is what caused the original bug.
            // Rationale: plans/queued-person-name-authority-round2-revert.md.
            maxWidth: t.avatarPx + 24,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            // Two DIFFERENT properties on purpose, and note which is which.
            // `word-break: break-word` is the PRIMARY, not the fallback: it is
            // understood by every Chrome, every Safari and Firefox 67+, i.e.
            // effectively all of our traffic. Per CSS Text it applies
            // `overflow-wrap: anywhere` whatever the declared overflow-wrap
            // says, so wherever it lands the line below is inert and its value
            // only decides what happens in the window it misses, Firefox
            // 49-66. `overflow-wrap: break-word` (Firefox 49+, Safari 6.1+,
            // every Chrome) covers that whole window; `anywhere` (Firefox 65+,
            // Safari 15.4+) covers only its top two versions, so break-word is
            // the strictly wider choice here and changes nothing anywhere else.
            // A third value cannot be added: duplicate keys in a style object
            // collapse to the last one, so the CSS trick of declaring a
            // widely-supported value and letting the cascade upgrade it is
            // unavailable, and a second `overflowWrap` would just erase the
            // first. With NEITHER property understood the used value is
            // `normal`, where a single token wider than the box does not wrap
            // at all and `overflow: hidden` shears it mid-glyph with no
            // ellipsis -- the invisible clip this file exists to prevent, on
            // the ~95% of traffic that is mobile.
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
          } as React.CSSProperties}
          /* Deliberately no title= here. The wrapper <Link>/<span> below
             already carries one, and on an unlinked chip that one is a strict
             superset of this text ("<name> - profile not yet on Bachata
             Calendar"). A title on this div shadows it for the whole name
             area, which is most of the chip, so hovering the name silently
             lost the explanation. Its original job -- revealing a full name
             the eye could not see -- ended when the shortener was deleted. */
        >
          {chipName}
        </div>
      )}
      {showRole && role && !roleLeadsName && (
        <div
          className="text-[9px] font-semibold uppercase tracking-[0.10em] leading-tight"
          style={{ color: 'hsl(var(--bento-accent))', opacity: isDimmed ? 0.6 : 1, marginTop: 3 }}
        >
          {role.toUpperCase()}
        </div>
      )}
    </div>
  ) : (
    <div
      className="flex items-center"
      style={{ gap: t.gapPx, minHeight: HIT_AREA_MIN_PX }}
    >
      <AvatarCircle person={person} size={size} dimmed={isDimmed} />
      {t.showName && (
        <span
          className="truncate"
          style={{
            fontFamily: '"Fraunces", Georgia, serif',
            fontSize: t.nameFontPx,
            fontWeight: 500,
            color: 'hsl(var(--bento-fg))',
            opacity: isDimmed ? 0.7 : 1,
            maxWidth: `${t.nameMaxCh}ch`,
          }}
        >
          {chipName}
        </span>
      )}
    </div>
  );

  // Common visual wrapper - radius, padding (for hit-area), focus ring.
  const visualStyle: React.CSSProperties = {
    paddingInline: 4,
    paddingBlock: 2,
    borderRadius: 9999,
  };
  const cls =
    'inline-flex items-center transition-transform duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 motion-reduce:transition-none';

  // data-* attributes so Phase 3 click instrumentation can attribute discovery
  // sources without re-touching every callsite.
  const dataAttrs = {
    'data-person-id': person.id,
    'data-profile-type': person.profileType ?? 'unknown',
    'data-context': context ?? 'schedule',
    'data-linked': isLinked ? 'true' : 'false',
  };

  if (isLinked && person.href) {
    // onClick fires synchronously before navigation. emitProfileView is
    // fire-and-forget; we never block or delay the actual <Link> behaviour
    // even on a failed RPC call.
    const handleClick = () => {
      emitProfileView({
        personId: person.id,
        profileType: person.profileType,
        context: context ?? 'schedule',
        eventId: eventId ?? null,
      });
    };
    return (
      <Link
        to={person.href}
        title={tooltip}
        aria-label={tooltip}
        className={cls}
        style={visualStyle}
        onClick={handleClick}
        {...dataAttrs}
      >
        {inner}
      </Link>
    );
  }

  // Unlinked -> render as non-interactive span. Cursor stays default. Tooltip
  // explains. Dimming (when chosen) signals "this person exists but isn't a
  // profile we host yet" without hiding them outright.
  return (
    <span
      title={tooltip}
      aria-label={tooltip}
      className="inline-flex items-center"
      style={visualStyle}
      {...dataAttrs}
    >
      {inner}
    </span>
  );
};
