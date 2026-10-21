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

/** Dark pill with gold text and a gold edge: holds on a gold tile and on a photo. */
export const DATE_CHIP: ChipTokens = { bg: '#1E1410', text: '#FFD479', border: '#FFD479' };

/** Explicit px, not rem: the public site sets html font-size to ~13.5px on phones. */
export const SIZE = {
  columns: 4,
  gap: '12px 8px',
  tileRadius: 12,
  name: 11,
  nameLine: 14,
  chip: 10,
  chipLine: 13,
  filterHeight: 40,
  initials: 28,
} as const;
