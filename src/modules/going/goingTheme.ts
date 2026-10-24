import type { CSSProperties } from 'react';

/**
 * The colours a going component paints with, as CSS values. Every value is an
 * EXISTING token of the surface it sits on -- no new colours. The default is the
 * event page bento (src/index.css --bento-*); the gold CTA is the event page's
 * own (EventStickyActionBar), so the tile has no colour seam with the bento.
 * Another surface (festival hub, dancer app) passes its own tokens.
 */
export type GoingTheme = {
  fg: string;
  /** Secondary text. On the bento this is also the contrast floor: dim TEXT with it, never with opacity. */
  muted: string;
  surface: string;
  hairline: string;
  accent: string;
  /** The "I'm going" call to action. */
  primary: CSSProperties;
  /** "You're going" (pressed). */
  on: CSSProperties;
  /** Disabled / ghost. */
  ghost: CSSProperties;
  /** The initials circle and the "+N more" chip. */
  face: CSSProperties;
};

export const BENTO_GOING_THEME: GoingTheme = {
  fg: 'hsl(var(--bento-fg))',
  muted: 'hsl(var(--bento-fg-muted))',
  surface: 'hsl(var(--bento-surface-raised))',
  hairline: 'var(--bento-hairline)',
  accent: 'hsl(var(--bento-accent))',
  primary: { background: 'linear-gradient(180deg, #FFD64B, #FFB200)', color: '#3A2603', border: '1px solid transparent' },
  on: {
    background: 'hsl(var(--bento-accent) / 0.16)',
    color: 'hsl(var(--bento-fg))',
    border: '1px solid hsl(var(--bento-accent) / 0.6)',
  },
  ghost: {
    background: 'hsl(var(--bento-surface-raised))',
    color: 'hsl(var(--bento-fg-muted))',
    border: '1px solid hsl(var(--bento-fg-muted) / 0.25)',
  },
  face: {
    background: 'hsl(var(--bento-surface))',
    color: 'hsl(var(--bento-fg))',
    border: '2px solid hsl(var(--bento-surface-raised))',
  },
};
