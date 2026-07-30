/**
 * Palette bindings for the ticket-stub promo component (claude.ai/design 1b).
 *
 * The design ships on the Nocturne system (blurple #9184d9 on #161826). Ricky's
 * call was to keep 1b's structure and motion but drive colour from each host's
 * own accent, so the promo never introduces a third accent to a page that
 * already has two. Everything the component paints comes from these vars --
 * the component itself contains no literal colours.
 */

export type PromoTone = 'festival' | 'bento';

export type PromoToneVars = Record<string, string>;

export const PROMO_TONES: Record<PromoTone, PromoToneVars> = {
  // Festival cinematic page -- hard-coded #fb923c, matching the palette the
  // rest of FestivalDetail's CINEMATIC_CSS paints with.
  festival: {
    '--promo-accent': '#fb923c',
    '--promo-surface': 'rgba(251,146,60,0.07)',
    '--promo-fg': '#ffffff',
    '--promo-fg-muted': 'rgba(255,255,255,0.5)',
    '--promo-stub-bg': 'rgba(251,146,60,0.16)',
    // The notch punches a hole through the card to the page behind it, so this
    // must match the festival hero ground, not the card surface.
    '--promo-notch': '#08080a',
    '--promo-radius': '14px',
    '--promo-display': "'Bebas Neue', sans-serif",
  },
  // Event-page bento tile -- brass "Velvet and Brass" tokens from src/index.css.
  bento: {
    '--promo-accent': 'hsl(var(--bento-accent))',
    '--promo-surface': 'hsl(var(--bento-surface))',
    '--promo-fg': 'hsl(var(--bento-fg))',
    '--promo-fg-muted': 'hsl(var(--bento-fg-muted))',
    '--promo-stub-bg': 'hsl(var(--bento-accent) / 0.18)',
    // Inside a BentoTile the ground behind the card is the raised tile body.
    '--promo-notch': 'hsl(var(--bento-surface-raised))',
    '--promo-radius': '12px',
    '--promo-display': 'inherit',
  },
};

/**
 * Confetti palette. The design's own list is drawn from the Nocturne accent and
 * neutral ramps -- the intent is "low-chroma pieces in the accent family", which
 * is what survives the palette swap, not the specific blurples.
 */
export const PROMO_CONFETTI: Record<PromoTone, string[]> = {
  festival: [
    '#fb923c',
    'rgba(251,146,60,0.72)',
    '#ffffff',
    'rgba(255,255,255,0.45)',
    '#c2703a',
    '#8d8a82',
  ],
  bento: [
    '#B38A4E',
    'rgba(179,138,78,0.72)',
    '#D8CCB0',
    'rgba(216,204,176,0.5)',
    '#A59474',
    '#7c6742',
  ],
};
