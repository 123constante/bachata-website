// The face wall's look, in ONE file (approved warm-dark base "B" from the S10 mockup).
// Role accents: DJ gold, Dancer teal, Teacher violet. Organiser burnt orange is kept for
// when organisers join the wall. Contrast was measured in S10 and is re-asserted by
// wall/__tests__/wallContrast.test.tsx from the rendered DOM.
import type { PersonRole } from '@/lib/searchEntities';

export type WallRole = PersonRole | 'organiser';
export type ChipTokens = { bg: string; text: string; border: string };
export type TileTokens = { bg: string; ink: string; edge: string };

export const WALL = {
  page: '#1E1410',
  card: '#2B1D16',
  text: '#FBEBDD',
  muted: '#CDB09C',
  line: '#6A4A38',
} as const;

export const CHIP: Record<WallRole, ChipTokens> = {
  dj: { bg: '#F2B632', text: '#2B1A00', border: '#FFD479' },
  dancer: { bg: '#2DD4BF', text: '#04302C', border: '#8DF0E2' },
  teacher: { bg: '#B79CFB', text: '#1E0A4D', border: '#D8C8FD' },
  organiser: { bg: '#FB8A4B', text: '#3A1300', border: '#FFB68A' },
};

export const TILE: Record<WallRole, TileTokens> = {
  dj: { bg: '#6B4A0E', ink: '#FFE3A0', edge: '#C9921E' },
  dancer: { bg: '#0F4F4A', ink: '#A7F3E8', edge: '#2DD4BF' },
  teacher: { bg: '#4A2D8A', ink: '#E4D7FB', edge: '#A78BFA' },
  organiser: { bg: '#7A2F0E', ink: '#FFD2B8', edge: '#FB8A4B' },
};

/** Keyboard focus on every wall control: a 2px ring in WALL.text (the site has no global focus style). */
export const FOCUS_RING = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FBEBDD]';

/** Dark pill with gold text and a gold edge: holds on a gold tile and on a photo. */
export const DATE_CHIP: ChipTokens = { bg: '#1E1410', text: '#FFD479', border: '#FFD479' };

/** `#RRGGBB` -> the same colour at alpha 0. */
const clearOf = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, 0)`;
};

/**
 * The soft seams above and below the wall (owner, 2026-10-22: "soft fade", no hard line).
 * The page ground shows through the fade, so it starts from WALL.page at alpha 0, not from a
 * hard-coded hero colour: the ground differs per page and the /dancers one is animated.
 * Measured at 390x844 (prod build): hero bottom /dancers rgb(20,28,33), /djs rgb(10,8,11);
 * below the wall /dancers (Your Plans) rgb(14,18,21), /djs (footer) rgb(10,8,11).
 */
export const SEAM = {
  clear: clearOf(WALL.page),
  base: WALL.page,
  height: 64,
} as const;

/**
 * The wall's background (style props): two layers, each solid except its outer SEAM.height, which
 * fades clear -> base at the top and base -> clear at the bottom. Each covers 51% so they overlap
 * (no 1px gap at an odd height); minHeight keeps a short wall from staying see-through. Two
 * layers rather than one gradient with calc() stops: same pixels.
 */
export const WALL_FADE = {
  backgroundImage:
    `linear-gradient(to bottom, ${SEAM.clear} 0px, ${SEAM.base} ${SEAM.height}px), ` +
    `linear-gradient(to top, ${SEAM.clear} 0px, ${SEAM.base} ${SEAM.height}px)`,
  backgroundSize: '100% 51%',
  backgroundPosition: 'top, bottom',
  backgroundRepeat: 'no-repeat',
  // Tall enough that both fades finish and the middle is the solid base.
  minHeight: `${SEAM.height * 2}px`,
} as const;

/** Explicit px, not rem: the public site sets html font-size to ~13.5px on phones. */
export const SIZE = {
  columns: 4,
  gap: '12px 8px',
  tileRadius: 12,
  name: 11,
  nameLine: 14,
  chip: 10,
  chipLine: 13,
  /** Pills, the Organisers link, the coming-soon buttons: 44px tall AND wide (tap target). */
  filterHeight: 44,
  filterPadX: 10,
  filterGap: 6,
  initials: 28,
} as const;

/**
 * The person hub (/people/:id behind flags.personHub), W2-D option C (docs/design/w2d-hub.md, c.html): same base
 * and accents as the wall, explicit px for the same reason as SIZE. Tap targets (back, the big button, Also
 * cards) are all >= 44px.
 */
export const HUB = {
  face: 128,
  /** The `size` NationalityFlag gets: half the face, as the S12 mock (a sticker that leaves the initials clear). */
  flagFrom: 56,
  /**
   * The hub's warm ground reaches at least the bottom of the first screen (a one-card hub otherwise ends in
   * a cold void above the footer). 106 = where the hub starts under the site header at 360, 390 and 430 wide (prod build, measured).
   */
  groundMinHeight: 'max(128px, calc(100svh - 106px))',
  faceRadius: 22,
  initials: 44,
  name: 28,
  nameLine: 32,
  sub: 14,
  body: 15,
  /** The hero's summary line (next gig / years dancing). */
  line: 16,
  lineHeight: 22,
  /** "Opens their ... page" under the button, the Also lines, the About facts. */
  small: 13,
  smallLine: 18,
  sectionLabel: 13,
  heroRadius: 24,
  heroBorder: 2,
  alsoMinHeight: 72,
  alsoRadius: 16,
  alsoTitle: 16,
  ctaMinHeight: 52,
  ctaRadius: 16,
  ctaText: 17,
  tap: 44,
  /**
   * The fade from WALL.page into the footer gold (owner: no hard seam). 96px keeps every CSS row step under
   * 6/255 (the #924 gate); the footer's own top gap is painted gold on the hub route only (index.css).
   */
  fade: 96,
} as const;

/** The footer panel's colour (bg-primary): the hub fade ends on it. A var, not a new colour. */
export const FOOTER_GOLD = 'hsl(var(--primary))';
