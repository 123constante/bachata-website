// People arc S1: the three worlds' colours and fonts, ONE file. Every value is taken
// from the approved reference (branch claude/people-arc-worlds,
// docs/people-arc/worlds/worlds.html). S2-S4 build the worlds from these; a world
// never writes its own hex.
//
// Fonts: Inter is the site font. Fraunces 700 is already in DECORATIVE_FONTS_HREF
// (src/lib/decorativeFonts.ts, injected after load on every route). DM Serif Display
// is loaded by useDjPageFonts (src/components/dj/djPageTheme.ts) -- the DJ world
// calls that hook; no new font request is added here.
import type { PersonRole } from '../personRoles';

export const FONT = {
  body: 'Inter, system-ui, sans-serif',
  /** DJ world headings (the record sleeve). */
  djDisplay: "'DM Serif Display', Georgia, serif",
  /** Teacher world: the card name, section heads, class times. */
  teacherDisplay: 'Fraunces, Georgia, serif',
} as const;

/** One colour per role, shared by the role tabs, dots and the avatar placeholder. `on` = ink on a filled tab. */
export const ROLE_COLOUR: Record<PersonRole, { fill: string; on: string }> = {
  teacher: { fill: '#B79CFB', on: '#1E0A4D' },
  dj: { fill: '#F2B632', on: '#2B1A00' },
  dancer: { fill: '#2DD4BF', on: '#04302C' },
};

/** The frame (Back + Share bar, role tabs): the same on every world. */
export const FRAME = {
  tabsTrack: '#0F0F12',
  tabsBorder: '#3A3A44',
  tabInk: '#ECECF1',
} as const;

export type WorldTokens = {
  /** The page ground behind everything below the site header. */
  ground: string;
  /** Default text on the ground. */
  ink: string;
  /** The hero card. */
  card: { background: string; border: string; ink: string; muted: string };
  /** A section / row surface below the hero. */
  section: { background: string; border: string; row: string };
  /** The world's accent (kicker, dates, links). */
  accent: string;
  /** The initials placeholder: circle fill, initials ink, ring. */
  avatar: { background: string; ink: string; ring: string };
  /** The name's font. */
  nameFont: string;
};

export const WORLD: Record<PersonRole, WorldTokens> = {
  dancer: {
    ground: '#061A1F',
    ink: '#EAF8FA',
    card: { background: 'linear-gradient(165deg, #1F6E80 0%, #0F3B48 100%)', border: '#3C9BAA', ink: '#FFFFFF', muted: '#DDF3F6' },
    section: { background: '#0D2F37', border: '#2A6672', row: '#0D2F37' },
    accent: '#7FE7EF',
    avatar: { background: '#0C4A57', ink: '#B5F5F8', ring: '#5EE6F0' },
    nameFont: FONT.body,
  },
  dj: {
    ground: '#0E0B0A',
    ink: '#FBEBDD',
    card: {
      background: 'radial-gradient(130% 90% at 85% 0%, #6A3418 0%, #2A1810 45%, #160F0B 100%)',
      border: '#4A3122',
      ink: '#FFF4EA',
      muted: '#E3CDB9',
    },
    section: { background: '#1A1310', border: '#3A2A20', row: '#221915' },
    accent: '#F2C14E',
    avatar: { background: '#F2B632', ink: '#2B1A00', ring: '#C9921E' },
    nameFont: FONT.djDisplay,
  },
  teacher: {
    ground: '#15102A',
    ink: '#F1ECFF',
    card: { background: '#F5F0FF', border: '#4B2A9E', ink: '#1E1240', muted: '#3E2F6B' },
    section: { background: '#211A3D', border: '#3D2F70', row: '#2C2350' },
    accent: '#B79CFB',
    avatar: { background: '#E4D9FF', ink: '#3B1F86', ring: '#7C5BD6' },
    nameFont: FONT.teacherDisplay,
  },
};

/** The teacher world's studio-timetable details (S4), from the approved reference's .t-* rules. */
export const TEACHER_PAPER = {
  /** The TEACHER band across the top of the card, and its two punched holes (the ground showing through). */
  band: '#4B2A9E',
  bandInk: '#F5F0FF',
  /** The ruled lines on the card, and the grid lines on the ground. */
  rule: '#E6DCFB',
  grid: '#1D1738',
  /** Class rows: the date / contact value, the time, and the small line under the date. */
  rowInk: '#FFFFFF',
  time: '#D9CBFF',
  rowMuted: '#D3C8F2',
  /** The contact row's small label. */
  contactKey: '#CDB9FF',
} as const;
