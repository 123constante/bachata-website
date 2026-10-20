import type { CSSProperties } from 'react';

// Static page grounds for GlobalLayout (W1 S4). Each is a solid `base` that is
// also painted on <html>/<body> (so the strip above the footer is never a
// black band) plus an optional `wash` drawn on the fixed backdrop. No
// animation, no floating icons.
export type GroundPalette = 'default' | 'dancer' | 'dj';

export interface PageGround {
  base: string;
  wash: CSSProperties;
}

export const PAGE_GROUNDS: Record<GroundPalette, PageGround> = {
  // Calm graphite (owner pick B, S13): faint cool top light on #0E1215.
  default: {
    base: '#0e1215',
    wash: {
      background:
        'radial-gradient(130% 55% at 50% 0%, rgba(120,170,190,0.10), transparent 62%), ' +
        'linear-gradient(180deg, #11181c, #0e1215 60%)',
    },
  },
  // Role grounds from S12Mock (TEAL_INK / DJ_BG).
  dancer: { base: '#06191F', wash: { background: '#06191F' } },
  dj: { base: '#0A080B', wash: { background: '#0A080B' } },
};

export const isGroundPalette = (p: string): p is GroundPalette => p in PAGE_GROUNDS;
